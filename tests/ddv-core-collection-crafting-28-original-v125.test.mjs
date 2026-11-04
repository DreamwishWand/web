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
test('Original Crafting outer8 / RecipeType case2 uses generic2 MethodSpec98762 (not Critter98710)',()=>{
 const n=ev.native;assert.equal(n.outerCraftingCase,8);assert.equal(n.innerRecipeTypeCase,2);
 const g=n.getAllByType;assert.equal(g.itemType,205);assert.equal(g.subtype,3);assert.equal(g.methodSpecIndex,98762);assert.equal(g.typeDef,9715);assert.equal(g.secondTypeDef,10402);
 assert.equal(g.methodSpecRva,'0x96E6014');
 assert.equal(g.sourceEncodedUsage,'0xC0030395');assert.equal(g.usageRva,'0xB1EF628');
 const spec=Buffer.from(g.methodSpecHex,'hex');assert.equal(spec.length,12);
 assert.equal(spec.readUInt32LE(0),103722);assert.equal(spec.readInt32LE(4),-1);assert.equal(spec.readUInt32LE(8),34620);
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

test('original-bound method usage + ADRP/LDR + BL target are a single direct Crafting callsite, not an unrelated MethodSpec',()=>{
 const g=ev.native.getAllByType;
 assert.equal(g.usageAdrpRva,'0x4BFD0E0');
 assert.equal(g.usageLdrRva,'0x4BFD0E8');
 assert.equal(g.itemTypeMovRva,'0x4BFD0E4');
 assert.equal(g.subtypeMovRva,'0x4BFD0EC');
 assert.equal(g.subtypeStackStoreRva,'0x4BFD0F4');
 assert.equal(g.callRva,'0x4BFD0F8');
 assert.equal(g.rva,'0x37816F0');
 assert.equal(g.genericInstantiationRecordRva,'0xAC1F7A0');
 assert.equal(g.genericArgPointerListRva,'0xB100278');
 assert.equal(g.typePointerRva,'0xB2E1E88');
 assert.equal(g.secondTypePointerRva,'0xB2CCF58');
 assert.equal(g.nativeCallSliceSha256,'ceec4dd83d4056294fa57424ffaf8c4deaa91ef06d3ecb3e23c348e45ae34cbe');
 assert.equal(g.branchOuterCaseRva,'0x4BFD140');
 assert.equal(g.branchInnerCase2Rva,'0x4BFD3D0');
 assert.equal(g.initialEnumerationToListCallRva,'0x4BFD104');
 assert.equal(g.initialListHeldIn,'x21 at 0x4BFD114');
 assert.match(ev.native.expression,/ItemType205, subtype3/);
});

test('negative provenance: old BL Critter MethodSpec98710 must never be accepted as recipe',()=>{
 const bad=ev.native.historicalRed;
 assert.equal(bad.legacyOuterCase,5);
 assert.equal(bad.legacyCallRva,'0x4BFC974');
 assert.equal(bad.legacyUsageRva,'0xB1EF488');
 assert.equal(bad.legacyUsage,'0xC003032D');
 assert.equal(bad.legacyMethodSpecIndex,98710);
 assert.equal(bad.legacyInstantiationIndex,8335);
 assert.equal(bad.legacyTrueTypeDef,9630);
 assert.equal(bad.legacyTrueTypeName,'CritterItemData');
 assert.equal(bad.legacyItemType12,12);
 assert.equal(bad.legacyOpcodeSliceSha256,'42c12871749ab6e5faf112e50924e6186b45bfed86678f908cd1c5c035a55940');
 assert.notEqual(bad.legacyMethodSpecIndex,ev.native.getAllByType.methodSpecIndex);
 assert.notEqual(bad.legacyCallRva,ev.native.getAllByType.callRva);
 assert.notEqual(bad.legacyTrueTypeDef,ev.native.getAllByType.typeDef);
 assert.notEqual(bad.legacyOuterCase,ev.native.outerCraftingCase);
});

test('negative provenance: one-generic MethodSpec98709 for CraftingRecipeItemData is not a proved Crafting callsite',()=>{
 const bad=ev.native.historicalRed,g=ev.native.getAllByType;
 assert.equal(bad.otherMethodSpecIndex,98709);
 assert.equal(bad.otherInstantiationIndex,8326);
 assert.equal(bad.otherTypeDef,g.typeDef);
 assert.equal(bad.otherMethodSpecHex,'29950100ffffffff86200000');
 assert.equal(g.methodDefIndex,103722);
 assert.equal(g.methodSpecIndex,98762);
 assert.equal(g.secondTypeDef,10402);
});

test('original RecipeType equality and Result projector remain separate from null exceptional path and downstream IsValid',()=>{
 assert.equal(ev.native.predicate.whereCallSiteRva,'0x4BFD438');
 assert.equal(ev.native.predicate.whereTargetRva,'0x3756AE0');
 assert.equal(ev.native.resultMapping.lambdaRva,'0x4BFF330');
 assert.equal(ev.native.resultMapping.selectedFromRecipeTypeCase2At,'0x4BFD4E8');
 assert.equal(ev.native.resultMapping.sharedSelectEntryRva,'0x4BFD86C');
 assert.match(ev.native.resultMapping.nullResult,/0x4BFF350/);
 assert.match(ev.native.resultMapping.nullRuntimeMeaning,/UNKNOWN_NEED_RUNTIME/);
 assert.equal(ev.native.commonIsValidSeparate,true);
 assert.equal(ev.correction20261027.selectorOccurrences,28);
 assert.equal(ev.correction20261027.uniqueCollectionDefinitions,25);
 assert.equal(ev.safety.denominator,null);
});
