// Public SYNTHETIC test only. No real Save or private artifact.
import {mkdtemp,writeFile,readFile,rm,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'wand-private-amount-synthetic-'));
const exe=resolve(process.argv[2]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const input=Buffer.from(JSON.stringify({GameInfo:{Version:626},World:{},Player:{ListInventories:{
  1:{ID:1,CompatibleItemType:'ItemType_Ingredient',Inventory:{30000001:{Amount:50}}},
  2:{ID:2,CompatibleItemType:'ItemType_ActivityItem',Inventory:{30000001:{Amount:1},30000002:{Amount:12,Unknown:'keep'}}}
}}}));
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'123',WAND_LOCAL_DECODED_SHA256:sha(input)};
const call=(args,over={},body=input)=>spawnSync(exe,args,{input:body,env:{...env,...over},encoding:'utf8'});
const checkDenied=(x,code)=>{assert.equal(x.status,12);assert.equal(x.stdout,'');assert.match(x.stderr,new RegExp(code));};
try{
 const out=join(dir,'new.json');
 let p=call(['--new-inventory-candidate','--out',out]);assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const r=JSON.parse(await readFile(out));assert.equal(r.itemId,30000002);assert.equal(r.inventoryId,2);assert.equal(r.oldAmount,12);
 assert.equal(r.selectionKind,'NEW_BOUNDED_CANDIDATE_NOT_E1172_IDENTITY');assert.equal(r.decodedSha256,sha(input));
 assert.match(r.entrySha256,/^[a-f0-9]{64}$/);assert.match(r.sessionId,/^[a-f0-9]{32}$/);
 assert.equal(r.revision,0);assert.equal(r.indexGeneration,1);
 for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','nativeV3Verified','rightsVerified','canonicalItemDbVerified','subscriberClosureVerified'])assert.equal(r[k],false,k);
 if(process.platform!=='win32')assert.equal((await stat(out)).mode&0o777,0o600);
 const explicit=join(dir,'explicit.json');
 p=call(['--inventory','2','30000002','--out',explicit]);assert.equal(p.status,0,p.stderr);
 const e=JSON.parse(await readFile(explicit));assert.notEqual(e.sessionId,r.sessionId);assert.equal(e.entrySha256,r.entrySha256);
 assert.equal(e.selectionKind,'EXPLICIT_EXISTING_SELECTOR_NOT_E1172_IDENTITY_PROOF');
 const bad=join(dir,'bad.json');
 checkDenied(call(['--new-inventory-candidate','--out',out]),'PRIVATE_OUTPUT_ALREADY_EXISTS');
 checkDenied(call(['--inventory','2','30000001','--out',bad]),'NO_EXACT_EXISTING_INVENTORY_TARGET');
 checkDenied(call(['--inventory','2','030000002','--out',bad]),'SELECTOR_ID');
 checkDenied(call(['--new-inventory-candidate','--out',bad],{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)}),'DECODED_SHA_OR_BOUNDS');
 checkDenied(call(['--new-inventory-candidate','--out',bad],{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}),'EXACT_STEAM_BUILD');
 checkDenied(call(['--new-inventory-candidate','--out','relative.json']),'PRIVATE_OUTPUT_ABSOLUTE_REQUIRED');
 checkDenied(call(['--new-inventory-candidate','--out',bad],{},Buffer.from('{}')),'DECODED_SHA_OR_BOUNDS');
 if(process.platform!=='win32'){
  const publicDir=join(dir,'public');await mkdir(publicDir,{mode:0o755});
  checkDenied(call(['--new-inventory-candidate','--out',join(publicDir,'out')]),'PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS');
 }
 // E1330/E1335 synthetic Furniture Catalog zero route. Exact saved
 // restriction, positive item and amount, no authority or default inference.
 const furniture=JSON.parse(input);
 furniture.Player.ListInventories[0]={ID:0,CompatibleItemType:'ItemType_Furniture',
  CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},
  Inventory:{40000001:{Amount:7,Marker:'ItemMarker_None'},40700001:{Amount:5}}};
 const bytes=Buffer.from(JSON.stringify(furniture));
 const z=join(dir,'zero.json');
 p=call(['--new-inventory-candidate','--out',z],{WAND_LOCAL_DECODED_SHA256:sha(bytes)},bytes);
 assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const zr=JSON.parse(await readFile(z));assert.equal(zr.inventoryId,0);assert.equal(zr.itemId,40000001);
 assert.equal(zr.oldAmount,7);assert.equal(zr.writerAuthorized,false);assert.equal(zr.rightsVerified,false);
 const ze=join(dir,'zero-explicit.json');
 p=call(['--inventory','0','40000001','--out',ze],{WAND_LOCAL_DECODED_SHA256:sha(bytes)},bytes);
 assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(await readFile(ze)).entrySha256,zr.entrySha256);
 for(const [i,j] of [['00','40000001'],['0','0'],['0','40700001'],['0','30000002']]){
  checkDenied(call(['--inventory',i,j,'--out',bad],{WAND_LOCAL_DECODED_SHA256:sha(bytes)},bytes),
   i==='00'||j==='0'?'SELECTOR_ID':'NO_EXACT_EXISTING_INVENTORY_TARGET');
 }
 for(const badRoute of [{ID:1},{CompatibleItemType:'ItemType_ActivityItem'},
  {CompatibleFurnitureTypes:null},{CompatibleFurnitureTypes:{List:['FurnitureItemType_Fence']}},
  {CompatibleFurnitureTypes:{List:['FurnitureItemType_Default','Unknown']}}]){
  const d=JSON.parse(bytes);Object.assign(d.Player.ListInventories[0],badRoute);
  const b=Buffer.from(JSON.stringify(d));
  checkDenied(call(['--inventory','0','40000001','--out',bad],{WAND_LOCAL_DECODED_SHA256:sha(b)},b),'NO_EXACT_EXISTING_INVENTORY_TARGET');
 }
 assert.deepEqual(JSON.parse(await readFile(z)),zr);
 console.log('FURNITURE_ZERO_ROUTE_SYNTHETIC_2POS9NEG_PASS');
 assert.deepEqual(JSON.parse(await readFile(out)),r);
 console.log('PRIVATE_EXISTING_AMOUNT_READ_SYNTHETIC_2POS_NEG_PASS_NO_PRIVATE_DATA_NO_WRITER');
}finally{await rm(dir,{recursive:true,force:true})}
