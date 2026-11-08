// Tests for the Scenario lab coupling model. Run: node test/scenario.test.mjs
// Uses the real fetched data.json, so identity at the actuals must hold
// against the dashboard's own published numbers and scorecard verdicts.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildBaseline, inferScenario } from '../scenario.js';
import { MODEL_DEFAULTS } from '../model.js';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const M = data.metrics;
const baseline = buildBaseline(M, {
  supply: MODEL_DEFAULTS.totalSupply,
  feeBurnAnnual: MODEL_DEFAULTS.feeBurnAnnual,
});
const A = baseline.actuals;

const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ------------------------------------------------------------- identity ---
// Sliders at the actuals => every inferred figure equals the actual one,
// and the re-run verdicts equal the dashboard's published scorecard.
const atActuals = inferScenario(baseline, {});
assert.ok(close(atActuals.inferred.intentsRevenuePerDay, M.intentsRevenue30dAvg), 'identity: Intents revenue');
assert.ok(close(atActuals.inferred.chainRevenuePerDay, M.chainRevenue30dAvg), 'identity: chain revenue');
assert.ok(close(atActuals.inferred.intentsSharePct, M.intentsShareOfChainRevenuePct), 'identity: Intents share');
assert.ok(close(atActuals.inferred.annualisedIntentsRevenue, M.annualisedRevenue), 'identity: annualised revenue');
assert.ok(close(atActuals.inferred.marketCap, M.marketCap), 'identity: market cap');
assert.ok(close(atActuals.inferred.revenueToMarketCapPct, M.revenueToMarketCapPct), 'identity: revenue / market cap');
assert.ok(close(atActuals.inferred.chainFeesPerDay, M.chainFees30dAvg), 'identity: chain fees via fees-per-txn coupling');
for (const c of data.scorecard) {
  const v = atActuals.verdicts.find((x) => x.id === c.id);
  assert.ok(v, `verdict present for ${c.id}`);
  assert.equal(v.verdict, c.verdict, `identity: verdict for ${c.id} matches the dashboard (${c.verdict})`);
}

// --------------------------------------------------------- monotonicity ---
const feesUp = inferScenario(baseline, { intentsFeesPerDay: A.intentsFeesPerDay * 1.5 });
assert.ok(feesUp.inferred.intentsRevenuePerDay > atActuals.inferred.intentsRevenuePerDay, 'fees up => Intents revenue up');
assert.ok(feesUp.inferred.chainRevenuePerDay > atActuals.inferred.chainRevenuePerDay, 'fees up => chain revenue up');
assert.ok(feesUp.inferred.intentsSharePct > atActuals.inferred.intentsSharePct, 'fees up => Intents share up');
const feesDown = inferScenario(baseline, { intentsFeesPerDay: A.intentsFeesPerDay * 0.5 });
assert.ok(feesDown.inferred.intentsSharePct < atActuals.inferred.intentsSharePct, 'fees down => Intents share down');
assert.ok(feesUp.inferred.chainRevenuePerDay - atActuals.inferred.chainRevenuePerDay
  > feesDown.inferred.chainRevenuePerDay - atActuals.inferred.chainRevenuePerDay, 'chain revenue moves monotonically with fees');

// -------------------------------------------------------- price coupling ---
const price2x = inferScenario(baseline, { nearPrice: A.nearPrice * 2 });
assert.ok(close(price2x.inferred.marketCap, atActuals.inferred.marketCap * 2), 'price x2 => market cap x2');
assert.ok(close(price2x.inferred.revenueToMarketCapPct, atActuals.inferred.revenueToMarketCapPct / 2), 'price x2 => revenue % of cap halves');
assert.ok(close(price2x.inferred.intentsRevenuePerDay, atActuals.inferred.intentsRevenuePerDay), 'price does not move revenue');

// --------------------------------------------------------- verdict flips ---
// fee-capture sits at 0.52% vs a 0.5% bar: cut Intents fees to a tenth
// and annualised revenue / market cap falls under the 0.1% floor.
const feesTenth = inferScenario(baseline, { intentsFeesPerDay: A.intentsFeesPerDay * 0.1 });
assert.equal(feesTenth.verdicts.find((v) => v.id === 'fee-capture-material').verdict, 'contradicted',
  'fees x0.1 flips fee-capture from supported to contradicted');
// Price alone can do it too: x6 price => ~0.086% < 0.1%.
const price6x = inferScenario(baseline, { nearPrice: A.nearPrice * 6 });
assert.equal(price6x.verdicts.find((v) => v.id === 'fee-capture-material').verdict, 'contradicted',
  'price x6 flips fee-capture from supported to contradicted');
// Intents share: at 2% of actual fees the share falls under the 25% bar.
const feesTiny = inferScenario(baseline, { intentsFeesPerDay: A.intentsFeesPerDay * 0.02 });
assert.ok(feesTiny.inferred.intentsSharePct < 25, 'fees x0.02 => share under 25%');
assert.equal(feesTiny.verdicts.find((v) => v.id === 'intents-dominates-revenue').verdict, 'contradicted',
  'fees x0.02 flips intents-dominates from supported to contradicted');
// Historical verdicts cannot move: no driver bends their inputs.
for (const s of [feesUp, price2x, feesTiny]) {
  for (const id of ['tvl-not-the-story', 'stablecoin-rails', 'market-not-pricing']) {
    assert.equal(s.verdicts.find((v) => v.id === id).verdict,
      data.scorecard.find((c) => c.id === id).verdict, `${id} is scenario-invariant`);
  }
}

// ------------------------------------------- txns / accounts / burn links ---
const txns2x = inferScenario(baseline, { txnsPerDay: A.txnsPerDay * 2 });
assert.ok(close(txns2x.inferred.chainFeesPerDay, atActuals.inferred.chainFeesPerDay * 2), 'txns x2 => chain fees x2 at the actual fee-per-txn');
const accounts2x = inferScenario(baseline, { accounts: A.accounts * 2 });
assert.ok(close(accounts2x.inferred.revenuePerAccountPerYear, atActuals.inferred.revenuePerAccountPerYear / 2), 'accounts x2 => revenue per account halves');
const burnAll = inferScenario(baseline, { feeBurnAnnual: atActuals.inferred.issuanceStatusQuoPerYear });
assert.ok(Math.abs(burnAll.inferred.netSupplyStatusQuoPerYear) < 1e-6, 'burn equal to status-quo issuance => net supply change zero');
const burn0 = inferScenario(baseline, { feeBurnAnnual: 0 });
assert.ok(burn0.inferred.netSupplyHsp029PerYear < burn0.inferred.netSupplyStatusQuoPerYear, 'HSP-029 rate nets less new supply than status quo');

console.log('scenario.test.mjs: all assertions passed');
console.log(`  revenue/fees ratio: ${baseline.couplings.revenuePerFee.toFixed(4)} (actual $${Math.round(M.intentsRevenue30dAvg)}/day on $${Math.round(M.intentsFees30dAvg)}/day)`);
console.log(`  non-Intents revenue held constant: $${Math.round(baseline.couplings.nonIntentsRevenuePerDay)}/day`);
console.log(`  fees per transaction: $${baseline.couplings.feesPerTxn.toFixed(4)} (actual $${Math.round(M.chainFees30dAvg)}/day over ${Math.round(M.txnsPerDay30dAvg).toLocaleString('en-US')} txns/day)`);
console.log(`  accounts baseline: ${M.totalAccounts.toLocaleString('en-US')} (NearBlocks, as of ${M.totalAccountsAsOf})`);
