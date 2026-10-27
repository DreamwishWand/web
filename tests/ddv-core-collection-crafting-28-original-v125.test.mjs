import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ev=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-crafting-recipe-type-28-original-v125.json','utf8'));
const compact=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
function vi(b,p){let n=0,s=0;while(true){assert.ok(p<b.length);const x=b[p++];n+=(x&127)*2**s;if(x<128)return [n,p];s+=7;assert.ok(s<=56);}}
function decode(b){let pos=0,a=[];while(pos<b.length){let k;[k,pos]=vi(b,pos);const no=k>>>3,w=k&7;let v;if(w===0)[v,pos]=vi(b,pos);else if(w===2){let len;[len,pos]=vi(b,pos);assert.ok(pos+len<=b.length);v=b.subarray(pos,pos+len);pos+=len;}else throw Error('unsupported wire');a.push({no,w,v});}return a;}
const get=(a,no)=>a.filter(z=>z.no===no);
test('Original pinned source provenance and version scope are strict',()=>{
 assert.equal(ev.scope.platform,'Nintendo Switch');assert.equal(ev.scope.bid,'52BD625D9B4E0053');
 assert.equal(ev.scope.saveSchema,624);assert.equal(ev.sourceSha256.main,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(ev.sourceSha256.metadataV31,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(ev.sourceSha256.losslessGz,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(ev.sourceSha256.supportGz,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(ev.historicalUntracedD548,'NEED_SOURCE_NOT_EQUATED');
});
test('Original method spec 98710/Where RecipeType/eight distinct proto values exactly one shared predicate',()=>{
 const n=ev.native;assert.equal(n.outerCraftingCase,5);assert.equal(n.innerRecipeTypeCase,2);
 const g=n.getAllByType;assert.equal(g.itemType,12);assert.equal(g.methodSpecIndex,98710);assert.equal(g.typeDef,9715);
 assert.equal(g.methodSpecRva,'0x96E5DA4');
 assert.equal(g.sourceEncodedUsage,'0xC003032D');
 const spec=Buffer.from(g.methodSpecHex,'hex');assert.equal(spec.length,12);
 assert.equal(spec.readUInt32LE(0),103721);assert.equal(spec.readInt32LE(4),-1);assert.equal(spec.readUInt32LE(8),8335);
 assert.equal(n.predicate.lambdaRva,'0x4C009E0');
 assert.equal(n.predicate.first36BytesSha256,'d211d013e5a5afa619ff492d1e52f92293a30d5ae3acfd1424d8101c9c191ed6');
 assert.equal(n.predicate.recipeFieldOffset,'0x50');assert.equal(n.predicate.selectorCapturedOffset,'0x10');
 assert.equal(n.predicate.whereCallSiteRva,'0x4BFD438');
 assert.equal(ev.native.protobuf.CollectionCraftingRecipeType,2);assert.equal(ev.native.protobuf.CraftingRecipeItemDataRecipeType,8);
});
test('All 28 distinct selector occurrences, not just 25 definition IDs, each original full row hash, typed oneof wire and Ignore',()=>{
 assert.equal(ev.selectors.length,28);
 assert.equal(new Set(ev.selectors.map(x=>x.definitionId)).size,25);
 const original=[];
 for(const row of compact)for(const q of row[5]||[])if(q[0]==='Crafting')original.push([row[0],q[1].RecipeType,q[2]===1||q[2]===true]);
 assert.equal(original.length,28);
 const key=x=>x.join(':');
 assert.deepEqual(ev.selectors.map(x=>key([x.definitionId,x.recipeType,x.byTypeIgnore])).sort(),original.map(key).sort());
 for(const x of ev.selectors){
  assert.match(x.fullOriginalRecordSHA256,/^[a-f0-9]{64}$/);assert.ok(x.fullOriginalRecordBytes>=100);
  assert.equal(x.rawSha256,x.fullOriginalRecordSHA256);
  const bytes=Buffer.from(x.craftingByTypeBoundedWireHex,'hex'),top=decode(bytes),outer=get(top,8);
  assert.equal(outer.length,1);assert.equal(outer[0].w,2);
  assert.equal(get(decode(outer[0].v),2).length,1);
  assert.equal(get(decode(outer[0].v),2)[0].v,x.recipeType);
  const ignore=get(top,1);assert.equal(ignore.length,x.byTypeIgnore?1:0);
  if(x.byTypeIgnore)assert.equal(ignore[0].v,1);
 }
});
test('Original Results projection is ItemID from ResultInstance, not CraftingRecipeItemData ID, no recipe ICollectionItem',()=>{
 const n=ev.native;
 assert.equal(n.resultMapping.lambdaRva,'0x4BFF330');assert.equal(n.resultMapping.first36BytesSha256,'b0c036d6800e0f1d66a82fcb12b29559287c1ca2259c68f19ef57305213ecdbb');
 assert.equal(n.resultMapping.resultPointerOffset,'0x40');
 assert.equal(n.resultMapping.resultItemIdOffset,'0x18');
 assert.equal(ev.native.protobuf.CraftingRecipeItemDataResult,6);assert.equal(ev.native.protobuf.ResultInstanceItemID,1);
 assert.equal(n.concrete.implementsICollectionItem,false);assert.equal(n.commonIsValidSeparate,true);
 assert.equal(ev.originalCraftingRecipeRawExamples.length,8);
 const types=new Set(ev.originalCraftingRecipeRawExamples.map(x=>x.recipeType));
 assert.equal(types.size,8);
 for(const e of ev.originalCraftingRecipeRawExamples){
  assert.notEqual(e.recipeItemID,e.resultItemID);assert.match(e.recipeRawSHA256,/^[a-f0-9]{64}$/);
  assert.equal(e.typedRecipeResultField6Present,true);
  assert.equal(e.resultNestedItemIdField1Present,true);
 }
});
test('Recipe typed source counts are not collection membership nor even same concrete eligibility',()=>{
 assert.equal(ev.originalItemDbTypedInputs.totalCraftingRecipeItemData,1206);
 assert.equal(ev.originalItemDbTypedInputs.resultField6AndNestedItemIDPresent,1206);
 assert.equal(ev.originalItemDbTypedInputs.lookupSourceResultItemIDPresent,1206);
 assert.equal(ev.originalItemDbTypedInputs.notRuntimeItemDatabase,true);
 const results=new Set(ev.originalCraftingRecipeRawExamples.map(x=>x.resultItemConcreteType));
 assert.ok(results.has('FurnitureItemData'));assert.ok(results.has('ActivityItemData'));
 assert.ok(results.has('FenceAndRoadItemData'));
 assert.equal(ev.native.concrete.resultItemCanBeCollected,'UNKNOWN_BY_RETURNED_CONCRETE_ITEM_TYPE');
});
test('Owner 103+28 static 131, QR acceptance and runtime/writer remain independent UNKNOWN',()=>{
 const s=ev.safety;assert.equal(ev.coverage.previousOwnerStatic,103);
 assert.equal(ev.coverage.newStaticSelectors,28);
 assert.equal(ev.coverage.proposedOwnerStatic,131);
 assert.deepEqual(ev.coverage.unresolved,{ActivityItem:1,Clothing:61,Furniture:63,Crafting:0});
 assert.equal(s.qrAccepted,false);assert.equal(s.sourceOnly,true);
 assert.equal(s.denominator,null);assert.equal(s.runtimeItemDatabase,'UNKNOWN');assert.equal(s.owned,'UNKNOWN');assert.equal(s.missing,'UNKNOWN');assert.equal(s.collected,'UNKNOWN');
 for(const k of ['nativeWriter','apply','publishing','entitlementEditing','steamOr626'])assert.equal(s[k],false);
});
