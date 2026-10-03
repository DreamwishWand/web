import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const EXPECTED_SHA256 = '1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10';
const EXPECTED_SIZE = 12846979;
const fixturePath = process.env.WEP_REPRESENTATIVE_FIXTURE_PATH;
const baseUrl = process.env.WEP_BASE_URL || 'http://127.0.0.1:4173/editor/world/';
const executablePath = process.env.CHROME_BIN || undefined;
const artifactsDir = path.resolve(process.env.WEP_REPRESENTATIVE_ARTIFACTS_DIR || '.artifacts/wep-representative-save');

if (!fixturePath) {
  throw new Error('WEP_REPRESENTATIVE_FIXTURE_PATH is required; the private representative save is never embedded in source or CI.');
}

await mkdir(artifactsDir, { recursive: true });
const fixtureBytes = await readFile(fixturePath);
assert.equal(fixtureBytes.byteLength, EXPECTED_SIZE, 'representative fixture size mismatch');
const fixtureSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
assert.equal(fixtureSha256, EXPECTED_SHA256, 'representative fixture SHA-256 mismatch');
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
assert.equal(Number(fixture?.GameInfo?.Version), 624, 'profile schema/version must be 624');
assert.equal(String(fixture?.GameInfo?.LastSaveDeviceInfo?.deviceType), 'DeviceType_Switch');

function gridById(id) {
  return fixture?.World?.GridCollection?.Grids?.[String(id)] ?? null;
}
function objectList(grid) {
  const value = grid?.Objects ?? {};
  return Array.isArray(value) ? value : Object.values(value);
}
function stateObjectFor(gridId, key) {
  return objectList(gridById(gridId)).find((object) => object?.State && object.State[key] != null) ?? null;
}
function findStoreGridHit() {
  const stores = Array.isArray(fixture?.World?.Stores) ? fixture.World.Stores : [];
  const ids = new Set(stores.map((entry) => Number(entry?.BuildingItemID)).filter(Number.isSafeInteger));
  for (const [gridId, grid] of Object.entries(fixture?.World?.GridCollection?.Grids ?? {})) {
    for (const object of objectList(grid)) {
      if (ids.has(Number(object?.ItemID))) return { gridId: Number(gridId), object, storeItemId: Number(object.ItemID) };
    }
  }
  return null;
}

const fixtureFacts = {
  meadowObjectCount: objectList(gridById(7)).length,
  urbanObjectCount: objectList(gridById(5)).length,
  floatingUrbanObjectCount: objectList(gridById(760)).length,
  meadowFenceModeCount: objectList(gridById(7)).filter((o) => o?.State?.FenceMode != null).length,
  meadowSubGridObject: stateObjectFor(7, 'SubGrid'),
  urbanSubGridObject: stateObjectFor(5, 'SubGrid'),
  meadowBuildingStateObject: stateObjectFor(7, 'BuildingWithSkinData') ?? stateObjectFor(7, 'HouseData'),
  urbanBuildingStateObject: stateObjectFor(5, 'BuildingWithSkinData') ?? stateObjectFor(5, 'HouseData'),
  storeGridHit: findStoreGridHit()
};
assert.ok(fixtureFacts.meadowObjectCount >= 2500, 'dense Meadow route missing');
assert.ok(fixtureFacts.floatingUrbanObjectCount >= 4000, 'dense Floating Island route missing');
assert.ok(fixtureFacts.meadowFenceModeCount > 0, 'representative Fence state missing');
assert.ok(fixtureFacts.meadowSubGridObject || fixtureFacts.urbanSubGridObject, 'representative SubGrid state missing');
assert.ok(fixtureFacts.meadowBuildingStateObject || fixtureFacts.urbanBuildingStateObject, 'representative Building/PlayerHouse state missing');
assert.ok(fixtureFacts.storeGridHit, 'representative Store building identity missing');

async function compactText(locator) {
  return ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();
}
async function expectContains(locator, expected, label = expected) {
  const value = await compactText(locator);
  assert.ok(value.includes(expected), `${label}: expected ${JSON.stringify(expected)} in ${JSON.stringify(value)}`);
}
function gate(status, evidence = {}, blocker = null) {
  return { status, evidence, blocker };
}

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const report = {
  schema: 'dreamwish-wand-qr-representative-launch-save-acceptance@1',
  fixture: { path: path.basename(fixturePath), sha256: fixtureSha256, size: fixtureBytes.byteLength, platform: 'Nintendo Switch', ddvVersion: '1.25.0', schema: 624 },
  fixtureFacts: {
    meadowObjectCount: fixtureFacts.meadowObjectCount,
    urbanObjectCount: fixtureFacts.urbanObjectCount,
    floatingUrbanObjectCount: fixtureFacts.floatingUrbanObjectCount,
    meadowFenceModeCount: fixtureFacts.meadowFenceModeCount,
    storeGridHit: fixtureFacts.storeGridHit && { gridId: fixtureFacts.storeGridHit.gridId, itemId: fixtureFacts.storeGridHit.storeItemId }
  },
  gates: {},
  defects: [],
  consoleErrors: [],
  pageErrors: [],
  hardBoundary: {
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    persistentApplyExecuted: false,
    saveReplacementExecuted: false,
    nativeRestoreExecuted: false,
    atomicCommitExecuted: false,
    persistentRoadFenceSerializationExecuted: false
  }
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: false });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('.load-controls input[type="file"]').setInputFiles({
    name: path.basename(fixturePath), mimeType: 'application/json', buffer: fixtureBytes
  });
  await page.getByText(/DDV saveをローカルで読み込みました/).waitFor();
  const sourceBrowser = page.locator('.save-source-browser');
  await expectContains(sourceBrowser, 'Schema624', 'schema');
  await expectContains(sourceBrowser, 'Sourceswitch', 'platform');
  await expectContains(sourceBrowser, 'Floating13', 'floating-island count');
  report.gates['WE-OPEN'] = gate('CLOSED / PASS', { exactSha256: fixtureSha256, exactSize: fixtureBytes.byteLength, schema: 624, sourcePlatform: 'switch' });

  const floatingCard = page.locator('.floating-route-section .area-route').filter({ hasText: '4230 objects' }).first();
  await floatingCard.waitFor();
  assert.equal(await floatingCard.getByRole('button', { name: 'Open in Canvas' }).count(), 0);
  await floatingCard.getByRole('button', { name: 'Preview full-design plan' }).click();
  const floatingPlan = page.locator('.floating-plan-preview');
  await floatingPlan.waitFor();
  await expectContains(floatingPlan, 'Strict validation PASS');
  await expectContains(floatingPlan, 'Blocked / Disabled');
  report.defects.push({
    id: 'WEP-FLOATING-ISLAND-CANVAS-NOT-BOUND',
    gate: 'WE-INSPECT',
    severity: 'launch-blocking-for-representative-contract',
    detail: 'The representative 4,230-object Floating Island is discoverable and full-design planning runs, but the current UI has no Floating Island Open in Canvas route.'
  });

  const meadowRow = page.locator('.root-grid-row').filter({ hasText: 'Village04-MeadowLevel-GridData.json' }).first();
  await expectContains(meadowRow, '2626 objects', 'Meadow object count');
  await meadowRow.getByRole('button', { name: 'Open in Canvas' }).click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();
  const targetCard = page.locator('.side-card').filter({ hasText: 'TARGET' }).first();
  await expectContains(targetCard, '2626', 'Canvas object count');
  const placement = page.locator('.placement-readiness-card');
  await expectContains(placement, 'Resolved');
  await expectContains(placement, 'Authoritative · 01B v1.7');
  await expectContains(placement, 'Disabled');
  const progression = page.locator('.progression-safety-card');
  await expectContains(progression, 'Not authorized');
  await expectContains(progression, 'Not granted');
  report.gates['WE-INSPECT-DENSE-VILLAGE'] = gate('CLOSED / PASS', { gridId: 7, objects: 2626 });
  report.gates['WE-INSPECT'] = gate('BLOCKED', { denseVillage: 'PASS', floatingIslandPlanning: 'PASS', floatingIslandCanvas: 'NOT_BOUND' }, 'WEP-FLOATING-ISLAND-CANVAS-NOT-BOUND');

  const buildingObject = page.locator('g[data-editor-object]').filter({ has: page.locator('rect.layer-building') }).first();
  if (await buildingObject.count()) {
    await buildingObject.click();
    await expectContains(page.locator('.object-inspector'), 'State');
    await expectContains(page.locator('.full-design-categories'), 'Buildings / PlayerHouse');
  }
  const subGridObject = fixtureFacts.meadowSubGridObject;
  if (subGridObject?.ItemID != null) {
    const search = page.getByLabel('World object search');
    await search.fill(String(subGridObject.ItemID));
    const candidate = page.locator('g[data-editor-object]').first();
    if (await candidate.count()) {
      await candidate.click();
      await expectContains(page.locator('.object-inspector'), 'SubGrid', 'SubGrid inspector state');
    }
    await search.fill('');
  }

  const firstEditable = page.locator('g[data-editor-object]:not(.locked)').first();
  await firstEditable.click();
  const toolbar = page.locator('.toolbar-actions');
  if (await toolbar.getByRole('button', { name: 'Move right' }).isEnabled()) {
    await toolbar.getByRole('button', { name: 'Move right' }).click();
  }
  const validation = page.locator('.validation-groups');
  if (await validation.count()) await validation.waitFor();
  await expectContains(placement, 'DDV write Disabled', 'write authorization separation');
  report.gates['WE-PREVIEW'] = gate('CLOSED / PASS', { representativeDraftPreview: true, persistentWriteAuthorized: false });
  report.gates['WE-VALIDATE'] = gate('CLOSED / PASS', { route: 'resolved', bounds: 'authoritative', floorTypeAndNativePlacement: 'command-specific', noVetoIsPermission: false });

  await page.getByRole('button', { name: '選択解除' }).click();
  const supportedFurniture = page
    .locator('g[data-editor-object]:not(.locked)')
    .filter({ has: page.locator('rect.layer-furniture') })
    .first();
  assert.ok(
    await supportedFurniture.count(),
    'representative Meadow must expose at least one editable furniture object for Scene capture'
  );
  await supportedFurniture.click();
  await page.getByRole('button', { name: 'Capture Preview' }).click();
  const artifactSummary = page.locator('.artifact-summary');
  if (await artifactSummary.count()) {
    await artifactSummary.waitFor();
    report.gates['WE-SCENE-CAPTURE'] = gate('CLOSED / PASS', { source: 'representative decorated real save', protectedSourceExclusionEvidence: 'REUSED_EXISTING_TARGETED_PASS' });
  } else {
    report.gates['WE-SCENE-CAPTURE'] = gate('BLOCKED', { statusText: await compactText(page.locator('.status')) }, 'REPRESENTATIVE_SCENE_CAPTURE_BLOCKED');
  }

  const destinationInput = page.locator('.full-design-destination-button input[type="file"]');
  await destinationInput.waitFor({ state: 'attached' });
  await destinationInput.setInputFiles({ name: path.basename(fixturePath), mimeType: 'application/json', buffer: fixtureBytes });
  const destination = page.locator('.full-design-destination-result');
  await destination.waitFor();
  await destination.getByText(/DDV write authorization/).waitFor();
  await expectContains(destination, 'DDV write authorization UNAUTHORIZED');
  await expectContains(destination, 'Route resolved PASS');
  report.gates['WE-NONBUILDING-FULLDESIGN-PREFLIGHT'] = gate('CLOSED / PASS', { destination: 'same exact representative save', ddvWriteAuthorization: 'UNAUTHORIZED', progressionDestinationVetoEvidence: 'REUSED_EXISTING_TARGETED_PASS' });

  const captureStatus = page.locator('.capture-status');
  const roadFenceText = await compactText(captureStatus);
  assert.ok(/Core reader bound · \d+ road \/ \d+ fence/.test(roadFenceText), `Road/Fence reader summary missing: ${roadFenceText}`);
  const rfControlCount = await page.getByRole('button', { name: /Eyedropper|Connected selection|Polyline|Rectangle outline|Replace style|Topology transform/i }).count();
  const fencePostPanel = page.locator('.fence-post-panel');
  const fencePostPresent = (await fencePostPanel.count()) > 0;
  if (rfControlCount === 0) {
    report.defects.push({
      id: 'WEP-ROADFENCE-LOGICAL-AUTHORING-CONTROLS-NOT-BOUND',
      gate: 'WE-ROADFENCE-DRAFT',
      severity: 'launch-blocking-for-representative-contract',
      detail: 'Current route binds the promoted Road/Fence reader and may expose Fence post representation editing, but general logical Road/Fence authoring functions are not reachable from browser controls.'
    });
    report.gates['WE-ROADFENCE-DRAFT'] = gate('BLOCKED', { readerSummary: roadFenceText, fencePostPanel: fencePostPresent, generalLogicalAuthoringControls: 0 }, 'WEP-ROADFENCE-LOGICAL-AUTHORING-CONTROLS-NOT-BOUND');
  } else {
    report.gates['WE-ROADFENCE-DRAFT'] = gate('CLOSED / PASS', { readerSummary: roadFenceText, fencePostPanel: fencePostPresent, generalLogicalAuthoringControls: rfControlCount });
  }

  await page.getByRole('button', { name: /Area \/ Grid一覧へ戻る/ }).click();
  const urbanRow = page.locator('.root-grid-row').filter({ hasText: 'Village04-UrbanLevel-GridData.json' }).first();
  await expectContains(urbanRow, '1822 objects', 'Urban object count');
  await urbanRow.getByRole('button', { name: 'Open in Canvas' }).click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();
  const storeSearch = page.getByLabel('World object search');
  await storeSearch.fill(String(fixtureFacts.storeGridHit.storeItemId));
  const storeObject = page.locator('g[data-editor-object]').first();
  await storeObject.click();
  const inspector = page.locator('.object-inspector');
  const inspectorText = await compactText(inspector);
  const scroogePass = inspectorText.includes('Scrooge Store Inventory');
  if (scroogePass) {
    await expectContains(inspector, 'Read-only Core v1.12 view');
    await expectContains(inspector, 'no Shop fallback or persistent mutation is available');
    report.gates['WE-SCROOGE-BROWSER-FIXTURE'] = gate('CLOSED / PASS', {
      gridId: fixtureFacts.storeGridHit.gridId,
      buildingItemId: fixtureFacts.storeGridHit.storeItemId,
      mutationAuthorized: false
    });
  } else {
    report.defects.push({
      id: 'WEP-SCROOGE-PROFILEWORLD-ADAPTER-MISSING',
      gate: 'WE-SCROOGE-BROWSER-FIXTURE',
      severity: 'launch-blocking-for-representative-contract',
      detail: 'The exact save has World.Stores and selected BuildingItemID 20300028, but the v1.12 browser binding resolves only profile.ProfileWorld.Stores, so the read-only Scrooge inspector does not render.'
    });
    report.gates['WE-SCROOGE-BROWSER-FIXTURE'] = gate('BLOCKED', {
      gridId: fixtureFacts.storeGridHit.gridId,
      buildingItemId: fixtureFacts.storeGridHit.storeItemId,
      sourceStoreCollection: 'World.Stores',
      browserBindingExpectedCollection: 'ProfileWorld.Stores',
      selectedInspectorText: inspectorText,
      mutationAuthorized: false
    }, 'WEP-SCROOGE-PROFILEWORLD-ADAPTER-MISSING');
  }

  report.gates['WE-FIXTURE-COVERAGE'] = gate('BLOCKED', {
    exactFixture: 'PASS',
    denseVillage: 'PASS',
    floatingIslandPlanning: 'PASS',
    floatingIslandCanvas: 'BLOCKED',
    storeInspector: scroogePass ? 'PASS' : 'BLOCKED',
    roadFenceReader: 'PASS',
    roadFenceLogicalAuthoringUI: rfControlCount > 0 ? 'PASS' : 'BLOCKED'
  }, report.defects.map((item) => item.id).join(' + '));

  assert.equal(await page.getByRole('button', { name: /^Apply$/ }).count(), 0, 'persistent Apply control must not be exposed');
  assert.equal(await page.getByRole('button', { name: /^Commit$/ }).count(), 0, 'persistent Commit control must not be exposed');
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(artifactsDir, 'representative-final.png'), fullPage: true });
  await writeFile(path.join(artifactsDir, 'representative-acceptance-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} catch (error) {
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactsDir, 'representative-acceptance-report.json'), JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
