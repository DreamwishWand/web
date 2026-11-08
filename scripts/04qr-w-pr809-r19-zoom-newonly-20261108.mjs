import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {worldEditorStage1Copy} from '../src/lib/wep/world-editor-stage1-copy.js';

// New-only independent QA, original source Git SHA pinned; do not reQA prior accepted PR775/792.
const SOURCE='30ec82ae8ff268582fb98b70446f8241c3a3df30';
const MAIN='b7ffb283df62e234ce0871d9a8f0791faa290864';
const orig=new Map([
 ['.github/workflows/wep-r19-stage1-zoom200-layout-20261108.yml','ddd72481ad566179f2d0e8baa4904697021969a9'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','daa09ef27b36cc26a9b52b7b31375cdc7b807a24'],
 ['scripts/wep-stage1-zoom200-overflow-focused-browser.mjs','8c7b89d2b0937301af76bff10d022211a2a5bae1'],
 ['src/routes/editor/world/+page.svelte','35d7bfc9aa1078853618e25736de90bd1bcecbb6']
]);
const qa=['.github/workflows/04qr-w-pr809-r19-zoom-newonly-20261108.yml',
 'scripts/04qr-w-pr809-r19-zoom-newonly-20261108.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.deepEqual(changed(MAIN,SOURCE),[...orig.keys()].sort(),'original Source4 exactly');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(changed(SOURCE,'HEAD'),qa,'QA-only changed paths exactly2');
for(const [p,sha] of orig){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha,'frozen Source4 '+p);
 assert.equal(git('hash-object',p),sha,'QA may not edit Source '+p);
}
console.log('QRW809_ORIGINAL4_BLOBS_QA2_ADD_FROZEN_PASS');

// R19 NEW-ONLY layout regression. Synthetic draft + local Moodboard, never P1G.
const origin=(process.env.WEP_STAGE1_ZOOM_LOCAL_ORIGIN||'http://127.0.0.1:4312').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'NOT_RUN: actual installed Chromium/Chrome is required');
for(const forbidden of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
  assert.ok(!process.env[forbidden],'private source forbidden in browser CI');

const boardKey='dreamwishwand:moodboards:v1';
const handoffKey='dreamwishwand:world-editor:handoff:v1';
const now='2026-11-08T00:00:00.000Z';
const board={
  schema:'wand.moodboards.local@1',version:2,updatedAt:now,
  boards:[{
    id:'stage1-board',title:'Stage 1 Board',description:'Local zoom regression only',
    createdAt:now,updatedAt:now,
    groups:[{id:'stage1-group',title:'Beach Corner',order:0,collapsed:false}],
    references:[{
      id:'stage1-item',type:'ITEM',label:'Stage 1 Furniture',
      entityId:'40000048',groupIds:['stage1-group'],
      createdAt:now,note:null,url:null
    }]
  }]
};
const boardRaw=JSON.stringify(board);
const fixture={
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'r19-zoom-only'},
  capabilities:{},metadata:{},networks:{roads:null,fences:null},
  objects:[
    {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage A',worldClass:'FurnitureItemData'}},
    {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage B',worldClass:'FurnitureItemData'}},
    {editorId:'stage-c',itemId:40000052,layer:'furniture',x:10,y:4,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage C',worldClass:'FurnitureItemData'}},
    {editorId:'stage-road',itemId:30000001,layer:'road',x:14,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Road',worldClass:'FenceAndRoadItemData'}}
  ]
};
const checks=[],metrics=[],errors=[],unsafe=[];
const lang=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({
  executablePath:process.env.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']
});
try {
  const context=await browser.newContext({
    viewport:{width:1440,height:1000},acceptDownloads:false,serviceWorkers:'block'
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/*',route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.origin===origin&&['GET','HEAD'].includes(request.method()))route.continue();
    else {unsafe.push(request.method()+' '+request.url());route.abort('blockedbyclient');}
  });
  await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
  await page.evaluate(([key,handoff,raw])=>{
    localStorage.setItem(key,raw);
    localStorage.removeItem(handoff);
  },[boardKey,handoffKey,boardRaw]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/,{timeout:20000});
  let panel=page.locator('[data-wep-decorate-stage1]');
  await panel.locator('.reference-main').filter({hasText:'Stage 1 Furniture'}).click();
  await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'r19-local-zoom-fixture.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
  panel=page.locator('[data-wep-decorate-stage1]');
  const pending=panel.locator('.pending-card').first();
  await pending.locator('input[type=number]').nth(0).fill('7');
  await pending.locator('input[type=number]').nth(1).fill('7');
  await pending.getByRole('button',{name:'Place'}).focus();
  await page.keyboard.press('Enter');
  await page.locator('g[data-editor-object]').nth(4).waitFor({timeout:15000});
  assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),1);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),boardRaw);
  checks.push('R19_VALID_LOCAL_DRAFT_PROVENANCE_PRESERVED');

  const probe=async(label)=>{
    const m=await panel.evaluate(el=>{
      const card=el.closest('.side-card');
      const sidebar=el.closest('.sidebar');
      const workspace=el.closest('.workspace');
      if(!card||!sidebar||!workspace)throw Error('STAGE1_PARENT_CHAIN_MISSING');
      const values=node=>({
        client:node.clientWidth,scroll:node.scrollWidth,
        rect:Math.round(node.getBoundingClientRect().width)
      });
      const inspector=sidebar.querySelector('.object-inspector');
      const interactive=[...sidebar.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')]
        .filter(el=>getComputedStyle(el).display!=='none');
      const btnRects=interactive.map(el=>el.getBoundingClientRect());
      return {
        viewport:window.innerWidth,zoom:getComputedStyle(document.documentElement).zoom,
        panel:values(el),card:values(card),sidebar:values(sidebar),
        workspace:values(workspace),
        inspector:inspector?values(inspector):null,
        sidebarActions:interactive.length,
        minActionWidth:btnRects.length?Math.round(Math.min(...btnRects.map(r=>r.width))):null,
        sidebarColumns:getComputedStyle(sidebar).gridTemplateColumns,
        document:values(document.documentElement)
      };
    });
    metrics.push({label,...m});
    assert.ok(m.panel.client>=100,label+' panel collapsed: '+JSON.stringify(m));
    assert.ok(m.panel.scroll<=m.panel.client+2,label+' Stage1 panel overflows: '+JSON.stringify(m));
    assert.ok(m.card.scroll<=m.card.client+2,label+' side-card overflows: '+JSON.stringify(m));
    assert.ok(m.sidebar.scroll<=m.sidebar.client+2,label+' sidebar overflows: '+JSON.stringify(m));
    assert.ok(m.sidebarActions>=2,label+' sidebar controls disappeared: '+JSON.stringify(m));
    assert.ok(m.minActionWidth>=12,label+' actionable sidebar hit target collapsed: '+JSON.stringify(m));
    assert.ok(m.workspace.client>=m.sidebar.client,label+' workspace narrower than sidebar: '+JSON.stringify(m));
    return m;
  };
  // Keep keyboard Settings on its accepted, visible wide-layout route.
  // Then change only the viewport/zoom for a focused Stage1 layout probe.
  const selectLocaleByKeyboard=async(locale)=>{
    await page.evaluate(()=>document.documentElement.style.zoom='1');
    await page.setViewportSize({width:1440,height:1000});
    const settings=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"] button.immersive-settings');
    await settings.focus();
    await page.keyboard.press('Enter');
    const select=page.locator('#site-locale-mobile');
    await select.waitFor({state:'visible',timeout:12000});
    await select.selectOption(locale);
    await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
    await page.keyboard.press('Escape');
    await select.waitFor({state:'hidden',timeout:12000});
  };
  const reviewBeforeZoom=await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count();
  for(const locale of lang){
    await selectLocaleByKeyboard(locale);
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>document.documentElement.style.zoom='2');
    await probe('CSS_ZOOM200_VIEWPORT640_'+locale);
    await page.evaluate(()=>document.documentElement.style.zoom='1');
    await page.setViewportSize({width:320,height:844});
    await probe('MOBILE320_ZOOM100_'+locale);
    assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),
      reviewBeforeZoom,'zoom/locale changed Draft history');
  }
  await selectLocaleByKeyboard('en');
  // Additional independent changed-risk viewport: 375px and 768px at 200% zoom.
  for(const width of [375,480,768]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>document.documentElement.style.zoom='2');
    await probe('INDEPENDENT_CSS_ZOOM200_VIEWPORT'+width);
    await page.evaluate(()=>document.documentElement.style.zoom='1');
  }
  await page.setViewportSize({width:320,height:844});
  checks.push('QRW809_8_LOCALE_KEYBOARD_ZOOM200_320_375_480_768_NO_OVERFLOW_NO_DRAFT_MUTATION');
  // Changed layout must not mask Canvas Hit, selection or local Undo.
  await page.locator('[data-editor-object-id="stage-a"]').click();
  assert.match(await page.locator('[data-editor-object-id="stage-a"]').getAttribute('class'),/selected/);
  const undo=page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true});
  assert.equal(await undo.isEnabled(),true);
  await undo.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('g[data-editor-object]').length===4);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),boardRaw);
  const inspector=page.locator('.object-inspector');
  await inspector.waitFor({state:'visible'});
  const inspectorMetrics=await inspector.evaluate(el=>({
    client:el.clientWidth,scroll:el.scrollWidth,heading:el.querySelector('h3')?.textContent
  }));
  assert.ok(inspectorMetrics.client>=80,'Inspector actionable region collapsed');
  assert.ok(inspectorMetrics.scroll<=inspectorMetrics.client+2,
    'Inspector overflow: '+JSON.stringify(inspectorMetrics));
  checks.push('QRW809_CANVAS_HIT_SELECTION_INSPECTOR_KEYBOARD_UNDO_MOODBOARD_BYTES_INVARIANT');

  // Preserve accepted PR775/QA792 stale-handoff identity across the changed CSS.
  // Only one new layout-sensitive smoke: selection timestamp tampered at 200% viewport640.
  await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open in World Editor'}).click();
  await page.waitForURL(/\\/editor\\/world\\/?$/,{timeout:20000});
  const stalePanel=page.locator('[data-wep-decorate-stage1]');
  await stalePanel.locator('.reference-main').filter({hasText:'Stage 1 Furniture'}).click();
  await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'qrw809-stale-handoff-independent.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
  const rawBefore=await page.evaluate(key=>localStorage.getItem(key),boardKey);
  const staleBefore=await page.evaluate(key=>localStorage.getItem(key),handoffKey);
  assert.ok(staleBefore?.length>20,'actual handoff missing');
  await page.evaluate(key=>{
    const h=JSON.parse(localStorage.getItem(key));
    h.createdAt='2026-11-08T04:00:00.000Z';
    localStorage.setItem(key,JSON.stringify(h));
  },handoffKey);
  await page.setViewportSize({width:640,height:900});
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  const selectedPending=stalePanel.locator('.pending-card').first();
  await selectedPending.getByRole('button',{name:'Place'}).focus();
  await page.keyboard.press('Enter');
  await stalePanel.locator('.stage1-status').filter({
    hasText:worldEditorStage1Copy('en').staleReference
  }).waitFor({timeout:12000});
  assert.equal(await page.locator('g[data-editor-object]').count(),4,'stale handoff must not insert');
  assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0);
  assert.equal(await stalePanel.locator('.pending-card').count(),0,'stale selection must be cleared');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey),rawBefore);
  checks.push('QRW809_STALE_HANDOFF_AT_CSS200_ZERO_INSERT_ZERO_HISTORY_ORIGINAL_LOCAL_BOARD_RAW_UNCHANGED');
  await page.evaluate(()=>{document.documentElement.style.zoom='1';});

  assert.deepEqual(unsafe,[],'no off-origin request or write request');
  assert.deepEqual(errors,[],'no page errors');
  console.log(JSON.stringify({status:'PASS',operation:'QRW809_INDEPENDENT_R19_ZOOM_LAYOUT',
    fixture:'SYNTHETIC_ONLY',checks,metrics,unsafe,errors},null,2));
} catch(error) {
  console.error(JSON.stringify({status:'FAIL',operation:'WEP_R19_STAGE1_ZOOM_LAYOUT',
    error:String(error.stack||error),checks,metrics,unsafe,errors},null,2));
  process.exitCode=1;
} finally {
  await browser.close();
}
