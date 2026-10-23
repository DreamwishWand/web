import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const baseUrl = (process.env.WEP_READONLY626_BASE_URL || 'http://127.0.0.1:4179').replace(/\/$/, '') + '/editor/world/';
if (!process.env.CHROME_BIN) throw new Error('CHROME_BIN required');
const profile626 = {
  GameInfo: { Version: 626, InitialVersion: 518, LastSaveDeviceInfo: { deviceType: 'DeviceType_Windows' } },
  Player: { OpaquePlayer: { keep: true } },
  World: {
    Villages: [{ Areas: { '7': { GridIDs: [10], Unlocked: true } } }],
    GridCollection: { Grids: { '10': { ID: 10, Objects: { '42': { State: { FutureOpaque: true } } } } } }
  },
  OpaqueRoot: { mustPreserve: true }
};
const profile624 = structuredClone(profile626);
profile624.GameInfo.Version = 624;
const source626 = Buffer.from(makeSyntheticP1gProfile(profile626));
const source624 = Buffer.from(makeSyntheticP1gProfile(profile624));
const sourceHash = createHash('sha256').update(source626).digest('hex');
const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox','--disable-dev-shm-usage']
});
const report = {
  schema: 'dreamwish-wand-wep-schema626-readonly-browser@1',
  target: { platform: 'Nintendo Switch', gameVersion: '1.25.3', bid: '9A239D3DB569756D', profileSchema: 626 },
  fixture: 'SYNTHETIC_ONLY', sourceHash, checks: [], pageErrors: [], consoleErrors: [], result: 'PENDING'
};
const pass = (name) => report.checks.push({ name, status: 'PASS' });
async function upload(page, buffer) {
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'profile.save', mimeType:'application/octet-stream', buffer
  });
}
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  await page.goto(baseUrl, {waitUntil:'networkidle'});
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
  await page.locator('[data-wep-626-provenance] input').check();
  await upload(page, source626);
  const panel = page.locator('[data-wep-626-readonly]');
  await panel.waitFor({state:'visible',timeout:15000});
  const rendered = await panel.innerText();
  assert.match(rendered,/read-only/i);
  assert.match(rendered,/1\.25\.3/);
  assert.match(rendered,/schema 626/);
  assert.match(rendered,/Village records[\s\S]*1/);
  assert.match(rendered,/Area records[\s\S]*1/);
  assert.match(rendered,/Grid records[\s\S]*1/);
  pass('SWITCH626_STRUCTURAL_DIAGNOSTIC_VISIBLE');
  assert.equal(await page.locator('.editor-shell').count(),0);
  assert.equal(await page.locator('.toolbar-actions').count(),0);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
  assert.equal(await page.locator('.area-route-list').count(),0);
  pass('SWITCH626_NO_CANVAS_DRAFT_OR_EDIT_EXPORT');
  assert.equal(createHash('sha256').update(source626).digest('hex'),sourceHash);
  pass('SOURCE_BYTES_IMMUTABLE_SYNTHETIC');

  await page.setViewportSize({width:320,height:740});
  await page.waitForTimeout(150);
  const metrics=await page.evaluate(()=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth}));
  assert.ok(metrics.width<=metrics.viewport+2,JSON.stringify(metrics));
  assert.equal(await panel.isVisible(),true);
  pass('RESPONSIVE_320_READONLY');
  await page.setViewportSize({width:1280,height:960});

  await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
  await upload(page,source626);
  await page.getByText(/Unsupported save version or build/).waitFor({timeout:15000});
  assert.equal(await panel.count(),0);
  pass('WRONG_BID_DENIED');
  await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
  await page.locator('[data-wep-626-provenance] input').uncheck();
  await upload(page,source626);
  await page.getByText(/Source verification required/).waitFor({timeout:15000});
  assert.equal(await panel.count(),0);
  pass('UNKNOWN_PROVENANCE_DENIED');

  await page.locator('.platform-select select').selectOption('steam-windows');
  await upload(page,source626);
  await page.getByText(/WEP_WORLD_626_EXTERNAL_SOURCE_VERIFICATION_REQUIRED|Source verification required/).waitFor({timeout:15000});
  assert.equal(await panel.count(),0);
  pass('STEAM626_DENIED');
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('[data-wep-626-provenance] input').check();
  await upload(page,source624);
  await page.locator('.area-route-list .area-route').first().waitFor({state:'visible',timeout:15000});
  assert.equal(await panel.count(),0);
  assert.ok((await page.locator('.save-contract').innerText()).includes('current-v125-schema624'));
  pass('SCHEMA624_ROUTE_REGRESSION');

  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.consoleErrors,[]);
  pass('BROWSER_PAGE_CONSOLE_ERRORS_ZERO');
  report.result='PASS';
  await context.close();
} catch(error) {
  report.result='FAIL';
  report.error=String(error?.stack||error);
} finally {
  await mkdir('.artifacts/wep-schema626-readonly-browser',{recursive:true});
  await writeFile('.artifacts/wep-schema626-readonly-browser/report.json',JSON.stringify(report,null,2));
  await browser.close();
}
if(report.result!=='PASS') throw new Error(report.error||'SCHEMA626_READONLY_BROWSER_FAILED');
