import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {savedDiffGridsCopy,STEAM_DIFFGRIDS_LOCALES} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('accepted Steam reader is reachable from Editor and the Home-linked RC status; no second reader',()=>{
 for(const path of ['src/routes/editor/+page.svelte','src/routes/rc-status/+page.svelte']){
  const src=read(path);
  assert.equal((src.match(/data-steam-reader-entry/g)||[]).length,1);
  assert.match(src,/data-steam-reader-entry data-sveltekit-reload href=\{base \+ '\/editor\/steam-reader\/'\}/);
  assert.match(src,/savedDiffGridsCopy\(\$locale\)/);
  assert.match(src,/reader\.preformal/);
  const presets=read('src/routes/presets/+page.svelte');
 assert.match(presets,/if\(window\.location\.hash!==\x27#device-local-scenes\x27\)return/);
 assert.match(presets,/surface=\x27my\x27;myDomain=\x27wand\x27/);
 assert.match(presets,/<span id=\x22device-local-scenes\x22 data-device-scenes-fragment-anchor hidden aria-hidden=\x22true\x22/);
 assert.match(presets,/<section class=\x22panel device-local-scenes\x22 tabindex=\x22-1\x22 data-my-local-scenes/);
 assert.match(presets,/document\.querySelector<HTMLElement>\(\x27\[data-my-local-scenes\]\x27\)\?\.focus\(\)/);
 assert.doesNotMatch(src,/new Worker\(|type=["']file|<SteamSavedDiffGridsReadonly|createSavedDiffGridsUiClient/);
 }
 assert.match(read('src/routes/+page.svelte'),/base \+ '\/rc-status\/'/);
 const route=read('src/routes/editor/steam-reader/+page.svelte');
 assert.match(route,/<SteamSavedDiffGridsReadonly preformal=\{true\}/);
 assert.match(route,/noindex,nofollow/);
 const worker=read('src/lib/wep/steam-saved-diffgrids.consumer.worker.ts');
 assert.match(worker,/const PREFORMAL_STEAM_READER_ENABLED=true;/);
 assert.match(worker,/const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;/);
});
test('reuse eight-locale exact-build and read-only labels',()=>{
 assert.equal(STEAM_DIFFGRIDS_LOCALES.length,8);
 for(const locale of STEAM_DIFFGRIDS_LOCALES){
  const c=savedDiffGridsCopy(locale);
  assert.match(c.preformal,/Steam 1\.25\.3/);
  for(const k of ['title','subtitle','open','intro','off'])assert.ok(c[k]);
 }
});

import {editorHubCopy,EDITOR_HUB_LOCALES} from '../src/lib/product-home/editor-hub-copy.mjs';
test('editor entry distinguishes reference catalog, local scene and Switch timing across eight locales',()=>{
 assert.deepEqual([...EDITOR_HUB_LOCALES].sort(),[...STEAM_DIFFGRIDS_LOCALES].sort());
 const src=read('src/routes/editor/+page.svelte');
 assert.match(src,/editorHubCopy\(\$locale\)/);
 assert.match(src,/data-editor-catalog href=/);assert.match(src,/data-editor-world href=/);assert.match(src,/data-editor-timing href=/);
 assert.match(src,/data-editor-local-scenes href=\{base \+ '\/presets\/#device-local-scenes'\}/);
 assert.match(src,/data-beta-capability="local-scene-library" data-beta-state="local"/);
 assert.match(src,/data-beta-save-authorized="false" data-native-apply="off" data-cloud="off"/);
 for(const locale of EDITOR_HUB_LOCALES){const c=editorHubCopy(locale);assert.equal(Object.keys(c).length,15);for(const v of Object.values(c))assert.ok(v.trim());assert.match(c.catalogDetail,/Switch v1\.25\.0/);assert.match(c.timingDetail,/Nintendo Switch v1\.25\.3/);assert.ok(c.sceneTitle&&c.sceneDetail&&c.sceneAction);assert.ok(Object.isFrozen(c));}
 assert.equal(editorHubCopy('unknown'),editorHubCopy('en'));assert.equal(editorHubCopy('__proto__'),editorHubCopy('en'));
 assert.doesNotMatch(src,/new Worker\(|type=["']file|<SteamSavedDiffGridsReadonly|createSavedDiffGridsUiClient/);
});
