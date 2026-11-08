// check-cdp.mjs — headless verification for the in-grid scenario round.
// Drives dist/near-thesis.html in real Chrome via CDP at 390x844 and asserts:
//   (1) the Scenario Lab section is gone; every stat box carries a slider;
//   (2) SYNCHRONY: dragging the Intents-fees slider in one box moves the
//       coupled boxes' values AND their slider positions, while an
//       uncoupled box (market cap) stays put — and vice versa for price;
//   (3) inferred values carry the EST tag + a delta vs actual; TVL's
//       slider moves only TVL;
//   (4) scorecard verdicts re-grade live (fees x0.1 flips fee-capture to
//       contradicted, flagged "under your scenario");
//   (5) Reset restores actuals, hides EST tags, restores verdicts;
//   (6) per-stat accent colours: label hue + light-tint value for price
//       (gold), TVL (blue), Intents revenue (green); LIVE dot present,
//       red, pulsing; slider accent matches the box hue;
//   (7) page height at 390x844 is recorded to page-height.json;
//   (8) typography round: embedded Space Grotesk / Inter applied and
//       loaded, colon title, all-caps headings, the dashboard toolbar
//       aligned flush (pill left == text/box left, Reset right == grid
//       right, shared baseline);
//   (9) the dist opened via file:// renders with ZERO external requests.
// Also regenerates the verification screenshots (mobile full-page dark,
// light grid close-up). Run: node build-single.mjs && node verification/check-cdp.mjs

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8943;
const CDP_PORT = 9343;
const CHROME_CANDIDATES = [
  process.env.CHROME,
  process.env.HOME + '/rec-tools/browsers/chrome/linux-157.0.8103.38/chrome-linux64/chrome',
  '/opt/meta-chromium/chrome',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error('FAIL: no Chrome binary found'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
  if (!cond) failures += 1;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(PORT, r));

const profile = mkdtempSync(join(tmpdir(), 'nt-check-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('Chrome CDP never came up');
}
await waitForCdp();
const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let msgId = 0;
const pending = new Map();
const netRequests = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Network.requestWillBeSent') netRequests.push(m.params.request.url);
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};
const shot = async (name, beyond = false) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: beyond });
  writeFileSync(new URL(name, import.meta.url), Buffer.from(r.result.data, 'base64'));
  console.log('screenshot ->', name);
};
async function load(qs) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/dist/near-thesis.html?${qs}` });
  for (let i = 0; i < 60; i++) {
    if (await ev(`!!document.querySelector('[data-box="price"] [data-v]')?.textContent`).catch(() => false)) { await sleep(200); return; }
    await sleep(200);
  }
  throw new Error('dashboard never rendered');
}
const setSlider = (box, value) => ev(`(() => { const el = document.querySelector('[data-slider="${box}"]');
  el.value = String(${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return Number(el.value); })()`);
const boxState = (box) => ev(`(() => { const b = document.querySelector('[data-box="${box}"]');
  return { v: b.querySelector('[data-v]').textContent, d: b.querySelector('[data-d]').textContent,
           est: !b.querySelector('[data-est]').hidden, slider: Number(b.querySelector('[data-slider]').value) }; })()`);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

// ================================================================= DARK ==
await load('theme=dark');

// (1) Structure: no lab, sliders in boxes.
const structure = await ev(`(() => ({ lab: !!document.getElementById('scenario-lab'),
  boxes: document.querySelectorAll('.stats-grid .stat').length,
  sliders: document.querySelectorAll('.stats-grid .box-slider').length,
  couplings: !!document.getElementById('grid-couplings') }))()`);
check('(1a) Scenario Lab section is gone', structure.lab === false);
check('(1b) every stat box carries a slider', structure.boxes >= 15 && structure.sliders === structure.boxes,
  `${structure.sliders}/${structure.boxes} boxes`);
check('(1c) coupling note still on the page', structure.couplings === true);

// Baseline snapshot at actuals.
const base = {};
for (const id of ['price', 'tvl', 'intents-revenue', 'chain-revenue', 'intents-fees', 'market-cap', 'chain-fees', 'share']) {
  base[id] = await boxState(id);
}
check('(1d) at rest, no EST tags and no deltas', Object.values(base).every((s) => !s.est && s.d === ''),
  JSON.stringify(base['intents-revenue']));
const feesActual = base['intents-fees'].slider;
const priceActual = base['price'].slider;

// (2) Synchrony via the fees driver: drag the slider inside the
// Intents-revenue box to 1.5x actual fees.
await setSlider('intents-revenue', feesActual * 1.5);
const after = {};
for (const id of Object.keys(base)) after[id] = await boxState(id);
check('(2a) fees slider in the revenue box set the fees driver', Math.abs(after['intents-fees'].slider - feesActual * 1.5) < 1,
  `fees slider=${after['intents-fees'].slider}`);
check('(2b) coupled slider moved in sync (chain revenue box)', Math.abs(after['chain-revenue'].slider - feesActual * 1.5) < 1,
  `chain-revenue slider=${after['chain-revenue'].slider}`);
check('(2c) coupled values re-inferred (revenue up)', after['intents-revenue'].v !== base['intents-revenue'].v
  && after['chain-revenue'].v !== base['chain-revenue'].v, `${base['intents-revenue'].v} -> ${after['intents-revenue'].v}`);
const shareNum = (s) => parseFloat(s.replace('%', ''));
check('(2d) share rose with fees', shareNum(after['share'].v) > shareNum(base['share'].v),
  `${base['share'].v} -> ${after['share'].v}`);
check('(2e) uncoupled box untouched (market cap)', after['market-cap'].v === base['market-cap'].v
  && Math.abs(after['market-cap'].slider - priceActual) < 1e-9, after['market-cap'].v);
check('(2f) chain fees follow the txns coupling, not fees', after['chain-fees'].v === base['chain-fees'].v, after['chain-fees'].v);

// (3) EST honesty on a bent box; TVL independence.
check('(3a) bent box carries EST tag + delta vs actual', after['intents-revenue'].est && /vs actual/.test(after['intents-revenue'].d),
  after['intents-revenue'].d);
const tvlBefore = await boxState('tvl');
await setSlider('tvl', tvlBefore.slider * 1.2);
const tvlAfter = await boxState('tvl');
const revAfterTvl = await boxState('intents-revenue');
check('(3b) TVL slider moves TVL only', tvlAfter.v !== tvlBefore.v && revAfterTvl.v === after['intents-revenue'].v,
  `${tvlBefore.v} -> ${tvlAfter.v}`);

// Price synchrony the other way: drag the market-cap box's price slider.
await setSlider('market-cap', priceActual * 2);
const priceAfter = await boxState('price');
const mcapAfter = await boxState('market-cap');
check('(2g) price slider in the market-cap box drives the price box', Math.abs(priceAfter.slider - priceActual * 2) < 1e-9
  && priceAfter.v === `$${(priceActual * 2).toFixed(2)}`, priceAfter.v);
check('(2h) market cap doubled with price', mcapAfter.v !== after['market-cap'].v, mcapAfter.v);

// (4) Verdict re-grade: fees to a tenth flips fee-capture.
await ev(`document.getElementById('grid-reset').click()`);
await setSlider('intents-fees', feesActual * 0.1);
const verdict = await ev(`(() => { const card = document.querySelector('[data-claim="fee-capture-material"]');
  return { badge: card.querySelector('.badge').textContent, differs: card.classList.contains('differs'),
           tagHidden: card.querySelector('.scenario-tag').hidden }; })()`);
check('(4) fees x0.1 flips fee-capture verdict to contradicted, flagged',
  verdict.badge === 'contradicted' && verdict.differs && !verdict.tagHidden, JSON.stringify(verdict));

// (5) Reset restores everything.
await ev(`document.getElementById('grid-reset').click()`);
const resetState = await boxState('intents-revenue');
const resetVerdict = await ev(`document.querySelector('[data-claim="fee-capture-material"] .badge').textContent`);
check('(5a) reset restores actual value, EST off', resetState.v === base['intents-revenue'].v && !resetState.est
  && Math.abs(resetState.slider - feesActual) < 1, resetState.v);
check('(5b) reset restores the published verdict', resetVerdict === 'supported', resetVerdict);

// (6) Colours + LIVE dot (dark theme).
const colors = await ev(`(() => { const cs = (box, sel) => getComputedStyle(document.querySelector('[data-box="' + box + '"] ' + sel));
  const k = (box) => cs(box, '.k').color; const v = (box) => cs(box, '.v').color;
  const dot = document.querySelector('.live-dot'); const dcs = getComputedStyle(dot);
  const live = document.querySelector('.live');
  return { priceK: k('price'), priceV: v('price'), tvlK: k('tvl'), tvlV: v('tvl'),
    revK: k('intents-revenue'), revV: v('intents-revenue'),
    dotBg: dcs.backgroundColor, dotAnim: dcs.animationName, liveColor: getComputedStyle(live).color,
    sliderAccent: cs('price', '.box-slider').accentColor }; })()`);
check('(6a) price label is gold', colors.priceK === 'rgb(227, 179, 65)', colors.priceK);
check('(6b) price value is the light gold tint', colors.priceV === 'rgb(247, 236, 210)', colors.priceV);
check('(6c) TVL label blue / value light blue', colors.tvlK === 'rgb(94, 168, 232)' && colors.tvlV === 'rgb(220, 236, 251)',
  `${colors.tvlK} / ${colors.tvlV}`);
check('(6d) Intents revenue label green / value light green', colors.revK === 'rgb(70, 201, 126)' && colors.revV === 'rgb(219, 246, 229)',
  `${colors.revK} / ${colors.revV}`);
check('(6e) LIVE dot exists, red, pulsing; LIVE word red', colors.dotBg === 'rgb(224, 92, 92)'
  && colors.dotAnim === 'live-pulse' && colors.liveColor === 'rgb(224, 92, 92)',
  `${colors.dotBg} anim=${colors.dotAnim}`);
check('(6f) slider takes the box accent', colors.sliderAccent === 'rgb(227, 179, 65)', colors.sliderAccent);

// Diagnostics: where the height sits.
const diag = await ev(`(() => { const o = {};
  o.gridSection = Math.round(document.querySelector('#stats').closest('section').getBoundingClientRect().height);
  o.boxH = [...document.querySelectorAll('.stats-grid .stat')].map((b) => Math.round(b.getBoundingClientRect().height)).join(',');
  o.couplingsInDetails = !!document.querySelector('#grid-couplings')?.closest('details');
  return o; })()`);
console.log('diagnostics:', JSON.stringify(diag));

// (7) Page height.
const height = await ev(`document.documentElement.scrollHeight`);
const screens = +(height / 844).toFixed(2);
writeFileSync(new URL('page-height.json', import.meta.url),
  JSON.stringify({ width: 390, viewportHeight: 844, scrollHeight: height, screens, measuredAt: new Date().toISOString() }, null, 2) + '\n');
check('(7) page height recorded', height > 0, `${height}px = ${screens} screens (was 9902px = 11.73 before this rework)`);
await shot('mobile-full-dark.png', true);

// (8) Typography round: fonts applied AND loaded, colon title, caps
// headings, toolbar alignment (all in the dark theme, at rest).
for (let i = 0; i < 20; i++) {
  if (await ev(`document.fonts.check('700 23px "Space Grotesk"') && document.fonts.check('400 14px "Inter"')`).catch(() => false)) break;
  await sleep(150);
}
const typo = await ev(`(() => { const cs = (el) => getComputedStyle(el);
  const h1 = document.querySelector('h1');
  const h2s = [...document.querySelectorAll('h2')];
  return { title: document.title, h1Text: h1.textContent.trim(),
    h1Font: cs(h1).fontFamily, h1Caps: cs(h1).textTransform,
    bodyFont: cs(document.body).fontFamily,
    statVFont: cs(document.querySelector('[data-box="price"] [data-v]')).fontFamily,
    h2Caps: h2s.map((h) => cs(h).textTransform),
    sgLoaded: document.fonts.check('700 23px "Space Grotesk"'),
    sg600: document.fonts.check('600 13px "Space Grotesk"'),
    interLoaded: document.fonts.check('400 14px "Inter"'),
    inter600: document.fonts.check('600 12px "Inter"') }; })()`);
check('(8a) h1 renders in Space Grotesk', /Space Grotesk/.test(typo.h1Font), typo.h1Font);
check('(8b) body text renders in Inter', /Inter/.test(typo.bodyFont), typo.bodyFont);
check('(8c) stat values take the display font', /Space Grotesk/.test(typo.statVFont), typo.statVFont);
check('(8d) embedded faces actually loaded (not just named)',
  typo.sgLoaded && typo.sg600 && typo.interLoaded && typo.inter600,
  `sg700=${typo.sgLoaded} sg600=${typo.sg600} inter400=${typo.interLoaded} inter600=${typo.inter600}`);
check('(8e) title uses the colon form', typo.title.startsWith('NEAR: ON THE EVIDENCE') && typo.h1Text === 'NEAR: ON THE EVIDENCE',
  `${typo.title} | h1: ${typo.h1Text}`);
check('(8f) headings are all caps', typo.h1Caps === 'uppercase' && typo.h2Caps.every((t) => t === 'uppercase'),
  `h1=${typo.h1Caps} h2=${typo.h2Caps.join(',')}`);

const align = await ev(`(() => { const r = (el) => { const b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, cy: b.top + b.height / 2 }; };
  const toolbar = document.querySelector('.grid-toolbar');
  const stats = document.getElementById('stats');
  const boxes = document.querySelectorAll('.stats-grid .stat');
  return { pill: r(toolbar.querySelector('.est-tag')), note: r(toolbar.nextElementSibling),
    firstBox: r(boxes[0]), topRightBox: r(boxes[1]), stats: r(stats),
    reset: r(document.getElementById('grid-reset')) }; })()`);
const near1 = (a, b) => Math.abs(a - b) <= 1;
check('(8g) toolbar pill flush with the paragraph + first box left edge',
  near1(align.pill.left, align.note.left) && near1(align.pill.left, align.firstBox.left),
  `pill=${align.pill.left.toFixed(1)} note=${align.note.left.toFixed(1)} box=${align.firstBox.left.toFixed(1)}`);
check('(8h) Reset flush with the grid right edge',
  near1(align.reset.right, align.stats.right) && near1(align.reset.right, align.topRightBox.right),
  `reset=${align.reset.right.toFixed(1)} grid=${align.stats.right.toFixed(1)} box=${align.topRightBox.right.toFixed(1)}`);
check('(8i) pill and Reset share a baseline', Math.abs(align.pill.cy - align.reset.cy) <= 2,
  `pill cy=${align.pill.cy.toFixed(1)} reset cy=${align.reset.cy.toFixed(1)}`);

// ================================================================ LIGHT ==
await load('theme=light');
const lightColors = await ev(`(() => { const cs = (box, sel) => getComputedStyle(document.querySelector('[data-box="' + box + '"] ' + sel));
  return { priceK: cs('price', '.k').color, priceV: cs('price', '.v').color,
           bg: getComputedStyle(document.body).backgroundColor }; })()`);
check('(6g) light theme deepens the accents', lightColors.priceK === 'rgb(138, 95, 4)' && lightColors.priceV === 'rgb(95, 69, 10)',
  `${lightColors.priceK} / ${lightColors.priceV}`);
await ev(`window.scrollTo(0, 0)`);
await shot('grid-light.png');

// ============================================================ OFFLINE ===
// The dist opened straight from disk (file://), exactly how a judge
// would open it: it must render with the embedded fonts and fire ZERO
// external (http/https) network requests.
await send('Network.enable');
netRequests.length = 0;
await send('Page.navigate', { url: 'file://' + join(ROOT, 'dist/near-thesis.html') + '?theme=dark' });
let fileRendered = false;
for (let i = 0; i < 60; i++) {
  if (await ev(`!!document.querySelector('[data-box="price"] [data-v]')?.textContent`).catch(() => false)) { fileRendered = true; break; }
  await sleep(200);
}
await sleep(500);
check('(9a) dist renders opened from disk (file://)', fileRendered);
const external = netRequests.filter((u) => /^https?:\/\//.test(u));
check('(9b) zero external network requests from disk', external.length === 0,
  external.length ? external.join(', ') : `${netRequests.length} request(s), all local`);
const fileFonts = await ev(`document.fonts.check('700 23px "Space Grotesk"') && document.fonts.check('400 14px "Inter"')`)
  .catch(() => false);
check('(9c) embedded fonts load from disk too', fileFonts === true);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
chrome.kill(); server.close();
process.exit(failures === 0 ? 0 : 1);
