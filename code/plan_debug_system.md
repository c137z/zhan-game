# 《斩》数值验证与回归测试系统 — 设计文档

> 版本：v1.1 | 日期：2026-06-12
> 整合：Claude 原案 + Kimi 方案 + reasonix 审查 + 用户补充
> 修订：审计修正 8 条

---

## 一、核心设计原则

1. **验证规则不变性，而非数值等值**。规则断言长期稳定；数值断言标注设计版本，调平衡时批量更新。
2. **场景从回放/bug报告自动导入，不手写**。维护成本趋近于零。
3. **重点覆盖圣物×Boss特性交互热点**。白板敌人无需测，bug 全出在规则系统交叉点。
4. **复用现有 vm 沙箱**（simulate.js 已验证可行），不引入新依赖。
5. **失败不阻断**：一个场景失败继续跑下一个，最后汇总。

---

## 二、架构总览

```
实际对局 / 万局测试 / 玩家bug上报
         ↓
  导出回放文件（seed + actions + state）
         ↓
  [可选] 人工标注预期行为（规则断言）
         ↓
  场景文件入库 → tests/scenarios/
         ↓
  verify_numerics.js 执行
  ├── vm沙箱加载 data.js + core.js
  ├── newGame(seed, boss, relics)
  ├── 逐步 dispatch(action)
  ├── 每步dump完整状态
  ├── 规则断言检查
  └── 输出文本报告
         ↓
  snapshot_diff.js 对比快照（P1）
```

---

## 三、场景文件格式

每个场景一个 JSON 文件。支持两种来源：

### 3.1 从回放导出（自动，零手写）

```json
{
  "name": "bug_fury_groom_compound",
  "version": "0.7.2",
  "seed": 42,
  "boss": "tabby",
  "relics": ["fury_core"],
  "setup": { "playerHP": 50 },
  "actions": [
    { "type": "PLAY_CARD", "r": 0, "c": 0 },
    { "type": "PLAY_CARD", "r": 1, "c": 0 },
    { "type": "END_TURN" }
  ],
  "rules": [
    {
      "id": "atk_down_pct_no_compound",
      "desc": "虚弱百分比不会因反复施加而叠加",
      "field": "enemyEffects.atk_down_pct",
      "mode": "not_growing",
      "max": 35
    }
  ],
  "values": [
    {
      "id": "atk_down_default",
      "desc": "基础虚弱百分比为30",
      "field": "enemyEffects.atk_down_pct",
      "expect": 30,
      "tolerance": 5,
      "design_version": "v0.7"
    }
  ]
}
```

### 3.2 手动编写（边界场景，极少使用）

与上相同，但 `actions` 可省略——直接通过 `setup` 设置初始状态，引擎自动随机出牌直到触发检查条件。

### 3.3 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 唯一标识，建议命名：`{bug|edge}_{机制}_{boss}` |
| `version` | 自动填充 | 游戏版本号，来源：`CONFIG.GAME_VERSION`（详见 3.5） |
| `seed` | ✅ | 确定性复现 |
| `boss` | ✅ | BOSSES 中的 id |
| `relics` | ✅ | 空数组 = 无圣物 |
| `setup` | ❌ | 覆盖初始状态（HP/phase/deck等）。**时序：在 `newGame()` 之后、第一个 `action` dispatch 之前应用**。如果写在 `newGame()` 之前，会被引擎的初始化覆盖 |
| `actions` | ✅ | 操作序列 |
| `rules` | ❌ | 规则断言列表 |
| `values` | ❌ | 数值断言列表（带版本标注） |

### 3.4 断言格式

**规则断言**：
```json
{
  "id": "唯一标识",
  "desc": "人类可读描述",
  "field": "state路径（用.分隔）",
  "step": 0,                              // 可选，默认=最后一步。指定时仅在该步求值
  "mode": "not_growing | bounded_by | invariant | monotonic",
  "max": 35                               // bounded_by / not_growing 用
}
```

`step` 字段说明：`not_growing` 和 `monotonic` 模式从 step 0 到指定 step 全程检查；`bounded_by` 和 `invariant` 在每一步都检查。省略 `step` 则在最后一步求值。

**数值断言**：
```json
{
  "id": "唯一标识",
  "desc": "人类可读描述",
  "field": "state路径",
  "step": 10,                             // 可选
  "expect": 30,
  "tolerance": 5,
  "design_version": "v0.7"
}
```

### 3.5 版本号定义

在 `data.js` 的 `CONFIG` 对象中增加一行：

```js
GAME_VERSION: "v14",
```

场景文件的 `version` 字段从 `CONFIG.GAME_VERSION` 自动读取。手动编写场景时可不填，`verify_numerics.js` 会从当前引擎的 `CONFIG.GAME_VERSION` 自动填充。

`design_version` 的设计意图：调平衡时，`design_version` 不匹配的数值断言**跳过但打印警告**，不报失败。这样不需要删旧断言。

---

## 四、执行引擎（verify_numerics.js）

### 4.1 输入

```bash
node verify_numerics.js                    # 跑全部场景
node verify_numerics.js fury_groom         # 跑匹配的场景
node verify_numerics.js --failed-only      # 只跑上次失败的
```

### 4.2 执行流程

```
1. 加载场景文件
2. vm沙箱加载 data.js + core.js
3. Zhan.RNG.setSeed(scenario.seed)        ← 在 newGame 之前设置种子
4. newGame({ bossId: scenario.boss, activeRelics: scenario.relics })
5. 应用 setup（在 newGame 之后覆盖 HP 等字段）
6. 对每个 action:
   a. dispatch(action)
   b. 检查 rules 断言（按 step 字段指定的步数求值）
   c. 检查 values 断言（标注版本不匹配的跳过）
   d. dump 状态快照到内存
7. 输出报告
```

**时序关键点**：`setSeed` 必须在 `newGame` 之前调用，因为 `newGame` 内部会通过 `ZhanRNG.random()` 洗牌。`setup` 必须在 `newGame` 之后，否则被引擎初始化覆盖。

### 4.3 输出格式

```
═══════════════════════════════════════════
场景: bug_fury_groom_compound
描述: fury×groom: 虚弱不叠加
种子: 42 | Boss: tabby | 圣物: fury_core
═══════════════════════════════════════════

Step 0 | 初始状态
  playerHP: 50/100  shield: 0
  enemyHP:  300/300 shield: 0  power: 24
  ▶ atkDownPct: 0  furyMult: 1.50

...（中间步省略）...

Step 10 | END_TURN → 结算
  ┌ 连击: atk_down ×3 → 2回合
  ├ atkDownPct: 45  ← ⚠️ 预期 ≤35 [not_growing: FAIL]
  └ 破甲: 未激活

Step 24 | END_TURN → 结算
  ┌ 连击: atk_down ×4 → 2回合
  ├ atkDownPct: 63  ← 🔴 [not_growing: FAIL] [value: FAIL expect=30±5 got=63]
  └ 已确认叠加bug

═══════════════════════════════════════════
断言结果: 1/3 通过, 2 失败
  ✅ atk_down_default (step 10): 30 → 通过
  🔴 atk_down_pct_no_compound (step 24): max=35, got=63
  🔴 atk_down_default (step 24): expect=30±5, got=63
═══════════════════════════════════════════
```

---

## 五、交互热点覆盖

### 5.1 覆盖矩阵

```
                  groom  hiss  lick  锁槽  塞废牌  弃牌  先手  限时
fury_core         🔴🔴  🔴🔴   🟡    -     -      -    🟡    -
overload_core     🔴    🟡     🟡    -     -      -    -     -
endurance_core    🟡    🟡     🟡    -     -      -    -     -
combo_core        🟡    🟡     -     -     -      -    -     -
wild_core         -     -      -    🔴🔴  🟡     -    -     -
spirit_core       -     -      -     -    🔴🔴   -    -     -
tenacity_core     -     -      -     -     -      -    🔴🔴  -
life_core         🔴    🔴     -     -     -      -    🔴    -
slot_plus2        -     -      -     🟡    -      -    -     -
```

🔴🔴 = 必须覆盖（数学交叉点）| 🔴 = 应当覆盖 | 🟡 = 建议覆盖 | - = 低风险

### 5.2 P0 场景清单（8个，必须全部通过）

| # | 场景名 | 圣物 | Boss | 验证什么 |
|---|--------|------|------|----------|
| 1 | `fury_groom_atkdown` | fury_core | tabby(狸花) | fury放大atkDown → groom清除 → 重新施加时不叠加 |
| 2 | `fury_hiss_reset` | fury_core | tabby(狸花) | hiss清全场 → 残血fury重新上buff → 倍率正常范围 |
| 3 | `overload_groom_duration` | overload_core | tabby(狸花) | duration减半+groom清除+重新施加 → 回合数正确 |
| 4 | `wild_lock_slot` | wild_core | british_shorthair(英短) | 万能卡首槽被锁 → 应跳到下一个可用槽。注：此行为通过 dispatch(PLAY_CARD) 触发 `_pullCard` + `lockedSlots` 交互，vm沙箱中与浏览器行为一致 |
| 5 | `spirit_junk_no_penalty` | spirit_core | siamese(暹罗) | 废牌不扣血 → 机制是否被废 |
| 6 | `tenacity_maine_coon` | tenacity_core | maine_coon(缅因) | 先手打死 → tenacity锁1血 → 玩家还能结算 |
| 7 | `life_fury_hiss` | life_core+fury_core | tabby(狸花) | +50HP改变fury斜率 → hiss切段后重算正确 |
| 8 | `combo_min2_duration` | combo_core | tabby(狸花) | minCombo=2时buff持续回合(3连=2T/4连=3T)和追击倍率是否正确 |

### 5.3 P1 场景清单（建议补充）

| # | 场景名 | 验证什么 |
|---|--------|----------|
| 8 | `endurance_groom_debuff` | +1回合debuff被groom清 → 行为是否符合预期 |
| 9 | `fury_lick_player` | fury×斯芬克斯舔玩家buff → 清除后重施加是否正常 |
| 10 | `combo_stun_duration` | minCombo=2时眩晕3连→4连→5连的回合数计算 |
| 11 | `fury_maine_coon` | fury×缅因先手 → 低HP时Boss先行动→fury倍率计算时机 |

---

## 六、文件结构

新文件放在已有 `zhan-game/tests/` 目录下，与现有的 Playwright 脚本、screenshots、reports 并排：

```
zhan-game/
  code/
    verify_numerics.js           # 主执行引擎
    replay_importer.js           # 回放/bug报告 → 场景文件
    snapshot_diff.js             # 快照对比 + diff高亮（P1）
  tests/
    scenarios/
      p0/                        # 8个必须通过
        fury_groom_atkdown.json
        fury_hiss_reset.json
        overload_groom_duration.json
        wild_lock_slot.json
        spirit_junk_no_penalty.json
        tenacity_maine_coon.json
        life_fury_hiss.json
        combo_min2_duration.json
      p1/                        # 4个建议
        endurance_groom_debuff.json
        fury_lick_player.json
        combo_stun_duration.json
        fury_maine_coon.json
      bug_reports/               # 从bug导入的原始文件
    scripts/
      run_verifier.js            # 现有
      run_all_verifiers.js       # 现有
      run_one.js                 # 现有
    fixtures/                    # 现有
    screenshots/                 # 现有
    reports/                     # 现有
    run_all.sh                   # 跑全部场景
```

**为什么不放 `code/tests/` 下**：已有 `zhan-game/tests/` 目录，内含 Playwright 测试脚本、screenshots、reports。新验证系统是同一测试体系的不同层级（数值验证 ← 视觉验证），放在同一 tests/ 下保持统一入口。

**`verify_numerics.js` 放在 `code/` 而不是 `tests/scripts/`**：因为它和 `simulate.js` 共用同一套 vm 沙箱逻辑，放在 `code/` 下源码就近。

### 6.1 vm 沙箱需要的全部 UI stub

`verify_numerics.js` 在沙箱初始化时必须添加以下 stub，否则 `core.js` 中所有 `Zhan.UI && Zhan.UI.xxx` 调用会因 `Zhan.UI` 不存在而静默失败（可能导致状态不一致）：

```js
// 沙箱初始化（在 vm.runInNewContext 加载 core.js 之前注入）
vm.runInNewContext("function updateComboPreview() {}", sandbox);
vm.runInNewContext("var Zhan = {}; window.Zhan = Zhan;", sandbox);

// 加载 core.js 之后
Zhan.UI = {
  render: function(){},
  updateComboPreview: function(){},
  showResult: function(){},
  renderMainMenu: function(){},
  _showView: function(){},
  renderEnemyIntent: function(){},
  renderRelicSelect: function(){},
  renderStageSelect: function(){},
  renderCatMaoShop: function(){},
  renderAffinitySelect: function(){},
  renderLog: function(){}
};
```

这些 stub 与 `simulate.js` 中的完全一致。

---

## 七、执行优先级

| 阶段 | 任务 | 产出 | 预计 |
|------|------|------|------|
| **第1步** | `verify_numerics.js` 第一版 | vm沙箱 + 状态dump + 文本报告 | 2-3h |
| **第2步** | 写 3 个核心 P0 场景 | fury_groom, wild_lock, tenacity_maine | 1-2h |
| **第3步** | `replay_importer.js` | 回放导出 → 场景文件 | 1h |
| **第4步** | 补全 P0 + P1 场景 | 共 11 个场景 | 2-3h |
| **第5步** | `snapshot_diff.js` | 快照对比 | 2h（P1） |
| **第6步** | 游戏内导出按钮 | UI兜底 | 1h（P2） |

---

## 八、不做的事情

- ❌ `scenario_minifier.js`（自动精简场景）——操作序列有因果依赖，随机删大概率破坏复现路径。人工精简 2 分钟，不写工具。
- ❌ 语义化牌型指定 `{card: "atk_down"}`——需要改引擎寻路逻辑，反模式。seed + `{r, c}` 坐标已足够确定。
- ❌ Playwright 视觉截图——P3，结构快照先跑通再说。
- ❌ 万局测试扩展——已有 simulate.js，够用。精力集中在精确场景验证。

---

## 九、与现有系统的关系

| 现有系统 | 本系统如何复用 |
|----------|---------------|
| `simulate.js` vm 沙箱 | 直接复用，`verify_numerics.js` 用的是同一套沙箱 |
| `Zhan.RNG` 种子 | 场景指定 seed → 确定性复现 |
| `replayActions[]` | `replay_importer.js` 读取 → 导出为场景文件 |
| `logLines` 结构化日志 | 场景执行后的 `st.logLines` 提供完整战斗过程 |

---

## 十、设计决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 断言粒度 | 双模式（规则+数值） | 规则管长期，数值标版本——调平衡时不会误报 |
| 场景来源 | 从回放导入为主 | 已有 replayActions，零手写维护成本 |
| 牌型控制 | `{r, c}` 坐标 | seed固定=牌堆固定=坐标确定性。无需改引擎 |
| 视觉回归 | 结构快照优先 | 不需要Playwright，Node.js直接dump UI树 |
| 场景精简 | 不自动 | 操作有因果链，自动删除易破坏复现 |
| 文件位置 | `code/` 下，与 simulate.js 同级 | 保持简单，不新建顶级 tests/ 目录 |
