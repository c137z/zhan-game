# -*- coding: utf-8 -*-
"""
Refactor zhan_standalone_design_in.html per UI design spec v1.
Output: zhan_standalone.html (overwrite)
"""

import re

with open('zhan_standalone_design_in.html', 'r', encoding='utf-8') as f:
    text = f.read()

# ---- 1. Find boundaries ----
style1_start = text.find('<style>')
style1_end = text.find('</style>', style1_start) + 8
style2_start = text.find('<style>', style1_end)
style2_end = text.find('</style>', style2_start) + 8

body_start = text.find('<body>')
script_start = text.find('<script>', body_start)

# ---- 2. Extract parts ----
css1_raw = text[style1_start:style1_end]
css2_raw = text[style2_start:style2_end]
body_html = text[body_start:script_start]
scripts = text[script_start:]

# ============================================================
# 3. BUILD NEW CSS
# ============================================================

# We keep the card color definitions from css1_raw (they're massive inline), 
# but REPLACE the layout CSS that comes before them.
# The card color section starts after "/* card colors */" pattern.

# Find the card colors start in css1_raw. We'll replace everything BEFORE that.
card_colors_marker = '/* card colors */'
# There are two lines of /* card colors */
# Find the second occurrence
idx1 = css1_raw.find(card_colors_marker)
idx2 = css1_raw.find(card_colors_marker, idx1 + 1)

# Everything before idx2 is layout CSS we replace.
# Everything from idx2 onward is card colors CSS we keep.
card_colors_css = css1_raw[idx2:]

new_css = '''<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
body {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  background: #1a1a2e; color: #eee;
  min-height: 100dvh; display: flex; justify-content: center; align-items: flex-start;
  touch-action: manipulation; user-select: none; -webkit-user-select: none; overflow-x: hidden;
}
#app { width: 100%; max-width: 520px; padding: 4px 6px; display: flex; flex-direction: column; gap: 3px; position: relative; }

/* ========== SPIRIT BOMB (left 5%) ========== */
#spirit-bar-wrap {
  position: fixed;
  left: 0; top: 0;
  width: 5vw;
  max-width: 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(22,33,62,0.85);
  border-radius: 0 8px 8px 0;
  padding: 6px 2px;
  gap: 3px;
  z-index: 100;
  height: calc(30vh - 8px);
  min-height: 160px;
}
#spirit-bar-outer {
  flex: 1;
  width: 8px;
  min-height: 40px;
  background: #0f3460;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
#spirit-bar-inner {
  position: absolute;
  bottom: 0; left: 0;
  width: 100%;
  height: 0%;
  background: linear-gradient(to top, #e67e22, #f1c40f, #f39c12);
  border-radius: 4px;
  transition: height 0.3s;
}
#spirit-text { font-size: 8px; color: #f39c12; text-align: center; }
#spirit-bar-wrap .spirit-label { white-space: nowrap; writing-mode: vertical-rl; text-orientation: mixed; font-size: 9px; }

/* ========== CAT BOSS PORTRAIT BG ========== */
#boss-portrait-bg {
  position: absolute;
  right: 0; top: 0;
  width: 70%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 200px;
  opacity: 0.25;
  overflow: hidden;
  color: #f1c40f;
}

/* ensure battle content is above portrait */
#top-row, #slot-bar, #removed-bar, #board, #actions {
  position: relative;
  z-index: 1;
}

/* ========== DAMAGE POPUP ========== */
#damage-popup-container {
  position: absolute;
  top: 5%;
  left: 50%;
  width: 45%;
  height: 50%;
  pointer-events: none;
  z-index: 100;
  overflow: visible;
}
.damage-popup {
  position: absolute;
  font-weight: bold;
  font-family: -apple-system, 'Segoe UI', sans-serif;
  text-shadow: 0 0 6px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.5);
  white-space: nowrap;
  animation: dmg-float-up 1.2s ease-out forwards;
  pointer-events: none;
}
@keyframes dmg-float-up {
  0%   { opacity: 1; transform: translateY(0) scale(0.6); }
  25%  { opacity: 1; transform: translateY(-20px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-100px) scale(1.2); }
}

/* ========== BATTLE VIEW POSITIONING ========== */
#battle-view { position: relative; }

/* ========== TOP ROW - 战斗展示区 (28~32% screen) ========== */
#top-row { height: 30vh; min-height: 180px; display: flex; gap: 8px; align-items: stretch; padding: 4px; }
#top-row > .player-box,
#top-row > .enemy-box { 
  flex: 1; height: 100%; background: #16213e; border-radius: 10px; padding: 6px 5px 4px; 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
}

/* 玩家角色放大 1.8x */
.player-box .avatar { font-size: 77px; line-height: 1.1; }  /* 43 * 1.8 ≈ 77 */
.enemy-box .enemy-avatar { font-size: 120px; }  /* 60 * 2.0 = 120 */

.entity-name { font-size: 9px; color: #888; letter-spacing: 1px; }
.stat-row { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; font-size: 10px; width: 100%; }
.stat-row .stat-item { display: flex; align-items: center; gap: 1px; background: #0f3460; padding: 0 5px; border-radius: 4px; line-height: 1.5; }
.stat-row .stat-item .val { font-weight: bold; }
.stat-hp .val { color: #e74c3c; }
.stat-shield .val { color: #3498db; }
.stat-power .val { color: #9b59b6; }

.player-box { border-top: 3px solid #3498db; }
.enemy-box { border-top: 3px solid #e74c3c; }

/* VS separator */
.vs-separator { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 32px; font-size: 14px; font-weight: bold; color: #f1c40f; background: #16213e; border-radius: 50%; align-self: center; padding: 6px 0; }

.character-avatar-wrap { display: flex; justify-content: center; align-items: center; padding: 2px 0; }

/* 角色信息区放在角色脚下 */
.character-info { 
  display: flex; flex-direction: column; align-items: center; width: 100%; gap: 1px;
  margin-top: auto; 
}

/* ========== BADGES ========== */
.badge-row { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; margin-top: 1px; }
.badge { font-size: 8px; padding: 0 4px; border-radius: 3px; line-height: 1.5; font-weight: bold; }
.badge-stun { background: #6c3483; color: #d7bde2; }
.badge-vuln { background: #7b241c; color: #f5b7b1; }
.badge-atk-down { background: #4a235a; color: #d2b4de; }
.badge-atk-up { background: #6e2c00; color: #f0b27a; }
.badge-def-up { background: #0b5345; color: #a3e4d7; }

/* ========== ENEMY INTENT ========== */
#enemy-intent { font-size: 10px; margin-top: 1px; color: #aaa; }

/* ========== DECK INFO (hidden, moved into slot-bar area via settings gear) ========== */
#deck-info { display: flex; justify-content: center; gap: 6px; font-size: 10px; color: #888; padding: 1px 0; }
#deck-info span { background: #0f3460; padding: 1px 6px; border-radius: 4px; }

/* ========== SLOT BAR - 消除槽 ========== */
#slot-bar {
  display: flex; gap: 2px; padding: 2px 4px; background: #16213e; border-radius: 8px; 
  justify-content: center; align-items: center;
  min-height: 36px; flex-wrap: wrap; position: relative;
}

/* 设置按钮移到消除槽右上方 */
#btn-settings {
  position: absolute;
  right: 2px; top: 2px;
  width: 24px; height: 24px;
  border: none; border-radius: 4px;
  background: #0f3460; color: #eee;
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 5;
}

.eslot {
  width: 30px; height: 30px;
  background: #0f3460; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; position: relative;
  border: 1px solid #2c3e50;
}
.eslot.filled { border-color: #e67e22; }
.eslot.locked { opacity: 0.4; border-color: #555; }
.eslot.special { background: #fff; color: #333; border-color: #f1c40f; }
.eslot.wild-core { background: #6c3483; color: #f1c40f; border-color: #f1c40f; }
.wild-core-label { position: absolute; bottom: -1px; left: 50%; transform: translateX(-50%); font-size: 6px; color: #f1c40f; white-space: nowrap; }

/* slot colors (matches CARD_TYPES) */
.eslot.attack { background: linear-gradient(135deg, #8b0000, #a52a2a); }
.eslot.defend { background: linear-gradient(135deg, #1a5276, #2980b9); }
.eslot.heal { background: linear-gradient(135deg, #145a32, #27ae60); }
.eslot.wild { background: linear-gradient(135deg, #4a235a, #8e44ad); }
.eslot.atk_down { background: linear-gradient(135deg, #4a235a, #d2b4de); }
.eslot.vulnerable { background: linear-gradient(135deg, #641e16, #f5b7b1); }
.eslot.stun { background: linear-gradient(135deg, #4a235a, #d7bde2); }
.eslot.atk_buff { background: linear-gradient(135deg, #6e2c00, #f0b27a); }
.eslot.def_buff { background: linear-gradient(135deg, #0b5345, #a3e4d7); }
.eslot.junk { background: linear-gradient(135deg, #2c3e50, #566573); }

/* ========== COMBO BAR - 连击信息 ========== */
#combo-bar {
  display: flex; gap: 3px; flex-wrap: wrap; justify-content: center;
  padding: 2px 4px; min-height: 20px; font-size: 10px;
}
#combo-bar .combo-preview { 
  background: #0f3460; border-radius: 4px; padding: 1px 4px; 
  white-space: nowrap; font-weight: bold; 
}
#combo-bar .combo-preview.attack { color: #e74c3c; }
#combo-bar .combo-preview.defend { color: #3498db; }
#combo-bar .combo-preview.heal { color: #27ae60; }
#combo-bar .combo-preview.stun { color: #d7bde2; }
#combo-bar .combo-preview.vulnerable { color: #f5b7b1; }
#combo-bar .combo-preview.atk_down { color: #d2b4de; }
#combo-bar .combo-preview.atk_buff { color: #f0b27a; }
#combo-bar .combo-preview.def_buff { color: #a3e4d7; }
#combo-bar .combo-none { color: #555; }

/* ========== REMOVED BAR - 移除区 ========== */
#removed-bar {
  display: flex; gap: 2px; padding: 2px 4px; justify-content: center; align-items: center;
  min-height: 34px; background: #16213e; border-radius: 8px; flex-wrap: wrap;
}
.rslot {
  width: 30px; height: 30px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; background: #0f3460;
  border: 1px dashed #444;
}
.rslot.removed { opacity: 0.6; border-style: solid; border-color: #666; }

/* ========== BOARD - 卡池 (5x5 unchanged) ========== */
#board { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; background: #16213e; border-radius: 10px; padding: 4px; touch-action: none; }
.card-slot { background: #0f3460; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; transition: transform 0.06s; aspect-ratio: 1 / 1; }
.card-slot:active { transform: scale(0.93); }
.card-slot .card { width: 100%; height: 100%; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; gap: 0; transition: opacity 0.15s; pointer-events: none; position: relative; }
.card-slot .card .card-icon { font-size: 18px; line-height: 1; }
.card-slot .card .card-label { font-size: 7px; opacity: 1; letter-spacing: 0; pointer-events: none; line-height: 1; background: rgba(255,255,255,0.85); color: #000; padding: 0 2px; border-radius: 2px; }
.card-slot .card .card-count { position: absolute; top: 1px; left: 2px; font-size: 10px; color: #000; font-weight: 900; opacity: 1; background: rgba(255,255,255,0.85); padding: 0 3px; border-radius: 3px; line-height: 1.3; }
.card-empty { background: transparent; border: 1px dashed #2c3e50; cursor: default; }
.card-empty .card { display: none; }
.card-slot .stack-count { position: absolute; top: 2px; left: 3px; font-size: 10px; color: #111; font-weight: 900; opacity: 1; background: rgba(255,255,255,0.85); padding: 0 4px; border-radius: 3px; line-height: 1.3; }
.card-slot.locked { opacity: 0.4; cursor: not-allowed; }
.card-slot.smeared { filter: blur(4px); }
.card-slot.double-tap-active { outline: 2px solid #f1c40f; transform: translateY(-2px); z-index: 10; }

/* ========== ACTIONS BAR - 操作按钮区 (sticky bottom) ========== */
#actions {
  position: sticky; bottom: 0;
  display: flex; gap: 6px; 
  height: 10vh; min-height: 48px; max-height: 60px;
  padding: 4px 6px; 
  align-items: center; justify-content: center;
  background: rgba(22,33,62,0.95);
  border-top: 1px solid #0f3460;
  z-index: 10;
}
#actions button {
  border: none; border-radius: 8px; cursor: pointer;
  font-weight: bold; font-size: 11px; 
  transition: opacity 0.15s; touch-action: manipulation;
  display: flex; align-items: center; justify-content: center;
}
#actions button:active { opacity: 0.7; }
#actions button:disabled { opacity: 0.35; cursor: not-allowed; }

/* 移出卡牌 - 左侧, 约结束回合按钮60% */
#btn-remove-card {
  height: 80%; aspect-ratio: 1.2 / 1;
  background: #2c3e50; color: #e74c3c;
  font-size: 10px;
}

/* 结束回合 - 居中, 最醒目(金色50%宽) */
#btn-end-turn {
  height: 80%; width: 50%;
  background: linear-gradient(135deg, #f1c40f, #e67e22);
  color: #1a1a2e; font-size: 14px; letter-spacing: 2px;
  box-shadow: 0 0 12px rgba(241, 196, 15, 0.5);
}
#btn-end-turn:disabled {
  background: #555; color: #888; box-shadow: none;
}

/* 洗牌 - 右侧, 与移出卡牌一致 */
#btn-shuffle {
  height: 80%; aspect-ratio: 1.2 / 1;
  background: #2c3e50; color: #3498db;
  font-size: 10px;
}

/* ========== SETTINGS PANEL ========== */
#settings-panel { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; align-items: center; justify-content: center; }
#settings-box { background: #16213e; border-radius: 12px; padding: 20px; width: 280px; display: flex; flex-direction: column; gap: 10px; }
#settings-box h3 { text-align: center; color: #f1c40f; }
.setting-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.setting-slider { width: 120px; }
.toggle { width: 40px; height: 22px; border-radius: 11px; background: #555; position: relative; cursor: pointer; transition: background 0.2s; }
.toggle.on { background: #27ae60; }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
.toggle.on::after { transform: translateX(18px); }
#btn-back-to-home { padding: 6px; border: none; border-radius: 6px; background: #e67e22; color: #fff; font-size: 12px; cursor: pointer; }

/* ========== MAIN MENU ========== */
#main-menu { display: none; flex-direction: column; gap: 6px; padding: 10px; }
#menu-title { font-size: 36px; text-align: center; color: #f1c40f; letter-spacing: 8px; }
.menu-divider { border: 0; height: 1px; background: #333; margin: 4px 0; }
.menu-btn { display: flex; align-items: center; gap: 8px; background: #16213e; padding: 10px; border-radius: 10px; cursor: pointer; }
.menu-btn-icon { font-size: 28px; }
.menu-btn-text { display: flex; flex-direction: column; }
.menu-btn-title { font-size: 14px; font-weight: bold; }
.menu-btn-sub { font-size: 10px; color: #888; }
#menu-best, #menu-catmao { font-size: 12px; color: #aaa; text-align: center; }
#menu-icons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.menu-icon { background: #16213e; border-radius: 8px; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 10px; }
.menu-icon-emoji { display: block; font-size: 18px; margin-bottom: 2px; }

/* ========== STAGE SELECT ========== */
#stage-select { display: none; flex-direction: column; gap: 4px; }
#stage-select-header { display: flex; align-items: center; gap: 4px; }
#btn-back-menu { border: none; background: #0f3460; color: #eee; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
#stage-select-title { font-size: 13px; }
#stage-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.stage-btn { padding: 8px 4px; border: none; border-radius: 6px; background: #16213e; color: #eee; cursor: pointer; font-size: 11px; text-align: center; }
.stage-btn.completed { border: 1px solid #27ae60; }
.stage-btn.current { border: 2px solid #f1c40f; }

/* ========== RESULT OVERLAY ========== */
#result-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; align-items: center; justify-content: center; }
#result-box { background: #16213e; border-radius: 12px; padding: 16px 20px; max-width: 300px; text-align: center; display: flex; flex-direction: column; gap: 6px; }
#result-title { font-size: 20px; color: #f1c40f; }
#result-desc { font-size: 12px; color: #aaa; }
#result-box button { padding: 6px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; background: #e67e22; color: #fff; }

/* ========== RELIC SELECT ========== */
#relic-select-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: none; align-items: center; justify-content: center; }
#relic-select-box { background: #16213e; border-radius: 12px; padding: 16px 20px; max-width: 320px; text-align: center; }
#relic-select-box h2 { color: #f1c40f; font-size: 18px; }
#relic-select-desc { font-size: 11px; color: #aaa; }
#relic-select-options { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; }
.relic-option { background: #0f3460; border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 11px; text-align: left; }
.relic-option.selected { border: 2px solid #f1c40f; }

/* ========== RESPONSIVE ========== */
@media (max-width: 480px) {
  #app { max-width: 100%; padding: 2px 4px; }
  #spirit-bar-wrap { width: 4vw; min-width: 18px; }
  #btn-end-turn { font-size: 12px; }
}
'''  # no card colors here - they are appended below

# Now combine: new_css + card_colors_css
new_css_full = new_css.rstrip() + '\n' + card_colors_css

# ============================================================
# 4. BUILD NEW HTML BODY
# ============================================================

new_body = '''<body>
<div id="app">
  <!-- 设置面板 -->
  <div id="settings-panel">
    <div id="settings-box">
      <h3>⚙️ 设置</h3>
      <div class="setting-row">
        <span class="setting-label">🎵 音乐</span>
        <input type="range" class="setting-slider" id="slider-music" min="0" max="100" value="80">
      </div>
      <div class="setting-row">
        <span class="setting-label">🔊 音效</span>
        <input type="range" class="setting-slider" id="slider-sfx" min="0" max="100" value="80">
      </div>
      <div class="setting-row">
        <span class="setting-label">📳 震动</span>
        <div class="toggle on" id="toggle-vibrate"></div>
      </div>
      <button id="btn-back-to-home">🏠 返回主页</button>
    </div>
  </div>
  <!-- 首屏首页 -->
  <div id="main-menu">
    <div id="menu-title">斩</div>
    <hr class="menu-divider">
    <div id="menu-best">今日最佳：0层</div>
    <div id="btn-adventure" class="menu-btn">
      <span class="menu-btn-icon">⚔️</span>
      <span class="menu-btn-text">
        <div class="menu-btn-title">猫咪冒险</div>
        <div class="menu-btn-sub">25关挑战之旅</div>
      </span>
    </div>
    <div id="btn-maze" class="menu-btn">
      <span class="menu-btn-icon">🧶</span>
      <span class="menu-btn-text">
        <div class="menu-btn-title">猫猫迷宫</div>
        <div class="menu-btn-sub">毛线团→圣物→随机猫Boss</div>
      </span>
    </div>
    <div id="btn-tower" class="menu-btn">
      <span class="menu-btn-icon">👑</span>
      <span class="menu-btn-text">
        <div class="menu-btn-title">猫王塔</div>
        <div class="menu-btn-sub">层层挑战，争夺猫王称号</div>
      </span>
    </div>
    <hr class="menu-divider">
    <div id="menu-catmao">🐱 猫毛：0</div>
    <hr class="menu-divider">
    <div id="menu-icons">
      <div class="menu-icon"><span class="menu-icon-emoji">📋</span>每日悬赏</div>
      <div class="menu-icon"><span class="menu-icon-emoji">📖</span>图鉴</div>
      <div class="menu-icon"><span class="menu-icon-emoji">🏆</span>成就</div>
      <div class="menu-icon"><span class="menu-icon-emoji">👥</span>好友排行</div>
      <div class="menu-icon"><span class="menu-icon-emoji">🗺️</span>猫王地图</div>
      <div class="menu-icon"><span class="menu-icon-emoji">⚙️</span>设置</div>
    </div>
  </div>
  <!-- 关卡选择 -->
  <div id="stage-select">
    <div id="stage-select-header">
      <button id="btn-back-menu">‹ 返回</button>
      <span id="stage-select-title">猫咪冒险·选择关卡</span>
    </div>
    <div id="stage-grid"></div>
  </div>
  <!-- 战斗主界面 -->
  <div id="battle-view">
  <div id="boss-portrait-bg" style="display:none;"></div>
  
  <!-- 第1层：战斗展示区 30% -->
  <div id="top-row">
    <div class="player-box">
      <div class="character-avatar-wrap"><div class="avatar" id="player-avatar">🦸</div></div>
      <div class="character-info">
        <div class="entity-name">勇 者</div>
        <div class="stat-row">
          <span class="stat-item stat-hp"><span>❤️</span><span class="val" id="player-hp">100</span></span>
          <span class="stat-item stat-shield"><span>🛡️</span><span class="val" id="player-shield">0</span></span>
        </div>
        <div class="badge-row" id="player-badges"></div>
      </div>
    </div>
    <div class="vs-separator"><span>VS</span></div>
    <div class="enemy-box">
      <div class="character-avatar-wrap"><div class="avatar enemy-avatar" id="enemy-avatar">🧶</div></div>
      <div class="character-info">
        <div class="entity-name" id="enemy-name">骷 髅</div>
        <div class="stat-row">
          <span class="stat-item stat-hp"><span>❤️</span><span class="val" id="enemy-hp">100</span></span>
          <span class="stat-item stat-shield"><span>🛡️</span><span class="val" id="enemy-shield">0</span></span>
          <span class="stat-item stat-power"><span>⚡</span><span class="val" id="enemy-power">0</span></span>
        </div>
        <div class="badge-row" id="enemy-badges"></div>
        <div id="enemy-intent">⚔️ 准备攻击</div>
      </div>
    </div>
  </div>
  <div id="damage-popup-container"></div>
  
  <!-- 元气弹 - 屏幕最左侧竖向进度条 -->
  <div id="spirit-bar-wrap">
    <span class="spirit-label">💥 元气弹</span>
    <div id="spirit-bar-outer"><div id="spirit-bar-inner"></div></div>
    <span id="spirit-text">0%</span>
  </div>
  
  <!-- 第3层：消除槽区（deck-info 合并到 slot-bar 上方） -->
  <div id="deck-info">
    <span>🃏 <span id="deck-remain">250</span> 张</span>
    <span>🔒 <span id="hidden-cards">0</span> 暗牌</span>
    <span>🔍 <span id="visible-cards">0</span> 可见</span>
  </div>
  <div id="slot-bar"><button id="btn-settings" title="设置">⚙️</button></div>
  
  <!-- 连击信息 -->
  <div id="combo-bar"></div>
  
  <!-- 第4层：移除区 -->
  <div id="removed-bar"></div>
  
  <!-- 第5层：卡池区 5x5 -->
  <div id="board"></div>
  
  <!-- 第6层：操作按钮区（sticky bottom） -->
  <div id="actions">
    <button id="btn-remove-card" disabled>🗑️移出 <small id="remove-ad-count" style="color:#f39c12;font-size:8px;">(0/1)</small></button>
    <button id="btn-end-turn" disabled>⚔️ 结束回合</button>
    <button id="btn-shuffle">🔀洗牌 <small id="shuffle-ad-count" style="color:#f39c12;font-size:8px;">(3)</small></button>
  </div>
  </div>
  <!-- end battle-view -->
</div>
<!-- end app -->

<div id="result-overlay">
  <div id="result-box">
    <h2 id="result-title">⚔️</h2>
    <p id="result-desc"></p>
    <div id="stats-panel"></div>
    <div id="result-buttons" style="display:flex;flex-direction:column;gap:6px;align-items:center;">
      <button id="btn-restart">🔄 再来一局</button>
      <button id="btn-endless">♾️ 无尽模式</button>
      <button id="btn-adv-continue" style="display:none;">🏁 继续闯关</button>
      <button id="btn-return-home" style="display:none;">🏠 返回主页</button>
    </div>
  </div>
</div>

<!-- Boss 描述弹窗 -->
<div id="boss-info-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;align-items:center;justify-content:center;">
  <div style="background:#16213e;border-radius:12px;padding:16px 20px;max-width:300px;text-align:center;">
    <div id="boss-info-emoji" style="font-size:40px;margin-bottom