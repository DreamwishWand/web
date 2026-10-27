import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=r('supabase/migrations/20261025002960_gallery_photo_media_readonly_preflight_r17.sql');
const edge=r('supabase/functions/community-query/index.ts');
const workflow=r('.github/workflows/comm-clean-bootstrap-acceptance.yml');
test('R17 Photo/Media/Cover graph observation is owner-only metadata and not a writer fence',()=>{
  assert.match(sql,/create or replace function public\.community_gallery_photo_media_preflight_r17\(/);
  assert.match(sql,/language plpgsql stable security definer/);
  assert.match(sql,/private\.resolve_active_account\(p_auth_subject\)/);
  assert.match(sql,/owner_account_id=v_account/);
  assert.match(sql,/R17_PHOTO_PREFLIGHT_FORBIDDEN/);
  assert.match(sql,/public\.community_work_revisions/);
  assert.match(sql,/public\.work_revision_media/);
  assert.match(sql,/public\.media_assets/);
  assert.match(sql,/public\.gallery_photo_revision_fields/);
  assert.match(sql,/public\.preset_artifacts/);
  assert.match(sql,/public\.gallery_revision_presets/);
  assert.match(sql,/associated_gallery_work_id=v_work\.work_id/);
  for(const marker of ['DATABASE_METADATA_ONLY','actualStorageBytesVerified','metadataSha256IsStorageProof',
    'priorSignedUrlsRevoked','cdnBrowserPurgeProven','storageIssuerGraphComplete',
    'graphComplete','snapshotNotAtomicMutationFence','mutationAuthorized','saveRevisionAuthorized',
    'pairedGalleryPublishAuthorized','retirementAuthorized','physicalCleanupAuthorized']) {
    assert.ok(sql.includes(marker),marker);
  }
  assert.doesNotMatch(sql,/\b(?:insert into|update public\.|delete from|createSignedUrl|createSignedUploadUrl|storage_key)\b/i);
  assert.match(sql,/revoke all on function public\.community_gallery_photo_media_preflight_r17\(uuid,uuid\)\s+from public,anon,authenticated,service_role/);
  assert.match(sql,/grant execute on function public\.community_gallery_photo_media_preflight_r17\(uuid,uuid\)\s+to service_role/);
});
test('R17 photo preflight is only exposed via authenticated user query and cannot mint a storage bearer',()=>{
  assert.match(edge,/withSupabase\(\{ auth: 'user' \}/);
  assert.match(edge,/community_authorize_session/);
  assert.match(edge,/galleryPhotoMediaPreflight: 'community_gallery_photo_media_preflight_r17'/);
  assert.match(edge,/case 'galleryPhotoMediaPreflight':/);
  assert.match(edge,/params\.p_gallery_work_id=payload\.workId/);
  assert.match(edge,/R17_PHOTO_PREFLIGHT_FORBIDDEN/);
  assert.doesNotMatch(edge,/createSignedUrl|createSignedUploadUrl/);
});
test('local bootstrap requires exactly 139 ordered migrations and verifies R17 read-only service ACL',()=>{
  assert.match(workflow,/assert len\(fs\)==145/);
  assert.match(workflow,/IF v<>145 THEN/);
  assert.match(workflow,/R17_PHOTO_MEDIA_PREFLIGHT_MISSING/);
  assert.match(workflow,/R17_PHOTO_MEDIA_PREFLIGHT_ACL_EXPOSED/);
  assert.match(workflow,/20261025002960_gallery_photo_media_readonly_preflight_r17\.sql/);
});

test('R17-X02 additive cover-ordinal guard agrees with coverFirst on current and historical revisions',()=>{
 const fix=r('supabase/migrations/20261025002970_r17_photo_cover_ordinal_consistency.sql');
 assert.match(fix,/create or replace function public\.community_gallery_photo_media_preflight_r17\(/);
 const coverFirst=fix.indexOf("'coverFirst',exists(");
 const mismatch=fix.indexOf("count(*) filter(where f.subject_id is distinct");
 const source=fix.indexOf("into v_covers,v_cover_mismatch_count");
 assert.ok(coverFirst>=0&&mismatch>coverFirst&&source>mismatch);
 assert.match(fix.slice(mismatch,source),/and rm\.ordinal=0\)\)/);
 assert.match(fix,/MEDIA_COVER_METADATA_INCONSISTENT/);
 assert.doesNotMatch(fix,/\b(?:insert into|update public\.|delete from|createSignedUrl|createSignedUploadUrl)\b/i);
 assert.match(fix,/revoke all on function public\.community_gallery_photo_media_preflight_r17\(uuid,uuid\)/);
 assert.match(fix,/grant execute on function public\.community_gallery_photo_media_preflight_r17\(uuid,uuid\)\s+to service_role/);
 assert.match(workflow,/20261025002970_r17_photo_cover_ordinal_consistency\.sql/);
});
