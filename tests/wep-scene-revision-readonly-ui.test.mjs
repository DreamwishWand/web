import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneRevisionCopy,SCENE_REVISION_COPY_LOCALES} from '../src/lib/wep/scene-revision-copy.js';
test('Scene read-only panel wiring stays visible in Discover and auth-gated in owner preflight',()=>{
  const page=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../src/lib/wep/SceneRevisionReadOnlyPanel.svelte',import.meta.url),'utf8');
  assert.match(page,/SceneRevisionReadOnlyPanel/);
  assert.match(page,/selectedSceneWorkId/);
  assert.match(page,/selectedOwnerSceneArtifactId/);
  assert.match(panel,/callPublicCommunityRpc/);
  assert.match(panel,/getPublicCommunityMedia/);
  assert.match(panel,/bridge\.inspectSceneRevisionReadiness/);
  assert.match(panel,/!connected/);
  assert.match(panel,/data-wep-scene-save-disabled/);
  assert.doesNotMatch(panel,/on:click=\{(?:saveRevision|publishScene|deleteScene)/);
  assert.doesNotMatch(panel,/community\.media\('finalize'/);
});
test('Eight localized consumer diagnostics preserve a visible blocked Save Revision state',()=>{
  assert.deepEqual([...SCENE_REVISION_COPY_LOCALES].sort(),['en','ja','de','fr','it','es-ES','pt-BR','zh-CN'].sort());
  for(const locale of SCENE_REVISION_COPY_LOCALES){
    const c=sceneRevisionCopy(locale);
    for(const key of ['title','inspect','ownerTitle','ownerInspect','saveBlocked','cover','historical','coverExpired','retryCover','boundary']){
      assert.equal(typeof c[key],'string');
      assert.ok(c[key].length>4,locale+':'+key);
    }
  }
});
