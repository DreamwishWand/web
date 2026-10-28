import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-universe-original-set-join-source-v125.json','utf8'));
const defs=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
test('Source join only pins original Switch1250 lossless/support GZ and exact source family counts',()=>{
 assert.equal(e.scope.bid,'52BD625D9B4E0053');assert.equal(e.scope.saveSchema,624);
 assert.equal(e.rawSource.supportGzipSha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(e.rawSource.losslessGzipSha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(e.rawSource.originalIndividualSetProtobufShaVerified,711);
 assert.equal(e.rawSource.originalClothingProtobufShaVerified,1900);
 assert.equal(e.rawSource.originalFurnitureProtobufShaVerified,4949);
});
test('711 original Set records include 709 with exactly one Universe tag and two without',()=>{
 assert.deepEqual(e.setSource,{total:711,uniqueSetIDs:711,setWithExactlyOneUniverseTag:709,setWithoutUniverseTag:2,setWithMultipleUniverseTags:0,sourceOnly:true});
});
test('Every original clothing SetItemID has valid Source Set with Universe Tag; source correlation not native equality proof',()=>{
 const c=e.joinAudit.clothing;assert.equal(c.typedItems,1900);
 assert.equal(c.setItemIDPresent,1900);assert.equal(c.refersToValidOriginalSet,1900);assert.equal(c.setWithUniverseTag,1900);
 assert.equal(c.distinctSourceSetIDs,217);assert.equal(c.missingRef,0);
 const x=e.joinAudit.exampleClothing;assert.equal(x.itemId,50700002);assert.equal(x.setItemID,2040100006);
 assert.equal(x.setUniverseTag,2000500001);assert.equal(x.matchingCollectionDefinition,2120000025);
 const d=defs.find(r=>r[0]===x.matchingCollectionDefinition);assert.ok(d);assert.deepEqual(d[5].filter(q=>q[0]==='Clothing'),[['Clothing',{Universe:x.setUniverseTag},0]]);
});
test('Furniture Source SetItemID absent 945, present 4004; all 4004 references resolve to tag, not membership',()=>{
 const f=e.joinAudit.furniture;assert.equal(f.typedItems,4949);assert.equal(f.setItemIDPresent,4004);
 assert.equal(f.setItemIDAbsent,945);assert.equal(f.refersToValidOriginalSet,4004);
 assert.equal(f.setWithUniverseTag,4004);assert.equal(f.distinctSourceSetIDs,315);
 const x=e.joinAudit.exampleFurniture;
 assert.equal(x.itemId,40000047);assert.equal(x.setItemID,2040000009);
 assert.equal(x.setUniverseTag,2000500001);
 const d=defs.find(r=>r[0]===x.matchingCollectionDefinition);assert.ok(d);assert.deepEqual(d[5].filter(q=>q[0]==='Furniture'),[['Furniture',{Universe:2000500001},0]]);
});
test('Distinct Source Set Universe example cannot establish final negative or native authority',()=>{
 const x=e.joinAudit.negativeSourceCrossUniverse;
 assert.equal(x.setId,2040000000);assert.equal(x.universeTag,2000500002);
 assert.equal(x.notMatchingUniverse2000500001InRawSetTags,true);
 assert.equal(x.notNativeCollectionNegative,true);
 assert.equal(e.nativeBoundary.UniverseValueMappedToSetTagsViaNative,'NEED_ORIGINAL_CALLCHAIN');
 assert.equal(e.nativeBoundary.doNotReplaceOriginalUnknownWithSourceJoin,true);
});
test('Crossfamily source join cannot increase Owner coverage or authorize runtime/personal/write cross-version',()=>{
 assert.deepEqual(e.coverage,{ownerBefore:132,newSelectorsClosed:0,ownerAfter:132,unclosed:{Clothing:61,Furniture:63},independentAcceptedLastKnown:103});
 const s=e.safety;assert.equal(s.denominator,null);assert.equal(s.finalMembershipKnown,false);assert.equal(s.allPrDraft,true);
 for(const k of ['personalMetrics','writer','apply','communityPublishing','entitlementEditing','steamOr626Transfer'])assert.equal(s[k],false,k);
 for(const k of ['owned','collected','missing'])assert.equal(s[k],'UNKNOWN');
});
