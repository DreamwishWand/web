import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeEntityRef, createSharedEntityRegistry, entityRefKey,
  makeSourceScope, sameSourceScope, nativeEntityPath, ENTITY_LOCALES }
  from '../src/lib/entity/shared-entity-identity.mjs';

const v1250={platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624,dlc:[]};
const v1253={platform:'Nintendo Switch',fullVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626,dlc:[]};
const item={kind:'ITEM',primaryId:'40000047'},quest={kind:'QUEST',primaryId:'40000047'};
const rec=(ref,extra={})=>({ref,sourceScope:v1250,visibility:'PUBLIC',publicEligible:true,indexable:false,...extra});

test('04QR combined same entity authority; version, typed collision, duplicate and withheld aliases',()=>{
 const reg=createSharedEntityRegistry([
  rec(item),rec(quest),
  rec({kind:'ITEM',primaryId:'40000048'},{publicEligible:false,indexable:true}),
  rec({kind:'ITEM',primaryId:'40000049'},{aliases:[{type:'SAME_PUBLIC_ENTITY',ref:{kind:'ITEM',primaryId:'40000050'},evidence:'HYPOTHESIS',sourceRef:'untrusted'}]}),
  rec({kind:'WORK',primaryId:'private-work-1'},{visibility:'PRIVATE',publicEligible:true,indexable:true,sourceScope:null})
 ]);
 assert.notEqual(entityRefKey(item),entityRefKey(quest));
 assert.equal(reg.resolveNative('40000047',null,v1250).status,'AMBIGUOUS');
 assert.equal(reg.resolve(item,v1253).status,'NOT_FOUND');
 assert.equal(reg.resolve(item,v1253,{publicOnly:false}).status,'VERSION_MISMATCH');
 assert.equal(reg.resolve({kind:'ITEM',primaryId:'40000048'},v1250).status,'NOT_FOUND');
 assert.equal(reg.resolve({kind:'ITEM',primaryId:'40000050'},v1250).status,'NOT_FOUND');
 assert.equal(reg.resolve({kind:'WORK',primaryId:'private-work-1'}).status,'NOT_FOUND');
 assert.equal(reg.resolve({kind:'WORK',primaryId:'private-work-1'},null,{publicOnly:false}).status,'PRIVATE');
 const duplicate=createSharedEntityRegistry([rec(item),rec(item)]);
 assert.equal(duplicate.resolveNative('40000047',null,v1250).status,'AMBIGUOUS');
});

test('04QR forged P/S and unsupported namespace, source platform and canonical path remain denied',()=>{
 for(const key of ['0001','+1','1e3','0','-1','9007199254740993']){
  assert.throws(()=>makeEntityRef({kind:'QUEST',primaryId:key}),/PRIMARY_ID_INVALID/);
 }
 const p={kind:'ITEM',primaryId:'40000047',secondaryId:'900001'};
 const reg=createSharedEntityRegistry([rec(p,{relations:[{
  type:'SPECIALIZATION',source:item,target:p,evidence:'HYPOTHESIS',sourceRef:'user-guess'
 }]})]);
 assert.equal(reg.resolve(p,v1250).status,'NOT_FOUND');
 assert.equal(nativeEntityPath({kind:'WORK',primaryId:'work-123'},'ja'),null);
 assert.equal(nativeEntityPath(item,'ja',{base:'../../other'}),null);
 assert.equal(nativeEntityPath(item,'ru'),null);
 assert.equal(ENTITY_LOCALES.length,8);
 assert.equal(sameSourceScope(v1250,v1253),false);
 assert.throws(()=>makeSourceScope({...v1250,bid:'UNKNOWN'}),/SWITCH_BID_INVALID/);
 assert.throws(()=>makeSourceScope({...v1250,schema:'624'}),/SCOPE_INVALID/);
});

test('04QR current-main composite routes are source-unverified, no hosted prerender or fake writer',()=>{
 const page=readFileSync('src/lib/foundation/SharedTypedEntityGate.svelte','utf8');
 const identity=readFileSync('src/lib/entity/shared-entity-identity.mjs','utf8');
 assert.match(page,/data-typed-entity-gate="closed"/);
 assert.match(page,/data-personal-state="unknown"/);
 assert.match(page,/data-writer="off"/);
 assert.match(page,/data-provider="off"/);
 assert.match(page,/data-public-indexable="false"/);
 assert.match(page,/noindex,nofollow/);
 assert.doesNotMatch(page,/localStorage|postMessage\(|fetch\(|publishWork\(|createObjectURL/);
 assert.match(identity,/wand.shared-entity.identity@1/);
 for(const path of [
  'src/routes/entity/[kind]/[primary]/+page.ts',
  'src/routes/[locale=wandLocale]/entity/[kind]/[primary]/+page.ts',
  'src/routes/[primary=sharedId]/[secondary=sharedId]/+page.ts',
  'src/routes/[locale=wandLocale]/[primary=sharedId]/[secondary=sharedId]/+page.ts'
 ])assert.match(readFileSync(path,'utf8'),/prerender\s*=\s*false/);
 console.log('QR432_MAIN_COMPOSITE_PRIVATE_NOINDEX_WRITER_OFF_PASS');
});
