// ============================================================
//  斩 — 种子扫描器
//  用法: node seed_scanner.js <目标卡牌类型> [圣物列表] [boss]
//  扫描种子，找到 pile[0,0] 前 N 张是指定类型的种子
// ============================================================

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var targetType = process.argv[2] || 'atk_down';
var relics = (process.argv[3] || '').split(',').filter(Boolean);
var boss = process.argv[4] || 'tabby';
var maxSeed = parseInt(process.argv[5], 10) || 500;
var depth = parseInt(process.argv[6], 10) || 5;

function createSandbox() {
  return {
    window: {}, document: {}, navigator: { userAgent: 'node-scanner' },
    localStorage: { _store:{}, getItem:function(k){return this._store[k]||null}, setItem:function(k,v){this._store[k]=String(v)} },
    console: { log: function(){} }, setTimeout: function(fn){fn()}, clearTimeout: function(){}
  };
}

var sandbox = createSandbox();
vm.runInNewContext('var Zhan = {}; window.Zhan = Zhan;', sandbox);
vm.runInNewContext('function updateComboPreview() {}', sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'data.js'),'utf8'), sandbox, {filename:'data.js'});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'core.js'),'utf8'), sandbox, {filename:'core.js'});
var Zhan = sandbox.Zhan;
Zhan.UI = { render:function(){}, updateComboPreview:function(){}, showResult:function(){}, renderMainMenu:function(){}, _showView:function(){}, renderEnemyIntent:function(){}, renderRelicSelect:function(){}, renderStageSelect:function(){}, renderCatMaoShop:function(){}, renderAffinitySelect:function(){}, renderLog:function(){} };
sandbox.updateComboPreview = function(){};

console.log('扫描目标: ' + targetType + ' (pile[0,0] 前' + depth + '张)');
console.log('圣物: ' + (relics.length ? relics : '无') + ' | Boss: ' + boss);
console.log('种子范围: 0-' + (maxSeed-1));

var found = [];
for (var seed = 0; seed < maxSeed; seed++) {
  Zhan.Engine.state = null;
  Zhan.Engine._towerDefeated = {};
  Zhan.RNG.setSeed(seed);
  sandbox.newGame({ bossId: boss, activeRelics: relics, mode: sandbox.CONFIG.MODE_NORMAL });
  var st = Zhan.Engine.state;
  if (!st || !st.piles || !st.piles[0] || !st.piles[0][0]) { console.log('ERR: seed=' + seed + ' state null'); continue; }
  var pile = st.piles[0][0];
  var top = pile.slice(-depth).reverse();
  var types = top.map(function(c) { return c.type; });
  if (types.indexOf(targetType) >= 0) {
    var matchIdx = types.indexOf(targetType);
    found.push({ seed: seed, depth: matchIdx, types: types.slice(0, matchIdx+3) });
    console.log('  seed=' + seed + ' 第' + (matchIdx+1) + '张: ' + types.slice(0, matchIdx+3).join(','));
  }
}

console.log('');
console.log('找到 ' + found.length + ' 个种子 (' + targetType + ' 在 pile[0,0] 前' + depth + '张中)');
if (found.length) {
  var best = found[0];
  console.log('推荐: seed=' + best.seed + ' 类型序列=' + best.types.join(','));
}
