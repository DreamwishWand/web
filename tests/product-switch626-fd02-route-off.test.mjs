import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {FD02_RELEASE,getFd02MountInfo,loadProtectedFd02RustWasm} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';

const load=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('FD02 fixed product route stays OFF with a null protected anchor',async()=>{
 const [page,route,worker,anchor]=await Promise.all([
  load('src/routes/editor/world/fd02/switch/+page.svelte'),
  load('src/lib/dev/PlacementProductRoute.svelte'),
  load('src/lib/dev/product-fd02.worker.mjs'),
  load('src/lib/ddv/core/save/product-scoped-fd02-release-anchor.mjs')
 ]);
 assert.ok(compile(page,{filename:'fd02/+page.svelte',generate:'client'}).js.code.length>0);
 assert.ok(compile(route,{filename:'PlacementProductRoute.svelte',generate:'client'}).js.code.length>0);
 assert.match(page,/fixedOperation="fd02"/);
 assert.match(route,/fd02:createProductFd02Port/);
 assert.match(route,/scope\?\.mode\|\|'off'/);
 assert.match(anchor,/PROTECTED_FD02_RELEASE_ANCHOR=null/);
 assert.match(worker,/bootPlacement\(loadProtectedFd02RustWasm,createProductSwitch626Fd02LocalAdapter,installLocalFd02DevWorker,FD02_RELEASE.operation\)/);
 assert.equal(FD02_RELEASE.operation,'switch626.fd02.layout.exact4');
 assert.equal(FD02_RELEASE.platform,'switch');
 assert.equal(FD02_RELEASE.path,'/editor/world/fd02/switch/');
 assert.deepEqual(FD02_RELEASE.features,['product-switch626-fd02-scoped','worker-wasm']);
 assert.deepEqual(FD02_RELEASE.methods.filter(m=>m.includes('fd02')),[
  'preview_switch626_fd02','stage_switch626_fd02','toggle_switch626_fd02',
  'begin_switch626_fd02_output','next_switch626_fd02_output_chunk'
 ]);
 await assert.rejects(getFd02MountInfo());
 await assert.rejects(loadProtectedFd02RustWasm());
});

test('FD02 uses one fixed Worker with native build and known old values, never UI CAS',async()=>{
 const [client,adapter,bridge,owner,port,workflow,ui]=await Promise.all([
  load('src/lib/dev/product-placement-client.mjs'),
  load('src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs'),
  load('src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs'),
  load('src/lib/ddv/core/save/product-wasm-read-owner.mjs'),
  load('src/lib/dev/local-scoped-edit-worker-port.mjs'),
  load('src/lib/dev/local-placement-workflow.mjs'),
  load('src/lib/dev/LocalPlacementEditorDev.svelte')
 ]);
 assert.match(client,/new URL\('\.\/product-fd02\.worker\.mjs',import\.meta\.url\)/);
 assert.match(client,/createLocalFd02DevPort\(w\)/);
 assert.match(adapter,/createProductSwitch626Fd02LocalAdapter/);
 assert.match(adapter,/placementScope==='fd02'/);
 assert.match(bridge,/\['rm01','fd01','fd02','fe01'\]\.includes\(placementScope\)/);
 assert.match(owner,/placementScope==='fd02'\?createSwitch626Fd02Transport/);
 assert.match(owner,/\['rm01','fd01','fd02','fe01'\]\.includes\(placementScope\)/);
 assert.match(port,/fd02:placementMethods/);
 assert.match(port,/installLocalFd02DevWorker/);
 assert.match(workflow,/fd02=operation==='fd02'/);
 assert.match(workflow,/fd01\|\|fd02\|\|fe01/);
 assert.match(ui,/fd02=operation==='fd02'/);
 assert.match(ui,/fence=fd01\|\|fd02\|\|fe01/);
 assert.match(ui,/p\?\.gridId!==grid\|\|p\?\.x!==x\|\|p\?\.y!==y/);
 assert.match(ui,/data-product-writer="off"/);
 assert.ok(compile(ui,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});

test('FD02 has eight localizations with fixed no-stock-change meaning',()=>{
 const locales=['en','ja','fr','de','it','es-ES','zh-CN','pt-BR'];
 for(const locale of locales){
  const c=localPlacementCopy(locale);
  assert.match(c.fd02Title,/FD02/);
  assert.ok(c.fd02Detail.length>30);
  assert.equal(c.fd02Detail.includes('−1'),false);
 }
 assert.match(localPlacementCopy('ja').fd02Detail,/変更しません/);
});
