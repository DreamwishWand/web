import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ACTIVE_RELEASE_TUPLE as tuple} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_COLLECTION_RELEASE_OP as op,SCOPED_COLLECTION_FEATURES as features,SCOPED_COLLECTION_METHODS as methods,
 scopedCollectionManifestOk,scopedCollectionAnchorShapeOk,scopedCollectionReleaseIdentityText,validateScopedCollectionAnchor,loadProtectedScopedCollectionRustWasm} from '../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
const h='a'.repeat(64),source='b'.repeat(40),hash=x=>createHash('sha256').update(x).digest('hex');
const pins={contract:'wand.scoped-collection.pinned-digests@1',sourceHead:source,manifestSha256:h,manifestSizeBytes:10,jsSha256:h,jsSizeBytes:10,wasmSha256:h,wasmSizeBytes:10};
const manifest={contract:'wand.scoped-collection.runtime@1',operation:op,source:{repository:tuple.repository,commit:source,cargoTomlSha256:h,cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features,defaultFeatures:false,toolchain:'rustc 1.99.1 (test-only)'},assets:{js:{path:'ddv_save_core.js',sizeBytes:10,sha256:h},wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:10,sha256:h}},abi:{exportClass:'WorkerWasmSource',methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
const build={platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:h};
const anchor={contract:'wand.scoped-collection.protected-release@1',...tuple,operation:op,pins,acceptedBuilds:[build],releaseId:h,attestationVerifiedAtBuild:true};
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
 for(const p of [null,{...a,acceptedBuilds:[]},{...a,acceptedBuilds:[build,build]},
  {...a,acceptedBuilds:[{...build,buildId:'unknown'}]},{...a,acceptedBuilds:[{...build,productV2EvidenceSha256:'unknown'}]},
  {...a,acceptedBuilds:[{...build,productV2EvidenceSha256:'c'.repeat(64)}]},
  {...a,operation:'amount'},{...a,attestationVerifiedAtBuild:false},{...a,origin:'https://example.org'}, {...a,releaseId:h}])await assert.rejects(validateScopedCollectionAnchor(p));
 await assert.rejects(loadProtectedScopedCollectionRustWasm({pins}));await assert.rejects(loadProtectedScopedCollectionRustWasm());
});
