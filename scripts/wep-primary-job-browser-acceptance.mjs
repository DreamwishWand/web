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
        }
      }
    },
    Villages: [
      {
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
  await expectContains(progressionCard, 'HISTORICAL reference alone');
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
  await page.getByRole('button', { name: '選択解除' }).click();
  await page.locator(cssObject('Editable Chair')).first().click();
  await page.getByLabel('World object search').fill('lamp');
  await expectSelected(page, 0);
  await expectContains(page.locator('.canvas-footer'), '1 visible', 'search visible count');
  assert.equal(await toolbar.getByRole('button', { name: 'Move right' }).isDisabled(), true);
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
  assert.equal(await toolbar.getByRole('button', { name: 'Move right' }).isDisabled(), true);
  await expectContains(
    page.locator('.command-availability'),
    'Core cannot prove safe user ownership for this progression-risk object'
  );

  // Protected source content must fail closed with an actionable Preset reason.
  await page.getByRole('button', { name: '選択解除' }).click();
  await unknown.click();
  assert.equal(await page.getByRole('button', { name: 'Capture Preview' }).isEnabled(), true);
  await page.getByRole('button', { name: 'Capture Preview' }).click();
  await expectContains(page.locator('.status'), 'Scene Preset capture blocked.');
  await expectContains(page.locator('.status'), 'not silently included in portable source content');
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
  let tabReachedEditableCanvasObject = false;
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
    if (
      active.editorObject === 'true' &&
      (
        String(active.ariaLabel ?? '').startsWith('Editable Chair at ') ||
        String(active.ariaLabel ?? '').startsWith('Editable Lamp at ')
      )
    ) {
      tabReachedEditableCanvasObject = true;
      keyboardObjectLabel = String(active.ariaLabel ?? '');
      assert.equal(active.role, 'button');
      assert.equal(active.tabIndexAttribute, '0');
      break;
    }
  }
  assert.equal(
    tabReachedEditableCanvasObject,
    true,
    'Tab navigation must reach an editable canvas object'
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
  await page.getByText(/DDV saveをローカルで読み込みました/).waitFor();
  await page.getByRole('button', { name: 'Open in Canvas' }).click();
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

  report.rawSwitch = {
    progressionDestinationConflict: 'PASS',
    commandSpecificValidationPresentation: 'PASS',
    exactBuildUnknownFailsClosed: 'PASS',
    originalBackupByteExactDownload: 'PASS',
    savePrepPersistentBoundary: 'PASS',
    progressionDependencyPresentation: 'PASS'
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
  rawSwitch: {}
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
