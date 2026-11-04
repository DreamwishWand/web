import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARED_ENTITY_IDENTITY_CONTRACT, ENTITY_KINDS, ENTITY_RELATIONS,
  ENTITY_LOCALES, makeEntityRef, entityRefKey, makeSourceScope,
  sameSourceScope, createSharedEntityRegistry, nativeEntityPath,
  resolveVerifiedLabel
} from '../src/lib/entity/shared-entity-identity.mjs';

const switch1250 = Object.freeze({
  platform:'Nintendo Switch',fullVersion:'1.25.0',
  bid:'52BD625D9B4E0053',schema:624,dlc:[]
});
const switch1253 = Object.freeze({
  platform:'Nintendo Switch',fullVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,dlc:[]
});
const item = Object.freeze({kind:'ITEM',primaryId:'40000047'});
const quest = Object.freeze({kind:'QUEST',primaryId:'40000047'});
const child = Object.freeze({kind:'ITEM',primaryId:'40000047',secondaryId:'900001'});
const proof = Object.freeze({
  type:'SPECIALIZATION',source:item,target:child,
  evidence:'CONFIRMED',sourceRef:'native-switch-1250-relation'
});
const record = (ref=item,extra={}) => ({
  ref,sourceScope:switch1250,visibility:'PUBLIC',
  publicEligible:true,indexable:false,...extra
});

test('distinct typed identity; reject malformed IDs and cross-kind composite',()=>{
  assert.equal(SHARED_ENTITY_IDENTITY_CONTRACT,'wand.shared-entity.identity@1');
  assert.deepEqual(ENTITY_KINDS,['ITEM','QUEST','CREATOR','WORK','PRESET']);
  assert.equal(ENTITY_RELATIONS.length,6);
  assert.equal(ENTITY_LOCALES.length,8);
  assert.equal(makeEntityRef(item).secondaryId,null);
  assert.notEqual(entityRefKey(item),entityRefKey(quest));
  assert.notEqual(entityRefKey(item),entityRefKey(child));
  assert.equal(makeEntityRef({kind:'WORK',primaryId:'f31a0e7d-1234-aaaa-9999-111111111111'}).kind,'WORK');
  assert.throws(()=>makeEntityRef({kind:'INVENTORY',primaryId:'40000047'}),/KIND_INVALID/);
  for (const id of ['0','-1','001','1e3','1.0','9999999999999999999','',null])
    assert.throws(()=>makeEntityRef({kind:'ITEM',primaryId:id}),/PRIMARY_ID_INVALID/);
  assert.throws(()=>makeEntityRef({kind:'CREATOR',primaryId:'alice/../private'}),/PRIMARY_ID_INVALID/);
  assert.throws(()=>makeEntityRef({kind:'WORK',primaryId:'w',secondaryId:'12'}),/SECONDARY_ID_INVALID/);
});

test('scope requires exact Platform, FullVersion, BID, Schema and DLC',()=>{
  assert.equal(sameSourceScope(switch1250,{...switch1250}),true);
  assert.equal(sameSourceScope(switch1250,switch1253),false);
  assert.equal(sameSourceScope(switch1250,{...switch1250,schema:626}),false);
  assert.equal(sameSourceScope(switch1250,{...switch1250,dlc:['expansion-a']}),false);
  assert.deepEqual(makeSourceScope({...switch1250,dlc:['z','a','z']}).dlc,['a','z']);
  for (const scope of [null,{...switch1250,bid:'not-proven'}, {...switch1250,schema:'624'}, {...switch1250,fullVersion:''}])
    assert.throws(()=>makeSourceScope(scope),/SCOPE|BID/);
  assert.throws(()=>createSharedEntityRegistry([{ref:item,visibility:'PUBLIC',publicEligible:true}]),/NATIVE_SOURCE_REQUIRED/);
});

test('public item; unknown/mismatched version; private Work; missing publication gate',()=>{
  const privateWork={kind:'WORK',primaryId:'private-work-1'};
  const heldItem={kind:'ITEM',primaryId:'40000999'};
  const reg=createSharedEntityRegistry([
    record(),record(heldItem,{publicEligible:false}),
    {ref:privateWork,visibility:'PRIVATE',publicEligible:false,indexable:false}
  ]);
  assert.deepEqual(reg.resolve(item,switch1250),{
    status:'FOUND',ref:makeEntityRef(item),alias:false,indexable:false
  });
  assert.equal(reg.resolve(item,switch1253).status,'NOT_FOUND');
  assert.equal(reg.resolve(item,switch1253,{publicOnly:false}).status,'VERSION_MISMATCH');
  assert.equal(reg.resolve({kind:'ITEM',primaryId:'999'},switch1250).status,'NOT_FOUND');
  assert.equal(reg.resolve(heldItem,switch1250).status,'NOT_FOUND');
  assert.equal(reg.resolve(heldItem,switch1250,{publicOnly:false}).status,'PRIVATE');
  assert.equal(reg.resolve(privateWork).status,'NOT_FOUND');
  assert.equal(reg.resolve(privateWork,null,{publicOnly:false}).status,'PRIVATE');
  assert.equal(nativeEntityPath(privateWork,'en'),null);
});

test('no composite P/S without native CONFIRMED SPECIALIZATION proof',()=>{
  assert.equal(createSharedEntityRegistry([record(child)]).resolve(child,switch1250).status,'NOT_FOUND');
  const forged=createSharedEntityRegistry([record(child,{
    relations:[{...proof,evidence:'HYPOTHESIS'}]
  })]);
  assert.equal(forged.resolve(child,switch1250).status,'NOT_FOUND');
  const matching=createSharedEntityRegistry([record(),record(child,{relations:[proof]})]);
  assert.equal(matching.resolveNative('40000047',null,switch1250).status,'FOUND');
  assert.equal(matching.resolveNative('40000047','900001',switch1250).ref.secondaryId,'900001');
  assert.equal(matching.resolveNative('40000047','100002',switch1250).status,'NOT_FOUND');
});

test('native URL /P collides across Item/Quest and duplicate canonical entries',()=>{
  const reg=createSharedEntityRegistry([record(item),record(quest)]);
  assert.equal(reg.resolve(item,switch1250).status,'FOUND');
  assert.equal(reg.resolve(quest,switch1250).status,'FOUND');
  assert.equal(reg.resolveNative('40000047',null,switch1250).status,'AMBIGUOUS');
  const duplicate=createSharedEntityRegistry([record(item),record(item)]);
  assert.equal(duplicate.resolve(item,switch1250).status,'AMBIGUOUS');
  assert.equal(duplicate.resolveNative('40000047',null,switch1250).status,'AMBIGUOUS');
});

test('only source-proven SAME_PUBLIC_ENTITY alias; conflict fails closed',()=>{
  const aliasRef={kind:'ITEM',primaryId:'40000048'};
  const verified={ref:aliasRef,type:'SAME_PUBLIC_ENTITY',evidence:'CONFIRMED',sourceRef:'native-static-proof'};
  const reg=createSharedEntityRegistry([record(item,{aliases:[
    verified,
    {ref:{kind:'ITEM',primaryId:'40000049'},type:'SAME_PUBLIC_ENTITY',evidence:'HYPOTHESIS'},
    {ref:{kind:'QUEST',primaryId:'40000050'},type:'SAME_PUBLIC_ENTITY',evidence:'CONFIRMED',sourceRef:'wrong-type'},
    {ref:{kind:'ITEM',primaryId:'40000051'},type:'RELATED_DISTINCT_ENTITY',evidence:'CONFIRMED',sourceRef:'not-alias'}
  ]})]);
  const result=reg.resolve(aliasRef,switch1250);
  assert.equal(result.status,'FOUND');
  assert.equal(result.ref.primaryId,item.primaryId);
  assert.equal(result.alias,true);
  for (const id of ['40000049','40000050','40000051'])
    assert.equal(reg.resolve({kind:'ITEM',primaryId:id},switch1250).status,'NOT_FOUND');
  const hijack=createSharedEntityRegistry([record(item,{aliases:[verified]}),record(aliasRef)]);
  assert.equal(hijack.resolve(aliasRef,switch1250).status,'AMBIGUOUS');
});

test('candidate 8-locale P/S path denies numeric slug, unknown locale and community UUID',()=>{
  for (const locale of ENTITY_LOCALES) {
    assert.equal(nativeEntityPath(item,locale),'/' + locale + '/40000047/');
    assert.equal(nativeEntityPath(child,locale,{base:'/Wand',slug:'fruit-tree'}),
      '/Wand/' + locale + '/40000047/900001/fruit-tree/');
  }
  assert.equal(nativeEntityPath(item,'ru'),null);
  assert.equal(nativeEntityPath(item,'en',{slug:'234'}),null);
  assert.equal(nativeEntityPath(item,'en',{slug:'My Item'}),null);
  assert.equal(nativeEntityPath(item,'en',{base:'../../private'}),null);
  assert.equal(nativeEntityPath({kind:'PRESET',primaryId:'custom-preset'},'en'),null);
  assert.equal(nativeEntityPath({kind:'ITEM',primaryId:'0'},'en'),null);
});

test('verified locale string, marked English fallback, no inferred translations',()=>{
  const names={en:{value:'Apple',verified:true},ja:{value:'りんご',verified:true},
    fr:{value:'Pomme',verified:false}};
  assert.deepEqual(resolveVerifiedLabel(names,'ja'),{
    status:'FOUND',value:'りんご',sourceLocale:'ja',fallback:false
  });
  assert.deepEqual(resolveVerifiedLabel(names,'fr'),{
    status:'FALLBACK',value:'Apple',sourceLocale:'en',fallback:true
  });
  assert.equal(resolveVerifiedLabel({ja:{value:'日本語',verified:true}},'de').status,'UNAVAILABLE');
  assert.equal(resolveVerifiedLabel(names,'ru').status,'UNAVAILABLE');
  assert.equal(resolveVerifiedLabel({en:{value:'Generated string',verified:false}},'en').status,'UNAVAILABLE');
});
