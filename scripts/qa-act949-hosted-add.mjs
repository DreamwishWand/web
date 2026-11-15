import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import '../src/lib/ddv/core/world/runtime-v125/griddata-floor-v125.js';
import '../src/lib/ddv/core/world/runtime-v125/placement-v125.js';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { createHash } from 'node:crypto';

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
async function verifyDownloadedSavePair(page,success,original,sourceName,expectedProfile){
  const get=async name=>{
    const pending=page.waitForEvent('download',{timeout:10000});
    await success.getByRole('button',{name}).click();
    const file=await pending;
    assert.equal(await file.failure(),null);
    return {name:file.suggestedFilename(),bytes:await readFile(await file.path())};
  };
  const edited=await get(/Download edited save/i);
  const backup=await get(/Download original backup/i);
  const integrity=await get(/Download manifest/i);
  assert.equal(edited.name,'DDV_EDITED_copy_'+sourceName);
  assert.equal(backup.name,'DDV_BACKUP_original_'+sourceName);
  assert.notEqual(edited.name,sourceName);
  assert.deepEqual(backup.bytes,original);
  assert.notDeepEqual(edited.bytes,original);
  const manifest=JSON.parse(integrity.bytes.toString('utf8'));
  assert.equal(manifest.editedFile,edited.name);
  assert.equal(manifest.backupFile,backup.name);
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(manifest.editedSha256,sha(edited.bytes));
  assert.equal(manifest.sourceSha256,sha(original));
  // Independent decoding of the actual browser download, not the optimistic
  // in-memory result or a synthetic replacement of the downloaded bytes.
  const reopened=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(edited.bytes));
  assert.equal(reopened.inputType,'packaged');
  assert.deepEqual(JSON.parse(reopened.jsonText),expectedProfile);
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

async function resolveNativeValidAddCell(){
  const gridDataPath='GridData/Villages/Village04-BeachLevel-GridData.json';
  const [floorContract,placementGeometry,readPack]=await Promise.all([
    readFile(new URL('../static/ddv/core/world/v1.25/griddata-floor-maps-v125.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../static/ddv/core/world/v1.25/placement-geometry-switch-v125.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../static/ddv/v1.25/world-read-switch.json',import.meta.url),'utf8').then(JSON.parse)
  ]);
  const floorApi=globalThis.DdvCoreWorldV125GridDataFloor;
  const placementApi=globalThis.DdvCoreWorldV125Placement;
  assert.ok(floorApi?.getGridData);
  assert.ok(placementApi?.validateOrdinaryCardinalPlacement);
  const itemId=40000048;
  const raw=placementGeometry.geometry[String(itemId)];
  const baseGeometry=readPack.geometry[String(itemId)];
  assert.ok(Array.isArray(raw)&&raw.length===3);
  assert.ok(Array.isArray(baseGeometry)&&baseGeometry.length===4);
  const geometryIndex={
    [itemId]:{
      concreteType:baseGeometry[0],
      sizeX:Number(baseGeometry[1]),
      sizeY:Number(baseGeometry[2]),
      subGridDataPath:baseGeometry[3],
      areaTessellationFactor:1,
      acceptedFloorTypesFlag:Number(raw[0])>>>0,
      strideOverride:raw[1]===null||raw[1]===undefined?null:Number(raw[1])>>>0,
      layers:raw[2].map(value=>Number(value)>>>0)
    }
  };
  const gridData=floorApi.getGridData(floorContract,gridDataPath,{
    gameVersion:'1.25.0',
    platform:'Nintendo Switch',
    buildIdentity:'52BD625D9B4E0053',
    profileSchemaVersion:624
  });
  assert.ok(gridData);
  const tessellationFactor=2;
  const maxX=gridData.sizeX*tessellationFactor;
  const maxY=gridData.sizeY*tessellationFactor;
  for(let y=0;y<maxY;y++){
    for(let x=0;x<maxX;x++){
      const result=placementApi.validateOrdinaryCardinalPlacement({
        gridData,
        geometryIndex,
        objects:[],
        candidate:{editorId:'draft-add',itemId,x,y,orientation:0},
        gridTessellationFactor:tessellationFactor,
        excludeEditorId:'draft-add',
        clearArea:false,
        automaticSpawning:false
      });
      if(result?.status==='VALID'&&result?.valid===true&&result?.verdict==='VALID'){
        return Object.freeze({x,y,gridDataPath,tessellationFactor});
      }
    }
  }
  throw new Error('NO_NATIVE_VALID_FURNITURE_ADD_CELL');
}

const addPlacement=await resolveNativeValidAddCell();

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

const addExportProfile={
  GameInfo:{Version:624,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{},
  ProfileWorld:{Stores:[],Shops:[]},
  ConditionalEventHistory:{ActiveEvents:{}},
  World:{
    DecorationPresets:[],
    GridCollection:{
      Grids:{
        '10':{
          ID:10,
          GridDataPath:'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath:'',
          TessellationFactor:addPlacement.tessellationFactor,
          NextGridObjectID:101,
          Objects:{}
        }
      },
      DiffGrids:{}
    },
    Villages:[{SceneItemId:1540000000,Areas:{'7':{GridIDs:[10],Unlocked:true,EnvironmentEffectItemID:0,EnvironmentEffectOrientation:'GridOrientation_Up'}}}],
    FloatingIslands:{},
    MissionSlots:{},
    QuestInfo:{},
    Keyholes:{}
  },
  Opaque:{keep:{addAcceptance:true}}
};

const roomFinishProfile={
  GameInfo:{Version:624,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{
    ListInventories:{
      '4':{
        ID:4,
        CompatibleItemType:'ItemType_Trimming',
        Inventory:{
          '160000000':{Amount:1,Marker:'ItemMarker_None'},
          '160000224':{Amount:1,Marker:'ItemMarker_None'},
          '160100000':{Amount:1,Marker:'ItemMarker_None'},
          '160100001':{Amount:1,Marker:'ItemMarker_None'}
        }
      }
    }
  },
  ProfileWorld:{Stores:[],Shops:[]},
  ConditionalEventHistory:{ActiveEvents:{}},
  World:{
    DecorationPresets:[],
    PlayerHouses:[{
      HouseItemID:20500005,
      Floors:[{
        BoughtRooms:{},
        Rooms:{
          '0':{
            Name:'Browser Room',
            FloorGridID:900,
            WallGridIDs:{'0':901,'1':902,'2':903,'3':904},
            RoomPrefabAddress:'Room/Browser',
            Flooring:160100000,
            Wallpapers:{
              '0':160000224,
              '1':160000224,
              '2':160000224,
              '3':160000224
            },
            WallpaperOffsetById:{'160000224':0.4623557},
            Ceiling:160000000,
            OpaqueRoom:{keep:true}
          }
        }
      }],
      OpaqueHouse:{keep:true}
    }],
    GridCollection:{
      Grids:{
        '900':{ID:900,Objects:{}},
        '901':{ID:901,Objects:{}},
        '902':{ID:902,Objects:{}},
        '903':{ID:903,Objects:{}},
        '904':{ID:904,Objects:{}}
      },
      DiffGrids:{}
    },
    Villages:[],
    FloatingIslands:{},
    MissionSlots:{},
    QuestInfo:{},
    Keyholes:{},
    OpaqueWorld:{keep:{roomFinishAcceptance:true}}
  }
};


// QA-only hosted affected ADD replay extracted verbatim from fixed accepted harness.
// No actual user save, no external network, no product source change.
assert.equal(root,'https://dreamwishwand.github.io/web');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence={schema:'wand.act949.hosted-add@1',root,checks:[],pageErrors:[],consoleErrors:[],network:{sameOriginReads:0,external:0,nonRead:0}};
function pass(name,detail={}){evidence.checks.push({name,status:'PASS',...detail});}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true,serviceWorkers:'block'});
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(!['http:','https:'].includes(url.protocol))return route.continue();
   if(!['GET','HEAD'].includes(req.method())){evidence.network.nonRead++;return route.abort('blockedbyclient');}
   if(url.origin!=='https://dreamwishwand.github.io'||!url.pathname.startsWith('/web/')){evidence.network.external++;return route.abort('blockedbyclient');}
   evidence.network.sameOriginReads++;return route.continue();
 });
 const page=await context.newPage();
 page.on('pageerror',e=>evidence.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text());});
  // Exact ordinary Furniture ADD remains bound to its accepted verified-export path.
  await page.goto(root+'/explore/',{waitUntil:'networkidle'});
  await page.locator('.controls input[type="search"]').fill('40000048');
  await eventually(async()=>await page.locator('.card-review').count()===1);
  await page.locator('.card-review').click();
  const addQuick=page.locator('.quick-review');
  await addQuick.waitFor();
  await addQuick.getByRole('button',{name:'Place in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/);
  await page.locator('.platform-select select').selectOption('switch');
  const addPackaged=Buffer.from(makeSyntheticP1gProfile(addExportProfile));
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'profile',
    mimeType:'application/octet-stream',
    buffer:addPackaged
  });
  await page.getByText(/DDV save loaded locally/).waitFor();
  await page.getByRole('button',{name:'Open in Canvas'}).first().click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();

  const addStage=page.locator('[data-wep-decorate-stage1]');
  const addPending=addStage.locator('.pending-card').first();
  assert.ok((await addPending.innerText()).includes('40000048'));
  await addPending.locator('input[type="number"]').nth(0).fill(String(addPlacement.x));
  await addPending.locator('input[type="number"]').nth(1).fill(String(addPlacement.y));
  await addPending.getByRole('button',{name:'Place'}).click();
  await eventually(async()=>await page.locator('g[data-editor-object]').count()===1);
  const addDraftReview=addStage.locator('[data-wep-stage1-review]');
  assert.ok((await addDraftReview.innerText()).includes('Added'));
  assert.ok((await addDraftReview.innerText()).includes('40000048'));

  const addExport=page.locator('[data-wep-verified-export]');
  const addReviewButton=addExport.getByRole('button',{name:'Review Changes'});
  assert.equal(await addReviewButton.isDisabled(),true);
  await addExport.locator('.verified-export-build-confirm input[type="checkbox"]').check();
  assert.equal(await addReviewButton.isEnabled(),true);
  await addReviewButton.click();
  const addVerifiedReview=addExport.locator('.verified-export-review');
  const addVerifiedError=addExport.locator('.verified-export-error');
  await Promise.race([
    addVerifiedReview.waitFor({state:'visible',timeout:10000}),
    addVerifiedError.waitFor({state:'visible',timeout:10000})
  ]);
  if(await addVerifiedError.isVisible()){
    throw new Error('ADD_VERIFIED_REVIEW_FAIL: '+await addVerifiedError.innerText());
  }
  const addReviewText=await addVerifiedReview.innerText();
  assert.ok(addReviewText.includes('ADD'));
  assert.ok(addReviewText.includes('Item 40000048'));
  assert.ok(addReviewText.includes('Area 7'));
  assert.ok(addReviewText.includes('Grid 10'));
  assert.ok(addReviewText.includes(`X ${addPlacement.x}`));
  assert.ok(addReviewText.includes(`Y ${addPlacement.y}`));
  assert.ok(addReviewText.includes('101'));
  const addConfirm=addVerifiedReview.locator('.verified-export-confirm input[type="checkbox"]');
  await addConfirm.check();
  const addApply=addVerifiedReview.getByRole('button',{name:'Apply / Export'});
  assert.equal(await addApply.isEnabled(),true);
  await addApply.click();
  const addSuccess=addExport.locator('.verified-export-success');
  const addCommitError=addExport.locator('.verified-export-error');
  await Promise.race([
    addSuccess.waitFor({state:'visible',timeout:15000}),
    addCommitError.waitFor({state:'visible',timeout:15000})
  ]);
  if(await addCommitError.isVisible()){
    throw new Error('ADD_VERIFIED_EXPORT_FAIL: '+await addCommitError.innerText());
  }
  const addSuccessText=await addSuccess.innerText();
  assert.ok(addSuccessText.includes('PASS'));
  assert.ok(await addSuccess.getByRole('button',{name:/Download edited save/i}).isVisible());
  assert.ok(await addSuccess.getByRole('button',{name:/Download original backup/i}).isVisible());
  const expectedAdd=structuredClone(addExportProfile);
  expectedAdd.World.GridCollection.Grids['10'].NextGridObjectID=102;
  expectedAdd.World.GridCollection.Grids['10'].Objects['101']={
    ID:101,ItemID:40000048,X:addPlacement.x,Y:addPlacement.y,Orientation:'GridOrientation_Up',State:null
  };
  await verifyDownloadedSavePair(page,addSuccess,addPackaged,'profile',expectedAdd);
  pass('ORDINARY_FURNITURE_ADD_ACTUAL_DOWNLOAD_BACKUP_EXACT_REOPEN');
  pass('ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_RUNTIME_ACCEPTED',{
    itemId:40000048,
    gridId:10,
    createdGridObjectId:101,
    runtime:'ORDINARY_FURNITURE_ADD_RUNTIME_PASS'
  });


 assert.equal(new URL(page.url()).origin,'https://dreamwishwand.github.io');
 assert.equal(evidence.network.nonRead,0);
 assert.equal(evidence.network.external,0);
 assert.ok(evidence.network.sameOriginReads>0);
 assert.equal(evidence.pageErrors.length,0,evidence.pageErrors.join(' | '));
 assert.equal(evidence.consoleErrors.length,0,evidence.consoleErrors.join(' | '));
 evidence.result='PASS';
 await context.close();
}catch(error){evidence.result='FAIL';evidence.error=String(error);throw error;}
finally{await writeFile(artifactDir+'/act949-hosted-report.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));await browser.close();}
