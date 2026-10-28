import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SOURCE150_OWNER_SERVICE_CONTRACT, SOURCE150_OWNER_ADAPTER_ENABLED,
 adaptSource150OwnerEnvelope, SOURCE150_MISSING_AUTHORITY
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import {
 inspectSource151PregrantEnvelope, SOURCE151_PREGRANT_ADAPTER_ENABLED,
 createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import { PRIVATE_OWNER_BACKEND_ACTIVATED } from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';
import { OWNER_MANAGEMENT_ENABLED } from '../src/lib/dreamsnaps/owner-management.js';

test('new combined FULL152 Source152 Edge registers owner-only, retains private HTTP and corrected replay',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql','utf8');
 const edge=fs.readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
 const cfg=fs.readFileSync('supabase/config.toml','utf8');
 const policy=JSON.parse(fs.readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.json','utf8'));
 assert.match(sql,/v_response:=jsonb_strip_nulls\(jsonb_build_object\(/);
 assert.match(sql,/return v_previous\.response/);
 assert.match(sql,/return v_response/);
 assert.match(edge,/v\.operation==='register'/);
 assert.match(edge,/community_dreamsnap_x05_register_initial_work_v1/);
 assert.match(edge,/withSupabase\(\{auth:'user'\}/);
 assert.match(edge,/Cache-Control':'private, no-store/);
 assert.match(edge,/CDN-Cache-Control':'no-store/);
 assert.match(edge,/Surrogate-Control':'no-store/);
 assert.match(edge,/Vary':'Authorization, Origin/);
 assert.match(cfg,/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
 assert.equal(policy.approved,false);
 assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);
 assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
 assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 assert.ok(SOURCE150_MISSING_AUTHORITY.some(s=>s.includes('ownerAccountId')));
 assert.ok(SOURCE150_MISSING_AUTHORITY.some(s=>s.includes('purgeScopeComplete')));
});

test('combined WEB PreGrant remains source-only and cannot autonomously grant or call network',async()=>{
 const p=createSource151PregrantConsumer();
 let calls=0;const old=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;throw Error('forbidden network');};
 try{
  assert.equal((await p.pregrant({workId:'11111111-1111-4111-8111-111111111111'})).status,'BACKEND_UNAVAILABLE');
  assert.equal((await p.acceptGrant({expectedRowVersion:0,expectedAuthorizationEpoch:0})).firstGrantExecutable,false);
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});

if(process.env.INT_X05_FULL152_PG_BRIDGE){
 test('actual new registered Original and PostEvent FULL152 PG results reach unchanged WEB adapter only as fail-closed read',()=>{
  const v=JSON.parse(fs.readFileSync(process.env.INT_X05_FULL152_PG_BRIDGE,'utf8'));
  assert.equal(v.syntheticLocalOnly,true);
  assert.equal(v.serviceContract,SOURCE150_OWNER_SERVICE_CONTRACT);
  for(const [kind,item] of Object.entries({PostEventCreation:v.post, OriginalCompetition:v.original})){
   const reg=item.register, pre=item.pregrant,owner=item.owner;
   assert.equal(reg.kind,kind);
   assert.equal(reg.publicActivationAllowed,false);
   assert.equal(reg.storageValidatedBySource152,false);
   assert.equal(reg.officialChallengePhaseVerified,false);
   assert.equal(reg.requiresPolicyGrant,true);
   assert.ok(reg.workId && reg.photoRevisionId && reg.photoMediaId);
   assert.notEqual(reg.workId,reg.photoRevisionId);
   assert.notEqual(reg.workId,reg.photoMediaId);
   assert.notEqual(reg.photoRevisionId,reg.photoMediaId);
   if(kind==='PostEventCreation')assert.equal(Object.hasOwn(reg,'entryId'),false);
   else assert.ok(reg.entryId && reg.entryId!==reg.workId && reg.entryId!==reg.photoRevisionId);
   const context={workId:reg.workId,requestGeneration:11,latestGeneration:11};
   const preResult=inspectSource151PregrantEnvelope({
    ok:true,operation:'pregrant',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:pre
   },context);
   assert.equal(preResult.status,'NEED_POLICY_ARTIFACT',kind);
   assert.equal(preResult.firstGrantExecutable,false);
   assert.equal(preResult.ownerReadVerified,false);
   assert.equal(owner.workId,reg.workId);
   assert.equal(owner.rowVersion,2);
   assert.equal(owner.authorizationEpoch,2);
   assert.equal(owner.photoRevisionId,reg.photoRevisionId);
   assert.equal(owner.photoMediaId,reg.photoMediaId);
   assert.equal(owner.imageGrant.consentRevision,1);
   assert.equal(owner.imageGrant.state,'withdrawn');
   assert.equal(owner.erasure.state,'PUBLIC_DISABLED');
   assert.equal(owner.erasure.physicalPurgeVerified,false);
   const projection=adaptSource150OwnerEnvelope({
    ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:owner
   },context);
   assert.equal(projection.status,'NEED_BACKEND_PROJECTION',kind);
   assert.equal(projection.snapshot,null);
   assert.equal(projection.ownerReadVerified,false);
   assert.equal(projection.actionsEnabled,false);
   assert.ok(!JSON.stringify(projection).includes(reg.photoMediaId));
   assert.ok(!JSON.stringify(projection).includes(reg.workId));
  }
 });
}
