// R12 current-head focused browser acceptance trigger; application source remains identical to main@5bb65e217c3e6e0c9c31239936725f90eba9a4cf.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base=(process.env.PRODUCT_BASE_URL||'http://127.0.0.1:4174').replace(/\/$/,'');
const chrome=process.env.CHROME_BIN;
if(!chrome)throw new Error('CHROME_BIN is required.');

const artifactDir='.artifacts/product-browser';
await mkdir(artifactDir,{recursive:true});
const evidence={startedAt:new Date().toISOString(),base,checks:[],pageErrors:[],consoleErrors:[]};

function ok(name,detail={}){evidence.checks.push({name,status:'PASS',...detail});}
function assert(value,message){if(!value)throw new Error(message);}
async function eventually(fn,{timeout=20000,interval=150}={}){
  const end=Date.now()+timeout;let last;
  while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){last=error;}await new Promise(r=>setTimeout(r,interval));}
  if(last)throw last;throw new Error('Timed out waiting for condition.');
}
async function noHorizontalOverflow(page,name){
  const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert(result.scroll<=result.client+2,`${name} horizontal overflow: ${result.scroll} > ${result.client}`);
}
function nativePreset(name,{deleted=false,unknown=null,item=40000001}={}){
  return {
    GridCollection:{Grids:{'0':{ID:0,GridDataPath:'',GridDefaultLayoutPath:'',TessellationFactor:2,Objects:{'0':{ID:0,ItemID:item,X:0,Y:0,Orientation:'GridOrientation_Up',State:null}},NextGridObjectID:1}},DiffGrids:{},NextGridID:1},
    PresetName:name,ThumbnailItems:[item],ShareInfo:null,StateFlags:deleted?16:0,
    ...(unknown?{FutureField:unknown}:{})
  };
}

const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US'});
const page=await context.newPage();
page.on('pageerror',error=>evidence.pageErrors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error')evidence.consoleErrors.push(msg.text());});

try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.portal-card').count()===6);
  const coreHrefs=await page.locator('.portal-card').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const path of ['/explore/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/'])assert(coreHrefs.some(href=>href?.endsWith(path)),`Home missing ${path}`);
  assert((await page.locator('.participation a').getAttribute('href'))?.endsWith('/qa/'),'Home Q&A participation link missing');
  ok('HOME_CANONICAL_PRODUCT_TREE',{coreCards:6,qaParticipation:true});

  const localeValues=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  for(const locale of localeValues){
    await page.locator('#site-locale').selectOption(locale);
    await eventually(async()=>await page.locator('html').getAttribute('lang')!==null);
    const heading=(await page.locator('#hero-title').textContent())?.trim();
    assert(Boolean(heading),`Home heading empty for ${locale}`);
    await noHorizontalOverflow(page,`home ${locale}`);
  }
  await page.locator('#site-locale').selectOption('en');
  ok('HOME_8_LOCALE_RUNTIME_SWITCH',{locales:localeValues.length});

  await page.goto(base+'/moodboards/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.removeItem('dreamwishwand:moodboards:v1'));
  await page.evaluate(()=>localStorage.removeItem('dreamwishwand:moodboards:v1:backup'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.create-board input').fill('Acceptance Garden');
  await page.locator('.create-board textarea').fill('Browser acceptance board');
  await page.locator('.create-board button').click();
  await eventually(async()=>await page.locator('.board-list button').count()===1);
  await page.locator('.add-reference select').selectOption('NOTE');
  await page.locator('.add-reference input').first().fill('Lantern idea');
  await page.locator('.add-reference textarea').fill('Warm evening corner');
  await page.locator('.add-reference button[type=submit]').click();
  await eventually(async()=>await page.locator('.reference-card').count()===1);
  const moodDoc=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')));
  assert(moodDoc.boards.length===1&&moodDoc.boards[0].references.length===1,'Moodboard local document did not persist create/reference flow');
  ok('MOODBOARD_LOCAL_CREATE_RECOVERY_BASELINE',{boards:1,references:1});

  await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.collection-card').count()>0,{timeout:30000});
  const sourceText=await page.locator('.source-badge span').textContent();
  assert(/12[,.\s]?552/.test(String(sourceText).replace(/\u202f/g,' ')),`Collection denominator not visible: ${sourceText}`);
  assert(await page.locator('.collection-card').count()===120,'Collection render cap did not produce 120 default cards');
  assert(await page.locator('.collection-card img').count()===0,'Collection rendered media despite fail-closed media gate');
  assert(!(await page.locator('body').innerText()).includes('IsDreamlightValley'),'Collection leaked machine World key');
  await page.locator('.view-switch button').nth(1).click();
  await page.locator('.collection-controls select').selectOption({index:1});
  await eventually(async()=>await page.locator('.collection-card').count()>0);
  ok('COLLECTION_VERIFIED_BROWSE',{denominator:12552,mediaFailClosed:true,machineFacetLeak:false});

  await page.goto(base+'/guide/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.result-list button').count()>0,{timeout:30000});
  assert(await page.locator('.guide-tabs button').count()===5,'Guide does not expose five canonical sections');
  assert(await page.locator('.result-list button').count()===160,'Quest list does not honor bounded 160 display cap');
  await page.locator('.guide-tabs button').nth(3).click();
  await eventually(async()=>await page.locator('.result-list button').count()===45);
  await page.locator('#site-locale').selectOption('ja');
  await eventually(async()=>await page.locator('.fallback').count()>0);
  assert((await page.locator('.detail h2').textContent())?.trim(),'Guide detail missing after System selection');
  ok('GUIDE_CANONICAL_FAMILIES_AND_REVIEW_FALLBACK',{sections:5,systems:45,unreviewedLocaleFallback:true});
  await page.locator('#site-locale').selectOption('en');

  await page.goto(base+'/explore/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.grid .card').count()>0,{timeout:30000});
  assert(await page.locator('.card img').count()===0,'Explore rendered media despite media gate');
  const boardSelect=page.locator('.controls select').nth(2);
  assert(await boardSelect.isEnabled(),'Explore did not recover the local Moodboard');
  const selectedBoard=await boardSelect.inputValue();
  assert(Boolean(selectedBoard),'Explore did not select existing Moodboard');
  await page.locator('.card button').first().click();
  await eventually(async()=>String(await page.locator('.status').textContent()).toLowerCase().includes('added'));
  const inspiredDoc=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')));
  assert(inspiredDoc.boards[0].references.length===2,'Explore -> Moodboard did not persist Item inspiration');
  assert(inspiredDoc.boards[0].references.some(ref=>ref.type==='ITEM'&&/^\d+$/.test(String(ref.entityId))),'Explore saved no canonical Item reference');
  ok('EXPLORE_TO_MOODBOARD_VALUE_LOOP',{referencesAfter:2,mediaFailClosed:true});

  await page.goto(base+'/presets/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.presets-page .status').count()>0);
  await page.locator('#site-locale').selectOption('en');
  const presetShellText=await page.locator('.presets-page').innerText();
  assert(!/[\u3040-\u30ff\u3400-\u9fff]/.test(presetShellText),'Presets English locale still contains Japanese static copy');
  const inGameTab=page.locator('.preset-tabs button').nth(2);
  await inGameTab.click();
  await eventually(async()=>String(await inGameTab.getAttribute('class')).includes('active'));
  await eventually(async()=>await page.locator('.native-manager').count()===1);
  const profile={
    GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{Level:1,Name:'Acceptance'},
    World:{DecorationPresets:[
      nativePreset('Garden One',{unknown:{sentinel:'preserve-me'}}),
      nativePreset('Old Tombstone',{deleted:true,item:40000002}),
      nativePreset('Garden Two',{item:40000003})
    ]},
    Opaque:{future:{keep:true}}
  };
  await page.locator('.native-manager input[type=file]').first().setInputFiles({name:'acceptance-profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))});
  await eventually(async()=>await page.locator('.preset-list button').count()===3);
  const summary=await page.locator('.source-summary').innerText();
  assert(summary.includes('3'),'Native preset physical count missing');
  assert(summary.includes('2 / 20'),'Native preset active count/limit missing');
  assert(await page.locator('.blocked-actions button').count()===2,'Native writer boundary controls missing');
  assert(await page.locator('.blocked-actions button').evaluateAll(nodes=>nodes.every(node=>node.disabled)),'Native restore/push controls are not disabled');
  await page.locator('.actions button').first().click();
  await eventually(async()=>await page.locator('.backup-grid article').count()===1);
  const nativeLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:in-game-preset-library:v1')));
  assert(nativeLibrary.backups.length===1,'Native preset local backup did not persist');
  assert(nativeLibrary.backups[0].payload.FutureField?.sentinel==='preserve-me','Native preset backup did not preserve unknown payload state');
  assert(nativeLibrary.backups[0].persistentWriteAuthorized===false,'Native preset backup crossed writer boundary');
  ok('IN_GAME_PRESET_READ_BACKUP_BOUNDARY',{physical:3,active:2,backups:1,persistentWriteAuthorized:false});

  for(const path of ['/','/moodboards/','/collection/','/guide/','/explore/','/presets/']){
    await page.setViewportSize({width:320,height:800});
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    if(path==='/collection/'||path==='/guide/'||path==='/explore/')await eventually(async()=>!(await page.locator('[role=status]').count())||!String(await page.locator('[role=status]').first().textContent()).includes('Loading'),{timeout:30000});
    await noHorizontalOverflow(page,`320px ${path}`);
  }
  ok('PRODUCT_SURFACES_320_REFLOW',{routes:6});

  assert(evidence.pageErrors.length===0,`Page errors: ${evidence.pageErrors.join(' | ')}`);
  evidence.consoleErrors=evidence.consoleErrors.filter(message=>!message.includes('Failed to load resource'));
  assert(evidence.consoleErrors.length===0,`Console errors: ${evidence.consoleErrors.join(' | ')}`);

  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.screenshot({path:artifactDir+'/home.png',fullPage:true});
  await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('.collection-card').count()>0,{timeout:30000});
  await page.screenshot({path:artifactDir+'/collection.png',fullPage:true});

  evidence.completedAt=new Date().toISOString();
  evidence.status='PASS';
}catch(error){
  evidence.completedAt=new Date().toISOString();
  evidence.status='FAIL';
  evidence.error=error instanceof Error?error.stack:String(error);
  try{await page.screenshot({path:artifactDir+'/failure.png',fullPage:true});}catch{}
  throw error;
}finally{
  await writeFile(artifactDir+'/report.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
  await browser.close();
}
