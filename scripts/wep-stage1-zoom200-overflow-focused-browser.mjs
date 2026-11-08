import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

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
      return {
        viewport:window.innerWidth,zoom:getComputedStyle(document.documentElement).zoom,
        panel:values(el),card:values(card),sidebar:values(sidebar),
        workspace:values(workspace),
        sidebarColumns:getComputedStyle(sidebar).gridTemplateColumns,
        document:values(document.documentElement)
      };
    });
    metrics.push({label,...m});
    assert.ok(m.panel.client>=100,label+' panel collapsed: '+JSON.stringify(m));
    assert.ok(m.panel.scroll<=m.panel.client+2,label+' Stage1 panel overflows: '+JSON.stringify(m));
    assert.ok(m.card.scroll<=m.card.client+2,label+' side-card overflows: '+JSON.stringify(m));
    assert.ok(m.sidebar.scroll<=m.sidebar.client+2,label+' sidebar overflows: '+JSON.stringify(m));
    return m;
  };
  const keyboardLocales=async(label)=>{
    const settings=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"] button.immersive-settings');
    await settings.focus();
    await page.keyboard.press('Enter');
    const select=page.locator('#site-locale-mobile');
    await select.waitFor({state:'visible',timeout:12000});
    const reviewCount=await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count();
    for(const locale of lang){
      await select.selectOption(locale);
      await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
      const m=await probe(label+'_'+locale);
      assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),
        reviewCount,'zoom/locale changed Draft history');
      assert.ok(m.panel.client>0);
    }
    await select.selectOption('en');
    await page.keyboard.press('Escape');
    await select.waitFor({state:'hidden'});
    checks.push(label+'_8_LOCALE_KEYBOARD_NO_OVERFLOW_NO_MUTATION');
  };

  await page.setViewportSize({width:640,height:900});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await keyboardLocales('CSS_ZOOM200_VIEWPORT640');
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.setViewportSize({width:320,height:844});
  await keyboardLocales('MOBILE320_ZOOM100');
  // Changed layout must not mask Canvas Hit, selection or local Undo.
  await page.locator('[data-editor-object-id="stage-a"]').click();
  assert.match(await page.locator('[data-editor-object-id="stage-a"]').getAttribute('class'),/selected/);
  const undo=page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true});
  assert.equal(await undo.isEnabled(),true);
  await undo.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('g[data-editor-object]').length===4);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),boardRaw);
  checks.push('R19_CANVAS_HIT_SELECTION_KEYBOARD_UNDO_AND_MOODBOARD_RAW_UNCHANGED');

  assert.deepEqual(unsafe,[],'no off-origin request or write request');
  assert.deepEqual(errors,[],'no page errors');
  console.log(JSON.stringify({status:'PASS',operation:'WEP_R19_STAGE1_ZOOM_LAYOUT',
    fixture:'SYNTHETIC_ONLY',checks,metrics,unsafe,errors},null,2));
} catch(error) {
  console.error(JSON.stringify({status:'FAIL',operation:'WEP_R19_STAGE1_ZOOM_LAYOUT',
    error:String(error.stack||error),checks,metrics,unsafe,errors},null,2));
  process.exitCode=1;
} finally {
  await browser.close();
}
