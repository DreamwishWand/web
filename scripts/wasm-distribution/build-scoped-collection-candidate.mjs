// Candidate-only packaging using the existing R22 lock, bindgen tool and
// exact generated files. NEVER writes static/ or build/ or a release anchor.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {RELEASE_TUPLES,ACTIVE_RELEASE_TUPLE,protectedPagesContextMatches,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {SCOPED_COLLECTION_RELEASE_OP,SCOPED_COLLECTION_FEATURES,SCOPED_COLLECTION_METHODS,scopedCollectionManifestOk,scopedCollectionWasmExportsOk}
 from '../../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
const fail=()=>{throw Error('SCOPED_COLLECTION_CANDIDATE_DENIED')};
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=resolve(import.meta.dirname,'../..'),core=process.env.WAND_SCOPED_CORE_DIR;
const source=process.env.WAND_SOURCE_HEAD,base=process.env.WAND_CANDIDATE_BASE_PATH;
const tuple=RELEASE_TUPLES.find(t=>t.basePath===base);
if(!core||!tuple||!/^[0-9a-f]{40}$/.test(source??'')||execFileSync('git',['-C',core,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source)fail();
// Same protected Pages job may generate a proof-only candidate of its exact
// checkout. This never changes the approved read-only static asset set.
if(process.env.GITHUB_WORKFLOW_REF?.includes('/.github/workflows/pages.yml@')&&
 (resolve(core)!==root||tuple!==ACTIVE_RELEASE_TUPLE||!protectedPagesContextMatches(process.env,source,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim())))fail();
const lock=await readFile(join(core,'crates/ddv-save-core/Cargo.lock')),approved=await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'));
if(!lock.equals(approved)||sha(lock)!=='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c')fail();
const toolchain=execFileSync('rustc',['--version','--verbose'],{encoding:'utf8'}),bindgen=process.env.WAND_BINDGEN_CLI;
if(!toolchain.startsWith('rustc 1.99.1 ')||!bindgen||execFileSync(bindgen,['--version'],{encoding:'utf8'}).trim()!=='wasm-bindgen 0.2.105')fail();
const generated=join(root,'tests/stage-e/pkg'),out=join(root,'tests/wasm-distribution/fixtures/scoped-collection');
const names=['ddv_save_core.js','ddv_save_core_bg.wasm'];
const [js,wasm]=await Promise.all(names.map(n=>readFile(join(generated,n))));
if(!js.length||js.length>2*1024*1024||!wasm.length||wasm.length>20*1024*1024||wasm.toString('hex',0,4)!=='0061736d'||!scopedCollectionWasmExportsOk(new WebAssembly.Module(wasm)))fail();
const cargo=await readFile(join(core,'crates/ddv-save-core/Cargo.toml'));
const m={contract:'wand.scoped-collection.runtime@1',operation:SCOPED_COLLECTION_RELEASE_OP,
 source:{repository:tuple.repository,commit:source,cargoTomlSha256:sha(cargo),cargoLockSha256:sha(lock),cargoLockOrigin:'approved-repository-lock',
 wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:SCOPED_COLLECTION_FEATURES,defaultFeatures:false,toolchain},
 ...(base==='/web'?{}:{delivery:releaseDelivery(tuple)}),
 assets:{js:{path:names[0],sizeBytes:js.length,sha256:sha(js)},wasm:{path:names[1],sizeBytes:wasm.length,sha256:sha(wasm)}},
 abi:{exportClass:'WorkerWasmSource',methods:SCOPED_COLLECTION_METHODS,writerAuthorized:false,originalOverwriteAuthorized:false},
 release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
const manifest=Buffer.from(JSON.stringify(m,null,2)+'\n');
const pins={contract:'wand.scoped-collection.pinned-digests@1',sourceHead:source,manifestSha256:sha(manifest),manifestSizeBytes:manifest.length,
 jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length};
if(!scopedCollectionManifestOk(m,pins,tuple))fail();
await mkdir(out,{recursive:true});if((await readdir(out)).length)fail();
for(const n of names)await copyFile(join(generated,n),join(out,n));
await writeFile(join(out,'manifest.json'),manifest,{flag:'wx'});
await writeFile(join(root,'tests/wasm-distribution/fixtures/scoped-collection-pins.json'),JSON.stringify(pins),{flag:'wx'});
console.log('SCOPED_COLLECTION_CANDIDATE_EXACT_THREE_OFF',JSON.stringify(pins));
