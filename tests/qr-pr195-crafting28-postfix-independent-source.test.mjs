import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Independent 04 QR source-contract audit, *not* a replacement for original
// Switch main NSO + metadata + 1206 raw ItemData byte verification.
const root='static/ddv/core/collection/v1.25/';
const name='native-crafting-recipe-type-28-original-v125.json';
const p=root+name;
const owner='da9528ce3565f68c5c201593fe06c84dfe8fbd3e';
const prior='64913f8d63f90dc9ada1200a1249aff373217420';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const current=JSON.parse(readFileSync(p,'utf8'));
const earlier=JSON.parse(git('show',prior+':'+p));
const compact=JSON.parse(readFileSync(root+'collection-definition-source-compact-v125.json','utf8')).records;
const assertHexSHA=(s)=>assert.match(s,/^[0-9a-f]{64}$/);
function decodeVarint(b,index){
 let n=0,shift=0;while(index<b.length){
  const v=b[index++];n+=(v&127)*2**shift;shift+=7;
  assert(shift<=56,'overlong protobuf varint');
  if(!(v&128))return [n,index];
 }throw Error('truncated protobuf varint');
}
function fields(data){
 const result=[];let i=0;
 while(i<data.length){
  let key;[key,i]=decodeVarint(data,i);
  const field=key>>>3,wire=key&7;
  assert(field>0);
  if(wire===0){let v;[v,i]=decodeVarint(data,i);result.push([field,wire,v]);}
  else if(wire===2){let len;[len,i]=decodeVarint(data,i);
    assert(i+len<=data.length,'truncated protobuf length-delimited field');
    result.push([field,wire,data.subarray(i,i+len)]);i+=len;
  }else throw Error('unsupported protobuf wire type '+wire);
 }
 return result;
}
const hexd=(s)=>{assert(/^(?:[0-9a-f]{2})+$/.test(s));return Buffer.from(s,'hex')};
const sorted=(xs)=>xs.sort((a,b)=>a.localeCompare(b));
const selectorKey=(o)=>[o.definitionId,o.recipeType,o.byTypeIgnore?1:0].join('/');
test('Exact Owner source-only + limited 4-path repair provenance, immutable Switch v1.25.0 BID/schema',()=>{
 assert.equal(git('merge-base',prior,owner),prior);
 assert.equal(git('merge-base',owner,'HEAD'),owner);
 const paths=git('diff','--name-only',prior,owner).split('\n').sort();
 assert.deepEqual(paths,[
 'docs/core/collection-save-backed-readonly-v125-20261026.md',
 'scripts/ddv/replay-native-crafting-recipe-28-original-v125.py',
 'static/ddv/core/collection/v1.25/native-crafting-recipe-type-28-original-v125.json',
 'tests/ddv-core-collection-crafting-28-original-v125.test.mjs'
 ]);
 assert.equal(git('hash-object',p),'877d06e19cd783423995f578105de17af5558ac7');
 assert.deepEqual(current.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',
     bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(current.sourceSha256.main,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(current.sourceSha256.metadataV31,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(current.sourceSha256.dumpCs,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(current.sourceSha256.losslessGz,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(current.sourceSha256.supportGz,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 console.log('QR_CRAFT28_OWNER_FROZEN_SCOPE_BLOB_AND_FIVE_EXPECTED_HASHES_SOURCE_PASS');
});
test('28 unmodified historical source selectors: actual independent compact list plus independently parsed bounded proto',()=>{
 const source=sorted(compact.flatMap(rec=>(rec[5]??[]).filter(x=>x[0]==='Crafting')
   .map(x=>[rec[0],x[1].RecipeType,+!!x[2]].join('/'))));
 assert.equal(source.length,28);
 assert.equal(current.selectors.length,28);
 assert.deepEqual(current.selectors,earlier.selectors,'repair must not change verified original 28 selector rows');
 assert.deepEqual(sorted(current.selectors.map(selectorKey)),source);
 assert.equal(new Set(current.selectors.map(x=>x.definitionId)).size,25);
 assert.equal(current.selectors.filter(x=>x.byTypeIgnore).length,19);
 assert.equal(new Set(current.selectors.map(x=>x.recipeType)).size,8);
 const recIndex=new Map(compact.map(x=>[x[0],x]));
 for(const s of current.selectors){
  const originalRec=recIndex.get(s.definitionId);
  assert(originalRec);
  assert.equal(originalRec[2],s.fullOriginalRecordSHA256);
  assert.equal(s.rawSha256,s.fullOriginalRecordSHA256);
  assertHexSHA(s.fullOriginalRecordSHA256);
  const f=fields(hexd(s.craftingByTypeBoundedWireHex));
  const recipeField=f.filter(x=>x[0]===8&&x[1]===2);
  assert.equal(recipeField.length,1);
  const nested=fields(recipeField[0][2]);
  assert.equal(nested.filter(x=>x[0]===2&&x[1]===0).length,1);
  assert.equal(nested.find(x=>x[0]===2&&x[1]===0)[2],s.recipeType);
  const ignore=f.filter(x=>x[0]===1);
  assert.equal(ignore.length,s.byTypeIgnore?1:0);
  if(s.byTypeIgnore)assert.equal(ignore[0][2],1);
 }
 const digest=createHash('sha256').update(source.join('\n')).digest('hex');
 console.log('QR_CRAFT28_SOURCE_ROSTER_PB_WIRE_28_CONSISTENT_SHA256='+digest);
});
test('original QR208 Critter RED retained, old one-generic Recipe is not accepted Crafting path',()=>{
 const g=current.native.getAllByType;
 assert.equal(earlier.native.getAllByType.callRva,'0x4BFC974');
 assert.equal(earlier.native.getAllByType.methodSpecIndex,98710);
 assert.equal(current.native.historicalRed.legacyTrueTypeDef,9630);
 assert.equal(current.native.historicalRed.legacyTrueTypeName,'CritterItemData');
 assert.equal(current.native.historicalRed.legacyOuterCase,5);
 assert.equal(current.native.historicalRed.legacyUsage,'0xC003032D');
 assert.equal(current.native.historicalRed.legacyMethodSpecIndex,98710);
 assert.equal(current.native.historicalRed.legacyMethodSpecHex,'29950100ffffffff8f200000');
 assert.equal(current.native.historicalRed.otherMethodSpecIndex,98709);
 assert.equal(current.native.historicalRed.otherTypeDef,9715);
 assert.notEqual(g.methodSpecIndex,98710);
 assert.notEqual(g.methodSpecIndex,98709);
 assert.equal(current.native.historicalRed.classification,'SUPERSEDED_WRONG_CRITTER_BRANCH__QR208_RED_CONFIRMED');
 console.log('QR_CRAFT28_CRITTER_NEGATIVE_HISTORICAL_RED_PRESERVED');
});
test('two-generic MethodSpec98762 structural identity, call path, IL2CPP GenericInst pointer and two TypeDef claims',()=>{
 const n=current.native,g=n.getAllByType;
 assert.equal(n.outerCraftingCase,8);assert.equal(n.innerRecipeTypeCase,2);
 const ms=hexd(g.methodSpecHex);
 assert.equal(ms.length,12);
 assert.equal(ms.readInt32LE(0),103722);
 assert.equal(ms.readInt32LE(4),-1);
 assert.equal(ms.readInt32LE(8),34620);
 assert.equal(g.methodSpecIndex,98762);
 assert.equal(g.methodSpecRva,'0x96E6014');
 assert.equal(g.typeDef,9715);assert.equal(g.secondTypeDef,10402);
 assert.equal(g.typeName,'CraftingRecipeItemData');
 assert.equal(g.secondTypeName,'ActivityDataItemType');
 assert.equal(g.genericInstantiationRecordRva,'0xAC1F7A0');
 assert.equal(g.genericArgPointerListRva,'0xB100278');
 assert.equal(g.typePointerRva,'0xB2E1E88');
 assert.equal(g.secondTypePointerRva,'0xB2CCF58');
 assert.equal(g.callRva,'0x4BFD0F8');assert.equal(g.rva,'0x37816F0');
 assert.equal(g.usageRva,'0xB1EF628');
 assert.equal(g.sourceEncodedUsage,'0xC0030395');
 assert.equal(g.itemType,205);assert.equal(g.subtype,3);
 assert.equal(g.usageAdrpRva,'0x4BFD0E0');
 assert.equal(g.itemTypeMovRva,'0x4BFD0E4');
 assert.equal(g.usageLdrRva,'0x4BFD0E8');
 assert.equal(g.subtypeMovRva,'0x4BFD0EC');
 assert.equal(g.subtypeStackStoreRva,'0x4BFD0F4');
 assert.equal(g.initialEnumerationToListCallRva,'0x4BFD104');
 assert.equal(g.initialEnumerationToListTarget,'0x37566C0');
 assert.equal(g.branchOuterCaseRva,'0x4BFD140');
 assert.equal(g.branchInnerCase2Rva,'0x4BFD3D0');
 assertHexSHA(g.nativeCallSliceSha256);
 assertHexSHA(g.branchOuterCase8OpcodeSha256);
 assertHexSHA(g.branchInnerCase2OpcodeSha256);
 console.log('QR_CRAFT28_REPAIRED_CALLCHAIN_STRUCTURALLY_CONSISTENT_NOT_RAW_NATIVE_ATTESTATION');
});
test('RecipeType predicate and Result.ItemID projector not recipe ID; exceptional NULL path cannot create valid ID',()=>{
 const n=current.native;
 assert.equal(n.predicate.comparison,'RecipeItemData.RecipeType == selector.Crafting.RecipeType');
 assert.equal(n.predicate.lambdaRva,'0x4C009E0');
 assert.equal(n.predicate.recipeFieldOffset,'0x50');
 assert.equal(n.predicate.selectorCapturedOffset,'0x10');
 assert.equal(n.predicate.whereCallSiteRva,'0x4BFD438');
 assert.equal(n.resultMapping.lambdaRva,'0x4BFF330');
 assert.equal(n.resultMapping.resultPointerOffset,'0x40');
 assert.equal(n.resultMapping.resultItemIdOffset,'0x18');
 assert.equal(n.protobuf.CollectionItemTypeCrafting,8);
 assert.equal(n.protobuf.CollectionCraftingRecipeType,2);
 assert.equal(n.protobuf.CraftingRecipeItemDataRecipeType,8);
 assert.equal(n.protobuf.CraftingRecipeItemDataResult,6);
 assert.equal(n.protobuf.ResultInstanceItemID,1);
 assert.match(n.resultMapping.nullResult,/exceptional helper/);
 assert.equal(n.resultMapping.nullRuntimeMeaning,'UNKNOWN_NEED_RUNTIME_FOR_OBSERVABLE_DATA__NATIVE_EXCEPTION_BRANCH_CONFIRMED');
 assert.equal(n.concrete.implementsICollectionItem,false);
 assert.equal(n.commonIsValidSeparate,true);
 console.log('QR_CRAFT28_RECIPE_PREDICATE_RESULT_PROJECTION_STRUCTURAL_PASS_RUNTIME_UNKNOWN');
});
test('source typed Recipe records original count and eight raw evidence sample names preserved, but NOT source-byte rechecked',()=>{
 assert.equal(current.sourceRecipeCount,1206);
 assert.equal(current.sourceResultMissingCount,0);
 assert.equal(current.originalItemDbTypedInputs.totalCraftingRecipeItemData,1206);
 assert.equal(current.originalItemDbTypedInputs.resultField6AndNestedItemIDPresent,1206);
 assert.equal(current.originalItemDbTypedInputs.lookupSourceResultItemIDPresent,1206);
 assert.deepEqual(current.originalCraftingRecipeRawExamples,earlier.originalCraftingRecipeRawExamples);
 assert.equal(current.originalCraftingRecipeRawExamples.length,8);
 assert.equal(new Set(current.originalCraftingRecipeRawExamples.map(x=>x.recipeType)).size,8);
 for(const r of current.originalCraftingRecipeRawExamples){
  assertHexSHA(r.recipeRawSHA256);
  assert.notEqual(r.recipeItemID,r.resultItemID);
  assert.equal(r.typedRecipeResultField6Present,true);
 }
 console.log('QR_CRAFT28_RECIPE_1206_HISTORICAL_SOURCE_ATTESTATION_INHERITED_NOT_REPLAYED');
});
test('do not promote 28 to independent STATIC PASS without private original main+metadata+dump+lossless+support replay',()=>{
 assert.equal(current.safety.qrAccepted,false);
 assert.equal(current.safety.sourceOnly,true);
 assert.equal(current.safety.denominator,null);
 assert.equal(current.coverage.newStaticSelectors,28);
 assert.equal(current.coverage.correction20261027,undefined); // repair metadata separately
 for(const k of ['runtimeItemDatabase','owned','collected','missing'])assert.equal(current.safety[k],'UNKNOWN');
 for(const k of ['nativeWriter','apply','publishing','entitlementEditing','steamOr626'])assert.equal(current.safety[k],false);
 console.log('QR_CRAFT28_NEW28_PARTIAL_NEED_ORIGINAL_PRIVATE_BYTES_INDEPENDENT_RAW_REPLAY');
});
