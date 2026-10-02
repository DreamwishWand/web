import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const savePath = process.env.QR_WEP_PRIVATE_SAVE;
if (!savePath) {
  throw new Error('QR_WEP_PRIVATE_SAVE must point to the exact private representative Switch profile.json');
}

const baseUrl =
  process.env.QR_WEP_BASE_URL ??
  'http://127.0.0.1:4173/editor/world/';
const executablePath =
  process.env.CHROME_BIN ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/usr/bin/google-chrome-stable';
const artifactsDir =
  process.env.QR_WEP_ARTIFACTS_DIR ??
  '.artifacts/qr-wep-r6-exact-private';

const EXPECTED_SAVE_SHA256 =
  '1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10';
const EXPECTED_SAVE_BYTES = 12846979;
const EXPECTED_SCENE_ITEM_ID = '1540000147';
const EXPECTED_GRID_ID = '760';
const EXPECTED_GRID_PATH =
  'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json';
const EXPECTED_OBJECTS = 4230;

await mkdir(artifactsDir, { recursive: true });
const sourceBytes = await readFile(savePath);
const sourceSha256 = createHash('sha256')
  .update(sourceBytes)
  .digest('hex');

assert.equal(sourceBytes.length, EXPECTED_SAVE_BYTES);
assert.equal(sourceSha256, EXPECTED_SAVE_SHA256);

const report = {
  schema: 'dreamwish-wand-qr-wep-r6-exact-private-browser@1',
  source: {
    basename: path.basename(savePath),
    byteLength: sourceBytes.length,
    sha256: sourceSha256
  },
  expected: {
    sceneItemId: EXPECTED_SCENE_ITEM_ID,
    gridId: EXPECTED_GRID_ID,
    gridDataPath: EXPECTED_GRID_PATH,
    objectCount: EXPECTED_OBJECTS
  },
  browser: {},
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  result: 'RUNNING'
};

function attachBrowserDiagnostics(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      report.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(String(error));
  });
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
  attachBrowserDiagnostics(page);

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  report.browser.userAgent = await page.evaluate(() => navigator.userAgent);
  report.browser.baseUrl = baseUrl;

  await page.locator('.platform-select select').selectOption('switch');
  const sourceInput = page.locator(
    '.load-panel input[type="file"]'
  );
  await sourceInput.setInputFiles(savePath);
  await page.locator('.save-source-browser').waitFor();

  const island = page
    .locator('.floating-route-section article.area-route')
    .filter({ hasText: EXPECTED_SCENE_ITEM_ID });
  assert.equal(await island.count(), 1);
  await assertTextContains(island, EXPECTED_SCENE_ITEM_ID);

  const root = island
    .locator('.floating-route-root')
    .filter({ hasText: EXPECTED_GRID_PATH });
  assert.equal(await root.count(), 1);
  await assertTextContains(root, EXPECTED_GRID_PATH);
  report.checks.exactFloatingIslandRoute = 'PASS';

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
  const targetRows = targetCard.locator('dl > div');
  assert.ok((await targetRows.count()) >= 6);
  assert.equal(
    (await targetRows.nth(3).locator('dd').innerText()).trim(),
    '—',
    'direct-root Canvas must not fabricate Area identity'
  );
  assert.equal(
    (await targetRows.nth(4).locator('dd').innerText()).trim(),
    String(EXPECTED_OBJECTS)
  );
  assert.equal(
    await page.locator('.binding-state').evaluate((el) =>
      el.classList.contains('blocked')
    ),
    true
  );
  await assertTextContains(
    page.locator('.canvas-footer'),
    String(EXPECTED_OBJECTS)
  );
  report.checks.exact4230Canvas = 'PASS';
  report.checks.noPseudoAreaIdentity = 'PASS';
  report.checks.singleRovingTabStop = 'PASS';

  for (const name of [
    'Move left',
    'Move up',
    'Move down',
    'Move right'
  ]) {
    const control = page
      .locator('.toolbar-actions')
      .getByRole('button', { name });
    assert.equal(await semanticDisabled(control), true, name);
    assert.equal(
      await control.getAttribute('aria-disabled'),
      'true',
      name
    );
    assert.equal(
      await control.getAttribute('aria-describedby'),
      'wep-reason-move',
      name
    );
  }
  assert.equal(await page.locator('#wep-reason-move').count(), 1);
  report.checks.allDirectionalDisabledReasonsAssociated = 'PASS';

  await objects.first().click();
  await page
    .locator('.object-inspector .inspector-details')
    .waitFor();
  assert.equal(
    await page.locator('g.selected[data-editor-object]').count(),
    1
  );
  assert.ok(
    await page
      .locator('.object-inspector .inspector-details > div')
      .count() >= 6
  );
  report.checks.inspectExactProjectedObject = 'PASS';

  const search = page.locator('[data-wep-search-input]');
  await search.fill('40');
  for (const locale of ['ja', 'de', 'fr', 'pt-BR', 'zh-CN']) {
    await page.locator('#site-locale').selectOption(locale);
    await page.waitForFunction(
      (expected) =>
        document.documentElement.lang === expected,
      locale
    );
    assert.equal(await search.inputValue(), '40', locale);
  }
  await page.locator('#site-locale').selectOption('en');
  await page.waitForFunction(
    () => document.documentElement.lang === 'en'
  );
  assert.equal(await search.inputValue(), '40');
  report.checks.searchValueSurvivesLocaleSwitch = 'PASS';

  assert.equal(
    await page.getByRole('button', { name: /^Apply$/ }).count(),
    0
  );
  assert.equal(
    await page.getByRole('button', { name: /^Commit$/ }).count(),
    0
  );
  await assertTextContains(
    page.locator('.canvas-footer'),
    /persistent/i
  );
  report.checks.noPersistentWriterSurface = 'PASS';

  await page.screenshot({
    path: path.join(
      artifactsDir,
      'exact-floating-island-4230-canvas.png'
    ),
    fullPage: true
  });

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  report.result = 'PASS';

  await context.close();
} catch (error) {
  report.result = 'FAIL';
  report.error =
    error instanceof Error
      ? error.stack || error.message
      : String(error);
  throw error;
} finally {
  await writeFile(
    path.join(artifactsDir, 'acceptance-report.json'),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));

async function assertTextContains(locator, expected) {
  const text = await locator.innerText();
  if (expected instanceof RegExp) {
    assert.match(text, expected);
  } else {
    assert.ok(
      text.includes(String(expected)),
      `Expected "${text}" to include "${expected}"`
    );
  }
}
