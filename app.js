// app.js — renders the dashboard from data.json (or the inlined
// window.__NEAR_DATA__ in the single-file build) and drives the HSP-029
// simulator with model.js. No libraries; charts are inline SVG.

import { simulate, summarise, MODEL_DEFAULTS } from './model.js';
import { buildBaseline, inferScenario } from './scenario.js';

const $ = (id) => document.getElementById(id);
const fmtUsd = (v, d = 0) => (v == null ? 'unavailable' : `$${v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const fmtNum = (v) => (v == null ? 'unavailable' : Math.round(v).toLocaleString('en-US'));
const fmtPct = (v, d = 1) => (v == null ? 'unavailable' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const compact = (v) => {
  if (v == null) return 'n/a';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return v.toFixed(0);
};

// ----------------------------------------------------------------- theme ---
// The active theme lives in <html data-theme="dark|light">, set before
// first paint by the inline script in index.html (stored choice, else the
// OS preference, with a ?theme= override). CSS colours come from the
// theme variables in style.css; the SVG chart strokes are passed in as
// strings, so they are read back out of those same variables here.

const THEME_KEY = 'near-thesis-theme';
let currentData = null; // last rendered dataset, for chart redraws
let simRedraw = null;   // simulator's run(), once initialised

function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  return {
    blue: get('--chart-blue'), accent: get('--chart-accent'),
    amber: get('--chart-amber'), purple: get('--chart-purple'),
    green: get('--chart-green'),
  };
}

function syncToggleLabel() {
  const btn = $('theme-toggle');
  if (!btn) return;
  const light = document.documentElement.dataset.theme === 'light';
  btn.textContent = light ? '🌙 Dark' : '☀️ Light';
  btn.setAttribute('aria-pressed', String(light));
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  if (persist) {
    try { localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme); } catch (e) { /* storage unavailable */ }
  }
  syncToggleLabel();
  if (currentData) drawDataCharts(currentData);
  if (simRedraw) simRedraw();
}

// ------------------------------------------------------------ SVG charts ---

// seriesList: [{data: [{t, v}], color, label}]
function lineChart(el, seriesList, fmtY = compact, xFmt = dateOf) {
  const all = seriesList.flatMap((s) => s.data);
  if (!all.length) { el.innerHTML = '<p class="unavailable">unavailable — series could not be fetched at build time</p>'; return; }
  const W = 640; const H = 200; const P = { l: 52, r: 8, t: 8, b: 22 };
  const vs = all.map((p) => p.v);
  let min = Math.min(...vs); let max = Math.max(...vs);
  if (min === max) { min *= 0.9; max *= 1.1; }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const t0 = Math.min(...all.map((p) => p.t)); const t1 = Math.max(...all.map((p) => p.t));
  const X = (t) => P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let i = 0; i <= 3; i++) {
    const y = P.t + (i / 3) * (H - P.t - P.b);
    const val = max - (i / 3) * (max - min);
    svg += `<line class="grid" x1="${P.l}" y1="${y}" x2="${W - P.r}" y2="${y}"/><text class="axis" x="2" y="${y + 3}">${fmtY(val)}</text>`;
  }
  svg += `<text class="axis" x="${P.l}" y="${H - 6}">${xFmt(t0)}</text><text class="axis" x="${W - P.r - 62}" y="${H - 6}">${xFmt(t1)}</text>`;
  for (const s of seriesList) {
    if (!s.data.length) continue;
    const pts = s.data.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
    svg += `<polyline fill="none" stroke="${s.color}" stroke-width="1.8" points="${pts}"/>`;
  }
  svg += '</svg>';
  el.innerHTML = svg;
}

// ---------------------------------------------------------------- render ---

function stat(label, value, sub = '') {
  return `<div class="stat"><span class="k">${label}</span><span class="v">${value}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>`;
}

// The five data charts, factored out so a theme switch can redraw them
// with the new theme's colours without re-rendering the whole page.
function drawDataCharts(data) {
  const M = data.metrics;
  const S = data.series;
  const C = chartColors();
  const cap = (id, title, source, asOfT) => {
    $(id).innerHTML = `<b>${title}</b> — source: ${source}${asOfT ? ` · as of ${dateOf(asOfT)}` : ''}`;
  };
  cap('cap-tvl', 'NEAR base-chain TVL, USD', 'DefiLlama /v2/historicalChainTvl/Near', M.tvlAsOf);
  lineChart($('chart-tvl'), [{ data: S.tvl, color: C.blue }], (v) => `$${compact(v)}`);
  cap('cap-revenue', 'Daily revenue, USD — NEAR Intents vs all NEAR chain protocols', 'DefiLlama fees/revenue summaries');
  lineChart($('chart-revenue'), [
    { data: S.intentsRevenue, color: C.accent },
    { data: S.chainRevenue, color: C.amber },
  ], (v) => `$${compact(v)}`);
  cap('cap-fees', 'Daily fees, USD — NEAR Intents vs all NEAR chain protocols', 'DefiLlama fees summaries');
  lineChart($('chart-fees'), [
    { data: S.intentsFees, color: C.accent },
    { data: S.chainFees, color: C.amber },
  ], (v) => `$${compact(v)}`);
  cap('cap-price', 'NEAR price, USD (weekly)', 'DefiLlama coins chart, coingecko:near', M.priceAsOf);
  lineChart($('chart-price'), [{ data: S.price, color: C.purple }], (v) => `$${v.toFixed(1)}`);
  cap('cap-stables', 'Stablecoin supply on NEAR, USD', 'DefiLlama stablecoins, chain Near', M.stablesAsOf);
  lineChart($('chart-stables'), [{ data: S.stables, color: C.green }], (v) => `$${compact(v)}`);
}

function render(data) {
  currentData = data;
  const M = data.metrics;
  const S = data.series;
  $('asof').textContent = `Data fetched ${data.fetchedAt.replace('T', ' ').slice(0, 19)} UTC · sources listed at the bottom · rebuild: node build-data.mjs`;

  $('stats').innerHTML = [
    stat('NEAR price (live)', M.priceCurrent == null ? 'unavailable' : `$${M.priceCurrent.toFixed(2)}`, `weekly chart ${fmtPct(M.priceChange1yPct)} / 1y`),
    stat('Base-chain TVL', fmtUsd(M.tvlNow), `peak ${fmtUsd(M.tvlPeak)} · ${fmtPct(M.tvlChange1yPct)} / 1y`),
    stat('Intents revenue, 30d avg', fmtUsd(M.intentsRevenue30dAvg) + '/day', `${fmtUsd(M.intentsRevenue30dTotal)} in 30 days`),
    stat('All-NEAR chain revenue, 30d avg', fmtUsd(M.chainRevenue30dAvg) + '/day', `Intents is ${M.intentsShareOfChainRevenuePct == null ? 'n/a' : M.intentsShareOfChainRevenuePct.toFixed(0) + '%'} of it`),
    stat('Intents fees, 30d avg', fmtUsd(M.intentsFees30dAvg) + '/day', `chain fees total ${fmtUsd(M.chainFees30dAvg)}/day`),
    stat('Stablecoins on NEAR', fmtUsd(M.stablesNow), `${fmtPct(M.stablesChange1yPct)} / 1y`),
    stat('Annualised Intents revenue', fmtUsd(M.annualisedRevenue), `${M.revenueToMarketCapPct == null ? 'n/a' : M.revenueToMarketCapPct.toFixed(2) + '%'} of market cap / yr`),
    stat('Market cap (price x 1.31B)', fmtUsd(M.marketCap), 'supply as reported, see THESIS.md'),
  ].join('');

  $('scorecard').innerHTML = data.scorecard.map((c) => `
    <div class="card">
      <span class="badge ${c.verdict}">${c.verdict}</span>
      <p class="claim">${c.claim}</p>
      <p class="evidence">${c.evidence}</p>
    </div>`).join('');

  drawDataCharts(data);

  const rpc = M.rpc || {};
  $('rpc').innerHTML = [
    stat('Block height', fmtNum(rpc.blockHeight), `latest block ${rpc.latestBlockTime ? rpc.latestBlockTime.slice(0, 19).replace('T', ' ') + ' UTC' : ''}`),
    stat('Current validators', fmtNum(rpc.validatorCount), 'from RPC validators call'),
    stat('Node version', rpc.nodeVersion || 'unavailable', 'public RPC endpoint'),
  ].join('');

  $('sources').innerHTML = data.sources.map((s) =>
    `<li><span class="${s.ok ? 'ok' : 'fail'}">${s.ok ? 'OK' : 'FAILED'}</span> ${s.name} — <span class="mono">${s.url}</span> · fetched ${s.fetchedAt.replace('T', ' ').slice(0, 19)} UTC${s.error ? ` · ${s.error}` : ''}</li>`).join('');

  const R = data.reported.hsp029;
  $('sim-reported').textContent = `As reported for comparison (not model output): ${R.reportedFewerIssued}; projected yield ${R.reportedYieldPath}; passed with ${R.veNearInFavour} in favour (${R.supportPct} support); split kept at ${R.splitKept}; ${R.grace}; phase-in ${R.phaseIn}.`;

  initSimulator();
  initLab(data);
}

// ------------------------------------------------------------- simulator ---

function initSimulator() {
  const inStaking = $('in-staking'); const inBurn = $('in-burn'); const inSupply = $('in-supply');
  inStaking.value = MODEL_DEFAULTS.stakingRatio;
  inBurn.value = MODEL_DEFAULTS.feeBurnAnnual;
  inSupply.value = MODEL_DEFAULTS.totalSupply;

  function run() {
    const stakingRatio = Number(inStaking.value);
    const feeBurnAnnual = Number(inBurn.value);
    const totalSupply = Number(inSupply.value);
    $('v-staking').textContent = `${(stakingRatio * 100).toFixed(0)}%`;
    $('v-burn').textContent = `${fmtNum(feeBurnAnnual)} NEAR`;
    $('v-supply').textContent = `${(totalSupply / 1e9).toFixed(2)}B NEAR`;
    const rows = simulate({ stakingRatio, feeBurnAnnual, totalSupply, months: 60 });
    const s = summarise(rows);
    $('sim-stats').innerHTML = [
      stat('Issuance rate path', `${s.rateStartPct.toFixed(2)}% → ${s.rateEndPct.toFixed(2)}%`, 'month 0 → month 27 (grace + phase-in)'),
      stat('NEAR not issued by month 27', fmtNum(s.savedByMonth27), 'vs status quo at 2.5%'),
      stat('NEAR not issued by month 59', fmtNum(s.savedTotal), 'cumulative, 5-year horizon'),
      stat('Gross staking yield path', `${s.yieldStartPct.toFixed(2)}% → ${s.yieldAt27Pct.toFixed(2)}%`, 'month 0 → month 27, at this staking ratio'),
      stat('Supply at month 59', `${(s.supplyFinal / 1e9).toFixed(3)}B`, 'after issuance minus assumed burn'),
    ].join('');
    const C = chartColors();
    const rateSeries = rows.map((r) => ({ t: r.month, v: r.ratePct }));
    const savedSeries = rows.map((r) => ({ t: r.month, v: r.savedCumulative }));
    lineChart($('chart-rate'), [{ data: rateSeries, color: C.accent }], (v) => `${v.toFixed(1)}%`, (t) => `month ${t}`);
    lineChart($('chart-saved'), [{ data: savedSeries, color: C.blue }], (v) => `${compact(v)}`, (t) => `month ${t}`);
  }
  simRedraw = run;
  if (!initSimulator.attached) {
    for (const el of [inStaking, inBurn, inSupply]) el.addEventListener('input', run);
    initSimulator.attached = true;
  }
  run();
}

// ---------------------------------------------------------- scenario lab ---
// A clearly separated model (scenario.js): the actuals rendered above are
// never touched. Sliders bend driver inputs; the coupled statistics are
// re-inferred at the actual ratios and shown next to their actual values.

function deltaHtml(inferred, actual, mode = 'pct') {
  if (inferred == null || actual == null) return '<span class="delta flat">no actual to compare</span>';
  if (mode === 'pts') {
    const d = inferred - actual;
    if (Math.abs(d) < 0.005) return '<span class="delta flat">matches actual</span>';
    return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d.toFixed(2)} pts vs actual</span>`;
  }
  if (actual === 0) return '<span class="delta flat">actual is 0</span>';
  const d = ((inferred - actual) / Math.abs(actual)) * 100;
  if (Math.abs(d) < 0.05) return '<span class="delta flat">matches actual</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs actual</span>`;
}

function estStat(label, inferredText, actualText, inferred, actual, mode = 'pct', sub = '') {
  return `<div class="stat est"><span class="k">${label} <span class="est-tag">est</span></span>` +
    `<span class="v">${inferredText}</span>` +
    `<span class="s">actual ${actualText}</span>` +
    `${deltaHtml(inferred, actual, mode)}${sub ? `<span class="s">${sub}</span>` : ''}</div>`;
}

function initLab(data) {
  const M = data.metrics;
  const baseline = buildBaseline(M, {
    supply: MODEL_DEFAULTS.totalSupply,
    feeBurnAnnual: MODEL_DEFAULTS.feeBurnAnnual,
  });
  const A = baseline.actuals;
  const C = baseline.couplings;
  const els = {
    fees: $('lab-fees'), price: $('lab-price'), burn: $('lab-burn'),
    accounts: $('lab-accounts'), txns: $('lab-txns'),
  };
  const setRange = (el, min, max, value, step) => {
    if (!el) return;
    if (value == null) { const lab = el.closest('label'); if (lab) lab.style.display = 'none'; return; }
    el.min = min; el.max = max;
    // step "any" where the actual is not on a round grid, so the slider
    // rests exactly on the actual value (identity: no bend, no delta).
    if (step != null) el.step = step;
    el.value = value;
  };
  setRange(els.fees, 0, Math.ceil((A.intentsFeesPerDay * 3) / 1000) * 1000, A.intentsFeesPerDay, 'any');
  setRange(els.price, 0.25, 25, A.nearPrice, 'any');
  setRange(els.burn, 0, 10_000_000, A.feeBurnAnnual, 250_000);
  setRange(els.accounts, Math.floor(A.accounts * 0.1), Math.ceil(A.accounts * 3), A.accounts, 'any');
  setRange(els.txns, 0, Math.ceil(A.txnsPerDay * 3), A.txnsPerDay, 'any');

  const fmtUsdSmall = (v) => (v == null ? 'unavailable' : (Math.abs(v) < 10 ? `$${v.toFixed(3)}` : fmtUsd(v, 2)));
  const fmtSigned = (v) => (v == null ? 'unavailable' : `${v < 0 ? '−' : '+'}${fmtNum(Math.abs(v))}`);

  function run() {
    const drivers = {
      intentsFeesPerDay: Number(els.fees.value),
      nearPrice: Number(els.price.value),
      feeBurnAnnual: Number(els.burn.value),
      accounts: A.accounts == null ? null : Number(els.accounts.value),
      txnsPerDay: A.txnsPerDay == null ? null : Number(els.txns.value),
    };
    $('lab-v-fees').textContent = fmtUsd(drivers.intentsFeesPerDay) + '/day';
    $('lab-v-price').textContent = `$${drivers.nearPrice.toFixed(2)}`;
    $('lab-v-burn').textContent = `${fmtNum(drivers.feeBurnAnnual)} NEAR`;
    if (A.accounts != null) $('lab-v-accounts').textContent = fmtNum(drivers.accounts);
    if (A.txnsPerDay != null) $('lab-v-txns').textContent = `${fmtNum(drivers.txnsPerDay)}/day`;

    const { inferred, verdicts } = inferScenario(baseline, drivers);
    const I = inferred;
    const cards = [
      estStat('Intents revenue / day', fmtUsd(I.intentsRevenuePerDay) + '/day', fmtUsd(A.intentsRevenuePerDay) + '/day', I.intentsRevenuePerDay, A.intentsRevenuePerDay),
      estStat('All-chain revenue / day', fmtUsd(I.chainRevenuePerDay) + '/day', fmtUsd(A.chainRevenuePerDay) + '/day', I.chainRevenuePerDay, A.chainRevenuePerDay),
      estStat('Intents share of chain revenue', I.intentsSharePct == null ? 'unavailable' : `${I.intentsSharePct.toFixed(1)}%`, A.intentsSharePct == null ? 'unavailable' : `${A.intentsSharePct.toFixed(1)}%`, I.intentsSharePct, A.intentsSharePct, 'pts'),
      estStat('Annualised Intents revenue', fmtUsd(I.annualisedIntentsRevenue), fmtUsd(A.annualisedIntentsRevenue), I.annualisedIntentsRevenue, A.annualisedIntentsRevenue),
      estStat('Market cap', fmtUsd(I.marketCap), fmtUsd(A.marketCap), I.marketCap, A.marketCap),
      estStat('Annualised revenue / market cap', I.revenueToMarketCapPct == null ? 'unavailable' : `${I.revenueToMarketCapPct.toFixed(2)}%/yr`, A.revenueToMarketCapPct == null ? 'unavailable' : `${A.revenueToMarketCapPct.toFixed(2)}%/yr`, I.revenueToMarketCapPct, A.revenueToMarketCapPct, 'pts'),
    ];
    if (I.chainFeesPerDay != null) {
      cards.push(estStat('Chain fees / day', fmtUsd(I.chainFeesPerDay) + '/day', fmtUsd(A.chainFeesPerDay) + '/day', I.chainFeesPerDay, A.chainFeesPerDay, 'pct', 'at the actual fee per transaction'));
    }
    if (I.revenuePerAccountPerYear != null) {
      cards.push(estStat('Chain revenue per account / yr', fmtUsdSmall(I.revenuePerAccountPerYear), fmtUsdSmall(A.revenuePerAccountPerYear), I.revenuePerAccountPerYear, A.revenuePerAccountPerYear));
    }
    cards.push(estStat('Fee burn value / yr', fmtUsd(I.burnUsdPerYear), fmtUsd(A.feeBurnAnnual * A.nearPrice), I.burnUsdPerYear, A.feeBurnAnnual * A.nearPrice, 'pct', 'burn priced at the scenario NEAR price'));
    cards.push(estStat('Net supply change / yr @ 2.5%', `${fmtSigned(I.netSupplyStatusQuoPerYear)} NEAR`, `${fmtSigned(A ? (C.issuanceRateStatusQuo * C.supply - A.feeBurnAnnual) : null)} NEAR`, I.netSupplyStatusQuoPerYear, C.issuanceRateStatusQuo * C.supply - A.feeBurnAnnual, 'pct', 'status-quo issuance minus burn'));
    cards.push(estStat('Net supply change / yr @ 1.6%', `${fmtSigned(I.netSupplyHsp029PerYear)} NEAR`, `${fmtSigned(C.issuanceRateHsp029 * C.supply - A.feeBurnAnnual)} NEAR`, I.netSupplyHsp029PerYear, C.issuanceRateHsp029 * C.supply - A.feeBurnAnnual, 'pct', 'HSP-029 rate (phased in) minus burn'));
    $('lab-stats').innerHTML = cards.join('');

    $('lab-verdicts').innerHTML = data.scorecard.map((c) => {
      const v = verdicts.find((x) => x.id === c.id);
      const verdict = v ? v.verdict : c.verdict;
      const differs = verdict !== c.verdict;
      return `<div class="card${differs ? ' differs' : ''}">
        <span class="badge ${verdict}">${verdict}</span>${differs ? '<span class="scenario-tag">under your scenario</span>' : ''}
        <p class="claim">${c.claim}</p>
      </div>`;
    }).join('');
  }

  if (!initLab.attached) {
    for (const el of Object.values(els)) if (el) el.addEventListener('input', run);
    $('lab-reset').addEventListener('click', () => {
      els.fees.value = A.intentsFeesPerDay;
      els.price.value = A.nearPrice;
      els.burn.value = A.feeBurnAnnual;
      if (A.accounts != null) els.accounts.value = A.accounts;
      if (A.txnsPerDay != null) els.txns.value = A.txnsPerDay;
      run();
    });
    initLab.attached = true;
  }

  $('lab-couplings').textContent =
    `How this model couples things — Intents revenue = Intents fees × ${C.revenuePerFee == null ? 'n/a' : C.revenuePerFee.toFixed(4)} ` +
    `(the actual ratio: ${fmtUsd(A.intentsRevenuePerDay)}/day of revenue on ${fmtUsd(A.intentsFeesPerDay)}/day of fees, 30d avg). ` +
    `All-chain revenue adds the non-Intents remainder, held at its actual ${fmtUsd(C.nonIntentsRevenuePerDay)}/day. ` +
    `Annualised = daily × 365. Market cap = price × ${fmtNum(C.supply)} NEAR supply (as reported — the same supply behind the dashboard's market cap). ` +
    (C.feesPerTxn != null
      ? `Chain fees = $${C.feesPerTxn.toFixed(4)} per transaction (actual ${fmtUsd(A.chainFeesPerDay)}/day over ${fmtNum(A.txnsPerDay)} transactions/day, NearBlocks 30d avg, ${M.txnsWindowStart} to ${M.txnsAsOfDate}) × your transactions/day. `
      : '') +
    (A.accounts != null
      ? `Revenue per account divides annualised chain revenue by total accounts: ${fmtNum(A.accounts)} (NearBlocks daily charts — new minus deleted accounts since genesis, as of ${M.totalAccountsAsOf}). That is a holders proxy: it counts every account ever created, not just wallets holding a balance. `
      : '') +
    `Net supply change = issuance (${fmtNum(C.issuanceRateStatusQuo * C.supply)} NEAR/yr at the 2.5% status quo, ${fmtNum(C.issuanceRateHsp029 * C.supply)} at the 1.6% HSP-029 rate) minus fee burn. ` +
    `The burn anchor, ${fmtNum(A.feeBurnAnnual)} NEAR/yr, is the HSP-029 simulator's stated assumption, not a measurement. Nothing in this lab overwrites the actuals above.`;

  run();
}

// ------------------------------------------------------------------ main ---

async function main() {
  let data = window.__NEAR_DATA__ || null;
  if (!data) {
    try {
      const res = await fetch('data.json');
      data = await res.json();
    } catch (err) {
      $('asof').textContent = 'Could not load data.json — run: node build-data.mjs';
      return;
    }
  }
  render(data);
}

const toggleBtn = $('theme-toggle');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
}
syncToggleLabel();

main();
