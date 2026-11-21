import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-fish-nolocation-original-v125.json','utf8'));
const compact=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
function varint(b,p){let v=0,s=0;for(;;){assert.ok(p<b.length);let x=b[p++];v+=(x&127)*2**s;if(x<128)return [v,p];s+=7;assert.ok(s<=56);}}
function pb(b){let p=0,r=[];while(p<b.length){let k;[k,p]=varint(b,p);let n=k>>>3,t=k&7,v;if(t===0)[v,p]=varint(b,p);else if(t===2){let l;[l,p]=varint(b,p);assert.ok(p+l<=b.length);v=b.subarray(p,p+l);p+=l;}else throw Error('unexpected wire '+t);r.push({n,t,v});}return r;}
const fld=(b,n)=>pb(b).filter(x=>x.n===n),one=(b,n)=>{let x=fld(b,n);assert.equal(x.length,1);return x[0];};
test('Fish static source identity restricts BID624 original and historical d548',()=>{
 assert.deepEqual(e.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(e.source.nso.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(e.source.metadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(e.source.losslessItemDb.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(e.source.supportTables.sha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(e.source.oldUntracedMetadata.state,'NEED_SOURCE_NOT_EQUATED');
});
test('Original Fish definition contains explicit empty Fish field4 and DEFAULT FALSE UseLocation; no reusing location branch',()=>{
 const d=e.definition;assert.equal(d.id,2120000020);assert.equal(d.fullSerializedBytes,140);assert.equal(d.rawPayloadSha256,'c3f2d3c00714f9b4d29d8eec4affc88c10818b8c5a18722ca1df55f14dbd430d');
 const b=Buffer.from(d.byTypeBoundedWire,'hex'),act=one(b,6).v,fish=one(act,4);
 assert.equal(fish.t,2);assert.equal(fish.v.length,0);
 assert.equal(fld(fish.v,1).length,0);assert.equal(fld(fish.v,2).length,0);
 assert.equal(d.fishUseLocationDefault,false);assert.equal(d.fishUseLocationPresent,false);
 assert.equal(d.separateByItemIgnore.excludedItemID,31000006);
 const c=compact.find(x=>x[0]===2120000020);assert.ok(c);
 assert.deepEqual(c[5].filter(z=>z[0]==='ActivityItem'),[['ActivityItem',{Fish:{}},0]]);
});
test('Original Fish no-Location case dispatches MethodSpec98717 typed FishItemData, not FishingData ItemType205',()=>{
 const n=e.originalNative,p=n.nonLocationPath;assert.equal(n.fishDispatch.fishUseLocationBoolReadRva,'0x4BFD8C4');
 assert.equal(n.fishDispatch.useLocationFalsePathStart,'0x4BFDC38');
 assert.equal(p.bytes,220);assert.equal(p.sha256,'6bbbedf65e22ef92cee12cf54b2a38a77039c58c19c76deb662ee55da25a660e');
 assert.equal(p.itemType,3);assert.equal(p.getAllByTypeCallRva,'0x4BFDC58');
 assert.equal(p.methodUsageEncoded,'0xC003033B');
 assert.equal((parseInt(p.methodUsageEncoded,16)&0x1fffffff)>>>1,p.methodSpecIndex);
 const raw=Buffer.from(p.methodSpecRawHex,'hex');assert.equal(raw.readUInt32LE(0),103721);
 assert.equal(raw.readInt32LE(4),-1);assert.equal(raw.readUInt32LE(8),8542);
 assert.equal(p.genericTypeDefIndex,9613);assert.equal(p.genericTypeName,'FishItemData');
 assert.equal(n.withLocationAlternative.selectedForThisDefinition,false);
 assert.equal(n.withLocationAlternative.itemType,205);assert.equal(n.withLocationAlternative.subtype,1);
});
test('Fish native ID projection and common IsValid are different stages',()=>{
 const n=e.originalNative,p=n.projector;
 assert.equal(p.rva,'0x4BFF540');assert.equal(p.bytes,160);
 assert.equal(p.sha256,'2aa718b4011d73d58db3dbdf0f4bd36e8f68265bb402f8f40b396d4f5b1f7901');
 assert.equal(p.nativeSharedSelectRva,'0x4BFD874');assert.equal(p.nativeSharedToListRva,'0x4BFD880');
 assert.equal(p.itemIdOffset,'0x18');assert.equal(n.separateCommonIsValid,true);
 assert.match(n.predicateForExactSourceDefinition,/UseLocation \[default false\]/);
});
test('Original FishItemData TypeDef9613 and vtable38 resolve mission getter, no Variation',()=>{
 const c=e.concrete;assert.equal(c.typeDef,9613);
 assert.equal(c.typeDefRecordSha256,'58e8675c8e72d4ffcde433985e17b35b1f40f57a1463c0400061e2f16f91fede');
 assert.equal(c.interfaceOffsetsStart,20439);assert.equal(c.interfaceOffsetsCount,19);
 assert.equal(c.interfaceOffsetsSha256,'eee26b4389d25f7369da9a766deb2f10e24407b7fee2fa583f60888ca3933389');
 assert.equal(c.icollectionItem.interfaceOffset+c.icollectionItem.methodSlot,c.icollectionItem.concreteVtableSlot);
 assert.equal(c.icollectionItem.encodedMethod,'0x6002D1A5');assert.equal(c.icollectionItem.methodDef,92370);
 assert.equal(c.variation.implemented,false);
 assert.equal(c.getCanBeCollected.rva,'0x4830B30');
 assert.equal(c.getCanBeCollected.opcodeHex,'088041391f010071e0179f1ac0035fd6');
 assert.equal(c.getCanBeCollected.expression,'!IsMissionItem');
 assert.equal(c.protobuf.missionField,12);
});
test('Typed 96 Fish original inputs split 65 nonmission and 31 mission, not live collection denominator',()=>{
 const r=e.originalTypedSource;
 assert.equal(r.rowsIndividuallyRehashed,96);assert.equal(r.missionField12AbsentDefaultFalse,65);
 assert.equal(r.missionField12ExplicitTrue,31);assert.equal(r.sourceGetterFalse,31);
 assert.equal(r.examples[0].itemId,31000000);
 assert.equal(r.examples[0].rawSha256,'9a0e2c9d4ba8a62ef724c903ccb0c430698fd7dc2738dbfff5e918ecc5bb766e');
 assert.equal(r.examples[2].itemId,31000037);
 assert.equal(r.examples[2].staticGetter,false);
 assert.equal(r.otherTypeNegative.itemType,205);
 assert.equal(r.otherTypeNegative.notRuntimeMembershipNegative,true);
 assert.equal(r.sourceOnlyNotRuntimeList,true);
 assert.deepEqual(e.coverage,{previousOwnerStatic:131,newlyOwnerStatic:1,currentOwnerStatic:132,totalSelectors:256,remainingUnknown:124,unresolved:{Fish:0,Crafting:0,Clothing:61,Furniture:63}});
 const s=e.safety;assert.equal(s.independentQrAccepted,false);assert.equal(s.denominator,null);
 assert.equal(s.finalMembershipKnown,false);
 for(const key of ['personalMetricsAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublisherAuthorized','entitlementEditAuthorized','switch1253OrSteamTransferred'])assert.equal(s[key],false);
});
