import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const originalSearch=source('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
const originalDetail=source('supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql');
const delta=source('supabase/migrations/20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql');
const accepted144=source('supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql');
const numeric143=source('supabase/migrations/20261027000000_d06_dreamsnaps_account_global_official_consent.sql');
const incident141=source('supabase/migrations/20261025003050_r19_direct_media_sql_issuer_authority.sql');
const fn=(s,name)=>{
 const p=s.indexOf('create or replace function '+name+'(');
 assert.ok(p>=0,name);
 const end=s.indexOf('\n$$;',p);
 assert.ok(end>p,name);
 return s.slice(p,end+4);
};
test('Source145 is additive after accepted Source144 and retains original Search/Detail signatures and JSON shape',()=>{
 const oldS=fn(originalSearch,'public.community_search_gallery_dreamsnaps_public_v1');
 const oldD=fn(originalDetail,'public.community_get_gallery_dreamsnap_public_v1');
 const nowS=fn(delta,'public.community_search_gallery_dreamsnaps_public_v1');
 const nowD=fn(delta,'public.community_get_gallery_dreamsnap_public_v1');
 assert.match(oldS,/security definer/);
 assert.match(oldD,/security definer/);
 assert.doesNotMatch(oldS,/private\.dreamsnap_public_work_accessible_r20/);
 assert.doesNotMatch(oldD,/private\.dreamsnap_public_work_accessible_r20/);
 assert.match(nowS,/p_query text default null/);
 assert.match(nowS,/p_limit integer default 30/);
 assert.match(nowD,/p_work_id uuid/);
 assert.match(nowS,/'workId',x\.work_id/);
 assert.match(nowS,/'mediaId',x\.media_id/);
 assert.match(nowD,/'caption',dr\.caption/); // FINAL Source44600, not Source44500
 assert.match(nowD,/'officialResult',private\.dreamsnap_public_official_result\(e\.entry_id\)/);
 assert.match(nowD,/'comments',case when gp\.comments_enabled/);
 assert.doesNotMatch(delta,/create table|drop table|alter table|storage\.copy|storage\.remove|physicalDeleteAuthorized\s*=\s*true/i);
});
test('Search and Detail call exact Source144 Account/Identity/Privacy/Creator guard, and preserve legitimate public/eligible media correlation',()=>{
 const s=fn(delta,'public.community_search_gallery_dreamsnaps_public_v1');
 const d=fn(delta,'public.community_get_gallery_dreamsnap_public_v1');
 const guard=fn(accepted144,'private.dreamsnap_public_work_accessible_r20');
 assert.match(guard,/private\.is_discoverable_work\(w\.work_id\)/);
 assert.match(guard,/ai\.identity_state='active'/);
 assert.match(guard,/a\.status='active'/);
 assert.match(s,/private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/);
 assert.equal((d.match(/private\.dreamsnap_public_work_accessible_r20\(/g)||[]).length,2);
 for(const n of [s,d]){
  assert.match(n,/gp\.work_id=e\.work_id/);
  assert.match(n,/e\.account_id=/);
  assert.match(n,/e\.managed_under13=false/);
  assert.match(n,/gp\.publication_state='published'/);
  assert.match(n,/c\.lifecycle_state in \('results','closed'\)/);
  assert.match(n,/e\.eligibility_state='eligible'/);
  assert.match(n,/m\.processing_state='ready'/);
  assert.match(n,/m\.moderation_state='clear'/);
  assert.match(n,/m\.purged_at is null/);
  assert.match(n,/cr\.work_id=/);
 }
 assert.doesNotMatch(s,/dreamsnap_official_result_account_consent_r20/);
 assert.doesNotMatch(d,/dreamsnap_official_result_account_consent_r20/);
 assert.match(numeric143,/return null;[\s\S]*return null;/);
 assert.match(incident141,/perform public\.community_preset_storage_assert_media_not_quarantined_r19\(p_media_id\)/);
 assert.match(accepted144,/perform public\.community_preset_storage_assert_media_not_quarantined_r19\(p_media_id\)/);
});
