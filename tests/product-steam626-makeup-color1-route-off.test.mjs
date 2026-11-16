import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {MAKEUP_COLOR1_RELEASE,getMakeupColor1MountInfo,loadProtectedMakeupColor1RustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Steam626 Makeup Color1 is one noindex OFF protected route with an exact five-method ABI',async()=>{
 const [anchor,worker,page,route]=await Promise.all([
  load('src/lib/ddv/core/save/product-scoped-makeup-color1-release-anchor.mjs'),
  load('src/lib/dev/product-makeup-color1.worker.mjs'),
  load('src/routes/editor/appearance/makeup-color1/steam/+page.svelte'),
  load('src/lib/dev/PlacementProductRoute.svelte')
 ]);
 assert.match(anchor,/PROTECTED_MAKEUP_COLOR1_RELEASE_ANCHOR=null/);
 assert.match(worker,/bootPlacement\(loadProtectedMakeupColor1RustWasm,createProductSteam626MakeupColor1LocalAdapter,installLocalMakeupColor1DevWorker,MAKEUP_COLOR1_RELEASE.operation\)/);
 assert.match(page,/fixedOperation="makeup-color1"/);
 assert.match(route,/createProductMakeupColor1Port/);
 assert.match(route,/data-placement-scope=\{scope\?\.mode\|\|'off'\}/);
 assert.ok(compile(page,{filename:'makeup-color1/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.equal(MAKEUP_COLOR1_RELEASE.operation,'steam626.makeup.color1.exact1');
 assert.equal(MAKEUP_COLOR1_RELEASE.path,'/editor/appearance/makeup-color1/steam/');
 assert.equal(MAKEUP_COLOR1_RELEASE.platform,'steam-windows');
 assert.deepEqual(MAKEUP_COLOR1_RELEASE.features,['product-steam626-makeup-color1-scoped','worker-wasm']);
 assert.deepEqual(MAKEUP_COLOR1_RELEASE.methods.filter(m=>m.includes('makeup_color1')),[
  'preview_steam626_makeup_color1','stage_steam626_makeup_color1',
  'toggle_steam626_makeup_color1','begin_steam626_makeup_color1_output',
  'next_steam626_makeup_color1_output_chunk'
 ]);
 assert.equal(MAKEUP_COLOR1_RELEASE.methods.includes('toggle_scoped_edit'),false);
 await assert.rejects(getMakeupColor1MountInfo());
 await assert.rejects(loadProtectedMakeupColor1RustWasm());
});
test('Makeup Color1 Worker isolation and existing P1G/OPFS owner bind exactly one fixed Rust receipt',async()=>{
 const [owner,adapter,port,client,workflow,ui]=await Promise.all([
  load('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  load('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  load('src/lib/dev/local-scoped-edit-worker-port.mjs'),
  load('src/lib/dev/product-placement-client.mjs'),
  load('src/lib/dev/local-placement-workflow.mjs'),
  load('src/lib/dev/LocalPlacementEditorDev.svelte')
 ]);
 assert.match(owner,/appearanceScope==='makeup-color1'\?createSteam626MakeupColor1Transport/);
 assert.match(adapter,/createProductSteam626MakeupColor1LocalAdapter/);
 assert.match(port,/'makeup-color1':appearanceMethods/);
 assert.match(port,/installLocalMakeupColor1DevWorker/);
 assert.match(client,/new URL\('\.\/product-makeup-color1\.worker\.mjs',import\.meta\.url\)/);
 assert.match(workflow,/makeup=operation==='makeup-color1'/);
 assert.match(workflow,/r\.makeupItemId!==140100014/);
 assert.match(workflow,/r\.oldColorIndex!==53\|\|r\.newColorIndex!==60/);
 assert.match(ui,/data-product-writer="off"/);
 assert.match(ui,/p\?\.makeupItemId!==140100014/);
 assert.match(ui,/p\?\.oldColorIndex!==53\|\|p\?\.newColorIndex!==60/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});
test('Makeup Color1 provides eight localized no-ownership/no-stock product descriptions',()=>{
 const locales=['en','ja','fr','de','it','es-ES','zh-CN','pt-BR'];
 for(const locale of locales){
  const x=localPlacementCopy(locale);
  assert.match(x.makeupColor1Title,/Color1/);
  assert.ok(x.makeupColor1Detail.length>=28);
  assert.ok(x.makeupColor1Safety.length>=20);
 }
 const ja=localPlacementCopy('ja');
 assert.match(ja.makeupColor1Detail,/53 → 60/);
 assert.match(ja.makeupColor1Detail,/所有情報は変更しません/);
 assert.match(ja.makeupColor1Safety,/原本上書き/);
});
