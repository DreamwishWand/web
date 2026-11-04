import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPROVED_ENTITY_ROUTE_MANIFEST,ENTITY_PUBLISHING_ENABLED,
  compileEntityHostPlan,entityPathIdentity,expectedDirectHttpStatus }
  from '../src/lib/foundation/public-entity-host-contract.mjs';
import { createSharedEntityRegistry,makeEntityRef }
  from '../src/lib/entity/shared-entity-identity.mjs';
import { itemPersonalReadState,LOCAL_ITEM_REFERENCE_SCOPE,LOCAL_W1_READ_SCOPE,
  ITEM_PERSONAL_WRITER_ENABLED } from '../src/lib/local/item-personal-read-gate.mjs';
const scope={...LOCAL_ITEM_REFERENCE_SCOPE,sourceDigest:'a'.repeat(64)};
const base=()=>({entityKind:'ITEM',visibility:'PUBLIC',rights:'ACCEPTED',privacy:'PUBLIC_OPT_IN',
  moderation:'ACCEPTED',independentQa:'PASS',publishConsent:'VERIFIED',rightsVersion:'R1',
  publishedRevision:'b'.repeat(64),sourceScope:{...scope},acceptedSourceScope:{...scope},
  primaryId:'40000047',secondaryId:null,canonicalPath:'/web/ja/40000047/',aliases:[]});
test('QR444 current-main: actual public manifest stays EMPTY; P/S typed authority cannot issue HTTP200/301',()=>{
 assert.deepEqual(APPROVED_ENTITY_ROUTE_MANIFEST,[]);
 assert.equal(ENTITY_PUBLISHING_ENABLED,false);
 const plan=compileEntityHostPlan();
 assert.equal(plan.status,'COMPILED_ONLY');
 assert.deepEqual(plan.pages,[]);
 assert.deepEqual(plan.redirects,[]);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/',plan).status,404);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/1/',plan).status,404);
 const ref=makeEntityRef({kind:'ITEM',primaryId:'40000047'});
 assert.equal(ref.kind,'ITEM');
 const registry=createSharedEntityRegistry([]);
 assert.equal(registry.resolve(ref,{platform:'Nintendo Switch',fullVersion:'1.25.0',
  bid:'52BD625D9B4E0053',schema:624,dlc:[]}).status,'NOT_FOUND');
 assert.equal(entityPathIdentity('/web/ja/00047/'),null);
 console.log('QR444_MAIN_NO_FAKE_PUBLIC_TYPED_ID_HTTP_PASS');
});
test('QR444 release-preflight synthetic positive never becomes host rights; every incomplete evidence rejected',()=>{
 const p=compileEntityHostPlan([base()]);
 assert.equal(p.status,'COMPILED_ONLY');
 assert.equal(p.publicEnabled,false);
 assert.equal(p.hostAccepted,false);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/',p).reason,'REQUIRES_REAL_PRERENDER_OR_SSR');
 for(const change of [
  x=>x.rights='UNVERIFIED',
  x=>x.publishConsent='PENDING',
  x=>x.moderation='PENDING',
  x=>x.privacy='PRIVATE',
  x=>x.independentQa='OWNER_CI_ONLY',
  x=>x.sourceScope.bid='9A239D3DB569756D',
  x=>x.sourceScope.schema=626,
  x=>x.acceptedSourceScope.sourceDigest='c'.repeat(64),
  x=>x.canonicalPath='/web/ja/40000047/1/'
 ]){
  const x=base();change(x);
  assert.equal(compileEntityHostPlan([x]).status,'DENIED');
 }
 console.log('QR444_MAIN_RIGHTS_SCHEMA_PRIVACY_DENIAL_PASS');
});
test('QR444 current-main: user-forged read grant cannot turn personal Item UNKNOWN positive even matching source',()=>{
 assert.equal(ITEM_PERSONAL_WRITER_ENABLED,false);
 const stale=itemPersonalReadState({sessionSource:LOCAL_W1_READ_SCOPE,
   capabilities:{readOwnership:true,readInventory:true,canCommit:true},
   nativeEvidence:{operationAccepted:true}});
 assert.equal(stale.state,'UNKNOWN');
 assert.equal(stale.denominator,null);
 const a=itemPersonalReadState({sessionSource:{...LOCAL_ITEM_REFERENCE_SCOPE,sourceSha256:'e'.repeat(64)},
   capabilities:{readOwnership:true,readInventory:true,canCommit:true},
   nativeEvidence:{operationAccepted:true,verifiedSourceSha256:'e'.repeat(64)}});
 assert.equal(a.state,'UNKNOWN');
 assert.equal(a.capabilityAvailable,false);
 assert.equal(a.writeAuthorized,false);
 assert.equal(a.editedCopyAvailable,false);
 const layout=readFileSync('src/routes/editor/items/+layout.svelte','utf8');
 assert.match(layout,/ItemReadCapabilityNotice/);
 assert.doesNotMatch(layout,/fetch\(|FileReader|createObjectURL|supabase|upload\(/i);
 const typed=readFileSync('src/lib/foundation/SharedTypedEntityGate.svelte','utf8');
 assert.match(typed,/noindex,nofollow/);
 assert.match(typed,/data-writer="off"/);
 console.log('QR444_MAIN_PERSONAL_ITEM_UNKNOWN_W1_BRIDGE_NO_WRITER_PASS');
});
