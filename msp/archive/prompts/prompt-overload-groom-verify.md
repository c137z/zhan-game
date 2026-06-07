# 测试需求：过载核心持续回合验证 + 舔毛周期验证

## 测试目标

验证 v2.4 中：
A. 过载核心 buff 持续回合正确减半（Math.floor(dur/2)，至少 1 回合）
B. 舔毛周期从 4→5 回合

## 测试方法

Playwright page.evaluate() 在 v2.3-baseline fixture 上调引擎函数。

但 fixture 是 v2.3 旧版！所以这里需要在 page.evaluate 中手动注入 v2.4 的改动逻辑来验证预期行为。

## A. 过载核心持续验证

用 mockState 模拟不同连击数（3/4/5/10），检查 buff 持续回合：

```js
// 模拟 3 连 buff（无过载=2回合，有过载=1回合）
var st = mockState(['overload_core'], 1.0);
// 模拟 Zhan.Rules.getComboDuration(3, mc) → 返回 dur
// 过载下 Math.max(1, Math.floor(dur/2)) 验证
```

具体验证：
- 3连 + overload → 持续 = max(1, floor(2/2)) = 1
- 4连 + overload → 持续 = max(1, floor(3/2)) = 1
- 5连 + overload → 持续 = max(1, floor(4/2)) = 2
- 10连 + overload → 持续 = max(1, floor(8/2)) = 4
- 3连 无 overload → 持续 = 2（不变）

## B. 舔毛周期验证

mockState 设置 turn 值，调 Zhan.Systems.Boss.runHpTriggers 验证 groom 在正确回合触发：
- turn=3 (第4回合) → groom 不触发（新逻辑：%5===0，turn+1=4，4%5≠0）
- turn=4 (第5回合) → groom 触发（turn+1=5，5%5===0）
- turn=9 (第10回合) → groom 触发

## 输出

报告 tests/reports/overload-groom-verify-report.md

## 约束

- 脚本 tests/scripts/verify-overload-groom.js
- 不修改任何 fixture/code 文件
- require('playwright')
- exit 0 = 全 PASS
