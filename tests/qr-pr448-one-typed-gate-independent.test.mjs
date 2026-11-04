import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeEntityRef,createSharedEntityRegistry,makeSourceScope}
 from '../src/lib/entity/shared-entity-identity.mjs';
const gate=readFileSync('src/lib/foundation/SharedTypedEntityGate.svelte','utf8');
const scope=makeSourceScope({platform:'Nintendo Switch',fullVersion:'1.25.0',
 bid:'52BD625D9B4E0053',schema:624,dlc:[]});
test('QR448 actual 06 PRODUCT parser is the one source, no duplicate regex/registry or positive rights',()=>{
 assert.match(gate,/import \{ makeEntityRef \} from '\$lib\/entity\/shared-entity-identity\.mjs'/);
 assert.match(gate,/function permittedRequestShape/);
 assert.match(gate,/function permittedCompositeShape/);
 for(const bad of ['parseSharedPrimaryId','createSharedEntityRegistry','sourceScope=','fetch(', 'localStorage','getLocalSaveSessionBridge']){
  assert.equal(gate.includes(bad),false,bad);
 }
 for(const attr of ['data-public-indexable="false"','data-writer="off"','data-provider="off"',
  'data-alias-resolved="false"','data-personal-state="unknown"','noindex,nofollow']){
  assert.ok(gate.includes(attr),attr);
 }
 const registry=createSharedEntityRegistry([]);
 const p=makeEntityRef({kind:'ITEM',primaryId:'40000047'});
 assert.equal(p.primaryId,'40000047');
 assert.equal(registry.resolveNative('40000047',null,scope).status,'NOT_FOUND');
 console.log('QR448_SINGLE_PRODUCT_TYPED_ENTITY_REF_NO_DUPLICATE_IDENTITY_NO_PUBLIC_PASS');
});
test('QR448 equal numeric P/S parses as a shape but no native specialization, relation or canonical',()=>{
 const shape=makeEntityRef({kind:'ITEM',primaryId:'40000047',secondaryId:'40000047'});
 assert.equal(shape.secondaryId,'40000047');
 assert.equal(createSharedEntityRegistry([]).resolveNative('40000047','40000047',scope).status,'NOT_FOUND');
 assert.match(gate,/permittedCompositeShape\(primaryId,secondaryId\)/);
 assert.doesNotMatch(gate,/primaryId\s*!==\s*secondaryId/);
 assert.doesNotMatch(gate,/rel="canonical"|hreflang|<img|<picture/);
 for(const kind of ['QUEST','CREATOR','WORK','PRESET']){
  const ref=makeEntityRef({kind,primaryId:kind==='QUEST'?'12345':kind.toLowerCase()+'-unconfirmed'});
  assert.equal(ref.kind,kind);
 }
 console.log('QR448_EQUAL_P_S_SYNTAX_IS_NOT_NATIVE_OR_PUBLIC_AUTHORITY_PASS');
});
