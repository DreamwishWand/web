import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const load=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlob=(s)=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const source155=load('supabase/migrations/20261102010000_community_source155_verified_first_account_bootstrap.sql');
const source156=load('supabase/migrations/20261103010000_community_source156_signed_gallery_r16_atomic_writer.sql');
const edge=load('supabase/functions/community-command/index.ts');
const registry=load('supabase/migrations/20261025002890_community_writer_registry_r16.sql');
const r17v1=load('supabase/migrations/20261025002920_r17_legacy_gallery_comments_v1_closed.sql');
const r17v2=load('supabase/migrations/20261025002930_r17_legacy_gallery_comments_v2_dreamsnaps_preserved.sql');
const media=load('supabase/functions/community-media/index.ts');
const preset=load('supabase/functions/wep-preset-artifact/index.ts');
const account=load('supabase/functions/community-account/index.ts');
const admin=load('supabase/functions/community-admin/index.ts');
const query=load('supabase/functions/community-query/index.ts');
const owner=load('supabase/functions/community-dreamsnap-owner/index.ts');
const scene=load('supabase/functions/wep-scene-preset-product/index.ts');
const publicMedia=load('supabase/functions/community-public-media/index.ts');
const notes=load('docs/community/post327-remaining-writer-route-audit-20261103.md');

test('fix Source155 and Source156 at independently accepted PR327 SQL/Edge blobs',()=>{
 assert.equal(gitBlob(source155),'115f2c0f7224984acd8830cfc606af8c6a1bf3af');
 assert.equal(gitBlob(source156),'3000d66c193b996e4ece785deaf5180955ec3bc6');
 assert.equal(gitBlob(edge),'5a691408e50782db3dc4aa70aacf5c1b60cff0b7'); // W-COMM-006 Edge-only delta
 assert.match(source156,/for share;/);
 assert.match(source156,/community_authorize_signed_session_v2/);
 assert.match(source156,/revoke all on function public\.community_set_gallery_comments_enabled_atomic_r16/);
 assert.match(source156,/grant execute on function public\.community_set_gallery_comments_enabled_atomic_signed_v1/);
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_signed_v1'/);
 assert.match(edge,/ensureAccountCreator: 'community_ensure_account_creator_signed_v1'/);
});

test('inventory all 18 R16 registry rows, do not generalize R16 signed Writer',()=>{
 const after=registry.slice(registry.indexOf('insert into private.community_writer_routes_r16'));
 const keys=Array.from(after.matchAll(/^\('([a-z0-9-]+)',/gm),m=>m[1]);
 assert.equal(keys.length,18);
 assert.equal(new Set(keys).size,18);
 for(const k of ['gallery-pinned-scene-publish','gallery-legacy-v4-scene',
 'gallery-photo-publish','gallery-media-open','gallery-media-complete','gallery-media-cancel',
 'gallery-comments-legacy','gallery-comments-pinned-r16','preset-envelope','scene-paired-revision',
 'dreamsnap-publish','qa-question-tip','guide-curated','community-moderation-restrict',
 'account-privacy-suppress','gallery-positive-retire','cloud-private-restore','native-in-game-apply']){
   assert.ok(keys.includes(k),k);
   assert.ok(notes.includes(k),'audit missing '+k);
 }
 assert.match(notes,/NO NEW CONFIRMED P0/);
});

test('legacy Gallery V1/V2 failclosed Gallery only; DreamSnaps V2 still mutates',()=>{
 assert.match(r17v1,/raise exception 'R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED'/);
 assert.match(r17v2,/if v_type='gallery' then[\s\S]*R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED/);
 assert.match(r17v2,/update public\.dreamsnap_gallery_publications/);
 assert.match(r17v2,/update public\.search_documents/);
 assert.match(r17v2,/insert into public\.audit_events/);
 assert.doesNotMatch(r17v2,/community_authorize_signed_session_v2/);
 assert.match(notes,/QA_PENDING \(DreamSnaps\)/);
});

test('signed Edge preflight exists, but only R16 has the new in-transaction guard',()=>{
 for(const [name,src] of [
 ['command',edge],['query',query],['admin',admin],
 ['media',media],['preset',preset],['owner',owner],['scene',scene]
 ]){
  assert.match(src,/community_authorize_signed_session_v2/,name+' preflight');
  assert.match(src,/withSupabase\(\{\s*auth:\s*'user'\s*\}/,name+' user JWT');
 }
 assert.match(edge,/const maxAttempts = \(command === 'publishGallery' \|\| command === 'setGalleryCommentsAtomicR16'\) \? 3 : 1/);
 assert.match(edge,/attempt > 0[\s\S]*community_authorize_session/);
 assert.match(edge,/publishGallery: 'community_publish_gallery_pinned_r15'/);
 assert.match(edge,/setGalleryCommentsEnabled: 'community_set_gallery_comments_enabled_v2'/);
 assert.match(account,/community_request_privacy_suppression_v1/);
 assert.match(account,/p_session_id: sessionId/);
 assert.match(admin,/community_authorize_signed_session_v2/);
 assert.match(notes,/P0 ONLY/);
});

test('physical media issuer, Preset and Scene publisher NOT accepted as R16',()=>{
 assert.match(media,/createSignedUrl\(/);
 assert.match(preset,/createSignedUrl\(/);
 assert.match(publicMedia,/createSignedUrl\(/);
 assert.match(scene,/R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED/);
 assert.match(scene,/publicationAuthorized:false/);
 assert.match(preset,/community_preset_storage_reserve_r18/);
 assert.match(preset,/community_preset_storage_recovery_r18/);
 assert.match(owner,/DB commit is the authority/);
 assert.match(notes,/MANAGED_PENDING/);
 assert.match(notes,/INDEPENDENT_TARGETED_PASS/);
});
test('W-COMM-006: legacy DreamSnaps comments Edge is OFF after signed v2 and before service-role RPC',()=>{
 const signed=edge.indexOf("'community_authorize_signed_session_v2'");
 const guard=edge.indexOf("if (command === 'setGalleryCommentsEnabled') {");
 const rate=edge.indexOf('const rateBucket = commandToRateBucket[command]');
 const dbWrite=edge.indexOf('ctx.supabaseAdmin.rpc(rpc,params)');
 assert.ok(signed>=0 && signed<guard && guard<rate && rate<dbWrite,
   'Legacy gate must preserve signed revoke 401 and avoid rate/DB mutation');
 assert.match(edge,/R17_LEGACY_COMMENTS_WRITER_NOT_ENROLLED'\},409/);
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_signed_v1'/);
 assert.match(r17v2,/update public\.dreamsnap_gallery_publications/);
 assert.doesNotMatch(r17v2,/community_authorize_signed_session_v2/);
});
