# NEAR, On The Evidence

**An investment thesis on NEAR that anyone can re-run — including the
parts that come out against it.**

Built for **NEAR HACKATHON 2026 — Investment Thesis** (track id: `thesis`).

The claim under test: NEAR's real business is becoming Intents and
cross-chain flow, not base-chain gas — so fee capture, buybacks and the
HSP-029 issuance cut matter more to NEAR's long-term value than headline
TVL. The dashboard tests it with live data pulled from free public APIs,
scores each sub-claim **supported / mixed / contradicted** by a stated
rule, and ships an HSP-029 issuance simulator you can stress yourself.

At the Nov 7 2026 build the scorecard reads: Intents is 92% of NEAR's
measured protocol revenue (**supported**), TVL is 64% below its peak
(**supported**), fee capture is 0.52% of market cap per year
(**supported, borderline**), stablecoin supply on NEAR fell 22.9% in a
year (**contradicted**), and NEAR's price already rose ~91% in a year,
so "the market isn't pricing it" is **contradicted** too. Full write-up:
`THESIS.md`.

## See it

- **Instant:** open `dist/near-thesis.html` — the whole dashboard, data
  included, in one file.
- **From source:** `python3 -m http.server 8901` here, open
  `http://localhost:8901/`.

## Try it like a judge (do X, see Y)

1. Open the dashboard. See 8 headline stats, each traceable to a source
   in the footer with its fetch timestamp.
2. Read the scorecard. See two red **contradicted** cards kept on the
   board next to the green ones — the thesis is tested, not sold.
3. Scroll to the revenue chart. See NEAR Intents' daily revenue line
   tracking almost on top of the all-NEAR chain total — that overlap is
   the thesis in one picture.
4. Drag the **staking ratio** slider in the simulator to 55%. See the
   projected yield path fall (5.23% → 3.35% becomes ~4.09% → ~2.62%):
   the model is live math (`model.js`), not a screenshot.
5. Run `node test/model.test.mjs`. See the simulator's endpoints
   asserted: 2.5% at month 0, 1.6% at month 27, 12.90M NEAR not issued
   by month 27 — close to, but not tuned to, the reported ~11.8M.
6. Run `node build-data.mjs`. See every API succeed or fail in the open,
   and `data.json` rewritten with fresh numbers, fresh verdicts, fresh
   timestamps. If a source dies, its panel says "unavailable" — nothing
   is ever invented to fill the gap.

## Files

| File | What it is |
| --- | --- |
| `build-data.mjs` | Pulls DefiLlama (TVL, fees, revenue, stablecoins, prices) and the NEAR public RPC; computes metrics and scorecard verdicts; writes `data.json` with sources + timestamps. |
| `model.js` | HSP-029 simulator: pure math. Grace (3 months), linear 24-month phase 2.5% → 1.6%, cumulative NEAR not issued vs status quo, staking yield path. |
| `index.html` / `style.css` / `app.js` | The static dashboard: charts (inline SVG, no libraries), scorecard, simulator, RPC snapshot, source list. |
| `THESIS.md` | The written thesis: claim, evidence for, evidence against, what would change my mind, methods, sources. |
| `test/model.test.mjs` | Simulator unit tests. Zero dependencies — plain `node`. |
| `build-single.mjs` | Inlines CSS + JS + `data.json` into `dist/near-thesis.html`. |

## Honest limits

- DefiLlama's Intents revenue record starts Oct 2025 (adapter history);
  growth multiples rest on ~13 months of third-party accounting.
- Buyback mechanics and the HSP-029 vote figures are **as reported** in
  news coverage, not independently verified on-chain in this pass.
- Daily active accounts / transaction counts would test usage directly,
  but the clean source (NEAR BigQuery public dataset) needs a paid GCP
  account — noted in THESIS.md as the reproducible next step rather
  than faked.
- The simulator is a model with stated assumptions (supply, staking
  ratio, fee burn), not a forecast.

## Same builder, other NEAR HACKATHON projects

Disclosure (per the hackathon's two-project rule): my other submitted
project in this hackathon is:

- **Pump Rider** — a one-button arcade game (Games With Real Economies
  track): ride a rocket over a scrolling memecoin chart, hold to pump,
  let go to fall, dodge the rug pulls.

Also built by me during this hackathon, but not submitted:

- **STREAK** — a memecoin with a daily streak mechanic (Memecoins With
  Mechanics track): check in daily, the community target mints, a miss
  burns, the streak is the high score.
- **Moon or Rug** — a memecoin survival game (Games With Real
  Economies track): 14 days of launches, agent rivals, one bankroll —
  how long do you survive?

Hackathon rule note: one person may submit at most 2 projects, and each
submitted project's README must name the other submitted project(s).
The final pair is the builder's call at submission time; this section
discloses all three either way.

## License

MIT (see `LICENSE`).
