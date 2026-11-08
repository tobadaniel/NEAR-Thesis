# NEAR: On The Evidence

**An investment thesis on NEAR that anyone can re-run — including the
parts that come out against it.**

Chain narratives are usually marketing: a claim, a chart chosen to flatter
it, and no way to check either. This project takes one live claim about
NEAR — that its real business is becoming Intents and cross-chain flow, not
base-chain gas — pulls the underlying numbers from free public APIs, grades
each part of the claim **supported / mixed / contradicted** by a stated
rule, and then hands you the sliders: every statistic on the board can be
stress-tested, with linked figures re-inferred live at the coupling ratios
the actual data implies. The verdicts re-grade under your scenario. Two of
the five claims currently grade **contradicted**, and they stay on the
board — that is the point of testing a thesis instead of selling one.

**Try it now:**

- **GitHub Pages (submission build):** https://tobadaniel.github.io/NEAR-Thesis/
- **Netlify (product build):** https://near-thesis.netlify.app

Built for **NEAR HACKATHON 2026 — Investment Thesis** (track id: `thesis`).
Full written thesis — claim, evidence for, evidence against, what would
change my mind, methods: `THESIS.md`.

## The problem, and what this is

The headline finding, from data fetched 2026-11-07: NEAR Intents averaged
**$67,187/day** in revenue over the prior 30 days, against **$73,090/day**
for all NEAR chain protocols combined — **Intents alone is 91.9% of NEAR's
measured protocol revenue**, while base-chain TVL ($172.7M) sits 64% below
its $476.9M peak. If that is true, then fee capture, buybacks and the
HSP-029 issuance cut matter more to NEAR's long-term value than headline
TVL — and it is exactly the kind of claim that should be checkable by
anyone, not just asserted.

The product is two things in one page:

1. **A reproducible evidence dashboard.** Seventeen statistics, each one
   the fetched actual, each traceable to a named source with a fetch
   timestamp, each carrying a slider wired to a coupling model
   (`scenario.js`) built from the actuals.
2. **An HSP-029 issuance simulator** (`model.js`). HSP-029 (passed
   Nov 2, 2026, as reported) cuts NEAR's maximum annual issuance from
   2.5% to 1.6%. The simulator models the path month by month — NEAR not
   issued, staking yield — under assumptions you can change.

## Try it (for judges)

Each step is do-X-see-Y, in page order. Everything below runs in the
browser; no install, no wallet, no network calls after the page loads.

1. **Open the board** (GitHub Pages link above). **See** the claim under
   test in the header, the fetch timestamp, and a grid of 17 stat boxes
   showing the fetched actuals: NEAR price $3.63 (labelled LIVE), Intents
   revenue $67,187/day, Intents share of revenue 91.9%, TVL $172.7M,
   stablecoins $130.5M, total accounts 278,797,181, and more.
2. **Drag the Intents fees slider to the right** — to about double, roughly
   $409,000/day. **See** Intents revenue climb to about $134,000/day,
   all-NEAR chain revenue and annualised Intents revenue rise with it, the
   Intents share push toward 97%, and every inferred box gain an **est**
   tag with its difference vs the actual (e.g. "+100.0% vs actual"). The
   coupled sliders in the revenue, chain revenue, annualised and share
   boxes move in sync, because they share the fees driver. TVL and
   stablecoins do not move: they are uncoupled, their sliders bend only
   their own box.
3. **Open "Coupling ratios & method"** under the grid. **See** every ratio
   the sliders use, printed from the actuals: Intents revenue = Intents
   fees × 0.3283; the non-Intents revenue remainder held constant at
   $5,902/day; annualised = daily × 365; market cap = price × 1.31B NEAR;
   chain fees = $0.3462 per transaction × transactions/day; net supply =
   issuance (32,750,000 NEAR/yr at 2.5%, 20,960,000 at 1.6%) minus burn.
4. **Drag the NEAR price slider upward, then scroll to the Thesis
   scorecard.** **See** verdicts re-grade live under the same stated
   rules: as price rises, market cap rises and "Annualised revenue / cap"
   falls through its 0.5%/yr bar (it sits at 0.52% at the actuals), so the
   fee-capture claim flips from **supported** to **mixed** and the card is
   flagged as changed under your scenario. The two claims no slider can
   bend — stablecoin rails and market pricing, both graded
   **contradicted** on the historical series — stay contradicted.
5. **Scroll to the HSP-029 issuance simulator.** **See** the model's
   endpoints at the default assumptions (1.31B supply, 43% staking ratio,
   2M NEAR/yr fee burn): 12,902,688 NEAR not issued by month 27,
   48,417,291 by month 59, and the gross staking yield path easing from
   5.23% to 3.35%. Drag the staking ratio slider and watch the yield path
   move; the rate and cumulative-saved charts redraw.
6. **Click the theme toggle** in the header. **See** the board switch from
   the pure-black dark theme to a warm paper light theme, with the same
   per-stat colours in each. Your choice is remembered on the next visit.
7. **Click "Reset to actuals"** in the grid toolbar. **See** every box
   return to the fetched actuals, all **est** tags and deltas disappear,
   and the scorecard verdicts return to their actual grades.
8. **(From source) Re-pull the evidence yourself:** run
   `node build-data.mjs`, then `node build-single.mjs`. **See** every API
   succeed or fail in the open, `data.json` rewritten with fresh numbers,
   fresh verdicts and fresh timestamps, and a rebuilt `dist/` page. If a
   source dies, its panel says "unavailable" — nothing is invented to
   fill the gap.

## The data

All figures on the board were fetched **2026-11-07 20:55 UTC** and ship
inside `data.json` (time series, computed metrics, scorecard claims with
their rules and evidence, and the as-reported HSP-029 context), each
source carrying its own timestamp and an `ok` flag.

Sources (all free public APIs, no keys):

- **DefiLlama** — historical TVL, chain fees and revenue (daily, with
  30-day averages), NEAR Intents fees and revenue, stablecoin supply,
  NEAR price chart and current price.
- **NEAR public RPC** — chain status and validators for the snapshot
  section (at fetch: block height 223,518,164, 352 validators, node
  version 2.14.0).
- **NearBlocks** — daily transaction and account charts, plus a chain
  stats cross-check (663,382 transactions/day, 30-day average over
  2026-10-09 to 2026-11-07).

Honest labels, kept visible in the product rather than footnoted away:

- **est tags.** Any figure re-inferred by the scenario model is tagged
  **est** with its difference vs the actual. Actuals are never
  overwritten.
- **Accounts are a holders proxy.** "Total accounts" (278,797,181) is the
  NearBlocks total — every account ever created net of deletions — not a
  count of wallets holding a balance. The board and this README label it
  a proxy wherever it appears.
- **Contradicted means contradicted.** Stablecoin supply on NEAR fell
  22.9% in a year, against the claim that the payment rails are getting
  deeper; NEAR's price rose 90.8% in a year, against the claim that the
  market is not pricing the flow story. Both claims grade
  **contradicted** and stay on the scorecard.
- **As reported is not measured.** The HSP-029 vote figures (~3.29M
  veNEAR in favour, 99.9% support, passed Nov 2, 2026) and buyback
  mechanics come from news coverage; they are labelled "as reported"
  wherever used and never mixed into the measured series.
- **History is short.** DefiLlama's Intents revenue record starts
  Oct 2025, so growth multiples rest on roughly 13 months of third-party
  accounting.

## How it works

| File | What it is |
| --- | --- |
| `build-data.mjs` | Pulls every source, computes the metrics and scorecard verdicts, writes `data.json` with sources and timestamps. |
| `scenario.js` | The coupling model: pure math. Builds the baseline (actuals + coupling ratios) from the metrics and re-infers linked statistics from five drivers — Intents fees, NEAR price, fee burn, accounts, transactions/day. |
| `model.js` | The HSP-029 simulator: pure math, no I/O. |
| `index.html` / `style.css` / `app.js` | The dashboard: stat grid with per-box sliders, scorecard, charts (inline SVG, no libraries), simulator, RPC snapshot, sources. Fonts are embedded; there are no external requests. |
| `build-single.mjs` | Inlines CSS, JS, fonts and `data.json` into a single self-contained HTML file, in two variants (below). |
| `THESIS.md` | The written thesis: claim, evidence for, evidence against, what would change my mind, methods, sources. |
| `test/` | Four zero-dependency test suites (model, scenario, theme, grid). Run them with `npm test`. |
| `verification/` | Browser checks (headless Chrome via CDP) for layout, themes and the stat grid. |

**The coupling model.** Ratios are computed from the actual dataset, not
chosen: revenue per fee dollar (0.3283), the non-Intents revenue remainder
($5,902/day, held constant), the blended fee per transaction ($0.3462),
supply (1.31B, as reported). Five boxes are drivers; derived boxes
back-solve their driver, so dragging the Intents revenue slider and
dragging the Intents fees slider are the same act. Verdicts are
re-evaluated with exactly the rules in `build-data.mjs`, including the
"mixed" middle bands. Only two verdicts have scenario-driven inputs
(Intents revenue share and annualised revenue / market cap); the other
three read historical series no driver bends.

**The simulator.** Month 0 is the first month after ratification. Months
0–2 are the ~90-day grace period at 2.5%; months 3–27 decline linearly to
1.6%, which then holds. Monthly issuance is start-of-month supply × rate
÷ 12; supply evolves by issuance minus the fee-burn assumption (default
2M NEAR/yr, stated as an assumption, not a measurement). Gross staking
yield = monthly issuance × 12 × 0.90 (the kept 90/10 staker/treasury
split) ÷ staked supply. "Status quo" is the identical model pinned at
2.5%; cumulative NEAR not issued is the running difference.

**Two build variants.** `node build-single.mjs` produces the hackathon
build (`dist/near-thesis.html`), which carries the NEAR Hackathon badge
in the header and the independent-dashboard line in the footer — that is
the GitHub and GitHub Pages face. `npm run build:product`
(`NEAR_VARIANT=product`) produces the product build
(`dist-product/near-thesis.html`) with both inscriptions stripped — that
is the Netlify face. The build fails loudly if any hackathon wording
survives in the product variant.

## Run it locally

- **Fastest:** open `dist/near-thesis.html` in a browser. The whole
  dashboard — data and fonts included — is that one file. No server, no
  network.
- **From source:** `python3 -m http.server 8901` in this folder, then
  open `http://localhost:8901/`.
- **Refresh and rebuild:** `node build-data.mjs` (re-pull the data),
  `node build-single.mjs` (rebuild the single file), `npm test` (run the
  four suites).

## Same builder, other NEAR HACKATHON projects

Disclosure (per the hackathon's two-project rule): my other submitted
project in this hackathon is:

- **Pump Rider** — a one-button arcade game (Games track): ride a rocket
  over a scrolling memecoin chart, hold to pump, let go to fall, dodge
  the rug pulls.

Also built by me during this hackathon, but not submitted:

- **STREAK** — a memecoin with a daily streak mechanic: check in daily,
  the community target mints, a miss burns, the streak is the high score.
- **Moon or Rug** — a memecoin survival game: 14 days of launches, agent
  rivals, one bankroll — how long do you survive?

Hackathon rule note: one person may submit at most 2 projects, and each
submitted project's README must name the other submitted project(s).

## License

MIT (see `LICENSE`).
