import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectScopedCollectionSubjects,privateScopedCollectionIdentity} from '../scripts/readonly-release/seal-scoped-collection-private.mjs';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_COLLECTION_RELEASE_OP as op,SCOPED_COLLECTION_FEATURES as features,SCOPED_COLLECTION_METHODS as methods,
 scopedCollectionManifestOk,scopedCollectionAnchorShapeOk,scopedCollectionReleaseIdentityText,validateScopedCollectionAnchor,scopedCollectionDeliveryOk,getScopedCollectionMountInfo,loadProtectedScopedCollectionRustWasm} from '../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
const h='a'.repeat(64),source='b'.repeat(40),hash=x=>createHash('sha256').update(x).digest('hex');
const pins={contract:'wand.scoped-collection.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10};
const manifest={contract:'wand.scoped-collection.runtime@1',operation:op,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test-only)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
const build={platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:h};
const anchor={contract:'wand.scoped-collection.protected-release@1',...tuple,operation:op,pins,mode:'public-accepted',deliveryOrigin:tuple.origin,builds:[build],releaseId:h,attestationVerifiedAtBuild:true};
test('scoped release manifest fixed exact opt-in feature and ABI, no self authority',()=>{
 assert.equal(scopedCollectionManifestOk(manifest,pins),true);
 for(const p of [
  {...manifest,operation:'amount'}, {...manifest,extra:true}, {...manifest,source:{...manifest.source,features:['indexed-read','worker-wasm']}},
  {...manifest,source:{...manifest.source,features:[...features,'product-amount-scoped']}},
  {...manifest,source:{...manifest.source,cargoLockSha256:h}}, {...manifest,source:{...manifest.source,defaultFeatures:true}},
  {...manifest,abi:{...manifest.abi,methods:[...methods,'stage_scoped_amount']}},
  {...manifest,abi:{...manifest.abi,writerAuthorized:true}},
  {...manifest,release:{...manifest.release,productConsumerEnabled:true}}, {...manifest,assets:{...manifest.assets,js:{...manifest.assets.js,path:'../other.js'}}}
 ])assert.equal(scopedCollectionManifestOk(p,pins),false);
 assert.equal(scopedCollectionManifestOk(manifest,{...pins,sourceHead:'c'.repeat(40)}),false);
});
test('scoped anchor requires exact build-specific V2 receipt digest and bound release identity; null default fails closed',async()=>{
 assert.equal(scopedCollectionAnchorShapeOk(anchor),true);
 const a={...anchor,releaseId:hash(scopedCollectionReleaseIdentityText(anchor))};assert.equal(await validateScopedCollectionAnchor(a),true);
 for(const p of [null,{...a,builds:[]},{...a,builds:[build,build]},
  {...a,builds:[{...build,buildId:'unknown'}]},{...a,builds:[{...build,productV2EvidenceSha256:'unknown'}]},
  {...a,builds:[{...build,productV2EvidenceSha256:'c'.repeat(64)}]},
  {...a,operation:'amount'},{...a,attestationVerifiedAtBuild:false},{...a,origin:'https://example.org'}, {...a,releaseId:h}])await assert.rejects(validateScopedCollectionAnchor(p));
 await assert.rejects(loadProtectedScopedCollectionRustWasm({pins}));await assert.rejects(loadProtectedScopedCollectionRustWasm());
});

test('private V2 seal is loopback-only, no public grant, and cannot assert prior V2 evidence',async()=>{
 const p={...anchor,mode:'private-product-v2',deliveryOrigin:'http://127.0.0.1:4188',
  builds:[{...build,productV2EvidenceSha256:null}]};
 p.releaseId=hash(scopedCollectionReleaseIdentityText(p));assert.equal(await validateScopedCollectionAnchor(p),true);
 assert.equal(scopedCollectionDeliveryOk(p,new URL(p.deliveryOrigin+tuple.basePath+'/editor/collection/')),true);
 assert.equal(scopedCollectionDeliveryOk(p,new URL(tuple.origin+tuple.basePath+'/editor/collection/')),false);
 assert.equal(scopedCollectionDeliveryOk(anchor,new URL('http://127.0.0.1:4188'+tuple.basePath+'/editor/collection/')),false);
 for(const patch of [{deliveryOrigin:'http://localhost:4188'},{deliveryOrigin:'https://example.org'},
  {deliveryOrigin:'http://127.0.0.1:4188/path'},{deliveryOrigin:'http://127.0.0.1:65536'},
  {deliveryOrigin:'http://127.0.0.1:80'},{mode:'public-accepted'},{builds:[build]}])
  await assert.rejects(validateScopedCollectionAnchor({...p,...patch}));
 await assert.rejects(getScopedCollectionMountInfo());
});

test('shared signed-subject inspector binds actual three bytes; private seal identity cannot become public grant',async()=>{
 const js=Buffer.from('export class WorkerWasmSource {}'),wasm=Buffer.from([0,97,115,109,1,0,0,0]);
 const m={...manifest,assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:hash(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:wasm.length,sha256:hash(wasm)}}};
 const mf=Buffer.from(JSON.stringify(m)),p={...pins,manifestSha256:hash(mf),manifestSizeBytes:mf.length,jsSha256:hash(js),jsSizeBytes:js.length,wasmSha256:hash(wasm),wasmSizeBytes:wasm.length};
 // A syntactically valid but empty WASM is not a scoped product ABI.
 assert.throws(()=>inspectScopedCollectionSubjects([mf,js,wasm],source,tuple));
 const a=privateScopedCollectionIdentity(p,'http://127.0.0.1:4188',['steam-windows','switch'],tuple);
 assert.equal(a.mode,'private-product-v2');assert.ok(a.builds.every(b=>b.productV2EvidenceSha256===null));
 assert.equal(await validateScopedCollectionAnchor(a),true);
 for(const [origin,platforms] of [['https://dreamwishwand.com',['switch']],['http://127.0.0.1:4188',['switch','switch']],['http://127.0.0.1:4188',['unknown']]])
  assert.throws(()=>privateScopedCollectionIdentity(p,origin,platforms,tuple));
 assert.throws(()=>inspectScopedCollectionSubjects([mf,Buffer.from('tampered'),wasm],source,tuple));
 assert.throws(()=>inspectScopedCollectionSubjects([mf,js,wasm],'f'.repeat(40),tuple));
 const bad=Buffer.from('export const dev_stage_typed_amounts=1;'),bm={...m,assets:{...m.assets,js:{path:'ddv_save_core.js',sizeBytes:bad.length,sha256:hash(bad)}}};
 assert.throws(()=>inspectScopedCollectionSubjects([Buffer.from(JSON.stringify(bm)),bad,wasm],source,tuple));
});

import {SCOPED_COLLECTION_WASM_EXPORTS as foreignProofOwnExports} from '../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
test('Switch Vase foreign symbols rejected with valid own WASM and rebound manifest',()=>{
 const u=n=>{const a=[];do{const v=n&127;n>>>=7;a.push(v|(n?128:0))}while(n);return a};
 const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)],sec=(id,b)=>[id,...u(b.length),...b];
 const wasm=names=>{const e=names.flatMap(n=>[...str(n),n==='memory'?2:n==='__wbindgen_externrefs'?1:0,0]);return Buffer.from([0,97,115,109,1,0,0,0,...sec(1,[1,96,0,0]),...sec(3,[1,0]),...sec(4,[1,111,0,1]),...sec(5,[1,0,1]),...sec(7,[...u(names.length),...e]),...sec(10,[1,2,0,11])])};
 const subject=(js,w)=>[Buffer.from(JSON.stringify({...manifest,assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:hash(js)},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:hash(w)}}})),js,w];
 const clean=Buffer.from('export default function(){}'),own=wasm(foreignProofOwnExports);
 assert.equal(inspectScopedCollectionSubjects(subject(clean,own),source).wasmSha256,hash(own));
 for(const n of ['preview_switch626_vase_add','stage_switch626_vase_add']){
  assert.throws(()=>inspectScopedCollectionSubjects(subject(Buffer.from(n),own),source));
  assert.throws(()=>inspectScopedCollectionSubjects(subject(clean,wasm([...foreignProofOwnExports,'workerwasmsource_'+n])),source));
 }
});
