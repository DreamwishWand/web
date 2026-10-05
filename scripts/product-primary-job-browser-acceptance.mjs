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
  await eventually(async()=>await page.locator('.home-product-grid .visual-card').count()===6);
  const coreHrefs=await page.locator('.home-product-grid .visual-card').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const path of ['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/'])assert(coreHrefs.some(href=>href?.endsWith(path)),`Home missing ${path}`);
  assert((await page.locator('.home-qa-entry .visual-card').getAttribute('href'))?.endsWith('/qa/'),'Home Q&A participation link missing');
  assert(await page.locator('.hero').count()===0,'Home still contains marketing hero');
  assert(await page.locator('.main-nav').count()===0,'Shared header still contains duplicate Product navigation row');
  assert(await page.locator('.app-home-action').first().isVisible(),'Explicit Home affordance missing');
  assert(await page.locator('[data-shell-control="save"]').isVisible(),'Desktop DDV Save control missing');
  assert(await page.locator('[data-shell-control="account"]').isVisible(),'Desktop Account control missing');
  assert(await page.locator('.desktop-app-toolbar .toolbar-context').getByRole('link',{name:'Discover the Wand',exact:true}).isVisible(),'Discover the Wand contextual action missing');
  assert(await page.locator('[data-shell-control="notifications"]').count()===0,'Signed-out shell exposed Notifications');
  ok('HOME_CLOSED_APPLICATION_DASHBOARD',{coreCards:6,qaParticipation:true,marketingHero:false,productNavRow:false});

  await page.evaluate(()=>{
    globalThis.__wandShellIntents=[];
    window.addEventListener('wand:shell-intent',(event)=>globalThis.__wandShellIntents.push(event.detail.intent));
  });
  await page.locator('[data-shell-control="save"]').click();
  await page.locator('[data-shell-control="account"]').click();
  const shellIntents=await page.evaluate(()=>globalThis.__wandShellIntents);
  assert(shellIntents.includes('open-ddv-save'),'DDV Save owner intent not emitted');
  assert(shellIntents.includes('sign-in'),'signed-out Account owner intent not emitted');
  ok('SHARED_SHELL_OWNER_INTENTS',{intents:shellIntents});

  await page.locator('.skip-link').focus();
  assert(await page.locator('.skip-link').evaluate(node=>node===document.activeElement),'Skip link cannot receive keyboard focus');
  await page.keyboard.press('Tab');
  assert(await page.locator('.desktop-app-toolbar .app-home-action').evaluate(node=>node===document.activeElement),'Explicit Home does not follow skip link in keyboard order');
  const homeOutline=await page.locator('.desktop-app-toolbar .app-home-action').evaluate(node=>getComputedStyle(node).outlineStyle);
  assert(homeOutline!=='none','Home focus indicator is not visible');
  ok('SHARED_SHELL_KEYBOARD_FOCUS',{skipLinkFocusable:true,homeFollows:true});

  const localeValues=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  for(const locale of localeValues){
    await page.locator('#site-locale').selectOption(locale);
    await eventually(async()=>await page.locator('html').getAttribute('lang')!==null);
    const heading=(await page.locator('.home-dashboard-heading h1').textContent())?.trim();
    assert(Boolean(heading),`Home heading empty for ${locale}`);
    await noHorizontalOverflow(page,`home ${locale}`);
  }
  await page.locator('#site-locale').selectOption('en');
  ok('HOME_8_LOCALE_RUNTIME_SWITCH',{locales:localeValues.length});

  await page.goto(base+'/decorate/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('.decorate-entry .visual-card').count()===3,'Decorate entry must expose exactly three primary cards');
  const decorateDescriptions=await page.locator('.decorate-entry .visual-card .visual-card-copy > span:last-child').allTextContents();
  for(const expected of ['Discover the pieces','Gather your vision','Shape your world'])assert(decorateDescriptions.includes(expected),`Decorate missing approved description: ${expected}`);
  assert(await page.locator('.decorate-entry .page-intro').count()===0,'Decorate entry added unapproved explanatory intro');
  ok('DECORATE_NEUTRAL_ENTRY',{cards:3});

  await page.goto(base+'/discover/',{waitUntil:'domcontentloaded'});
  assert((await page.locator('.orientation-heading h1').textContent())?.trim()==='What is Dreamwish Wand?','Discover heading does not match closed Home contract');
  assert(await page.locator('.discover-page .visual-card').count()===7,'Discover page must introduce six Core Products plus Q&A');
  ok('DISCOVER_THE_WAND_ORIENTATION',{entries:7});

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

  await page.setViewportSize({width:320,height:800});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('.mobile-app-toolbar').isVisible(),'Mobile application shell is not visible at 320px');
  assert(!(await page.locator('.desktop-app-toolbar').isVisible()),'Desktop application toolbar remains visible at 320px');
  assert(await page.locator('.mobile-app-toolbar [data-shell-control="save"]').count()===0,'Mobile shell exposes prohibited DDV Save control');
  const settings=page.locator('.mobile-app-toolbar .ui-icon-button').last();
  await settings.focus();
  await settings.click();
  const sheet=page.locator('.ui-sheet');
  await eventually(async()=>await sheet.evaluate(node=>node.open===true));
  assert(await sheet.locator('.ui-sheet-header .ui-icon-button').evaluate(node=>node===document.activeElement),'Sheet initial focus did not move to close control');
  await page.keyboard.press('Escape');
  await eventually(async()=>!(await sheet.evaluate(node=>node.open)));
  assert(await settings.evaluate(node=>node===document.activeElement),'Sheet close did not restore focus to invoker');
  ok('MOBILE_SHELL_AND_SHEET_FOCUS',{saveControl:false,focusRestored:true});

  for(const locale of localeValues){
    await settings.click();
    await eventually(async()=>await sheet.evaluate(node=>node.open===true));
    await page.locator('#site-locale-mobile').selectOption(locale);
    await page.keyboard.press('Escape');
    await eventually(async()=>!(await sheet.evaluate(node=>node.open)));
    await noHorizontalOverflow(page,`320px home ${locale}`);
  }
  ok('SHARED_LONG_STRING_320_REFLOW',{locales:localeValues.length});

  for(const path of ['/','/decorate/','/discover/','/moodboards/','/collection/','/guide/','/explore/','/presets/']){
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    if(path==='/collection/'||path==='/guide/'||path==='/explore/')await eventually(async()=>!(await page.locator('[role=status]').count())||!String(await page.locator('[role=status]').first().textContent()).includes('Loading'),{timeout:30000});
    await noHorizontalOverflow(page,`320px ${path}`);
  }
  ok('PRODUCT_SURFACES_320_REFLOW',{routes:8});

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
