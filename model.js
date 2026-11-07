// model.js — HSP-029 issuance simulator. Pure math, no I/O, unit-testable.
//
// HSP-029 (passed by NEAR's House of Stake, announced Nov 2 2026) lowers
// NEAR's maximum annual issuance rate from 2.5% to 1.6%:
//   - a grace period of ~90 days (~3 months) after ratification,
//   - then a linear phase-in over 24 months,
//   - the 90/10 split of new issuance between staking participants and
//     the protocol treasury is kept.
//
// Model conventions (documented so anyone can reproduce or challenge them):
//   - Month 0 is the first month after ratification.
//   - Months 0-2 are the grace period: rate stays at 2.5%.
//   - Months 3-27 decline linearly: rate(3) = 2.5%, rate(27) = 1.6%.
//   - After month 27 the rate holds at 1.6%.
//   - Monthly max issuance = start-of-month supply x annual rate / 12.
//   - Supply evolves: supply += issuance - fee burn. The fee burn is an
//     annual NEAR estimate (a parameter, default below), spread evenly.
//     NEAR burns 70% of transaction fees; the burn figure here is an
//     explicit assumption, NOT a measured value.
//   - Gross staking yield (annualised, per month) =
//       (monthly issuance x 12 x 0.90) / (supply x staking ratio).
//   - "Status quo" is the identical model with the rate pinned at 2.5%.
//     Cumulative saved = sum of (status-quo issuance - HSP-029 issuance).

export const MODEL_DEFAULTS = {
  totalSupply: 1_310_000_000, // ~1.31B NEAR, as reported in late Oct 2026 coverage
  stakingRatio: 0.43,         // share of supply staked (assumption, slider in the UI)
  feeBurnAnnual: 2_000_000,   // NEAR burned per year from fees (assumption, slider in the UI)
  months: 60,                 // simulation horizon
};

export const RATE_START = 0.025;  // 2.5% max annual issuance today
export const RATE_END = 0.016;    // 1.6% target under HSP-029
export const GRACE_MONTHS = 3;    // ~90 days
export const PHASE_MONTHS = 24;   // linear phase-in length
export const STAKER_SHARE = 0.90; // 90% of issuance to staking participants

// Maximum annual issuance rate (as a fraction) in a given month.
export function issuanceRate(month) {
  if (month < GRACE_MONTHS) return RATE_START;
  const phaseEnd = GRACE_MONTHS + PHASE_MONTHS; // month 27
  if (month >= phaseEnd) return RATE_END;
  const t = (month - GRACE_MONTHS) / PHASE_MONTHS; // 0 at month 3, 1 at month 27
  return RATE_START + (RATE_END - RATE_START) * t;
}

// Run the month-by-month simulation. Returns one row per month:
// { month, ratePct, issuance, statusQuoIssuance, savedThisMonth,
//   savedCumulative, supply, stakingYieldPct }
export function simulate(opts = {}) {
  const o = { ...MODEL_DEFAULTS, ...opts };
  const monthlyBurn = o.feeBurnAnnual / 12;
  let supply = o.totalSupply;
  let supplyQ = o.totalSupply; // status-quo supply
  let savedCumulative = 0;
  const rows = [];
  for (let m = 0; m < o.months; m++) {
    const rate = issuanceRate(m);
    const issuance = (supply * rate) / 12;
    const issuanceQ = (supplyQ * RATE_START) / 12;
    const savedThisMonth = issuanceQ - issuance;
    savedCumulative += savedThisMonth;
    const stakingYieldPct = ((issuance * 12 * STAKER_SHARE) / (supply * o.stakingRatio)) * 100;
    rows.push({
      month: m,
      ratePct: rate * 100,
      issuance,
      statusQuoIssuance: issuanceQ,
      savedThisMonth,
      savedCumulative,
      supply,
      stakingYieldPct,
    });
    supply += issuance - monthlyBurn;
    supplyQ += issuanceQ - monthlyBurn;
  }
  return rows;
}

// Convenience summary for a run: the headline numbers the dashboard shows.
export function summarise(rows) {
  const at27 = rows[GRACE_MONTHS + PHASE_MONTHS];
  const last = rows[rows.length - 1];
  return {
    rateStartPct: rows[0].ratePct,
    rateEndPct: at27 ? at27.ratePct : last.ratePct,
    savedByMonth27: at27 ? at27.savedCumulative : last.savedCumulative,
    savedTotal: last.savedCumulative,
    yieldStartPct: rows[0].stakingYieldPct,
    yieldAt27Pct: at27 ? at27.stakingYieldPct : last.stakingYieldPct,
    yieldFinalPct: last.stakingYieldPct,
    supplyFinal: last.supply,
  };
}
