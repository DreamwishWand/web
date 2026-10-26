import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const sql=get('supabase/migrations/20261025003040_r19_reader_history_graph_gap_closure.sql');
const publicEdge=get('supabase/functions/community-public-query/index.ts');
const authEdge=get('supabase/functions/community-query/index.ts');
test('Source140 authentic Work / MyGallery / Saved actual SECURITY DEFINER SQL has denial and list omission',()=>{
  for(const f of ['community_get_work','community_get_my_gallery_v1','community_get_saved']) {
    assert.match(sql,new RegExp('create or replace function public\\.'+f+'\\('));
    assert.match(sql,new RegExp('revoke all on function public\\.'+f+'\\('));
  }
  assert.match(sql,/perform private\.preset_storage_assert_work_readable_r19\(p_work_id\)/);
  assert.match(sql,/not private\.preset_storage_saved_target_quarantined_r19\(target_entity_id\)/);
  assert.match(sql,/not private\.preset_storage_work_quarantined_r19\(work_id\)/);
  assert.match(authEdge,/PROVIDER_INTEGRITY_READ_SUPPRESSED/);
});
test('Source140 direct association and historical revision both gate affected Work and Search',()=>{
  assert.match(sql,/pa\.associated_gallery_work_id=p_work_id/);
  assert.match(sql,/select pa\.associated_gallery_work_id as work_id/);
  assert.match(sql,/from public\.gallery_revision_presets gp/);
  assert.match(sql,/delete from public\.search_documents sd/);
  assert.doesNotMatch(sql,/incident_state='RESOLVED'/);
});
test('Source140 direct SQL Media gateway denies before any storage key projection',()=>{
  const b=sql.slice(sql.indexOf('create or replace function public.community_gallery_media_gateway_v1('));
  assert.ok(b.indexOf('perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id)')
    < b.indexOf("'storageKey',m.storage_key"));
  assert.match(sql,/grant execute on function public\.community_gallery_media_gateway_v1\(uuid\) to service_role/);
});
test('Stage-only Scene reader defaults to closed at Edge, and conditional SQL EXECUTE revocation requires operator sequencing',()=>{
  assert.match(publicEdge,/rpc === 'community_get_scene_preset_public_v1'\) \{/);
  assert.match(publicEdge,/SCENE_PUBLIC_READER_COMPATIBILITY_UNVERIFIED/);
  assert.match(sql,/to_regprocedure\('public\.community_get_scene_preset_public_v1\(uuid\)'\)/);
  assert.match(sql,/revoke execute on function public\.community_get_scene_preset_public_v1\(uuid\)/);
});
test('Preserves immutable incident / negative provider and physical cleanup policy',()=>{
  for(const s of ['storage.copy(', 'storage.remove(', 'physicalDeleteAuthorized=true','provider_precondition_accepted=true']){
    assert.ok(!sql.includes(s),s);
  }
});
