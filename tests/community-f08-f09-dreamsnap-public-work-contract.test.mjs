import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql');
const historic=read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
const consent=read('supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql');
const edge=read('supabase/functions/community-public-media/index.ts');
const publicQuery=read('supabase/functions/community-public-query/index.ts');
const fn=(src,name)=>{
 const start=src.indexOf('create or replace function '+name+'(');
 assert.ok(start>=0,name);
 const end=src.indexOf('\n$$;',start);
 assert.ok(end>start,name);
 return src.slice(start,end+4);
};
test('F08 all THREE original OR branches preserved; DreamSnaps gallery and Entry paths need Work public predicate and pinned owned Media',()=>{
 const original=fn(historic,'public.community_get_public_media_storage_v2');
 const patched=fn(sql,'public.community_get_public_media_storage_v2');
 assert.equal((patched.match(/\bor exists\(/g)||[]).length,2);
 assert.equal((original.match(/\bor exists\(/g)||[]).length,2);
 assert.match(patched,/w\.work_type='gallery'[\s\S]*private\.is_discoverable_work\(w\.work_id\)/);
 assert.equal((patched.match(/private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/g)||[]).length,2);
 assert.match(patched,/e\.account_id=w\.owner_account_id/);
 assert.match(patched,/cr\.revision_id=wrm\.work_revision_id and cr\.work_id=w\.work_id/);
 assert.match(patched,/wrm\.role='dreamsnap' and wrm\.ordinal=0/);
 assert.match(patched,/gp\.publication_state='published'/);
 assert.match(patched,/m\.processing_state='ready'/);
 // The effective Source141/142 function has a FIRST-STATEMENT Incident veto.
 // Never replace it with a historical unguarded Source44500 body.
 assert.match(patched,/begin\s+--[^\n]*\n\s+--[^\n]*\n\s+perform public\.community_preset_storage_assert_media_not_quarantined_r19\(p_media_id\);/);
 assert.ok(patched.indexOf('perform public.community_preset_storage_assert_media_not_quarantined_r19') < patched.indexOf('select jsonb_build_object'));

 assert.match(patched,/raise exception 'Public media is not accessible'/);
});
test('F09 public WAND results use the same effective Work guard, revision equality, real owner media/phase and creator while official numeric gate still NULL',()=>{
 const r=fn(sql,'public.community_get_dreamsnap_results_public_v1');
 assert.match(r,/private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/g);
 assert.equal((r.match(/private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/g)||[]).length,2);
 assert.match(r,/r\.entry_revision_id=e\.entry_revision_id/);
 assert.match(r,/m\.owner_account_id=w\.owner_account_id/);
 assert.match(r,/dr\.integrity_state='eligible'/);
 assert.match(r,/e\.managed_under13=false/);
 assert.match(r,/cp\.profile_visibility='public'/);
 assert.match(r,/and is_synthetic=false/); // defined in Challenge lookup
 assert.match(consent,/create or replace function private\.dreamsnap_public_official_result/);
 const priv=fn(consent,'private.dreamsnap_public_official_result');
 assert.match(priv,/return null;[\s\S]*return null;/);
 assert.doesNotMatch(r,/dreamsnap_official_result_account_consent_r20/);
});
test('Shared private guard reuses accepted R12 privacy/Work authorization instead of creating Account/Work/Entry models',()=>{
 const shared=fn(sql,'private.dreamsnap_public_work_accessible_r20');
 for(const t of ["w.work_type='dreamsnap'","w.lifecycle_state='published'","w.visibility='public'","w.moderation_state='clear'","a.status='active'","a.deleted_at is null","cp.profile_visibility='public'","cp.moderation_state='clear'","private.is_discoverable_work(w.work_id)","ai.identity_state='active'"])assert.ok(shared.includes(t),t);
 assert.match(sql,/revoke all on function private\.dreamsnap_public_work_accessible_r20\(uuid\)[\s\S]*?service_role/);
 assert.doesNotMatch(sql,/create table|alter table|storage\.copy|storage\.remove|drop function|publishedStorageKey|provider_precondition_accepted\s*=\s*true/i);
 assert.doesNotMatch(shared,/dreamsnap_official_result_account_consent_r20/);
 assert.ok(edge.includes('community_get_public_media_storage_v2'));
 assert.ok(publicQuery.includes('community_get_dreamsnap_results_public_v1'));
});
