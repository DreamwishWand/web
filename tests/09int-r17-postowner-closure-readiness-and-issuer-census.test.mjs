import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const edge=read('supabase/functions/community-command/index.ts');
const photo=read('supabase/migrations/20261023223000_community_gallery_photo_lifecycle_v1.sql');
const v1=read('supabase/migrations/20261003040500_community_gallery_golden_vertical_v1.sql');
const v2=read('supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql');
const registry=read('supabase/migrations/20261025002890_community_writer_registry_r16.sql');
const paired=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
const wep=read('supabase/functions/wep-preset-artifact/index.ts');
const media=read('supabase/functions/community-media/index.ts');
const publicMedia=read('supabase/functions/community-public-media/index.ts');
const retention=read('supabase/functions/community-retention/index.ts');
const wepRetention=read('supabase/functions/wep-preset-retention/index.ts');
const cloud=read('supabase/migrations/20261025001000_gallery_cloud_preservation_readiness_v1.sql');
const block=(s,start,end) => {const p=s.indexOf(start);assert.ok(p>=0,start); const q=s.indexOf(end,p+start.length);assert.ok(q>p,end);return s.slice(p,q)};

test('Source127 post-Owner closure readiness: legacy Gallery Comments v1/v2 still distinct from new atomic',()=>{
 assert.match(edge,/setGalleryCommentsEnabled: 'community_set_gallery_comments_enabled_v2'/);
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_r16'/);
 const legacy=block(v2,'create or replace function public.community_set_gallery_comments_enabled_v2(','create or replace function private.dreamsnap_apply_work_moderation_effect_v1(');
 assert.match(legacy,/if v_type='gallery' then[\s\S]*community_set_gallery_comments_enabled_v1\(/);
 const galleryOld=block(v1,'create or replace function public.community_set_gallery_comments_enabled_v1(','create or replace function public.community_gallery_author_remove_comment_v1(');
 assert.match(galleryOld,/insert into public.gallery_work_settings/);
 assert.doesNotMatch(galleryOld,/expected_version|expected_current_revision|for update|graph_sha/i);
 assert.match(registry,/'gallery-comments-legacy'[\s\S]{0,170}'SOURCE_PRESENT_UNENROLLED'/);
});
test('Source127 post-Owner closure readiness: legacy Photo update still omits direct-only Artifact guard',()=>{
 assert.match(edge,/publishGalleryPhoto: 'community_publish_gallery_photo_v1'/);
 const current=block(photo,'create or replace function public.community_publish_gallery_photo_v1(','create or replace function public.community_get_gallery_photo_public_v1(');
 const existing=current.slice(current.indexOf('else\n    v_work_id:=p_work_id;'));
 assert.match(existing,/gallery_revision_presets gp/);
 assert.doesNotMatch(existing,/associated_gallery_work_id\s*=\s*p_work_id/);
 const deleted=block(photo,'create or replace function public.community_delete_gallery_photo_v1(','create or replace function private.gallery_photo_public_retirement_guard_v1(');
 assert.match(deleted,/associated_gallery_work_id=p_work_id/);
 assert.match(deleted,/gallery_revision_presets gp/);
});
test('Issuer census: 4 signed read URL call sites + 2 signed upload call sites; one WEP envelope outside Scene paired writer',()=>{
 const rows=[['community-media',media],['community-public-media',publicMedia],['wep-preset-artifact',wep]];
 let readTotal=0, uploadTotal=0;
 const counts=[];
 for(const [name,source] of rows){
  const nRead=(source.match(/\.createSignedUrl\(/g)||[]).length;
  const nUpload=(source.match(/\.createSignedUploadUrl\(/g)||[]).length;
  readTotal+=nRead;uploadTotal+=nUpload;
  counts.push({name,signedRead:nRead,signedUpload:nUpload});
 }
 assert.equal(readTotal,4);
 assert.equal(uploadTotal,2);
 assert.match(wep,/\.copy\(storageKey, publishedStorageKey\)/);
 assert.match(wep,/community_publish_preset_envelope/);
 assert.ok(wep.indexOf('.copy(storageKey, publishedStorageKey)')<wep.indexOf("'community_publish_preset_envelope'"));
 assert.match(media,/\.download\(storageKey\)/);
 assert.match(publicMedia,/\.download\(String\(gallery\.storageKey\)\)/);
 console.log(JSON.stringify({case:'R17_REAL_SOURCE_SIGNED_URL_ISSUER_CENSUS',counts,readIssuerCount:readTotal,uploadIssuerCount:uploadTotal,
  storageCopyAndPublishEnvelopeObserved:true,graphEnrollmentNotProven:true}));
});
test('Storage cleanup, Cloud Native, paired Scene and retry remain separate contracts',()=>{
 assert.match(retention,/\.remove\(batch\)/);
 assert.match(retention,/\.remove\(\[key\]\)/);
 assert.match(wepRetention,/\.remove\(\[storageKey\]\)/);
 assert.match(paired,/private\.scene_save_revision_paired_candidate_v1\(/);
 assert.match(paired,/from public,anon,authenticated,service_role/);
 assert.match(cloud,/'cloudBackupAndRestoreVerified',false/);
 assert.match(cloud,/'cloudPrivateStorageAclVerified',false/);
 assert.match(edge,/const maxAttempts = \(command === 'publishGallery' \|\| command === 'setGalleryCommentsAtomicR16'\) \? 3 : 1;/);
 assert.match(edge,/\['40P01','55P03','40001'\]/);
 assert.match(registry,/'cloud-private-restore'[\s\S]{0,420}'UNKNOWN'/);
 assert.match(registry,/'native-in-game-preset'[\s\S]{0,420}'UNKNOWN'/);
});
test('Exact Source-only audit result is BLOCKED_OWNER_LEGACY_WRITER_CLOSURE, not re-executing old defect',()=>{
 const refs=(registry.match(/^\('[a-z][a-z0-9-]+',/gm)||[]).length;
 console.log(JSON.stringify({result:'R17_POSTOWNER_CLOSURE_READINESS_BLOCKED_SOURCE127',
  currentSourcePin:'dcd63494f212ff2a947cbfe6d19674aa0470b927',
  requiredLegacyGalleryCommentsFixNotFound:true,requiredPhotoDirectLinkFixNotFound:true,
  actualPostFixTwoSessionExecuted:false,signedStagingExecuted:false,
  sourceFullyEnrolled:0,graphComplete:false,retirementAuthorized:false}));
});
