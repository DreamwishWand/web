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
async function upload(page, buffer, name='profile.save') {
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name, mimeType:'application/octet-stream', buffer
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
  // Raw source cardinality: not native layout/footprint/Writer semantics.
  assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'1');
  pass('SWITCH626_RAW_GRIDOBJECT_ENTRY_COUNT_VISIBLE');
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

  // Steam schema626 is intentionally NOT a product read/Canvas acceptance.
  await page.locator('.platform-select select').selectOption('steam-windows');
  await upload(page,source626);
  await panel.waitFor({state:'visible',timeout:15000});
  const steamLimited=page.locator('[data-wep-steam626-limited]');
  await steamLimited.waitFor({state:'visible'});
  assert.match(await steamLimited.innerText(),/Steam schema 626.*structural inspection/i);
  assert.match(await steamLimited.innerText(),/productionReadAccepted=false/);
  assert.match(await steamLimited.innerText(),/exactBuildKnown=false/);
  assert.match(await page.locator('[data-wep-steam626-undo-preview]').innerText(),/Undo\/Redo/);
  assert.equal(await page.locator('.editor-shell').count(),0);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  assert.equal(await page.locator('.area-route-list').count(),0);
  assert.equal(await page.locator('.save-source-heading dd').nth(5).innerText(),'UNKNOWN');
  pass('STEAM626_LIMITED_V1_STRUCTURE_NOT_PRODUCT_READ');

  // Visible user-facing Settings; never force a hidden immersive locale select.
  const shell=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"]');
  const settings=shell.locator('button.immersive-settings');
  assert.equal(await page.locator('#site-locale').isVisible(),false);
  await settings.focus();
  await page.keyboard.press('Enter');
  const localeSelect=page.locator('#site-locale-mobile');
  await localeSelect.waitFor({state:'visible'});
  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    await localeSelect.selectOption(locale);
    await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
    assert.equal(await steamLimited.isVisible(),true);
    assert.equal(await page.locator('.editor-shell').count(),0);
  }
  await localeSelect.selectOption('en');
  await page.keyboard.press('Escape');
  await localeSelect.waitFor({state:'hidden'});
  pass('STEAM626_EIGHT_LOCALES_VISIBLE_SETTINGS_KEYBOARD');

  // A visible panel from an earlier fixture is NOT evidence that the new
  // asynchronous import finished. An opaque epoch is assigned to the newly
  // committed source receipt, without exposing original Save bytes or hashes.
  const activeSourceEpoch=async()=> {
    const rawEpoch=await page.locator('.save-source-browser').getAttribute('data-wep-source-epoch');
    const value=Number(rawEpoch);
    assert.ok(rawEpoch!==null&&Number.isSafeInteger(value)&&value>0,'active source receipt epoch required');
    return value;
  };
  const awaitFreshReceipt=async(previousEpoch)=> {
    await page.waitForFunction(previous=>{
      const current=document.querySelector('.save-source-browser[data-wep-source-epoch]');
      if(!current) return false;
      const epoch=Number(current.getAttribute('data-wep-source-epoch'));
      return Number.isSafeInteger(epoch)&&epoch>previous;
    },previousEpoch,{timeout:15000});
    await steamLimited.waitFor({state:'visible'});
  };
  const firstEpoch=await activeSourceEpoch();
  const missing=structuredClone(profile626);
  delete missing.World.Villages[0].Areas;
  delete missing.World.GridCollection.Grids['10'].Objects;
  await upload(page,Buffer.from(makeSyntheticP1gProfile(missing)));
  await awaitFreshReceipt(firstEpoch);
  assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'UNKNOWN');
  assert.equal((await page.locator('[data-wep-626-readonly] dd').nth(1).innerText()).trim(),'UNKNOWN');
  const secondEpoch=await activeSourceEpoch();
  assert.ok(secondEpoch>firstEpoch,'missing fixture must replace prior receipt');
  const empty=structuredClone(profile626);
  empty.World.Villages[0].Areas={};
  empty.World.GridCollection.Grids['10'].Objects={};
  await upload(page,Buffer.from(makeSyntheticP1gProfile(empty)));
  await awaitFreshReceipt(secondEpoch);
  assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'0');
  assert.equal((await page.locator('[data-wep-626-readonly] dd').nth(1).innerText()).trim(),'0');
  pass('STEAM626_NEW_RECEIPT_EPOCH_REVOKES_PRIOR_VALUE');
  pass('STEAM626_MISSING_UNKNOWN_VS_EXPLICIT_EMPTY_ZERO');

  // Deterministic overlapping imports: test both completion orders, including
  // a rejected obsolete read. Only the newest initiated import may publish
  // its receipt, clear loading, or set the error/status message.
  await page.evaluate(() => {
    const original=File.prototype.arrayBuffer;
    window.__wepImportRace=Object.create(null);
    File.prototype.arrayBuffer=function(...args) {
      if(!this.name.startsWith('race-hold-')) return original.apply(this,args);
      const name=this.name;
      const file=this;
      const hook={status:'held'};
      window.__wepImportRace[name]=hook;
      return new Promise((resolve,reject)=>{
        hook.release=(rejectOld=false)=>{
          if(rejectOld){
            hook.status='rejected';
            reject(Error('obsolete synthetic file read rejection'));
            return Promise.resolve();
          }
          return original.apply(file,args).then(bytes=>{
            hook.status='delivered';
            resolve(bytes);
          },reject);
        };
      });
    };
  });
  const raceBuffer=(profile)=>Buffer.from(makeSyntheticP1gProfile(profile));
  const awaitHeld=async(name)=>page.waitForFunction(
    n=>window.__wepImportRace?.[n]?.status==='held',name,{timeout:15000}
  );
  const settleBrowserTasks=async()=>page.evaluate(()=>new Promise(resolve=>{
    requestAnimationFrame(()=>requestAnimationFrame(resolve));
  }));
  const expectUnknown=async()=> {
    assert.equal((await panel.locator('dl dd').nth(1).innerText()).trim(),'UNKNOWN');
    assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'UNKNOWN');
    assert.equal(await page.locator('.editor-shell').count(),0);
    assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  };
  const awaitRevoked=async()=> {
    await page.locator('.save-source-browser').waitFor({state:'hidden',timeout:15000});
    assert.equal(await panel.count(),0,'previous receipt removed while new file pending');
  };

  // A older held; B newest completes UNKNOWN; A released afterward must not
  // overwrite B with stale explicit zero or hide B's committed status.
  let beforeOverlap=await activeSourceEpoch();
  await upload(page,raceBuffer(empty),'race-hold-older-a.p1g');
  await awaitHeld('race-hold-older-a.p1g');
  await awaitRevoked();
  await upload(page,raceBuffer(missing),'race-newer-b.p1g');
  await awaitFreshReceipt(beforeOverlap);
  await expectUnknown();
  let committed=await activeSourceEpoch();
  await page.evaluate(()=>window.__wepImportRace['race-hold-older-a.p1g'].release());
  await settleBrowserTasks();
  assert.equal(await activeSourceEpoch(),committed,'A cannot re-publish after B');
  await expectUnknown();
  pass('STEAM626_OLDER_ASYNC_SUCCESS_CANNOT_OVERWRITE_NEWER_RECEIPT');

  // B newer held; A older completes while B is still pending. A must not
  // resurrect a receipt or set loading=false before B succeeds.
  beforeOverlap=await activeSourceEpoch();
  await upload(page,raceBuffer(empty),'race-hold-older-a2.p1g');
  await awaitHeld('race-hold-older-a2.p1g');
  await upload(page,raceBuffer(missing),'race-hold-newer-b2.p1g');
  await awaitHeld('race-hold-newer-b2.p1g');
  await awaitRevoked();
  await page.evaluate(()=>window.__wepImportRace['race-hold-older-a2.p1g'].release());
  await settleBrowserTasks();
  assert.equal(await panel.count(),0,'late older A cannot display while B awaits bytes');
  await page.evaluate(()=>window.__wepImportRace['race-hold-newer-b2.p1g'].release());
  await awaitFreshReceipt(beforeOverlap);
  await expectUnknown();
  pass('STEAM626_NEWER_PENDING_OLDER_ASYNC_SUCCESS_NO_STALE_RESTORE');

  // A older rejects after B commits. Its catch/finally must not clear B or
  // replace B's status with the obsolete read error.
  beforeOverlap=await activeSourceEpoch();
  await upload(page,raceBuffer(empty),'race-hold-rejected-a3.p1g');
  await awaitHeld('race-hold-rejected-a3.p1g');
  await awaitRevoked();
  await upload(page,raceBuffer(missing),'race-newer-b3.p1g');
  await awaitFreshReceipt(beforeOverlap);
  committed=await activeSourceEpoch();
  await page.evaluate(()=>window.__wepImportRace['race-hold-rejected-a3.p1g'].release(true));
  await settleBrowserTasks();
  await expectUnknown();
  assert.equal(await activeSourceEpoch(),committed,'stale rejected import cannot revoke latest receipt');
  assert.equal(await page.getByText('obsolete synthetic file read rejection').count(),0);
  pass('STEAM626_STALE_ASYNC_REJECTION_CATCH_FINALLY_NO_REVOCATION');

  await page.setViewportSize({width:320,height:740});
  await page.waitForTimeout(150);
  const steamWidth=await page.evaluate(()=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth}));
  assert.ok(steamWidth.width<=steamWidth.viewport+2,JSON.stringify(steamWidth));
  await page.setViewportSize({width:1280,height:960});
  pass('STEAM626_320PX_NO_OVERFLOW');

  await page.locator('.platform-select select').selectOption('unknown');
  await upload(page,source626);
  await page.getByText(/Source verification required/).waitFor({timeout:15000});
  assert.equal(await panel.count(),0);
  pass('UNKNOWN_SOURCE_SCHEMA626_DENIED');

  assert.equal(createHash('sha256').update(source626).digest('hex'),sourceHash);
  pass('STEAM626_ORIGINAL_SOURCE_IMMUTABLE');
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
