import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SOURCE153_OWNER_PROJECTION_CONTRACT as SOURCE,
 PRIVATE_OWNER_CONSUMER_V2_CONTRACT as TARGET,
 SOURCE153_OWNER_V2_LIVE_ENABLED, SOURCE153_OWNER_V2_CAPABILITIES,
 decodeSource153OwnerConsumerV2, classifySource153OwnerHttpFixture
} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import { adaptSource150OwnerEnvelope, SOURCE150_OWNER_SERVICE_CONTRACT } from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import { SOURCE151_PREGRANT_ADAPTER_ENABLED } from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import { OWNER_MANAGEMENT_ENABLED } from '../src/lib/dreamsnaps/owner-management.js';
const headers={'cache-control':'private, no-store, max-age=0',
 'cdn-cache-control':'no-store','surrogate-control':'no-store','vary':'Authorization, Origin'};
const wrap=data=>({ok:true,operation:'authority',contractVersion:SOURCE,data});
const ctx=workId=>({workId,requestGeneration:13,latestGeneration:13});
test('isolated FULL153 includes the Source153 SQL+Edge, exact v2 decoder and no live output',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql','utf8');
 const edge=fs.readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
 const cfg=fs.readFileSync('supabase/config.toml','utf8');
 const candidate=JSON.parse(fs.readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.json','utf8'));
 assert.match(sql,/community_dreamsnap_x05_owner_authority_v2/);
 assert.match(sql,/p_expected_row_version/);
 assert.match(sql,/p_expected_authorization_epoch/);
 assert.match(sql,/globalPurgeScopeComplete',false/);
 assert.match(sql,/cloudCdnIssuedBearerStatus','UNKNOWN'/);
 assert.match(edge,/v\.operation==='authority'/);
 assert.match(edge,/withSupabase\(\{auth:'user'\}/);
 assert.match(edge,/Cache-Control':'private, no-store/);
 assert.match(edge,/CDN-Cache-Control':'no-store/);
 assert.match(edge,/Surrogate-Control':'no-store/);
 assert.match(edge,/Vary':'Authorization, Origin/);
 assert.match(cfg,/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
 assert.equal(candidate.approved,false);
 assert.equal(candidate.activateRegistry,false);
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.ok(Object.values(SOURCE153_OWNER_V2_CAPABILITIES).every(x=>x===false));
 assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
});
test('source/@1 vs consumer/@2 never creates browser identity or live action',()=>{
 assert.equal(SOURCE,'wand.dreamsnaps.owner-authority-projection@1');
 assert.equal(TARGET,'wand.dreamsnaps.private-owner-consumer@2');
 assert.notEqual(SOURCE,SOURCE150_OWNER_SERVICE_CONTRACT);
 assert.equal(decodeSource153OwnerConsumerV2({ok:true,operation:'authority',contractVersion:SOURCE,data:{}},
    ctx('11111111-1111-4111-8111-111111111111')).status,'SOURCE_CONTRACT_REJECTED');
});
if(process.env.INT153_FULL153_PG_BRIDGE){
 test('genuine full153 DB Original/PostEvent authenticated owner projection -> frozen WEBv2 source candidate ONLY',()=>{
  const evidence=JSON.parse(fs.readFileSync(process.env.INT153_FULL153_PG_BRIDGE,'utf8'));
  assert.equal(evidence.syntheticLocalOnly,true);
  assert.equal(evidence.migrations,153);
  assert.equal(evidence.old.syntheticLocalOnly,true);
  for(const [kind,key] of [['PostEventCreation','post'],['OriginalCompetition','original']]){
   const {registered,authority,oldOwner,unapproved}=evidence[key];
   const c=ctx(registered.workId);
   assert.equal(registered.kind,kind);
   assert.equal(authority.work.workId,registered.workId);
   assert.equal(authority.work.photoRevisionId,registered.photoRevisionId);
   assert.equal(authority.work.photoMediaId,registered.photoMediaId);
   assert.equal(authority.grant.mediaId,registered.photoMediaId);
   assert.equal(authority.grant.photoRevisionId,registered.photoRevisionId);
   assert.equal(authority.authority.controlState,'withdrawn');
   assert.equal(authority.authority.rowVersion,2);
   assert.equal(authority.authority.authorizationEpoch,2);
   assert.equal(authority.grant.lastGrantConsentRevision,1);
   assert.equal(authority.grant.publicUsageAuthorized,false);
   assert.equal(authority.deletion.globalPurgeScopeComplete,false);
   assert.equal(authority.deletion.cloudCdnIssuedBearerStatus,'UNKNOWN');
   assert.equal(authority.externalEvidence.signedRuntimeSessionVerified,false);
   if(kind==='PostEventCreation'){
    assert.equal(Object.hasOwn(authority.work,'entryId'),false);
    assert.equal(Object.hasOwn(registered,'entryId'),false);
   }else{
    assert.equal(authority.work.entryId,registered.entryId);
    assert.equal(authority.work.frozenEntryRevisionId,registered.photoRevisionId);
   }
   const result=decodeSource153OwnerConsumerV2(wrap(authority),c);
   assert.equal(result.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY',kind);
   assert.equal(result.snapshot,null);
   assert.equal(result.ownerReadVerified,false);
   assert.equal(result.actionsEnabled,false);
   assert.equal(result.liveBackendEnabled,false);
   assert.equal(result.projectionCandidate.workId,registered.workId);
   assert.equal(result.projectionCandidate.mediaId,registered.photoMediaId);
   assert.equal(result.projectionCandidate.rowVersion,2);
   assert.equal(result.projectionCandidate.authorizationEpoch,2);
   assert.equal(result.projectionCandidate.lastGrantConsentRevision,1);
   assert.equal(result.projectionCandidate.publicUsageAuthorized,false);
   assert.equal(result.projectionCandidate.globalPurgeScopeComplete,false);
   assert.equal(result.projectionCandidate.externalPurgeStatus,'UNKNOWN');
   assert.deepEqual(result.projectionCandidate.approvedPurposesForPublication,[]);
   assert.equal(Object.hasOwn(authority,'ownerAccountId'),false);
   const acceptedHttp=classifySource153OwnerHttpFixture({status:200,headers,body:wrap(authority)},c);
   assert.equal(acceptedHttp.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   assert.equal(acceptedHttp.snapshot,null);
   const unsafe=classifySource153OwnerHttpFixture({status:200,headers:{...headers,'cache-control':'public, max-age=300'},body:wrap(authority)},c);
   assert.equal(unsafe.status,'UNSAFE_CACHE_POLICY');
   const stale=classifySource153OwnerHttpFixture({status:200,headers,body:wrap(authority)},
      {...c,requestGeneration:12});
   assert.equal(stale.status,'STALE_RESPONSE');
   const conflict=classifySource153OwnerHttpFixture({status:409,headers,body:wrap(authority)},c);
   assert.equal(conflict.status,'REFRESH_REQUIRED');
   assert.equal(conflict.autoRetry,false);
   const unavailable=classifySource153OwnerHttpFixture({status:403,headers,body:wrap(authority)},c);
   assert.equal(unavailable.status,'BACKEND_UNAVAILABLE');
   const badOwner=decodeSource153OwnerConsumerV2(wrap(authority),{...c,actorAccountId:'11111111-1111-4111-8111-111111111111'});
   assert.equal(badOwner.status,'SOURCE_CONTRACT_REJECTED');
   const forged=structuredClone(authority);
   forged.deletion.globalPurgeScopeComplete=true;
   assert.equal(decodeSource153OwnerConsumerV2(wrap(forged),c).status,'SOURCE_CONTRACT_REJECTED');
   const swapped=structuredClone(authority);
   swapped.grant.mediaId=evidence[key==='post'?'original':'post'].registered.photoMediaId;
   assert.equal(decodeSource153OwnerConsumerV2(wrap(swapped),c).status,'SOURCE_CONTRACT_REJECTED');
   assert.equal(unapproved.grant.scopeStatus,'UNVERIFIED');
   assert.equal(unapproved.grant.policyReceiptVerified,false);
   assert.equal(Object.hasOwn(unapproved.grant,'scopeId'),false);
   assert.equal(Object.hasOwn(unapproved.grant,'approvedPurposeIds'),false);
   const withoutPolicy=decodeSource153OwnerConsumerV2(wrap(unapproved),c);
   assert.equal(withoutPolicy.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   assert.deepEqual(withoutPolicy.projectionCandidate.approvedPurposesForPublication,[]);
   const oldRead=adaptSource150OwnerEnvelope({
     ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:oldOwner
   },c);
   assert.equal(oldRead.status,'NEED_BACKEND_PROJECTION');
   assert.equal(oldRead.snapshot,null);
   assert.equal(oldRead.actionsEnabled,false);
  }
 });
}
