// Checks that the built single-file bundle ships both themes and the
// toggle. Run after the build: node build-single.mjs && npm test

import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const distPath = new URL('../dist/near-thesis.html', import.meta.url);
assert.ok(existsSync(distPath), 'dist/near-thesis.html exists — run: node build-single.mjs');

const html = readFileSync(distPath, 'utf8');
assert.ok(html.includes('[data-theme="dark"]'), 'dist contains the [data-theme="dark"] styles');
assert.ok(html.includes('[data-theme="light"]'), 'dist contains the [data-theme="light"] styles');
assert.ok(html.includes('id="theme-toggle"'), 'dist contains the theme toggle button');
assert.ok(html.includes("localStorage.getItem('near-thesis-theme')"), 'dist reads the persisted theme choice');
assert.ok(html.includes("localStorage.setItem(THEME_KEY"), 'dist persists the theme choice on toggle');
assert.ok(html.includes('--chart-accent'), 'dist defines themed chart colours');

console.log('theme.test.mjs: all assertions passed');
