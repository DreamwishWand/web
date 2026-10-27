import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=JSON.parse(readFileSync('static/ddv/qa/qr-pr195-mineral-original-independent-v125.json','utf8'));
const owner=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-mineral-original-predicate-v125.json','utf8'));
const frozen='5ed6b31dc1ce44943baee67362e65575effaf6ab';
test('independently recovered original source manifest is exact Switch1250 and five raw-byte SHA attestations',()=>{
 assert.equal(e.ownerFrozenHead,frozen);assert.equal(e.gameVersion,'1.25.0');assert.equal(e.platform,'Nintendo Switch');
 assert.equal(e.buildID,'52BD625D9B4E0053');assert.equal(e.saveSchema,624);
 const a=e.independentPrivateReplay;
 assert.equal(a.sourceBytesAccessibleAtAudit,true);
 const expected={
 main:[96002294,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0'],
 metadata:[36538728,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c'],
 dump:[59624529,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0'],
 itemDB:[5090928,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048'],
 support:[168583,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9']
 };
 for(const [key,[n,h]] of Object.entries(expected)){
   assert.equal(a.sources[key].bytes,n,key); assert.equal(a.sources[key].sha256,h,key);
 }
 assert.equal(a.sources.support.providerMime,'application/json');
 assert.equal(a.sources.support.contentMagic,'1f8b'); // gzip despite provider MIME
 assert.match(a.scriptSha256,/^[0-9a-f]{64}$/);assert.match(a.resultSha256,/^[0-9a-f]{64}$/);
});
test('new original NSO static replay results, not solely Owner projection values',()=>{
 const n=e.native;assert.deepEqual(n.nsoSectionsUnpacked,[152803164,26278856,13050248]);
 assert.equal(n.mineralCase.rva,'0x4BFDE68'); assert.equal(n.mineralCase.bytes,252);
 assert.equal(n.mineralCase.sha256,'4703f8dcee3487eb05203cab1182fe8be1f3e844c32596897a56d1357b462eee');
 assert.deepEqual(n.mineralCase.nativeInstructions,{cmpCase7:'0x71001d1f',itemType3:'0x52800061',subtype16:'0x52800208',storeSubtypeToSp24:'0xb9001be8',blTarget:'0x37816f0'});
 assert.equal(n.projection.bytes,160);assert.equal(n.projection.sha256,'091f6df3a1790b1a787ced9caa5cf709cd21ae08b3f9f57155398d0736408b8e');
 assert.equal(n.projection.selectCallTarget,'0x3752680');
 assert.equal(n.projection.noMineralSpecificWhere,true);
});
test('original NSO GenericInst points at two type arguments, not Flower one-parameter method',()=>{
 const g=e.native.generic;
 assert.equal(g.methodSpecIndex,98775);assert.equal(g.methodDefIndex,103722);
 assert.equal(g.methodName,'GetAllByType');
 assert.equal(g.instantiationIndex,34633);assert.equal(g.instantiationRva,'0xAC1F870');
 assert.equal(g.typeArgCount,2);assert.deepEqual(g.typeDefIndices,[9063,10400]);
 assert.deepEqual(g.typePointerRvas,['0xB313598','0xB2CCFD8']);
 assert.equal(g.usage,'0xc00303af');
});
test('original metadata independently correlates concrete ICollectionItem interface, vtable and Native mission getter',()=>{
 const c=e.native.concrete;
 assert.equal(c.typeDefIndex,9063);assert.equal(c.typeName,'MineralItemData');
 assert.equal(c.typeDefSha256,'1bc0bba3688460e826bd497c173771f27df38eee141c323444a449cde16a5d40');
 assert.equal(c.interfaceOffsetsStart,18342);assert.equal(c.interfaceOffsetsCount,18);
 assert.equal(c.interfaceOffsetSha256,'5cf1e5dd3ffd6a275fc1ccea7b2c77a88b453500e3421234e71b4e4b586ec992');
 assert.equal(c.icollectionInterfaceType,64932);assert.equal(c.icollectionOffset+c.virtualGetterSlot,c.concreteGetterVtableSlot);
 assert.equal(c.concreteGetterVtableSlot,34);assert.equal(c.vtableEntry,'0x60028bb9');
 assert.equal(c.getterMethodDefIndex,83420);assert.equal(c.variationInterfacePresent,false);
 assert.equal(c.getCanBeCollected.rva,'0x451B400');
 assert.equal(c.getCanBeCollected.sha256,'9173b888b01aea203e357cfeda024f06898a1824ae272ffcf5c2389d294bbd4c');
 assert.equal(c.getCanBeCollected.expression,'!IsMissionItem');
 assert.equal(c.getCanBeCollected.boolOffset,96);assert.equal(c.getCanBeCollected.protobufField,11);
});
test('full ORIGINAL 114B definition and 53 separately hashed source raw protobuf are bounded',()=>{
 const p=e.originalProto;
 assert.equal(p.definitionId,2120000084);
 assert.equal(p.full114BytesSha256,'55be403d62d4b9ac75ed7a0a339b085b55c6b6c3fe23b188908851efba814e19');
 assert.equal(p.byTypeIgnorePresent,false);assert.deepEqual(p.separateByItem,{ignore:true,itemIds:[31600040]});
 assert.deepEqual(p.mineralItemData,{fullRawRowsVerified:53,itemType:3,subtype:16,missionField11:{absent:53,explicitFalse:0,explicitTrue:0}});
 const x=p.representatives;
 assert.equal(x['31600002'].sha256,'0ca66672c579aa627fba3778df8e117248e406a4b7ea0d66259158e73fb15dc1');
 assert.equal(x['31600040'].sha256,'da8207b0bbaceff6077a701e391a173ba828121c147cae8e30a74a4c3be07d13');
 assert.equal(x['31600082'].sha256,'9a1e4e1f467378b5efb2242bd2c905867096234f9254f2854238cecff7f2f928');
 assert.equal(p.typeNegative.itemId,31700000);
 assert.equal(p.typeNegative.subtype,17);assert.equal(p.typeNegative.finalMembership,'UNKNOWN');
});
test('exact one new independent static acceptance and frozen QR205 historical PARTIAL; no runtime/write transfer',()=>{
 assert.equal(e.classification,'PASS_STATIC_ORIGINAL_SOURCE_ONLY');
 assert.equal(e.historicalQr205Head,'e9672f1005db4a5df52af7bfba8ddabd8ac23a2d');
 assert.equal(e.ownerFrozenHead,frozen);
 assert.deepEqual(e.coverage,{previousIndependent:101,newlyAccepted:1,nowIndependent:102,totalNativeSelectors:256,remainingUnknown:154,remainingFamilies:{ActivityItem:2,Crafting:28,Clothing:61,Furniture:63}});
 assert.equal(Object.values(e.coverage.remainingFamilies).reduce((a,b)=>a+b,0),154);
 assert.equal(owner.coverage.now,102);
 const s=e.safety;assert.equal(s.denominator,null);
 for(const k of ['runtimeNativeEligibility','runtimeItemDatabase','runtimeCollectionSets','personalOwned','personalCollected','personalMissing'])assert.equal(s[k],'UNKNOWN',k);
 for(const k of ['collectionPercentEnabled','nativeSaveWriterEnabled','presetApplyEnabled','communityPublisherEnabled','entitlementEditingEnabled','switch1253Schema626Promotion','steamPromotion'])assert.equal(s[k],false,k);
 assert.match(e.ciScope,/not stored or replayed in GitHub CI/);
});
