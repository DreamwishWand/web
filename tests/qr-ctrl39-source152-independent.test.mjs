import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync('supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql','utf8');
const edge=readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
const manifest=JSON.parse(readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.json','utf8'));
const candidate=readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.txt');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
test('Source152 exact frozen content and full152 migrated inventory',()=>{
 assert.equal(hash(sql),'256b46e7d768b1e517c82e80d118248c86e70624');
 assert.equal(hash(edge),'5539382678250ebdc563ca9a36b574d6a9bb5df0');
 const paths=readdirSync('supabase/migrations').filter(v=>v.endsWith('.sql')).sort();
 assert.equal(paths.length,152);assert.equal(paths.at(-1),'20261028000050_x05_first_work_media_bootstrap_v1.sql');
});
test('narrow authenticated-only security definer, server pins Actor and Creator, not arbitrary HTTP identity',()=>{
 for(const q of [
 'v_subject:=private.dreamsnap_x05_verified_db_subject_v1()',
 'v_account:=private.resolve_active_account(v_subject)',
 'cp.owner_account_id=v_account',
 "cp.moderation_state='clear'",
 "ce.deleted_at is null",
 'security definer',
 'set search_path=pg_catalog,auth,extensions,public,private',
 'revoke all on function public.community_dreamsnap_x05_register_initial_work_v1(',
 'to authenticated'
 ])assert.ok(sql.includes(q),q);
 assert.doesNotMatch(sql,/p_account_id|p_creator_profile_id|p_work_id|p_entry_id|p_storage_key/);
 assert.ok(edge.includes("v.operation==='register'"));
 assert.ok(edge.includes("auth:'user'"));
 assert.ok(!edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
test('owned READY Media, Creator, Challenge phase, private and explicit Original Wand Entry',()=>{
 for(const q of [
 "v_media.owner_account_id is distinct from v_account",
 "v_media.processing_state<>'ready'",
 "v_media.moderation_state<>'clear'",
 'v_media.purged_at is not null',
 "v_challenge.is_synthetic",
 "v_challenge.lifecycle_state<>'submission_open'",
 "p_explicit_wand_entry is distinct from true",
 "v_challenge.lifecycle_state not in ('results','closed')",
 "p_explicit_wand_entry is distinct from false",
 "visibility='private'",
 "'publicActivationAllowed',false",
 "'officialChallengePhaseVerified',false",
 "'storageValidatedBySource152',false",
 "'requiresPolicyGrant',true",
 "'nextOperation','pregrant'"
 ])assert.ok(sql.includes(q),q);
});
test('no phantom DDV official competition: only existing Wand Work+Entry and PostEvent no Entry',()=>{
 for(const q of [
 'public.community_register_dreamsnap_work_v1(',
 'public.community_dreamsnap_join_event_v1(',
 'e.entry_revision_id=v_revision',
 "e.entry_state='entered'",
 "e.eligibility_state='eligible'",
 "p_kind='OriginalCompetition'",
 "p_kind='PostEventCreation'",
 "private.dreamsnap_create_revision(",
 'private.dreamsnap_post_event_staged_v1',
 "'PostEventCreation'",
 "'dreamsnap.work_registered'"
 ])assert.ok(sql.includes(q),q);
 assert.ok(!/insert\s+into\s+public\.dreamsnap_results\b/i.test(sql));
});
test('same media+challenge/key xact lock, rollback and replay safe idempotency',()=>{
 for(const q of [
 'pg_advisory_xact_lock(',
 "'x05media:'","'x05request:'",
 "'x05:'||p_idempotency_key",
 "'X05_IDEMPOTENCY_KEY_REUSED'",
 "'X05_DUPLICATE_MEDIA_WORK'",
 "p_idempotency_key !~ '^[a-zA-Z0-9:_-]+$'",
 "char_length(p_idempotency_key) not between 16 and 120"
 ])assert.ok(sql.includes(q),q);
});
test('Japanese Policy v1 is immutable candidate byte digest, never actual approval or registry seed',()=>{
 assert.equal(manifest.approved,false);assert.equal(manifest.approvalReference,null);
 assert.equal(manifest.approvedAt,null);assert.equal(manifest.activateRegistry,false);
 assert.equal(manifest.policyVersionText,'v1');
 assert.equal(manifest.sha256,'2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb');
 assert.equal(createHash('sha256').update(candidate).digest('hex'),manifest.sha256);
 assert.equal(candidate[0],0xe9);assert.equal(candidate.at(-1),10);assert.equal(candidate.includes(13),false);
 assert.equal(readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.txt','utf8').includes('非公式'),true);
 assert.doesNotMatch(sql,/insert into private\.dreamsnap_x05_(owner_policy|policy_receipt)_v1/i);
});
test('No source152 direct Publisher, Signer, Stage, Provider, Storage or physical purge',()=>{
 for(const dangerous of ['getSignedUrl(', 'SUPABASE_SERVICE_ROLE_KEY','publicActivationAllowed\x27,true',
   'StorageClient','cloudflare','stripe','publish_public_dreamsnap'])
 assert.equal(sql.includes(dangerous),false,dangerous);
 assert.ok(edge.includes("'Cache-Control':'private, no-store, max-age=0'"));
});
