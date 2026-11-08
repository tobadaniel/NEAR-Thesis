// Checks that the built single-file bundle ships the in-grid scenario
// system (sliders inside the stat boxes, lab section deleted, per-stat
// accent colours, LIVE dot). Behavioural checks (synchrony, verdict
// re-grade, reset, page height) live in verification/check-cdp.mjs.
// Run after the build: node build-single.mjs && npm test

import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const distPath = new URL('../dist/near-thesis.html', import.meta.url);
assert.ok(existsSync(distPath), 'dist/near-thesis.html exists — run: node build-single.mjs');

const html = readFileSync(distPath, 'utf8');

// The Scenario Lab section is gone, for good.
assert.ok(!html.includes('id="scenario-lab"'), 'dist has no Scenario Lab section');
assert.ok(!html.includes('id="lab-fees"'), 'dist has no lab driver sliders');
assert.ok(!html.includes('id="lab-stats"'), 'dist has no lab stat grid');
assert.ok(!html.includes('id="lab-verdicts"'), 'dist has no second scorecard');

// The scenario lives in the dashboard grid now.
assert.ok(html.includes('id="grid-reset"'), 'dist contains the grid reset button');
assert.ok(html.includes('id="grid-couplings"'), 'dist contains the coupling note');
assert.ok(html.includes('class="box-slider"') || html.includes('box-slider'), 'dist ships box sliders');
const sliderCount = (html.match(/data-slider=/g) || []).length;
assert.ok(sliderCount >= 1, 'dist renders slider bindings');
// The per-box templates are JS-generated; assert the box definitions exist.
for (const id of ['price', 'tvl', 'intents-revenue', 'chain-revenue', 'intents-fees',
  'stables', 'annualised', 'market-cap', 'chain-fees', 'share', 'rev-mcap',
  'accounts', 'rev-account', 'burn', 'burn-usd', 'net-sq', 'net-hsp']) {
  assert.ok(html.includes(`id: '${id}'`), `dist defines the ${id} box`);
}

// Per-stat accent colours are defined per theme.
for (const cls of ['acc-gold', 'acc-blue', 'acc-green', 'acc-teal', 'acc-purple',
  'acc-white', 'acc-orange', 'acc-rose', 'acc-mint', 'acc-amber', 'acc-indigo',
  'acc-tan', 'acc-sky', 'acc-flame', 'acc-slate']) {
  assert.ok(html.includes(`.${cls}`), `dist defines .${cls}`);
  assert.ok(html.includes(`[data-theme="light"] .${cls}`), `dist defines the light variant of .${cls}`);
}

// LIVE indicator: red word + pulsing dot.
assert.ok(html.includes('live-dot'), 'dist contains the LIVE dot element');
assert.ok(html.includes('@keyframes live-pulse'), 'dist contains the LIVE pulse animation');
assert.ok(html.includes('class="live"'), 'dist contains the LIVE label');

console.log('grid.test.mjs: all assertions passed');
