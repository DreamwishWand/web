import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const qa=JSON.parse(readFileSync('static/ddv/qa/qr-pr195-crafting-material-original-independent-v125.json','utf8'));
const owner=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-crafting-material-original-v125.json','utf8'));
const SHA=/^[0-9a-f]{64}$/;
test('exact frozen OWNER/QR scope and FIVE independently rehashed original source attestation',()=>{
 assert.equal(qa.frozenOwnerHead,'6c531a6f09c94eae79f4e5b960d0feb28ce57863');
 assert.equal(qa.historicalMineralQr206Head,'498047c8688453aa0be9b5944af6b3a8f7cb70b7');
 assert.equal(qa.historicalQr205Partial,true);
 assert.deepEqual([qa.platform,qa.version,qa.bid,qa.saveSchema],['Nintendo Switch','1.25.0','52BD625D9B4E0053',624]);
 const inputs=qa.localOriginalReplay.sources;
 const expected={
 main:[96002294,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0'],
 metadata:[36538728,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c'],
 dump:[59624529,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0'],
 losslessDB:[5090928,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048'],
 supportTables:[168583,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9']
 };
 for(const [k,[n,h]] of Object.entries(expected)){assert.equal(inputs[k].bytes,n);assert.equal(inputs[k].sha256,h);}
 assert.equal(inputs.supportTables.mimeFromDrive,'application/json');assert.equal(inputs.supportTables.actualMagic,'1f8b');
 assert.match(qa.localOriginalReplay.scriptSha256,SHA);assert.match(qa.localOriginalReplay.resultSha256,SHA);
});
test('original NSO bounded case6 and two-argument GetAllByType(MethodSpec98757) for subtype17, NOT Mineral16',()=>{
 const n=qa.native,g=n.methodSpec;
 assert.equal(n.case,6);assert.equal(n.branchRva,'0x4BFCAF0');assert.equal(n.caseTestRva,'0x4BFCAF4');
 assert.equal(n.branchBytes,256);assert.equal(n.branchSha256,'9b4fa9773591d2fea136fad19a2e8a6d8e0520fb9331658152e92a405364c6b3');
 assert.equal(n.itemType,3);assert.equal(n.subtype,17);
 assert.equal(n.materialCallTarget,'0x37816F0');
 assert.equal(g.index,98757);assert.equal(g.usage,'0xC003038B');
 assert.equal(g.raw12,'2a950100ffffffff37870000');
 assert.equal(g.methodDef,103722);assert.equal(g.name,'GetAllByType');assert.equal(g.instantiationIndex,34615);
 assert.equal(g.argCount,2);assert.deepEqual(g.typeDefIndices,[9044,10400]);
 assert.deepEqual(g.argumentPointerRvas,['0xB2CCFB8','0xB2CCFD8']);
 assert.equal(owner.native.typedGetAll.methodSpecIndex,g.index);
});
test('independently recovered ID projector, native Select ToList and distinct downstream common IsValid',()=>{
 const p=qa.native.projection;
 assert.equal(p.rva,'0x4BFF290');assert.equal(p.bytes,160);assert.equal(p.sha256,'13dc42cb2d2242ee3031b247f8b210cf46e9f045fc2a7d6db00351cfb14eed7b');
 assert.equal(p.idBackingOffset,24);assert.equal(p.selectTarget,'0x3752680');assert.equal(p.toListTarget,'0x37566C0');
 assert.equal(p.craftingSpecificWhere,false);assert.equal(p.commonIsValidSeparate,true);
});
test('original metadata TypeDef9044 ICollectionItem vtable32 predicate !IsMissionItem Field8',()=>{
 const c=qa.native.concrete,g=c.getCanBeCollected;
 assert.equal(c.typeDef9044Sha256,'34d34ee450e18d546a9f1d2a12935da7ec4ae71d6f573b3ee1e1bfe84585797b');
 assert.equal(c.interfaceOffsetStart,18220);assert.equal(c.interfaceOffsetCount,16);
 assert.equal(c.interfaceOffsetSha256,'9d4ba5bb84fe4fc8d74b75f382d63c3872a914583cd834d6f083af9aa6e0c1e4');
 assert.equal(c.icollectionItemType,64932);assert.equal(c.offset+c.methodSlot,32);
 assert.equal(c.vtableGetterSlot,32);assert.equal(c.vtableEncoded,'0x60028809');assert.equal(c.getterMethodDef,82948);
 assert.equal(c.variationImplemented,false);
 assert.equal(g.rva,'0x44EFE70');assert.equal(g.bytes,16);
 assert.equal(g.sha256,'e37d5869e849938f2d6eecdde5f518bb0cdecd450eb9d97a7a9d1f4d6d7d1957');
 assert.equal(g.predicate,'!IsMissionItem');assert.equal(g.backingOffset,80);assert.equal(g.protobufField,8);
});
test('original FULL 313B CollectionDefinition, ByType/ByItem/Recipe ignore are disjoint',()=>{
 const p=qa.originalProtobuf;
 assert.equal(p.collectionDefinitionId,2120000096);assert.equal(p.fullBytes,313);
 assert.equal(p.sha256,'0d29ce51cd9970208831abd746e9371187bf78875d1dbdcd54c96b95b380443c');
 assert.deepEqual(p.selectedByType,{outerCase:6,innerCase:6,innerExplicitEmpty:true,ignorePresent:false});
 assert.deepEqual(p.separateByItem.included,[31700015,31700021]);assert.equal(p.separateByItem.ignoreExample,31700039);
 assert.equal(p.separateByItem.ignoreCount,40);
 assert.deepEqual(p.separateByTypeCraftingRecipe,{ignore:true,craftingOuterWireField:8,recipeType:2001100001});
});
test('166 original source concrete ActivityItemData remain separated by subtype and protobuf Field8 presence',()=>{
 const a=qa.originalProtobuf.activitySource;
 assert.equal(a.total,166);assert.equal(a.typeName,'ActivityItemData');
 assert.deepEqual(a.subtype17,{count:132,missionField8Absent:128,missionField8ExplicitTrue:4,explicitFalse:0});
 assert.deepEqual(a.subtype0,{count:34,missionField8Absent:32,missionField8ExplicitTrue:2,explicitFalse:0});
 const x=qa.originalProtobuf.samples;
 assert.match(x['31700000'].rawSha256,SHA);assert.match(x['31700015'].rawSha256,SHA);
 assert.equal(x['31700023'].role,'positive-subtype17-negative-getter-mission-true');
 assert.equal(x['31700023'].missionField8Wire,'4001');
 assert.equal(x['30000031'].role,'negative-subtype0-even-when-nonmission');
 assert.equal(x['31700039'].finalMembership,'UNKNOWN');
 for(const entry of Object.values(x))assert.match(entry.rawSha256,SHA);
});
test('exact +1 ONLY: independently accepted 103/256; no runtime, ownership, percentage, writer or cross-build transfer',()=>{
 assert.equal(qa.classification,'PASS_STATIC_ORIGINAL_SOURCE_ONLY');
 assert.deepEqual(qa.coverage,{beforeIndependent:102,acceptedThisOne:1,afterIndependent:103,total:256,remainingUnknown:153,remainingFamilies:{Fish:1,Crafting:28,Clothing:61,Furniture:63}});
 assert.equal(Object.values(qa.coverage.remainingFamilies).reduce((a,b)=>a+b,0),153);
 const s=qa.failClosed;
 for(const k of ['runtimeItemDatabase','runtimeCollectionSets','runtimeCollectionMembership','personalOwned','personalCollected','personalMissing'])assert.equal(s[k],'UNKNOWN',k);
 assert.equal(s.denominator,null);
 for(const k of ['personalPercentEnabled','nativeWriterEnabled','presetApplyEnabled','communityPublisherEnabled','entitlementEditEnabled','steamPromotion','schema626Promotion'])assert.equal(s[k],false,k);
 assert.match(qa.ci,/no original-byte replay is claimed within CI/);
});