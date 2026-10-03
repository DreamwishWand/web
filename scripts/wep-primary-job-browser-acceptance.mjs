import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const artifactsDir = path.resolve('.artifacts/wep-browser');
await mkdir(artifactsDir, { recursive: true });

const baseUrl = process.env.WEP_BASE_URL || 'http://127.0.0.1:4173/editor/world/';
const executablePath = process.env.CHROME_BIN || undefined;

const syntheticFixture = {
  schema: 'dreamwish-wand-wep-editor-document',
  version: 1,
  target: {
    gameVersion: '1.25.0',
    platform: 'synthetic',
    areaKey: 'browser-acceptance'
  },
  capabilities: {},
  metadata: {
    progressionIntegration: {
      schema: 'ddv.progression-world-object-integration@1',
      artifactId: 'DDV-PROGRESSION-WORLD-OBJECT-INTEGRATION-V125-V1_14',
      persistentWriteAuthorized: false,
      proofStatus: {
        schema: 'ddv.progression-proof-status@1',
        questDefinitionGraph: 'CLOSED',
        saveProgressionReferenceIndex: 'CLOSED',
        conditionalSpawnRemoveWhenDone: 'OPEN',
        dynamicNativeConsumerExclusion: 'OPEN',
        objectSerializedStateCompatibility: 'OPEN',
        terminalEditableMutationAuthorized: false,
        positivePermissionGranted: false,
        persistentWriteAuthorized: false
      }
    }
  },
  objects: [
    {
      editorId: 'chair',
      itemId: 40000001,
      layer: 'furniture',
      x: 2,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      source: null,
      portableState: null,
      dependencyIds: [],
      editability: 'editable',
      metadata: { displayName: 'Editable Chair', reasons: [] }
    },
    {
      editorId: 'lamp',
      itemId: 40000002,
      layer: 'furniture',
      x: 6,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      source: null,
      portableState: null,
      dependencyIds: [],
      editability: 'editable',
      metadata: { displayName: 'Editable Lamp', reasons: [] }
    },
    {
      editorId: 'unknown-progression',
      itemId: 40000003,
      layer: 'furniture',
      x: 10,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      source: null,
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: {
        displayName: 'Unknown Progression Object',
        reasons: ['PROGRESSION_OWNERSHIP_UNKNOWN']
      }
    },
    {
      editorId: 'inconsistent-progression',
      itemId: 40000004,
      layer: 'furniture',
      x: 14,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      source: null,
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: {
        displayName: 'Inconsistent Progression Object',
        reasons: ['PROGRESSION_STATE_INCONSISTENT']
      }
    },
    {
      editorId: 'active-reference',
      itemId: 40000005,
      layer: 'furniture',
      x: 18,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      source: null,
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: {
        displayName: 'Active Reference Object',
        reasons: ['REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN']
      }
    }
  ],
  networks: { roads: null, fences: null }
};

const rawSwitchFixture = {
  GameInfo: {
    Version: 624,
    InitialVersion: 624,
    LastSaveDeviceInfo: { deviceType: 'DeviceType_Switch' }
  },
  Player: {},
  ProfileWorld: {
    Stores: [
      {
        BuildingItemID: 40000047,
        Displays: [
          {
            DisplayItemID: 2140000001,
            DisplayInfo: {
              Slots: [
                {
                  Item: { id: 40000001, amount: 1 },
                  IsAvailable: true,
                  CurrencyId: 80000000
                },
                {
                  Item: null,
                  IsAvailable: false,
                  CurrencyId: 0
                }
              ],
              LayoutType: 'FourItems',
              LastRefresh: '2026-10-01T00:00:00Z'
            }
          }
        ],
        LastRefresh: '2026-10-01T00:00:00Z',
        WeightedItems: { 40000001: 100, 40000002: 75 },
        CurrentSequenceIndexPerUpgrade: [-1, 2]
      }
    ],
    Shops: []
  },
  World: {
    GridCollection: {
      Grids: {
        '10': {
          ID: 10,
          GridDataPath: 'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath: '',
          TessellationFactor: 1,
          NextGridObjectID: 101,
          Objects: {
            '100': {
              ID: 100,
              ItemID: 40000047,
              X: 2,
              Y: 3,
              Orientation: 'GridOrientation_Up',
              State: {}
            }
          }
        },
        '760': {
          ID: 760,
          GridDataPath:
            'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json',
          GridDefaultLayoutPath: '',
          TessellationFactor: 2,
          NextGridObjectID: 2,
          Objects: {
            '1': {
              ID: 1,
              ItemID: 40000047,
              X: 12,
              Y: 14,
              Orientation: 'GridOrientation_Up',
              State: null
            }
          }
        }
      }
    },
    FloatingIslands: {
      '1540000147': {
        SceneItemId: 1540000147,
        GridIDs: [760],
        Unlocked: true,
        CustomLocationPositionsPath:
          'SceneLayouts/FloatingIslands/FloatingIsland_Urban/CustomLocations.json'
      }
    },
    Villages: [
      {
        SceneItemId: 1540000000,
        Areas: {
          '7': {
            GridIDs: [10],
            Unlocked: true,
            EnvironmentEffectItemID: 0,
            EnvironmentEffectOrientation: 'GridOrientation_Up'
          }
        }
      }
    ]
  }
};

const progressionDestinationFixture = {
  ...structuredClone(rawSwitchFixture),
  ConditionalEventHistory: { ActiveEvents: {} },
  World: {
    ...structuredClone(rawSwitchFixture.World),
    GridCollection: {
      Grids: {
        '10': {
          ID: 10,
          GridDataPath:
            'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath: '',
          TessellationFactor: 1,
          NextGridObjectID: 201,
          Objects: {
            '200': {
              ID: 200,
              ItemID: 40001060,
              X: 2,
              Y: 3,
              Orientation: 'GridOrientation_Up',
              State: {}
            }
          }
        }
      },
      DiffGrids: {}
    },
    MissionSlots: {},
    QuestInfo: {},
    Keyholes: {}
  }
};

function cssObject(prefix) {
  return `g[data-editor-object][aria-label^="${prefix} at"]`;
}

async function text(locator) {
  return (await locator.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
}

async function expectContains(locator, expected, label = expected) {
  const value = await text(locator);
  assert.ok(
    value.includes(expected),
    `${label}: expected text to include ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`
  );
}

async function expectSelected(page, count) {
  await expectContains(page.locator('.editor-toolbar > div:first-child strong'), `${count} selected`, 'selection count');
}

async function waitObject(page, prefix, x, y) {
  await page.locator(`g[data-editor-object][aria-label^="${prefix} at ${x}, ${y}"]`).waitFor();
}

async function assertNoHorizontalOverflow(locator, label) {
  const count = await locator.count();
  assert.ok(count > 0, label + ': surface must exist');
  for (let index = 0; index < count; index += 1) {
    const element = locator.nth(index);
    await element.waitFor({ state: 'visible' });
    const metrics = await element.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    }));
    assert.ok(
      metrics.scrollWidth <= metrics.clientWidth + 2,
      label + ': horizontal overflow ' +
        metrics.scrollWidth + ' > ' + metrics.clientWidth
    );
  }
}

async function horizontalOverflowOffenders(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    return [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className ?? '').slice(0, 160),
          dataSurface: element.getAttribute('data-wep-surface'),
          text: String(element.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          whiteSpace: style.whiteSpace,
          minWidth: style.minWidth,
          overflowX: style.overflowX
        };
      })
      .filter((entry) =>
        entry.width > 0 &&
        (
          entry.right > viewportWidth + 2 ||
          entry.left < -2 ||
          entry.scrollWidth > entry.clientWidth + 2
        )
      )
      .sort((a, b) => (b.right - viewportWidth) - (a.right - viewportWidth))
      .slice(0, 20);
  });
}

async function editorSemanticSnapshot(page) {
  return {
    selectedCount: await page.locator('g.selected[data-editor-object]').count(),
    objectCount: await page.locator('g[data-editor-object]').count(),
    selectedCells: await page.locator('g.selected .object-cell').evaluateAll(
      (cells) => cells.map((cell) => ({
        x: cell.getAttribute('x'),
        y: cell.getAttribute('y')
      }))
    ),
    commandDisabled: await page.locator('.toolbar-actions button').evaluateAll(
      (buttons) => buttons.map(
        (button) =>
          button.hasAttribute('disabled') ||
          button.getAttribute('aria-disabled') === 'true'
      )
    ),
    validationCodes: await page.locator('.validation-groups code').allTextContents()
  };
}

async function isSemanticallyDisabled(locator) {
  return (
    (await locator.getAttribute('aria-disabled')) === 'true' ||
    (await locator.isDisabled())
  );
}

async function runLocaleLayoutAcceptance(page, report) {
  const locales = ['de', 'fr', 'pt-BR', 'ja', 'zh-CN'];
  const localeSelect = page.locator('#site-locale');
  await localeSelect.waitFor();
  await page.setViewportSize({ width: 1280, height: 1100 });

  const localeSearch = page.locator('[data-wep-search-input]');
  await localeSearch.fill('40');
  const baseline = await editorSemanticSnapshot(page);
  report.localeLayout = {};

  for (const locale of locales) {
    await localeSelect.selectOption(locale);
    await page.waitForFunction(
      (expected) => document.documentElement.lang === expected,
      locale
    );

    const afterSwitch = await editorSemanticSnapshot(page);
    assert.deepEqual(
      afterSwitch,
      baseline,
      locale + ': locale switching must not mutate editor state or command authorization'
    );
    assert.equal(
      await localeSearch.inputValue(),
      '40',
      locale + ': locale switch must preserve visible Search value'
    );

    const capturePreview = page.locator('.capture-actions button').first();
    if (await capturePreview.isEnabled()) {
      await capturePreview.click();
      await page.locator('.status').waitFor();
    }

    const surfaces = [
      { label: 'toolbar', locator: page.locator('.editor-toolbar'), required: true },
      { label: 'inspector', locator: page.locator('.object-inspector'), required: true },
      { label: 'blocker-panel', locator: page.locator('.draft-blockers'), required: false },
      { label: 'validation-panel', locator: page.locator('.validation-groups'), required: false },
      { label: 'store-inspector', locator: page.locator('[data-wep-surface="store-inspector"]'), required: false },
      { label: 'scene-capture', locator: page.locator('.capture-panel'), required: true },
      { label: 'save-prep', locator: page.locator('.save-preparation'), required: false },
      { label: 'original-backup-controls', locator: page.locator('.toolbar-actions .save-prep'), required: true },
      { label: 'road-fence-labels', locator: page.locator('[data-wep-surface="road-fence-labels"]'), required: false },
      { label: 'progression-explanation', locator: page.locator('.progression-safety-card'), required: false },
      { label: 'live-status', locator: page.locator('.status'), required: true }
    ];
    const conditionalSurfacePresence = {};

    for (const { label, locator, required } of surfaces) {
      const count = await locator.count();
      conditionalSurfacePresence[label] = count;
      if (!count && !required) continue;
      await assertNoHorizontalOverflow(locator, locale + ':' + label);
    }

    const pageMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      htmlLang: document.documentElement.lang,
      dataLocale: document.documentElement.dataset.locale
    }));
    if (pageMetrics.scrollWidth > pageMetrics.innerWidth + 2) {
      const offenders = await horizontalOverflowOffenders(page);
      await page.screenshot({
        path: path.join(
          artifactsDir,
          'locale-' + locale.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-overflow.png'
        ),
        fullPage: true
      });
      assert.fail(
        locale + ': page has horizontal overflow ' +
          pageMetrics.scrollWidth + ' > ' + pageMetrics.innerWidth +
          '; offenders=' + JSON.stringify(offenders)
      );
    }
    assert.equal(pageMetrics.htmlLang, locale);
    assert.equal(pageMetrics.dataLocale, locale);

    await page.screenshot({
      path: path.join(
        artifactsDir,
        'locale-' + locale.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'
      ),
      fullPage: true
    });

    report.localeLayout[locale] = {
      horizontalOverflow: 'PASS',
      editorStateInvariant: 'PASS',
      htmlLang: pageMetrics.htmlLang,
      testedSurfaces: surfaces
        .filter(({ label }) => conditionalSurfacePresence[label] > 0)
        .map(({ label }) => label),
      conditionalSurfacePresence
    };
  }

  await localeSelect.selectOption('en');
  await page.waitForFunction(
    () => document.documentElement.lang === 'en'
  );
  assert.equal(await localeSearch.inputValue(), '40');
  await localeSearch.fill('');
}

async function runSyntheticAcceptance(page, report) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'wep-primary-job-browser-acceptance.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(syntheticFixture))
  });
  await page.getByText('Synthetic draft authoring', { exact: true }).waitFor();

  const progressionCard = page.locator('.progression-safety-card');
  await expectContains(progressionCard, 'Dependency evidence ≠ permission');
  await expectContains(progressionCard, 'CLOSED');
  await expectContains(progressionCard, 'Not authorized');
  await expectContains(progressionCard, 'Not granted');
  await expectContains(progressionCard, 'OPEN');
  await expectContains(progressionCard, 'A HISTORICAL reference by itself');
  await expectContains(progressionCard, 'No positive-authorization contract is bound');

  const chair = page.locator(cssObject('Editable Chair')).first();
  const lamp = page.locator(cssObject('Editable Lamp')).first();
  const unknown = page.locator(cssObject('Unknown Progression Object')).first();

  // Mouse-only select, move, undo/redo, rotate, copy/paste, duplicate and delete.
  await chair.click();
  await expectSelected(page, 1);
  const toolbar = page.locator('.toolbar-actions');
  const initialMove = toolbar.getByRole('button', { name: 'Move right' });
  report.syntheticInitialCommandState = {
    binding: await text(page.locator('.binding-state')),
    toolbar: await text(page.locator('.editor-toolbar')),
    unavailable: await text(page.locator('.command-availability')),
    inspector: await text(page.locator('.object-inspector')),
    moveEnabled: await initialMove.isEnabled(),
    moveDisabledAttribute: await initialMove.getAttribute('disabled')
  };
  console.log('SYNTHETIC_INITIAL_COMMAND_STATE', JSON.stringify(report.syntheticInitialCommandState));
  assert.equal(await initialMove.isEnabled(), true);
  await toolbar.getByRole('button', { name: 'Move right' }).click();
  await waitObject(page, 'Editable Chair', 3, 2);
  await toolbar.getByRole('button', { name: 'Undo' }).click();
  await waitObject(page, 'Editable Chair', 2, 2);
  await toolbar.getByRole('button', { name: 'Redo' }).click();
  await waitObject(page, 'Editable Chair', 3, 2);

  await toolbar.getByRole('button', { name: 'Rotate', exact: true }).click();
  const orientationRow = page
    .locator('.object-inspector .inspector-details > div')
    .filter({ hasText: 'Orientation' })
    .locator('dd');
  await expectContains(orientationRow, '4', 'rotated orientation');

  await toolbar.getByRole('button', { name: 'Copy', exact: true }).click();
  assert.equal(await toolbar.getByRole('button', { name: 'Paste', exact: true }).isEnabled(), true);
  const beforePaste = await page.locator('g[data-editor-object]').count();
  await toolbar.getByRole('button', { name: 'Paste', exact: true }).click();
  assert.equal(await page.locator('g[data-editor-object]').count(), beforePaste + 1);

  const beforeDuplicate = await page.locator('g[data-editor-object]').count();
  await toolbar.getByRole('button', { name: 'Duplicate', exact: true }).click();
  assert.equal(await page.locator('g[data-editor-object]').count(), beforeDuplicate + 1);
  await toolbar.getByRole('button', { name: 'Delete', exact: true }).click();
  assert.equal(await page.locator('g[data-editor-object]').count(), beforeDuplicate);
  await toolbar.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.locator('g[data-editor-object]').count(), beforeDuplicate + 1);
  await toolbar.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.locator('g[data-editor-object]').count(), beforeDuplicate);

  // Search/layer filtering must reconcile hidden selection.
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.locator(cssObject('Editable Chair')).first().click();
  await page.getByLabel('World object search').fill('lamp');
  await expectSelected(page, 0);
  await expectContains(page.locator('.canvas-footer'), '1 visible', 'search visible count');
  assert.equal(
    await isSemanticallyDisabled(
      toolbar.getByRole('button', { name: 'Move right' })
    ),
    true
  );
  await page.getByLabel('World object search').fill('');

  await page.locator(cssObject('Editable Lamp')).first().click();
  await page.getByRole('button', { name: /furniture/ }).click();
  await expectSelected(page, 0);
  await expectContains(page.locator('.canvas-footer'), '0 visible', 'layer filter visible count');
  await page.getByRole('button', { name: /furniture/ }).click();

  // Mixed multi-select must disable all common mutation commands and explain why.
  await page.locator(cssObject('Editable Chair')).first().click();
  await page.locator(cssObject('Editable Lamp')).first().click({ modifiers: ['Control'] });
  await expectSelected(page, 2);
  assert.equal(await toolbar.getByRole('button', { name: 'Move right' }).isEnabled(), true);
  await unknown.click({ modifiers: ['Control'] });
  await expectSelected(page, 3);
  assert.equal(
    await isSemanticallyDisabled(
      toolbar.getByRole('button', { name: 'Move right' })
    ),
    true
  );
  await expectContains(
    page.locator('.command-availability'),
    'Core cannot prove safe user ownership for this progression-risk object'
  );
  for (const name of ['Move left', 'Move up', 'Move down', 'Move right']) {
    const disabledMove = toolbar.getByRole('button', { name });
    assert.equal(
      await disabledMove.getAttribute('aria-disabled'),
      'true',
      name
    );
    const describedBy = await disabledMove.getAttribute('aria-describedby');
    assert.equal(describedBy, 'wep-reason-move', name);
    assert.equal(
      await page.locator('#' + describedBy).count(),
      1,
      name + ': disabled primary command reason must be programmatically associated'
    );
  }

  // Protected source content must fail closed with an actionable Preset reason.
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await unknown.click();
  assert.equal(await page.getByRole('button', { name: 'Capture Preview' }).isEnabled(), true);
  await page.getByRole('button', { name: 'Capture Preview' }).click();
  await expectContains(page.locator('.status'), 'Scene Preset capture blocked.');
  await expectContains(page.locator('.status'), 'never silently included in portable source content');
  assert.equal(await page.locator('.artifact-summary').count(), 0);

  await page.screenshot({
    path: path.join(artifactsDir, 'synthetic-protected-multimode.png'),
    fullPage: true
  });

  // Keyboard-only primary flow: reach the canvas through real Tab navigation,
  // then complete selection and draft commands without pointer input.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  let tabReachedCanvasObject = false;
  let keyboardObjectLabel = '';
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        editorObject:
          element instanceof Element
            ? element.getAttribute('data-editor-object')
            : null,
        ariaLabel:
          element instanceof Element
            ? element.getAttribute('aria-label')
            : null,
        role:
          element instanceof Element
            ? element.getAttribute('role')
            : null,
        tabIndexAttribute:
          element instanceof Element
            ? element.getAttribute('tabindex')
            : null
      };
    });
    if (active.editorObject === 'true') {
      tabReachedCanvasObject = true;
      keyboardObjectLabel = String(active.ariaLabel ?? '');
      assert.equal(active.role, 'button');
      assert.equal(active.tabIndexAttribute, '0');
      break;
    }
  }
  assert.equal(
    tabReachedCanvasObject,
    true,
    'Tab navigation must reach the single roving Canvas object'
  );
  assert.equal(
    await page.locator('g[data-editor-object][tabindex="0"]').count(),
    1,
    'Canvas must expose one roving Tab stop regardless of object count'
  );

  // The current roving target may be the readonly object selected by the
  // preceding protected-source test. Bracket navigation must make every
  // projected object keyboard-reachable without creating thousands of Tab stops.
  for (
    let index = 0;
    index < Math.max(1, await page.locator('g[data-editor-object]').count());
    index += 1
  ) {
    if (
      keyboardObjectLabel.startsWith('Editable Chair at ') ||
      keyboardObjectLabel.startsWith('Editable Lamp at ')
    ) break;
    await page.keyboard.press(']');
    keyboardObjectLabel = String(
      await page.evaluate(() =>
        document.activeElement instanceof Element
          ? document.activeElement.getAttribute('aria-label')
          : ''
      )
    );
  }
  assert.ok(
    keyboardObjectLabel.startsWith('Editable Chair at ') ||
      keyboardObjectLabel.startsWith('Editable Lamp at '),
    'Roving bracket navigation must reach an editable Canvas object'
  );

  const focusedBeforeRove = keyboardObjectLabel;
  await page.keyboard.press(']');
  const focusedAfterRove = await page.evaluate(() =>
    document.activeElement instanceof Element
      ? document.activeElement.getAttribute('aria-label')
      : null
  );
  assert.notEqual(
    focusedAfterRove,
    focusedBeforeRove,
    'Bracket navigation must move the roving Canvas focus target'
  );
  await page.keyboard.press('[');
  assert.equal(
    await page.evaluate(() =>
      document.activeElement instanceof Element
        ? document.activeElement.getAttribute('aria-label')
        : null
    ),
    focusedBeforeRove,
    'Reverse bracket navigation must restore the prior Canvas focus target'
  );

  const focusedCanvasStrokeWidth = await page.evaluate(() => {
    const active = document.activeElement;
    const cell =
      active instanceof Element
        ? active.querySelector('.object-cell')
        : null;
    return cell ? getComputedStyle(cell).strokeWidth : '';
  });
  assert.ok(
    Number.parseFloat(focusedCanvasStrokeWidth) >= 0.2,
    `focused canvas object must have a visible focus stroke; got ${focusedCanvasStrokeWidth}`
  );

  const labelMatch = keyboardObjectLabel.match(
    /^(Editable Chair|Editable Lamp) at (-?\d+), (-?\d+)$/
  );
  assert.ok(labelMatch, `unexpected keyboard target: ${keyboardObjectLabel}`);
  const keyboardObjectName = labelMatch[1];
  const keyboardStartX = Number(labelMatch[2]);
  const keyboardStartY = Number(labelMatch[3]);

  await page.keyboard.press('Enter');
  await expectSelected(page, 1);
  const keyboardOrientation = page
    .locator('.object-inspector .inspector-details > div')
    .filter({ hasText: 'Orientation' })
    .locator('dd');
  const orientationBefore = Number(await text(keyboardOrientation));

  await page.keyboard.press('ArrowRight');
  await waitObject(
    page,
    keyboardObjectName,
    keyboardStartX + 1,
    keyboardStartY
  );
  await page.keyboard.press('r');
  await expectContains(
    keyboardOrientation,
    String((orientationBefore + 4) & 15),
    'keyboard rotate'
  );
  await page.keyboard.press('Control+c');
  const keyboardCountBeforePaste = await page.locator('g[data-editor-object]').count();
  await page.keyboard.press('Control+v');
  assert.equal(await page.locator('g[data-editor-object]').count(), keyboardCountBeforePaste + 1);
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('g[data-editor-object]').count(), keyboardCountBeforePaste);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.locator('g[data-editor-object]').count(), keyboardCountBeforePaste + 1);
  await page.keyboard.press('Escape');
  await expectSelected(page, 0);

  // Keyboard shortcuts must not hijack text-entry controls.
  const search = page.getByLabel('World object search');
  await search.focus();
  await search.fill('chair');
  await page.keyboard.press('ArrowRight');
  assert.equal(await search.inputValue(), 'chair');

  report.synthetic = {
    mousePrimaryWorkflow: 'PASS',
    keyboardPrimaryWorkflow: 'PASS',
    keyboardTabReachability: 'PASS',
    keyboardVisibleFocus: 'PASS',
    mixedSelectionAvailability: 'PASS',
    searchAndLayerSelectionReconciliation: 'PASS',
    protectedPresetSource: 'PASS',
    progressionStatusPresentation: 'PASS'
  };
}

async function runRawSaveAcceptance(page, report) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.platform-select select').selectOption('switch');
  const rawBytes = Buffer.from(JSON.stringify(rawSwitchFixture));
  await page.locator('input[type="file"]').setInputFiles({
    name: 'acceptance-profile.json',
    mimeType: 'application/json',
    buffer: rawBytes
  });
  await page.getByText(/DDV save loaded locally/).waitFor();
  await page.getByRole('button', { name: 'Open in Canvas' }).first().click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();

  const progressionCard = page.locator('.progression-safety-card');
  await expectContains(progressionCard, 'Quest graph');
  await expectContains(progressionCard, 'Save refs');
  await expectContains(progressionCard, 'Not authorized');
  await expectContains(progressionCard, 'OPEN');

  const destinationInput = page.locator(
    '.full-design-destination-button input[type="file"]'
  );
  await destinationInput.waitFor({ state: 'attached' });
  await destinationInput.setInputFiles({
    name: 'progression-destination.profile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify(progressionDestinationFixture)
    )
  });
  const destinationIssues = page.locator(
    '.full-design-destination-issues'
  );
  await destinationIssues.waitFor();
  await expectContains(
    destinationIssues,
    'PROTECTED_PROGRESSION_OBJECT_CONFLICT',
    'progression destination conflict'
  );
  await expectContains(
    page.locator('.full-design-destination-result'),
    'UNAUTHORIZED',
    'destination write authorization'
  );

  const firstObject = page.locator('g[data-editor-object]').first();
  await firstObject.click();
  const toolbar = page.locator('.toolbar-actions');
  assert.equal(await toolbar.getByRole('button', { name: 'Move right' }).isEnabled(), true);
  await toolbar.getByRole('button', { name: 'Move right' }).click();

  const validationGroups = page.locator('.validation-groups');
  await validationGroups.waitFor();
  await expectContains(validationGroups, 'Exact build unverified');
  assert.equal((await text(validationGroups)).includes('BLOCKED / UNVERIFIED'), false);

  const backupButton = toolbar.getByRole('button', { name: 'Download Original Backup' });
  assert.equal(await backupButton.isEnabled(), true);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backupButton.click()
  ]);
  const backupPath = path.join(artifactsDir, 'downloaded-original-backup.bin');
  await download.saveAs(backupPath);
  assert.deepEqual(await readFile(backupPath), rawBytes);

  const savePrep = toolbar.getByRole('button', { name: 'Review Save Prep' });
  assert.equal(await savePrep.isEnabled(), true);
  await savePrep.click();
  await expectContains(page.locator('.save-preparation'), 'Blocked before persistent commit');
  await expectContains(page.locator('.draft-status'), 'Persistent save Unavailable');
  assert.equal(await page.getByRole('button', { name: /^Apply$/ }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Commit$/ }).count(), 0);

  await page.screenshot({
    path: path.join(artifactsDir, 'raw-switch-validation-backup.png'),
    fullPage: true
  });

  await page.getByRole('button', { name: /Area \/ Grid/ }).click();
  const floatingSection = page.locator('.floating-route-section');
  await floatingSection.waitFor();
  await expectContains(floatingSection, '1540000147');
  const floatingOpen = floatingSection.getByRole('button', {
    name: 'Open in Canvas'
  });
  assert.equal(await floatingOpen.count(), 1);
  await floatingOpen.click();
  await page.locator('.world-canvas').waitFor();
  assert.equal(
    await page.locator('g[data-editor-object]').count(),
    1,
    'promoted v1.16 direct-root route must project the Floating Island root'
  );
  await expectContains(
    page.locator('.binding-state'),
    'Read-only',
    'Floating Island projector must not imply mutation authorization'
  );
  assert.equal(
    await page.getByRole('button', { name: /^Apply$/ }).count(),
    0
  );
  assert.equal(
    await page.getByRole('button', { name: /^Commit$/ }).count(),
    0
  );

  // Restore the normal Area draft route before the existing locale-layout
  // suite, whose surface inventory intentionally includes draft-only panels.
  await page.getByRole('button', { name: /Area \/ Grid/ }).click();
  await page.getByRole('button', { name: 'Open in Canvas' }).first().click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();

  report.rawSwitch = {
    progressionDestinationConflict: 'PASS',
    commandSpecificValidationPresentation: 'PASS',
    exactBuildUnknownFailsClosed: 'PASS',
    originalBackupByteExactDownload: 'PASS',
    savePrepPersistentBoundary: 'PASS',
    progressionDependencyPresentation: 'PASS',
    floatingIslandDirectRootV116Consumption: 'PASS'
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const report = {
  schema: 'dreamwish-wand-wep-browser-acceptance@1',
  baseUrl,
  chromium: executablePath || 'playwright-managed',
  consoleErrors: [],
  pageErrors: [],
  synthetic: {},
  rawSwitch: {},
  localeLayout: {}
};

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));

  await runSyntheticAcceptance(page, report);
  await runRawSaveAcceptance(page, report);
  await runLocaleLayoutAcceptance(page, report);

  // Product boundary: browser acceptance itself must not surface persistent writer controls.
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(' | ')}`);

  report.result = 'PASS';
  await writeFile(
    path.join(artifactsDir, 'acceptance-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} catch (error) {
  report.result = 'FAIL';
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(
    path.join(artifactsDir, 'acceptance-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
