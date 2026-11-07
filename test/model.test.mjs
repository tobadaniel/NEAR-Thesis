// Tests for the HSP-029 simulator. Run: node test/model.test.mjs
// These assert the model's endpoints and direction of travel. The model is
// NOT tuned to the reported ~11.8M NEAR saved figure; the test only checks
// the model lands in a sane band around it and reports what it gives.

import assert from 'node:assert';
import { issuanceRate, simulate, summarise, MODEL_DEFAULTS } from '../model.js';

// Endpoints of the rate path
assert.equal(issuanceRate(0), 0.025, 'month 0 rate is 2.5%');
assert.equal(issuanceRate(2), 0.025, 'grace period holds 2.5%');
assert.ok(Math.abs(issuanceRate(27) - 0.016) < 1e-12, 'month 27 (grace+24) rate is 1.6%');
assert.equal(issuanceRate(40), 0.016, 'rate holds at 1.6% after the phase-in');

// The path is monotonically non-increasing
let prev = Infinity;
for (let m = 0; m < 60; m++) {
  const r = issuanceRate(m);
  assert.ok(r <= prev + 1e-15, `rate never rises (month ${m})`);
  prev = r;
}

const rows = simulate();
const s = summarise(rows);

// Nothing is "saved" during the grace period
assert.ok(Math.abs(rows[2].savedCumulative) < 1e-6, 'no savings before the phase-in starts');

// Cumulative saved is positive and in a sane band vs the reported ~11.8M
// (reported figure: ~11.8M fewer NEAR issued over the two-year phase-in).
assert.ok(s.savedByMonth27 > 0, 'cumulative saved by month 27 is positive');
assert.ok(
  s.savedByMonth27 > 6_000_000 && s.savedByMonth27 < 20_000_000,
  `cumulative saved by month 27 in sane band 6M-20M (model gives ${Math.round(s.savedByMonth27).toLocaleString('en-US')})`,
);

// Yields decline along the path
assert.ok(s.yieldAt27Pct < s.yieldStartPct, 'staking yield at month 27 below start');
assert.ok(s.yieldStartPct > 4.5 && s.yieldStartPct < 6.0, `start yield sane (model: ${s.yieldStartPct.toFixed(2)}%)`);
assert.ok(s.yieldAt27Pct > 2.8 && s.yieldAt27Pct < 3.9, `month-27 yield sane (model: ${s.yieldAt27Pct.toFixed(2)}%)`);

// Supply still grows (issuance exceeds the default burn assumption)
assert.ok(s.supplyFinal > MODEL_DEFAULTS.totalSupply, 'supply grows over the horizon under default burn');

console.log('model.test.mjs: all assertions passed');
console.log(`  start rate ${s.rateStartPct.toFixed(2)}% -> month-27 rate ${s.rateEndPct.toFixed(2)}%`);
console.log(`  cumulative NEAR not issued by month 27: ${Math.round(s.savedByMonth27).toLocaleString('en-US')}`);
console.log(`  cumulative NEAR not issued by month ${rows.length - 1}: ${Math.round(s.savedTotal).toLocaleString('en-US')}`);
console.log(`  gross staking yield: ${s.yieldStartPct.toFixed(2)}% -> ${s.yieldAt27Pct.toFixed(2)}% (month 27)`);
