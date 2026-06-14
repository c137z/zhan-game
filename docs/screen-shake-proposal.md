# 斩 — 画面震动落地方案 v2

> 基于 ChatGPT 对 v1 的七条修正，覆盖全部反馈。只做画面震动 + HitStop + 闪白。

---

## 一、设计原则（v2 不变）

1. **震动只响应最终伤害**，不响应连击过程
2. **方向因果驱动**：攻击从左来 → 右推回弹，不随机
3. **不叠加**：同时只跑一个震动，后来的丢弃
4. **JS 逐帧驱动**，不靠 CSS keyframes

---

## 二、配置表（v2）

```js
Zhan.Shake = {
  // [伤害阈值, 震幅px, 时长ms, 频率Hz, 衰减曲线]
  TIERS: [
    [60, 5, 180, 12, 'exp'],
    [45, 3, 120, 14, 'exp'],
    [30, 2,  90, 16, 'exp'],
    [20, 1,  60, 18, 'linear'],
  ],

  // HitStop 对照表（ms）
  HITSTOP: [ [60,240], [45,160], [30,100], [20,60] ],

  // Boss 修正：仅当 isBoss 为 true 时乘
  BOSS_AMP_MULT: 1.25,
  BOSS_DUR_MULT: 1.1,

  // 攻击方向：+1 = 向右推（玩家→Boss）
  directionX: 1,

  // 衰减函数（只保留两种）
  _decay: function(progress, type) {
    switch (type) {
      case 'linear':  return 1 - progress;
      case 'exp':     return Math.exp(-3 * progress);
      default:        return 1 - progress;
    }
  },
};
```

v2 改动：
- 伤害阈值 20/32/47/68 → **20/30/45/60**（60 就能进最高档，玩家不白刷）
- 频率 24/22/20/18 → **18/16/14/12 Hz**（短震动下频率差异不可感知，降低无意义复杂度）
- 衰减 **删掉 exp_rebound**（Math.sin 自带正负振荡，回弹已天然存在）
- 去掉 `BOSS_AMP_MULT` × 全局的硬编码写法，改为条件触发

---

## 三、震动执行函数（v2）

```js
Zhan.Shake.trigger = function(dmg, isBoss) {
  if (!Zhan.Settings.vibrate) return;
  if (this._running) return;

  var tier = null;
  for (var i = 0; i < this.TIERS.length; i++) {
    if (dmg >= this.TIERS[i][0]) { tier = this.TIERS[i]; break; }
  }
  if (!tier) return;

  var amp   = tier[1];
  var dur   = tier[2];
  var freq  = tier[3];
  var decay = tier[4];

  if (isBoss) {
    amp *= this.BOSS_AMP_MULT;
    dur *= this.BOSS_DUR_MULT;
  }

  var el = this._cameraEl || document.getElementById('camera-layer');
  var self = this;
  var start = performance.now();
  this._running = true;

  function tick(now) {
    var elapsed = now - start;
    if (elapsed >= dur) {
      el.style.transform = 'translateX(0px)';
      self._running = false;
      return;
    }
    var progress = elapsed / dur;
    var mag = amp * self._decay(progress, decay);
    var osc = Math.sin(2 * Math.PI * freq * elapsed / 1000);
    var offset = mag * osc * self.directionX;
    el.style.transform = 'translateX(' + offset.toFixed(2) + 'px)';
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
};
```

v2 改动：
- 签名改为 `trigger(dmg, isBoss)`，Boss 修正只在 Boss 身上生效
- 震动目标改为 `#camera-layer`（见第五节），不再直接操作 `#battle-display`

---

## 四、HitStop（v2）

只冻结回合结算，不冻结拖牌视觉。

```js
Zhan.Shake.hitstopMs = function(dmg) {
  for (var i = 0; i < Zhan.Shake.HITSTOP.length; i++) {
    if (dmg >= Zhan.Shake.HITSTOP[i][0]) return Zhan.Shake.HITSTOP[i][1];
  }
  return 0;
};
```

**core.js 只加一处守卫：**

`_executeTurn` / `dispatch(END_TURN)` 处：
```js
if (Date.now() < (Zhan.Engine._hitstopUntil || 0)) return;
```

v2 改动：
- **不再冻结 `_pullCard`**（拖牌视觉不断，玩家不会觉得"卡了"）

---

## 五、Camera 层隔离（新增）

不再直接写 `#battle-display` 的 transform，改用一个内部容器。

**HTML struct**（在 `#battle-display` 内部包一层）：

```html
<div id="battle-display">
  <div id="camera-layer">
    <!-- 原有内容：spirit-bomb、角色区域等全放这里 -->
  </div>
</div>
```

CSS：
```css
#camera-layer {
  will-change: transform;
}
```

震动只操作 `#camera-layer`，`#battle-display` 的 transform 留空给未来特效（scale/rotate/death-anim）。

---

## 六、68+（现在是 60+）闪白（新增）

```js
// 在 trigger() 中，tier 匹配到最高档后：
if (tier === this.TIERS[0]) {
  document.body.classList.add('damage-flash');
  setTimeout(function() {
    document.body.classList.remove('damage-flash');
  }, 50);
}
```

CSS：
```css
.damage-flash {
  filter: brightness(1.15);
  transition: filter 50ms ease-out;
}
```

成本 50ms CSS transition，观感提升巨大。只在最高档触发。

---

## 七、事件挂接

```js
Zhan.Events.on('damageDealt', function(d) {
  var isBoss = d.source === 'attack'; // 只有玩家攻击才震，敌方攻击震自己暂不实现
  Zhan.Shake.trigger(d.final, isBoss);
  Zhan.Engine._hitstopUntil = Date.now() + Zhan.Shake.hitstopMs(d.final);
});
```

---

## 八、改动文件清单

| 文件 | 改什么 | 量 |
|------|--------|:--:|
| `code/index.html` | `#camera-layer` 包裹现有内容 | ~2行 HTML |
| `code/index.html` | CSS：`#camera-layer` + `.damage-flash` | ~8行 |
| `code/index.html` | JS：`Zhan.Shake` 配置 + 衰减 + `trigger()` + `hitstopMs()` + 事件挂接 | ~80行 |
| `code/core.js` | `dispatch(END_TURN)` 加 `_hitstopUntil` 守卫 | 1行 |
| 其他 | 不动 | 0 |

---

## 九、最终参数一览

| 伤害 | 震幅 | 时长 | 频率 | 衰减 | HitStop | 闪白 |
|:----:|:----:|:----:|:----:|:----:|:-------:|:----:|
| 20+ | 1px | 60ms | 18Hz | linear | 60ms | — |
| 30+ | 2px | 90ms | 16Hz | exp | 100ms | — |
| 45+ | 3px | 120ms | 14Hz | exp | 160ms | — |
| 60+ | 5px | 180ms | 12Hz | exp | 240ms | ✅ 50ms |

Boss 受击：震幅 ×1.25，时长 ×1.1。Boss 最大震幅 5 × 1.25 = **6.25px**。

---

## 十、v1 → v2 变更记录

| # | ChatGPT 反馈 | v1 | v2 |
|:--:|------------|-----|-----|
| 1 | Boss 倍率硬编码 | 所有伤害无差别 ×1.25 | `trigger(dmg, isBoss)`，条件触发 |
| 2 | exp_rebound 不回弹 | 三种衰减 | 删掉，只留 linear + exp |
| 3 | 直接写 transform 会覆盖 | 操作 `#battle-display` | 操作 `#camera-layer`，隔离 Camera 与特效 |
| 4 | HitStop 冻结拖牌 | `_pullCard` 也冻结 | 只冻结 `END_TURN`，拖牌视觉不断 |
| 5 | 频率过高不可感知 | 24/22/20/18 Hz | 18/16/14/12 Hz |
| 6 | 缺闪白 | 无 | 60+ 档加 `damage-flash` 50ms |
| 7 | 伤害阈值偏高 | 20/32/47/68 | 20/30/45/60 |
