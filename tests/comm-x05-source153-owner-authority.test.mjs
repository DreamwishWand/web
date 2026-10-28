import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261028000060_x05_authoritative_owner_projection_v2.sql');
const edge=read('supabase/functions/community-dreamsnap-owner/index.ts');
test('Source153 additive only; no Source149-152 replacement or Public writer',()=>{
 const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
 assert.equal(files.length,153);
 assert.equal(files.at(-1),'20261028000060_x05_authoritative_owner_projection_v2.sql');
 assert.doesNotMatch(sql,/create or replace function public\.community_dreamsnap_x05_(?:owner_read_v1|owner_action_v1|pregrant_read_v1|register_initial_work_v1)\s*\(/);
 assert.doesNotMatch(sql,/insert into public\.media_assets|insert into private\.dreamsnap_x05_owner_policy_v1/);
});
test('JWT-owned postconsent versioned projection only, no injected account/media identity',()=>{
 assert.match(sql,/private\.dreamsnap_x05_verified_db_subject_v1\(\)/);
 assert.match(sql,/private\.resolve_active_account\(v_subject\)/);
 assert.match(sql,/for share/);
 assert.match(sql,/from public,anon,authenticated,service_role/);
 assert.match(sql,/to authenticated/);
 assert.match(edge,/v\.operation==='authority'/);
 assert.match(edge,/community_dreamsnap_x05_owner_authority_v2/);
 assert.match(edge,/AUTHORITY_PROJECTION_UNSUPPORTED/);
 assert.match(edge,/wand\.dreamsnaps\.owner-authority-projection@1/);
 assert.doesNotMatch(sql,/p_actor_account_id|p_auth_subject|p_creator_profile_id|p_media_id/);
});
test('Per Work frozen Media relation; last-grant event, policy artifact, local incident/retention and no public',()=>{
 for(const term of [
   'private.preset_storage_work_quarantined_r19','private.preset_storage_media_quarantined_r19',
   'work_revision_media wrm','wrm.media_id=v_control.frozen_media_id',
   "e.action='grant'",'v_last_grant.event_version','private.dreamsnap_x05_policy_receipt_v1',
   "r.approved_at<=clock_timestamp()", "v_policy_valid:=found", 
   'private.account_retention_holds','localProviderScope','SINGLE_FROZEN_MEDIA_RECORD',
   'globalPurgeScopeComplete','cloudCdnIssuedBearerStatus','UNKNOWN','publicUsageAuthorized',
   'authenticatedAccountBound','workPhotoBindingVerified','mediaOwnershipVerified',
   'p_expected_row_version','p_expected_authorization_epoch'
 ])assert.ok(sql.includes(term),'missing '+term);
 assert.match(sql,/jsonb_strip_nulls\(jsonb_build_object/);
 assert.match(sql,/if v_control.work_kind='PostEventCreation' then/);
 assert.doesNotMatch(sql,/storage_key|signedUrl|ownerAccountId|cdnUrl|privateKey/);
});
test('local Policy v1 candidate remains unapproved with exact unchanged text SHA256',()=>{
 const candidate=JSON.parse(read('docs/community/policy/dreamsnap-image-grant-v1.candidate.json'));
 assert.equal(candidate.approved,false);
 assert.equal(candidate.activateRegistry,false);
 assert.equal(candidate.sha256,'2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb');
});
