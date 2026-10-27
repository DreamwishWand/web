import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>JSON.parse(readFileSync(x,'utf8'));
const a=read('static/ddv/qa/qr-pr195-final153-original-independent-v125.json');
const v='static/ddv/core/collection/v1.25/';
const fish=read(v+'native-activity-fish-nolocation-original-v125.json');
const craft=read(v+'native-crafting-recipe-type-28-original-v125.json');
const univ=read(v+'native-universe-124-original-native-v125.json');
const sha=/^[a-f0-9]{64}$/;
test('frozen exact Owner build and five private original SHA attestation; never confuse public CI with raw replay',()=>{
 assert.equal(a.frozenOwnerHead,'64913f8d63f90dc9ada1200a1249aff373217420');
 assert.equal(a.ownerCI.id,40458207678);assert.equal(a.ownerCI.status,'SUCCESS');
 assert.equal(a.priorQA.independentAccepted,103);
 assert.deepEqual(a.scope,{platform:'Nintendo Switch',version:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.deepEqual(Object.values(a.originalFiles).map(x=>x.bytes),[96002294,36538728,59624529,5090928,168583]);
 for(const file of Object.values(a.originalFiles))assert.match(file.sha256,sha);
 assert.match(a.originalOnlyLocalReplay.scriptSha256,sha);
 assert.match(a.originalOnlyLocalReplay.resultSha256,sha);
 assert.equal(a.originalOnlyLocalReplay.privateBytesCommitted,false);
 assert.equal(a.originalOnlyLocalReplay.privateOriginalReplayInGitHubCI,false);
});
test('Fish original full140B, direct no-location branch and MethodSpec98717; no fish-location family promotion',()=>{
 const x=a.family.Fish,y=fish.definition,n=fish.originalNative;
 assert.equal(x.verdict,'PASS_STATIC');assert.equal(x.pass,1);
 assert.equal(y.id,2120000020);assert.equal(y.fullSerializedBytes,140);assert.equal(y.rawPayloadSha256,x.originalDefinition.sha256);
 assert.equal(y.fishUseLocationPresent,false);assert.equal(y.fishUseLocationDefault,false);
 assert.equal(y.fishLocationPresent,false);assert.equal(x.originalDefinition.separateByItemIgnoreID,31000006);
 assert.equal(n.nonLocationPath.sha256,x.native.armSha256);
 assert.equal(n.nonLocationPath.bytes,220);
 assert.equal(n.nonLocationPath.methodSpecIndex,98717);
 assert.equal(n.nonLocationPath.genericTypeDefIndex,9613);
 assert.equal(n.projector.sha256,x.native.projectorSha256);
 assert.equal(n.withLocationAlternative.selectedForThisDefinition,false);
 assert.equal(n.separateCommonIsValid,true);
});
test('Crafting all28 original selector occurrence arguments, protobuf complete record SHA, Ignore distinctions; independent RED MUST NOT become acceptance',()=>{
 const q=a.family.Crafting;
 assert.equal(q.verdict,'RED');assert.equal(q.pass,0);assert.equal(q.red,28);
 assert.equal(craft.selectors.length,28);
 assert.equal(q.originalSelectorProtobufShaVerified,28);
 const keys=new Set();
 for(const s of craft.selectors){
  assert(Number.isInteger(s.definitionId)&&Number.isInteger(s.recipeType));
  assert.match(s.fullOriginalRecordSHA256,sha);
  assert.equal(s.rawSha256,s.fullOriginalRecordSHA256);
  assert.equal(typeof s.byTypeIgnore,'boolean');
  assert.equal(s.source,'original retained Support Tables row');
  const key=s.definitionId+':'+s.recipeType+':'+s.byTypeIgnore;
  assert(!keys.has(key));keys.add(key);
 }
 assert.equal(keys.size,28);
 assert.equal(q.originalRecipeItemsShaVerified,1206);
 assert.equal(q.sourceRecipeResultMissing,0);
 assert.equal(craft.native.resultMapping.meaning,'return CraftingRecipeItemData.Result.ItemID, not recipe item ID');
});
test('RED minimal original NSO MethodSpec98710 resolves Critter, not owner claimed CraftingRecipe; suggested 98709 MUST be independently rebound before PASS',()=>{
 const r=a.family.Crafting.minimalRed,g=craft.native.getAllByType;
 assert.equal(g.methodSpecIndex,98710);
 assert.equal(g.typeDef,9715); // OWNER CLAIM, checked specifically as disputed
 assert.equal(g.callRva,'0x4BFC974');
 assert.equal(g.sourceEncodedUsage,'0xC003032D');
 assert.equal(r.original98710GenericInst,8335);
 assert.equal(r.original98710ActualTypeDef,9630);
 assert.equal(r.original98710ActualType,'CritterItemData');
 assert.notEqual(r.original98710ActualTypeDef,g.typeDef);
 assert.equal(r.actualRecipeMethodSpec,98709);
 assert.equal(r.actualRecipeGenericInst,8326);
 assert.equal(r.actualRecipeTypeDef,9715);
 assert.equal(r.originalNativeCallSite,'0x4BFC974');
 assert.equal(r.actualUsageRva,'0xB1EF488');
 assert.equal(r.actualUsage,'0xC003032D');
 assert.equal(r.originalMethodSpec98710,'29950100ffffffff8f200000');
 assert.equal(r.actualRecipeMethodSpecHex,'29950100ffffffff86200000');
 assert.equal(a.family.Crafting.mustRebindOwnerNativePath,true);
});
test('Clothing independent original bounded branch, metadata, all61 original-selector contracts',()=>{
 const q=a.family.Clothing,e=univ.originalNative.clothing;
 assert.equal(q.verdict,'PASS_STATIC');assert.equal(q.pass,61);
 assert.equal(e.concreteTypeDef,9204);assert.equal(e.getAllMethodSpecIndex,98706);assert.equal(e.itemType,5);
 assert.equal(e.dispatchSha256,q.dispatchSha256);assert.equal(e.loopSha256,q.loopSha256);assert.equal(e.predicateSha256,q.predicateSha256);
 const entries=univ.entries.filter(x=>x.family==='Clothing');
 assert.equal(entries.length,61);
 for(const x of entries){assert.equal(x.outerCase,4);assert.equal(x.innerCase,2);assert(Number.isInteger(x.universeTag));assert.equal(x.sourceCandidateCountNotFinalMembership,true);}
 assert.equal(q.originalItemDataShaVerified,1900);assert.equal(q.sourceWithoutSet,0);
 assert.equal(q.sourceSetRefsResolved,1900);
 assert.deepEqual(univ.originalNative.commonSetLookup.methodSpecIndex,98899);
});
test('Furniture distinct native/metadata branch, all63 original selector contracts, nullSet vs mismatching Set tag independent',()=>{
 const q=a.family.Furniture,e=univ.originalNative.furniture;
 assert.equal(q.verdict,'PASS_STATIC');assert.equal(q.pass,63);
 assert.equal(e.concreteTypeDef,9078);assert.equal(e.getAllMethodSpecIndex,98722);assert.equal(e.itemType,4);
 assert.equal(e.dispatchSha256,q.dispatchSha256);assert.equal(e.loopSha256,q.loopSha256);assert.equal(e.predicateSha256,q.predicateSha256);
 const entries=univ.entries.filter(x=>x.family==='Furniture');
 assert.equal(entries.length,63);
 for(const x of entries){assert.equal(x.outerCase,3);assert.equal(x.innerCase,2);assert(Number.isInteger(x.universeTag));assert.equal(x.sourceCandidateCountNotFinalMembership,true);}
 assert.equal(q.originalItemDataShaVerified,4949);
 assert.equal(q.sourceWithoutSet,945);assert.equal(q.sourceSetRefsResolved,4004);
 assert.equal(q.sourceSetRefsResolved+q.sourceWithoutSet,q.originalItemDataShaVerified);
 assert.equal(e.setItemIdField,8);
 assert.equal(univ.originalNative.commonSetLookup.setTagsFieldNumber,6);
 assert.equal(univ.originalNative.commonSetLookup.nullSetItemData,'SKIP');
 assert.equal(e.getAllMethodSpecIndex!==univ.originalNative.clothing.getAllMethodSpecIndex,true);
});
test('All124 Universe original selector occurrences without silent duplicate/shared-case or runtime denominator inference',()=>{
 assert.equal(univ.entries.length,124);
 const keys=new Set();
 for(const e of univ.entries){
  assert(['Clothing','Furniture'].includes(e.family));
  const k=[e.definitionId,e.family,e.universeTag].join(':');
  assert(!keys.has(k));keys.add(k);
  assert.equal(e.selectorStatus,'OWNER_SAME_BUILD_NATIVE_PREDICATE_STATIC_CONFIRMED__QR_PENDING');
  assert.equal(e.sourceCandidateCountNotFinalMembership,true);
 }
 assert.equal(keys.size,124);
 assert.deepEqual(a.family.Clothing.zeroSourceSelectorIds,[2120000162,2120000367]);
 assert.deepEqual(a.family.Furniture.zeroSourceSelectorIds,[2120000248,2120000254,2120000368]);
 assert.equal(a.sharedUniverse.sourceCollectionDefinitionRawRowsShaVerified,293);
 assert.equal(a.sharedUniverse.sourceSetRawRowsShaVerified,711);
 assert.equal(a.sharedUniverse.nullSet,'SKIP');
 assert.equal(a.sharedUniverse.sourceJoinNeverRuntimeDenominator,true);
});
test('Fail CLOSED under Crafting provenance RED while 125 independent PASS remain valid; NO personal counters/writers/Steam schema transfer',()=>{
 const f=a.family,c=a.coverage;
 assert.equal(f.Fish.pass+f.Crafting.pass+f.Clothing.pass+f.Furniture.pass,125);
 assert.equal(c.newCrafting,0);assert.equal(c.independentAccepted,228);assert.equal(c.prior,103);
 assert.equal(c.unacceptedCrafting,28);assert.equal(c.total,256);
 assert.equal(c.independentAccepted+c.unacceptedCrafting,c.total);
 for(const k of ['runtimeItemDatabase','runtimeCollectionSets','groupMembership','personalOwned','personalCollected','personalMissing'])assert.equal(a.safety[k],'UNKNOWN',k);
 assert.equal(a.safety.denominator,null);
 for(const k of ['percentEnabled','nativeWriterEnabled','presetApplyEnabled','communityPublisherEnabled','entitlementEditingEnabled','steamMeaningTransfer','schema626MeaningTransfer','publicLaunchAllowed'])assert.equal(a.safety[k],false,k);
 assert.match(a.releaseState,/DO_NOT_MERGE_DO_NOT_DEPLOY/);
});