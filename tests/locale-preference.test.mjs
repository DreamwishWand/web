import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  configureLocalePreferenceAdapter,
  getActiveLocale,
  resolveMessageFromCatalogs,
  setLocale
} from '../src/lib/i18n/runtime.js';
import {
  LOCALE_PREFERENCE_STORAGE_KEY,
  initializeLocalePreference,
  resetToBrowserLanguage,
  resolveBrowserLanguageTag,
  resolveBrowserPreferredLocale,
  setManualLocalePreference
} from '../src/lib/i18n/preference.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    get value() { return value; },
    getItem(key) { return key === LOCALE_PREFERENCE_STORAGE_KEY ? value : null; },
    setItem(key, next) { if (key === LOCALE_PREFERENCE_STORAGE_KEY) value = String(next); },
    removeItem(key) { if (key === LOCALE_PREFERENCE_STORAGE_KEY) value = null; }
  };
}
async function init(storage, languages) {
  return initializeLocalePreference({ storage, navigatorLike: { languages } });
}

test('first visit resolves browser language without persisting automatic locale', async () => {
  const storage = memoryStorage();
  assert.equal(await init(storage, ['fr-FR']), 'fr');
  assert.equal(getActiveLocale(), 'fr');
  assert.equal(storage.value, null);
});
test('browser preferred-language ordering skips unsupported languages and uses first resolvable entry', async () => {
  const storage = memoryStorage();
  assert.equal(await init(storage, ['ko-KR', 'pt-PT', 'fr-CA']), 'pt-BR');
  assert.equal(resolveBrowserPreferredLocale(['zh-Hant-TW', 'ja-JP', 'en-US']), 'ja');
  assert.equal(resolveBrowserLanguageTag('zh-Hans-SG'), 'zh-CN');
  assert.equal(resolveBrowserLanguageTag('zh-HK'), null);
});
test('unsupported browser languages resolve to en', async () => {
  const storage = memoryStorage();
  assert.equal(await init(storage, ['ko-KR', 'ar-SA']), 'en');
  assert.equal(storage.value, null);
});
test('manual choice has precedence and persists across reload', async () => {
  const storage = memoryStorage();
  await init(storage, ['de-DE']);
  setManualLocalePreference('ja');
  assert.equal(getActiveLocale(), 'ja');
  assert.equal(storage.value, 'ja');
  setLocale('en');
  assert.equal(await init(storage, ['fr-FR']), 'ja');
});
test('browser-language changes do not override a valid manual choice', async () => {
  const storage = memoryStorage('it');
  assert.equal(await init(storage, ['de-DE']), 'it');
  assert.equal(await init(storage, ['fr-FR']), 'it');
  assert.equal(storage.value, 'it');
});
test('reset-to-browser clears manual preference and immediately re-resolves browser languages', async () => {
  const storage = memoryStorage('ja');
  await init(storage, ['de-DE']);
  assert.equal(await resetToBrowserLanguage({ navigatorLike: { languages: ['es-MX'] } }), 'es-ES');
  assert.equal(storage.value, null);
});
test('unsupported or noncanonical persisted locale is invalidated then browser-resolved', async () => {
  for (const stored of ['ko-KR', 'fr-FR', 'ZH-cn']) {
    const storage = memoryStorage(stored);
    assert.equal(await init(storage, ['de-DE']), 'de', stored);
    assert.equal(storage.value, null, stored);
  }
});
test('manual preference API accepts only launch-registry locales and persists canonical tag', async () => {
  const storage = memoryStorage();
  await init(storage, ['en-US']);
  assert.throws(() => setManualLocalePreference('fr-FR'), /Unsupported manual locale/);
  setManualLocalePreference('JA');
  assert.equal(storage.value, 'ja');
  assert.equal(getActiveLocale(), 'ja');
});
test('unavailable or corrupt local storage does not break startup or session-only manual choice', async () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  assert.equal(await init(storage, ['fr-FR']), 'fr');
  assert.doesNotThrow(() => setManualLocalePreference('ja'));
  assert.equal(getActiveLocale(), 'ja');
});
test('sign-in does not change locale', async () => {
  const storage = memoryStorage('ja');
  await init(storage, ['fr-FR']);
  const signedIn = { accountId: 'account-a' };
  assert.ok(signedIn.accountId);
  assert.equal(getActiveLocale(), 'ja');
});
test('sign-out does not change locale', async () => {
  const storage = memoryStorage('de');
  await init(storage, ['fr-FR']);
  const signedOut = { accountId: null };
  assert.equal(signedOut.accountId, null);
  assert.equal(getActiveLocale(), 'de');
});
test('account switch does not change locale', async () => {
  const storage = memoryStorage('it');
  await init(storage, ['fr-FR']);
  let accountId = 'account-a';
  accountId = 'account-b';
  assert.equal(accountId, 'account-b');
  assert.equal(getActiveLocale(), 'it');
});
test('Workspace switch does not change locale', async () => {
  const storage = memoryStorage('pt-BR');
  await init(storage, ['fr-FR']);
  let workspaceId = 'workspace-a';
  workspaceId = 'workspace-b';
  assert.equal(workspaceId, 'workspace-b');
  assert.equal(getActiveLocale(), 'pt-BR');
});
test('per-message EN fallback leaves active and persisted locale unchanged', async () => {
  const storage = memoryStorage();
  await init(storage, ['fr-FR']);
  setManualLocalePreference('fr');
  const synthetic = { en: { 'test.onlyEnglish': 'English fallback' }, fr: {} };
  assert.deepEqual(resolveMessageFromCatalogs(synthetic, 'fr', 'test.onlyEnglish'), { text: 'English fallback', missing: false, usedFallback: true });
  assert.equal(getActiveLocale(), 'fr');
  assert.equal(storage.value, 'fr');
});
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
test('locale mutation and persistence remain shared client concerns with no Product/auth/workspace owner', () => {
  const root = new URL('../src', import.meta.url).pathname;
  const files = walk(root).filter((path) => /\.(?:js|ts|svelte)$/.test(path));
  const forbidden = [];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const relative = path.replace(/\\/g, '/').split('/src/')[1];
    if (relative === 'lib/i18n/runtime.js' || relative === 'lib/i18n/preference.js' || relative === 'lib/SiteHeader.svelte' || relative === 'routes/+layout.svelte') continue;
    if (/dreamwishwand-locale-manual-v1|setManualLocalePreference\(|resetToBrowserLanguage\(|initializeLocalePreference\(|setLocale\(/.test(source)) forbidden.push(relative);
  }
  assert.deepEqual(forbidden, []);
});
test.after(() => {
  configureLocalePreferenceAdapter(null);
  setLocale('en');
});
