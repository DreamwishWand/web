// 08 WEB new-only safe presentation tests. 06 PRODUCT PR396 owns the sole typed EntityRef/P-S/Alias model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { SHARED_TYPED_COPY, sharedTypedCopy } from '../src/lib/foundation/shared-typed-entity-copy.mjs';
import { parseSharedPrimaryId } from '../src/lib/entity/shared-catalog-detail.mjs';
import { makeEntityRef, createSharedEntityRegistry } from '../src/lib/entity/shared-entity-identity.mjs';
const read=path=>readFileSync(path,'utf8');

test('accepted Item source untouched and numeric P/S shapes do not infer a positive specialization',()=>{
  assert.equal(parseSharedPrimaryId('40000047'),40000047);
  for (const raw of ['0','0001','1e7','-1','40000047/8','9007199254740992'])assert.equal(parseSharedPrimaryId(raw),null);
  assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/noindex,follow/);
  assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/SharedCatalogDiscovery/);
  assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/addCatalogEntityToMoodboard/);
  assert.match(read('src/lib/entity/shared-catalog-detail.mjs'),/52BD625D9B4E0053/);
});
test('eight locale copy for Quest Creator Work Preset and composite preview never claims verified details',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(SHARED_TYPED_COPY).sort(),locales.sort());
 for(const l of locales){
   const c=sharedTypedCopy(l);
   for(const key of ['preview','unavailable','notVerified','invalid','identity','version','relations','visibility','requested','notVerifiedLabel','noSource','noRelations','private','boundary','back','composite','unknown']){
     assert.equal(typeof c[key],'string',l+'/'+key);
     assert.ok(c[key].length>=2,l+'/'+key);
   }
   for(const k of ['ITEM','QUEST','CREATOR','WORK','PRESET'])assert.equal(typeof c.kinds[k],'string');
 }
 assert.equal(sharedTypedCopy('unsupported'),SHARED_TYPED_COPY.en);
});
test('one true EntityRef model stays with PRODUCT; web shell is nonpositive and has no second registry',()=>{
 const g=read('src/lib/foundation/SharedTypedEntityGate.svelte');
 for(const token of [
  'data-typed-entity-gate="closed"','data-public-indexable="false"','data-writer="off"',
  'data-provider="off"','data-relations-verified="false"','data-alias-resolved="false"',
  'data-personal-state="unknown"','noindex,nofollow',
  'permittedRequestShape','permittedCompositeShape','makeEntityRef'
 ]) assert.ok(g.includes(token),token);
 for(const forbidden of ['shared-typed-entity-contract.mjs','src/lib/foundation/shared-typed-entity-contract.mjs',
  'getLocalSaveSessionBridge','localStorage','fetch(','publishWork(','ownedCount','createObjectURL']){
   assert.ok(!g.includes(forbidden),forbidden);
 }
 assert.match(g,/PR396/);
 for(const path of [
  'src/routes/entity/[kind]/[primary]/+page.ts',
  'src/routes/[locale=wandLocale]/entity/[kind]/[primary]/+page.ts',
  'src/routes/[primary=sharedId]/[secondary=sharedId]/+page.ts',
  'src/routes/[locale=wandLocale]/[primary=sharedId]/[secondary=sharedId]/+page.ts'
 ]) assert.match(read(path),/prerender\s*=\s*false/);
});
test('no new public canonical URL, alias redirect, rights/Media or Writer route',()=>{
 const g=read('src/lib/foundation/SharedTypedEntityGate.svelte');
 const allRoutes=[
  'src/routes/entity/[kind]/[primary]/+page.svelte',
  'src/routes/[locale=wandLocale]/entity/[kind]/[primary]/+page.svelte',
  'src/routes/[primary=sharedId]/[secondary=sharedId]/+page.svelte',
  'src/routes/[locale=wandLocale]/[primary=sharedId]/[secondary=sharedId]/+page.svelte'
 ];
 for(const p of allRoutes){
  const c=read(p);
  assert.match(c,/SharedTypedEntityGate/);
  assert.doesNotMatch(c,/rel="canonical"|goto\(|redirect\(|fetch\(|localStorage|postMessage\(/);
 }
 assert.doesNotMatch(g,/rel="canonical"|hreflang|<img|<picture|srcset|<form/);
 assert.match(g,/noindex,nofollow/);
});

test('typed WEB gate uses only PRODUCT identity syntax; equal P/S is not positive authority',()=>{
  const g=read('src/lib/foundation/SharedTypedEntityGate.svelte');
  assert.match(g,/import \{ makeEntityRef \} from '\$lib\/entity\/shared-entity-identity\.mjs'/);
  assert.doesNotMatch(g,/parseSharedPrimaryId|primaryId\s*!==\s*secondaryId/);
  assert.doesNotMatch(g,/createSharedEntityRegistry|resolveNative\(/);
  const equal=makeEntityRef({kind:'ITEM',primaryId:'40000047',secondaryId:'40000047'});
  assert.equal(equal.secondaryId,'40000047');
  const registry=createSharedEntityRegistry([]);
  assert.equal(registry.resolveNative('40000047','40000047',{
    platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624,dlc:[]
  }).status,'NOT_FOUND');
  assert.match(g,/data-public-indexable="false"/);
  assert.match(g,/noindex,nofollow/);
});
