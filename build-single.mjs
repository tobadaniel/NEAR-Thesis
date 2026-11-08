// Builds dist/near-thesis.html: the whole dashboard in one file — CSS,
// model.js, app.js, the embedded fonts and the fetched data.json
// inlined — so anyone can open it with no server and no network.
// Run: node build-single.mjs
// (Run node build-data.mjs first if you want fresher data inlined.)

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

const css = inlineFonts(readFileSync('style.css', 'utf8'));
const data = readFileSync('data.json', 'utf8');
const js = ['model.js', 'scenario.js', 'app.js']
  .map((f) => stripModuleSyntax(readFileSync(f, 'utf8')))
  .join('\n\n');

let html = readFileSync('index.html', 'utf8');
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

mkdirSync('dist', { recursive: true });
writeFileSync('dist/near-thesis.html', html);
console.log('Wrote dist/near-thesis.html', html.length, 'bytes');
