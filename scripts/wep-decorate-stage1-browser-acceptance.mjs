import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root=(process.env.WEP_STAGE1_BASE_URL||'http://127.0.0.1:4175').replace(/\/$/,'');
const chrome=process.env.CHROME_BIN;
if(!chrome)throw new Error('CHROME_BIN is required.');
const artifactDir='.artifacts/wep-decorate-stage1-browser';
await mkdir(artifactDir,{recursive:true});

const moodboardKey='dreamwishwand:moodboards:v1';
const handoffKey='dreamwishwand:world-editor:handoff:v1';
const recoveryIndexKey='dreamwishwand:world-editor:recovery:index:v1';

function assertNoOverflow(metrics,label){
  assert.ok(metrics.scrollWidth<=metrics.clientWidth+2,label+' horizontal overflow');
}
async function eventually(fn,timeout=30000){
  const end=Date.now()+timeout;
  let last;
  while(Date.now()<end){
    try{const value=await fn();if(value)return value;}catch(error){last=error;}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(last)throw last;
  throw new Error('Timed out waiting for condition.');
}
async function seedMoodboard(page){
  const doc={
    schema:'wand.moodboards.local@1',
    version:2,
    updatedAt:'2026-10-05T00:00:00.000Z',
    boards:[{
      id:'stage1-board',
      title:'Stage 1 Board',
      description:'Decorate acceptance',
      createdAt:'2026-10-05T00:00:00.000Z',
      updatedAt:'2026-10-05T00:00:00.000Z',
      groups:[{id:'stage1-group',title:'Beach Corner',order:0,collapsed:false}],
      references:[
        {id:'stage1-item',type:'ITEM',label:'Stage 1 Furniture',url:null,entityId:'40000048',note:'Canonical Item reference',groupIds:['stage1-group'],createdAt:'2026-10-05T00:00:00.000Z'},
        {id:'stage1-note',type:'NOTE',label:'Warm lighting',url:null,entityId:null,note:'Reference only',groupIds:['stage1-group'],createdAt:'2026-10-05T00:00:00.000Z'},
        {id:'stage1-preset',type:'WAND_PRESET',label:'Stage 1 Preset',url:null,entityId:'preset-stage1',note:null,groupIds:['stage1-group'],createdAt:'2026-10-05T00:00:00.000Z'}
      ]
    }]
  };
  await page.evaluate(({moodboardKey,handoffKey,recoveryIndexKey,doc})=>{
    localStorage.setItem(moodboardKey,JSON.stringify(doc));
    localStorage.removeItem(handoffKey);
    localStorage.removeItem(recoveryIndexKey);
    for(const key of Object.keys(localStorage)){
      if(key.startsWith('dreamwishwand:world-editor:recovery:v1:'))localStorage.removeItem(key);
    }
  },{moodboardKey,handoffKey,recoveryIndexKey,doc});
  return JSON.stringify(doc);
}

const synthetic={
  schema:'dreamwish-wand-wep-editor-document',
  version:1,
  target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'stage1-browser'},
  capabilities:{},
  metadata:{},
  networks:{roads:null,fences:null},
  objects:[
    {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage A',worldClass:'FurnitureItemData'}},
    {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage B',worldClass:'FurnitureItemData'}},
    {editorId:'stage-c',itemId:40000052,layer:'furniture',x:10,y:4,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage C',worldClass:'FurnitureItemData'}},
    {editorId:'stage-road',itemId:30000001,layer:'road',x:14,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage Road',worldClass:'FenceAndRoadItemData'}}
  ]
};

const recoveryProfile={
  GameInfo:{Version:624,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{},
  ProfileWorld:{Stores:[],Shops:[]},
  ConditionalEventHistory:{ActiveEvents:{}},
  World:{
    GridCollection:{
      Grids:{
        '10':{
          ID:10,
          GridDataPath:'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath:'',
          TessellationFactor:2,
          NextGridObjectID:102,
          Objects:{
            '101':{ID:101,ItemID:40000048,X:10,Y:10,Orientation:'GridOrientation_Up',State:null}
          }
        }
      },
      DiffGrids:{}
    },
    Villages:[{SceneItemId:1540000000,Areas:{'7':{GridIDs:[10],Unlocked:true,EnvironmentEffectItemID:0,EnvironmentEffectOrientation:'GridOrientation_Up'}}}],
    FloatingIslands:{},
    MissionSlots:{},
    QuestInfo:{},
    Keyholes:{}
  }
};

const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence={schema:'dreamwish-wand-wep-decorate-stage1-browser@1',checks:[],pageErrors:[],consoleErrors:[]};
function pass(name,detail={}){evidence.checks.push({name,status:'PASS',...detail});}

try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',error=>evidence.pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')evidence.consoleErrors.push(message.text());});

  await page.goto(root+'/moodboards/',{waitUntil:'networkidle'});
  const seeded=await seedMoodboard(page);
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Stage 1 Board'}).waitFor();
  await page.getByRole('button',{name:'Open in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/);
  const stage=page.locator('[data-wep-decorate-stage1]');
  await stage.waitFor();
  assert.ok((await stage.innerText()).includes('Stage 1 Board'));
  assert.ok((await stage.innerText()).includes('Beach Corner'));
  assert.ok((await stage.innerText()).includes('Stage 1 Furniture'));
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),moodboardKey),seeded);
  pass('MOODBOARD_TO_WORLD_EDITOR_HANDOFF');

  await stage.locator('.reference-main').filter({hasText:'Stage 1 Furniture'}).click();
  const pending=stage.locator('.pending-card').first();
  assert.ok((await pending.innerText()).includes('40000048'));
  assert.equal(await pending.getByRole('button',{name:'Place'}).isDisabled(),true);
  const moodHandoff=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),handoffKey);
  assert.equal(moodHandoff.sourceSurface,'moodboard');
  assert.equal(moodHandoff.persistentWriteAuthorized,false);
  pass('PENDING_ITEM_SOURCE_SURVIVES_MOODBOARD_HANDOFF');

  await stage.locator('.reference-main').filter({hasText:'Stage 1 Preset'}).click();
  const presetCard=stage.locator('.pending-card').first();
  assert.ok((await presetCard.innerText()).includes('preset-stage1'));
  assert.equal(await presetCard.getByRole('button',{name:'Preview & Preflight'}).isDisabled(),true);
  pass('PENDING_WAND_PRESET_FAILS_CLOSED_WITHOUT_CONNECTED_PREFLIGHT');

  await page.goto(root+'/explore/',{waitUntil:'networkidle'});
  await page.locator('.controls input[type="search"]').fill('40000048');
  await eventually(async()=>await page.locator('.card-review').count()===1);
  const beforeExplore=await page.evaluate((handoffKey)=>Object.fromEntries(
    Object.entries(localStorage).filter(([key])=>key!==handoffKey)
  ),handoffKey);
  await page.locator('.card-review').click();
  const quick=page.locator('.quick-review');
  await quick.waitFor();
  assert.ok((await quick.innerText()).includes('40000048'));
  const placeDirect=quick.getByRole('button',{name:'Place in World Editor'});
  assert.equal(await placeDirect.isVisible(),true);
  await placeDirect.click();
  await page.waitForURL(/\/editor\/world\/?$/);
  await page.locator('[data-wep-decorate-stage1]').waitFor();
  assert.ok((await page.locator('[data-wep-decorate-stage1] .pending-card').first().innerText()).includes('40000048'));
  const afterExplore=await page.evaluate((handoffKey)=>Object.fromEntries(
    Object.entries(localStorage).filter(([key])=>key!==handoffKey)
  ),handoffKey);
  assert.deepEqual(
    afterExplore,
    beforeExplore,
    'Explore direct handoff changed Moodboard/Favorite/Collection-adjacent local state'
  );
  pass('EXPLORE_TO_WORLD_EDITOR_DIRECT_HANDOFF');

  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'stage1-editor-document.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(synthetic))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
  const stageBound=page.locator('[data-wep-decorate-stage1]');
  assert.ok((await stageBound.locator('.pending-card').first().innerText()).includes('40000048'));
  const beforePlacement=await page.evaluate(key=>localStorage.getItem(key),moodboardKey);
  const placementCard=stageBound.locator('.pending-card').first();
  await placementCard.locator('input[type="number"]').nth(0).fill('7');
  await placementCard.locator('input[type="number"]').nth(1).fill('7');
  await placementCard.getByRole('button',{name:'Place'}).click();
  await eventually(async()=>await page.locator('g[data-editor-object]').count()===5);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),moodboardKey),beforePlacement);
  const review=page.locator('[data-wep-stage1-review]');
  assert.ok((await review.innerText()).includes('Added'));
  assert.ok((await review.innerText()).includes('40000048'));
  pass('PENDING_ITEM_PLACEMENT_DRAFT_ONLY_NO_MOODBOARD_MUTATION');

  const clear=page.getByRole('button',{name:'Clear selection'});
  await clear.click();
  await page.locator('[data-editor-object-id="stage-a"]').click();
  await page.locator('[data-editor-object-id="stage-b"]').click({modifiers:['Control']});
  const alignLeft=stageBound.getByRole('button',{name:'Left',exact:true});
  assert.equal(await alignLeft.isEnabled(),true);
  await alignLeft.focus();
  await page.keyboard.press('Enter');
  await eventually(async()=>String(await page.locator('[data-editor-object-id="stage-b"]').getAttribute('aria-label')).includes('at 0, 2'));
  pass('ALIGNMENT_KEYBOARD_AND_DRAFT_MUTATION');

  await clear.click();
  await page.locator('[data-editor-object-id="stage-a"]').click();
  await page.locator('[data-editor-object-id="stage-b"]').click({modifiers:['Control']});
  await page.locator('[data-editor-object-id="stage-c"]').click({modifiers:['Control']});
  const distribute=stageBound.getByRole('button',{name:'Horizontal',exact:true});
  assert.equal(await distribute.isEnabled(),true);
  await distribute.click();
  assert.ok(await review.locator('[data-wep-stage1-change]').count()>=2);
  pass('DISTRIBUTION_DRAFT_MUTATION');

  await clear.click();
  await page.locator('[data-editor-object-id="stage-a"]').click();
  const precise=page.locator('[data-wep-inspector-coordinates]');
  await precise.locator('input[type="number"]').nth(0).fill('6');
  await precise.locator('input[type="number"]').nth(1).fill('8');
  await precise.getByRole('button',{name:'Apply coordinates'}).click();
  await eventually(async()=>String(await page.locator('[data-editor-object-id="stage-a"]').getAttribute('aria-label')).includes('at 6, 8'));
  const reviewText=await review.innerText();
  assert.ok(reviewText.includes('X 6'));
  assert.ok(reviewText.includes('Y 8'));
  pass('PRECISE_COORDINATE_EDIT_AND_SEMANTIC_REVIEW');

  await clear.click();
  await page.locator('[data-editor-object-id="stage-road"]').click();
  await page.locator('[data-editor-object-id="stage-a"]').click({modifiers:['Control']});
  assert.equal(await stageBound.getByRole('button',{name:'Left',exact:true}).isDisabled(),true);
  pass('ROAD_FENCE_GENERIC_TRANSFORM_FAIL_CLOSED');

  assert.equal(await stageBound.getByRole('button',{name:'Room Finish'}).count(),0);
  pass('ROOM_FINISH_NO_FAKE_BINDING',{state:'BLOCKED_MISSING_CORE_CONTRACT'});

  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  const localeSelect=page.locator('#site-locale');
  const changeCount=await review.locator('[data-wep-stage1-change]').count();
  for(const locale of locales){
    await localeSelect.selectOption(locale);
    await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
    assert.equal(await review.locator('[data-wep-stage1-change]').count(),changeCount);
    const metrics=await stageBound.evaluate(node=>({scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));
    assertNoOverflow(metrics,'stage1 '+locale);
  }
  await localeSelect.selectOption('en');
  pass('LAUNCH_LOCALE_STATE_AND_LAYOUT_INVARIANCE',{locales:locales.length});

  await page.goto(root+'/editor/world/',{waitUntil:'networkidle'});
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'stage1-recovery-profile.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(recoveryProfile))
  });
  await page.getByText(/DDV save loaded locally/).waitFor();
  await page.getByRole('button',{name:'Open in Canvas'}).first().click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();
  const baselineLabel=await page.locator('g[data-editor-object]').first().getAttribute('aria-label');

  // A compatible active draft must be reusable even before its first mutation.
  await page.locator('a[href$="/explore/"]').first().click();
  await page.waitForURL(/\/explore\/?$/);
  await page.locator('.controls input[type="search"]').fill('40000048');
  await eventually(async()=>await page.locator('.card-review').count()===1);
  await page.locator('.card-review').click();
  await page.locator('.quick-review').getByRole('button',{name:'Place in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/);
  await page.getByText(/Core-bound local draft authoring/).waitFor();
  assert.equal(
    await page.locator('g[data-editor-object]').first().getAttribute('aria-label'),
    baselineLabel,
    'compatible active baseline draft was not reused'
  );
  assert.ok((await page.locator('[data-wep-decorate-stage1] .pending-card').first().innerText()).includes('40000048'));
  pass('ACTIVE_COMPATIBLE_DRAFT_REUSE');

  // A committed mutation creates persistent recovery metadata while raw source bytes remain memory-only.
  const recoveryObject=page.locator('g[data-editor-object]').first();
  await recoveryObject.click();
  await page.locator('.toolbar-actions').getByRole('button',{name:'Move right'}).click();
  assert.ok(await page.evaluate(key=>localStorage.getItem(key),recoveryIndexKey));
  pass('RECOVERY_CHECKPOINT_AFTER_COMMITTED_MUTATION');

  await page.reload({waitUntil:'networkidle'});
  const recoveryPanel=page.locator('[data-wep-recovery]');
  await recoveryPanel.waitFor();
  const [chooser]=await Promise.all([
    page.waitForEvent('filechooser'),
    recoveryPanel.getByRole('button').first().click()
  ]);
  assert.ok(chooser);
  pass('RESUME_DRAFT_EXACT_SOURCE_REOPEN_PATH');

  assert.equal(evidence.pageErrors.length,0,evidence.pageErrors.join(' | '));
  evidence.consoleErrors=evidence.consoleErrors.filter(message=>!message.includes('Failed to load resource'));
  assert.equal(evidence.consoleErrors.length,0,evidence.consoleErrors.join(' | '));
  await context.close();

  const mobile=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const mobilePage=await mobile.newPage();
  await mobilePage.goto(root+'/explore/',{waitUntil:'networkidle'});
  assert.equal(await mobilePage.locator('a[href$="/editor/world/"]').count(),0);
  await mobilePage.locator('.controls input[type="search"]').fill('40000048');
  await eventually(async()=>await mobilePage.locator('.card-review').count()===1);
  await mobilePage.locator('.card-review').click();
  assert.equal(await mobilePage.locator('.quick-review').getByRole('button',{name:'Place in World Editor'}).count(),0);
  await mobilePage.goto(root+'/moodboards/',{waitUntil:'networkidle'});
  await seedMoodboard(mobilePage);
  await mobilePage.reload({waitUntil:'networkidle'});
  assert.equal(await mobilePage.getByRole('button',{name:'Open in World Editor'}).count(),0);
  pass('MOBILE_WORLD_EDITOR_HANDOFFS_UNAVAILABLE');
  await mobile.close();

  evidence.result='PASS';
}catch(error){
  evidence.result='FAIL';
  evidence.error=error instanceof Error?error.stack:String(error);
  throw error;
}finally{
  await writeFile(artifactDir+'/report.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
  await browser.close();
}
