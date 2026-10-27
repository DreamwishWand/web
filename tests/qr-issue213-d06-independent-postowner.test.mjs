import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(path,'utf8');
const paths={
 sql:'supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql',
 command:'supabase/functions/community-command/index.ts',
 query:'supabase/functions/community-query/index.ts',
 public:'supabase/functions/community-public-query/index.ts',
 results:'supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql',
 detail:'supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql'
};
const v=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,read(p)]));
const expectedSqlBlob='5364449011a06d1b53dff92c4d16bc47305766aa';
const gitBlob = source => {const b=Buffer.from(source);return createHash('sha1').update('blob '+b.length).update(Buffer.from([0])).update(b).digest('hex');};
const functionBody=(signature)=> {
 const marker='create or replace function '+signature;
 const start=v.sql.toLowerCase().indexOf(marker.toLowerCase());
 assert.ok(start>=0,'missing function '+signature);
 const end=v.sql.indexOf('$$;',start);
 assert.ok(end>start,'no end of function '+signature);
 return v.sql.slice(start,end+3);
};
test('F00: exact new Owner Source143 migration blob pinned; never rebase a prior 142 into a substitute',()=>{
 assert.equal(gitBlob(v.sql),expectedSqlBlob);
 assert.equal((v.sql.match(/create table if not exists private\.dreamsnap_official_result_account_consent_r20/g)||[]).length,1);
 assert.match(v.sql,/account_id uuid primary key references public\.wand_accounts\(account_id\)/);
 assert.match(v.sql,/enabled boolean not null default false/);
 assert.doesNotMatch(v.sql,/delete from public\.dreamsnap_official_results/);
});
test('F01 F02: privacy OFF missing row, owner-only RPC and no profile- or field-scoped substitute',()=>{
 const get=functionBody('public.community_dreamsnap_get_account_official_result_consent_r20');
 assert.match(get,/coalesce\(v_enabled,false\)/);
 assert.match(get,/coalesce\(v_version,0\)/);
 assert.match(get,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(v.sql,/revoke all on private\.dreamsnap_official_result_account_consent_r20[\s\S]*?service_role/);
 for(const who of ['anon','authenticated'])assert.match(v.sql,new RegExp('revoke all on function public\\.community_dreamsnap_get_account_official_result_consent_r20\\(uuid\\)[\\s\\S]*?'+who));
 assert.match(v.query,/dreamsnapOfficialAccountConsent: 'community_dreamsnap_get_account_official_result_consent_r20'/);
 assert.doesNotMatch(v.public,/community_dreamsnap_get_account_official_result_consent_r20/);
});
test('F03: ON is deliberate recent session and Account CAS; privacy veto after Account lock',()=>{
 const fn=functionBody('public.community_dreamsnap_set_account_official_result_consent_r20');
 assert.match(fn,/p_enabled boolean/);
 assert.match(fn,/p_acknowledged_scope boolean/);
 assert.match(fn,/if p_enabled then[\s\S]*?p_acknowledged_scope is distinct from true/);
 assert.match(fn,/private\.require_recent_session\([\s\S]*?,300/);
 assert.match(fn,/from public\.wand_accounts[\s\S]*?where account_id=v_account_id for update/);
 assert.match(fn,/private\.account_privacy_suppressions/);
 assert.match(fn,/v_current\.row_version<>p_expected_version/);
 assert.match(fn,/row_version=row_version\+1/);
 assert.match(fn,/publicProjectionAuthorized',false/);
});
test('F04: old per-entry field flags cannot upgrade global disclosure through setter or table',()=>{
 assert.match(v.sql,/update public\.dreamsnap_official_result_publication[\s\S]*?public_fields=array\[\]::text\[\],published_at=null/);
 assert.match(v.sql,/check \(cardinality\(public_fields\)=0 and published_at is null\)/);
 const old=functionBody('public.community_dreamsnap_set_official_result_publication_v1');
 assert.match(old,/raise exception 'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED'/);
 assert.match(v.sql,/revoke all on function public\.community_dreamsnap_set_official_result_publication_v1\(uuid,uuid,text\[\]\)[\s\S]*?service_role/);
 assert.ok(v.command.indexOf("command === 'setDreamsnapOfficialResultPublication'") < v.command.indexOf('const rpc = commandToRpc[command]'),'legacy command dispatch before reject');
 assert.match(v.command,/D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED.*409/);
});
test('F05: ON preference is NOT an official field-publication permit; helper ends unconditionally NULL',()=>{
 const helper=functionBody('private.dreamsnap_public_official_result');
 assert.match(helper,/private\.dreamsnap_official_result_account_consent_r20/);
 assert.match(helper,/e\.managed_under13=false/);
 assert.match(helper,/v_consent is distinct from true/);
 assert.match(helper,/return null;[\s\S]*?return null;/);
 const final=helper.slice(helper.lastIndexOf('return null;'));
 assert.match(final,/^return null;\s*end\s*\$\$;/i);
 assert.doesNotMatch(helper,/jsonb_build_object\(|row_to_json\(|public_fields/);
 assert.match(v.results,/private\.dreamsnap_public_official_result\(e\.entry_id\)/);
 assert.match(v.detail,/private\.dreamsnap_public_official_result\(e\.entry_id\)/);
});
test('F06: public new queries marked no-store; old URL/Media bearer unrevoked, not silently PASS',()=>{
 for(const route of [
 'community_get_dreamsnap_results_public_v1',
 'community_get_gallery_dreamsnap_public_v1',
 'community_search_gallery_dreamsnaps_public_v1',
 'community_list_dreamsnap_result_rounds_public_v1'
 ])assert.ok(v.public.includes(route),route);
 assert.match(v.public,/no-store/);
 assert.doesNotMatch(v.sql,/storage\.objects|delete from storage|storage\.remove/);
});
test('F07: owner-private result read stays wired, 143 cannot imply real signed E2E acceptance',()=>{
 assert.match(v.query,/dreamsnapOfficialAccountConsent/);
 assert.match(v.command,/setDreamsnapOfficialAccountConsent/);
 assert.match(v.command,/D06_RECENT_SESSION_REQUIRED/);
 assert.match(v.command,/params\.p_expected_version = payload\.expectedVersion/);
 assert.match(v.sql,/publicProjectionAuthorized',false/);
});
