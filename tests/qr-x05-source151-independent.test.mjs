import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync('supabase/migrations/20261028000040_x05_private_pregrant_policy_receipt_v1.sql','utf8');
const edge=readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
test('exact Source151 owner blob/unchanged Source150 and full151 migration distinct from old total150',()=>{
 assert.equal(blob(sql),'451735e05b6a18c826851a51000909c40c42bb9f');
 assert.equal(blob(edge),'1a05cdc540a45fe1b1656d64a151d1c1ca28c8be');
 assert.equal(blob(readFileSync('supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql')),
 '85e9de1874ca489133fd39be522f57ee1cfac6ab');
 const names=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
 assert.equal(names.length,151);assert.equal(names.at(-1),'20261028000040_x05_private_pregrant_policy_receipt_v1.sql');
});
test('policy activation requires immutable exact UTF8 SHA256 receipt, private trigger and no seeded rights',()=>{
 for(const s of ['create table private.dreamsnap_x05_policy_receipt_v1',
 'canonical_text text not null','approval_reference text not null',
 'approved_at timestamptz not null',
 "pg_catalog.sha256(convert_to(v_receipt.canonical_text,'UTF8'))",
 'is distinct from new.policy_digest',
 "raise exception 'X05_POLICY_ARTIFACT_REQUIRED_OR_DIGEST_MISMATCH'",
 'before insert or update of is_active,policy_digest',
 'before update or delete on private.dreamsnap_x05_policy_receipt_v1',
 "'X05_APPROVED_POLICY_RECEIPT_IMMUTABLE'"])
 assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/insert into private\.dreamsnap_x05_(owner_policy|policy_receipt)_v1\b/i);
});
test('pregrant read verifies current JWT owner, active creator and no existing Control/event/outbox state',()=>{
 for(const s of [
 'v_subject:=private.dreamsnap_x05_verified_db_subject_v1()',
 'v_account:=private.resolve_active_account(v_subject)',
 "v_work.owner_account_id is distinct from v_account",
 "v_work.moderation_state<>'clear'",
 'v_dw.managed_under13',
 'private.dreamsnap_x05_work_control_v1',
 'private.dreamsnap_x05_consent_events_v1',
 'private.dreamsnap_x05_purge_tracking_v1',
 'cp.owner_account_id=v_account',
 "cp.moderation_state='clear'"
 ])assert.ok(sql.includes(s),s);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_pregrant_read_v1\(uuid\)\s+to authenticated/);
 assert.match(sql,/revoke all on function public\.community_dreamsnap_x05_pregrant_read_v1\(uuid\)[\s\S]*?from public,anon,authenticated,service_role/);
});
test('only READY immutable image from owned Work with same challenge, eligible Original real Entry or entry-free Stage',()=>{
 for(const s of [
 "v_work.current_published_revision_id is null",
 'challenge_id=v_dw.challenge_id',
 "integrity_state='eligible'",
 'game_screenshot_attested and no_external_edits_attested',
 "m.processing_state='ready'","m.moderation_state='clear'",
 "m.purged_at is null",
 "e.entry_revision_id=v_photo.revision_id",
 "e.eligibility_state='eligible'",
 "not e.managed_under13",
 "st.immutable_photo_revision_id=v_photo.revision_id",
 "st.media_id=v_media",
 "st.publication_state='staged'",
 "st.official_voting_authority='unknown'"
 ])assert.ok(sql.includes(s),s);
});
test('unseeded policy never returns receipt or grantAvailable; public/official remain false and CAS(0,0)',()=>{
 for(const s of [
 "'NEED_POLICY_ARTIFACT'","'PREGRANT_READY'",
 'join private.dreamsnap_x05_policy_receipt_v1 rec',
 'rec.approved_at<=clock_timestamp()',
 'v_policy_ready:=found',
 "'expectedRowVersion',0",
 "'expectedAuthorizationEpoch',0",
 "'grantRecorded',false",
 "'publicActivationAllowed',false",
 "'officialChallengePhaseVerified',false",
 "'grantAvailable',v_policy_ready"
 ])assert.ok(sql.includes(s),s);
});
test('no private tables/functions exposed to anonymous, service, authenticated beyond one narrow wrapper',()=>{
 for(const fn of ['dreamsnap_x05_policy_activate_guard_v1()','dreamsnap_x05_policy_receipt_immutable_v1()'])
  assert.ok(sql.includes('revoke all on function private.'+fn));
 assert.ok(sql.includes('revoke all on private.dreamsnap_x05_policy_receipt_v1'));
 assert.ok(!/grant .* to service_role/i.test(sql));
});
test('Edge pregrant operation uses same signed-user boundary and returns private/no-store, no publisher/media',()=>{
 for(const s of [
 "v.operation==='pregrant'",
 "'community_dreamsnap_x05_pregrant_read_v1'",
 "auth:'user'",
 "'Cache-Control':'private, no-store, max-age=0'",
 "'CDN-Cache-Control':'no-store'",
 "'Surrogate-Control':'no-store'",
 "result.grantRecorded!==false",
 "result.publicActivationAllowed!==false",
 "result.contractVersion!=='wand.dreamsnaps.pregrant-service@1'"
 ])assert.ok(edge.includes(s),s);
 assert.ok(!edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!edge.includes('getSignedUrl('));
});
