// ============================================================
//  斩 — 万局自动化模拟测试 (Node.js)
//  用法: node simulate.js [局数] [起始种子]
// ============================================================

var fs = require('fs');
var vm = require('vm');

// ---- 配置 ----
var TOTAL_GAMES = parseInt(process.argv[2], 10) || 1000;
var START_SEED  = parseInt(process.argv[3], 10) || 1;
var MAX_STEPS   = 300;  // 单局最大步数，防止死循环
var DUMP_LOGS   = process.argv.indexOf('--logs') >= 0;   // 失败时导出战斗日志
var VERBOSE     = process.argv.indexOf('--verbose') >= 0; // 每局都导出战斗日志

// ---- 沙箱环境 ----
var sandbox = {
  window: {},
  document: {},
  localStorage: (function() {
    var store = {};
    return {
      getItem: function(k) { return store[k] || null; },
      setItem: function(k, v) { store[k] = String(v); },
      removeItem: function(k) { delete store[k]; }
    };
  })(),
  console: { log: function() {} },
  setTimeout: function(fn, ms) { fn(); },  // 同步回放
  clearTimeout: function() {},
  navigator: { userAgent: 'node-sim' },
};

// 加载 data.js
vm.runInNewContext(fs.readFileSync(__dirname + '/data.js', 'utf8'), sandbox, { filename: 'data.js' });

// 将 data.js 的全局变量挂入沙箱
for (var k in sandbox) {
  if (sandbox.hasOwnProperty(k) && typeof sandbox[k] !== 'function') {
    // already set
  }
}

// 让 Zhan 在沙箱内可裸引用（不等同于 window.Zhan）
vm.runInNewContext("var Zhan = {}; window.Zhan = Zhan;", sandbox);
vm.runInNewContext("function updateComboPreview() {}", sandbox);  // legacy wrapper

// 加载 core.js（依赖 data.js 的全局变量）
vm.runInNewContext(fs.readFileSync(__dirname + '/core.js', 'utf8'), sandbox, { filename: 'core.js' });

// ---- 提取关键引用 ----
var Zhan    = sandbox.Zhan || sandbox.window.Zhan;
var CONFIG  = sandbox.CONFIG;
var CAT_BOSS_IDS = sandbox.CAT_BOSS_IDS;

if (!Zhan || !CONFIG) {
  console.error('FATAL: Failed to load engine. Check data.js / core.js.');
  process.exit(1);
}

// Mock UI 层 — 防止 core.js 的 render 调用报错
Zhan.UI = Zhan.UI || {};
Zhan.UI.render = function() {};
Zhan.UI.updateComboPreview = function() {};
Zhan.UI.showResult = function() {};
Zhan.UI.renderMainMenu = function() {};
Zhan.UI._showView = function() {};
Zhan.UI.renderEnemyIntent = function() {};
Zhan.UI.renderRelicSelect = function() {};
Zhan.UI.renderStageSelect = function() {};
Zhan.UI.renderCatMaoShop = function() {};
Zhan.UI.renderAffinitySelect = function() {};
Zhan.UI.renderLog = function() {};
function updateComboPreview() {}  // legacy wrapper, ui.js 里定义的

// ---- 辅助函数 ----
function checkState(st) {
  var errors = [];
  if (isNaN(st.playerHP))       errors.push('playerHP is NaN');
  if (isNaN(st.enemyHP))        errors.push('enemyHP is NaN');
  if (isNaN(st.playerMaxHP))    errors.push('playerMaxHP is NaN');
  if (isNaN(st.enemyMaxHP))     errors.push('enemyMaxHP is NaN');
  if (isNaN(st.playerShield))   errors.push('playerShield is NaN');
  if (isNaN(st.enemyShield))    errors.push('enemyShield is NaN');
  if (isNaN(st.power))          errors.push('power is NaN');
  if (isNaN(st.turn))           errors.push('turn is NaN');
  if (isNaN(st.effectiveSlotSize)) errors.push('effectiveSlotSize is NaN');
  if (st.playerHP < 0)          errors.push('playerHP < 0: ' + st.playerHP);
  if (st.enemyHP < 0)           errors.push('enemyHP < 0: ' + st.enemyHP);
  if (st.playerHP > st.playerMaxHP * 2) errors.push('playerHP inflated: ' + st.playerHP + ' / ' + st.playerMaxHP);
  if (st.enemyHP > st.enemyMaxHP * 2)   errors.push('enemyHP inflated: ' + st.enemyHP + ' / ' + st.enemyMaxHP);

  // 非法 phase
  var validPhases = [CONFIG.PHASE_PLAYER, CONFIG.PHASE_ENEMY, 'resolving', CONFIG.PHASE_OVER];
  if (validPhases.indexOf(st.phase) < 0 && st.phase !== undefined) {
    errors.push('invalid phase: ' + st.phase);
  }
  return errors;
}

function getPilesWithCards(st) {
  var result = [];
  for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
    for (var c = 0; c < CONFIG.BOARD_COLS; c++) {
      if (st.piles[r] && st.piles[r][c] && st.piles[r][c].length > 0) {
        // 检查是否锁定
        var flatIdx = r * CONFIG.BOARD_COLS + c;
        if (!st.lockedPiles || !st.lockedPiles[flatIdx]) {
          result.push({ r: r, c: c });
        }
      }
    }
  }
  return result;
}

// ---- 主循环 ----
var failures = [];
var stuckCount = 0;
var crashCount = 0;

console.log('=== 斩 万局模拟 ===');
console.log('局数: ' + TOTAL_GAMES + ' | 起始种子: ' + START_SEED + ' | 最大步数: ' + MAX_STEPS);
console.log('');

for (var seed = START_SEED; seed < START_SEED + TOTAL_GAMES; seed++) {
  try {
    Zhan.Engine.state = null;
    Zhan.Engine._towerDefeated = {};
    Zhan.RNG.setSeed(seed);
    Zhan.Engine.init();

    var st = Zhan.Engine.state;
    if (!st) throw new Error('init returned null');

    var step = 0;
    while (!st.over && step < MAX_STEPS) {
      step++;

      // 只在玩家回合出牌
      if (st.phase === CONFIG.PHASE_PLAYER && !st.over) {
        // 先结束当前回合出牌并结算
        if (st.slot.length > 0) {
          Zhan.Engine.dispatch({ type: 'END_TURN' });
        } else {
          // 出牌：随机选一摞有牌的格子
          var piles = getPilesWithCards(st);
          if (piles.length === 0) {
            // 没牌可出，结束回合
            Zhan.Engine.dispatch({ type: 'END_TURN' });
          } else {
            var pick = piles[Math.floor(Math.random() * piles.length)];
            Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: pick.r, c: pick.c });
          }
        }
      } else {
        // 等待 enemy 回合结束（setTimeout 已被 mock 为同步）
        // phase 会在 _enemyTurn 末尾变为 PHASE_PLAYER
        // 如果 phase 还是 enemy，说明 action 可能被跳过了
        if (st.phase === 'resolving' || st.phase === CONFIG.PHASE_ENEMY) {
          // setTimeout(fn, 300/400) 已经同步执行了，检查是否 over
          if (st.over) break;
        }
        // 防止死循环
        step++;
        if (step >= MAX_STEPS) break;
      }

      // 每次操作后检查状态
      var errors = checkState(st);
      if (errors.length > 0) {
        failures.push({ seed: seed, step: step, errors: errors, phase: st.phase, logLines: st.logLines });
        break;
      }

      st = Zhan.Engine.state;
    }

    if (step >= MAX_STEPS && !st.over) {
      stuckCount++;
      failures.push({ seed: seed, step: step, errors: ['STUCK: exceeded ' + MAX_STEPS + ' steps'],
        turn: st.turn, phase: st.phase, playerHP: st.playerHP, enemyHP: st.enemyHP, logLines: st.logLines });
    }

    // 战斗日志导出（--verbose 模式：每局输出简版日志）
    if (VERBOSE) {
      var st = Zhan.Engine.state;
      if (st && st.logLines && st.logLines.length > 0) {
        process.stdout.write('\r播种 ' + seed + ' | 回合 ' + st.turn + ' | ' + (st.win ? '胜' : '负'));
        // 只输出前 5 条 + 最后 5 条，避免刷屏
        var logs = st.logLines;
        var out = [];
        for (var li = 0; li < logs.length && li < 5; li++) out.push(formatBattleLogLine(logs[li]));
        if (logs.length > 10) out.push('  ...（中间 ' + (logs.length - 10) + ' 条省略）');
        for (var li = Math.max(0, logs.length - 5); li < logs.length; li++) out.push(formatBattleLogLine(logs[li]));
        out.forEach(function(l) { process.stdout.write('\n' + l); });
        process.stdout.write('\n\n');
      }
    }

    // 进度条
    if ((seed - START_SEED + 1) % Math.max(1, Math.floor(TOTAL_GAMES / 20)) === 0) {
      var pct = Math.round((seed - START_SEED + 1) / TOTAL_GAMES * 100);
      process.stdout.write('\r进度: ' + pct + '% (' + (seed - START_SEED + 1) + '/' + TOTAL_GAMES + ') 失败: ' + failures.length);
    }

  } catch(e) {
    crashCount++;
    failures.push({ seed: seed, crash: true, message: e.message, stack: (e.stack || '').split('\n').slice(0, 3).join(' | ') });
  }
}

console.log('');
console.log('');
console.log('=== 结果 ===');
console.log('总模拟局数:   ' + TOTAL_GAMES);
console.log('成功完成:     ' + (TOTAL_GAMES - failures.length));
console.log('失败总数:     ' + failures.length);
console.log('  卡死(超步):  ' + stuckCount);
console.log('  崩溃(异常):  ' + crashCount);
console.log('  状态异常:     ' + (failures.length - stuckCount - crashCount));
console.log('');

// ---- 单行日志格式化（verbose 模式用） ----
function formatBattleLogLine(e) {
  if (!e) return '';
  if (typeof e === 'string') return '  ' + e;
  switch (e.type) {
    case 'turnHeader':    return '';
    case 'turnFooter':    return '  ' + ('—'.repeat(20));
    case 'separator':     return '';
    case 'action':
      var prefix = e.side === 'enemy' ? '◀ ' : '▶ ';
      return '  ' + prefix + e.text;
    case 'cardsRow':      return '  🃏 ' + (e.cards || []).join('');
    default:              return '  [' + (e.text || '[无]') + ']';
  }
}

// ---- 完整战斗日志格式化（失败详情用） ----
function formatBattleLog(entries) {
  if (!entries || !entries.length) return '  (无战斗日志)';
  var out = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (typeof e === 'string') { out.push('  ' + e); continue; }
    switch (e.type) {
      case 'turnHeader':    out.push(''); out.push('  ' + e.text); break;
      case 'turnFooter':    out.push('  ' + e.text); break;
      case 'separator':     out.push('  ' + e.text); break;
      case 'action':
        var prefix = e.side === 'enemy' ? '  ◀ ' : '  ▶ ';
        out.push(prefix + e.text);
        if (e.detail) out.push('       ' + e.detail);
        break;
      case 'cardsRow':
        out.push('  🃏 ' + (e.cards || []).join(''));
        break;
      case 'buffsRow':
        if (e.buffs && e.buffs.length) {
          var parts = [];
          for (var bi = 0; bi < e.buffs.length; bi++) {
            parts.push(e.buffs[bi].name + e.buffs[bi].value);
          }
          out.push('  📊 ' + parts.join('  '));
        }
        break;
      default: out.push('  [' + e.type + '] ' + (e.text || ''));
    }
  }
  return out.join('\n');
}

// 打印失败详情
var showCount = Math.min(20, failures.length);
var showCount = Math.min(20, failures.length);
if (showCount > 0) {
  console.log('--- 失败详情 (前' + showCount + '个) ---');
  for (var fi = 0; fi < showCount; fi++) {
    var f = failures[fi];
    console.log('#' + (fi + 1) + ' | seed=' + f.seed + ' | step=' + (f.step || 'N/A') +
      (f.phase ? ' | phase=' + f.phase : '') +
      (f.turn !== undefined ? ' | turn=' + f.turn : ''));
    if (f.crash) {
      console.log('     CRASH: ' + f.message);
      if (f.stack) console.log('     ' + f.stack);
    } else if (f.errors) {
      for (var ei = 0; ei < f.errors.length; ei++) {
        console.log('     ' + f.errors[ei]);
      }
    }
    // 战斗日志导出（仅 --logs 模式，且非 crash 且有 state）
    if (DUMP_LOGS && !f.crash && f.logLines) {
      console.log('');
      console.log(formatBattleLog(f.logLines));
    }
  }
  console.log('');
}

if (failures.length > 0) {
  console.log('⚠️  有失败用例。设置对应种子复现: node simulate.js 1 <种子号>');
  process.exit(1);
} else {
  console.log('✅ 全部通过！');
  process.exit(0);
}
