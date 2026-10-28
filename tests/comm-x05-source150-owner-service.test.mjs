import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261028000030_x05_authenticated_owner_service_v1.sql');
const edge=read('supabase/functions/community-dreamsnap-owner/index.ts');
const config=read('supabase/config.toml');
test('Source150 additive after immutable Source149; no historic writer or public media mutation',()=>{
 const names=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort();
 assert.equal(names.length,150);
 assert.equal(names.at(-1),'20261028000030_x05_authenticated_owner_service_v1.sql');
 assert.match(sql,/'publicActivationAllowed',false/);
 assert.doesNotMatch(sql,/create (?:or replace )?function public\.community_get_public_media_storage/);
});
test('no caller-provided subject or account in private owner API',()=>{
 assert.match(sql,/v_subject:=private\.dreamsnap_x05_verified_db_subject_v1\(\)/);
 assert.match(sql,/auth\.uid\(\) is distinct from v_subject/);
 assert.match(sql,/v_claims->>'role'/);
 assert.match(sql,/sessions_valid_after/);
 assert.doesNotMatch(sql,/p_auth_subject uuid/);
 assert.doesNotMatch(edge,/(?:body|request|payload)\.accountId|(?:body|request|payload)\.subjectId/);
 assert.match(edge,/withSupabase\(\{auth:'user'\}/);
 assert.match(edge,/community_authorize_session/);
});
test('private Source149 remains not callable by anon/authenticated/service_role',()=>{
 assert.match(sql,/revoke all on function private\.dreamsnap_x05_verified_db_subject_v1\(\)[\s\S]*from public,anon,authenticated,service_role/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_owner_read_v1\(uuid\)[\s\S]*to authenticated/);
 assert.match(sql,/grant execute on function public\.community_dreamsnap_x05_owner_action_v1/);
 assert.doesNotMatch(sql,/grant execute on function private\.dreamsnap_x05_record_creator_grant_v1/);
 assert.doesNotMatch(sql,/grant execute on function private\.dreamsnap_x05_owner_transition_v1/);
 assert.match(config,/\[functions\.community-dreamsnap-owner\]\s+verify_jwt = true/);
 assert.match(edge,/SUPABASE_ANON_KEY/);
 assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('policy TEXT to exact ordinal only with anchored vN; no implicit integer coercion',()=>{
 assert.match(sql,/policy_version ~ '\^v\[1-9\]\[0-9\]\{0,6\}\$'/);
 assert.match(sql,/policyVersionText/);
 assert.match(sql,/policyVersionOrdinal/);
 assert.match(sql,/policy_digest is distinct from p_policy_digest/);
 assert.match(sql,/is_active for share/);
});
test('authenticated owner DTO: frozen entry optional only on Original, WorkID CAS and epoch, purge truthful',()=>{
 assert.match(sql,/'OriginalCompetition'/);
 assert.match(sql,/'PostEventCreation'/);
 assert.match(sql,/jsonb_strip_nulls\(jsonb_build_object/);
 assert.match(sql,/v_ctl\.row_version is distinct from p_expected_row_version/);
 assert.match(sql,/v_ctl\.authorization_epoch is distinct from p_expected_authorization_epoch/);
 assert.match(sql,/'PUBLIC_DISABLED'/);
 assert.match(sql,/'MEDIA_PURGE_PENDING'/);
 assert.match(sql,/'MEDIA_PURGED'/);
 assert.match(sql,/'LEGAL_HOLD'/);
 assert.match(sql,/v_purge\.verified_at is not null/);
 assert.match(sql,/v_purged and v_public_disabled/);
});
test('Edge only private no-store and user-jwt double verification; public activation denied',()=>{
 assert.match(edge,/'Cache-Control':'private, no-store, max-age=0'/);
 assert.match(edge,/'CDN-Cache-Control':'no-store'/);
 assert.match(edge,/Authorization':bearer/);
 assert.match(edge,/rest\/v1\/rpc\//);
 assert.match(edge,/OWNER_RESPONSE_UNAVAILABLE/);
 assert.match(edge,/PUBLIC_ACTIVATION_GUARD/);
 assert.doesNotMatch(edge,/createSignedUrl|storage\.from|community-public-media/);
});
