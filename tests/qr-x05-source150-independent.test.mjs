import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync('supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql','utf8');
const edge=readFileSync('supabase/functions/community-dreamsnap-owner/index.ts','utf8');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
test('Source150 exact Owner SQL and Source149 retained at immutable blob, 150 migrations',()=>{
 assert.equal(blob(sql),'85e9de1874ca489133fd39be522f57ee1cfac6ab');
 assert.equal(blob(readFileSync('supabase/migrations/20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql')),
 '0d0c4e85a1fc1d0e2e3ba06aade8d55f305e1fd0');
 const names=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
 assert.equal(names.length,150);
 assert.equal(names.at(-1),'20261028000030_x05_authenticated_owner_service_v1.sql');
});
test('JWT binds UID/claims with session cutoff and privacy; user cannot supply p_auth_subject',()=>{
 for(const needle of [
 'v_claims:=auth.jwt()',"v_role:=v_claims->>'role'","v_role is distinct from 'authenticated'",
 "v_claims->>'session_id'","v_claims->>'sub'","v_claims->>'iat'",
 'auth.uid() is distinct from v_subject','sessions_valid_after',
 "identity_state='active'","i.retired_at is null","a.status='active'",
 'private.is_account_privacy_suppressed(a.account_id)'
 ])assert.ok(sql.includes(needle),needle);
 assert.ok(!/public\.community_dreamsnap_x05_owner_(read|action)_v1\(\s*p_auth_subject/.test(sql));
 assert.ok(!/p_auth_subject\s*:\s*request|p_auth_subject\s*:\s*body/.test(edge));
});
test('private Source149 and Source150 verifier never granted to browser or service_role',()=>{
 for(const fname of [
 'private.dreamsnap_x05_verified_db_subject_v1()',
 'public.community_dreamsnap_x05_owner_read_v1(uuid)',
 'public.community_dreamsnap_x05_owner_action_v1('
 ])assert.ok(sql.includes(fname),fname);
 assert.match(sql,/revoke all on function private\.dreamsnap_x05_verified_db_subject_v1\(\)[\s\S]*?from public,anon,authenticated,service_role;/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_owner_read_v1\(uuid\)\s+to authenticated;/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_owner_action_v1\([\s\S]*?\)\s*to authenticated;/);
 assert.doesNotMatch(sql,/grant execute on function .* to service_role/i);
});
test('legacy shared deferred revision validator change is bounded to SECURITY DEFINER fixed search path',()=>{
 assert.match(sql,/alter function public\.validate_current_published_revision\(\) security definer;/);
 assert.match(sql,/alter function public\.validate_current_published_revision\(\)\s+set search_path=pg_catalog,public,private;/);
 assert.match(sql,/revoke all on function public\.validate_current_published_revision\(\)\s+from public,anon,authenticated,service_role;/);
 assert.doesNotMatch(sql,/grant .*community_work_revisions.*(authenticated|service_role)/i);
});
test('policy registry must be pre-seeded by authority; consentRevision from grant event not Work rowVersion',()=>{
 assert.ok(sql.includes('create table private.dreamsnap_x05_owner_policy_v1'));
 assert.ok(sql.includes('where policy_version=p_policy_version and is_active for share'));
 assert.ok(sql.includes('v_policy.policy_digest is distinct from p_policy_digest'));
 assert.ok(sql.includes("and e.action='grant'"));
 assert.ok(sql.includes("'consentRevision',v_consent_revision"));
 assert.ok(!sql.includes("'consentRevision',v_ctl.row_version"));
 assert.ok(sql.includes("'policyVersionText',v_ctl.grant_policy_version"));
 assert.ok(sql.includes("'policyVersionOrdinal',v_policy_ordinal"));
});
test('Original entry must remain frozen, post-event no fabricated Entry, no bearer media leakage',()=>{
 for(const needle of [
 "v_ctl.work_kind='OriginalCompetition'","e.entry_revision_id=v_ctl.frozen_photo_revision_id",
 "v_ctl.work_kind='PostEventCreation'","st.publication_state='staged'",
 'st.immutable_photo_revision_id=v_ctl.frozen_photo_revision_id',
 "v_ctl.frozen_media_id","'capabilities',jsonb_build_object(",
 "'publicDetail',false","'publicMedia',false","'publish',false","'verifyPurge',false"
 ])assert.ok(sql.includes(needle),needle);
 for(const bad of ["'storageKey',","'signedUrl',","'rawJwt',","'accessToken',"])
 assert.ok(!sql.includes(bad),bad);
});
test('revision and epoch CAS under Work lock, event and outbox atomic private-only updates',()=>{
 for(const needle of [
 'where work_id=p_work_id for update',
 'p_expected_authorization_epoch',
 'v_ctl.authorization_epoch is distinct from p_expected_authorization_epoch',
 'v_ctl.row_version is distinct from p_expected_row_version',
 'private.dreamsnap_x05_owner_transition_v1',
 "'publicActivationAllowed',false"
 ])assert.ok(sql.includes(needle),needle);
});
test('P03 cannot claim physical purge from requested, provider reported or legal hold alone',()=>{
 for(const needle of [
 "v_held then 'LEGAL_HOLD'","v_purge.request_state='verified'",
 'v_purge.verified_at is not null','v_purge.provider_receipt_digest is not null',
 "v_purged and v_public_disabled then 'MEDIA_PURGED'",
 "then 'MEDIA_PURGE_PENDING'"
 ])assert.ok(sql.includes(needle),needle);
});
test('Edge HTTP all responses private/no-store and success/failure canonical with no publish/signer',()=>{
 for(const needle of [
 "'Cache-Control':'private, no-store, max-age=0'",
 "'CDN-Cache-Control':'no-store'",
 "'Surrogate-Control':'no-store'",
 "'Vary':'Authorization, Origin'",
 'return reply({ok:false,error:',
 'return reply({ok:true,operation:body.operation',
 "auth:'user'",
 "ctx.userClaims?.id","ctx.jwtClaims?.session_id",
 "const apiKey=Deno.env.get('SUPABASE_ANON_KEY')",
 "'Authorization':bearer",
 'const conflict=response.status===409'
 ])assert.ok(edge.includes(needle),needle);
 assert.ok(!edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!edge.includes('community_publish_'));
 assert.ok(!edge.includes('getSignedUrl('));
});
