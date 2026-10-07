import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){
  return fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
}

test('Scene Preset product migration keeps one private master lineage and one associated Gallery Work',()=>{
  const sql=read('supabase/migrations/20261007124300_scene_preset_product_vertical_v1.sql');
  assert.match(sql,/associated_gallery_work_id uuid null/);
  assert.match(sql,/community_publish_scene_preset_product_v1/);
  assert.match(sql,/gallery_kind in \([\s\S]*'preset_scene'/);
  assert.match(sql,/community_get_scene_preset_public_v1/);
  assert.match(sql,/community_unpublish_scene_preset_v1/);
  assert.match(sql,/community_delete_scene_preset_v1/);
  assert.match(sql,/PresetArtifact identity is immutable after first revision/);
  assert.match(sql,/Initial Scene Preset publication requires 1-10 public images/);
  assert.match(sql,/on conflict\(entity_id\) do update/);
  assert.match(sql,/revoke execute on function public\.community_publish_scene_preset_product_v1/);
  assert.match(sql,/grant execute on function public\.community_publish_scene_preset_product_v1[\s\S]*to service_role/);
});

test('WEP Scene product Edge fails closed on unsupported schema, build, object class and clipped topology',()=>{
  const edge=read('supabase/functions/wep-scene-preset-product/index.ts');
  for(const token of [
    'PRESET_SCHEMA_VERSION_UNSUPPORTED',
    'SCENE_OBJECT_CLASS_UNSUPPORTED',
    'PRESET_SOURCE_VERSION_BUILD_UNSUPPORTED',
    'TOPOLOGY_CONTAINMENT_PROOF_REQUIRED',
    'PUBLIC_IMAGE_REQUIRED',
    'community_publish_scene_preset_product_v1',
    'wep_get_accessible_preset_blob',
    'storageKey:meta.storageKey'
  ]) assert.match(edge,new RegExp(token));
  assert.match(edge,/source\.buildIdentity!=='52BD625D9B4E0053'/);
  assert.match(edge,/Number\(source\.profileSchemaVersion\)!==624/);
  assert.doesNotMatch(edge,/persistentWriteAuthorized\s*:\s*true/);
  assert.doesNotMatch(edge,/productApplyAuthorized\s*:\s*true/);
});

test('Scene product browser path uses dedicated WEP transport, exact signed-read identity and public Detail',()=>{
  const client=read('src/lib/community/staging-http-client.ts');
  const bridge=read('src/lib/wep/preset-community-bridge.ts');
  const publicQuery=read('supabase/functions/community-public-query/index.ts');
  const publishRoute=read('src/routes/presets/publish/+page.svelte');
  const detailRoute=read('src/routes/presets/detail/+page.svelte');
  const editor=read('src/routes/editor/world/+page.svelte');
  const panel=read('src/lib/wep/WorldEditorStage1DecoratePanel.svelte');
  const verifier=read('scripts/verify-community-integrated-production-tree.mjs');

  assert.match(client,/presetProduct<[\s\S]*wep-scene-preset-product/);
  assert.match(bridge,/publishSceneProduct/);
  assert.match(bridge,/verifySignedRead/);
  assert.match(bridge,/WEP_PRESET_READ_BLOB_ID_MISSING/);
  assert.match(bridge,/WEP_PRESET_READ_STORAGE_KEY_MISSING/);
  assert.match(bridge,/WEP_PRESET_READ_EXPECTED_CHECKSUM_MISMATCH/);
  assert.match(bridge,/WEP_PRESET_READ_EXPECTED_BYTE_SIZE_MISMATCH/);
  assert.match(bridge,/presetRevisionId/);
  assert.match(publicQuery,/community_get_scene_preset_public_v1/);
  assert.match(publishRoute,/publishSceneProduct/);
  assert.match(publishRoute,/existingPresetArtifactId/);
  assert.match(publishRoute,/recordScenePresetPublication/);
  assert.match(detailRoute,/community_get_scene_preset_public_v1/);
  assert.match(detailRoute,/expectedChecksumSha256/);
  assert.match(detailRoute,/createScenePresetHandoff/);
  assert.match(editor,/saveScenePresetPrivateMaster/);
  assert.match(editor,/\/presets\/publish\/\?master=/);
  assert.match(panel,/handoff\.presetRevisionId/);
  assert.match(panel,/handoff\.checksumSha256/);
  assert.match(verifier,/supabase\/functions\/wep-scene-preset-product\/index\.ts/);
});

test('Scene product locale-specific launch copy covers exactly the eight Wand locales',()=>{
  const detail=read('src/lib/presets/scene-preset-detail-copy.js');
  const publish=read('src/lib/presets/scene-preset-publish-copy.js');
  const master=read('src/lib/presets/scene-preset-private-master-copy.js');
  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    assert.match(detail,new RegExp(locale.replace('-','\\-')));
    assert.match(publish,new RegExp(locale.replace('-','\\-')));
    assert.match(master,new RegExp(locale.replace('-','\\-')));
  }
  for(const source of [detail,publish,master]){
    assert.match(source,/Object\.freeze/);
  }
});
