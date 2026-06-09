# 战斗界面 UI 重构 — Task 拆分

基于规范 v1，拆为 6 个独立 Task（T1→T6 顺序执行）

---

## T1: 战斗展示区重构 — 角色/Boss/VS区域 + 角色信息区

**改:** code/index.html (CSS + HTML) + code/ui.js (render函数修改)

**内容:**
1. #top-row 重构为三栏布局：玩家(30%) | VS | Boss(30%)
2. 角色 avatar 放大 ×1.8: .avatar font-size 24→43px, .enemy-avatar 30→60px
3. 战斗展示区高度 ~30vh，角色垂直居中
4. 角色信息区移到角色脚下：HP/护盾/Buff/Debuff 紧凑排列
5. Boss 信息区同样：HP/护盾/Buff/Debuff/意图
6. 删除 enemy-box 和 player-box 的旧 styles，新建 .hero-area / .boss-area
7. ui.js render 函数适配新的 DOM 结构

---

## T2: 元气弹竖向 + Boss立绘背景

**改:** code/index.html (CSS) + code/ui.js

**内容:**
1. #spirit-bar-wrap 改为竖向：flex-direction:column, width:5%, position:absolute left:0
2. 进度条改为竖向：height 80% 战斗区高度, width 100%
3. 猫猫Boss(.boss-with-portrait) 添加半透明立绘背景：opacity:0.2~0.3, 覆盖右侧70%
4. 普通Boss不显示立绘

---

## T3: 消除槽 + 移除区 + 卡池 重排

**改:** code/index.html (HTML顺序+CSS)

**内容:**
1. 整体结构调整为：战斗展示区 → 消除槽(slot-bar) → 移除区(新#removed-bar) → 卡池(board) → 操作按钮(actions)
2. 新增 #removed-bar：一行高, flex, 尺寸与消除槽 eslot 一致
3. ui.js render 填充 #removed-bar 显示本回合被移除的卡牌
4. 卡池(board)位置保持不变但移到移除区下面

---

## T4: 操作按钮区重构

**改:** code/index.html (HTML + CSS)

**内容:**
1. #actions 固定悬浮在最底部：position:sticky bottom:0, height:10vh
2. 三按钮布局：移出卡牌(左) | 结束回合(中, 宽50%) | 洗牌(右)
3. 结束回合：高亮主色 #f1c40f, bold, 最醒目
4. 移出卡牌/洗牌：显示广告次数 (0/1)
5. 移出卡牌无选中时 disable
6. 删除重置按钮

---

## T5: 删除调试日志 + 连击信息调整 + 伤害弹出

**改:** code/index.html (删除#log HTML/CSS) + code/ui.js (删除log相关代码, 新增damage popup)

**内容:**
1. 删除 #log 区域（HTML + CSS + ui.js中的log()调用改为空操作）
2. #combo-bar 保持现在位置（消除槽配合显示）
3. 伤害弹出：ui.js中攻击结算时，弹出浮动数字：<20白字黑边, 20-40红字黑边, >40放大加粗红字黑边
4. 弹出后0.5s渐隐消失

---

## T6: 齿轮按钮移到消除槽右上方

**改:** code/index.html (CSS)

**内容:**
1. #btn-settings 从 position:fixed 改为相对消除槽定位
2. 放在 #slot-bar 右上方：position:absolute, 相对于 #battle-view
3. 尺寸比例不变

---

## 执行顺序: T1 → T2 → T3 → T4 → T5 → T6

每个 task 完成后 CHECK→VERIFY→COMMIT，再开始下一个。
