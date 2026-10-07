import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import '../src/lib/ddv/core/world/runtime-v125/griddata-floor-v125.js';
import '../src/lib/ddv/core/world/runtime-v125/placement-v125.js';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';

const baseUrl=(process.env.WEP_STORAGE_BASE_URL||'http://127.0.0.1:4175').replace(/\/$/,'')+'/editor/world/';
const executablePath=process.env.CHROME_BIN;
if(!executablePath) throw new Error('CHROME_BIN is required.');

const artifactsDir='.artifacts/wep-storage-furniture-browser';
await mkdir(artifactsDir,{recursive:true});
const ITEM=40001838;
const CID=21;
const GRID=10;
const OBJECT=42;
const GRID_DATA_PATH='GridData/Villages/Village04-BeachLevel-GridData.json';

function sha256Hex(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function eventually(fn,timeout=30000){
  const end=Date.now()+timeout;let last;
  while(Date.now()<end){
    try{const value=await fn();if(value)return value;}catch(error){last=error;}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(last)throw last;
  throw new Error('Timed out waiting for condition.');
}
async function findAdjacentLegalPair(){
  const [floorContract,placementGeometry,readPack]=await Promise.all([
    readFile(new URL('../static/ddv/core/world/v1.25/griddata-floor-maps-v125.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../static/ddv/core/world/v1.25/placement-geometry-switch-v125.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../static/ddv/v1.25/world-read-switch.json',import.meta.url),'utf8').then(JSON.parse)
  ]);
  const floorApi=globalThis.DdvCoreWorldV125GridDataFloor;
  const placementApi=globalThis.DdvCoreWorldV125Placement;
  assert.ok(floorApi?.getGridData);
  assert.ok(placementApi?.validateOrdinaryCardinalPlacement);
  const raw=placementGeometry.geometry[String(ITEM)];
  const base=readPack.geometry[String(ITEM)];
  assert.ok(Array.isArray(raw)&&raw.length===3,'storage placement geometry required');
  assert.deepEqual(base,['FurnitureItemData',2,2,null]);
  assert.deepEqual(readPack.scope[String(ITEM)],[false,null,[]]);
  const geometryIndex={
    [ITEM]:{
      concreteType:base[0],
      sizeX:Number(base[1]),
      sizeY:Number(base[2]),
      subGridDataPath:base[3],
      areaTessellationFactor:1,
      acceptedFloorTypesFlag:Number(raw[0])>>>0,
      strideOverride:raw[1]===null||raw[1]===undefined?null:Number(raw[1])>>>0,
      layers:raw[2].map(value=>Number(value)>>>0)
    }
  };
  const gridData=floorApi.getGridData(floorContract,GRID_DATA_PATH,{
    gameVersion:'1.25.0',
    platform:'Nintendo Switch',
    buildIdentity:'52BD625D9B4E0053',
    profileSchemaVersion:624
  });
  assert.ok(gridData);
  const tessellationFactor=2;
  const maxX=gridData.sizeX*tessellationFactor;
  const maxY=gridData.sizeY*tessellationFactor;
  const check=(x,y)=>placementApi.validateOrdinaryCardinalPlacement({
    gridData,geometryIndex,objects:[],
    candidate:{editorId:'storage-browser',itemId:ITEM,x,y,orientation:0},
    gridTessellationFactor:tessellationFactor,
    excludeEditorId:'storage-browser',
    clearArea:false,automaticSpawning:false
  });
  for(let y=0;y<maxY;y++){
    for(let x=0;x<maxX-1;x++){
      const a=check(x,y),b=check(x+1,y);
      if(a?.status==='VALID'&&a?.valid===true&&a?.verdict==='VALID'&&
         b?.status==='VALID'&&b?.valid===true&&b?.verdict==='VALID'){
        return Object.freeze({x,y,afterX:x+1,afterY:y,tessellationFactor});
      }
    }
  }
  throw new Error('NO_ADJACENT_NATIVE_VALID_STORAGE_PAIR');
}

const legal=await findAdjacentLegalPair();
const sourceProfile={
  GameInfo:{Version:624,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{
    ContainerInventories:{
      [CID]:{
        ID:CID,
        Size:48,
        Inventory:[
          {ItemID:30000001,Amount:10,ItemState:null},
          {ItemID:30000002,Amount:2,ItemState:{Opaque:'keep'}}
        ],
        BelongsToPlayer:true,
        BlockMoveTo:false,
        ParentItemID:ITEM,
        ExtraSize:0,
        OpaqueContainer:{keep:true}
      }
    },
    NextContainerInventoryID:117,
    ListInventories:{
      '2':{
        ID:2,
        CompatibleItemType:'ItemType_Furniture',
        Inventory:{[ITEM]:{Amount:1009,Marker:'ItemMarker_None'}},
        OpaqueList:{keep:true}
      }
    },
    OpaquePlayer:{keep:true}
  },
  ProfileWorld:{Stores:[],Shops:[]},
  ConditionalEventHistory:{ActiveEvents:{}},
  World:{
    DecorationPresets:[],
    GridCollection:{
      Grids:{
        [GRID]:{
          ID:GRID,
          GridDataPath:GRID_DATA_PATH,
          GridDefaultLayoutPath:'',
          TessellationFactor:legal.tessellationFactor,
          NextGridObjectID:100,
          Objects:{
            [OBJECT]:{
              ID:OBJECT,
              ItemID:ITEM,
              X:legal.x,
              Y:legal.y,
              Orientation:'GridOrientation_Up',
              State:{Storage:{
                ContainerInventoryID:CID,
                DefaultContainerInventoryData:'',
                UnlockKeyItemID:0,
                UnlockLocId:'',
                DesignID:null
              }},
              OpaqueObject:{keep:true}
            }
          },
          OpaqueGrid:{keep:true}
        }
      },
      DiffGrids:{}
    },
    Villages:[{
      SceneItemId:1540000000,
      Areas:{'7':{
        GridIDs:[GRID],
        Unlocked:true,
        EnvironmentEffectItemID:0,
        EnvironmentEffectOrientation:'GridOrientation_Up'
      }}
    }],
    FloatingIslands:{},
    MissionSlots:{},
    QuestInfo:{},
    Keyholes:{},
    ConditionalEventHistoryData:{},
    OpaqueWorld:{keep:true}
  },
  Opaque:{keep:{storageBrowser:true}}
};
const packagedBytes=Buffer.from(makeSyntheticP1gProfile(sourceProfile));
const sourceSha256=sha256Hex(packagedBytes);

const browser=await chromium.launch({
  headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']
});
const report={
  schema:'dreamwish-wand-wep-storage-furniture-browser-acceptance@1',
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',profileSchema:624},
  sourceSha256,
  legalPlacement:legal,
  checks:[],
  pageErrors:[],
  consoleErrors:[],
  sourceImmutability:'PENDING',
  result:'PENDING'
};
const pass=(name,detail={})=>report.checks.push({name,status:'PASS',...detail});

try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});

  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('.load-panel input[type="file"]').setInputFiles({
    name:'profile',
    mimeType:'application/octet-stream',
    buffer:packagedBytes
  });
  await page.getByText(/DDV save loaded locally/).waitFor();
  await page.getByRole('button',{name:'Open in Canvas'}).first().click();
  await page.getByText(/Core-bound local draft authoring/).waitFor();

  const canvasObject=page.locator('g[data-editor-object]').first();
  assert.equal(await page.locator('g[data-editor-object]').count(),1);
  await canvasObject.click();

  const toolbar=page.locator('.toolbar-actions');
  assert.equal(await toolbar.getByRole('button',{name:'Move right'}).isEnabled(),true);
  assert.equal(await toolbar.getByRole('button',{name:'Rotate'}).isDisabled(),true);
  assert.equal(await toolbar.getByRole('button',{name:'Copy'}).isDisabled(),true);
  assert.equal(await toolbar.getByRole('button',{name:'Duplicate'}).isDisabled(),true);
  assert.equal(await toolbar.getByRole('button',{name:'Delete'}).isDisabled(),true);
  pass('STORAGE_COMMAND_GATING');

  const inspector=page.locator('.object-inspector');
  const inspectorText=await inspector.innerText();
  assert.equal(inspectorText.includes('STATE_Storage_UNSUPPORTED'),false);
  assert.equal(inspectorText.includes('WEP_STORAGE_'),false);
  pass('STORAGE_NOT_GENERIC_UNSUPPORTED');

  const exportPanel=page.locator('[data-wep-verified-export]');
  await exportPanel.waitFor();
  const buildConfirm=exportPanel.locator('.verified-export-build-confirm input[type="checkbox"]');
  await buildConfirm.check();

  await toolbar.getByRole('button',{name:'Move right'}).click();
  await eventually(async()=>String(await canvasObject.getAttribute('aria-label')).includes(`at ${legal.afterX}, ${legal.afterY}`));

  const reviewButton=exportPanel.getByRole('button',{name:'Review Changes'});
  assert.equal(await reviewButton.isEnabled(),true);
  await reviewButton.click();
  const review=exportPanel.locator('.verified-export-review');
  const reviewError=exportPanel.locator('.verified-export-error');
  await Promise.race([
    review.waitFor({state:'visible',timeout:15000}),
    reviewError.waitFor({state:'visible',timeout:15000})
  ]);
  if(await reviewError.isVisible()) throw new Error('STORAGE_REVIEW_FAIL: '+await reviewError.innerText());

  const operation=review.locator('[data-wep-storage-review-operation]');
  const protectedIdentity=review.locator('[data-wep-storage-protected-identity]');
  assert.ok((await operation.innerText()).includes('STORAGE SAME-GRID MOVE'));
  const identityText=String(await protectedIdentity.textContent());
  assert.ok(identityText.includes('ContainerInventoryID'));
  assert.ok(identityText.includes(String(CID)));
  assert.ok(identityText.includes('PROTECTED_ATTACHED_STATE'));
  const reviewText=await review.innerText();
  assert.equal(reviewText.includes('30000001'),false,'container slot contents must not appear in Review Changes');
  assert.equal(reviewText.includes('30000002'),false,'container slot contents must not appear in Review Changes');
  assert.ok(reviewText.includes(`Grid ${GRID}`));
  assert.ok(reviewText.includes(`Object ${OBJECT}`));
  assert.ok(reviewText.includes(`X ${legal.x}`));
  assert.ok(reviewText.includes(`X ${legal.afterX}`));
  pass('STORAGE_REVIEW_SEMANTICS_AND_PROTECTED_IDENTITY');

  const applyButton=exportPanel.getByRole('button',{name:'Apply / Export'});
  assert.equal(await applyButton.isDisabled(),true);
  await exportPanel.locator('.verified-export-confirm input[type="checkbox"]').check();
  await applyButton.click();
  const success=exportPanel.locator('.verified-export-success');
  const applyError=exportPanel.locator('.verified-export-error');
  await Promise.race([
    success.waitFor({state:'visible',timeout:15000}),
    applyError.waitFor({state:'visible',timeout:15000})
  ]);
  if(await applyError.isVisible()){
    throw new Error('STORAGE_APPLY_FAIL: '+await applyError.innerText());
  }
  assert.ok((await success.innerText()).includes('Verified edited save generated'));

  const [backupDownload]=await Promise.all([
    page.waitForEvent('download'),
    exportPanel.getByRole('button',{name:'Download original backup'}).click()
  ]);
  const backupPath=path.join(artifactsDir,'storage-original.profile');
  await backupDownload.saveAs(backupPath);
  const backup=await readFile(backupPath);
  assert.deepEqual(backup,packagedBytes);
  assert.equal(sha256Hex(backup),sourceSha256);
  report.sourceImmutability='PASS';
  pass('SOURCE_IMMUTABILITY_BYTE_EXACT_BACKUP');

  const [editedDownload]=await Promise.all([
    page.waitForEvent('download'),
    exportPanel.getByRole('button',{name:'Download edited save'}).click()
  ]);
  const editedPath=path.join(artifactsDir,'storage-edited.profile');
  await editedDownload.saveAs(editedPath);
  const edited=await readFile(editedPath);
  assert.notDeepEqual(edited,packagedBytes);
  const loaded=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(edited));
  assert.equal(loaded.inputType,'packaged');
  const after=JSON.parse(loaded.jsonText);
  const beforeObject=sourceProfile.World.GridCollection.Grids[String(GRID)].Objects[String(OBJECT)];
  const afterObject=after.World.GridCollection.Grids[String(GRID)].Objects[String(OBJECT)];
  assert.equal(afterObject.ID,OBJECT);
  assert.equal(afterObject.ItemID,ITEM);
  assert.equal(afterObject.X,legal.afterX);
  assert.equal(afterObject.Y,legal.afterY);
  assert.equal(afterObject.Orientation,beforeObject.Orientation);
  assert.deepEqual(afterObject.State,beforeObject.State);
  assert.equal(afterObject.State.Storage.ContainerInventoryID,CID);
  assert.deepEqual(after.Player.ContainerInventories,sourceProfile.Player.ContainerInventories);
  assert.deepEqual(after.Player.ListInventories,sourceProfile.Player.ListInventories);
  assert.equal(after.Player.NextContainerInventoryID,sourceProfile.Player.NextContainerInventoryID);
  assert.equal(after.World.GridCollection.Grids[String(GRID)].NextGridObjectID,100);
  pass('VERIFIED_REPLACEMENT_STORAGE_PRESERVATION',{
    editedSha256:sha256Hex(edited)
  });

  assert.equal(report.pageErrors.length,0,`pageErrors: ${report.pageErrors.join(' | ')}`);
  assert.equal(report.consoleErrors.length,0,`consoleErrors: ${report.consoleErrors.join(' | ')}`);
  pass('PAGE_AND_CONSOLE_ERRORS_ZERO');

  await page.screenshot({path:path.join(artifactsDir,'storage-same-grid-move-pass.png'),fullPage:true});
  report.result='PASS';
  await writeFile(path.join(artifactsDir,'acceptance-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await context.close();
}catch(error){
  report.result='FAIL';
  report.error=error instanceof Error?error.stack||error.message:String(error);
  await writeFile(path.join(artifactsDir,'acceptance-report.json'),JSON.stringify(report,null,2));
  console.error(report.error);
  process.exitCode=1;
}finally{
  await browser.close();
}
