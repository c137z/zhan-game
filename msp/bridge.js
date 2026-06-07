const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MSP_DIR = path.resolve(__dirname);
const INBOX = path.join(MSP_DIR, 'inbox');
const SESSION_ID_FILE = path.join(MSP_DIR, '.cc-session-id');
const MAX_TASKS_PER_SESSION = 50; // 每 50 个 task 后重置 session，防止上下文累积导致 token 膨胀
const OUTBOX = path.join(MSP_DIR, 'outbox');
const ARCHIVE = path.join(MSP_DIR, 'archive');
// MSP_DIR = .../projects/zhan/msp → PROJECT_ROOT = .../projects/zhan
const PROJECT_ROOT = fs.realpathSync(path.resolve(MSP_DIR, '..'));
// 启动时验证关键路径存在
if (!fs.existsSync(PROJECT_ROOT)) {
  console.error(`FATAL: PROJECT_ROOT does not exist: ${PROJECT_ROOT}`);
  process.exit(1);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(MSP_DIR, 'bridge.log'), line);
  console.log(line.trim());
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeNotifyFile(taskId, status, description) {
  ensureDir(OUTBOX);
  let prefix = '';
  if (status && status.includes('FAILED')) {
    prefix = '[FAILED] ';
  }
  const text = `${prefix}task-${taskId} ${status} — ${description}。请 Scheduler 审阅。`;
  const notifyPath = path.join(OUTBOX, `.notify-${taskId}.txt`);
  fs.writeFileSync(notifyPath, text, 'utf-8');
  log(`Notify file written: .notify-${taskId}.txt`);
}

// 启动时清理残留的 Claude Code 进程（防止旧 Bridge 实例的僵尸子进程和新实例冲突）
function killStaleClaudeProcesses() {
  try {
    execSync('taskkill /F /IM claude.exe 2>nul', { stdio: 'ignore' });
    log('Cleaned up stale claude.exe processes');
  } catch (e) {
    // 没有残留进程时 taskkill 返回非零，正常忽略
  }
}

// 启动时清理 inbox 中积压的任务（旧 Bridge 实例遗留，标记为 ABORTED）
function abortStaleInboxTasks() {
  if (!fs.existsSync(INBOX)) return;
  const files = fs.readdirSync(INBOX).filter(f => f.startsWith('task-') && f.endsWith('.json'));
  files.forEach(filename => {
    const taskPath = path.join(INBOX, filename);
    const taskId = filename.replace('task-', '').replace('.json', '');
    const result = {
      header: { taskId, from: 'bridge', to: 'scheduler', status: 'ABORTED' },
      body: {
        type: 'SYSTEM',
        stdout: '',
        stderr: 'Task aborted on Bridge restart — task was left in inbox from previous Bridge instance.',
        exitCode: -1,
        backupDir: '',
        promptPath: '',
        autoDiff: '(aborted — no worker invoked)'
      }
    };
    const resultPath = path.join(OUTBOX, `result-${taskId}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    const archivePath = path.join(ARCHIVE, `task-${taskId}.json`);
    fs.renameSync(taskPath, archivePath);
    log(`Aborted stale inbox task: ${taskId}`);
  });
}

// 用 git diff --no-index 生成差异（不需要 git 仓库）
function generateDiffSync(backupFile, currentFile, label) {
  try {
    const result = spawnSync('git', [
      'diff', '--no-index', '--', backupFile, currentFile
    ], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 10000
    });
    // git diff 返回码 1 = 有差异（正常）
    if (result.error) {
      return `(git diff error: ${result.error.message})`;
    }
    const output = (result.stdout || '').trim();
    // 替换临时路径为可读的文件名
    if (!output) return '(no differences)';
    return output
      .replace(/a\/.*?(?=\s)/g, `a/${label}`)
      .replace(/b\/.*?(?=\s)/g, `b/${label}`);
  } catch (e) {
    return `(diff failed: ${e.message})`;
  }
}

function buildPrompt(task) {
  const constraints = task.body.spec?.constraints?.join('\n- ') || '无';
  const testCases = task.body.spec?.testCases?.join('\n- ') || '无';

  return `# 任务 ${task.header.taskId}

## 角色
你是 Writer（代码修改者）。你只修改代码，不运行测试，不验证结果。

## 项目约束
- 纯前端 HTML/CSS/JS 游戏，单文件结构
- 使用 window.Zhan 命名空间
- data.js 禁止写 function（polyfill 除外）
- core.js 禁止碰 DOM
- ui.js 禁止直接修改 state
- 所有修改必须先备份到指定目录

## 当前任务
${task.body.description}

## 修改范围
${task.body.target}

## 具体约束
- ${constraints}

## 验证要求
- ${testCases}

## 文件位置
${path.join(PROJECT_ROOT, task.body.target)}

## 工作目录
${PROJECT_ROOT}

## 备份目录
${path.join(ARCHIVE, `backup-${task.header.taskId}`)}

## 输出要求（必须逐项完成，缺一不可）
1. 列出你修改的每个文件的**完整绝对路径**
2. 对每个修改的文件，输出 **git diff 格式的变更**：
   - 用 Markdown diff 代码块包裹（三个反引号 + diff 语言标记）
   - 格式示例（缩进表示代码块内容）：
       --- a/file.js
       +++ b/file.js
       @@ -10,5 +10,7 @@
       -   old code
       +   new code
   - 即使项目没有 git 仓库，也要模拟输出 diff 风格的变更说明
   - 必须包含行号范围（@@ -旧起始,旧行数 +新起始,新行数 @@）
3. 列出备份文件路径
4. 逐条说明你认为每条验证要求是否满足（**仅供参考，最终判定由 Scheduler/Verifier 审阅**）
5. 最后输出一行：TASK_DONE
`;
}

function callClaudeCode(taskPath, callback) {
  const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
  const taskId = task.header.taskId;

  console.time('task-' + taskId);
  log(`Processing task ${taskId}: ${task.body.type}`);

  // 写备份
  const backupDir = path.join(ARCHIVE, `backup-${taskId}`);
  ensureDir(backupDir);

  if (task.body.context?.relatedFiles) {
    task.body.context.relatedFiles.forEach(file => {
      const src = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, path.basename(file)));
      }
    });
  }

  // 生成 prompt
  const promptContent = buildPrompt(task);
  const promptPath = path.join(MSP_DIR, `prompt-${taskId}.md`);
  fs.writeFileSync(promptPath, promptContent, 'utf-8');

  // 读取或创建 session ID（复用 session = 缓存命中）
  let sessionId = null;
  try {
    if (fs.existsSync(SESSION_ID_FILE)) {
      sessionId = fs.readFileSync(SESSION_ID_FILE, 'utf-8').trim();
    }
  } catch (e) { /* ignore */ }

  // 构建 spawn 参数（如果已有 session 则 --resume，否则 --session-id 首次创建）
  const args = [
    '-p', promptPath,
    '--model', 'deepseek-v4-flash',
    '--allowedTools', 'Read,Edit,Bash',
    '--add-dir', PROJECT_ROOT
  ];
  if (sessionId) {
    args.push('-r', sessionId);
  } else {
    const { randomUUID } = require('crypto');
    const newSessionId = randomUUID();
    args.push('--session-id', newSessionId);
    sessionId = newSessionId;
    try {
      fs.writeFileSync(SESSION_ID_FILE, sessionId, 'utf-8');
    } catch (e) { /* ignore */ }
  }

  // 调用 Claude Code（cwd 由 spawn 选项指定，不要传 --cwd）
  const child = spawn('claude', args, {
    cwd: PROJECT_ROOT,
    env: process.env,
    shell: true
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });

  child.on('error', (err) => {
    log(`Spawn failed: ${err.message}`);
    const result = {
      header: { taskId, from: 'claude-code', to: 'scheduler', status: 'FAILED' },
      body: { type: task.body.type, stdout: '', stderr: err.message, exitCode: -1, backupDir, promptPath }
    };
    const resultPath = path.join(OUTBOX, `result-${taskId}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    fs.renameSync(taskPath, path.join(ARCHIVE, `task-${taskId}.json`));
    writeNotifyFile(taskId, 'FAILED', task.body.description);
    callback(result);
  });

  child.on('close', (code) => {
    // 自动生成 diff：对比备份文件和当前文件
    let autoDiff = '';
    if (task.body.context?.relatedFiles) {
      task.body.context.relatedFiles.forEach(file => {
        const backupFile = path.join(backupDir, path.basename(file));
        const currentFile = path.join(PROJECT_ROOT, file);
        if (fs.existsSync(backupFile) && fs.existsSync(currentFile)) {
          const oldContent = fs.readFileSync(backupFile, 'utf-8');
          const newContent = fs.readFileSync(currentFile, 'utf-8');
          if (oldContent !== newContent) {
            autoDiff += `\n=== AUTO DIFF: ${file} ===\n`;
            autoDiff += generateDiffSync(backupFile, currentFile, file);
          } else {
            autoDiff += `\n=== AUTO DIFF: ${file} ===\n(no changes detected)\n`;
          }
        }
      });
    }

    const result = {
      header: {
        taskId,
        from: 'claude-code',
        to: 'scheduler',
        status: code === 0 && stdout.includes('TASK_DONE') ? 'DONE' : 'FAILED'
      },
      body: {
        type: task.body.type,
        stdout: stdout.slice(0, 10000),
        stderr: stderr.slice(0, 5000),
        exitCode: code,
        backupDir,
        promptPath,
        autoDiff: autoDiff || '(no related files to diff)'
      }
    };

    const resultPath = path.join(OUTBOX, `result-${taskId}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

    // 归档原任务（容错处理：文件可能已被其他进程清理）
    const archivePath = path.join(ARCHIVE, `task-${taskId}.json`);
    if (fs.existsSync(taskPath)) {
      try {
        fs.renameSync(taskPath, archivePath);
      } catch (e) {
        log(`Archive warning: ${e.message}`);
      }
    }

    writeNotifyFile(taskId, result.header.status, task.body.description);

    // Session 自动重置：每 MAX_TASKS_PER_SESSION 个 task 后删除 session 文件
    // 原因：上下文累积导致每轮 input_tokens 从几百涨到 20-30 万，cache 命中率从 80%+ 掉到 ~40%
    if (!callClaudeCode._taskCount) callClaudeCode._taskCount = 0;
    callClaudeCode._taskCount++;

    if (fs.existsSync(SESSION_ID_FILE)) {
      const sid = fs.readFileSync(SESSION_ID_FILE, 'utf-8').trim().substring(0, 8);
      log(`  session: ${sid}... | task #${callClaudeCode._taskCount}/${MAX_TASKS_PER_SESSION}`);

      if (callClaudeCode._taskCount >= MAX_TASKS_PER_SESSION) {
        try {
          fs.unlinkSync(SESSION_ID_FILE);
          log(`  session reset: deleted .cc-session-id after ${callClaudeCode._taskCount} tasks (threshold=${MAX_TASKS_PER_SESSION})`);
          callClaudeCode._taskCount = 0;
        } catch (e) {
          log(`  session reset failed: ${e.message}`);
        }
      }
    }

    log(`Task ${taskId} completed with status: ${result.header.status}`);
    callback(result);
  });
}

const processedFiles = new Set();

function scanInbox() {
  if (!fs.existsSync(INBOX)) return;
  const files = fs.readdirSync(INBOX).filter(f => f.startsWith('task-') && f.endsWith('.json'));
  files.forEach(filename => {
    if (processedFiles.has(filename)) return;
    processedFiles.add(filename);
    const taskPath = path.join(INBOX, filename);
    if (!fs.existsSync(taskPath)) return;
    try {
      callClaudeCode(taskPath, (result) => {
        log(`Result written to outbox/result-${result.header.taskId}.json`);
      });
    } catch (err) {
      log(`Error processing ${filename}: ${err.message}`);
    }
  });
}

function watchInbox() {
  ensureDir(INBOX);
  ensureDir(OUTBOX);
  ensureDir(ARCHIVE);

  // 启动清理：杀残留 Claude Code 进程 + 清理旧任务
  killStaleClaudeProcesses();
  abortStaleInboxTasks();

  log(`Bridge started. PID: ${process.pid}`);
  log(`Watching: ${INBOX}`);
  log(`Project root: ${PROJECT_ROOT}`);

  // polling 扫描 + fs.watch 双保险
  fs.watch(INBOX, (eventType, filename) => {
    if (filename && filename.startsWith('task-')) {
      setTimeout(() => scanInbox(), 200);
    }
  });
}

// 启动
watchInbox();

// polling 扫描 + 心跳
setInterval(() => {
  scanInbox();
}, 5000);

module.exports = { callClaudeCode, watchInbox };
