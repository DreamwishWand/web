import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {FRP01_RELEASE,getFrp01MountInfo,loadProtectedFrp01RustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const bid='52BD625D9B4E0053';

test('FRP624 fixed OFF product route and generated ABI census have no protected release',async()=>{
 const [anchor,worker,page,route]=await Promise.all([
  read('src/lib/ddv/core/save/product-scoped-frp01-release-anchor.mjs'),
  read('src/lib/dev/product-frp01.worker.mjs'),
  read('src/routes/editor/world/frp01/switch624/+page.svelte'),
  read('src/lib/dev/PlacementProductRoute.svelte')
 ]);
 assert.match(anchor,/PROTECTED_FRP01_RELEASE_ANCHOR=null/);
 assert.match(worker,/bootPlacement\(loadProtectedFrp01RustWasm,createProductSwitch624Frp01LocalAdapter,installLocalFrp01DevWorker,FRP01_RELEASE.operation\)/);
 assert.match(page,/fixedOperation="frp01"/);
 assert.match(route,/frp01:createProductFrp01Port/);
 assert.match(route,/scope\?\.mode\|\|'off'/);
 assert.ok(compile(page,{filename:'frp01/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.equal(FRP01_RELEASE.operation,'switch624.frp01.exact7');
 assert.equal(FRP01_RELEASE.platform,'switch');
 assert.equal(FRP01_RELEASE.buildId,bid);
 assert.deepEqual(FRP01_RELEASE.features,['product-switch624-frp01-scoped','worker-wasm']);
 const methods=['finish_switch624_frp01_readonly','read_switch624_frp01_target',
  'preview_switch624_frp01','stage_switch624_frp01','toggle_switch624_frp01',
  'begin_switch624_frp01_output','next_switch624_frp01_output_chunk'];
 assert.deepEqual(FRP01_RELEASE.methods.filter(m=>m.includes('frp01')),methods);
 assert.equal(FRP01_RELEASE.path,'/editor/world/frp01/switch624/');
 await assert.rejects(getFrp01MountInfo());
 await assert.rejects(loadProtectedFrp01RustWasm());
});
test('FRP624 route reuses original encrypted Backup/Codec/Worker but admits ONLY external 624 and Rust-scoped old IDs',async()=>{
 const [owner,bridge,adapter,workflow,ui,port,client,release]=await Promise.all([
  read('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  read('src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs'),
  read('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  read('src/lib/dev/local-placement-workflow.mjs'),
  read('src/lib/dev/LocalPlacementEditorDev.svelte'),
  read('src/lib/dev/local-scoped-edit-worker-port.mjs'),
  read('src/lib/dev/product-placement-client.mjs'),
  read('src/lib/ddv/core/save/product-scoped-placement-release.mjs')
 ]);
 assert.match(owner,/wasm\.finish_switch624_frp01_readonly\(\)/);
 assert.match(owner,/placementScope==='frp01'\?createSwitch624Frp01Transport/);
 assert.match(owner,/\(b\.schema===624&&b\.platform==='switch'&&b\.buildKind==='switch-bid'&&b\.buildId===FRP624\)/);
 assert.match(bridge,/decoded\.metadata\?\.profileVersion!==\(frp\?624:626\)/);
 assert.match(adapter,/createProductSwitch624Frp01LocalAdapter/);
 assert.match(adapter,/frp\?624:626/);
 assert.match(workflow,/SWITCH624_FRP01_BUILD/);
 assert.match(workflow,/frp\?exact\(selector,'gridId,oldIds'\)/);
 assert.match(ui,/frp\?\{gridId:grid,oldIds:\[\.\.\.oldIds\]\}/);
 assert.match(ui,/p\?\.oldIds\?\.every\(\(v,i\)=>v===oldIds\[i\]\)/);
 assert.match(ui,/data-product-writer="off"/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
 assert.match(port,/frp01:placementMethods/);
 assert.match(port,/installLocalFrp01DevWorker/);
 assert.match(client,/product-frp01\.worker\.mjs/);
 assert.match(client,/getFrp01MountInfo/);
 assert.match(release,/PROTECTED_FRP01_RELEASE_ANCHOR/);
});
test('FRP624 eight locales specify distinct two-stock no-debit and local-only operation',()=>{
 const locales=['en','ja','fr','de','it','es-ES','zh-CN','pt-BR'];
 for(const l of locales){
  const v=localPlacementCopy(l);
  assert.match(v.frp01Title,/FRP01/);
  assert.ok(v.frp01Detail.length>=30);
  assert.ok(v.frp01OldId.length>=4);
  assert.ok(v.frp01Safety.length>=30);
  assert.equal(v.frp01Detail.includes('−1'),false);
 }
 const ja=localPlacementCopy('ja');
 assert.match(ja.frp01Detail,/2種類の在庫数量はどちらも変更しません/);
 assert.match(ja.frp01Safety,/原本上書きなし/);
});
