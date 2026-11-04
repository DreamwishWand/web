import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVED_ENTITY_ROUTE_MANIFEST,ENTITY_PUBLISHING_ENABLED,compileEntityHostPlan,expectedDirectHttpStatus,entityPathIdentity}
 from '../src/lib/foundation/public-entity-host-contract.mjs';
import {itemPersonalReadState,ITEM_PERSONAL_READ_ENABLED,ITEM_PERSONAL_WRITER_ENABLED,ITEM_PERSONAL_EDIT_ENABLED,LOCAL_ITEM_REFERENCE_SCOPE,LOCAL_W1_READ_SCOPE}
 from '../src/lib/local/item-personal-read-gate.mjs';
const scope={...LOCAL_ITEM_REFERENCE_SCOPE,sourceDigest:'d'.repeat(64)};
const approved=()=>({entityKind:'ITEM',visibility:'PUBLIC',rights:'ACCEPTED',privacy:'PUBLIC_OPT_IN',
 moderation:'ACCEPTED',independentQa:'PASS',publishConsent:'VERIFIED',rightsVersion:'R2',
 publishedRevision:'b'.repeat(64),sourceScope:{...scope},acceptedSourceScope:{...scope},
 primaryId:'40000047',secondaryId:null,canonicalPath:'/web/ja/40000047/',aliases:[]});
test('QR416 public manifest empty and any hypothetical host 200 is NOT real HTTP evidence',()=>{
 assert.equal(ENTITY_PUBLISHING_ENABLED,false);assert.deepEqual(APPROVED_ENTITY_ROUTE_MANIFEST,[]);
 const live=compileEntityHostPlan();
 assert.equal(live.status,'COMPILED_ONLY');assert.deepEqual(live.pages,[]);
 for(const path of ['/web/ja/40000047/','/web/ja/40000047/10001/','/web/ja/40000047/old-title/'])
  assert.equal(expectedDirectHttpStatus(path,live).status,404);
 const imagined=compileEntityHostPlan([approved()]);
 assert.equal(imagined.publicEnabled,false);assert.equal(imagined.hostAccepted,false);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/',imagined).reason,'REQUIRES_REAL_PRERENDER_OR_SSR');
 console.log('QR416_EMPTY_LIVE_MANIFEST_AND_HYPOTHETICAL_200_NOT_PUBLIC_PASS');
});
test('QR416 version, BID, private, unproven P/S, alias hijack and duplicate fail closed',()=>{
 const reject=change=>{const e=approved();change(e);assert.equal(compileEntityHostPlan([e]).status,'DENIED');};
 reject(e=>e.privacy='PRIVATE');
 reject(e=>e.rights='UNKNOWN');
 reject(e=>e.moderation='PENDING');
 reject(e=>e.independentQa='OWNER_CI_ONLY');
 reject(e=>e.sourceScope={...scope,schema:626});
 reject(e=>e.sourceScope={...scope,bid:'9A239D3DB569756D'});
 reject(e=>e.sourceScope={...scope,sourceDigest:'f'.repeat(64)});
 reject(e=>e.aliases=[{path:'/web/ja/40000047/old-title/',samePublicEntityProof:'SELF',sourceScope:scope}]);
 assert.equal(compileEntityHostPlan([approved(),approved()]).status,'DENIED');
 const specialized=approved();specialized.secondaryId='10001';specialized.canonicalPath='/web/ja/40000047/10001/';
 assert.equal(compileEntityHostPlan([specialized]).status,'DENIED');
 specialized.specializationEvidence='INDEPENDENT_PASS';
 assert.equal(compileEntityHostPlan([specialized]).status,'COMPILED_ONLY');
 for(const path of ['/web/ja/00047/','/web/ja/40000047/1e9/','/notweb/ja/40000047/'])
  assert.equal(entityPathIdentity(path),null);
 console.log('QR416_P_S_ALIAS_PRIVACY_EXACT_SOURCE_SCOPE_REJECTION_PASS');
});
test('QR416 forged client-owned Inventory capabilities cannot authorize value or writer',()=>{
 assert.equal(ITEM_PERSONAL_READ_ENABLED,false);
 assert.equal(ITEM_PERSONAL_EDIT_ENABLED,false);
 assert.equal(ITEM_PERSONAL_WRITER_ENABLED,false);
 const cap={readInventory:true,readOwnership:true,canCommit:true};
 const nativeEvidence={operationAccepted:true,verifiedSourceSha256:'c'.repeat(64)};
 for(const sessionSource of [null,LOCAL_W1_READ_SCOPE,
   {...LOCAL_ITEM_REFERENCE_SCOPE,sourceSha256:'c'.repeat(64)},
   {...LOCAL_ITEM_REFERENCE_SCOPE,sourceSha256:'c'.repeat(64),sourceDigest:'not-trusted'}]){
  const r=itemPersonalReadState({sessionSource,capabilities:cap,nativeEvidence});
  assert.equal(r.state,'UNKNOWN');assert.equal(r.capabilityAvailable,false);
  assert.equal(r.writeAuthorized,false);assert.equal(r.originalBackupAvailable,false);
  assert.equal(r.editedCopyAvailable,false);assert.equal(r.denominator,null);
 }
 console.log('QR416_FORGED_ITEM_SESSION_CLIENT_DOES_NOT_UNBLOCK_WRITER_PASS');
});
