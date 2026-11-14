// ACT425 public synthetic inputs only. Existing single native ProductSession.
import {mkdtemp,readFile,rm,stat,symlink,mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'wand-collection-cli-'));
const exe=resolve(process.argv[2]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=v=>Buffer.from(JSON.stringify(v));
const doc={GameInfo:{Version:626},World:{},Player:{
 CollectionSets:[{CollectionDefinitionID:2120000001,GroupData:[
  {GroupIndex:0,State:0,GroupsCollectionItems:{30000001:false,30000002:false,30000003:true},Unknown:{keep:1}},
  {GroupIndex:1,State:'NotComplete',GroupsCollectionItems:{30000001:true}}]},
  {CollectionDefinitionID:2120000002,GroupData:[{GroupsCollectionItems:{30000001:false}}]}],
 ListInventories:{0:{ID:0,CompatibleItemType:'ItemType_Furniture',Inventory:{}},
  4:{ID:4,CompatibleItemType:'ItemType_ActivityItem',Inventory:{30000001:{Amount:2,Marker:'Keep'}}}}
}};
const args=(path,d='2120000001',g='0',t='30000001')=>['--collection-group-receipt-only',d,g,t,'--out',path];
const call=(a,body=raw(doc),over={})=>spawnSync(exe,a,{input:body,encoding:'utf8',env:{...process.env,
 WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'123',
 WAND_LOCAL_DECODED_SHA256:sha(body),...over}});
const deny=(r,code)=>{assert.equal(r.status,12,r.stderr);assert.equal(r.stdout,'');assert.match(r.stderr,new RegExp(code));};
try{
 const path=join(dir,'receipt.json'),bad=join(dir,'denied.json');
 let p=call(args(path));assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const saved=await readFile(path),v=JSON.parse(saved),group=doc.Player.CollectionSets[0].GroupData[0];
 assert.equal(v.contract,'wand.native.private.collection-group-readset@1');assert.equal(v.schema,626);
 assert.equal(v.decodedSha256,sha(raw(doc)));assert.match(v.sessionId,/^[a-f0-9]+$/);
 assert.equal(v.revision,0);assert.equal(v.indexGeneration,1);
 assert.equal(v.originalSha256SuppliedExternally,'a'.repeat(64));assert.equal(v.originalSizeBytesSuppliedExternally,123);
 assert.equal(v.collectionSetsSha256,sha(raw(doc.Player.CollectionSets)));
 assert.equal(v.targetItemId,30000001);assert.equal(v.selectedGroup.definitionId,2120000001);
 assert.equal(v.selectedGroup.groupPosition,0);assert.equal(v.selectedGroup.groupSha256,sha(raw(group)));
 assert.equal(v.selectedGroup.mapSha256,sha(raw(group.GroupsCollectionItems)));
 assert.equal(v.selectedGroup.targetEntry.collected,false);
 assert.equal(v.selectedGroup.numericNotCompleteMultiFalseShape,true);
 assert.equal(v.storedMemberships.length,3);
 assert.equal(v.storedStock.inventoryId,4);assert.equal(v.storedStock.entry.amount,2);
 assert.equal(v.storedStock.entry.entrySha256,sha(raw(doc.Player.ListInventories[4].Inventory[30000001])));
 for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','nativeV3Verified',
  'packagedMembershipVerified','effectiveEligibilityVerified','ownershipVerified','rightsVerified','subscriberClosureVerified',
  'cloudUploadPerformed','originalModifiedByHarness'])assert.equal(v[k],false,k);
 assert.equal((await stat(path)).mode&0o777,0o600);
 // Physical position is authoritative, unknown string State is not completion authority.
 const second=join(dir,'second.json');p=call(args(second,'2120000001','1'));
 assert.equal(p.status,0,p.stderr);const x=JSON.parse(await readFile(second));
 assert.equal(x.selectedGroup.state.token,'"NotComplete"');assert.equal(x.selectedGroup.state.numericCode,null);
 assert.equal(x.selectedGroup.numericNotCompleteMultiFalseShape,false);
 const absent=structuredClone(doc);delete absent.Player.ListInventories;
 const third=join(dir,'third.json');p=call(args(third,'2120000002','0'),raw(absent));
 assert.equal(p.status,0,p.stderr);const y=JSON.parse(await readFile(third));
 assert.equal(y.selectedGroup.state.present,false);assert.equal(y.storedStock.routePresent,false);
 for(const [a,code] of [
  [args(path),'PRIVATE_OUTPUT_ALREADY_EXISTS'],[args('relative.json'),'PRIVATE_OUTPUT_ABSOLUTE_REQUIRED'],
  [args(bad,'02120000001'),'COLLECTION_SELECTOR_ID'],[args(bad,'2120000001','00'),'COLLECTION_GROUP_SELECTOR'],
  [args(bad,'2120000001','257'),'COLLECTION_GROUP_SELECTOR'],[args(bad,'2120000001','-1'),'COLLECTION_GROUP_SELECTOR'],
  [args(bad,'40000001'),'COLLECTION_SELECTOR_ID'],[args(bad,'2120000001','0','40000001'),'COLLECTION_SELECTOR_ID'],
  [args(bad,'2120000001','0','2147483648'),'COLLECTION_SELECTOR_ID'],
  [args(bad,'2120000099'),'COLLECTION_GROUP_READ_DENIED'],[args(bad,'2120000001','2'),'COLLECTION_GROUP_READ_DENIED'],
  [[...args(bad),'--writer'],'UNTRUSTED_CLI_ARGS']
 ])deny(call(a),code);
 deny(call(args(bad),raw(doc),{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)}),'DECODED_SOURCE_SHA_MISMATCH');
 deny(call(args(bad),raw(doc),{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'wrong'}),'EXACT_EXTERNAL_STEAM_BUILD_REQUIRED');
 for(const mutate of [
  x=>x.Player.CollectionSets[0].GroupData[0].GroupIndex=1,
  x=>x.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems[30000001]=1,
  x=>x.Player.CollectionSets[0].GroupData[0].State=3,
  x=>x.Player.CollectionSets.push(x.Player.CollectionSets[0]),
  x=>x.Player.ListInventories[0].CompatibleItemType='ItemType_ActivityItem',
  x=>x.Player.ListInventories[5]={ID:5,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}},
  x=>x.Player.ListInventories[4].Inventory[30000001].Amount=-1,
  x=>x.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems['030000001']=false,
 ]){const x=structuredClone(doc);mutate(x);deny(call(args(bad),raw(x)),'COLLECTION_GROUP_READ_DENIED');}
 const pub=join(dir,'public');await mkdir(pub,{mode:0o755});deny(call(args(join(pub,'bad.json'))),'PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS');
 const link=join(dir,'link');await symlink(path,link);deny(call(args(link)),'PRIVATE_OUTPUT_ALREADY_EXISTS');
 await assert.rejects(access(bad));assert.deepEqual(await readFile(path),saved);
 console.log('ACT425_COLLECTION_PRIVATE_CLI_3POS_24NEG_PASS_NO_PRIVATE_UPLOAD');
}finally{await rm(dir,{recursive:true,force:true})}

// ACT767: exact Switch626/Furniture read only, separate mode and receipt.
// Synthetic target only: no actual owner Save or selected private IDs.
const swdir=await mkdtemp(join(tmpdir(),'wand-switch-collection-cli-'));
const swdoc={GameInfo:{Version:626},World:{},Player:{
 CollectionSets:[{CollectionDefinitionID:2120000001,GroupData:[{
  GroupIndex:0,State:'SetState_NotComplete',GroupsCollectionItems:{40000001:false,40000002:false,40000003:false,40000004:true},
  Unknown:{keep:1}}]}],
 ListInventories:{0:{ID:0,CompatibleItemType:'ItemType_Furniture',Inventory:{40000001:{Amount:2,Marker:'Keep'}}},
  4:{ID:4,CompatibleItemType:'ItemType_ActivityItem',Inventory:{30000001:{Amount:2}}}}
}};
const swargs=(path,d='2120000001',g='0',t='40000001')=>['--switch626-collection-furniture-receipt-only',d,g,t,'--out',path];
const swcall=(a,body=raw(swdoc),over={})=>call(a,body,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'',
 WAND_LOCAL_INSTALLED_SWITCH_BID:'9A239D3DB569756D',...over});
try{
 const path=join(swdir,'receipt.json'),bad=join(swdir,'denied.json');
 const p=swcall(swargs(path));assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const bytes=await readFile(path),v=JSON.parse(bytes);
 assert.equal(v.contract,'wand.native.private.switch626.furniture-collection-group-readset@1');
 assert.equal(v.platform,'Switch');assert.equal(v.buildKind,'SwitchBid');assert.equal(v.buildId,'9A239D3DB569756D');
 assert.equal(v.fullVersion,undefined);assert.equal(v.schema,626);assert.equal(v.decodedSha256,sha(raw(swdoc)));
 assert.equal(v.selectedGroup.state.token,'"SetState_NotComplete"');assert.equal(v.selectedGroup.state.numericCode,null);
 assert.equal(v.selectedGroup.falseCount,3);assert.equal(v.selectedGroup.switchSavedNotCompleteMultiFalseShape,true);
 assert.equal(v.selectedGroup.numericNotCompleteMultiFalseShape,false);assert.equal(v.storedMemberships.length,1);
 assert.equal(v.storedStock.inventoryId,0);assert.equal(v.storedStock.entry.amount,2);
 assert.equal(v.storedStock.entry.entrySha256,sha(raw(swdoc.Player.ListInventories[0].Inventory[40000001])));
 for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','nativeV3Verified',
  'packagedMembershipVerified','effectiveEligibilityVerified','ownershipVerified','rightsVerified','subscriberClosureVerified',
  'cloudUploadPerformed','originalModifiedByHarness'])assert.equal(v[k],false,k);
 assert.equal((await stat(path)).mode&0o777,0o600);
 for(const [a,code] of [[swargs(path),'PRIVATE_OUTPUT_ALREADY_EXISTS'],
  [swargs(bad,'2120000001','0','30000001'),'COLLECTION_SELECTOR_ID'],
  [swargs(bad,'2120000001','0','040000001'),'COLLECTION_SELECTOR_ID'],
  [swargs(bad,'2120000001','1'),'COLLECTION_GROUP_READ_DENIED'],
  [swargs(bad,'2120000001','0','40000099'),'COLLECTION_GROUP_READ_DENIED']])deny(swcall(a),code);
 deny(swcall(swargs(bad),raw(swdoc),{WAND_LOCAL_INSTALLED_SWITCH_BID:'52BD625D9B4E0053'}),'EXACT_EXTERNAL_SWITCH_BUILD_REQUIRED');
 deny(swcall(swargs(bad),raw(swdoc),{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'conflict'}),'EXACT_EXTERNAL_SWITCH_BUILD_REQUIRED');
 deny(swcall(swargs(bad),raw(swdoc),{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)}),'DECODED_SOURCE_SHA_MISMATCH');
 deny(call(args(bad,'2120000001','0','40000001'),raw(swdoc)),'COLLECTION_SELECTOR_ID');
 for(const mutate of [
  x=>x.GameInfo.Version=624,
  x=>x.Player.CollectionSets[0].GroupData[0].State=0,
  x=>x.Player.CollectionSets[0].GroupData[0].State='NotComplete',
  x=>x.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems[40000001]=true,
  x=>{x.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems[40000002]=true;x.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems[40000003]=true;},
  x=>x.Player.CollectionSets.push({CollectionDefinitionID:2120000002,GroupData:[{State:'SetState_NotComplete',GroupsCollectionItems:{40000001:true}}]}),
  x=>x.Player.ListInventories[0].Inventory[40000001].Amount=0,
  x=>x.Player.ListInventories[0].CompatibleItemType='ItemType_ActivityItem',
  x=>x.Player.ListInventories[9]={ID:9,CompatibleItemType:'ItemType_Furniture',Inventory:{}},
  x=>delete x.Player.ListInventories[0].Inventory[40000001],
 ]){const x=structuredClone(swdoc);mutate(x);const r=swcall(swargs(bad),raw(x));assert.equal(r.status,12,r.stderr);assert.equal(r.stdout,'');}
 await assert.rejects(access(bad));assert.deepEqual(await readFile(path),bytes);
 console.log('ACT767_SWITCH626_FURNITURE_COLLECTION_PRIVATE_CLI_1POS_19NEG_PASS');
}finally{await rm(swdir,{recursive:true,force:true})}
