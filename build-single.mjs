// Builds the dashboard in one file — CSS, model.js, app.js, the embedded
// fonts and the fetched data.json inlined — so anyone can open it with
// no server and no network.
// Run: node build-single.mjs
// (Run node build-data.mjs first if you want fresher data inlined.)
//
// Two variants (distribution split, 2026-11-08):
//   default (hackathon) -> dist/near-thesis.html — carries the NEAR
//     Hackathon badge in the header and the independent-dashboard line
//     in the footer. This is the GitHub / GitHub Pages face.
//   NEAR_VARIANT=product -> dist-product/near-thesis.html — the SAME
//     dashboard with the badge, its CSS and the footer line stripped:
//     no hackathon inscriptions at all. This is the Netlify product face.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function stripModuleSyntax(code) {
  return code
    .replace(/import[\s\S]*?from\s+'[^']+';/g, '') // import blocks
    .replace(/^export\s+/gm, ''); // export prefixes
}

// The @font-face rules in style.css point at fonts/*.woff2 for the
// modular view; in the single file they become base64 data URIs so the
// typography survives being opened straight from disk, fully offline.
// (Function replacement again — inserted verbatim, no "$" surprises.)
function inlineFonts(css) {
  return css.replace(/url\("fonts\/([\w.-]+\.woff2)"\)/g, (m, name) => {
    const b64 = readFileSync(join('fonts', name)).toString('base64');
    return `url("data:font/woff2;base64,${b64}")`;
  });
}

const variant = process.env.NEAR_VARIANT === 'product' ? 'product' : 'hackathon';

let css = inlineFonts(readFileSync('style.css', 'utf8'));
const data = readFileSync('data.json', 'utf8');
const js = ['model.js', 'scenario.js', 'app.js']
  .map((f) => stripModuleSyntax(readFileSync(f, 'utf8')))
  .join('\n\n');

let html = readFileSync('index.html', 'utf8');
if (variant === 'product') {
  // Strip the two affiliation inscriptions and the badge's CSS block so
  // the product copy carries no hackathon wording anywhere, not even in
  // class names or comments in the inlined style.
  html = html
    .replace(/\s*<p class="hackathon-badge">[\s\S]*?<\/p>/, '')
    .replace(/\s*<p class="dim attribution">[\s\S]*?<\/p>/, '');
  css = css.replace(/\/\* NEAR affiliation badge[\s\S]*?\.attribution \{[^}]*\}\n/, '');
}
// Replacement FUNCTIONS, not strings: String.replace treats "$$" in a
// replacement string as an escaped literal "$", which silently ate the
// dollar sign of every `$${...}` template in the inlined JS (the bundle
// showed "67,187/day" instead of "$67,187/day"). A function replacement
// is inserted verbatim.
html = html.replace(
  '<link rel="stylesheet" href="style.css">',
  () => `<style>\n${css}\n</style>`,
);
html = html.replace(
  '<script type="module" src="app.js"></script>',
  () => `<script>window.__NEAR_DATA__ = ${data};</script>\n<script type="module">\n${js}\n</script>`,
);

if (variant === 'product' && /hackathon/i.test(html)) {
  throw new Error('product variant still contains hackathon wording — strip failed');
}
if (variant === 'hackathon' && !html.includes('hackathon-badge')) {
  throw new Error('hackathon variant lost its badge — source changed?');
}
const outDir = variant === 'product' ? 'dist-product' : 'dist';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'near-thesis.html'), html);
console.log(`Wrote ${outDir}/near-thesis.html (${variant})`, html.length, 'bytes');
