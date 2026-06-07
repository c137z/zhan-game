# Task: 卡牌美术替换 v1

## 目标
将 10 种已有图片的卡牌用 Base64 背景图替换纯色底色+emoji。

## 改动文件
- `code/index.html`：CSS 部分
- `code/ui.js`：卡牌渲染逻辑

## 详细改动

### 1. index.html CSS 改动

#### 1a. 10 种卡牌的 CSS（替换 color + background）

| 卡牌 | CSS class | 图片文件 | 旧 color | 新 color |
|------|-----------|---------|----------|----------|
| attack | .card-attack | attack.jpg | #fff | #000 |
| defend | .card-defend | defend.jpg | #fff | #000 |
| heal | .card-heal | heal.jpg | #fff | #000 |
| wild | .card-wild | wild.jpg | #fff | #000 |
| atk_down | .card-atk-down | atk_down.jpg | #fff | #000 |
| vulnerable | .card-vulnerable | vulnerable.jpg | #fff | #000 |
| stun | .card-stun | stun.jpg | #fff | #000 |
| atk_buff | .card-atk-buff | atk_buff.jpg | #fff | #000 |
| def_buff | .card-def-buff | def_buff.jpg | #fff | #000 |
| junk | .card-junk | junk.jpg | #999 | #000 |

现有 CSS（示例）：
```css
.card-attack { background: #c0392b; color: #fff; }
```

改成：
```css
.card-attack { background-image: url(BASE64_FROM_ATTACK_JPG); background-size: cover; color: #000; }
```

#### 1b. card-label 文字标签样式改动
当前：
```css
.card-slot .card .card-label { font-size: 7px; opacity: 0.8; letter-spacing: 0; pointer-events: none; line-height: 1; }
```
改成（加白底 + 黑色字）：
```css
.card-slot .card .card-label { font-size: 7px; opacity: 1; letter-spacing: 0; pointer-events: none; line-height: 1; background: rgba(255,255,255,0.85); color: #000; padding: 0 2px; border-radius: 2px; }
```

#### 1c. card-count 数字样式改动（card-icon 旁边的数字，但已废弃？检查是否使用）
当前：
```css
.card-slot .card .card-count { position: absolute; top: 1px; left: 2px; font-size: 10px; color: #fff; font-weight: 900; opacity: 0.9; background: rgba(0,0,0,0.4); padding: 0 3px; border-radius: 3px; line-height: 1.3; }
```
改成白底黑字：
```css
.card-slot .card .card-count { position: absolute; top: 1px; left: 2px; font-size: 10px; color: #000; font-weight: 900; opacity: 1; background: rgba(255,255,255,0.85); padding: 0 3px; border-radius: 3px; line-height: 1.3; }
```

#### 1d. stack-count 保持不变
当前已经是白底黑字，不用改：
```css
.card-slot .stack-count { ... color: #111; ... background: rgba(255,255,255,0.85); ... }
```
保持原样。

#### 1e. 小屏幕 @media 对应改动
@media (max-width: 380px) 里：
```css
.card-slot .card .card-icon { font-size: 14px; }
.card-slot .card .card-label { font-size: 6px; }
```
`card-label` 字体大小保持 6px 不变，不额外写 background/color（默认继承）。

#### 1f. 未被替换的 3 种卡牌保持不变
- `.card-special-atk`
- `.card-special-def`
- `.card-divine`
- `.card-special`
这些不改。

### 2. ui.js 渲染逻辑改动

在 `renderBoard` 函数中（board.js 走 ui.js），当前：
```js
var icon = document.createElement('span');
icon.className = 'card-icon';
icon.textContent = ct.emoji;
...
inner.appendChild(icon);
inner.appendChild(label);
```

改动：被替换的 10 种卡牌不创建 `card-icon` 元素（不显示 emoji），未替换的 3 种保留 emoji。

判断方式：如果 `ct.cssClass` 属于有美术图的 class（card-attack / card-defend / card-heal / card-wild / card-atk-down / card-vulnerable / card-stun / card-atk-buff / card-def-buff / card-junk），则不创建 card-icon。对于 card-special-atk / card-special-def / card-divine / card-special，保留 card-icon。

具体实现：定义一个数组或条件判断。

### 3. Base64 数据

见 task JSON 中的 base64Data 字段（JSON 里太长不在此处列出）。

## forbidden
- 不要改 core.js
- 不要改 data.js
- 不要改 ui.js 的渲染逻辑之外的代码
- 不要改 HTML 结构（只改 CSS + ui.js 的 card-icon 创建逻辑）
- 不要改特殊卡（特攻/特防/免伤）的视觉
