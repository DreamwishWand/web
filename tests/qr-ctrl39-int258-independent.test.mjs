import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SOURCE150_OWNER_SERVICE_CONTRACT,SOURCE150_OWNER_ADAPTER_ENABLED,
 SOURCE150_MISSING_AUTHORITY,adaptSource150OwnerEnvelope,
 classifySource150OwnerHttpFixture
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import {
 SOURCE151_PREGRANT_DATA_CONTRACT,SOURCE151_PREGRANT_ADAPTER_ENABLED,
 inspectSource151PregrantEnvelope,inspectSource151PregrantHttpFixture,
 createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const w='11111111-1111-4111-8111-111111111111';
const creator='22222222-2222-4222-8222-222222222222',ch='33333333-3333-4333-8333-333333333333';
const rev='44444444-4444-4444-8444-444444444444',media='55555555-5555-4555-8555-555555555555';
const context=()=>({workId:w,requestGeneration:48,latestGeneration:48});
const pre=()=>({ok:true,operation:'pregrant',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:{
 contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT,state:'NEED_POLICY_ARTIFACT',
 ownerAuthorized:true,workId:w,kind:'PostEventCreation',
 creatorProfileId:creator,challengeId:ch,photoRevisionId:rev,photoMediaId:media,
 authenticatedAccountBound:true,workPhotoBindingVerified:true,mediaOwnershipVerified:true,
 originalImageImmutable:true,expectedRowVersion:0,expectedAuthorizationEpoch:0,grantRecorded:false,
 publicActivationAllowed:false,officialChallengePhaseVerified:false,grantAvailable:false,
 erasure:{state:'NOT_REQUESTED',physicalPurgeVerified:false,publicDisabled:true}
}});
const owner=()=>({contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
 sourceContractVersion:'wand.dreamsnaps.owner-management@1',
 workId:w,kind:'PostEventCreation',creatorProfileId:creator,challengeId:ch,
 photoRevisionId:rev,photoMediaId:media,conceptRevisionId:rev,concept:'Independent',
 rowVersion:2,authorizationEpoch:2,ownerAuthorized:true,accountState:'active',
 identityState:'active',retired:false,privacySuppressed:false,moderationAllowed:true,
 imageGrant:{policyVersionText:'v901',policyVersionOrdinal:901,policyDigest:'b'.repeat(64),
 consentRevision:1,workId:w,state:'withdrawn'},
 erasure:{state:'PUBLIC_DISABLED',revision:2,publicDisabled:true,physicalPurgeVerified:false,providerStatus:'not_requested'},
 capabilities:{ownerRead:true,grant:false,concept:false,withdraw:false,deleteRequest:false,publicDetail:false,publicMedia:false,publish:false,verifyPurge:false}
});
const envelope=(d=owner())=>({ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:d});
test('combined Head still has exact frozen Source151 SQL, Edge and WEB adapters, not Source152',()=>{
 const expected=[
 ['supabase/migrations/20261028000040_x05_private_pregrant_policy_receipt_v1.sql','451735e05b6a18c826851a51000909c40c42bb9f'],
 ['supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql','85e9de1874ca489133fd39be522f57ee1cfac6ab'],
 ['supabase/functions/community-dreamsnap-owner/index.ts','1a05cdc540a45fe1b1656d64a151d1c1ca28c8be'],
 ['src/lib/dreamsnaps/source150-owner-service-adapter.js','e7f15f866e9383af291a234e57cc84a160cee167'],
 ['src/lib/dreamsnaps/source151-private-pregrant-adapter.js','274655aef0cf1c37e85be1649295d6d31a1dc02c']
 ];
 for(const [p,blob] of expected)assert.equal(hash(readFileSync(p,'utf8')),blob,p);
 assert.equal(readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).length,151);
 assert.equal(readdirSync('supabase/migrations').some(x=>x.includes('first_work_media_bootstrap')),false);
});
test('FULL151 pregrant fixture stays unconsented, first CAS zero and typed consumer fail-closed',()=>{
 const r=inspectSource151PregrantEnvelope(pre(),context());
 assert.equal(r.status,'NEED_POLICY_ARTIFACT');assert.equal(r.snapshot,null);
 assert.equal(r.firstGrantExecutable,false);assert.equal(r.creatorGrantRecorded,false);
 assert.equal(r.policyReceipt,null);assert.equal(r.autoRetry,false);
 assert.equal(inspectSource151PregrantEnvelope({...pre(),data:{...pre().data,policyReceipt:{approved:true}}},context()).status,'SOURCE_CONTRACT_REJECTED');
 assert.equal(inspectSource151PregrantEnvelope(pre(),{...context(),requestGeneration:47}).status,'STALE_RESPONSE');
});
test('Source150 owner schema maps structurally but never supplies absent trusted owner/media/purge provenance',()=>{
 const r=adaptSource150OwnerEnvelope(envelope(),context());
 assert.equal(r.status,'NEED_BACKEND_PROJECTION');assert.equal(r.snapshot,null);
 assert.equal(r.ownerReadVerified,false);assert.equal(r.actionsEnabled,false);
 for(const key of ['work.ownerAccountId','authority.photoBindingVerified','grant.mediaId','deletion.purgeScopeComplete'])
  assert.ok(SOURCE150_MISSING_AUTHORITY.some(x=>x.includes(key)),key);
 for(const forged of [
 {...owner(),ownerAccountId:w},{...owner(),signedUrl:'https://example.invalid'},
 {...owner(),imageGrant:{...owner().imageGrant,consentRevision:3}},
 {...owner(),erasure:{...owner().erasure,physicalPurgeVerified:true}}
 ])assert.equal(adaptSource150OwnerEnvelope(envelope(forged),context()).status,'SOURCE_CONTRACT_REJECTED');
});
test('source-only cached/stale/replay/401/409/412 rejection and private no-store',()=>{
 const h={'cache-control':'private,no-store','cdn-cache-control':'no-store','surrogate-control':'no-store',vary:'Authorization, Origin'};
 assert.equal(classifySource150OwnerHttpFixture({status:200,headers:h,body:envelope()},context()).status,'NEED_BACKEND_PROJECTION');
 assert.equal(inspectSource151PregrantHttpFixture({status:200,headers:h,body:pre()},context()).status,'NEED_POLICY_ARTIFACT');
 for(const status of [409,412]){
  assert.equal(classifySource150OwnerHttpFixture({status},context()).status,'REFRESH_REQUIRED');
  assert.equal(inspectSource151PregrantHttpFixture({status},context()).status,'REFRESH_REQUIRED');
 }
 for(const status of [401,403,404,410,503]){
  assert.equal(inspectSource151PregrantHttpFixture({status},context()).status,'BACKEND_UNAVAILABLE');
 }
 assert.equal(classifySource150OwnerHttpFixture({status:200,headers:{...h,'cache-control':'public,max-age=3600'},body:envelope()},context()).status,'UNSAFE_CACHE_POLICY');
});
test('mixed integration must not enable any network Publisher/Signer/Native Apply activity',async()=>{
 assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
 const c=createSource151PregrantConsumer();let calls=0;const old=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;throw Error('Forbidden live fetch')};
 try{
  assert.equal((await c.pregrant({workId:w})).status,'BACKEND_UNAVAILABLE');
  assert.equal((await c.acceptGrant({workId:w})).firstGrantExecutable,false);
 }finally{globalThis.fetch=old}
 assert.equal(calls,0);
});
if(process.env.QR_CTRL39_PG_TO_WEB_JSON){
 test('independent real FULL151 PostgreSQL OwnerRead after withdrawal is fed into actual WEB252 adapter: DENY positive',()=>{
  const bridge=JSON.parse(readFileSync(process.env.QR_CTRL39_PG_TO_WEB_JSON,'utf8'));
  assert.equal(bridge.envelope.operation,'read');
  assert.equal(bridge.envelope.data.rowVersion,2);
  assert.equal(bridge.envelope.data.authorizationEpoch,2);
  assert.equal(bridge.envelope.data.imageGrant.consentRevision,1);
  assert.equal(bridge.envelope.data.imageGrant.state,'withdrawn');
  const result=adaptSource150OwnerEnvelope(bridge.envelope,{workId:bridge.workId,requestGeneration:13,latestGeneration:13});
  assert.equal(result.status,'NEED_BACKEND_PROJECTION');assert.equal(result.snapshot,null);
  assert.equal(result.ownerReadVerified,false);assert.equal(result.actionsEnabled,false);
  assert.equal(result.liveBackendEnabled,false);assert.equal(result.autoRetry,false);
 });
}
