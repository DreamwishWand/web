// 09P CODE: emit exact per-Op Bamboo Reader delivery CANDIDATE only.
// No static/, build/, signed anchor, Pages artifact or consumer grant.
import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {ACTIVE_RELEASE_TUPLE,manifestMatchesRelease,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {BAMBOO_READONLY_OPERATION,BAMBOO_BUILD,BAMBOO_FEATURES,BAMBOO_METHODS,bambooWasmExportsOk,bambooReadJsSymbolsOk,bambooReadManifestOk} from '../../src/lib/ddv/core/save/product-steam626-bamboo-readonly-release.mjs';
const fail=()=>{throw Error('BAMBOO_PUBLIC_DELIVERY_SOURCE_CANDIDATE_DENIED')};
const root=resolve(import.meta.dirname,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const head=process.env.WAND_SOURCE_HEAD;
const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const cargo='751a73da41d8b58f7de70643f50b97722a3c1260';
const names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
async function privateDir(){
 if(await realpath(root)!==root)fail();
 let parent=root;
 for(const [i,part] of ['tests','wasm-distribution','fixtures'].entries()){
  parent=join(parent,part);let st;
  try{st=await lstat(parent)}catch(e){
   if(e?.code!=='ENOENT'||i!==2)fail();
   await mkdir(parent,{recursive:false});st=await lstat(parent);
  }
  if(st.isSymbolicLink()||!st.isDirectory()||await realpath(parent)!==parent)fail();
 }
 const out=join(parent,'steam626-bamboo-public-readonly-candidate');
 try{await mkdir(out,{recursive:false})}catch{fail()}
 if(await realpath(out)!==out)fail();
 return out;
}
if(!/^[a-f0-9]{40}$/.test(head??'')||git('rev-parse','HEAD')!==head||
 git('rev-parse','HEAD:crates/ddv-save-core/Cargo.toml')!==cargo||
 git('rev-parse','HEAD:crates/ddv-save-core/src/wasm_steam_bamboo_readonly.rs')!=='26414572b41211076f1f83a3f8752eea2ab65142')fail();
const approved=await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'));
const actualLock=await readFile(join(root,'crates/ddv-save-core/Cargo.lock'));
if(!actualLock.equals(approved)||sha(actualLock)!==lock)fail();
const bindgen=process.env.WAND_BINDGEN_CLI;
const toolchain=execFileSync('rustc',['--version','--verbose'],{encoding:'utf8'});
if(!toolchain.startsWith('rustc 1.99.1 ')||!bindgen||
 execFileSync(bindgen,['--version'],{encoding:'utf8'}).trim()!=='wasm-bindgen 0.2.105')fail();
const [js,wasm]=await Promise.all(names.slice(1).map(n=>readFile(join(root,'tests/stage-e/pkg',n))));
if(!js.length||js.length>2097152||!wasm.length||wasm.length>20971520||
 !bambooReadJsSymbolsOk(new TextDecoder('utf8',{fatal:true}).decode(js))||
 !bambooWasmExportsOk(new WebAssembly.Module(wasm)))fail();
const source={repository:ACTIVE_RELEASE_TUPLE.repository,commit:head,
 platform:'SteamWindows',schema:626,buildId:BAMBOO_BUILD,cargoTomlGitBlob:cargo,
 cargoLockSha256:lock,cargoLockOrigin:'approved-repository-lock',
 wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',
 features:BAMBOO_FEATURES,defaultFeatures:false,toolchain};
const manifest={
 contract:'wand.bamboo40700007.public-readonly-candidate@1',
 operation:BAMBOO_READONLY_OPERATION,source,
 ...(ACTIVE_RELEASE_TUPLE.basePath==='/web'?{}:{delivery:releaseDelivery(ACTIVE_RELEASE_TUPLE)}),
 assets:{
  js:{path:names[1],sizeBytes:js.length,sha256:sha(js)},
  wasm:{path:names[2],sizeBytes:wasm.length,sha256:sha(wasm)}
 },abi:{exportClass:'WorkerWasmSource',methods:BAMBOO_METHODS,itemId:40700007,
  platform:'SteamWindows',schema:626,buildId:BAMBOO_BUILD,readOnly:true,
  writerAuthorized:false,stageAuthorized:false,originalOverwriteAuthorized:false},
 release:{candidateOnly:true,productConsumerEnabled:false,writerAuthorized:false,
  stageAuthorized:false,editedCopyAuthorized:false,autoUpload:false,
  originalOverwriteAuthorized:false}
};
const raw=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
const pins={
 contract:'wand.bamboo40700007.pinned-digests@1',sourceHead:head,
 manifestSha256:sha(raw),manifestSizeBytes:raw.length,
 jsSha256:sha(js),jsSizeBytes:js.length,
 wasmSha256:sha(wasm),wasmSizeBytes:wasm.length
};
if(!manifestMatchesRelease(manifest,ACTIVE_RELEASE_TUPLE)||
 !bambooReadManifestOk(manifest,pins,ACTIVE_RELEASE_TUPLE))fail();
const out=await privateDir();
for(let i=0;i<3;i++)await writeFile(join(out,names[i]),[raw,js,wasm][i],{flag:'wx',mode:0o600});
await writeFile(join(root,'tests/wasm-distribution/fixtures/steam626-bamboo-public-readonly-pins.json'),JSON.stringify(pins)+'\n',{flag:'wx',mode:0o600});
console.log('BAMBOO_PUBLIC_READONLY_SOURCE_CANDIDATE_ONLY_NO_SIGN_NO_PAGES_NO_ON',JSON.stringify(pins));
