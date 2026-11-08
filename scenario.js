// scenario.js — the Scenario lab coupling model. Pure math, no I/O,
// unit-testable (test/scenario.test.mjs).
//
// The dashboard above the lab shows ACTUAL fetched statistics and is
// never touched by this module. The lab takes a small set of driver
// inputs, defaults them to the actuals, and re-infers the statistics
// that are arithmetically linked to those drivers, holding every
// coupling ratio at the value computed from the actual dataset:
//
//   - Intents revenue = Intents fees x (actual Intents revenue / fees).
//   - All-chain revenue = inferred Intents revenue + the non-Intents
//     remainder of actual chain revenue, held constant.
//   - Annualised figures = daily x 365. Market cap = price x supply
//     (the same 1.31B supply the dashboard's market cap uses).
//   - Chain fees = (actual chain fees / actual txns per day) x the
//     scenario transactions per day: the blended fee per transaction
//     is held at its actual ratio.
//   - Chain revenue per account = annualised chain revenue / total
//     accounts (NearBlocks total accounts, a holders proxy — every
//     account ever created net of deletions, not wallets with a
//     balance).
//   - Net supply change per year = issuance at a stated rate
//     (2.5% status quo, or 1.6% under HSP-029 once phased in) minus
//     the fee-burn driver. The burn anchor is the HSP-029 simulator's
//     stated assumption (model.js MODEL_DEFAULTS), not a measurement.
//
// The five scorecard verdicts are re-evaluated with exactly the rules
// stated in build-data.mjs, including the "mixed" middle bands. Only
// two verdicts have scenario-driven inputs (Intents revenue share and
// annualised revenue / market cap). The other three rules read
// historical series (TVL vs peak, stablecoin 1y change, price 1y
// change and Intents revenue growth) that no driver bends, so they
// re-evaluate to their actual verdicts by construction.

// Build the baseline: actuals + coupling ratios, from data.json metrics.
// opts: { supply, feeBurnAnnual } — supply is the reported ~1.31B total
// supply the dashboard's market cap already uses; feeBurnAnnual is the
// simulator's burn assumption, the burn driver's anchor.
export function buildBaseline(metrics, opts = {}) {
  const supply = opts.supply ?? 1_310_000_000;
  const feeBurnAnnual = opts.feeBurnAnnual ?? 2_000_000;
  const price = metrics.priceCurrent ?? metrics.priceNow ?? null;
  const intentsFees = metrics.intentsFees30dAvg ?? null;
  const intentsRevenue = metrics.intentsRevenue30dAvg ?? null;
  const chainRevenue = metrics.chainRevenue30dAvg ?? null;
  const chainFees = metrics.chainFees30dAvg ?? null;
  const txnsPerDay = metrics.txnsPerDay30dAvg ?? null;
  const accounts = metrics.totalAccounts ?? null;

  const annualisedIntentsRevenue = intentsRevenue != null ? intentsRevenue * 365 : null;
  const marketCap = price != null ? price * supply : null;

  const tvlBelowPeakPct = (metrics.tvlNow != null && metrics.tvlPeak)
    ? ((metrics.tvlPeak - metrics.tvlNow) / metrics.tvlPeak) * 100 : null;
  const intentsRevenueGrowthPct = (metrics.intentsRevenueEarly90dAvg && metrics.intentsRevenueLast90dAvg)
    ? ((metrics.intentsRevenueLast90dAvg - metrics.intentsRevenueEarly90dAvg)
      / metrics.intentsRevenueEarly90dAvg) * 100 : null;

  const actuals = {
    intentsFeesPerDay: intentsFees,
    nearPrice: price,
    feeBurnAnnual,
    accounts,
    txnsPerDay,
    intentsRevenuePerDay: intentsRevenue,
    chainRevenuePerDay: chainRevenue,
    chainFeesPerDay: chainFees,
    intentsSharePct: (intentsRevenue != null && chainRevenue)
      ? (intentsRevenue / chainRevenue) * 100 : null,
    annualisedIntentsRevenue,
    marketCap,
    revenueToMarketCapPct: (annualisedIntentsRevenue != null && marketCap)
      ? (annualisedIntentsRevenue / marketCap) * 100 : null,
    revenuePerAccountPerYear: (chainRevenue != null && accounts)
      ? (chainRevenue * 365) / accounts : null,
  };

  const couplings = {
    supply,
    revenuePerFee: (intentsRevenue != null && intentsFees) ? intentsRevenue / intentsFees : null,
    nonIntentsRevenuePerDay: (chainRevenue != null && intentsRevenue != null)
      ? chainRevenue - intentsRevenue : null,
    feesPerTxn: (chainFees != null && txnsPerDay) ? chainFees / txnsPerDay : null,
    issuanceRateStatusQuo: 0.025, // today's maximum issuance (see model.js)
    issuanceRateHsp029: 0.016,     // HSP-029 target after the phase-in
  };

  // Historical inputs to verdict rules that no driver can bend.
  const history = {
    tvlBelowPeakPct,
    stablesChange1yPct: metrics.stablesChange1yPct ?? null,
    priceChange1yPct: metrics.priceChange1yPct ?? null,
    intentsRevenueGrowthPct,
  };

  return { actuals, couplings, history };
}

// The stated verdict rules, mirroring build-data.mjs exactly.
export function evaluateVerdicts(v) {
  const out = {};
  out['intents-dominates-revenue'] =
    v.intentsSharePct == null ? 'mixed'
      : v.intentsSharePct >= 50 ? 'supported'
        : v.intentsSharePct < 25 ? 'contradicted' : 'mixed';
  out['tvl-not-the-story'] =
    v.tvlBelowPeakPct == null ? 'mixed'
      : v.tvlBelowPeakPct >= 60 ? 'supported'
        : v.tvlBelowPeakPct < 25 ? 'contradicted' : 'mixed';
  out['fee-capture-material'] =
    v.revenueToMarketCapPct == null ? 'mixed'
      : v.revenueToMarketCapPct >= 0.5 ? 'supported'
        : v.revenueToMarketCapPct < 0.1 ? 'contradicted' : 'mixed';
  out['stablecoin-rails'] =
    v.stablesChange1yPct == null ? 'mixed'
      : v.stablesChange1yPct > 10 ? 'supported'
        : v.stablesChange1yPct < -10 ? 'contradicted' : 'mixed';
  out['market-not-pricing'] =
    (v.priceChange1yPct != null && v.intentsRevenueGrowthPct != null
      && v.intentsRevenueGrowthPct > 100 && v.priceChange1yPct < 0) ? 'supported'
      : (v.priceChange1yPct != null && v.priceChange1yPct > 50) ? 'contradicted' : 'mixed';
  return out;
}

// Run one scenario. drivers: { intentsFeesPerDay, nearPrice,
// feeBurnAnnual, accounts, txnsPerDay } — any omitted driver falls back
// to its actual value. Returns the inferred statistics and verdicts.
export function inferScenario(baseline, drivers = {}) {
  const A = baseline.actuals;
  const C = baseline.couplings;
  const d = {
    intentsFeesPerDay: drivers.intentsFeesPerDay ?? A.intentsFeesPerDay,
    nearPrice: drivers.nearPrice ?? A.nearPrice,
    feeBurnAnnual: drivers.feeBurnAnnual ?? A.feeBurnAnnual,
    accounts: drivers.accounts ?? A.accounts,
    txnsPerDay: drivers.txnsPerDay ?? A.txnsPerDay,
  };

  const intentsRevenuePerDay = (d.intentsFeesPerDay != null && C.revenuePerFee != null)
    ? d.intentsFeesPerDay * C.revenuePerFee : null;
  const chainRevenuePerDay = (intentsRevenuePerDay != null && C.nonIntentsRevenuePerDay != null)
    ? intentsRevenuePerDay + C.nonIntentsRevenuePerDay : null;
  const intentsSharePct = (intentsRevenuePerDay != null && chainRevenuePerDay)
    ? (intentsRevenuePerDay / chainRevenuePerDay) * 100 : null;
  const annualisedIntentsRevenue = intentsRevenuePerDay != null ? intentsRevenuePerDay * 365 : null;
  const marketCap = d.nearPrice != null ? d.nearPrice * C.supply : null;
  const revenueToMarketCapPct = (annualisedIntentsRevenue != null && marketCap)
    ? (annualisedIntentsRevenue / marketCap) * 100 : null;
  const chainFeesPerDay = (C.feesPerTxn != null && d.txnsPerDay != null)
    ? C.feesPerTxn * d.txnsPerDay : null;
  const revenuePerAccountPerYear = (chainRevenuePerDay != null && d.accounts)
    ? (chainRevenuePerDay * 365) / d.accounts : null;
  const burnUsdPerYear = (d.feeBurnAnnual != null && d.nearPrice != null)
    ? d.feeBurnAnnual * d.nearPrice : null;
  const issuanceStatusQuoPerYear = C.issuanceRateStatusQuo * C.supply;
  const issuanceHsp029PerYear = C.issuanceRateHsp029 * C.supply;
  const netSupplyStatusQuoPerYear = d.feeBurnAnnual != null
    ? issuanceStatusQuoPerYear - d.feeBurnAnnual : null;
  const netSupplyHsp029PerYear = d.feeBurnAnnual != null
    ? issuanceHsp029PerYear - d.feeBurnAnnual : null;
  const burnShareOfIssuancePct = d.feeBurnAnnual != null
    ? (d.feeBurnAnnual / issuanceStatusQuoPerYear) * 100 : null;

  const verdictMap = evaluateVerdicts({
    intentsSharePct,
    revenueToMarketCapPct,
    tvlBelowPeakPct: baseline.history.tvlBelowPeakPct,
    stablesChange1yPct: baseline.history.stablesChange1yPct,
    priceChange1yPct: baseline.history.priceChange1yPct,
    intentsRevenueGrowthPct: baseline.history.intentsRevenueGrowthPct,
  });

  return {
    drivers: d,
    inferred: {
      intentsRevenuePerDay,
      chainRevenuePerDay,
      intentsSharePct,
      annualisedIntentsRevenue,
      marketCap,
      revenueToMarketCapPct,
      chainFeesPerDay,
      revenuePerAccountPerYear,
      burnUsdPerYear,
      issuanceStatusQuoPerYear,
      issuanceHsp029PerYear,
      netSupplyStatusQuoPerYear,
      netSupplyHsp029PerYear,
      burnShareOfIssuancePct,
    },
    verdicts: Object.entries(verdictMap).map(([id, verdict]) => ({ id, verdict })),
  };
}
