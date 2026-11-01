import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const zoom = 2.0;
const baseUrl = process.env.WEP_NATIVE_ZOOM_BASE_URL || 'http://127.0.0.1:4187/editor/world/';
const artifactDir = resolve('.artifacts/wep-actual-zoom200');
const extensionPath = resolve('tests/browser/wep-zoom200-extension');
await mkdir(artifactDir, { recursive: true });

const report = {
  schema: 'dreamwish-wand-wep-native-chrome-tab-zoom200@1',
  platform: 'Chromium / desktop',
  zoomMethod: 'chrome.tabs.setZoom + chrome.tabs.getZoom',
  zoomLevel: zoom,
  proofKind: 'NATIVE_BROWSER_TAB_ZOOM_API_NOT_MENU_CLICK',
  viewportTest: '1280x960 desktop; NOT CSS 640px viewport override, NOT 320px responsive acceptance',
  fixture: 'SYNTHETIC_ONLY',
  productSourceChanged: false,
  checks: [],
  consoleErrors: [],
  pageErrors: [],
  browser: {},
  result: 'PENDING'
};
const pass = (name, detail = {}) => report.checks.push({ name, verdict: 'PASS', ...detail });
const nameSel = name => 'g[data-editor-object][aria-label^="' + name + ' at"]';
const testDoc = {
  schema: 'dreamwish-wand-wep-editor-document', version: 1,
  target: { gameVersion: '1.25.0', platform: 'synthetic', areaKey: 'native-browser-zoom200' },
  capabilities: {}, metadata: {},
  objects: [
    {editorId:'chair', itemId:40000001, layer:'furniture',x:2,y:2,orientation:0,
      footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
      editability:'editable',metadata:{displayName:'Editable Chair',reasons:[]}},
    {editorId:'lamp', itemId:40000002, layer:'furniture',x:6,y:2,orientation:0,
      footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
      editability:'editable',metadata:{displayName:'Editable Lamp',reasons:[]}},
    {editorId:'protected', itemId:40000003, layer:'furniture',x:10,y:2,orientation:0,
      footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
      editability:'readonly',metadata:{displayName:'Protected Object',reasons:['PROGRESSION_OWNERSHIP_UNKNOWN']}}
  ],
  networks: { roads: null, fences: null }
};
const readOnly626 = {
  GameInfo: {Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player: {},
  World: {
    Villages: [{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
    GridCollection: {Grids:{'10':{ID:10,Objects:{'42':{State:{Opaque:true}}}}}}
  },
  OpaqueRoot: {preserve:true}
};

const userDataDir = await mkdtemp(join(tmpdir(), 'wep-chrome-zoom200-'));
let context;
try {
  // Chromium full binary with newer native headless: not the old headless shell.
  // Persistent context is essential for Chrome MV3 extension support.
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium', headless: true,
    viewport: {width:1280,height:960}, acceptDownloads:false,
    args: ['--no-sandbox','--disable-dev-shm-usage',
      '--disable-extensions-except=' + extensionPath,
      '--load-extension=' + extensionPath]
  });
  report.browser.userAgent = await context.newPage().then(async page => {
    const agent = await page.evaluate(() => navigator.userAgent);
    await page.close();
    return agent;
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(String(error)));
  page.on('console', item => {if(item.type() === 'error') report.consoleErrors.push(item.text())});
  await page.goto(baseUrl, {waitUntil:'networkidle'});
  const sw = context.serviceWorkers()[0] ??
    await context.waitForEvent('serviceworker', {timeout:20000});
  assert.match(sw.url(), /^chrome-extension:\/\/[a-z]+\/background\.js$/);
  report.browser.extensionId = sw.url().split('/')[2];
  const before = await page.evaluate(() => ({
    innerWidth, outerWidth, dpr:devicePixelRatio,
    visualScale:visualViewport?.scale ?? null,
    canvasPresent:!!document.querySelector('.world-canvas')
  }));
  const changed = await sw.evaluate(async url => {
    const candidates = await chrome.tabs.query({});
    const target = candidates.find(t => t.url?.startsWith(url));
    if (!target?.id) throw new Error('CHROME_ZOOM_TARGET_TAB_NOT_FOUND');
    const prior = await chrome.tabs.getZoom(target.id);
    await chrome.tabs.setZoom(target.id, 2.0);
    const actual = await chrome.tabs.getZoom(target.id);
    const settings = await chrome.tabs.getZoomSettings(target.id);
    return {prior,actual,settings,tabId:target.id};
  }, baseUrl);
  assert.ok(Math.abs(changed.actual-2) < 0.001, JSON.stringify(changed));
  const after = await page.evaluate(() => ({
    innerWidth, outerWidth, dpr:devicePixelRatio,
    visualScale:visualViewport?.scale ?? null
  }));
  report.browser.zoom = changed;
  report.browser.before = before;
  report.browser.after = after;
  assert.ok(after.dpr > before.dpr * 1.8 ||
    after.innerWidth < before.innerWidth * 0.6,
    'Chrome reported 2x but did not visibly affect CSS scale: ' +
    JSON.stringify({before,after}));
  assert.ok(Math.abs(after.visualScale - 1) < 0.01,
    'Pinch zoom is not tab zoom: ' + JSON.stringify(after));
  pass('NATIVE_CHROME_TAB_ZOOM_2X_VERIFIED', {before,after});

  const payload=Buffer.from(JSON.stringify(testDoc));
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'native-zoom-synthetic.json',mimeType:'application/json',buffer:payload
  });
  await page.getByText('Synthetic draft authoring', {exact:true}).waitFor();
  const chair=page.locator(nameSel('Editable Chair')).first();
  const svg=page.locator('.world-canvas');
  await chair.waitFor();
  const location=await chair.evaluate(node=>{
    const rect=node.querySelector('.object-cell').getBoundingClientRect();
    const p={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    const world=new DOMPoint(p.x,p.y).matrixTransform(node.ownerSVGElement.getScreenCTM().inverse());
    return {client:p,world:{x:world.x,y:world.y},rect:{width:rect.width,height:rect.height}};
  });
  assert.ok(Math.abs(location.world.x-2.5)<0.05 && Math.abs(location.world.y-2.5)<0.05,
    'Actual 2x coordinate mapping failed '+JSON.stringify(location));
  await page.mouse.click(location.client.x,location.client.y);
  await assert.equal(await page.locator('g.selected[data-editor-object]').count(),1);
  assert.ok(await chair.getAttribute('class')?.then(v=>v?.includes('selected')) || await chair.evaluate(el=>el.classList.contains('selected')));
  pass('NATIVE_ZOOM_POINTER_TO_SVG_WORLD_COORDINATES_AND_SELECTION',{location});

  const toolbar=page.locator('.toolbar-actions');
  await toolbar.getByRole('button',{name:'Move right'}).click();
  await page.locator(nameSel('Editable Chair')+'[aria-label$="3, 2"]').waitFor();
  await toolbar.getByRole('button',{name:'Undo',exact:true}).click();
  await page.locator(nameSel('Editable Chair')+'[aria-label$="2, 2"]').waitFor();
  await toolbar.getByRole('button',{name:'Redo',exact:true}).click();
  await page.locator(nameSel('Editable Chair')+'[aria-label$="3, 2"]').waitFor();
  pass('NATIVE_ZOOM_DRAFT_MOVE_UNDO_REDO');

  // Use the roving SVG keyboard focus; no browser zoom shortcuts are synthesized.
  const moved=page.locator(nameSel('Editable Chair')).first();
  await moved.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.locator(nameSel('Editable Chair')+'[aria-label$="4, 2"]').waitFor();
  await page.keyboard.press('Control+z');
  await page.locator(nameSel('Editable Chair')+'[aria-label$="3, 2"]').waitFor();
  await page.keyboard.press('Control+Shift+z');
  await page.locator(nameSel('Editable Chair')+'[aria-label$="4, 2"]').waitFor();
  pass('NATIVE_ZOOM_KEYBOARD_SELECTION_MOVE_UNDO_REDO');

  // Source has click-only SVG object handles; verify drag gesture never
  // silently writes a new coordinate or creates an unreviewed draft.
  const dragStart=await page.locator(nameSel('Editable Chair')).first().boundingBox();
  assert.ok(dragStart);
  const lampBox=await page.locator(nameSel('Editable Lamp')).first().boundingBox();
  assert.ok(lampBox);
  await page.mouse.move(dragStart.x+dragStart.width/2,dragStart.y+dragStart.height/2);
  await page.mouse.down();
  await page.mouse.move(lampBox.x+lampBox.width/2,lampBox.y+lampBox.height/2,{steps:8});
  await page.mouse.up();
  await page.locator(nameSel('Editable Chair')+'[aria-label$="4, 2"]').waitFor();
  report.drag = 'NOT_IMPLEMENTED_AS_NATIVE_DRAG_COMMAND_NO_UNREVIEWED_MUTATION';
  pass('NATIVE_ZOOM_DRAG_FAIL_CLOSED_NO_UNREVIEWED_POSITION_CHANGE');

  const review=toolbar.getByRole('button',{name:'Review Save Prep'});
  await review.click();
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0,
    'synthetic local editor must not reveal real DDV save export');
  report.review = 'LOCAL_REVIEW_SAVE_PREP_ONLY; VERIFIED_SAVE_REVIEW_NOT_AUTHORIZED_FOR_SYNTHETIC';
  pass('NATIVE_ZOOM_LOCAL_REVIEW_NO_DDV_WRITER');
  await page.screenshot({path:join(artifactDir,'native-200-synthetic-editor.png'),fullPage:true});

  // Same tab retains genuine zoom setting on v1.25.3 P1G read-only intake.
  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
  await page.locator('[data-wep-626-provenance] input').check();
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'native-zoom-readonly626.save',mimeType:'application/octet-stream',
    buffer:Buffer.from(makeSyntheticP1gProfile(readOnly626))
  });
  await page.locator('[data-wep-626-readonly]').waitFor({state:'visible'});
  assert.equal(await page.locator('.editor-shell').count(),0);
  assert.equal(await page.locator('.toolbar-actions').count(),0);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  assert.equal(await page.locator('.area-route-list').count(),0);
  const zoom626=await sw.evaluate(async id=>chrome.tabs.getZoom(id),changed.tabId);
  assert.ok(Math.abs(zoom626-2)<0.001,'tab zoom lost on 626 navigation');
  pass('NATIVE_ZOOM_626_READONLY_NO_CANVAS_DRAFT_APPLY');
  await page.screenshot({path:join(artifactDir,'native-200-readonly626.png'),fullPage:true});

  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.consoleErrors,[]);
  report.result='PASS';
} catch(error) {
  report.result='FAIL';
  report.error=String(error?.stack || error);
} finally {
  await writeFile(join(artifactDir,'report.json'),JSON.stringify(report,null,2)+'\n');
  await context?.close().catch(()=>{});
  await rm(userDataDir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.result!=='PASS') process.exitCode=1;
