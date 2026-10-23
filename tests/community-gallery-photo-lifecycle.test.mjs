import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/migrations/20261023223000_community_gallery_photo_lifecycle_v1.sql');
const seal=read('supabase/migrations/20261023223400_community_gallery_photo_existing_seal_trigger_v1.sql');
const cmd=read('supabase/functions/community-command/index.ts');
const pub=read('supabase/functions/community-public-query/index.ts');
const contract=read('src/lib/community/gallery-photo-contract.ts');

test('new Gallery photo contract has exact classifications and versioned trusted subject registry',()=>{
  for(const v of ['gallery_verified_subjects','gallery_photo_subjects','gallery_photo_revision_fields',
    'community_publish_gallery_photo_v1','community_delete_gallery_photo_v1','community_get_gallery_photo_public_v1'])
    assert.ok(schema.includes(v),v);
  assert.match(schema,/verification_state='verified'/);
  assert.match(schema,/build_id='52BD625D9B4E0053'/);
  assert.match(schema,/game_version='1.25.0'/);
  assert.match(schema,/gallery_kind='indoor' and subject_type='room'/);
  assert.match(schema,/tom_clothing' and subject_type='tom_clothing' and base_item_id>0/);
  assert.match(schema,/tom_furniture' and subject_type='tom_furniture' and base_item_id>0/);
  assert.match(schema,/revoke all on public.gallery_verified_subjects from public,anon,authenticated/);
});

test('atomic new published work and safe immutable update use existing revision guard',()=>{
  assert.match(schema,/community_create_gallery_work_v1\(/);
  assert.match(schema,/community_publish_gallery_v4\(/);
  assert.match(schema,/GALLERY_ROW_VERSION_CONFLICT/);
  assert.match(schema,/GALLERY_SUBJECT_OR_CREATOR_IMMUTABLE/);
  assert.match(schema,/GALLERY_IDEMPOTENCY_CONFLICT/);
  assert.match(schema,/GALLERY_MEDIA_ALREADY_PUBLIC_ON_DIFFERENT_WORK/);
  assert.match(seal,/insert into public.gallery_work_revisions/);
  assert.match(seal,/update public.community_works set current_published_revision_id=v_revision/);
  assert.doesNotMatch(seal,/update public.community_work_revisions set sealed_at=now/);
  assert.match(schema,/p_cover_media_id=any\(p_media_ids\)/);
  assert.match(schema,/m.owner_account_id=v_account/);
  assert.match(schema,/m.processing_state='ready'/);
});

test('Delete and Cloud Unpublish are guarded by evidence and 09 INT linkage',()=>{
  assert.match(schema,/GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED/);
  assert.match(schema,/GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED/);
  assert.match(schema,/gallery_photo_public_retirement_guard before update/);
  assert.match(schema,/public.community_delete_work\(/);
  assert.match(contract,/immediateIssuedSignedUrlRevocationProven:false/);
  assert.match(contract,/cloudPrivateKeepAuthorized:false/);
});

test('Edge uses existing signed authorization, rate and public allowlist',()=>{
  assert.match(cmd,/publishGalleryPhoto: 'community_publish_gallery_photo_v1'/);
  assert.match(cmd,/deleteGalleryPhoto: 'community_delete_gallery_photo_v1'/);
  assert.match(cmd,/publishGalleryPhoto: 'gallery_write'/);
  assert.match(cmd,/deleteGalleryPhoto: 'gallery_write'/);
  assert.match(pub,/'community_get_gallery_photo_public_v1'/);
  assert.match(pub,/rpc === 'community_get_gallery_photo_public_v1'/);
  assert.match(schema,/revoke execute on function public.community_publish_gallery_photo_v1[\s\S]+?from public,anon,authenticated/);
  assert.match(schema,/grant execute on function public.community_publish_gallery_photo_v1[\s\S]+?to service_role/);
});

test('rollback SQL exercises RPCs not only static rules',()=>{
  const sql=read('supabase/staging/acceptance/gallery-photo-public-lifecycle-v1.sql');
  assert.match(sql,/^begin;/);
  assert.match(sql,/rollback;\s*$/);
  for(const code of ['ACCEPTANCE_DUPLICATE_MEDIA_ACCEPTED','ACCEPTANCE_MISSING_ATTESTATION_ACCEPTED',
    'ACCEPTANCE_UNVERIFIED_KIND_ACCEPTED','ACCEPTANCE_IDEMPOTENCY_REPLAY_FAILED',
    'ACCEPTANCE_NONOWNER_UPDATE_ACCEPTED','ACCEPTANCE_STALE_WRITE_ACCEPTED',
    'ACCEPTANCE_PRIVATE_PRESERVATION_BYPASS','ACCEPTANCE_DELETED_DIRECT_READ_ACCESSIBLE',
    'ACCEPTANCE_DELETED_MEDIA_RESOLVER_ACCESSIBLE'])
    assert.ok(sql.includes(code),code);
});
