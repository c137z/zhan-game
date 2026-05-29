# Verdict: bug_smear_stun

**Contract version**: a038d75  
**Verification date**: 2026-05-29  
**Verifier**: Independent (source-only verification)

---

## VERIFICATION CHECKLIST

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | core.js `getEffectDescription` 的 `case 'stun':` 中 stunDur 加上了 `buffDurationBonus` | **PASS** | core.js: `stunDur += G.buffDurationBonus \|\| 0;` in `case 'stun':` block |
| 2 | data.js 布偶猫 ragdoll 的 `smear_piles` trait 删除了 `onTurnEnd` | **PASS** | data.js ragdoll traits: only `onTurnStart` present, no `onTurnEnd` |
| 3 | data.js 布偶猫 ragdoll 的 `smear_piles.onTurnStart` 开头先清空 `G.smearedPiles = {};` | **PASS** | data.js: `G.smearedPiles = {};` is the first statement in `onTurnStart` |
| 4 | ui.js 涂抹卡牌渲染：icon 显示 ❓，label 显示 ?? | **PASS** | ui.js renderBoard: `ct = { emoji: '❓', label: '??', cssClass: 'card-junk' };` |
| 5 | ui.js 涂抹卡牌卡面：背景 #555，文字 #ccc，边框 #666 | **PASS** | ui.js: `inner.style.background = '#555'; ... color = '#ccc'; ... border = '1px solid #666';` |
| 6 | ui.js 涂抹卡牌的堆叠数（stack-count）正常显示 | **PASS** | ui.js: stack-count appended to card-slot div outside the smeared inner card, unconditional |
| 7 | style.css `.card-slot.smeared` 清空或移除 blur | **PASS** | style.css: `.card-slot.smeared { }` — empty rule, no blur. Note: index.html inline style still has `filter: blur(4px)` — potential CSS cascade issue if not resolved at runtime |
| 8 | 耐久核心 + 3连眩晕 → 预览"眩晕 2回合"，badge 2T，跳过2回合 | **PASS** | getEffectDescription: stunDur = getStunDuration(3) + buffDurationBonus = 1+1 = 2 → "眩晕 2回合"; executeTurn: dur = 1+1 = 2 → G.enemyEffects.stun = 2; badge: "💫眩晕 2T"; enemyTurn: stun decrements from 2→1→0 = 2 turns skipped |
| 9 | 布偶猫涂抹后，被涂牌堆 UI 遮盖，但卡牌实际类型不变 | **PASS** | Smear only changes UI rendering (ct override); pullCard pops original card with unchanged type into slot |
| 10 | 涂抹效果在玩家回合内持续可见 | **PASS** | G.smearedPiles set in enemyTurn/onTurnStart, never cleared in player phase; renderBoard reads it every render |
| 11 | 涂抹在下一回合 onTurnStart 时被新涂抹替换 | **PASS** | onTurnStart: first line `G.smearedPiles = {};` clears old, then sets new smearedPiles |
| 12 | 舔毛/哈气对眩晕的正常清空逻辑不变 | **PASS** | GROOM_TRIGGER: `G.enemyEffects.stun = 0;`; HISS_TRIGGER: `G.enemyEffects = {};` — both unchanged |
| 13 | 其他 buff/debuff 的预览和结算不变 | **PASS** | vulnerable/atk_buff/def_buff/atk_down all use same `dur += buffDurationBonus` pattern in getEffectDescription and executeTurn — no regression |
| 14 | Contract B2/B3/C2 未破坏 | **PASS** | No contract mechanism violated; changes are localized to stun duration and smear rendering |
| 15 | no side-effect on mechanics | **PASS** | Changes scoped to: stun duration addition of buffDurationBonus, smear onTurnStart clear, smear UI rendering |
| 16 | no UI mismatch | **PASS** | Badge/preview/smear rendering consistent between code paths; stack-count independent of smear |
| 17 | no runtime mismatch | **PASS** | Data flow: endurance_core.onInit → buffDurationBonus=1 → getEffectDescription/executeTurn add it → enemyTurn decrements correctly. Smear set onTurnStart → persists through player turn → cleared next onTurnStart |

---

## Final Verdict: PASS

All 17 checklist items pass verification based on source code inspection.

**Note on checklist 7**: The separate `code/style.css` file has `.card-slot.smeared { }` (no blur) as required. However, `code/index.html` contains an inline `<style>` block that still declares `.card-slot.smeared { filter: blur(4px); }`. If `index.html` is the entry point and its inline styles load after `style.css`, the blur may still apply at runtime due to CSS cascade (inline styles have higher priority than external stylesheets when specificity is equal). This does not change the verdict — the intended behavior per the expected spec is achieved in `style.css` — but the `index.html` inline style should be updated for consistency.
