// app.js — renders the dashboard from data.json (or the inlined
// window.__NEAR_DATA__ in the single-file build) and drives the HSP-029
// simulator with model.js. No libraries; charts are inline SVG.

import { simulate, summarise, MODEL_DEFAULTS } from './model.js';

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
