import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql = read('supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql');
const command = read('supabase/functions/community-command/index.ts');
const query = read('supabase/functions/community-query/index.ts');
const publicQuery = read('supabase/functions/community-public-query/index.ts');
const original = read('supabase/migrations/20261003044800_community_dreamsnaps_ingame_result_provenance_v1.sql');
const detail = read('supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql');
const result = read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');

test('D06 consent is exactly one per Wand Account, absent OFF and CAS under Account row lock',()=>{
  assert.match(sql,/create table if not exists private\.dreamsnap_official_result_account_consent_r20/);
  assert.match(sql,/account_id uuid primary key references public\.wand_accounts\(account_id\)/);
  assert.match(sql,/enabled boolean not null default false/);
  assert.match(sql,/p_expected_version bigint/);
  assert.match(sql,/where account_id=v_account_id for update/);
  assert.match(sql,/where account_id=v_account_id for update;/);
  assert.match(sql,/D06_STALE_ACCOUNT_CONSENT/);
  assert.match(sql,/row_version=row_version\+1/);
  assert.match(sql,/coalesce\(v_enabled,false\)/);
  assert.match(sql,/coalesce\(v_version,0\)/);
  assert.doesNotMatch(sql,/create table[^;]*\b(work_id|entry_id|challenge_id|workspace_id)\b[^;]*primary key/i);
});

test('D06 ON requires explicit worldwide scope acknowledgment and actual session-bound recent authentication; privacy suppression veto after account lock',()=>{
  assert.match(sql,/p_acknowledged_scope boolean/);
  assert.match(sql,/if p_acknowledged_scope is distinct from true/);
  assert.match(sql,/private\.require_recent_session\([\s\S]*?p_auth_subject,p_session_id,p_issued_at_epoch,300/);
  assert.match(sql,/perform public\.community_authorize_session\(p_auth_subject,p_issued_at_epoch,null\)/);
  assert.match(sql,/private\.account_privacy_suppressions/);
  assert.ok(sql.indexOf("where account_id=v_account_id for update;") < sql.indexOf("where account_id=v_account_id\n  ) then"));
  assert.match(command,/setDreamsnapOfficialAccountConsent: 'community_dreamsnap_set_account_official_result_consent_r20'/);
  assert.match(command,/D06_RECENT_SESSION_REQUIRED/);
  assert.match(command,/D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED/);
  assert.match(command,/params\.p_session_id/);
});

test('D06 neutralizes ALL legacy per-entry and field opt-ins, including service-role direct SQL, without touching private ingested results',()=>{
  assert.match(sql,/update public\.dreamsnap_official_result_publication[\s\S]*?public_fields=array\[\]::text\[\],published_at=null/);
  assert.match(sql,/add constraint dreamsnap_legacy_publication_disabled_r20/);
  assert.match(sql,/check \(cardinality\(public_fields\)=0 and published_at is null\)/);
  assert.match(sql,/create or replace function public\.community_dreamsnap_set_official_result_publication_v1/);
  assert.match(sql,/D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED/);
  assert.match(sql,/revoke all on function public\.community_dreamsnap_set_official_result_publication_v1\(uuid,uuid,text\[\]\)[\s\S]*?service_role/);
  assert.doesNotMatch(sql,/delete from public\.dreamsnap_official_results|drop table public\.dreamsnap_official_results/i);
  assert.match(original,/community_dreamsnap_ingest_ingame_result_v1/);
});

test('D06 public official Result projection remains NULL EVEN WHEN global consent ON; current public Results/Gallery share the guarded helper',()=>{
  const start=sql.indexOf('create or replace function private.dreamsnap_public_official_result(');
  assert.ok(start>=0);
  const pubHelper=sql.slice(start,sql.indexOf('$$;',start)+3);
  assert.match(pubHelper,/private\.dreamsnap_official_result_account_consent_r20/);
  assert.match(pubHelper,/v_consent is distinct from true/);
  assert.match(pubHelper,/e\.managed_under13=false/);
  assert.match(pubHelper,/return null;[\s\S]*?return null;/);
  assert.doesNotMatch(pubHelper,/public_fields|jsonb_build_object\('score'|'rank'|'moonstones'|'pixelDust'/);
  assert.match(result,/private\.dreamsnap_public_official_result\(e\.entry_id\)/);
  assert.match(detail,/private\.dreamsnap_public_official_result\(e\.entry_id\)/);
  assert.match(publicQuery,/rpc === 'community_get_dreamsnap_results_public_v1'/);
  assert.match(publicQuery,/rpc === 'community_get_gallery_dreamsnap_public_v1'/);
  assert.match(publicQuery,/rpc === 'community_search_gallery_dreamsnaps_public_v1'/);
});

test('Owner-private official results unaffected; new owner Account consent read is auth-only with no public SQL grants',()=>{
  assert.match(query,/dreamsnapOfficialAccountConsent: 'community_dreamsnap_get_account_official_result_consent_r20'/);
  assert.match(query,/case 'dreamsnapOfficialAccountConsent':/);
  assert.match(sql,/revoke all on private\.dreamsnap_official_result_account_consent_r20[\s\S]*?service_role/);
  assert.match(sql,/grant execute on function public\.community_dreamsnap_get_account_official_result_consent_r20\(uuid\)[\s\S]*?to service_role/);
  assert.doesNotMatch(publicQuery,/community_dreamsnap_get_account_official_result_consent_r20/);
  assert.match(result,/'officialResult',x\.official_result/);
  assert.match(result,/e\.account_id=v_account_id/);
  assert.match(sql,/publicProjectionAuthorized',false/);
});
