// Local authorized Private product-V2 build only. Reuse the current
// protected Pages signer tuple and exact-subject Sigstore verifier. No
// browser input, public deployment, public ON or new issuer trust root.
// Never run against a shared production checkout. The committed anchor
// remains null; only this isolated build gets the sealed loopback identity.
import {readFile,writeFile,mkdir,rename,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ACTIVE_RELEASE_TUPLE,protectedPagesContextMatches} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {verifySignedReleaseSubjects} from './seal.mjs';
import {SCOPED_SWITCH_CHEST_ASSET_DIR,SCOPED_SWITCH_CHEST_RELEASE_OP,scopedSwitchChestManifestOk,
 scopedSwitchChestAnchorShapeOk,scopedSwitchChestReleaseIdentityText,scopedSwitchChestWasmExportsOk} from '../../src/lib/ddv/core/save/product-scoped-switch-chest-release.mjs';
const root=resolve(import.meta.dirname,'../..'),names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const fail=()=>{throw Error('SCOPED_SWITCH_CHEST_PRIVATE_SEAL_DENIED')};
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
export function inspectScopedSwitchChestSubjects(bytes,source,tuple=ACTIVE_RELEASE_TUPLE){
 if(!Array.isArray(bytes)||bytes.length!==3||bytes.some((b,i)=>!Buffer.isBuffer(b)||!b.length||b.length>[64*1024,2*1024*1024,20*1024*1024][i]))fail();
 const [mf,js,wasm]=bytes;
 let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf))}catch{fail()}
 const p={contract:'wand.scoped-switch-chest.pinned-digests@1',sourceHead:source,
  manifestSha256:sha(mf),manifestSizeBytes:mf.length,jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length};
 if(!scopedSwitchChestManifestOk(m,p,tuple))fail();
 const module=new WebAssembly.Module(wasm),denied=/(?:dev_(?:stage|undo|redo|begin|take)|private_native|(?:discover|preview|stage|toggle)_scoped_amount|(?:begin_scoped_amount_output|next_scoped_amount_output_chunk)|preview_scoped_collection_candidate|(?:preview|stage)_fixed_collection)/i;
 if(!scopedSwitchChestWasmExportsOk(module)||WebAssembly.Module.exports(module).some(x=>denied.test(x.name))||denied.test(new TextDecoder('utf-8',{fatal:true}).decode(js)))fail();
 return Object.freeze(p);
}
export function privateScopedSwitchChestIdentity(pins,deliveryOrigin,platforms,tuple=ACTIVE_RELEASE_TUPLE){
 if(!Array.isArray(platforms)||platforms.length!==1||platforms[0]!=='switch')fail();
 const ids={switch:'9A239D3DB569756D'};
 if(platforms.some(k=>!Object.hasOwn(ids,k)))fail();
 const a={contract:'wand.scoped-switch-chest.protected-release@1',...tuple,operation:SCOPED_SWITCH_CHEST_RELEASE_OP,pins,
  mode:'private-product-v2',deliveryOrigin,builds:platforms.map(platform=>({platform,buildId:ids[platform],productV2EvidenceSha256:null})),
  attestationVerifiedAtBuild:true,releaseId:'0'.repeat(64)};
 if(!scopedSwitchChestAnchorShapeOk(a))fail();
 return Object.freeze({...a,releaseId:sha(scopedSwitchChestReleaseIdentityText(a))});
}
async function main(){
 // A private lab invocation is not a Pages build and cannot set public mode.
 // Source/route and Cargo are the exact signed source HEAD, not a DEV overlay.
 const [cmd,source,dir,bundle,origin,platforms]=process.argv.slice(2);
 if(!/^[0-9a-f]{40}$/.test(source??'')||git('rev-parse','HEAD')!==source||!dir||!bundle||!(await readFile(resolve(bundle))).length)fail();
 if(cmd==='verify-protected-candidate'){
  // Existing Pages signer only, proof output only. No anchor or static copy.
  if(process.argv.length!==6||!protectedPagesContextMatches(process.env,source,git('rev-parse','HEAD')))fail();
  const pins=await verifySignedReleaseSubjects(resolve(dir),source,resolve(bundle),ACTIVE_RELEASE_TUPLE,inspectScopedSwitchChestSubjects);
  console.log('SCOPED_SWITCH_CHEST_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY',JSON.stringify(pins));return;
 }
 if(cmd!=='seal-private-v2'||process.argv.length!==8||process.env.GITHUB_ACTIONS==='true'||
   git('diff','--name-only','HEAD')!==''||git('status','--porcelain','--untracked-files=all')!=='')fail();
 const tuple=ACTIVE_RELEASE_TUPLE,anchorPath=join(root,'src/lib/ddv/core/save/product-scoped-switch-chest-release-anchor.mjs');
 const target=join(root,'static',SCOPED_SWITCH_CHEST_ASSET_DIR);
 const prior=await readFile(anchorPath,'utf8');
 if(!prior.includes('PROTECTED_SCOPED_SWITCH_CHEST_RELEASE_ANCHOR=null;')||!(await readFile(resolve(bundle))).length)fail();
 const pins=await verifySignedReleaseSubjects(resolve(dir),source,resolve(bundle),tuple,inspectScopedSwitchChestSubjects);
 const a=privateScopedSwitchChestIdentity(pins,origin,platforms.split(','),tuple);
 // No existing destination or symlink can be replaced. Signatures were
 // checked on immutable snapshots by the reused verifier; recheck copies.
 await mkdir(target,{recursive:false});
 let committed=false,ownedTemp=false;
 const temp=anchorPath+'.private-v2.tmp';
 try{
  const bytes=await Promise.all(names.map(n=>readFile(join(resolve(dir),n))));
  if(JSON.stringify(inspectScopedSwitchChestSubjects(bytes,source,tuple))!==JSON.stringify(pins))fail();
  for(let i=0;i<names.length;i++)await writeFile(join(target,names[i]),bytes[i],{flag:'wx',mode:0o600});
  const copied=await Promise.all(names.map(n=>readFile(join(target,n))));
  if(JSON.stringify(inspectScopedSwitchChestSubjects(copied,source,tuple))!==JSON.stringify(pins))fail();
  const out='// GENERATED in authorized isolated private product-V2 build; never commit.\nconst data='+JSON.stringify(a)+';\nObject.freeze(data.pins); data.builds.forEach(Object.freeze); Object.freeze(data.builds);\nexport const PROTECTED_SCOPED_SWITCH_CHEST_RELEASE_ANCHOR=Object.freeze(data);\n';
  await writeFile(temp,out,{flag:'wx',mode:0o600});ownedTemp=true;
  if(await readFile(anchorPath,'utf8')!==prior||git('rev-parse','HEAD')!==source)fail();
  await rename(temp,anchorPath);ownedTemp=false;committed=true;
  console.log('SCOPED_SWITCH_CHEST_PRIVATE_SIGNED_SUBJECTS_SEALED_NO_PUBLIC_GRANT',a.releaseId);
 }finally{if(ownedTemp)await rm(temp,{force:true});if(!committed)await rm(target,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
