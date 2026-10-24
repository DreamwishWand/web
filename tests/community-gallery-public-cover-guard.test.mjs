import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const guard = read('supabase/migrations/20261025000900_gallery_public_historical_cover_issuer_guard_v1.sql');
const ownerGuard = read('supabase/migrations/20261025000800_gallery_owner_historical_cover_issuer_guard_v1.sql');
const edge = read('supabase/functions/community-public-media/index.ts');

test('historical Gallery Cover-only images never fall through to public signed-URL issuer', () => {
  assert.match(guard, /create or replace function public\.community_gallery_media_gateway_v1/);
  // Cover references from immutable Gallery revisions classify as galleryManaged,
  // even if an inconsistent WorkRevision Media membership is missing.
  assert.match(guard, /OR EXISTS\([\s\S]*?gallery_photo_revision_fields f[\s\S]*?f\.cover_media_id=p_media_id[\s\S]*?INTO v_gallery_managed/);
  assert.match(guard, /IF NOT v_gallery_managed THEN[\s\S]*?'galleryManaged',false/);
  // Positive streaming still needs an actual current WorkRevision Media row
  // AND discoverable current published Work + READY/CLEAR Media.
  assert.match(guard, /FROM public\.work_revision_media rm[\s\S]*?JOIN public\.gallery_photo_subjects g/);
  assert.match(guard, /w\.current_published_revision_id=r\.revision_id/);
  assert.match(guard, /private\.is_discoverable_work\(w\.work_id\)/);
  assert.match(guard, /m\.processing_state='ready' and m\.moderation_state='clear'/);
  assert.match(guard, /IF v_media IS NULL THEN[\s\S]*?'galleryManaged',true,'publiclyAccessible',false/);
  assert.match(guard, /grant execute on function public\.community_gallery_media_gateway_v1\(uuid\)\s+to service_role/);
  assert.match(guard, /revoke all on function public\.community_gallery_media_gateway_v1\(uuid\)\s+from public,anon,authenticated/);
  assert.match(ownerGuard, /f\.cover_media_id=p_media_id/);
});

test('public edge checks Gallery classification before legacy DreamSnaps signing', () => {
  const classify = edge.indexOf("'community_gallery_media_gateway_v1'");
  const dispatch = edge.indexOf('if (gallery.galleryManaged === true)');
  const legacySigner = edge.indexOf('.createSignedUrl(String(media.storageKey),300)');
  assert.ok(classify >= 0 && dispatch > classify && legacySigner > dispatch);
  assert.match(edge, /if \(gallery\.publiclyAccessible !== true\)/);
  assert.match(edge, /return reply\(\{ok:false,error:'MEDIA_NOT_PUBLIC'\},404\)/);
  assert.match(edge, /if \(req\.method === 'GET'\) return reply\(\{ok:false,error:'MEDIA_NOT_GALLERY'\},404\)/);
});
