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
  const W = 640; const H = 170; const P = { l: 52, r: 8, t: 8, b: 22 };
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

  // The stat grid itself is built by initGrid(): every box carries the
  // slider for its metric, bound to the scenario coupling model.
  $('scorecard').innerHTML = data.scorecard.map((c) => `
    <div class="card" data-claim="${c.id}">
      <span class="badge ${c.verdict}">${c.verdict}</span><span class="scenario-tag" hidden>under your scenario</span>
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
  initGrid(data);
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

// ------------------------------------------------------------- stat grid ---
// The dashboard grid IS the scenario model now (scenario.js): every box
// shows the fetched actual and carries the slider for its metric. Driver
// boxes (price, Intents fees, fee burn, accounts, transactions) bend the
// coupling directly; derived boxes back-solve their driver (revenue,
// annualised and share ride the fees slider; market cap rides price;
// chain fees rides transactions; revenue per account rides accounts).
// TVL and stablecoins sit outside the coupling and move only themselves.
// Moving any slider re-infers every coupled box — value AND slider
// position — at exactly the ratios printed under the grid. Inferred
// figures are tagged EST with the difference vs the actual; the actuals
// are never overwritten, and the scorecard verdicts re-grade live under
// the same stated rules.

const fmtSigned = (v) => (v == null ? 'unavailable' : `${v < 0 ? '−' : '+'}${fmtNum(Math.abs(v))}`);
const fmtUsdSmall = (v) => (v == null ? 'unavailable' : (Math.abs(v) < 10 ? `$${v.toFixed(3)}` : fmtUsd(v, 2)));

// Returns [text, class] for a box whose scenario value differs from its
// actual, or ['', 'flat'] when it matches (the line then stays hidden).
function gridDelta(inferred, actual, fmt, mode = 'pct') {
  if (inferred == null || actual == null) return ['', 'flat'];
  if (mode === 'pts') {
    const d = inferred - actual;
    if (Math.abs(d) < 0.005) return ['', 'flat'];
    return [`${d >= 0 ? '+' : ''}${d.toFixed(2)} pts vs actual ${fmt(actual)}`, d > 0 ? 'up' : 'down'];
  }
  if (actual === 0) return ['', 'flat'];
  const d = ((inferred - actual) / Math.abs(actual)) * 100;
  if (Math.abs(d) < 0.05) return ['', 'flat'];
  return [`${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs actual ${fmt(actual)}`, d > 0 ? 'up' : 'down'];
}

function initGrid(data) {
  const M = data.metrics;
  const baseline = buildBaseline(M, {
    supply: MODEL_DEFAULTS.totalSupply,
    feeBurnAnnual: MODEL_DEFAULTS.feeBurnAnnual,
  });
  const A = baseline.actuals;
  const C = baseline.couplings;
  // Scenario state: driver values, initialised to the actuals.
  const D = {
    fees: A.intentsFeesPerDay, price: A.nearPrice, burn: A.feeBurnAnnual,
    accounts: A.accounts, txns: A.txnsPerDay, tvl: M.tvlNow, stables: M.stablesNow,
  };
  const ACT = { ...D };
  let I = null; // inferred statistics for the current scenario (set by run)

  const usdDay = (v) => (v == null ? 'unavailable' : `${fmtUsd(v)}/day`);
  const pct1 = (v) => (v == null ? 'unavailable' : `${v.toFixed(1)}%`);
  const pct2yr = (v) => (v == null ? 'unavailable' : `${v.toFixed(2)}%/yr`);
  const nearYr = (v) => (v == null ? 'unavailable' : `${fmtSigned(v)} NEAR`);
  const R = {
    fees: { key: 'fees', min: 0, max: Math.ceil((A.intentsFeesPerDay * 3) / 1000) * 1000, step: 'any', aria: 'Scenario slider: Intents fees per day, USD' },
    price: { key: 'price', min: 0.25, max: 25, step: 'any', aria: 'Scenario slider: NEAR price, USD' },
    burn: { key: 'burn', min: 0, max: 10_000_000, step: 250_000, aria: 'Scenario slider: fee burn, NEAR per year' },
    accounts: { key: 'accounts', min: Math.floor((A.accounts || 0) * 0.1), max: Math.ceil((A.accounts || 0) * 3), step: 'any', aria: 'Scenario slider: total accounts (holders proxy)' },
    txns: { key: 'txns', min: 0, max: Math.ceil((A.txnsPerDay || 0) * 3), step: 'any', aria: 'Scenario slider: transactions per day' },
    tvl: { key: 'tvl', min: Math.round(M.tvlNow * 0.1), max: Math.round(M.tvlNow * 2.5), step: 'any', aria: 'Scenario slider: base-chain TVL (independent — moves only this box)' },
    stables: { key: 'stables', min: Math.round(M.stablesNow * 0.1), max: Math.round(M.stablesNow * 2.5), step: 'any', aria: 'Scenario slider: stablecoins on NEAR (independent — moves only this box)' },
  };

  const boxes = [
    { id: 'price', accent: 'gold', mode: 'pct', slider: R.price,
      label: 'NEAR price <span class="live"><span class="live-dot"></span>LIVE</span>',
      fmt: (v) => (v == null ? 'unavailable' : `$${v.toFixed(2)}`),
      value: () => D.price, actual: () => A.nearPrice,
      sub: () => `weekly chart ${fmtPct(M.priceChange1yPct)} / 1y` },
    { id: 'tvl', accent: 'blue', mode: 'pct', slider: R.tvl,
      label: 'Base-chain TVL', fmt: fmtUsd,
      value: () => D.tvl, actual: () => M.tvlNow,
      sub: () => `peak ${compact(M.tvlPeak)} · ${fmtPct(M.tvlChange1yPct)} / 1y` },
    { id: 'intents-revenue', accent: 'green', mode: 'pct', slider: R.fees,
      label: 'Intents revenue', fmt: usdDay,
      value: () => I.intentsRevenuePerDay, actual: () => A.intentsRevenuePerDay,
      sub: () => `${compact(M.intentsRevenue30dTotal)} in 30 days (actual)` },
    { id: 'chain-revenue', accent: 'teal', mode: 'pct', slider: R.fees,
      label: 'All-NEAR chain revenue', fmt: usdDay,
      value: () => I.chainRevenuePerDay, actual: () => A.chainRevenuePerDay,
      sub: () => `Intents is ${I.intentsSharePct == null ? 'n/a' : `${I.intentsSharePct.toFixed(0)}%`} of it` },
    { id: 'intents-fees', accent: 'purple', mode: 'pct', slider: R.fees,
      label: 'Intents fees', fmt: usdDay,
      value: () => D.fees, actual: () => A.intentsFeesPerDay,
      sub: () => `chain total ${compact(M.chainFees30dAvg)}/day` },
    { id: 'stables', accent: 'white', mode: 'pct', slider: R.stables,
      label: 'Stablecoins on NEAR', fmt: fmtUsd,
      value: () => D.stables, actual: () => M.stablesNow,
      sub: () => `${fmtPct(M.stablesChange1yPct)} / 1y` },
    { id: 'annualised', accent: 'orange', mode: 'pct', slider: R.fees,
      label: 'Annualised Intents revenue', fmt: fmtUsd,
      value: () => I.annualisedIntentsRevenue, actual: () => A.annualisedIntentsRevenue,
      sub: () => `${I.revenueToMarketCapPct == null ? 'n/a' : `${I.revenueToMarketCapPct.toFixed(2)}%`} of market cap / yr` },
    { id: 'market-cap', accent: 'rose', mode: 'pct', slider: R.price,
      label: 'Market cap (price x 1.31B)', fmt: fmtUsd,
      value: () => I.marketCap, actual: () => A.marketCap,
      sub: () => 'supply as reported' },
  ];
  if (A.txnsPerDay != null && C.feesPerTxn != null) {
    boxes.push({ id: 'chain-fees', accent: 'indigo', mode: 'pct', slider: R.txns,
      label: 'Chain fees', fmt: usdDay,
      value: () => I.chainFeesPerDay, actual: () => A.chainFeesPerDay,
      sub: () => `at $${C.feesPerTxn.toFixed(4)} per txn (actual)` });
  }
  boxes.push(
    { id: 'share', accent: 'mint', mode: 'pts', slider: R.fees,
      label: 'Intents share of revenue', fmt: pct1,
      value: () => I.intentsSharePct, actual: () => A.intentsSharePct,
      sub: () => 'the headline claim' },
    { id: 'rev-mcap', accent: 'amber', mode: 'pts', slider: R.fees,
      label: 'Annualised revenue / cap', fmt: pct2yr,
      value: () => I.revenueToMarketCapPct, actual: () => A.revenueToMarketCapPct,
      sub: () => 'annualised, vs the 0.5% bar' },
  );
  if (A.accounts != null) {
    boxes.push(
      { id: 'accounts', accent: 'tan', mode: 'pct', slider: R.accounts,
        label: 'Total accounts (proxy)', fmt: fmtNum,
        value: () => D.accounts, actual: () => A.accounts,
        sub: () => `NearBlocks total, as of ${M.totalAccountsAsOf}` },
      { id: 'rev-account', accent: 'sky', mode: 'pct', slider: R.accounts,
        label: 'Revenue per account / yr', fmt: fmtUsdSmall,
        value: () => I.revenuePerAccountPerYear, actual: () => A.revenuePerAccountPerYear,
        sub: () => 'chain revenue ÷ accounts' },
    );
  }
  boxes.push(
    { id: 'burn', accent: 'flame', mode: 'pct', slider: R.burn,
      label: 'Fee burn (scenario input)', fmt: (v) => (v == null ? 'unavailable' : `${fmtNum(v)} NEAR/yr`),
      value: () => D.burn, actual: () => A.feeBurnAnnual,
      sub: () => 'simulator assumption' },
    { id: 'burn-usd', accent: 'flame', mode: 'pct', slider: R.burn,
      label: 'Fee burn value / yr', fmt: fmtUsd,
      value: () => I.burnUsdPerYear, actual: () => A.feeBurnAnnual * A.nearPrice,
      sub: () => 'burn at scenario price' },
    { id: 'net-sq', accent: 'slate', mode: 'pct', slider: R.burn,
      label: 'Net supply / yr @ 2.5%', fmt: nearYr,
      value: () => I.netSupplyStatusQuoPerYear, actual: () => C.issuanceRateStatusQuo * C.supply - A.feeBurnAnnual,
      sub: () => 'issuance minus burn' },
    { id: 'net-hsp', accent: 'slate', mode: 'pct', slider: R.burn,
      label: 'Net supply / yr @ 1.6%', fmt: nearYr,
      value: () => I.netSupplyHsp029PerYear, actual: () => C.issuanceRateHsp029 * C.supply - A.feeBurnAnnual,
      sub: () => 'issuance minus burn' },
  );

  $('stats').innerHTML = boxes.map((b) => `
    <div class="stat acc-${b.accent}" data-box="${b.id}">
      <span class="k">${b.label} <span class="est-tag" data-est hidden>est</span></span>
      <span class="v" data-v></span>
      <span class="s" data-s></span>
      <span class="delta flat" data-d></span>
      <input type="range" class="box-slider" data-slider="${b.id}" min="${b.slider.min}" max="${b.slider.max}" step="${b.slider.step}" aria-label="${b.slider.aria}">
    </div>`).join('');
  for (const b of boxes) {
    b.el = document.querySelector(`[data-box="${b.id}"]`);
    b.vEl = b.el.querySelector('[data-v]');
    b.sEl = b.el.querySelector('[data-s]');
    b.dEl = b.el.querySelector('[data-d]');
    b.estEl = b.el.querySelector('[data-est]');
    b.sliderEl = b.el.querySelector('[data-slider]');
    b.sliderEl.addEventListener('input', () => { D[b.slider.key] = Number(b.sliderEl.value); run(); });
  }

  function run() {
    const { inferred, verdicts } = inferScenario(baseline, {
      intentsFeesPerDay: D.fees, nearPrice: D.price, feeBurnAnnual: D.burn,
      accounts: D.accounts, txnsPerDay: D.txns,
    });
    I = inferred;
    for (const b of boxes) {
      const v = b.value();
      const a = b.actual();
      b.vEl.textContent = b.fmt(v);
      b.sEl.textContent = b.sub();
      const [text, cls] = gridDelta(v, a, b.fmt, b.mode);
      b.dEl.textContent = text;
      b.dEl.className = `delta ${cls}`;
      b.estEl.hidden = text === '';
      // Synchrony: every slider bound to a driver sits at that driver's
      // current value, whichever box was dragged.
      b.sliderEl.value = D[b.slider.key];
    }
    for (const c of data.scorecard) {
      const card = document.querySelector(`.card[data-claim="${c.id}"]`);
      if (!card) continue;
      const found = verdicts.find((x) => x.id === c.id);
      const verdict = found ? found.verdict : c.verdict;
      const badge = card.querySelector('.badge');
      badge.className = `badge ${verdict}`;
      badge.textContent = verdict;
      const differs = verdict !== c.verdict;
      card.classList.toggle('differs', differs);
      card.querySelector('.scenario-tag').hidden = !differs;
    }
  }

  const resetBtn = $('grid-reset');
  if (resetBtn && !initGrid.resetAttached) {
    resetBtn.addEventListener('click', () => { Object.assign(D, ACT); run(); });
    initGrid.resetAttached = true;
  }

  $('grid-couplings').textContent =
    `Couplings — Intents revenue = Intents fees × ${C.revenuePerFee == null ? 'n/a' : C.revenuePerFee.toFixed(4)} ` +
    `(actual ratio: ${fmtUsd(A.intentsRevenuePerDay)}/day revenue on ${fmtUsd(A.intentsFeesPerDay)}/day fees, 30d avg). ` +
    `All-chain revenue adds the non-Intents remainder, held at its actual ${fmtUsd(C.nonIntentsRevenuePerDay)}/day. ` +
    `Annualised = daily × 365. Market cap = price × ${fmtNum(C.supply)} NEAR (supply as reported). ` +
    (C.feesPerTxn != null
      ? `Chain fees = $${C.feesPerTxn.toFixed(4)}/transaction (actual ${fmtUsd(A.chainFeesPerDay)}/day over ${fmtNum(A.txnsPerDay)} txns/day, NearBlocks 30d avg, ${M.txnsWindowStart} to ${M.txnsAsOfDate}) × scenario txns/day. `
      : '') +
    (A.accounts != null
      ? `Revenue per account = annualised chain revenue ÷ ${fmtNum(A.accounts)} total accounts (NearBlocks, new minus deleted since genesis, as of ${M.totalAccountsAsOf}) — a holders proxy: every account ever created, not just wallets holding a balance. `
      : '') +
    `Net supply change = issuance (${fmtNum(C.issuanceRateStatusQuo * C.supply)} NEAR/yr at 2.5%, ${fmtNum(C.issuanceRateHsp029 * C.supply)} at the 1.6% HSP-029 rate) minus burn. ` +
    `The burn anchor, ${fmtNum(A.feeBurnAnnual)} NEAR/yr, is the simulator's stated assumption, not a measurement. ` +
    `TVL and stablecoins are uncoupled: their sliders bend only their own box. Reset returns every slider to the fetched actuals.`;

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
