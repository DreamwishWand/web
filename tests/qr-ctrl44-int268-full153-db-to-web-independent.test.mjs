import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeSource153OwnerConsumerV2, classifySource153OwnerHttpFixture,
 SOURCE153_OWNER_PROJECTION_CONTRACT as SOURCE,PRIVATE_OWNER_CONSUMER_V2_CONTRACT as TARGET,
 SOURCE153_OWNER_V2_LIVE_ENABLED,SOURCE153_OWNER_V2_CAPABILITIES} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import {adaptSource150OwnerEnvelope,SOURCE150_OWNER_SERVICE_CONTRACT} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
const blob=p=>{const b=readFileSync(p);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')};
const headers=()=>({'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store','surrogate-control':'no-store',vary:'Authorization, Origin'});
const ctx=(workId,n=42)=>({workId,requestGeneration:n,latestGeneration:42});
const wrap=data=>({ok:true,operation:'authority',contractVersion:SOURCE,data});
const closed=(r,status)=>{assert.equal(r.status,status);assert.equal(r.snapshot,null);assert.equal(r.ownerReadVerified,false);assert.equal(r.actionsEnabled,false);assert.equal(r.liveBackendEnabled,false);assert.equal(r.autoRetry,false);assert.equal(r.clearPriorSnapshot,true)};
test('exact Source153/Edge, strict WEB267 git objects and 153 migrations with all positive runtime switches OFF',()=>{
 for(const [p,sha] of [
  ['supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql','356cc10138cd351674fde8dd943acc968e26fbbc'],
  ['supabase/functions/community-dreamsnap-owner/index.ts','38f6830b88eb37dc612cbc11901812a90b406146'],
  ['src/lib/dreamsnaps/source153-owner-consumer-v2.js','f981b7596711b47bceb2fa79a2191e79e8f1b459'],
  ['supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql','cd297f48111afbb315651c6cb7e911afb1bcc03d']
 ])assert.equal(blob(p),sha,p);
 assert.equal(SOURCE,'wand.dreamsnaps.owner-authority-projection@1');
 assert.equal(TARGET,'wand.dreamsnaps.private-owner-consumer@2');
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.ok(Object.values(SOURCE153_OWNER_V2_CAPABILITIES).every(x=>x===false));
 const s=readFileSync('src/lib/dreamsnaps/source153-owner-consumer-v2.js','utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|\.rpc\s*\(|\.functions\.invoke\s*\(/);
 const cfg=readFileSync('supabase/config.toml','utf8');
 assert.match(cfg,/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
});
if(process.env.QR44_REAL_FULL153_BRIDGE){
 test('two actually registered Source152 Work → real Source153 Owner DTO → frozen WEB267 & Source150 strict adapters',()=>{
  const all=JSON.parse(readFileSync(process.env.QR44_REAL_FULL153_BRIDGE,'utf8'));
  assert.equal(all.localSyntheticOnly,true);
  assert.equal(all.migrationCount,153);
  assert.equal(new Set(all.pids).size,3);
  for(const [k,kind] of [['post','PostEventCreation'],['original','OriginalCompetition']]){
   const item=all[k],r=item.register,d=item.authority,p=item.pregrant,old=item.owner;
   assert.equal(r.kind,kind);
   assert.equal(r.workId,d.work.workId);
   assert.equal(r.photoRevisionId,d.work.photoRevisionId);
   assert.equal(r.photoMediaId,d.work.photoMediaId);
   assert.equal(d.grant.mediaId,r.photoMediaId);
   assert.equal(d.grant.photoRevisionId,r.photoRevisionId);
   assert.equal(d.work.currentWorkRevisionId,old.currentWorkRevisionId??d.work.currentWorkRevisionId);
   assert.equal(p.state,'NEED_POLICY_ARTIFACT');
   assert.equal(d.authority.rowVersion,2);assert.equal(d.authority.authorizationEpoch,2);
   assert.equal(d.grant.lastGrantConsentRevision,1);
   assert.equal(d.grant.state,'withdrawn');
   assert.equal(d.grant.publicUsageAuthorized,false);
   assert.equal(d.deletion.globalPurgeScopeComplete,false);
   assert.equal(d.deletion.cloudCdnIssuedBearerStatus,'UNKNOWN');
   assert.equal(d.externalEvidence.signedRuntimeSessionVerified,false);
   assert.equal(d.externalEvidence.storageProviderObjectVerified,false);
   assert.equal(d.externalEvidence.publicActivationAllowed,false);
   if(k==='post'){
    assert.equal(Object.hasOwn(r,'entryId'),false);
    assert.equal(Object.hasOwn(d.work,'entryId'),false);
    assert.equal(Object.hasOwn(d.work,'frozenEntryRevisionId'),false);
   }else{
    assert.ok(r.entryId);assert.equal(d.work.entryId,r.entryId);
    assert.equal(d.work.frozenEntryRevisionId,r.photoRevisionId);
   }
   const c=ctx(r.workId);
   const actual=decodeSource153OwnerConsumerV2(wrap(d),c);
   closed(actual,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   assert.ok(actual.projectionCandidate);
   assert.equal(actual.requiresSignedRuntimeAcceptance,true);
   assert.equal(actual.projectionCandidate.mediaId,r.photoMediaId);
   assert.equal(actual.projectionCandidate.rowVersion,2);
   assert.equal(actual.projectionCandidate.authorizationEpoch,2);
   assert.equal(actual.projectionCandidate.lastGrantConsentRevision,1);
   assert.deepEqual(actual.projectionCandidate.approvedPurposesForPublication,[]);
   assert.equal(actual.projectionCandidate.publicUsageAuthorized,false);
   assert.equal(actual.projectionCandidate.globalPurgeScopeComplete,false);
   assert.equal(actual.projectionCandidate.externalPurgeStatus,'UNKNOWN');
   const oldLegacy=adaptSource150OwnerEnvelope({ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:old},c);
   assert.equal(oldLegacy.status,'NEED_BACKEND_PROJECTION');
   assert.equal(oldLegacy.snapshot,null);assert.equal(oldLegacy.actionsEnabled,false);
   closed(classifySource153OwnerHttpFixture({status:200,headers:headers(),body:wrap(d)},c),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   closed(classifySource153OwnerHttpFixture({status:200,headers:headers(),body:wrap(d)},ctx(r.workId,41)),'STALE_RESPONSE');
   for(const status of [401,403,404,410,503])closed(classifySource153OwnerHttpFixture({status,headers:headers(),body:wrap(d)},c),'BACKEND_UNAVAILABLE');
   for(const status of [409,412]){
    const x=classifySource153OwnerHttpFixture({status,headers:headers(),body:wrap(d)},c);
    closed(x,'REFRESH_REQUIRED');assert.equal(x.refreshRequired,true);
   }
   for(const h of [{...headers(),'cache-control':'public, max-age=100'},{...headers(),vary:'Origin'},{...headers(),'surrogate-control':'max-age=10'}])
    closed(classifySource153OwnerHttpFixture({status:200,headers:h,body:wrap(d)},c),'UNSAFE_CACHE_POLICY');
   // NEW cross-system DTO manipulation: change an entire internally consistent work/media
   // pair to another READY same-account Media. Pure decoder can inspect only shape; it
   // must NOT turn this JSON into authenticated authority (actual SQL denies it).
   const other=all[k==='post'?'original':'post'].register.photoMediaId;
   const spoof=structuredClone(d);
   spoof.work.photoMediaId=other;spoof.grant.mediaId=other;
   const shaped=decodeSource153OwnerConsumerV2(wrap(spoof),c);
   closed(shaped,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   assert.equal(shaped.projectionCandidate.mediaId,other);
   assert.equal(shaped.requiresSignedRuntimeAcceptance,true);
   // Shape-inconsistent media or wrong Work/Grant must be terminally denied.
   const badMedia=structuredClone(d);badMedia.grant.mediaId=other;
   closed(decodeSource153OwnerConsumerV2(wrap(badMedia),c),'SOURCE_CONTRACT_REJECTED');
   const account=structuredClone(d);account.authority.ownerAccountId=r.workId;
   closed(decodeSource153OwnerConsumerV2(wrap(account),c),'SOURCE_CONTRACT_REJECTED');
   const badRights=structuredClone(d);badRights.grant.publicUsageAuthorized=true;
   closed(decodeSource153OwnerConsumerV2(wrap(badRights),c),'SOURCE_CONTRACT_REJECTED');
   const badPurge=structuredClone(d);badPurge.deletion.globalPurgeScopeComplete=true;
   closed(decodeSource153OwnerConsumerV2(wrap(badPurge),c),'SOURCE_CONTRACT_REJECTED');
   const staleCas=decodeSource153OwnerConsumerV2(wrap(d),{...c,expectedRowVersion:1});
   closed(staleCas,'REFRESH_REQUIRED');assert.equal(staleCas.refreshRequired,true);
   const unapproved=decodeSource153OwnerConsumerV2(wrap(item.unapproved),c);
   closed(unapproved,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
   assert.equal(item.unapproved.grant.scopeStatus,'UNVERIFIED');
   assert.equal(item.unapproved.grant.policyReceiptVerified,false);
   assert.equal(Object.hasOwn(item.unapproved.grant,'scopeId'),false);
   assert.equal(Object.hasOwn(item.unapproved.grant,'approvedPurposeIds'),false);
   assert.deepEqual(unapproved.projectionCandidate.approvedPurposesForPublication,[]);
  }
  const hold=all.post.hold;
  assert.equal(hold.deletion.activeAccountLegalHold,true);
  assert.equal(hold.deletion.globalPurgeScopeComplete,false);
  assert.equal(hold.deletion.cloudCdnIssuedBearerStatus,'UNKNOWN');
  const accepted=decodeSource153OwnerConsumerV2(wrap(hold),ctx(all.post.register.workId));
  closed(accepted,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(accepted.projectionCandidate.activeAccountLegalHold,true);
  assert.equal(accepted.projectionCandidate.globalPurgeScopeComplete,false);
 });
}
