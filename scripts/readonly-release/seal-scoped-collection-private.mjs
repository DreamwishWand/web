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
import {SCOPED_COLLECTION_ASSET_DIR,SCOPED_COLLECTION_RELEASE_OP,scopedCollectionManifestOk,
 scopedCollectionAnchorShapeOk,scopedCollectionReleaseIdentityText,scopedCollectionWasmExportsOk} from '../../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
const root=resolve(import.meta.dirname,'../..'),names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const fail=()=>{throw Error('SCOPED_COLLECTION_PRIVATE_SEAL_DENIED')};
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
export function inspectScopedCollectionSubjects(bytes,source,tuple=ACTIVE_RELEASE_TUPLE){
 if(!Array.isArray(bytes)||bytes.length!==3)fail();
 const [mf,js,wasm]=bytes;
 let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf))}catch{fail()}
 const p={contract:'wand.scoped-collection.pinned-digests@1',sourceHead:source,
  manifestSha256:sha(mf),manifestSizeBytes:mf.length,jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length};
 if(!scopedCollectionManifestOk(m,p,tuple))fail();
 const module=new WebAssembly.Module(wasm),denied=/(?:dev_(?:stage|undo|redo|begin|take)|private_native|scoped_amount|(?:preview|stage)_steam626_sr03|(?:preview|stage)_switch626_rm01)/i;
 if(!scopedCollectionWasmExportsOk(module)||WebAssembly.Module.exports(module).some(x=>denied.test(x.name))||denied.test(new TextDecoder('utf-8',{fatal:true}).decode(js)))fail();
 return Object.freeze(p);
}
export function privateScopedCollectionIdentity(pins,deliveryOrigin,platforms,tuple=ACTIVE_RELEASE_TUPLE){
 if(!Array.isArray(platforms)||platforms.length<1||platforms.length>2)fail();
 const ids={'steam-windows':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',switch:'9A239D3DB569756D'};
 if(platforms.some(k=>!Object.hasOwn(ids,k)))fail();
 const a={contract:'wand.scoped-collection.protected-release@1',...tuple,operation:SCOPED_COLLECTION_RELEASE_OP,pins,
  mode:'private-product-v2',deliveryOrigin,builds:platforms.map(platform=>({platform,buildId:ids[platform],productV2EvidenceSha256:null})),
  attestationVerifiedAtBuild:true,releaseId:'0'.repeat(64)};
 if(!scopedCollectionAnchorShapeOk(a))fail();
 return Object.freeze({...a,releaseId:sha(scopedCollectionReleaseIdentityText(a))});
}
async function main(){
 // A private lab invocation is not a Pages build and cannot set public mode.
 // Source/route and Cargo are the exact signed source HEAD, not a DEV overlay.
 const [cmd,source,dir,bundle,origin,platforms]=process.argv.slice(2);
 if(!/^[0-9a-f]{40}$/.test(source??'')||git('rev-parse','HEAD')!==source||!dir||!bundle||!(await readFile(resolve(bundle))).length)fail();
 if(cmd==='verify-protected-candidate'){
  // Existing Pages signer only, proof output only. No anchor or static copy.
  if(process.argv.length!==6||!protectedPagesContextMatches(process.env,source,git('rev-parse','HEAD')))fail();
  const pins=await verifySignedReleaseSubjects(resolve(dir),source,resolve(bundle),ACTIVE_RELEASE_TUPLE,inspectScopedCollectionSubjects);
  console.log('SCOPED_COLLECTION_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY',JSON.stringify(pins));return;
 }
 if(cmd!=='seal-private-v2'||process.argv.length!==8||process.env.GITHUB_ACTIONS==='true'||
   git('diff','--name-only','HEAD')!==''||git('status','--porcelain','--untracked-files=all')!=='')fail();
 const tuple=ACTIVE_RELEASE_TUPLE,anchorPath=join(root,'src/lib/ddv/core/save/product-scoped-collection-release-anchor.mjs');
 const target=join(root,'static',SCOPED_COLLECTION_ASSET_DIR);
 const prior=await readFile(anchorPath,'utf8');
 if(!prior.includes('PROTECTED_SCOPED_COLLECTION_RELEASE_ANCHOR=null;')||!(await readFile(resolve(bundle))).length)fail();
 const pins=await verifySignedReleaseSubjects(resolve(dir),source,resolve(bundle),tuple,inspectScopedCollectionSubjects);
 const a=privateScopedCollectionIdentity(pins,origin,platforms.split(','),tuple);
 // No existing destination or symlink can be replaced. Signatures were
 // checked on immutable snapshots by the reused verifier; recheck copies.
 await mkdir(target,{recursive:false});
 let committed=false;
 const temp=anchorPath+'.private-v2.tmp';
 try{
  const bytes=await Promise.all(names.map(n=>readFile(join(resolve(dir),n))));
  if(JSON.stringify(inspectScopedCollectionSubjects(bytes,source,tuple))!==JSON.stringify(pins))fail();
  for(let i=0;i<names.length;i++)await writeFile(join(target,names[i]),bytes[i],{flag:'wx',mode:0o600});
  const copied=await Promise.all(names.map(n=>readFile(join(target,n))));
  if(JSON.stringify(inspectScopedCollectionSubjects(copied,source,tuple))!==JSON.stringify(pins))fail();
  const out='// GENERATED in authorized isolated private product-V2 build; never commit.\nconst data='+JSON.stringify(a)+';\nObject.freeze(data.pins); data.builds.forEach(Object.freeze); Object.freeze(data.builds);\nexport const PROTECTED_SCOPED_COLLECTION_RELEASE_ANCHOR=Object.freeze(data);\n';
  await writeFile(temp,out,{flag:'wx',mode:0o600});
  if(await readFile(anchorPath,'utf8')!==prior||git('rev-parse','HEAD')!==source)fail();
  await rename(temp,anchorPath);committed=true;
  console.log('SCOPED_COLLECTION_PRIVATE_SIGNED_SUBJECTS_SEALED_NO_PUBLIC_GRANT',a.releaseId);
 }finally{await rm(temp,{force:true});if(!committed)await rm(target,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
