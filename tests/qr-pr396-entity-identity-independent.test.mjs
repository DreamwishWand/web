// 04QR independent new-only Identity Contract: no account/provider or public claims.
// Exact PR396 source only, synthetic records and Source evidence declarations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEntityRef,makeSourceScope,createSharedEntityRegistry,entityRefKey,nativeEntityPath,resolveVerifiedLabel}
 from '../src/lib/entity/shared-entity-identity.mjs';
const scope={platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624,dlc:[]};
const source626={...scope,fullVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626};
const ref=(kind,id,s=null)=>({kind,primaryId:id,secondaryId:s});
const item=ref('ITEM','40000047'),quest=ref('QUEST','40000047'),child=ref('ITEM','40000047','10001');
const record=(r,patch={})=>({ref:r,sourceScope:scope,visibility:'PUBLIC',publicEligible:true,indexable:false,...patch});
test('independent strict identity forbids Quest/Item same numeric key, malformed opaque and composite abuse',()=>{
 assert.notEqual(entityRefKey(item),entityRefKey(quest));
 assert.notEqual(entityRefKey(item),entityRefKey(child));
 for(const val of ['01','0','-1','1e3','123456789012345678901','../protected'])assert.throws(()=>makeEntityRef(ref('ITEM',val)),/PRIMARY_ID_INVALID/);
 assert.throws(()=>makeEntityRef(ref('CREATOR','../private')),/PRIMARY_ID_INVALID/);
 assert.throws(()=>makeEntityRef(ref('WORK','valid-slug','7')),/SECONDARY_ID_INVALID/);
 console.log('QR_396_TYPED_ID_CROSS_KIND_COMPOSITE_INVALID_REJECT_PASS');
});
test('P/S requires independently CONFIRMED source specialization; no bare composite or forged HYPOTHESIS',()=>{
 const proven={type:'SPECIALIZATION',source:item,target:child,evidence:'CONFIRMED',sourceRef:'native-read-proof'};
 const absent=createSharedEntityRegistry([record(child)]);
 const hypothesis=createSharedEntityRegistry([record(child,{relations:[{...proven,evidence:'HYPOTHESIS'}]})]);
 assert.equal(absent.resolve(child,scope).status,'NOT_FOUND');
 assert.equal(hypothesis.resolve(child,scope).status,'NOT_FOUND');
 const accepted=createSharedEntityRegistry([record(item),record(child,{relations:[proven]})]);
 assert.equal(accepted.resolve(child,scope).status,'FOUND');
 assert.equal(accepted.resolveNative('40000047','10001',scope).ref.secondaryId,'10001');
 console.log('QR_396_SPECIALIZATION_PROOF_ONLY_P_S_PASS');
});
test('native path collision, alias hijack and unknown Public identity fail-closed',()=>{
 const conflict=createSharedEntityRegistry([record(item),record(quest)]);
 assert.equal(conflict.resolveNative('40000047',null,scope).status,'AMBIGUOUS');
 const alias=ref('ITEM','40000048');
 const a={ref:alias,type:'SAME_PUBLIC_ENTITY',sourceRef:'source-line',evidence:'CONFIRMED'};
 const duplicate=createSharedEntityRegistry([record(item,{aliases:[a]}),record(alias)]);
 assert.equal(duplicate.resolve(alias,scope).status,'AMBIGUOUS');
 assert.equal(duplicate.resolveNative('99999999',null,scope).status,'NOT_FOUND');
 console.log('QR_396_ALIAS_COLLISION_NATIVE_PUBLIC_FAILCLOSED_PASS');
});
test('Privacy/public no coercion from private, BID, schema or DLC; explicit source makes scope',()=>{
 const privateItem=ref('ITEM','40000090');
 const privateWork=ref('WORK','private-work');
 const registry=createSharedEntityRegistry([record(item),record(privateItem,{visibility:'PRIVATE',publicEligible:false}),
  {ref:privateWork,visibility:'PRIVATE',publicEligible:false,indexable:true}]);
 assert.equal(registry.resolve(privateItem,scope).status,'NOT_FOUND');
 assert.equal(registry.resolve(privateItem,scope,{publicOnly:false}).status,'PRIVATE');
 assert.equal(registry.resolve(privateWork).status,'NOT_FOUND');
 assert.equal(registry.resolve(item,source626).status,'NOT_FOUND');
 assert.equal(registry.resolve(item,{...scope,schema:626}).status,'NOT_FOUND');
 assert.equal(registry.resolve(item,{...scope,dlc:['expansion-a']}).status,'NOT_FOUND');
 assert.equal(registry.resolve(item,scope).indexable,false);
 assert.throws(()=>makeSourceScope({...scope,bid:'UNVERIFIED'}),/SWITCH_BID/);
 console.log('QR_396_PRIVACY_VERSION_SCHEMA_BID_DLC_FAILCLOSED_PASS');
});
test('eight locale path candidate only, never Creator/Work/Preset link or official translation inferred',()=>{
 for(const lang of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  assert.equal(nativeEntityPath(child,lang,{base:'/web'}),'/web/'+lang+'/40000047/10001/');
 }
 assert.equal(nativeEntityPath(item,'unknown'),null);
 assert.equal(nativeEntityPath(ref('CREATOR','aa11'),'en'),null);
 assert.equal(nativeEntityPath(ref('WORK','first-work'),'ja'),null);
 assert.equal(nativeEntityPath(ref('PRESET','first-preset'),'en'),null);
 assert.deepEqual(resolveVerifiedLabel({en:{verified:true,value:'Verified English'},ja:{verified:false,value:'未確認'}},'ja'),
  {status:'FALLBACK',value:'Verified English',sourceLocale:'en',fallback:true});
 console.log('QR_396_EIGHT_LOCALES_CANDIDATE_ONLY_FALLBACK_MARKED_PASS');
});
