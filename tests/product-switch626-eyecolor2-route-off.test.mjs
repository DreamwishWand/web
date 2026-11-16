import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {SWITCH_EYECOLOR2_RELEASE,getSwitchEyeColor2MountInfo,loadProtectedSwitchEyeColor2RustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Switch626 EyeColor2 fixed BID, five-method generated ABI, protected NULL, noindex route',async()=>{
 const [anchor,worker,page,client,route]=await Promise.all([
  read('src/lib/ddv/core/save/product-scoped-switch-eyecolor2-release-anchor.mjs'),
  read('src/lib/dev/product-switch-eyecolor2.worker.mjs'),
  read('src/routes/editor/appearance/eyecolor2/switch/+page.svelte'),
  read('src/lib/dev/product-placement-client.mjs'),
  read('src/lib/dev/PlacementProductRoute.svelte')
 ]);
 assert.match(anchor,/PROTECTED_SWITCH_EYECOLOR2_RELEASE_ANCHOR=null/);
 assert.match(worker,/bootPlacement\(loadProtectedSwitchEyeColor2RustWasm,createProductSwitch626EyeColor2LocalAdapter,installLocalEyeColor2DevWorker,SWITCH_EYECOLOR2_RELEASE.operation\)/);
 assert.match(page,/fixedOperation="eyecolor2-switch"/);
 assert.match(client,/product-switch-eyecolor2\.worker\.mjs/);
 assert.match(route,/'eyecolor2-switch':createProductSwitchEyeColor2Port/);
 assert.match(route,/data-placement-scope=\{scope\?\.mode\|\|'off'\}/);
 assert.ok(compile(page,{filename:'eyecolor2/switch/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.equal(SWITCH_EYECOLOR2_RELEASE.operation,'switch626.eyecolor2.exact1');
 assert.equal(SWITCH_EYECOLOR2_RELEASE.platform,'switch');
 assert.equal(SWITCH_EYECOLOR2_RELEASE.buildId,'9A239D3DB569756D');
 assert.equal(SWITCH_EYECOLOR2_RELEASE.path,'/editor/appearance/eyecolor2/switch/');
 assert.deepEqual(SWITCH_EYECOLOR2_RELEASE.features,['product-switch626-eyecolor2-scoped','worker-wasm']);
 assert.deepEqual(SWITCH_EYECOLOR2_RELEASE.methods.filter(m=>m.includes('eyecolor2')),[
  'preview_switch626_eyecolor2','stage_switch626_eyecolor2',
  'toggle_switch626_eyecolor2','begin_switch626_eyecolor2_output','next_switch626_eyecolor2_output_chunk'
 ]);
 assert.equal(SWITCH_EYECOLOR2_RELEASE.methods.includes('toggle_scoped_edit'),false);
 await assert.rejects(getSwitchEyeColor2MountInfo());
 await assert.rejects(loadProtectedSwitchEyeColor2RustWasm());
});
test('Switch626 Build delta uses one product Worker and existing Steam exact scalar semantics, not generic platform',async()=>{
 const [owner,bridge,adapter,workflow,ui,client,transport]=await Promise.all([
  read('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  read('src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs'),
  read('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  read('src/lib/dev/local-placement-workflow.mjs'),
  read('src/lib/dev/LocalPlacementEditorDev.svelte'),
  read('src/lib/dev/product-placement-client.mjs'),
  read('src/lib/ddv/core/save/product-steam626-eyecolor2-transport.mjs')
 ]);
 assert.match(owner,/appearanceScope==='eyecolor2-switch'\?createSwitch626EyeColor2Transport/);
 assert.match(owner,/appearanceScope==='eyecolor2-switch'\?'switch':'steam-windows'/);
 assert.match(bridge,/appearanceScope==='eyecolor2-switch'\?'switch':'steam-windows'/);
 assert.match(adapter,/createProductSwitch626EyeColor2LocalAdapter/);
 assert.match(adapter,/appearanceScope==='eyecolor2-switch'/);
 assert.match(workflow,/operation==='eyecolor2-switch'\?SWITCH626_BACKPACK_BUILD/);
 assert.match(workflow,/operation==='eyecolor2'\|\|operation==='eyecolor2-switch'/);
 assert.match(client,/createProductSwitchEyeColor2Port/);
 assert.match(transport,/createSwitch626EyeColor2Transport/);
 assert.match(transport,/prefix=switchBuild\?'switch626':'steam626'/);
 assert.match(ui,/data-product-writer="off"/);
 assert.match(ui,/operation==='eyecolor2-switch'\?SWITCH626_BACKPACK_BUILD.buildId/);
 assert.match(ui,/p\?\.oldColorIndex!==64\|\|p\?\.newColorIndex!==69/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});
test('Switch Eyeball Color2 8-locale independent BID title and no rights/stock change',()=>{
 for(const locale of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){
  const v=localPlacementCopy(locale);
  assert.match(v.switchEyeColor2Title,/Switch626/);
  assert.ok(v.switchEyeColor2Detail.length>=28);
  assert.ok(v.switchEyeColor2Safety.length>=20);
  assert.equal(v.switchEyeColor2Title.includes('Steam626'),false);
 }
 assert.match(localPlacementCopy('ja').switchEyeColor2Detail,/64 → 69/);
 assert.match(localPlacementCopy('ja').switchEyeColor2Detail,/所有情報は変更しません/);
});
