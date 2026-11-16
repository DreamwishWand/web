import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {EYECOLOR2_RELEASE,getEyeColor2MountInfo,loadProtectedEyeColor2RustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Eyeball Color2 has one noindex OFF protected route with an exact five-method ABI',async()=>{
 const [anchor,worker,page,route]=await Promise.all([
  load('src/lib/ddv/core/save/product-scoped-eyecolor2-release-anchor.mjs'),
  load('src/lib/dev/product-eyecolor2.worker.mjs'),
  load('src/routes/editor/appearance/eyecolor2/steam/+page.svelte'),
  load('src/lib/dev/PlacementProductRoute.svelte')
 ]);
 assert.match(anchor,/PROTECTED_EYECOLOR2_RELEASE_ANCHOR=null/);
 assert.match(worker,/bootPlacement\(loadProtectedEyeColor2RustWasm,createProductSteam626EyeColor2LocalAdapter,installLocalEyeColor2DevWorker,EYECOLOR2_RELEASE.operation\)/);
 assert.match(page,/fixedOperation="eyecolor2"/);
 assert.match(route,/eyecolor2:createProductEyeColor2Port/);
 assert.match(route,/data-placement-scope=\{scope\?\.mode\|\|'off'\}/);
 assert.ok(compile(page,{filename:'eyecolor2/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.equal(EYECOLOR2_RELEASE.operation,'steam626.eyecolor2.exact1');
 assert.equal(EYECOLOR2_RELEASE.path,'/editor/appearance/eyecolor2/steam/');
 assert.equal(EYECOLOR2_RELEASE.platform,'steam-windows');
 assert.deepEqual(EYECOLOR2_RELEASE.features,['product-steam626-eyecolor2-scoped','worker-wasm']);
 assert.deepEqual(EYECOLOR2_RELEASE.methods.filter(m=>m.includes('eyecolor2')),[
  'preview_steam626_eyecolor2','stage_steam626_eyecolor2',
  'toggle_steam626_eyecolor2','begin_steam626_eyecolor2_output',
  'next_steam626_eyecolor2_output_chunk'
 ]);
 assert.equal(EYECOLOR2_RELEASE.methods.includes('toggle_scoped_edit'),false);
 await assert.rejects(getEyeColor2MountInfo());
 await assert.rejects(loadProtectedEyeColor2RustWasm());
});
test('EyeColor2 Worker and P1G/OPFS owner allow only fixed Rust-minted scalar receipt',async()=>{
 const [owner,adapter,port,client,workflow,ui]=await Promise.all([
  load('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  load('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  load('src/lib/dev/local-scoped-edit-worker-port.mjs'),
  load('src/lib/dev/product-placement-client.mjs'),
  load('src/lib/dev/local-placement-workflow.mjs'),
  load('src/lib/dev/LocalPlacementEditorDev.svelte')
 ]);
 assert.match(owner,/appearanceScope==='eyecolor2'\?createSteam626EyeColor2Transport/);
 assert.match(adapter,/createProductSteam626EyeColor2LocalAdapter/);
 assert.match(port,/eyecolor2:appearanceMethods/);
 assert.match(port,/installLocalEyeColor2DevWorker/);
 assert.match(client,/new URL\('\.\/product-eyecolor2\.worker\.mjs',import\.meta\.url\)/);
 assert.match(workflow,/eye=operation==='eyecolor2'/);
 assert.match(workflow,/r\.eyeballItemId!==70000010/);
 assert.match(workflow,/r\.oldColorIndex!==64\|\|r\.newColorIndex!==69/);
 assert.match(ui,/data-product-writer="off"/);
 assert.match(ui,/p\?\.eyeballItemId!==70000010/);
 assert.match(ui,/p\?\.oldColorIndex!==64\|\|p\?\.newColorIndex!==69/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});
test('EyeColor2 has eight localized no-ownership/no-stock UI descriptions',()=>{
 const locales=['en','ja','fr','de','it','es-ES','zh-CN','pt-BR'];
 for(const locale of locales){
  const x=localPlacementCopy(locale);
  assert.match(x.eyeColor2Title,/Color2/);
  assert.ok(x.eyeColor2Detail.length>=28);
  assert.ok(x.eyeColor2Safety.length>=20);
 }
 const ja=localPlacementCopy('ja');
 assert.match(ja.eyeColor2Detail,/64 → 69/);
 assert.match(ja.eyeColor2Detail,/所有情報は変更しません/);
 assert.match(ja.eyeColor2Safety,/原本上書き/);
});
