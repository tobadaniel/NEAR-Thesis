# NEAR, On The Evidence

**Track:** Investment Thesis (`thesis`) · NEAR HACKATHON 2026
**Data as of:** 2026-11-07 (fetched 20:52–20:55 UTC, see Sources)
**Rebuild everything on this page:** `node build-data.mjs` then open `index.html`
(or `node build-single.mjs` for the one-file version).

> This is an evidence exercise, not financial advice. Measured numbers come
> only from the free public APIs listed under Sources. Anything from news
> coverage is labelled **as reported** and is never mixed into the measured
> series. The HSP-029 numbers from the simulator are a **model** (model.js),
> labelled as such wherever they appear.

---

## The claim

**NEAR's real business is becoming Intents and cross-chain flow, not
base-chain gas — so fee capture and NEAR buybacks, plus the HSP-029 issuance
cut (2.5% → 1.6% over 24 months, passed Nov 2 2026), matter more to NEAR's
long-term value than headline TVL.**

If that is true, the right dashboard for NEAR is not "TVL and price" but
"how much revenue does the flow business capture, what does that revenue do
(buybacks), and how fast is new supply shrinking against it."

## Evidence for

**1. Intents is not a side product; on DefiLlama's accounting it IS the
revenue.** Over the 30 days to Nov 6 2026, NEAR Intents averaged
**$67,187/day in revenue ($2.02M in 30 days)** against **$73,090/day
($2.19M)** for *all* NEAR chain protocols combined — Intents alone is
**92%** of the chain total. Its fees averaged $204,665/day of the chain's
$229,643/day (89%). Whatever NEAR is becoming, its income statement is
already dominated by the flow business, not by base-chain DeFi.

**2. The flow business is growing fast on the record we have.** Intents
daily revenue averaged **$10,496/day in its first 90 recorded days** (from
2025-10-09, when DefiLlama's adapter starts recording non-trivial values)
and **$54,999/day in the last 90 days** — roughly **5.2×** in about a year
of recorded history. (As reported context: NEAR's Q3 2026 update put
cumulative Intents volume above $32B and cumulative fees above $52M.)

**3. Fee capture is large enough to matter — just.** Annualised Intents
revenue is **~$24.5M**, which is **0.52% of NEAR's ~$4.76B market cap**
(live price $3.63 × 1.31B supply) per year. Put in NEAR terms at $3.63,
that is ~6.8M NEAR/year of potential buyback demand against issuance of
~21.0M NEAR/year at the post-HSP-029 rate (1.6% of 1.31B) — buybacks at
the current revenue run-rate would offset roughly **a third** of new
issuance once the cut is fully in, and ~21% of issuance at today's 2.5%
rate. Not decisive alone; decisive *combined* with the issuance cut,
which is exactly the thesis. (Buyback mechanics — Intents revenue swept
to buy back NEAR on the open market — are **as reported** by NEAR and
DefiLlama's holders-revenue methodology, not independently verified
on-chain by this project.)

**4. HSP-029 is real, passed, and material in size.** As reported:
proposal HSP-029 passed the House of Stake on Nov 2 2026 with ~3.29M
veNEAR in favour (99.9% support), keeping the 90/10 staker/treasury
split; after Security Council ratification, a ~90-day grace period and
validator adoption of a protocol upgrade, the maximum issuance rate
phases linearly from 2.5% to 1.6% over 24 months; reporting estimates
~11.8M fewer NEAR issued over two years and gross staking yield
compressing from ~5.2% to ~3.3%.

**5. My independent model lands where the reporting does — without being
tuned to it.** model.js (defaults: 1.31B supply, 43% staking ratio, 2M
NEAR/year assumed fee burn) gives **12.90M NEAR not issued by month 27**
(grace + phase-in) against the reported ~11.8M, and a gross staking yield
path of **5.23% → 3.35%** against the reported ~5.2% → ~3.3%. Two
different routes to the same neighbourhood is what corroboration looks
like. The model is in the repo with unit tests
(`node test/model.test.mjs`); drag the dashboard sliders to break it.

**6. TVL really is the wrong headline.** NEAR TVL is **$172.7M**, **64%
below its $476.9M DefiLlama peak** — a mid-sized DeFi footprint that
explains almost none of the revenue above. A chain can have modest TVL
and a real business if the business is flow, not stock.

## Evidence against

**1. The stablecoin rails shrank.** Stablecoin supply on NEAR is
**$130.5M, down 22.9% over the last year** (scorecard: **contradicted**).
If Intents settles through stablecoin rails, a year of shrinking on-chain
stablecoin supply is a genuine counter-signal — or a sign that flow is
settling elsewhere in the Intents network and NEAR-chain stablecoin
supply is the wrong gauge. Either way, it does not currently corroborate
"growing payment rails on NEAR."

**2. The market has already re-rated NEAR.** NEAR is **+90.8% over the
last year** on the weekly price chart (scorecard: **contradicted** for
"the market isn't pricing it"). This is not an undiscovered story at
$2 anymore. The value case now has to be "the re-rating has further to
run because revenue keeps compounding," which is a weaker, more
ordinary claim — and the price fell hard in the days around the vote
(live $3.63 on Nov 7 vs a $4.20 weekly-chart point on Nov 2), so the
market is actively arguing about it.

**3. TVL is recovering, not dead.** TVL is **+16.8% over the last year**.
The honest version of the thesis is "flow matters *more*," not "the base
chain is irrelevant" — the base chain is having a decent year too.

**4. Concentration and short history.** One product is 92% of measured
revenue. DefiLlama's Intents revenue record only starts in Oct 2025, so
the growth multiple rests on ~13 months of adapter data, and adapters
are third-party accounting that can be revised. If Intents volume is
substantially wash or incentive-driven flow — which these APIs cannot
rule out — the revenue quality is worse than the revenue quantity.

**5. The cut has a cost side.** Yield compression from ~5.2% to ~3.3%
pays holders partly by paying stakers and validators less. If staking
ratio or validator count (352 at fetch time) falls materially as yields
compress, the security budget shrinks along with issuance. The thesis
assumes the network tolerates this; the simulator lets you stress the
staking ratio and watch yields, but validator *behaviour* is not
modelled.

**6. HSP-029 is passed, not implemented.** Ratification, the grace
period and validator adoption of the upgrade all still have to happen.
A vote is a promise; the issuance path only changes when validators run
the new protocol version.

## Scorecard (computed by build-data.mjs from the fetched data)

| Claim | Verdict |
| --- | --- |
| Intents is the dominant revenue source (≥50% of chain revenue) | **Supported** — 92% |
| TVL is far below peak while flow grew (≥60% below peak) | **Supported** — 64% below peak |
| Fee capture is material (annualised Intents revenue ≥ 0.5% of market cap) | **Supported, borderline** — 0.52%; small price moves flip this |
| Stablecoin supply on NEAR is growing (> +10% / 1y) | **Contradicted** — −22.9% |
| The market is not pricing the flow story (revenue >2×, price down 1y) | **Contradicted** — price +90.8% / 1y |

## What would change my mind

- Intents' share of NEAR chain revenue falls below ~25% for a full
  quarter — the flow business was a spike, not a business.
- Intents revenue declines for two consecutive quarters while TVL
  recovers strongly — value re-concentrates in the base layer.
- On-chain reconciliation shows captured Intents fees are *not* buying
  back NEAR at anywhere near the reported scale — the fee-capture leg
  of the thesis is the load-bearing one.
- HSP-029 stalls: no ratification, or validator adoption fails, or the
  validator count drops materially (say below ~300 from 352) as yields
  compress — the supply leg fails.
- Stablecoin supply on NEAR keeps shrinking *and* Intents volume
  reporting shows settlement migrating away from NEAR — the rails leg
  fails.

## Methods

- All series come from the free, no-key APIs listed below, pulled by
  `build-data.mjs` (Node's built-in fetch) into `data.json` with every
  source URL, fetch timestamp and failure recorded in the file itself
  (the dashboard footer prints them).
- 30-day and 90-day figures are simple averages of daily values. The
  Intents "early window" is the first 90 days starting when the
  trailing-30-day revenue average first reaches $1,000/day
  (2025-10-09) — defined in code because the adapter records ~$0 before
  then.
- Market cap = live price (DefiLlama coins current-price endpoint) ×
  1.31B supply (supply figure as reported in Oct 2026 coverage; the
  dashboard labels it as such).
- The chain snapshot (block height 223,518,164 and 352 current
  validators at fetch time) comes from the public NEAR RPC.
- **Known gaps, stated plainly:** daily active accounts and transaction
  counts would test "real usage" directly, but the clean source for
  those is the NEAR BigQuery public dataset, which needs a paid GCP
  account — out of scope for a no-key reproducible build, and listed
  here as the first next step. Buyback wallet flows were not reconciled
  on-chain in this pass; that is the second next step.
- Endpoint quirks found while building: DefiLlama's
  `/overview/fees/near-intents` returns HTTP 500 (the `/summary/fees/`
  variant works and is used); the coins chart API rejects
  `period=1y/2y` (the working shape is `start=<unix>&span=104&period=604800`).

## Sources (all fetched 2026-11-07, 20:52–20:55 UTC)

Measured (free public APIs, no keys):

- DefiLlama historical TVL, chain Near — https://api.llama.fi/v2/historicalChainTvl/Near
- DefiLlama chain fees, Near (dailyFees) — https://api.llama.fi/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees
- DefiLlama chain revenue, Near (dailyRevenue) — https://api.llama.fi/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue
- DefiLlama NEAR Intents fees (dailyFees) — https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees
- DefiLlama NEAR Intents revenue (dailyRevenue) — https://api.llama.fi/summary/fees/near-intents?dataType=dailyRevenue
- DefiLlama stablecoin supply, chain Near — https://stablecoins.llama.fi/stablecoincharts/Near
- DefiLlama coins price chart, NEAR (weekly, 2y) — https://coins.llama.fi/chart/coingecko:near?start=<unix>&span=104&period=604800
- DefiLlama coins current price, NEAR — https://coins.llama.fi/prices/current/coingecko:near
- NEAR public RPC (status, validators) — https://rpc.mainnet.near.org

As reported (news coverage of HSP-029 and NEAR's Q3 update, Nov 2–3 2026 —
Cointelegraph reporting via KuCoin, CryptoBriefing, Unchained and
NEAR's own announcement post of Nov 2 2026): the HSP-029 vote result and
figures in Evidence-for §4, the ~1.31B supply context, the Q3 Intents
cumulative volume/fees context, and buyback mechanics. These are cited
as reported context only; no measured series in this project depends on
them.
