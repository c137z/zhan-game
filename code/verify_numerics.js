// ============================================================
//  斩 — 数值验证引擎
//  用法: node verify_numerics.js [场景名过滤] [--failed-only]
// ============================================================

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ---- 沙箱工厂 ----
function createSandbox() {
  return {
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
    setTimeout: function(fn, ms) { fn(); },
    clearTimeout: function() {},
    navigator: { userAgent: 'node-verify' }
  };
}

function initSandbox(sandbox) {
  // 注入 core.js 需要的全局变量
  vm.runInNewContext('var Zhan = {}; window.Zhan = Zhan;', sandbox);
  vm.runInNewContext('function updateComboPreview() {}', sandbox);
  // 加载 data.js
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8'),
    sandbox, { filename: 'data.js' }
  );
  // 加载 core.js
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8'),
    sandbox, { filename: 'core.js' }
  );
  // 挂 UI stub
  var Zhan = sandbox.Zhan || sandbox.window.Zhan;
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
  sandbox.updateComboPreview = function() {}; // global legacy wrapper
  return Zhan;
}

// ---- 状态 dump ----
function dumpState(st, step, sandbox, Zhan) {
  var pe = st.playerEffects || {};
  var ee = st.enemyEffects || {};
  var lines = [];
  lines.push('Step ' + step + ' | phase=' + st.phase + ' turn=' + st.turn +
    ' | 玩家 ' + st.playerHP + '/' + st.playerMaxHP + ' 🛡' + st.playerShield +
    ' | 敌人 ' + st.enemyHP + '/' + st.enemyMaxHP + ' 🛡' + st.enemyShield + ' ⚡' + st.power);
  // Buffs/Debuffs
  var parts = [];
  if (ee.vulnerable > 0) parts.push('破甲×' + parseFloat((st.effectiveVulnMult || 0).toFixed(1)) + 'T' + ee.vulnerable);
  if (ee.stun > 0) parts.push('眩晕T' + ee.stun);
  if (ee.atk_down > 0) parts.push('虚弱↓' + Math.round(ee.atk_down_pct || 30) + '%T' + ee.atk_down);
  if (pe.atk_buff > 0) parts.push('暴击×' + parseFloat((st.effectiveAtkBuffMult || 0).toFixed(1)) + 'T' + pe.atk_buff);
  if (pe.def_buff > 0) parts.push('减伤×' + parseFloat((st.defBuffRatio || 0.7).toFixed(1)) + 'T' + pe.def_buff);
  if (st.furyEnabled && Zhan) parts.push('fury×' + parseFloat(Zhan.Systems.Relic.getFuryMultiplier(st).toFixed(2)));
  if (parts.length) lines.push('  buff/debuff: ' + parts.join(' | '));
  // Slot
  if (st.slot && st.slot.length) {
    var CT = (sandbox && sandbox.CARD_TYPES) || {};
    var slotDesc = st.slot.map(function(c) {
      if (!c) return '⛔';
      if (c.special) return c.special.emoji;
      return (CT[c.type] || {emoji:'?'}).emoji;
    }).join('');
    lines.push('  slot(' + st.slot.length + '/' + (st.effectiveSlotSize || 10) + '): [' + slotDesc + ']');
  }
  return lines.join('\n');
}

// ---- 断言检查 ----
function checkRule(rule, stateHistory, step) {
  var targetStep = rule.step !== undefined ? rule.step : stateHistory.length - 1;
  // 只在指定步骤检查
  if (step !== targetStep) return null;

  var val = getFieldValue(stateHistory[step], rule.field);
  var result = { rule: rule.id, step: step, val: val, ok: true };

  switch (rule.mode) {
    case 'bounded_by':
      result.ok = val <= rule.max;
      result.detail = 'max=' + rule.max + ' got=' + val;
      break;
    case 'not_growing':
      // 从 step 0 到 targetStep，值不能一直增长
      var initial = getFieldValue(stateHistory[0], rule.field);
      for (var s = 1; s <= targetStep; s++) {
        var v = getFieldValue(stateHistory[s], rule.field);
        if (v > rule.max) { result.ok = false; result.detail = 'at step ' + s + ' exceeded max=' + rule.max + ' got=' + v; break; }
      }
      if (result.ok) result.detail = 'max=' + rule.max + ' ok';
      break;
    case 'invariant':
      var base = getFieldValue(stateHistory[0], rule.field);
      for (var s = 1; s <= targetStep; s++) {
        if (getFieldValue(stateHistory[s], rule.field) !== base) {
          result.ok = false; result.detail = 'changed at step ' + s + ': ' + base + ' -> ' + getFieldValue(stateHistory[s], rule.field); break;
        }
      }
      if (result.ok) result.detail = 'value=' + base + ' invariant';
      break;
    case 'monotonic':
      var prev = getFieldValue(stateHistory[0], rule.field);
      for (var s = 1; s <= targetStep; s++) {
        var cur = getFieldValue(stateHistory[s], rule.field);
        if (cur < prev) { result.ok = false; result.detail = 'decreased at step ' + s + ': ' + prev + ' -> ' + cur; break; }
        prev = cur;
      }
      if (result.ok) result.detail = 'monotonic ok';
      break;
  }
  return result;
}

function checkValue(vrule, stateHistory, step, sandbox) {
  var targetStep = vrule.step !== undefined ? vrule.step : stateHistory.length - 1;
  if (step !== targetStep) return null;

  var val = getFieldValue(stateHistory[step], vrule.field);
  var ok = Math.abs(val - vrule.expect) <= (vrule.tolerance || 0);
  var designMatch = vrule.design_version === ((sandbox && sandbox.CONFIG && sandbox.CONFIG.GAME_VERSION) || '');
  return {
    rule: vrule.id,
    step: step,
    val: val,
    expect: vrule.expect,
    tolerance: vrule.tolerance,
    ok: ok,
    designMatch: designMatch,
    detail: 'expect=' + vrule.expect + '±' + vrule.tolerance + ' got=' + val + (designMatch ? '' : ' [版本不匹配:' + vrule.design_version + ']')
  };
}

function getFieldValue(obj, fieldPath) {
  var parts = fieldPath.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

// ---- 场景执行 ----
function runScenario(scenarioPath) {
  var sc = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  var sandbox = createSandbox();
  var Zhan = initSandbox(sandbox);
  var CONFIG = sandbox.CONFIG;

  // 版本自动填充
  if (!sc.version) sc.version = CONFIG.GAME_VERSION;

  // 初始化
  Zhan.Engine.state = null;
  Zhan.Engine._towerDefeated = {};
  Zhan.RNG.setSeed(sc.seed);
  // 直接用 newGame（全局函数）传参，绕过 Zhan.Engine.init 的无参限制
  sandbox.newGame({ bossId: sc.boss, activeRelics: sc.relics || [], mode: sandbox.CONFIG.MODE_NORMAL });
  var st = Zhan.Engine.state;
  if (!st) throw new Error('newGame returned null');

  // 应用 setup
  if (sc.setup) {
    for (var key in sc.setup) {
      if (sc.setup.hasOwnProperty(key)) st[key] = sc.setup[key];
    }
  }

  // 执行
  var history = [JSON.parse(JSON.stringify(st))];
  var step = 0;
  var lines = [dumpState(st, step, sandbox, Zhan)];

  var actions = sc.actions || [];
  for (var ai = 0; ai < actions.length; ai++) {
    var action = actions[ai];
    Zhan.Engine.dispatch(action);
    st = Zhan.Engine.state;
    if (!st) { lines.push('  ⚠️ state is null after action ' + ai); break; }
    step++;
    history.push(JSON.parse(JSON.stringify(st)));
    lines.push(dumpState(st, step, sandbox, Zhan));
    if (st.over) { lines.push('  ▶ 游戏结束, win=' + st.win); break; }
  }

  // 检查断言
  var ruleResults = [];
  var valueResults = [];
  for (var s = 0; s < history.length; s++) {
    (sc.rules || []).forEach(function(r) {
      var result = checkRule(r, history, s);
      if (result) ruleResults.push(result);
    });
    (sc.values || []).forEach(function(v) {
      var result = checkValue(v, history, s, sandbox);
      if (result) valueResults.push(result);
    });
  }

  return {
    scenario: sc,
    lines: lines,
    ruleResults: ruleResults,
    valueResults: valueResults
  };
}

// ---- 报告输出 ----
function printReport(results) {
  var total = results.length;
  var pass = 0, fail = 0;
  var totalRules = 0, failedRules = 0;
  var totalValues = 0, failedValues = 0, skippedValues = 0;

  results.forEach(function(r) {
    var ruleFail = r.ruleResults.filter(function(rr) { return !rr.ok; }).length;
    var valueFail = r.valueResults.filter(function(vr) { return !vr.ok && vr.designMatch; }).length;
    var valueSkip = r.valueResults.filter(function(vr) { return !vr.designMatch; }).length;
    var hasFailure = ruleFail > 0 || valueFail > 0;
    if (hasFailure) fail++; else pass++;
    totalRules += r.ruleResults.length;
    failedRules += ruleFail;
    totalValues += r.valueResults.length;
    failedValues += valueFail;
    skippedValues += valueSkip;
  });

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  总计: ' + total + ' 场景');
  console.log('  通过: ' + pass + ' | 失败: ' + fail);
  console.log('  规则断言: ' + totalRules + ' 条, 失败 ' + failedRules);
  console.log('  数值断言: ' + totalValues + ' 条, 失败 ' + failedValues + ', 版本跳过 ' + skippedValues);
  console.log('═══════════════════════════════════════');

  if (fail > 0) {
    console.log('');
    console.log('失败场景:');
    results.filter(function(r) {
      return r.ruleResults.some(function(rr) { return !rr.ok; }) ||
             r.valueResults.some(function(vr) { return !vr.ok && vr.designMatch; });
    }).forEach(function(r) {
      console.log('  🔴 ' + r.scenario.name + ' (' + path.basename(r.scenario._path) + ')');
    });
  }
}

function printScenarioReport(result) {
  var sc = result.scenario;
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('场景: ' + sc.name);
  if (sc.desc) console.log('描述: ' + sc.desc);
  console.log('种子: ' + sc.seed + ' | Boss: ' + sc.boss + ' | 圣物: ' + (sc.relics || []).join(','));
  console.log('版本: ' + sc.version);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log(result.lines.join('\n'));
  console.log('');

  // 断言结果
  if (result.ruleResults.length || result.valueResults.length) {
    console.log('--- 断言 ---');
    result.ruleResults.forEach(function(rr) {
      var icon = rr.ok ? '✅' : '🔴';
      console.log('  ' + icon + ' [RULE] ' + rr.rule + ' @step' + rr.step + ': ' + rr.detail);
    });
    result.valueResults.forEach(function(vr) {
      if (!vr.designMatch) {
        console.log('  ⏭️ [VALUE] ' + vr.rule + ' @step' + vr.step + ': 版本跳过');
      } else {
        var icon = vr.ok ? '✅' : '🔴';
        console.log('  ' + icon + ' [VALUE] ' + vr.rule + ' @step' + vr.step + ': ' + vr.detail);
      }
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════');
}

// ---- 主入口 ----
var args = process.argv.slice(2);
var filter = null;
var failedOnly = false;
for (var i = 0; i < args.length; i++) {
  if (args[i] === '--failed-only') failedOnly = true;
  else filter = args[i];
}

var scenariosDir = path.join(__dirname, '..', 'tests', 'scenarios');

function collectScenarios(dir) {
  var files = [];
  if (!fs.existsSync(dir)) return files;
  var entries = fs.readdirSync(dir);
  entries.forEach(function(entry) {
    var fullPath = path.join(dir, entry);
    var stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(collectScenarios(fullPath));
    } else if (entry.endsWith('.json')) {
      files.push(fullPath);
    }
  });
  return files;
}

var allFiles = collectScenarios(scenariosDir);

if (allFiles.length === 0) {
  console.log('没有找到场景文件。请将场景放入 tests/scenarios/ 目录。');
  console.log('目录: ' + scenariosDir);
  process.exit(0);
}

// 过滤
var filesToRun = allFiles;
if (filter) {
  filesToRun = allFiles.filter(function(f) { return f.indexOf(filter) >= 0; });
  console.log('过滤: "' + filter + '" → ' + filesToRun.length + '/' + allFiles.length + ' 个场景');
}

if (filesToRun.length === 0) {
  console.log('没有匹配的场景。');
  process.exit(0);
}

var results = [];
filesToRun.forEach(function(file) {
  try {
    var result = runScenario(file);
    result.scenario._path = file;
    results.push(result);
    printScenarioReport(result);
  } catch(e) {
    console.log('');
    console.log('🔴 执行异常: ' + file);
    console.log('   ' + e.message);
    if (e.stack) {
      var stackLines = e.stack.split('\n').slice(0, 5);
      stackLines.forEach(function(l) { console.log('   ' + l.trim()); });
    }
    results.push({
      scenario: { name: 'CRASH', _path: file },
      lines: ['ERROR: ' + e.message],
      ruleResults: [],
      valueResults: []
    });
  }
});

printReport(results);

// 退出码
var hasFailure = results.some(function(r) {
  return r.ruleResults.some(function(rr) { return !rr.ok; }) ||
         r.valueResults.some(function(vr) { return !vr.ok && vr.designMatch; });
});
process.exit(hasFailure ? 1 : 0);
