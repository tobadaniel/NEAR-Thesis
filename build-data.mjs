// build-data.mjs — pulls every number on the dashboard from free,
// no-key public APIs and writes data.json. Run: node build-data.mjs
//
// IRON RULE: a number that cannot be fetched or computed is recorded as
// unavailable (null in data.json, "unavailable" on the dashboard and in
// THESIS.md). Nothing is estimated silently; the only modelled numbers
// are the HSP-029 simulator outputs in model.js, labelled as a model.

const FETCHED_AT = new Date().toISOString();
const sources = [];

async function fetchJson(name, url, opts = {}) {
  const started = new Date().toISOString();
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(45000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    sources.push({ name, url, ok: true, fetchedAt: started });
    return json;
  } catch (err) {
    sources.push({ name, url, ok: false, fetchedAt: started, error: String(err.message || err) });
    console.error(`FAILED  ${name}: ${err.message || err}`);
    return null;
  }
}

function rpc(name, method, params) {
  return fetchJson(name, 'https://rpc.mainnet.near.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
  }).then((j) => (j && j.result ? j.result : null));
}

// ------------------------------------------------------------ utilities ---

function downsample(series, maxPoints = 900) {
  if (!series || series.length <= maxPoints) return series || [];
  const stride = Math.ceil(series.length / maxPoints);
  return series.filter((_, i) => i % stride === 0 || i === series.length - 1);
}

// series: [{t: unixSeconds, v: number}] sorted ascending
function lastValue(s) { return s && s.length ? s[s.length - 1].v : null; }
function lastTime(s) { return s && s.length ? s[s.length - 1].t : null; }
function valueDaysAgo(s, days) {
  if (!s || !s.length) return null;
  const target = s[s.length - 1].t - days * 86400;
  let best = null;
  for (const p of s) { if (p.t <= target) best = p; else break; }
  return best ? best.v : s[0].v;
}
function pctChange(s, days) {
  const now = lastValue(s); const then = valueDaysAgo(s, days);
  if (now == null || then == null || then === 0) return null;
  return ((now - then) / then) * 100;
}
function avgLastDays(s, days) {
  if (!s || !s.length) return null;
  const cutoff = s[s.length - 1].t - days * 86400;
  const pts = s.filter((p) => p.t > cutoff);
  if (!pts.length) return null;
  return pts.reduce((a, p) => a + p.v, 0) / pts.length;
}
// Average over the window [endDaysAgo, startDaysAgo] days before the last
// point (e.g. avgWindow(s, 455, 365) = the 90 days centred a year ago).
function avgWindowDaysAgo(s, startDaysAgo, endDaysAgo) {
  if (!s || !s.length) return null;
  const last = s[s.length - 1].t;
  const pts = s.filter((p) => p.t <= last - endDaysAgo * 86400 && p.t > last - startDaysAgo * 86400);
  if (!pts.length) return null;
  return pts.reduce((a, p) => a + p.v, 0) / pts.length;
}
function peakValue(s) { return s && s.length ? Math.max(...s.map((p) => p.v)) : null; }
function sumLastDays(s, days) {
  const avg = avgLastDays(s, days);
  return avg == null ? null : avg * days;
}

// --------------------------------------------------------------- fetches ---

const LLAMA = 'https://api.llama.fi';

// 1. NEAR chain TVL history
const tvlRaw = await fetchJson('DefiLlama historical TVL, chain Near',
  `${LLAMA}/v2/historicalChainTvl/Near`);
const tvl = downsample((tvlRaw || []).map((p) => ({ t: p.date, v: p.tvl })));

// 2. NEAR chain fees (daily, USD)
const chainFeesRaw = await fetchJson('DefiLlama chain fees, Near (dailyFees)',
  `${LLAMA}/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`);
const chainFees = downsample(((chainFeesRaw && chainFeesRaw.totalDataChart) || []).map(([t, v]) => ({ t, v })));

// 3. NEAR chain revenue (daily, USD)
const chainRevRaw = await fetchJson('DefiLlama chain revenue, Near (dailyRevenue)',
  `${LLAMA}/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue`);
const chainRevenue = downsample(((chainRevRaw && chainRevRaw.totalDataChart) || []).map(([t, v]) => ({ t, v })));

// 4+5. NEAR Intents fees and revenue (daily, USD) — the /overview/ variant
// of this endpoint returns HTTP 500, so the /summary/ variant is used.
const intentsFeesRaw = await fetchJson('DefiLlama NEAR Intents fees (dailyFees)',
  `${LLAMA}/summary/fees/near-intents?dataType=dailyFees`);
const intentsFees = downsample(((intentsFeesRaw && intentsFeesRaw.totalDataChart) || []).map(([t, v]) => ({ t, v })));
const intentsRevRaw = await fetchJson('DefiLlama NEAR Intents revenue (dailyRevenue)',
  `${LLAMA}/summary/fees/near-intents?dataType=dailyRevenue`);
const intentsRevenue = downsample(((intentsRevRaw && intentsRevRaw.totalDataChart) || []).map(([t, v]) => ({ t, v })));

// 6. Stablecoin supply on NEAR (USD)
const stablesRaw = await fetchJson('DefiLlama stablecoin supply, chain Near',
  'https://stablecoins.llama.fi/stablecoincharts/Near');
const stables = downsample((stablesRaw || []).map((p) => {
  const v = (p.totalCirculatingUSD && p.totalCirculatingUSD.peggedUSD)
    ?? (p.totalCirculating && p.totalCirculating.peggedUSD) ?? null;
  return v == null ? null : { t: p.date, v };
}).filter(Boolean));

// 7. NEAR price history (DefiLlama coins API). Working parameter shape
// (verified at build time): start=<unix>, span=<point count>,
// period=<seconds between points>. period=2y / period=1y return HTTP 400.
const priceStart = Math.floor(Date.now() / 1000) - 2 * 365 * 86400;
let priceRaw = await fetchJson('DefiLlama coins price chart, NEAR 2y weekly',
  `https://coins.llama.fi/chart/coingecko:near?start=${priceStart}&span=104&period=604800`);
if (!priceRaw || !priceRaw.coins) {
  priceRaw = await fetchJson('DefiLlama coins current price, NEAR (fallback)',
    'https://coins.llama.fi/prices/current/coingecko:near');
  if (priceRaw && priceRaw.coins && priceRaw.coins['coingecko:near']) {
    const c = priceRaw.coins['coingecko:near'];
    priceRaw = { coins: { 'coingecko:near': { prices: [{ timestamp: c.timestamp, price: c.price }] } } };
  }
}
const priceCoin = priceRaw && priceRaw.coins ? priceRaw.coins['coingecko:near'] : null;
const price = downsample(((priceCoin && priceCoin.prices) || []).map((p) => ({ t: p.timestamp, v: p.price })));

// 7b. Current price (the weekly chart's last point can lag by days, so
// "now" figures — market cap, revenue/market-cap — use this endpoint).
const priceCurrentRaw = await fetchJson('DefiLlama coins current price, NEAR',
  'https://coins.llama.fi/prices/current/coingecko:near');
const priceCurrentCoin = priceCurrentRaw && priceCurrentRaw.coins ? priceCurrentRaw.coins['coingecko:near'] : null;

// 8. NEAR public RPC: chain status + validators
const rpcStatus = await rpc('NEAR RPC status', 'status', []);
const rpcValidators = await rpc('NEAR RPC validators', 'validators', [null]);
const rpcInfo = {
  blockHeight: rpcStatus && rpcStatus.sync_info ? rpcStatus.sync_info.latest_block_height : null,
  latestBlockTime: rpcStatus && rpcStatus.sync_info ? rpcStatus.sync_info.latest_block_time : null,
  validatorCount: rpcValidators && rpcValidators.current_validators ? rpcValidators.current_validators.length : null,
  epochLength: rpcValidators ? (rpcValidators.epoch_length ?? null) : null,
  nodeVersion: rpcStatus && rpcStatus.version ? rpcStatus.version.version : null,
};

// --------------------------------------------------------------- metrics ---

const metrics = {
  tvlNow: lastValue(tvl),
  tvlPeak: peakValue(tvl),
  tvlChange1yPct: pctChange(tvl, 365),
  tvlAsOf: lastTime(tvl),
  priceNow: lastValue(price),
  priceChange1yPct: pctChange(price, 365),
  priceAsOf: lastTime(price),
  priceCurrent: priceCurrentCoin ? priceCurrentCoin.price : null,
  priceCurrentAt: priceCurrentCoin ? priceCurrentCoin.timestamp : null,
  stablesNow: lastValue(stables),
  stablesChange1yPct: pctChange(stables, 365),
  stablesAsOf: lastTime(stables),
  chainFees30dAvg: avgLastDays(chainFees, 30),
  chainRevenue30dAvg: avgLastDays(chainRevenue, 30),
  chainRevenue30dTotal: sumLastDays(chainRevenue, 30),
  intentsFees30dAvg: avgLastDays(intentsFees, 30),
  intentsRevenue30dAvg: avgLastDays(intentsRevenue, 30),
  intentsRevenue30dTotal: sumLastDays(intentsRevenue, 30),
  intentsRevenueEarly90dAvg: null, // first 90 recorded days (see below)
  intentsRevenueEarlyWindowStart: null,
  intentsRevenueLast90dAvg: null,
  intentsShareOfChainRevenuePct: null,
  annualisedRevenue: null,
  marketCap: null,
  revenueToMarketCapPct: null,
  rpc: rpcInfo,
};

if (intentsRevenue.length) {
  // DefiLlama's Intents revenue adapter records ~$0/day until late
  // Oct 2025, so a first-vs-last or year-ago comparison would compare
  // against adapter ramp-up, not business reality. Instead: the "early
  // window" is the first 90 days starting when the trailing-30d average
  // first reaches $1,000/day. Compare that with the last 90 days.
  let startIdx = -1;
  for (let i = 29; i < intentsRevenue.length; i++) {
    const trail = intentsRevenue.slice(i - 29, i + 1).reduce((a, p) => a + p.v, 0) / 30;
    if (trail >= 1000) { startIdx = i - 29; break; }
  }
  if (startIdx >= 0) {
    const early = intentsRevenue.slice(startIdx, startIdx + 90);
    metrics.intentsRevenueEarly90dAvg = early.reduce((a, p) => a + p.v, 0) / early.length;
    metrics.intentsRevenueEarlyWindowStart = new Date(intentsRevenue[startIdx].t * 1000).toISOString().slice(0, 10);
  }
  metrics.intentsRevenueLast90dAvg = avgLastDays(intentsRevenue, 90);
}
if (metrics.intentsRevenue30dAvg != null && metrics.chainRevenue30dAvg) {
  metrics.intentsShareOfChainRevenuePct =
    (metrics.intentsRevenue30dAvg / metrics.chainRevenue30dAvg) * 100;
}
// Annualised protocol revenue (Intents, the piece that feeds buybacks as
// reported) against a market cap from live price x ~1.31B supply.
if (metrics.intentsRevenue30dAvg != null) metrics.annualisedRevenue = metrics.intentsRevenue30dAvg * 365;
const priceForCap = metrics.priceCurrent ?? metrics.priceNow;
if (priceForCap != null) metrics.marketCap = priceForCap * 1_310_000_000;
if (metrics.annualisedRevenue != null && metrics.marketCap) {
  metrics.revenueToMarketCapPct = (metrics.annualisedRevenue / metrics.marketCap) * 100;
}

// ------------------------------------------------------------ scorecard ---
// Verdict rules are deliberately simple and stated here, so anyone can
// re-run them: supported = the fetched data clears the stated bar,
// contradicted = it clears the opposite bar, mixed = in between or a
// key input is unavailable.

const M = metrics;
const fmtUsd = (v) => (v == null ? 'unavailable' : `$${Math.round(v).toLocaleString('en-US')}`);
const fmtPct = (v, d = 1) => (v == null ? 'unavailable' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);

const scorecard = [];

scorecard.push((() => {
  const share = M.intentsShareOfChainRevenuePct;
  let verdict = 'mixed';
  if (share != null && share >= 50) verdict = 'supported';
  else if (share != null && share < 25) verdict = 'contradicted';
  return {
    id: 'intents-dominates-revenue',
    claim: 'NEAR Intents is the dominant revenue source in the NEAR ecosystem, ahead of base-chain activity.',
    verdict,
    evidence: share == null
      ? 'Revenue series unavailable from DefiLlama at build time.'
      : `NEAR Intents averaged ${fmtUsd(M.intentsRevenue30dAvg)}/day in revenue over the last 30 days vs ${fmtUsd(M.chainRevenue30dAvg)}/day for all NEAR chain protocols combined on DefiLlama — Intents alone is ${share.toFixed(0)}% of the chain total. Rule: supported if Intents >= 50% of chain revenue.`,
  };
})());

scorecard.push((() => {
  const now = M.tvlNow; const peak = M.tvlPeak;
  const belowPeak = now != null && peak ? ((peak - now) / peak) * 100 : null;
  let verdict = 'mixed';
  if (belowPeak != null && belowPeak >= 60) verdict = 'supported';
  else if (belowPeak != null && belowPeak < 25) verdict = 'contradicted';
  return {
    id: 'tvl-not-the-story',
    claim: 'Headline base-chain TVL is no longer the story: it sits far below its peak while the flow business grew.',
    verdict,
    evidence: now == null
      ? 'TVL series unavailable from DefiLlama at build time.'
      : `NEAR TVL is ${fmtUsd(now)} vs an all-time peak of ${fmtUsd(peak)} (${belowPeak == null ? 'n/a' : belowPeak.toFixed(0)}% below peak), ${fmtPct(M.tvlChange1yPct)} over the last year — while Intents revenue averaged ${fmtUsd(M.intentsRevenueEarly90dAvg)}/day in its first 90 recorded days (from ${M.intentsRevenueEarlyWindowStart || 'n/a'}) and ${fmtUsd(M.intentsRevenueLast90dAvg)}/day in the last 90 days. Rule: supported if TVL is >= 60% below peak.`,
  };
})());

scorecard.push((() => {
  const r = M.revenueToMarketCapPct;
  let verdict = 'mixed';
  if (r != null && r >= 0.5) verdict = 'supported';
  else if (r != null && r < 0.1) verdict = 'contradicted';
  return {
    id: 'fee-capture-material',
    claim: 'Fee capture is large enough to matter: annualised Intents revenue is a meaningful fraction of NEAR\'s market cap, so buybacks funded by it are not a rounding error.',
    verdict,
    evidence: r == null
      ? 'Needs both Intents revenue and live price; one was unavailable at build time.'
      : `Annualised Intents revenue is ~${fmtUsd(M.annualisedRevenue)} against a market cap of ~${fmtUsd(M.marketCap)} (live price ${M.priceCurrent == null ? 'unavailable' : `$${M.priceCurrent.toFixed(2)}`} x 1.31B supply) = ${r.toFixed(2)}% of market cap per year. Rule: supported if >= 0.5%/yr. This one sits close to its bar — small price moves flip it. (Buyback mechanics themselves are as reported by NEAR, not measured on-chain here.)`,
  };
})());

scorecard.push((() => {
  const g = M.stablesChange1yPct;
  let verdict = 'mixed';
  if (g != null && g > 10) verdict = 'supported';
  else if (g != null && g < -10) verdict = 'contradicted';
  return {
    id: 'stablecoin-rails',
    claim: 'Stablecoin supply on NEAR is growing — the payment rails the Intents business settles through are getting deeper.',
    verdict,
    evidence: g == null
      ? 'Stablecoin series unavailable from DefiLlama at build time.'
      : `Stablecoin supply on NEAR is ${fmtUsd(M.stablesNow)}, ${fmtPct(g)} over the last year. Rule: supported if 1y growth > +10%.`,
  };
})());

scorecard.push((() => {
  const p = M.priceChange1yPct;
  const revGrowth = (M.intentsRevenueEarly90dAvg && M.intentsRevenueLast90dAvg)
    ? ((M.intentsRevenueLast90dAvg - M.intentsRevenueEarly90dAvg) / M.intentsRevenueEarly90dAvg) * 100 : null;
  let verdict = 'mixed';
  if (p != null && revGrowth != null && revGrowth > 100 && p < 0) verdict = 'supported';
  else if (p != null && p > 50) verdict = 'contradicted';
  return {
    id: 'market-not-pricing',
    claim: 'The market is not pricing the flow story yet: NEAR\'s price has not followed Intents revenue growth. (This is the value case AND the honest risk: the market may know something, or may simply disagree.)',
    verdict,
    evidence: p == null
      ? 'Price series unavailable from DefiLlama coins API at build time.'
      : `NEAR price is ${M.priceCurrent == null ? 'unavailable' : `$${M.priceCurrent.toFixed(2)}`} live (${fmtPct(p)} over the last year on the weekly chart), while Intents daily revenue grew ${revGrowth == null ? 'unavailable' : `~${revGrowth.toFixed(0)}%`} between its first 90 recorded days and the last 90 days. Rule: supported if revenue more than doubled while price fell over 1y; contradicted if price itself rose > 50% over 1y (the market has, in fact, re-rated NEAR over the past year).`,
  };
})());

// --------------------------------------------------------------- output ---

const data = {
  fetchedAt: FETCHED_AT,
  sources,
  series: { tvl, price, chainFees, chainRevenue, intentsFees, intentsRevenue, stables },
  metrics,
  scorecard,
  reported: {
    note: 'Figures below are as reported in HSP-029 news coverage (Cointelegraph via KuCoin/CryptoBriefing/Unchained, Nov 2-3 2026). They are reported context, NOT measured by this project.',
    hsp029: {
      passedDate: '2026-11-02',
      veNearInFavour: '~3.29M veNEAR',
      supportPct: '99.9%',
      splitKept: '90% staking participants / 10% treasury',
      grace: '~90 days after ratification, then a protocol upgrade adopted by validators',
      phaseIn: '24 months, linear, to a 1.6% maximum annual issuance rate',
      reportedFewerIssued: '~11.8M fewer NEAR over two years',
      reportedYieldPath: '~5.2% -> ~3.3% projected gross staking yield',
      maxIssuanceToday: '2.5% (cut from 5% in late October 2025, as reported)',
      supplyContext: '~1.31B NEAR total supply (as reported late Oct 2026)',
    },
  },
};

const { writeFileSync } = await import('node:fs');
writeFileSync('data.json', JSON.stringify(data, null, 1));

console.log(`\nWrote data.json at ${FETCHED_AT}`);
for (const s of sources) console.log(`${s.ok ? 'OK     ' : 'FAILED '} ${s.name} — ${s.url}`);
console.log('\nHeadline metrics:');
for (const [k, v] of Object.entries(metrics)) {
  if (k === 'rpc') console.log(`  rpc: ${JSON.stringify(v)}`);
  else console.log(`  ${k}: ${v == null ? 'unavailable' : (typeof v === 'number' ? Math.round(v * 100) / 100 : v)}`);
}
console.log('\nScorecard:');
for (const c of scorecard) console.log(`  [${c.verdict.toUpperCase()}] ${c.claim}`);
