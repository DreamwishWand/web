import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SOURCE150_OWNER_ADAPTER_ENABLED,SOURCE150_OWNER_SERVICE_CONTRACT,
 SOURCE150_MISSING_AUTHORITY,adaptSource150OwnerEnvelope,classifySource150OwnerHttpFixture
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import {
 SOURCE151_PREGRANT_ADAPTER_ENABLED,inspectSource151PregrantEnvelope,
 inspectSource151PregrantHttpFixture,createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import {PRIVATE_OWNER_BACKEND_ACTIVATED,createPrivateOwnerServiceConsumer} from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';
import {OWNER_MANAGEMENT_ENABLED} from '../src/lib/dreamsnaps/owner-management.js';
const raw=(p)=>fs.readFileSync(p);
const blob=(p)=>{const b=raw(p);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')};
const edge=raw('supabase/functions/community-dreamsnap-owner/index.ts').toString();
const sql=raw('supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql').toString();
const ctx=id=>({workId:id,requestGeneration:44,latestGeneration:44});
const wrapped=(operation,data)=>({ok:true,operation,contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data});
const headers=()=>({'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store','surrogate-control':'no-store',vary:'Authorization, Origin'});
const isClosed=x=>{assert.equal(x.snapshot,null);assert.equal(x.ownerReadVerified,false);assert.equal(x.actionsEnabled,false);assert.equal(x.autoRetry,false);};
test('FULL152 combined immutable Source152 SQL + JWT-bound Edge + both typed adapters pinned and private',()=>{
 const pin=[
 ['supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql','cd297f48111afbb315651c6cb7e911afb1bcc03d'],
 ['supabase/migrations/20261028000040_x05_private_pregrant_policy_receipt_v1.sql','451735e05b6a18c826851a51000909c40c42bb9f'],
 ['supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql','85e9de1874ca489133fd39be522f57ee1cfac6ab'],
 ['supabase/functions/community-dreamsnap-owner/index.ts','5539382678250ebdc563ca9a36b574d6a9bb5df0'],
 ['src/lib/dreamsnaps/source150-owner-service-adapter.js','e7f15f866e9383af291a234e57cc84a160cee167'],
 ['src/lib/dreamsnaps/source151-private-pregrant-adapter.js','274655aef0cf1c37e85be1649295d6d31a1dc02c']
 ];
 for(const [path,digest] of pin)assert.equal(blob(path),digest,path);
 assert.match(sql,/v_response:=jsonb_strip_nulls\(jsonb_build_object\(/);
 assert.match(edge,/withSupabase\(\{auth:'user'\}/);
 assert.match(edge,/v\.operation==='register'/);
 for(const h of ["'Cache-Control':'private, no-store, max-age=0'","'CDN-Cache-Control':'no-store'","'Surrogate-Control':'no-store'","'Vary':'Authorization, Origin'"])assert.ok(edge.includes(h),h);
 assert.match(raw('supabase/config.toml').toString(),/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
 assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);
 assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
 assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 for(const v of ['work.ownerAccountId','grant.mediaId','deletion.purgeScopeComplete'])
  assert.ok(SOURCE150_MISSING_AUTHORITY.some(s=>s.includes(v)),v);
});
test('independent no-store policy and signed-HTTP-still-inert negative suite',async()=>{
 let network=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{network++;throw Error('No actual backend network allowed')};
 try {
  const c=createSource151PregrantConsumer(),d=createPrivateOwnerServiceConsumer();
  assert.equal((await c.pregrant({workId:'11111111-1111-4111-8111-111111111111'})).status,'BACKEND_UNAVAILABLE');
  assert.equal((await c.acceptGrant({expectedRowVersion:0,expectedAuthorizationEpoch:0})).firstGrantExecutable,false);
  assert.equal((await d.read({workId:'11111111-1111-4111-8111-111111111111'})).status,'BACKEND_UNAVAILABLE');
  assert.equal((await d.mutate({workId:'11111111-1111-4111-8111-111111111111'})).persisted,false);
  assert.equal(network,0);
 } finally {globalThis.fetch=original}
});
if (process.env.QR_CTRL41_REAL_PG_BRIDGE) {
 test('actual real FULL152 registered work crosses SQL PreGrant and OwnerRead into both frozen typed WEB adapters',()=>{
  const v=JSON.parse(fs.readFileSync(process.env.QR_CTRL41_REAL_PG_BRIDGE,'utf8'));
  assert.equal(v.syntheticLocalOnly,true);
  for (const [kind,data] of Object.entries({OriginalCompetition:v.original,PostEventCreation:v.post})) {
   const {register:reg,pregrant:pre,owner}=data;
   assert.equal(reg.kind,kind);
   assert.equal(owner.workId,reg.workId);assert.equal(owner.kind,kind);
   assert.equal(pre.workId,reg.workId);assert.equal(pre.photoRevisionId,reg.photoRevisionId);
   assert.equal(pre.photoMediaId,reg.photoMediaId);assert.equal(pre.challengeId,reg.challengeId);
   assert.equal(owner.photoRevisionId,reg.photoRevisionId);assert.equal(owner.photoMediaId,reg.photoMediaId);
   assert.equal(reg.publicActivationAllowed,false);assert.equal(reg.storageValidatedBySource152,false);
   assert.equal(reg.officialChallengePhaseVerified,false);
   assert.ok(new Set([reg.workId,reg.photoRevisionId,reg.photoMediaId]).size===3);
   if(kind==='PostEventCreation'){
    assert.equal(Object.hasOwn(reg,'entryId'),false);assert.equal(Object.hasOwn(pre,'entryId'),false);
    assert.equal(Object.hasOwn(owner,'entryId'),false);
   }else {
    assert.ok(reg.entryId);assert.equal(pre.entryId,reg.entryId);assert.equal(owner.entryId,reg.entryId);
    assert.equal(pre.frozenEntryRevisionId,reg.photoRevisionId);
   }
   const c=ctx(reg.workId),pe=wrapped('pregrant',pre),oe=wrapped('read',owner);
   const pr=inspectSource151PregrantEnvelope(pe,c);
   assert.equal(pr.status,'NEED_POLICY_ARTIFACT',kind);
   assert.equal(pr.policyReceipt,null);assert.equal(pr.firstGrantExecutable,false);
   isClosed(pr);
   const or=adaptSource150OwnerEnvelope(oe,c);
   assert.equal(or.status,'NEED_BACKEND_PROJECTION',kind);
   isClosed(or);
   assert.equal(or.missingAuthority.length,SOURCE150_MISSING_AUTHORITY.length);
   const hp=inspectSource151PregrantHttpFixture({status:200,headers:headers(),body:pe},c);
   const ho=classifySource150OwnerHttpFixture({status:200,headers:headers(),body:oe},c);
   assert.equal(hp.status,'NEED_POLICY_ARTIFACT');
   assert.equal(ho.status,'NEED_BACKEND_PROJECTION');
   isClosed(hp);isClosed(ho);
   // Independent negatives on the **actual PG result**, no invented input payload.
   for(const extra of [
    {...owner,ownerAccountId:reg.workId},
    {...owner,mediaSignerUrl:'https://invalid.example/signed'},
    {...owner,erasure:{...owner.erasure,physicalPurgeVerified:true}},
    {...owner,capabilities:{...owner.capabilities,publicMedia:true}}
   ]){
    const r=adaptSource150OwnerEnvelope(wrapped('read',extra),c);
    assert.equal(r.status,'SOURCE_CONTRACT_REJECTED');isClosed(r);
   }
   const spoofed=adaptSource150OwnerEnvelope(oe,{...c,workId:reg.photoRevisionId});
   assert.equal(spoofed.status,'SOURCE_CONTRACT_REJECTED');isClosed(spoofed);
   assert.equal(adaptSource150OwnerEnvelope(oe,{...c,latestGeneration:45}).status,'STALE_RESPONSE');
   assert.equal(inspectSource151PregrantEnvelope(pe,{...c,latestGeneration:45}).status,'STALE_RESPONSE');
   assert.equal(inspectSource151PregrantEnvelope(wrapped('pregrant',{...pre,entryId:null}),c).status,'SOURCE_CONTRACT_REJECTED');
   assert.equal(inspectSource151PregrantEnvelope(wrapped('pregrant',{...pre,policyReceipt:{approved:true}}),c).status,'SOURCE_CONTRACT_REJECTED');
   for(const status of [409,412]){
    assert.equal(classifySource150OwnerHttpFixture({status},c).status,'REFRESH_REQUIRED');
    assert.equal(inspectSource151PregrantHttpFixture({status},c).status,'REFRESH_REQUIRED');
   }
   for(const status of [401,403,404,410,503]){
    assert.equal(classifySource150OwnerHttpFixture({status},c).status,'BACKEND_UNAVAILABLE');
    assert.equal(inspectSource151PregrantHttpFixture({status},c).status,'BACKEND_UNAVAILABLE');
   }
   assert.equal(classifySource150OwnerHttpFixture({status:200,headers:{...headers(),'cache-control':'public, max-age=300'},body:oe},c).status,'UNSAFE_CACHE_POLICY');
   assert.equal(inspectSource151PregrantHttpFixture({status:200,headers:{...headers(),vary:'Origin'},body:pe},c).status,'UNSAFE_CACHE_POLICY');
   assert.equal(owner.rowVersion,2);assert.equal(owner.authorizationEpoch,2);
   assert.equal(owner.imageGrant.consentRevision,1);assert.equal(owner.imageGrant.state,'withdrawn');
   assert.equal(owner.erasure.state,'PUBLIC_DISABLED');assert.equal(owner.erasure.physicalPurgeVerified,false);
  }
 });
}
