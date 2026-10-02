import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORTED_LOCALES } from '../src/lib/i18n/registry.js';
import { catalogs } from '../src/lib/i18n/messages/index.js';
import { validateCatalog, placeholders } from '../src/lib/i18n/catalog-schema.js';
import { applyDocumentLanguage, resolveMessageFromCatalogs, formatDate, formatNumber } from '../src/lib/i18n/runtime.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('launch locale registry and catalogs are exactly present', () => {
  assert.deepEqual(SUPPORTED_LOCALES.map((x) => x.code), ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
  assert.deepEqual(Object.keys(catalogs).sort(), SUPPORTED_LOCALES.map((x) => x.code).sort());
});

test('catalogs have no missing/orphan keys and interpolation placeholders match fallback', () => {
  const base = catalogs.en, baseKeys = Object.keys(base).sort();
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = catalogs[locale.code];
    assert.deepEqual(validateCatalog(catalog), [], locale.code);
    assert.deepEqual(Object.keys(catalog).sort(), baseKeys, locale.code);
    for (const key of baseKeys) assert.deepEqual(placeholders(catalog[key]), placeholders(base[key]), `${locale.code}:${key}`);
  }
});

test('runtime missing-key fallback is explicit and deterministic', () => {
  const synthetic = { en: { 'shared.test.message': 'Fallback {name}' }, fr: {} };
  assert.deepEqual(resolveMessageFromCatalogs(synthetic, 'fr', 'shared.test.message', { name: 'Wand' }), { text: 'Fallback Wand', missing: false, usedFallback: true });
  const missing = resolveMessageFromCatalogs(synthetic, 'fr', 'shared.test.unknown');
  assert.equal(missing.text, '⟦shared.test.unknown⟧');
  assert.equal(missing.missing, true);
});

test('plural interpolation and Intl formatting APIs are locale-aware', () => {
  assert.equal(resolveMessageFromCatalogs(catalogs, 'en', 'shared.items.count', { count: 1 }).text, '1 item');
  assert.equal(resolveMessageFromCatalogs(catalogs, 'en', 'shared.items.count', { count: 2 }).text, '2 items');
  assert.notEqual(formatNumber(1234.5, {}, 'en'), formatNumber(1234.5, {}, 'de'));
  assert.equal(typeof formatDate(new Date('2026-10-02T00:00:00Z'), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }, 'ja'), 'string');
});

test('HTML lang is controlled by locale runtime, not a static Japanese assumption', () => {
  assert.doesNotMatch(read('src/app.html'), /<html\s+lang="ja"/);
  const fakeDocument = { documentElement: { lang: 'en', dataset: {} } };
  assert.equal(applyDocumentLanguage(fakeDocument, 'zh-CN'), true);
  assert.equal(fakeDocument.documentElement.lang, 'zh-CN');
  assert.equal(fakeDocument.documentElement.dataset.locale, 'zh-CN');
});

test('shared accessibility primitives exist and focus-visible covers form controls', () => {
  const css = read('src/app.css');
  assert.match(css, /\.visually-hidden/);
  assert.match(css, /:where\([^)]*select[^)]*\):focus-visible/);
  for (const path of ['src/lib/a11y/LiveRegion.svelte','src/lib/a11y/FieldError.svelte','src/lib/a11y/forms.js','src/lib/a11y/dialog-focus.js','src/lib/a11y/disabled.js']) assert.ok(read(path).length > 0, path);
});
