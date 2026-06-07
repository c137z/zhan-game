// ============================================================
// Playwright verify: wild-unmatched fix
// ============================================================

const { chromium } = require('playwright');
const path = require('path');

const HTML_PATH = "C:/Users/kyzha/.openclaw/projects/zhan/code/index.html";

const SCENARIOS = [
  {
    name: 'A: [wild, attack, wild, heal×9] → unmatched=0',
    cards: ['wild','attack','wild','heal','heal','heal','heal','heal','heal','heal','heal','heal'],
    minCombo: 3, expected: 0,
  },
  {
    name: 'B: [wild, wild, attack, heal×9] → unmatched=0',
    cards: ['wild','wild','attack','heal','heal','heal','heal','heal','heal','heal','heal','heal'],
    minCombo: 3, expected: 0,
  },
  {
    name: 'C: [attack×3] → unmatched=0',
    cards: ['attack','attack','attack'],
    minCombo: 3, expected: 0,
  },
  {
    name: 'D: [heal×3] → unmatched=0',
    cards: ['heal','heal','heal'],
    minCombo: 3, expected: 0,
  },
  {
    name: 'E: [attack, attack, heal] minCombo=3 → unmatched=3',
    cards: ['attack','attack','heal'],
    minCombo: 3, expected: 3,
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading game...');
  await page.goto('file:///' + HTML_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Zhan && window.Zhan.Rules && window.Zhan.Rules.computeCombos, { timeout: 10000 });
  console.log('Game loaded. Running scenarios...\n');

  let allPassed = true;

  for (const sc of SCENARIOS) {
    const result = await page.evaluate(({ cards, minCombo }) => {
      const slot = cards.map(function(t, i) { return { type: t, id: i }; });
      const combos = window.Zhan.Rules.computeCombos(slot, minCombo);

      const activeComboTypes = [];
      for (let cbi = 0; cbi < combos.length; cbi++) {
        if (window.BUFF_TYPES[combos[cbi].type]) activeComboTypes.push(combos[cbi].type);
      }

      const penaltyResult = window.Zhan.Rules.computeUnmatchedPenalty({
        slot: slot,
        _claimedWildIndices: combos._claimedWildIndices || [],
        _consumedIndices: combos._consumedIndices || [],
        effectiveMinCombo: minCombo,
        activeComboTypes: activeComboTypes,
      });

      return {
        combos: combos.map(function(c) { return { n: c.n, type: c.type, start: c.start, end: c.end }; }),
        _claimedWildIndices: combos._claimedWildIndices || [],
        _consumedIndices: combos._consumedIndices || [],
        unmatchedByType: penaltyResult.unmatchedByType,
        totalUnmatched: penaltyResult.totalUnmatched,
      };
    }, sc);

    const passed = result.totalUnmatched === sc.expected;
    if (!passed) allPassed = false;

    console.log(`${passed ? 'PASS' : 'FAIL'} ${sc.name}`);
    console.log(`  combos: ${JSON.stringify(result.combos)}`);
    console.log(`  _consumedIndices: ${JSON.stringify(result._consumedIndices)}`);
    console.log(`  unmatchedByType: ${JSON.stringify(result.unmatchedByType)}`);
    console.log(`  totalUnmatched: ${result.totalUnmatched} (expected: ${sc.expected})`);
    console.log('');
  }

  // Bonus: wildCoreSlot insertion (13 cards)
  console.log('--- Bonus: wildCoreSlot insertion (13-card slot) ---');
  const bonusResult = await page.evaluate(() => {
    const slot = [
      { type: 'wild', id: 100, wildCore: true },
      { type: 'wild', id: 0 },
      { type: 'attack', id: 1 },
      { type: 'wild', id: 2 },
    ];
    for (let i = 0; i < 9; i++) slot.push({ type: 'heal', id: 3 + i });
    const minCombo = 3;
    const combos = window.Zhan.Rules.computeCombos(slot, minCombo);
    const activeComboTypes = [];
    for (let cbi = 0; cbi < combos.length; cbi++) {
      if (window.BUFF_TYPES[combos[cbi].type]) activeComboTypes.push(combos[cbi].type);
    }
    const penaltyResult = window.Zhan.Rules.computeUnmatchedPenalty({
      slot: slot,
      _claimedWildIndices: combos._claimedWildIndices || [],
      _consumedIndices: combos._consumedIndices || [],
      effectiveMinCombo: minCombo,
      activeComboTypes: activeComboTypes,
    });
    return {
      combos: combos.map(function(c) { return { n: c.n, type: c.type, start: c.start, end: c.end }; }),
      _consumedCount: (combos._consumedIndices || []).length,
      totalUnmatched: penaltyResult.totalUnmatched,
    };
  });

  const bonusPassed = bonusResult.totalUnmatched === 0;
  if (!bonusPassed) allPassed = false;
  console.log(`${bonusPassed ? 'PASS' : 'FAIL'} Bonus: wildCore + [w,a,w,heal×9] (13 cards)`);
  console.log(`  combos: ${JSON.stringify(bonusResult.combos)}`);
  console.log(`  _consumedIndices count: ${bonusResult._consumedCount}`);
  console.log(`  totalUnmatched: ${bonusResult.totalUnmatched} (expected: 0)`);
  console.log('');

  console.log('='.repeat(50));
  console.log(allPassed ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED');
  console.log('='.repeat(50));

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();
