# 专家意见响应 — 三个工程化改造

## 背景

专家评审后提出三个关注点：
1. 存档兼容性 — 无版本号 + 迁移机制
2. 内存泄漏 — setInterval/setTimeout/addEventListener 积累
3. 极限局测试 — 高回合/高日志/高 buff 场景验证

经代码审查，情况如下：
- **内存泄漏**：实际风险较低（`renderBoard` 清 DOM 时旧监听器被 GC），暂不处理
- **存档兼容**：**真实风险，立刻处理**
- **极限局测试**：验收阶段做，暂不代码改动

---

## 改造内容

### 1. 存档版本化 + 迁移机制

**目标**：以后改存档结构时，旧存档不炸，自动迁移。

#### 改动点

**data.js** — 加一个存档版本常量：
```js
// 在 CONFIG 对象末尾追加
SAVE_VERSION: 1,       // 当前存档版本，每次存档结构变更 +1
```

**core.js** — 改造 `loadProgress()` 函数：

```js
function loadProgress() {
  try {
    var raw = localStorage.getItem(Zhan.Engine.SAVE_KEY);
    if (raw) {
      Zhan.Engine._save = JSON.parse(raw);
      // === 存档迁移 ===
      var currentVersion = CONFIG.SAVE_VERSION || 1;
      var saveVersion = Zhan.Engine._save.version || 0;
      // 从旧版迁移：v0 → v1（增加新字段）
      if (saveVersion < 1) {
        if (!Zhan.Engine._save.mazeFirstKills) Zhan.Engine._save.mazeFirstKills = [];
        if (Zhan.Engine._save.mazeUnlocked === undefined) Zhan.Engine._save.mazeUnlocked = false;
        if (Zhan.Engine._save.towerUnlocked === undefined) Zhan.Engine._save.towerUnlocked = false;
        Zhan.Engine._save.version = 1;
      }
      // 未来 v1 → v2 在此追加：
      // if (saveVersion < 2) {
      //   Zhan.Engine._save.newField = defaultValue;
      //   Zhan.Engine._save.version = 2;
      // }
      Zhan.Engine._save.advUnlocked = 50; // 强制全部解锁（调试用，上线后可移除）
    } else {
      Zhan.Engine._save = getDefaultSave();
    }
  } catch(e) {
    Zhan.Engine._save = getDefaultSave();
  }
  return Zhan.Engine._save;
}

function getDefaultSave() {
  return {
    version: CONFIG.SAVE_VERSION || 1,
    catMao: 0,
    advUnlocked: 50,
    bestFloor: 0,
    mazeFirstKills: [],
    towerBestFloor: 0,
    mazeUnlocked: false,
    towerUnlocked: false
  };
}
```

#### 涉及文件

| 文件 | 改动 |
|:----|:-----|
| data.js | CONFIG 加 `SAVE_VERSION: 1`（1 行） |
| core.js | `loadProgress()` 加迁移逻辑，`getDefaultSave()` 提取为独立函数 |

---

### 2. 全局 `document.addEventListener` 防泄漏（低优先级）

当前 `ui.js` 中有两个全局文档点击监听器（日志面板关闭、设置面板关闭），各绑定一次，不积累。

但有个**真实问题**：每次 `renderBoard()` 清空 `#board` 后重建 25 个 `.card-slot`，每个都绑 `click`/`touchstart`/`touchmove`。虽然 `innerHTML = ''` 会 GC 旧监听器，但快速反复渲染（比如每回合）会在短期内创建大量临时函数对象。

**当前无实际风险，暂不处理。** 标记为"长期观察项"。

---

### 3. 极限局测试方案（验收阶段做）

不需要改代码，需要手动或脚本跑：

| 场景 | 操作 | 检查点 |
|:----|:----|:-------|
| 100 回合 | 打一局一直拖到 100 回合 | 日志面板不卡、伤害数字不溢出 |
| 1000 条日志 | 同上 | 日志面板滚动流畅 |
| 20 个 Buff 同时生效 | 用圣物叠 buff | buff 显示不乱行、不重叠 |
| 超大伤害 `9999+` | 高连击 + 暴击 + 破甲叠满 | 伤害数字位置正确、不撑破容器 |
| 反复进出战斗 | 首页→战斗→首页→战斗 重复 20 次 | 无内存增长、帧率不降 |
| 存档写入 + 刷新 | 打一局后 F5 刷新 | 存档正常读取、数据不丢 |

---

## 执行建议

**优先级**：① 存档迁移 → ② 极限局测试

**估计工时**：
- 存档迁移：0.5 天
- 极限局测试：0.5 天手工测试
