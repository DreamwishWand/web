import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeIsValidRegistryEvidenceV125,inspectNativeIsValidRegistryBoundaryV125,NATIVE_ISVALID_REGISTRY_SOURCE_SHA256_V125} from '../src/lib/ddv/core/collection/native-isvalid-registry-v125.js';
const raw=readFileSync('static/ddv/core/collection/v1.25/native-isvalid-registry-methodidentity-v125.json');
const id={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verify=()=>verifyNativeIsValidRegistryEvidenceV125(raw,id);
const probe=(cap,itemId)=>inspectNativeIsValidRegistryBoundaryV125({verifiedSource:cap,identity:id,itemId});
test('Same-build NSO + dump + v31 metadata + MethodSpec are pinned by exact source SHA',async()=>{
 const cap=await verify();assert.equal(cap.status,'STATIC_ISVALID_REGISTRY_SEMANTICS_VERIFIED');
 assert.equal(cap.sourceSha256,NATIVE_ISVALID_REGISTRY_SOURCE_SHA256_V125);assert.equal(cap.finalNativeMembershipAuthorized,false);
});
test('First methodref resolves ICollectionItem get_CanBeCollected, not a guessed visibility/entitlement method',()=>{
 const src=JSON.parse(raw);assert.equal(src.methodIdentity.first.genericArgument.genericArgTypeDefIndex,10722);
 assert.equal(src.methodIdentity.first.genericArgument.methodSpecIndex,98945);
 assert.equal(src.methodIdentity.first.virtualInterfaceMethod,'Definitions.Items.ICollectionItem.get_CanBeCollected');
 assert.equal(src.methodIdentity.first.virtualSlot,1);
});
test('Second MethodSpec and virtual interface resolve IItemIsVariationOf.get_IsVariationOf',()=>{
 const src=JSON.parse(raw);assert.equal(src.methodIdentity.second.genericArgument.genericArgTypeDefIndex,10720);
 assert.equal(src.methodIdentity.second.genericArgument.methodSpecIndex,98963);
 assert.equal(src.methodIdentity.second.virtualInterfaceMethod,'Definitions.Items.IItemIsVariationOf.get_IsVariationOf');
 assert.equal(src.methodIdentity.second.virtualSlot,0);
});
test('Item.Invalid cctor is zero; final variation parent int equality is not a personal ownership test',()=>{
 const src=JSON.parse(raw);assert.equal(src.methodIdentity.staticCompareItemTypeInfo.typeDefIndex,10554);
 assert.equal(src.opcodeLE['0X4C521B4'],'1f0100b9');assert.equal(src.nativeBooleanConditions.secondInterfacePresent.ItemInvalidItemId,0);
 assert.equal(src.nativeBooleanConditions.secondInterfacePresent.nativeEligibility,undefined);
});
test('Failure and optional-variation branch values are exact, not inferred runtime data',()=>{
 const f=JSON.parse(raw).nativeBooleanConditions;
 assert.equal(f.firstLookupMissing,false);assert.equal(f.firstCanBeCollectedFalse,false);
 assert.equal(f.firstCanBeCollectedTrueAndSecondInterfaceMissing,true);
});
test('Whole 153MB native text direct BL scan finds one validity caller and four upstream GetNewGroup paths',()=>{
 const c=JSON.parse(raw).directNativeCallers;
 assert.deepEqual(c.IsValidItemForCollection,['0x4f70fc8']);
 assert.deepEqual(c.GetNewGroup,['0x4f71da8','0x5c346e0','0x5c355d8','0x5c6a48c','0x5f9e78c']);
 assert.deepEqual(c.GetItemsInGroup,['0x4bf9b70','0x4f66ec0','0x4f70e44']);
});
test('Verified static source still refuses any per-item validity or collected/owned percentage',async()=>{
 const p=probe(await verify(),10000098);assert.equal(p.status,'STATIC_SEMANTIC_PREDICATE_ONLY');
 assert.equal(p.nativeEligibility,'UNKNOWN');assert.equal(p.collected,'UNKNOWN');assert.equal(p.owned,'UNKNOWN');
 assert.equal(p.denominator,null);assert.equal(p.personalCollectionMetricsAuthorized,false);
});
test('Unverified Caller-supplied bool/variation state cannot turn into native truth',async()=>{
 const v=await verify();const p=inspectNativeIsValidRegistryBoundaryV125({verifiedSource:v,identity:id,itemId:10000098,canBeCollected:true,isVariationOf:0});
 assert.equal(p.nativeEligibility,'UNKNOWN');assert.equal(p.firstVirtualResult,'UNKNOWN');
});
test('Tamper and fabricated capability fail closed',async()=>{
 const changed=Buffer.from(raw);changed[240]^=1;
 assert.equal((await verifyNativeIsValidRegistryEvidenceV125(changed,id)).code,'SOURCE_SHA256_MISMATCH');
 assert.equal(probe({status:'STATIC_ISVALID_REGISTRY_SEMANTICS_VERIFIED'},10000098).code,'VERIFIED_SOURCE_CAPABILITY_REQUIRED');
});
test('Nonpositive or non-integer IDs fail closed',async()=>{
 const v=await verify();for(const itemId of [0,-1,NaN,Infinity,'10000098',1.5])assert.equal(probe(v,itemId).code,'INVALID_ITEM_ID');
});
test('Wrong BID, v1.25.3/schema626, Steam cannot import the source semantics',async()=>{
 for(const extra of [{buildId:'9A239D3DB569756D'},{profileSchema:626},{platform:'steam-windows'},{gameVersion:'1.25.3'}]){
   const p=await verifyNativeIsValidRegistryEvidenceV125(raw,{...id,...extra});assert.equal(p.code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
 }
});
test('No personal source, entitlement mutation or native writer in machine artifact',()=>{
 const s=JSON.parse(raw);assert.equal(s.required.anyPersonalMetricAuthorized,false);
 assert.equal(s.required.entitlementWriterAuthorized,false);assert.equal(s.required.nativeWriterAuthorized,false);
 assert.equal(s.required.publicConsumerAuthorized,false);assert.equal(s.evidenceClasses.finalAll256SelectorMembership,'UNKNOWN');
});
