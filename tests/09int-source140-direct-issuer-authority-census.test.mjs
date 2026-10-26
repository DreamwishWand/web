import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file,import.meta.url),'utf8');
const m140 = read('supabase/migrations/20261025003040_r19_reader_history_graph_gap_closure.sql');
const publicMedia = read('supabase/functions/community-public-media/index.ts');
const ownerMedia = read('supabase/functions/community-media/index.ts');
const publicMediaSQL = read('supabase/migrations/20261003044500_community_dreamsnaps_projection_v1.sql');
const ownerMediaSQL = read('supabase/migrations/20260930082000_community_core_v0_retention_policy.sql');

const section = (sql,name) => {
 const match = new RegExp('create or replace function public\\.'+name+'\\s*\\(','i').exec(sql);
 assert.ok(match,'missing function: '+name);
 const rest=sql.slice(match.index);
 const stop=rest.indexOf('\ncreate or replace function ',1);
 return stop<0?rest:rest.slice(0,stop);
};
test('NEW direct issuer graph: legacy public SQL can authorize Gallery and Dreamsnap keys without R19',()=>{
 const rpc=section(publicMediaSQL,'community_get_public_media_storage_v2');
 assert.match(rpc,/security definer/i);
 assert.match(rpc,/'storageKey',m\.storage_key/);
 assert.match(rpc,/w\.work_type='gallery'/);
 assert.match(rpc,/dreamsnap_entries/);
 assert.doesNotMatch(rpc,/preset_storage|integrity_incident|_r19/i);
 assert.doesNotMatch(m140,/create or replace function public\.community_get_public_media_storage_v2\s*\(/i);
 assert.match(publicMedia,/community_get_public_media_storage_v2/);
 assert.match(publicMedia,/createSignedUrl\(String\(media\.storageKey\),300\)/);
});
test('NEW direct issuer graph: authenticated legacy fallback SQL is outside Source140 function gate',()=>{
 const rpc=section(ownerMediaSQL,'community_get_media_storage_key');
 assert.match(rpc,/security definer/i);
 assert.match(rpc,/private\.can_access_entity/);
 assert.match(rpc,/'storageKey'/);
 assert.doesNotMatch(rpc,/preset_storage|integrity_incident|_r19/i);
 assert.doesNotMatch(m140,/create or replace function public\.community_get_media_storage_key\s*\(/i);
 assert.match(ownerMedia,/community_get_media_storage_key/);
 assert.match(ownerMedia,/createSignedUrl\(media\.storageKey,\s*300\)/);
});
test('NEW caller authority: Owner Photo binary Gateway remains an independent service-role RPC',()=>{
 assert.match(ownerMedia,/community_gallery_owner_media_read_v1/);
 assert.doesNotMatch(m140,/create or replace function public\.community_gallery_owner_media_read_v1\s*\(/i);
 assert.match(m140,/create or replace function public\.community_gallery_media_gateway_v1\s*\(/i);
});
test('NEW guard ordering: Source140 known Edges guard before all three media storage issuers',()=>{
 const publicGuard=publicMedia.indexOf("'community_preset_storage_assert_media_not_quarantined_r19'");
 const publicLegacy=publicMedia.indexOf("'community_get_public_media_storage_v2'");
 const ownerGuard=ownerMedia.indexOf("'community_preset_storage_assert_media_not_quarantined_r19'");
 const ownerPhoto=ownerMedia.indexOf("'community_gallery_owner_media_read_v1'");
 const ownerFallback=ownerMedia.indexOf("'community_get_media_storage_key'");
 assert.ok(publicGuard>0 && publicLegacy>publicGuard);
 assert.ok(ownerGuard>0 && ownerPhoto>ownerGuard && ownerFallback>ownerPhoto);
});
