import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261025003030_r19_preset_postcommit_read_suppression.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
test('Source139 private work quarantine expands across current and historical Preset and Gallery-linked revisions',()=>{
 assert.match(sql,/join public\.preset_revisions pr on pr\.artifact_blob_id=r\.committed_blob_id/);
 assert.match(sql,/pa\.community_work_id=p_work_id/);
 assert.match(sql,/from public\.gallery_revision_presets gp/);
 assert.match(sql,/wr\.work_id=p_work_id/);
 assert.doesNotMatch(sql.slice(0,2500),/current_published_revision_id/);
});
test('Source139 existing signed Preset Blob, Preset Detail and both Gallery Detail SQL now explicitly veto quarantined read',()=>{
 assert.match(sql,/create or replace function public\.wep_get_accessible_preset_blob/);
 assert.match(sql,/perform private\.preset_storage_assert_blob_readable_r19\(v_blob.blob_id\)/);
 assert.match(sql,/create or replace function public\.community_get_preset/);
 assert.match(sql,/create or replace function public\.community_get_gallery_public_v1/);
 assert.match(sql,/create or replace function public\.community_get_gallery_v1/);
 assert.equal((sql.match(/perform private\.preset_storage_assert_work_readable_r19\(v_work.work_id\)/g)||[]).length,3);
 assert.match(edge,/wep_get_accessible_preset_blob/);
 assert.match(edge,/createSignedUrl/);
});
test('Source139 blocks Search projection reinsertion, and records original affected Work references on incident insertion',()=>{
 assert.match(sql,/after insert on private\.preset_storage_integrity_incidents_r18/);
 assert.match(sql,/delete from public\.search_documents sd/);
 assert.match(sql,/before insert or update on public\.search_documents/);
 assert.match(sql,/R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED/);
 for(const table of ['community_works','search_documents','preset_artifacts']){
  assert.match(sql,new RegExp('as restrictive for select to anon,authenticated'));
  assert.ok(sql.includes('on public.'+table+' as restrictive for select'));
 }
});
test('Source139 operator/readiness/cleanup are version-and-lease-fenced and never grant resolution/physical delete',()=>{
 assert.match(sql,/community_preset_storage_resolution_readiness_r19/);
 assert.match(sql,/r\.reservation_id=p_reservation_id and r\.owner_account_id=v_owner for update/);
 assert.match(sql,/v_res\.state_version<>p_expected_version or v_res\.lease_fence<>p_expected_fence/);
 assert.match(sql,/'versionFencedResolutionAuthorized',false/);
 assert.match(sql,/'operatorApprovalRequired',true/);
 assert.match(sql,/'independentProviderVersionAndBytesRequired',true/);
 assert.match(sql,/'historicalPresetReferenceCount',v_presets/);
 assert.match(sql,/'historicalGalleryReferenceCount',v_galleries/);
 assert.match(sql,/'cloudAndLinkedProfileReferenceGraphProven',false/);
 assert.match(sql,/'previouslyIssuedBearerAndCdnRevocationProven',false/);
 assert.match(sql,/'physicalDeleteAuthorized',false/);
 assert.doesNotMatch(sql,/provider_precondition_accepted=true/);
 assert.doesNotMatch(sql,/incident_state='RESOLVED'/);
 assert.doesNotMatch(sql,/storage\.remove\(|storage\.copy\(/);
});

test('Source139 Gallery media both public proxy and owner read fail closed before signed fallback and bytes',()=>{
 const publicMedia=readFileSync(new URL('../supabase/functions/community-public-media/index.ts',import.meta.url),'utf8');
 const ownerMedia=readFileSync(new URL('../supabase/functions/community-media/index.ts',import.meta.url),'utf8');
 assert.match(sql,/create or replace function public\.community_preset_storage_assert_media_not_quarantined_r19/);
 assert.match(sql,/private\.preset_storage_media_quarantined_r19/);
 assert.match(sql,/from public\.work_revision_media rm/);
 assert.match(sql,/'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED'/);
 assert.match(sql,/preset_storage_media_asset_read_barrier_r19/);
 for(const src of [publicMedia,ownerMedia]){
   const guard=src.indexOf("'community_preset_storage_assert_media_not_quarantined_r19'");
   assert.ok(guard>0);
   const fall=src.indexOf("'community_gallery_media_gateway_v1'")>=0?
       src.indexOf("'community_gallery_media_gateway_v1'"):
       src.indexOf("'community_gallery_owner_media_read_v1'");
   assert.ok(fall>guard,'guard must precede legacy Gallery gateway / raw signed fallback');
   assert.match(src,/MEDIA_INTEGRITY_AUTHORITY_UNAVAILABLE_OR_QUARANTINED/);
 }
});
