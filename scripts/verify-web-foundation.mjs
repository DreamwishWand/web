import { SUPPORTED_LOCALES, FALLBACK_LOCALE } from '../src/lib/i18n/registry.js';
import { placeholders, validateCatalog } from '../src/lib/i18n/catalog-schema.js';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const errors = [];
const report = { fallbackLocale: FALLBACK_LOCALE, expectedLocales: SUPPORTED_LOCALES.map((x) => x.code), catalogs: {}, contrast: {} };
const catalogs = {};

for (const locale of SUPPORTED_LOCALES) {
  try {
    const module = await import(new URL(`src/lib/i18n/messages/${locale.code}.js`, root).href);
    catalogs[locale.code] = module.default;
    const schemaErrors = validateCatalog(module.default);
    errors.push(...schemaErrors.map((message) => `${locale.code}: ${message}`));
  } catch (error) {
    errors.push(`${locale.code}: catalog missing or unreadable (${error.message})`);
  }
}

const base = catalogs[FALLBACK_LOCALE] ?? {};
const baseKeys = Object.keys(base).sort();
for (const locale of SUPPORTED_LOCALES) {
  const catalog = catalogs[locale.code] ?? {};
  const keys = Object.keys(catalog).sort();
  const missing = baseKeys.filter((key) => !(key in catalog));
  const orphan = keys.filter((key) => !(key in base));
  const interpolationMismatch = [];
  for (const key of baseKeys.filter((candidate) => candidate in catalog)) {
    const expected = placeholders(base[key]).join(',');
    const actual = placeholders(catalog[key]).join(',');
    if (expected !== actual) interpolationMismatch.push({ key, expected, actual });
  }
  report.catalogs[locale.code] = { keys: keys.length, missing, orphan, interpolationMismatch };
  if (missing.length) errors.push(`${locale.code}: missing keys: ${missing.join(', ')}`);
  if (orphan.length) errors.push(`${locale.code}: orphan keys: ${orphan.join(', ')}`);
  for (const mismatch of interpolationMismatch) errors.push(`${locale.code}: interpolation mismatch for ${mismatch.key}; expected [${mismatch.expected}] got [${mismatch.actual}]`);
}

const css = readFileSync(new URL('src/app.css', root), 'utf8');
const dayBlock = css.match(/:root\[data-theme='day'\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
function token(name) {
  const match = dayBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)`));
  if (!match) throw new Error(`Missing day token --${name}`);
  const value = match[1];
  return value.length === 4 ? `#${value.slice(1).split('').map((ch) => ch + ch).join('')}` : value;
}
function luminance(hex) {
  const rgb = [1,3,5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a,b) {
  const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (values[0]+0.05)/(values[1]+0.05);
}
const gold = token('gold');
for (const name of ['page','page-2','surface','surface-raised','hero-day-start','hero-day-mid','hero-day-end']) {
  const ratio = contrast(gold, token(name));
  report.contrast[`gold/${name}`] = Number(ratio.toFixed(3));
  if (ratio < 4.5) errors.push(`day --gold contrast against --${name} is ${ratio.toFixed(2)}:1 (<4.5:1)`);
}

console.log(JSON.stringify(report, null, 2));
if (errors.length) {
  console.error('\nShared web foundation verification failed:\n- ' + errors.join('\n- '));
  process.exitCode = 1;
}
