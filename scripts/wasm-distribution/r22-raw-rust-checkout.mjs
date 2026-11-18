// R22 Rust/WASM input checkout confinement: Git HEAD *and* actual build bytes.
// A successful check does NOT authorize a Writer, deploy Pages, or sign assets.
import {execFileSync} from 'node:child_process';
import {lstatSync,realpathSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
const CRATE='crates/ddv-save-core';
const COMPILED_DIRS=[CRATE+'/src',CRATE+'/data'];
const RELEASE_TRUST=[
 '.github/workflows/pages.yml',
 '.github/workflows/01a-protected-main-signed-wasm-release-off.yml',
 'scripts/wasm-distribution/protected-release-inputs.json',
 'scripts/wasm-distribution/approved-Cargo.lock',
 'scripts/wasm-distribution/verify-protected-release.mjs',
 'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
 'scripts/wasm-distribution/r22-raw-rust-checkout.mjs',
 'scripts/wasm-distribution/build-candidate.mjs',
 'scripts/int-selection-preflight.mjs',
 'scripts/readonly-release/seal.mjs',
 'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs'
];
const bad=code=>{const e=new Error('R22_RAW_RUST_CHECKOUT_'+code);e.code=code;throw e};
const git=(root,...args)=>execFileSync('git',args,{
 cwd:root,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},
 encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
function rawFile(root,path,expected){
 if(!path||path.startsWith('/')||path.split('/').includes('..'))bad('RELATIVE_PATH');
 const abs=resolve(root,path);
 if(abs===root||!abs.startsWith(root+sep))bad('ESCAPE');
 const stats=lstatSync(abs);
 if(stats.isSymbolicLink()||!stats.isFile()||realpathSync(abs)!==abs)bad('NOT_REGULAR_'+path);
 const committed=expected??git(root,'rev-parse','--verify','HEAD:'+path);
 if(!/^[0-9a-f]{40}$/.test(committed)||
    git(root,'hash-object','--no-filters','--',path)!==committed)bad('RAW_BLOB_DRIFT_'+path);
}
function scanDir(root,rel,expected){
 const abs=resolve(root,rel),st=lstatSync(abs);
 if(!st.isDirectory()||st.isSymbolicLink()||realpathSync(abs)!==abs)bad('DIRECTORY_ESCAPE_'+rel);
 for(const entry of readdirSync(abs,{withFileTypes:true})){
  const path=rel+'/'+entry.name;
  if(entry.isSymbolicLink())bad('SYMLINK_'+path);
  if(entry.isDirectory())scanDir(root,path,expected);
  else if(!entry.isFile()||!expected.has(path))bad('UNTRACKED_COMPILED_INPUT_'+path);
 }
}
export function assertR22RawRustCheckout(rootPath){
 const root=resolve(rootPath),prefix=CRATE+'/';
 if(realpathSync(root)!==root)bad('ROOT_SYMLINK');
 const raw=execFileSync('git',['ls-tree','-r','-z','HEAD','--',CRATE],{
  cwd:root,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},
  encoding:'utf8',maxBuffer:16*1024*1024});
 const tracked=new Map();
 for(const entry of raw.split('\0').filter(Boolean)){
  const tab=entry.indexOf('\t');
  if(tab<0)bad('TREE_FORMAT');
  const [mode,type,sha]=entry.slice(0,tab).split(' ');
  const path=entry.slice(tab+1);
  if(!path.startsWith(prefix)||mode!=='100644'||type!=='blob'||
     !/^[0-9a-f]{40}$/.test(sha)||tracked.has(path))bad('TREE_MEMBER_'+path);
  tracked.set(path,sha);
 }
 if(tracked.size<60||!tracked.has(CRATE+'/Cargo.toml'))bad('RUST_CRATE_INCOMPLETE');
 // The immutable HEAD tree, not a potentially staged index, defines accepted inputs.
 for(const [path,sha] of tracked)rawFile(root,path,sha);
 for(const path of RELEASE_TRUST)rawFile(root,path);
 for(const folder of COMPILED_DIRS)scanDir(root,folder,tracked);
 // Cargo auto-discovers build.rs and local .cargo config; neither is part
 // of this reviewed Rust source tree. Adding one needs an explicit new Gate.
 for(const extra of [CRATE+'/build.rs',CRATE+'/.cargo','.cargo']){
  if(existsSync(join(root,extra)))bad('UNREVIEWED_CARGO_INPUT_'+extra);
 }
 const status=git(root,'status','--porcelain=v1','--untracked-files=all','--',
  CRATE+'/src',CRATE+'/data',CRATE+'/Cargo.toml');
 if(status)bad('DIRTY_RUST_SOURCE_STATUS');
 return {fixedHead:git(root,'rev-parse','HEAD'),trackedSourceFiles:tracked.size,
  releaseTrustFiles:RELEASE_TRUST.length,compilationInputsMatchHead:true};
}
