import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SOURCE150_OWNER_SERVICE_CONTRACT, SOURCE150_OWNER_ADAPTER_ENABLED,
  SOURCE150_MISSING_AUTHORITY, adaptSource150OwnerEnvelope
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import {
  SOURCE151_PREGRANT_DATA_CONTRACT, SOURCE151_REQUIRED_FIRST_CAS,
  SOURCE151_PREGRANT_ADAPTER_ENABLED, inspectSource151PregrantEnvelope,
  createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import {
  PRIVATE_OWNER_BACKEND_ACTIVATED, createPrivateOwnerServiceConsumer
} from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';
import { OWNER_MANAGEMENT_ENABLED } from '../src/lib/dreamsnaps/owner-management.js';

const workId = '11111111-1111-4111-8111-111111111111';
const creatorProfileId = '22222222-2222-4222-8222-222222222222';
const challengeId = '33333333-3333-4333-8333-333333333333';
const photoRevisionId = '44444444-4444-4444-8444-444444444444';
const photoMediaId = '55555555-5555-4555-8555-555555555555';
const context = { workId, requestGeneration: 5, latestGeneration: 5 };
const pregrant = {
  ok:true, operation:'pregrant', contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
  data:{
    contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT, state:'NEED_POLICY_ARTIFACT',
    ownerAuthorized:true, workId, kind:'PostEventCreation',
    creatorProfileId, challengeId, photoRevisionId, photoMediaId,
    authenticatedAccountBound:true, workPhotoBindingVerified:true,
    mediaOwnershipVerified:true, originalImageImmutable:true,
    expectedRowVersion:0, expectedAuthorizationEpoch:0, grantRecorded:false,
    publicActivationAllowed:false, officialChallengePhaseVerified:false,
    grantAvailable:false,
    erasure:{state:'NOT_REQUESTED',physicalPurgeVerified:false,publicDisabled:true}
  }
};

test('combined Source151 pregrant envelope is structurally consumed but no policy, grant or public capability is authorized',()=>{
  const got=inspectSource151PregrantEnvelope(pregrant,context);
  assert.equal(got.status,'NEED_POLICY_ARTIFACT');
  assert.equal(got.ownerReadVerified,false);
  assert.equal(got.creatorGrantRecorded,false);
  assert.equal(got.firstGrantExecutable,false);
  assert.equal(got.snapshot,null);
  assert.equal(got.policyReceipt,null);
  assert.deepEqual(SOURCE151_REQUIRED_FIRST_CAS,{expectedRowVersion:0,expectedAuthorizationEpoch:0});
  assert.equal(inspectSource151PregrantEnvelope({...pregrant,data:{...pregrant.data,entryId:workId}},context).status,'SOURCE_CONTRACT_REJECTED');
  assert.equal(inspectSource151PregrantEnvelope({...pregrant,data:{...pregrant.data,publicActivationAllowed:true}},context).status,'SOURCE_CONTRACT_REJECTED');
  assert.equal(inspectSource151PregrantEnvelope(pregrant,{...context,latestGeneration:6}).status,'STALE_RESPONSE');
});

test('combined Source150 Owner response cannot manufacture missing owner, Media, Consent or physical purge provenance',()=>{
  const envelope={ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:pregrant.data};
  assert.equal(adaptSource150OwnerEnvelope(envelope,context).status,'SOURCE_CONTRACT_REJECTED');
  for(const required of ['work.ownerAccountId','grant.mediaId','deletion.purgeScopeComplete']){
    assert.ok(SOURCE150_MISSING_AUTHORITY.some(v=>v.includes(required)),required);
  }
  assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);
  assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
  assert.equal(OWNER_MANAGEMENT_ENABLED,false);
  assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
});

test('combined source keeps private grant gate and old reader/source controls fail closed',()=>{
  const sql151=fs.readFileSync('supabase/migrations/20261028000040_x05_private_pregrant_policy_receipt_v1.sql','utf8');
  const sql150=fs.readFileSync('supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql','utf8');
  const edge=fs.readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
  const config=fs.readFileSync('supabase/config.toml','utf8');
  assert.match(sql151,/community_dreamsnap_x05_pregrant_read_v1/);
  assert.match(sql151,/policy_receipt_v1/);
  assert.match(sql150,/community_dreamsnap_x05_owner_read_v1/);
  assert.match(sql150,/community_dreamsnap_x05_owner_action_v1/);
  assert.match(edge,/withSupabase\(\{auth:'user'\}/);
  assert.match(edge,/Cache-Control/);
  assert.match(edge,/no-store/);
  assert.match(config,/\[functions\.community-dreamsnap-owner\][\s\S]*?verify_jwt\s*=\s*true/);
});

test('combined DTO consumers remain inert with no signed JWT, real registration, synthetic policy approval or network calls',async()=>{
  let calls=0;
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;throw Error('unexpected HTTP');};
  try{
    const pre=createSource151PregrantConsumer();
    const owner=createPrivateOwnerServiceConsumer();
    assert.equal((await pre.pregrant({workId})).status,'BACKEND_UNAVAILABLE');
    assert.equal((await pre.acceptGrant({workId,expectedRowVersion:0,expectedAuthorizationEpoch:0})).firstGrantExecutable,false);
    assert.equal((await owner.read({workId})).status,'BACKEND_UNAVAILABLE');
    assert.equal((await owner.mutate({workId})).persisted,false);
    assert.equal(calls,0);
  }finally{globalThis.fetch=previous;}
});
