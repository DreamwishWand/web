import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source139=read('supabase/migrations/20261025003030_r19_preset_postcommit_read_suppression.sql');
const query=read('supabase/functions/community-query/index.ts');
const oldWork=read('supabase/migrations/20260930031310_community_core_v0_query_rpc.sql');
const oldGallery=read('supabase/migrations/20261003040500_community_gallery_golden_vertical_v1.sql');
const oldPrivacy=read('supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql');

function functionSql(sql,name){
 const i=sql.toLowerCase().indexOf('create or replace function '+name.toLowerCase()+'(');
 assert.ok(i>=0,'Missing SQL function '+name);
 const rest=sql.slice(i);
 const end=rest.indexOf('\ncreate or replace function ',1);
 return end<0?rest:rest.slice(0,end);
}
const incident=/preset_storage_(?:work_quarantined|assert_work_readable|blob_quarantined|assert_blob_readable)_r19|preset_storage_integrity_incidents_r18/i;

test('SOURCE139 SNAPSHOT ONLY: new authenticated Work detail is not enrolled in incident read gate',()=>{
 assert.match(source139,/preset_storage_assert_work_readable_r19/);
 assert.match(query,/work:\s*'community_get_work'/);
 const work=functionSql(oldWork,'public.community_get_work');
 assert.match(work,/private\.can_access_work/);
 assert.doesNotMatch(work,incident);
 assert.doesNotMatch(source139,/create or replace function public\.community_get_work\s*\(/i);
});
test('SOURCE139 SNAPSHOT ONLY: Owner My Gallery and Saved projections use pre-incident entity predicates',()=>{
 assert.match(query,/myGallery:\s*'community_get_my_gallery_v1'/);
 assert.match(query,/saved:\s*'community_get_saved'/);
 const gallery=functionSql(oldGallery,'public.community_get_my_gallery_v1');
 const saved=functionSql(oldWork,'public.community_get_saved');
 assert.match(gallery,/community_works/);
 assert.match(saved,/private\.can_access_entity/);
 assert.doesNotMatch(gallery,incident);
 assert.doesNotMatch(saved,incident);
 assert.doesNotMatch(source139,/create or replace function public\.community_get_my_gallery_v1\s*\(/i);
 assert.doesNotMatch(source139,/create or replace function public\.community_get_saved\s*\(/i);
});
test('SOURCE139 SNAPSHOT ONLY: currently tested suppression graph and unknown direct historical linkage remain distinct',()=>{
 assert.match(source139,/from public\.gallery_revision_presets gp/);
 assert.match(source139,/after insert on private\.preset_storage_integrity_incidents_r18/);
 assert.match(source139,/R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED/);
 assert.match(oldPrivacy,/private\.is_discoverable_work\(d\.work_id\)/);
 assert.doesNotMatch(source139,/associated_gallery_work_id/i);
 assert.match(source139,/'cloudAndLinkedProfileReferenceGraphProven',false/);
 assert.match(source139,/'previouslyIssuedBearerAndCdnRevocationProven',false/);
});
