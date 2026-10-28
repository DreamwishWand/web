import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261028000040_x05_private_pregrant_policy_receipt_v1.sql');
const edge=read('supabase/functions/community-dreamsnap-owner/index.ts');
test('additive Source151 only; prior Source150 immutable',()=>{
 const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
 assert.equal(files.length,151);
 assert.equal(files.at(-1),'20261028000040_x05_private_pregrant_policy_receipt_v1.sql');
 assert.doesNotMatch(sql,/create or replace function public\.community_dreamsnap_x05_owner_(?:read|action)_v1/);
 assert.doesNotMatch(sql,/create (?:or replace )?function private\.dreamsnap_x05_record_creator_grant_v1/);
});
test('pregrant uses Source150 verified subject, no caller AccountID/SubjectID, narrow authenticated-only grant',()=>{
 assert.match(sql,/v_subject:=private\.dreamsnap_x05_verified_db_subject_v1\(\)/);
 assert.match(sql,/v_account:=private\.resolve_active_account\(v_subject\)/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_pregrant_read_v1\(uuid\)\s+to authenticated/);
 assert.match(sql,/revoke all on function public\.community_dreamsnap_x05_pregrant_read_v1\(uuid\)\s+from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/p_auth_subject uuid|p_account_id uuid/);
});
test('pregrant denies existing control, prior consent or purge; no implicit write',()=>{
 assert.match(sql,/exists\(select 1 from private\.dreamsnap_x05_work_control_v1/);
 assert.match(sql,/exists\(select 1 from private\.dreamsnap_x05_consent_events_v1/);
 assert.match(sql,/exists\(select 1 from private\.dreamsnap_x05_purge_tracking_v1/);
 assert.match(sql,/'expectedRowVersion',0/);
 assert.match(sql,/'expectedAuthorizationEpoch',0/);
 assert.match(sql,/'grantRecorded',false/);
 assert.match(sql,/'publicActivationAllowed',false/);
 assert.doesNotMatch(sql,/insert into (?:private\.dreamsnap_x05_work_control_v1|private\.dreamsnap_x05_consent_events_v1|public\.outbox_events)/);
});
test('Original and PostEvent frozen photo/Entry + eligibility checks are disjoint',()=>{
 assert.match(sql,/v_kind:='OriginalCompetition'/);
 assert.match(sql,/v_kind:='PostEventCreation'/);
 assert.match(sql,/e\.entry_revision_id=v_photo\.revision_id/);
 assert.match(sql,/st\.immutable_photo_revision_id=v_photo\.revision_id/);
 assert.match(sql,/st\.official_voting_authority='unknown'/);
 assert.match(sql,/v_photo\.integrity_state/);
});
test('policy receipt sealed, exact SHA256 and active registry, never seeded',()=>{
 assert.match(sql,/create table private\.dreamsnap_x05_policy_receipt_v1/);
 assert.match(sql,/approval_reference text not null/);
 assert.match(sql,/sha256\(convert_to\(v_receipt\.canonical_text,'UTF8'\)\)/);
 assert.match(sql,/X05_POLICY_ARTIFACT_REQUIRED_OR_DIGEST_MISMATCH/);
 assert.match(sql,/X05_APPROVED_POLICY_RECEIPT_IMMUTABLE/);
 assert.doesNotMatch(sql,/insert into private\.dreamsnap_x05_owner_policy_v1/);
 assert.doesNotMatch(sql,/insert into private\.dreamsnap_x05_policy_receipt_v1/);
});
test('Edge dispatch strict pregrant read, separate service schema, no media issuer',()=>{
 assert.match(edge,/v\.operation==='read'\|\|v\.operation==='pregrant'/);
 assert.match(edge,/community_dreamsnap_x05_pregrant_read_v1/);
 assert.match(edge,/wand\.dreamsnaps\.pregrant-service@1/);
 assert.match(edge,/PREGRANT_VERSION_UNSUPPORTED/);
 assert.match(edge,/Cache-Control':'private, no-store/);
 assert.doesNotMatch(edge,/createSignedUrl|storage\.from/);
});
