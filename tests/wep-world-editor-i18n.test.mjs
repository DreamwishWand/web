import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SUPPORTED_LOCALES } from '../src/lib/i18n/registry.js';
import { catalogs } from '../src/lib/i18n/messages/index.js';
import { placeholders } from '../src/lib/i18n/catalog-schema.js';
import { resolveMessageFromCatalogs, setLocale } from '../src/lib/i18n/runtime.js';
import {
  BLOCKER_CODES,
  CORE_REASON_CODES,
  machineCodeSegment
} from '../src/lib/i18n/messages/world-editor/_factory.js';
import {
  localizeCoreReason,
  localizeWepBlocker
} from '../src/lib/wep/world-editor-i18n.ts';
import {
  buildPrimaryJobAvailability,
  describeDraftValidation
} from '../src/lib/wep/world-editor-primary-job.ts';
import { normalizeEditorDocument } from '../src/lib/wep/editor-runtime.ts';

const launchLocales = ['en', 'fr', 'it', 'de', 'es-ES', 'ja', 'zh-CN', 'pt-BR'];
const routeSource = readFileSync(
  new URL('../src/routes/editor/world/+page.svelte', import.meta.url),
  'utf8'
);

test('World Editor resources cover all eight launch locales with identical keys and placeholders', () => {
  assert.deepEqual(SUPPORTED_LOCALES.map((entry) => entry.code), launchLocales);
  const baseKeys = Object.keys(catalogs.en)
    .filter((key) => key.startsWith('worldEditor.'))
    .sort();
  assert.ok(baseKeys.length >= 650);

  for (const locale of launchLocales) {
    const keys = Object.keys(catalogs[locale])
      .filter((key) => key.startsWith('worldEditor.'))
      .sort();
    assert.deepEqual(keys, baseKeys, locale);
    for (const key of baseKeys) {
      assert.deepEqual(
        placeholders(catalogs[locale][key]),
        placeholders(catalogs.en[key]),
        locale + ':' + key
      );
    }
  }
});

test('World Editor launch catalogs are translated resources rather than English copies', () => {
  const keys = Object.keys(catalogs.en).filter((key) => key.startsWith('worldEditor.'));
  for (const locale of launchLocales.filter((code) => code !== 'en')) {
    const changed = keys.filter(
      (key) => JSON.stringify(catalogs[locale][key]) !== JSON.stringify(catalogs.en[key])
    ).length;
    assert.ok(
      changed >= 300,
      locale + ' changes only ' + changed + '/' + keys.length + ' World Editor messages'
    );
  }
});

test('all 70 blocker and 24 Core reason identities resolve localized presentation without mutation', () => {
  assert.equal(BLOCKER_CODES.length, 70);
  assert.equal(CORE_REASON_CODES.length, 24);

  for (const locale of launchLocales) {
    for (const code of BLOCKER_CODES) {
      const segment = machineCodeSegment(code);
      for (const field of ['title', 'message', 'action']) {
        const key = 'worldEditor.blocker.' + segment + '.' + field;
        const result = resolveMessageFromCatalogs(catalogs, locale, key);
        assert.equal(result.missing, false, locale + ':' + key);
        assert.ok(result.text.length > 0, locale + ':' + key);
      }
      assert.equal(localizeWepBlocker(code, locale).code, code);
    }

    for (const code of CORE_REASON_CODES) {
      const key = 'worldEditor.coreReason.' + machineCodeSegment(code);
      const result = resolveMessageFromCatalogs(catalogs, locale, key);
      assert.equal(result.missing, false, locale + ':' + key);
      assert.ok(result.text.length > 0, locale + ':' + key);
    }
  }

  assert.notEqual(
    localizeWepBlocker('NATIVE_PLACEMENT_INVALID', 'en').message,
    localizeWepBlocker('NATIVE_PLACEMENT_INVALID', 'ja').message
  );
  assert.notEqual(
    localizeCoreReason('MISSION_ITEM_READ_ONLY', 'en'),
    localizeCoreReason('MISSION_ITEM_READ_ONLY', 'fr')
  );
});

test('Character House Core reason is explicitly localized in every non-English launch locale', () => {
  const code =
    'CHARACTER_HOUSE_PRESENCE_SIDE_EFFECTS_REQUIRE_DEDICATED_LIFECYCLE';
  const english = localizeCoreReason(code, 'en');
  assert.match(english, /Character House/);
  for (const locale of launchLocales.filter((entry) => entry !== 'en')) {
    const localized = localizeCoreReason(code, locale);
    assert.notEqual(localized, english, locale);
    assert.ok(localized.length > 0, locale);
  }
});

test('every static World Editor message key referenced by the route resolves in every launch locale', () => {
  const keys = [...routeSource.matchAll(/['"](worldEditor\.[a-zA-Z0-9.]+)['"]/g)]
    .map((match) => match[1]);
  assert.ok(keys.length > 150);

  for (const key of new Set(keys)) {
    for (const locale of launchLocales) {
      const result = resolveMessageFromCatalogs(catalogs, locale, key);
      assert.equal(result.missing, false, locale + ':' + key);
    }
  }
});

test('shared fallback is deterministic for unsupported locale and missing locale entry', () => {
  const key = 'worldEditor.command.rotate';
  assert.equal(
    resolveMessageFromCatalogs(catalogs, 'xx-UNSUPPORTED', key).text,
    catalogs.en[key]
  );

  const synthetic = {
    en: { 'worldEditor.test.fallback': 'Fallback {name}' },
    fr: {}
  };
  assert.deepEqual(
    resolveMessageFromCatalogs(
      synthetic,
      'fr',
      'worldEditor.test.fallback',
      { name: 'Wand' }
    ),
    { text: 'Fallback Wand', missing: false, usedFallback: true }
  );
  assert.equal(
    resolveMessageFromCatalogs(synthetic, 'fr', 'worldEditor.test.missing').text,
    '⟦worldEditor.test.missing⟧'
  );
});

test('locale switching changes presentation but not editor state, preflight, or command authorization', () => {
  const document = normalizeEditorDocument({
    target: { gameVersion: '1.25.0', platform: 'synthetic' },
    objects: [
      {
        editorId: 'editable',
        itemId: 40000001,
        layer: 'furniture',
        x: 1,
        y: 2,
        orientation: 0,
        footprint: [{ x: 0, y: 0 }],
        dependencyIds: [],
        editability: 'editable',
        metadata: { displayName: 'Editable chair' }
      },
      {
        editorId: 'protected',
        itemId: 40000002,
        layer: 'furniture',
        x: 3,
        y: 4,
        orientation: 0,
        footprint: [{ x: 0, y: 0 }],
        dependencyIds: [],
        editability: 'readonly',
        metadata: {
          displayName: 'Protected object',
          reasons: ['PROGRESSION_OWNERSHIP_UNKNOWN']
        }
      }
    ]
  });

  const validation = {
    ok: false,
    issues: [{ severity: 'BLOCK', code: 'NATIVE_PLACEMENT_UNVERIFIED' }]
  };

  setLocale('en');
  const documentBefore = structuredClone(document);
  const authorizationBefore = buildPrimaryJobAvailability({
    document,
    selectionIds: ['editable'],
    mutationBound: true,
    sessionAvailable: true,
    clipboardObjectCount: 0,
    canUndo: false,
    canRedo: false,
    originalBackupAvailable: false
  });
  const preflightBefore = describeDraftValidation(validation);
  const englishPresentation =
    localizeWepBlocker('NATIVE_PLACEMENT_UNVERIFIED', 'en').message;

  setLocale('ja');
  const authorizationAfter = buildPrimaryJobAvailability({
    document,
    selectionIds: ['editable'],
    mutationBound: true,
    sessionAvailable: true,
    clipboardObjectCount: 0,
    canUndo: false,
    canRedo: false,
    originalBackupAvailable: false
  });
  const preflightAfter = describeDraftValidation(validation);
  const japanesePresentation =
    localizeWepBlocker('NATIVE_PLACEMENT_UNVERIFIED', 'ja').message;

  assert.deepEqual(document, documentBefore);
  assert.deepEqual(authorizationAfter, authorizationBefore);
  assert.deepEqual(preflightAfter, preflightBefore);
  assert.notEqual(japanesePresentation, englishPresentation);
  setLocale('en');
});

test('World Editor route retains machine values and persistent writer boundary while presentation is localized', () => {
  for (const machineToken of [
    'NATIVE_PLACEMENT_CLASSES',
    'TOPOLOGY_CLIPPED_UNSUPPORTED',
    'persistentWriteAuthorized: false',
    'value="unlisted"',
    'value="public"',
    'value="private"'
  ]) {
    assert.ok(routeSource.includes(machineToken), machineToken);
  }
  assert.doesNotMatch(routeSource, /--gold\s*:/);
  assert.match(routeSource, /worldEditor\.scene\.captureBlocked/);
  assert.match(routeSource, /worldEditor\.fullDesign\.preflightBoundary/);
  assert.match(routeSource, /worldEditor\.progression\.explanation/);
  assert.match(routeSource, /bind:value=\{query\}/);
  assert.match(routeSource, /wep-reason-move/);
  assert.match(
    routeSource,
    /tabindex=\{object\.editorId === canvasFocusEditorId \? 0 : -1\}/
  );
});
