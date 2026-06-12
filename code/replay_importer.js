// ============================================================
//  斩 — 回放导入器: 回放/bug报告 → 验证场景文件
//  用法: node replay_importer.js <回放文件> [输出场景名]
// ============================================================

var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);
if (args.length < 1) {
  console.log('用法: node replay_importer.js <回放文件.json> [输出场景名]');
  console.log('  回放文件格式: { seed, boss, relics?, setup?, actions[], playerNote? }');
  console.log('  输出到 tests/scenarios/bug_reports/');
  process.exit(1);
}

var inputFile = args[0];
var outputName = args[1];

var data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 基本校验
if (!data.seed && data.seed !== 0) { console.error('回放文件缺少 seed 字段'); process.exit(1); }
if (!data.boss) { console.error('回放文件缺少 boss 字段'); process.exit(1); }
if (!data.actions || !data.actions.length) { console.error('回放文件缺少 actions 数组'); process.exit(1); }

// 场景名
var scenarioName = outputName ||
  'bug_' + (data.boss || 'unknown') + '_' + new Date().toISOString().split('T')[0].replace(/-/g, '');

var scenario = {
  name: scenarioName,
  desc: data.playerNote || '从回放导入: ' + path.basename(inputFile),
  seed: data.seed,
  boss: data.boss,
  relics: data.relics || [],
  setup: data.setup || {},
  actions: data.actions,
  rules: data.rules || [],
  values: data.values || []
};

// 输出
var outDir = path.join(__dirname, '..', 'tests', 'scenarios', 'bug_reports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

var outPath = path.join(outDir, scenarioName + '.json');
fs.writeFileSync(outPath, JSON.stringify(scenario, null, 2), 'utf8');

console.log('✅ 场景已生成: ' + outPath);
console.log('   种子: ' + scenario.seed);
console.log('   Boss: ' + scenario.boss);
console.log('   圣物: ' + (scenario.relics.length ? scenario.relics.join(',') : '无'));
console.log('   操作: ' + scenario.actions.length + ' 步');
