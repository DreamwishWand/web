import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const EXPECTED_SHA256 =
  '1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10';
const EXPECTED_SIZE = 12846979;
const EXPECTED_SCENE_ITEM_ID = '1540000147';
const EXPECTED_GRID_ID = '760';
const EXPECTED_GRID_PATH =
  'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json';
const EXPECTED_OBJECTS = 4230;

const fixturePath =
  process.env.WEP_REPRESENTATIVE_FIXTURE_PATH ??
  process.env.QR_WEP_PRIVATE_SAVE;
if (!fixturePath) {
  throw new Error(
    'WEP_REPRESENTATIVE_FIXTURE_PATH (or QR_WEP_PRIVATE_SAVE) must point to the exact private representative raw Switch profile; bytes stay local.'
  );
}

const baseUrl =
  process.env.WEP_BASE_URL ??
  process.env.QR_WEP_BASE_URL ??
  'http://127.0.0.1:4173/editor/world/';
const executablePath =
  process.env.CHROME_BIN ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  undefined;
const artifactsDir = path.resolve(
  process.env.WEP_REPRESENTATIVE_ARTIFACTS_DIR ??
    process.env.QR_WEP_ARTIFACTS_DIR ??
    '.artifacts/wep-r9-exact-private-bh'
);

await mkdir(artifactsDir, { recursive: true });
const sourceBytes = await readFile(fixturePath);
assert.equal(sourceBytes.byteLength, EXPECTED_SIZE);
const sourceSha256 = createHash('sha256')
  .update(sourceBytes)
  .digest('hex');
assert.equal(sourceSha256, EXPECTED_SHA256);

const fixture = JSON.parse(sourceBytes.toString('utf8'));
assert.equal(Number(fixture?.GameInfo?.Version), 624);

const report = {
  schema: 'dreamwish-wand-qr-wep-r9-exact-private-bh-browser@1',
  target: {
    platform: 'Nintendo Switch',
    gameVersion: '1.25.0',
    buildId: '52BD625D9B4E0053',
    schema: 624
  },
  source: {
    basename: path.basename(fixturePath),
    byteLength: sourceBytes.byteLength,
    sha256: sourceSha256
  },
  expected: {
    sceneItemId: EXPECTED_SCENE_ITEM_ID,
    gridId: EXPECTED_GRID_ID,
    gridDataPath: EXPECTED_GRID_PATH,
    objectCount: EXPECTED_OBJECTS
  },
  gates: {
    'WE-INSPECT': 'RUNNING',
    'WE-FIXTURE-COVERAGE': 'RUNNING'
  },
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  result: 'RUNNING',
  hardBoundary: {
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    PERSISTENT_WRITE: false,
    productApplyAuthorized: false,
    directSourceReplacementAuthorized: false,
    sourceOverwriteExecuted: false
  }
};

function attachDiagnostics(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(String(error));
  });
}

async function textContains(locator, expected) {
  const text = await locator.innerText();
  if (expected instanceof RegExp) assert.match(text, expected);
  else assert.ok(text.includes(String(expected)), `${text} does not include ${expected}`);
}

async function semanticDisabled(locator) {
  return (
    (await locator.getAttribute('aria-disabled')) === 'true' ||
    (await locator.isDisabled())
  );
}

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });
  const page = await context.newPage();
  attachDiagnostics(page);

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  report.browser = {
    userAgent: await page.evaluate(() => navigator.userAgent),
    baseUrl
  };

  await page.locator('.platform-select select').selectOption('switch');
  const sourceInput = page.locator('.load-panel input[type="file"]');
  await sourceInput.setInputFiles({
    name: path.basename(fixturePath),
    mimeType: 'application/json',
    buffer: sourceBytes
  });
  await page.locator('.save-source-browser').waitFor();

  const island = page
    .locator('.floating-route-section article.area-route')
    .filter({ hasText: EXPECTED_SCENE_ITEM_ID });
  assert.equal(await island.count(), 1);

  const root = island
    .locator('.floating-route-root')
    .filter({ hasText: EXPECTED_GRID_PATH });
  assert.equal(await root.count(), 1);
  await textContains(root, EXPECTED_GRID_PATH);
  await root.getByRole('button', { name: 'Open in Canvas' }).click();

  await page.locator('.editor-shell').waitFor();
  const objects = page.locator('g[data-editor-object]');
  await objects.first().waitFor();
  assert.equal(await objects.count(), EXPECTED_OBJECTS);
  assert.equal(
    await page.locator('g[data-editor-object][tabindex="0"]').count(),
    1
  );

  const targetCard = page.locator('.sidebar .side-card').first();
  const rows = targetCard.locator('dl > div');
  assert.ok((await rows.count()) >= 6);
  assert.equal(
    (await rows.nth(3).locator('dd').innerText()).trim(),
    '—',
    'direct-root Canvas must not fabricate Area identity'
  );
  assert.equal(
    (await rows.nth(4).locator('dd').innerText()).trim(),
    String(EXPECTED_OBJECTS)
  );
  await textContains(page.locator('.canvas-footer'), String(EXPECTED_OBJECTS));

  report.checks.exactFloatingIslandRoute = 'PASS';
  report.checks.exact4230Canvas = 'PASS';
  report.checks.noPseudoAreaIdentity = 'PASS';
  report.checks.singleRovingTabStop = 'PASS';

  for (const name of ['Move left', 'Move up', 'Move down', 'Move right']) {
    const control = page.locator('.toolbar-actions').getByRole('button', { name });
    assert.equal(await semanticDisabled(control), true, name);
    assert.equal(await control.getAttribute('aria-disabled'), 'true', name);
    assert.equal(
      await control.getAttribute('aria-describedby'),
      'wep-reason-move',
      name
    );
  }
  assert.equal(await page.locator('#wep-reason-move').count(), 1);
  report.checks.disabledMoveReasonAssociation = 'PASS';

  await objects.first().click();
  await page.locator('.object-inspector .inspector-details').waitFor();
  assert.equal(
    await page.locator('g.selected[data-editor-object]').count(),
    1
  );
  assert.ok(
    await page
      .locator('.object-inspector .inspector-details > div')
      .count() >= 6
  );
  report.checks.inspectProjectedObject = 'PASS';

  // R9 may expose verified replacement-artifact export. The safety invariant
  // here is no direct source overwrite/replacement surface, not absence of export UI.
  assert.equal(
    await page
      .getByRole('button', {
        name: /overwrite source|replace source save|write to source save/i
      })
      .count(),
    0
  );
  report.checks.noDirectSourceReplacementControl = 'PASS';

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);

  report.gates['WE-INSPECT'] = 'CLOSED / PASS';
  report.gates['WE-FIXTURE-COVERAGE'] = 'CLOSED / PASS';
  report.result = 'PASS';

  await page.screenshot({
    path: path.join(
      artifactsDir,
      'r9-exact-private-floating-island-4230.png'
    ),
    fullPage: true
  });
  await context.close();
} catch (error) {
  report.result = 'FAIL';
  report.error =
    error instanceof Error ? error.stack || error.message : String(error);
  throw error;
} finally {
  await writeFile(
    path.join(artifactsDir, 'acceptance-report.json'),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
