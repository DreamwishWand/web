import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {SWITCH_MAKEUP_COLOR1_RELEASE,getSwitchMakeupColor1MountInfo,loadProtectedSwitchMakeupColor1RustWasm,MAKEUP_COLOR1_RELEASE} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Switch Makeup Color1 is an isolated OFF product route with five exclusive methods',async()=>{
 const [anchor,worker,page,route]=await Promise.all([
  read('src/lib/ddv/core/save/product-scoped-switch-makeup-color1-release-anchor.mjs'),
  read('src/lib/dev/product-switch-makeup-color1.worker.mjs'),
  read('src/routes/editor/appearance/makeup-color1/switch/+page.svelte'),
  read('src/lib/dev/PlacementProductRoute.svelte')
 ]);
 assert.match(anchor,/PROTECTED_SWITCH_MAKEUP_COLOR1_RELEASE_ANCHOR=null/);
 assert.match(worker,/loadProtectedSwitchMakeupColor1RustWasm/);
 assert.match(worker,/createProductSwitch626MakeupColor1LocalAdapter/);
 assert.match(worker,/installLocalMakeupColor1DevWorker/);
 assert.match(page,/fixedOperation="makeup-color1-switch"/);
 assert.match(route,/'makeup-color1-switch':createProductSwitchMakeupColor1Port/);
 assert.ok(compile(page,{filename:'makeup-color1/switch/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.equal(SWITCH_MAKEUP_COLOR1_RELEASE.operation,'switch626.makeup.color1.exact1');
 assert.equal(SWITCH_MAKEUP_COLOR1_RELEASE.platform,'switch');
 assert.equal(SWITCH_MAKEUP_COLOR1_RELEASE.buildId,'9A239D3DB569756D');
 assert.equal(SWITCH_MAKEUP_COLOR1_RELEASE.path,'/editor/appearance/makeup-color1/switch/');
 assert.deepEqual(SWITCH_MAKEUP_COLOR1_RELEASE.features,['product-switch626-makeup-color1-scoped','worker-wasm']);
 assert.deepEqual(SWITCH_MAKEUP_COLOR1_RELEASE.methods.filter(m=>m.includes('makeup_color1')),[
  'preview_switch626_makeup_color1','stage_switch626_makeup_color1',
  'toggle_switch626_makeup_color1','begin_switch626_makeup_color1_output',
  'next_switch626_makeup_color1_output_chunk'
 ]);
 assert.ok(!SWITCH_MAKEUP_COLOR1_RELEASE.methods.includes('toggle_scoped_edit'));
 assert.ok(!SWITCH_MAKEUP_COLOR1_RELEASE.methods.includes('preview_steam626_makeup_color1'));
 assert.ok(MAKEUP_COLOR1_RELEASE.methods.includes('preview_steam626_makeup_color1'));
 assert.ok(!MAKEUP_COLOR1_RELEASE.methods.includes('preview_switch626_makeup_color1'));
 await assert.rejects(getSwitchMakeupColor1MountInfo());
 await assert.rejects(loadProtectedSwitchMakeupColor1RustWasm());
});
test('Switch Makeup UI and P1G bridge bind fixed Build, no arbitrary color or rights',async()=>{
 const [owner,bridge,adapter,workflow,client,ui,transport]=await Promise.all([
  read('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  read('src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs'),
  read('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  read('src/lib/dev/local-placement-workflow.mjs'),
  read('src/lib/dev/product-placement-client.mjs'),
  read('src/lib/dev/LocalPlacementEditorDev.svelte'),
  read('src/lib/ddv/core/save/product-steam626-makeup-color1-transport.mjs')
 ]);
 assert.match(owner,/appearanceScope==='makeup-color1-switch'\?createSwitch626MakeupColor1Transport/);
 assert.match(owner,/appearanceScope==='makeup-color1-switch'\?'switch':'steam-windows'/);
 assert.match(bridge,/appearanceScope==='makeup-color1-switch'\?'switch':'steam-windows'/);
 assert.match(adapter,/createProductSwitch626MakeupColor1LocalAdapter/);
 assert.match(adapter,/appearanceScope==='makeup-color1-switch'/);
 assert.match(workflow,/operation==='makeup-color1-switch'\?SWITCH626_BACKPACK_BUILD/);
 assert.match(workflow,/r\.makeupItemId!==140100014/);
 assert.match(workflow,/r\.oldColorIndex!==53\|\|r\.newColorIndex!==60/);
 assert.match(client,/new URL\('\.\/product-switch-makeup-color1\.worker\.mjs',import\.meta\.url\)/);
 assert.match(transport,/createSwitch626MakeupColor1Transport/);
 assert.match(transport,/prefix=switchBuild\?'switch626':'steam626'/);
 assert.match(ui,/data-product-writer="off"/);
 assert.match(ui,/operation==='makeup-color1-switch'\?SWITCH626_BACKPACK_BUILD.buildId/);
 assert.match(ui,/p\?\.makeupItemId!==140100014/);
 assert.match(ui,/p\?\.oldColorIndex!==53\|\|p\?\.newColorIndex!==60/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});
test('Eight locale Switch descriptions preserve exact fixed scalar and original backup protection',()=>{
 for(const locale of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){
  const v=localPlacementCopy(locale);
  assert.match(v.switchMakeupColor1Title,/Switch626/);
  assert.ok(v.switchMakeupColor1Detail.length>=28);
  assert.ok(v.switchMakeupColor1Safety.length>=20);
  assert.ok(!v.switchMakeupColor1Title.includes('Steam626'));
 }
 const ja=localPlacementCopy('ja');
 assert.match(ja.switchMakeupColor1Detail,/53 → 60/);
 assert.match(ja.switchMakeupColor1Detail,/所有情報は変更しません/);
 assert.match(ja.switchMakeupColor1Safety,/原本上書き/);
});
