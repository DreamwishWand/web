import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const inventory = JSON.parse(
  readFileSync(
    new URL('../docs/wep/world-editor-localization-inventory-20261002.json', import.meta.url),
    'utf8'
  )
);

function gitBlobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

const expectedCategories = [
  'navigation',
  'buttons',
  'inspector',
  'validation',
  'blockerExplanation',
  'saveOpen',
  'backupExportPrep',
  'selection',
  'roadFence',
  'sceneCapture',
  'storeInspector',
  'progressionProtection',
  'errorsStatusLiveRegions'
];

test('World Editor localization inventory is complete for its pinned presentation sources', () => {
  assert.equal(inventory.status, 'COMPLETE_FOR_PINNED_SOURCES');
  assert.deepEqual(Object.keys(inventory.categories), expectedCategories);

  for (const [path, expectedSha] of Object.entries(inventory.sourcePins)) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.equal(
      gitBlobSha(source),
      expectedSha,
      `${path} changed; refresh the complete World Editor localization inventory before accepting localization work`
    );
  }
});

test('World Editor inventory binds the eight launch locales through the shared runtime without a WEP locale runtime', () => {
  assert.deepEqual(
    inventory.launchLocales,
    ['EN', 'FR', 'IT', 'DE', 'ES-ES', 'JA', 'ZH-CN', 'PT-BR']
  );
  assert.equal(
    inventory.sharedLocaleBinding.status,
    'BOUND_SHARED_WEB_V1'
  );
  assert.equal(inventory.sharedLocaleBinding.owner, '08 WEB / shared Web UI foundation');
  assert.equal(inventory.sharedLocaleBinding.fallbackLocale, 'en');
});

test('all Core reason keys and blocker presentation families are inventoried while machine keys stay stable', () => {
  const blockerSource = readFileSync(
    new URL('../src/lib/wep/blocker-messages.ts', import.meta.url),
    'utf8'
  );
  const blockerCodes = [
    ...blockerSource.matchAll(/^\s{2}([A-Z0-9_]+): \{/gm)
  ].map((match) => match[1]);

  const inventoriedBlockers =
    inventory.categories.blockerExplanation
      .find((entry) => entry.surface === 'WEP blocker title/message/action catalog')
      .entries;

  assert.equal(inventoriedBlockers.length, 70);
  assert.deepEqual(
    inventoriedBlockers.map((entry) => entry.machineCode),
    blockerCodes
  );
  for (const entry of inventoriedBlockers) {
    assert.equal(typeof entry.title, 'string');
    assert.equal(typeof entry.message, 'string');
    assert.equal(
      entry.action === null || typeof entry.action === 'string',
      true
    );
  }

  const reasonSource = readFileSync(
    new URL('../src/lib/wep/world-editor-primary-job.ts', import.meta.url),
    'utf8'
  );
  const reasonBlock = reasonSource.slice(
    reasonSource.indexOf('const CORE_REASON_TEXT'),
    reasonSource.indexOf('\n});', reasonSource.indexOf('const CORE_REASON_TEXT')) + 4
  );
  const reasonCodes = [
    ...reasonBlock.matchAll(/^\s{2}([A-Z0-9_]+):/gm)
  ].map((match) => match[1]);

  const inventoriedReasons =
    inventory.categories.blockerExplanation
      .find((entry) => entry.surface === 'Core object reason explanations')
      .entries;

  assert.equal(inventoriedReasons.length, 24);
  assert.deepEqual(
    inventoriedReasons.map((entry) => entry.machineCode),
    reasonCodes
  );

  assert.equal(
    inventory.translationBoundary.neverTranslate.includes(
      'Core/WEP machine reason code'
    ),
    true
  );
  assert.match(
    inventory.translationBoundary.invariant,
    /no semantic branch may compare translated text/
  );
});

test('day-theme gold contrast defect stays owned by shared Web and WEP adds no local semantic-token override', () => {
  assert.equal(
    inventory.accessibility.defect,
    'A11Y-DAY-GOLD-TEXT-CONTRAST'
  );
  assert.equal(inventory.accessibility.owner, 'shared-web');
  assert.equal(
    inventory.accessibility.wepAction,
    'INHERIT_SHARED_TOKEN_NO_LOCAL_OVERRIDE'
  );
  assert.equal(
    inventory.accessibility.evidence.dayValue,
    '#764c16'
  );

  const worldEditorRoute = readFileSync(
    new URL('../src/routes/editor/world/+page.svelte', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(worldEditorRoute, /--gold\s*:/);
});

test('localization inventory does not relax the World Editor persistent-write safety boundary', () => {
  assert.deepEqual(inventory.safetyBoundary, {
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    apply: false,
    saveReplacement: false,
    nativeRestore: false,
    atomicCommit: false
  });
});


test('integrated shared shell includes Community navigation in the World Editor inventory', () => {
  const shell = inventory.categories.navigation.find(
    (entry) => entry.surface === 'Shared site shell rendered on World Editor'
  );
  assert.ok(shell);
  assert.equal(shell.source.includes('src/lib/community/CommunityNav.svelte'), true);
  for (const label of ['Gallery', 'DreamSnaps', 'Q&A']) {
    assert.equal(shell.strings.includes(label), true);
  }
});
