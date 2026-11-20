import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {INVENTORY0_PRODUCT_METHODS,inventory0UnsignedCandidate,
 inventory0UnsignedCandidateExact,inventory0PairPath} from '../scripts/wasm-distribution/r22-inventory0-unsigned-pair.mjs';
const source=Object.freeze({
 contract:'wand.r22.steam626.inventory0.source-candidate@1',
 sourceHead:'f'.repeat(40),sourcePaths:11,
 coreTree:'b29f86343a6052b93bfedbf4379c6958907a6c3d',
 cargoGitBlob:'b3455c36d9d60b4a0e415026a095e47fe577644d',
 workerGitBlob:'f4cf9d66f857a2e20b597de9f697a458b6ab550c',
 productSessionGitBlob:'e53c4930a84f729ea245f38a1b301c7178146ced',
 product11SourcePinned:true,auxiliarySourceShaVerified:false,
 completeSourceVerified:false,sourceBytesPinned:false,
 oldBambooSignerGrantsThisBuild:false,
 productCandidateOnly:true,mergeAuthorized:false,signerAuthorized:false,
 writerAuthorized:false,operationOn:false,requiresNewSecurityL2:true
});
const js=Buffer.from('class WorkerWasmSource {'+' '.repeat(650)+'}');
const wasm=Buffer.from([0,97,115,109,1,0,0,0]);
const denied=(s,j=js,w=wasm,m=INVENTORY0_PRODUCT_METHODS)=>
 assert.throws(()=>inventory0UnsignedCandidate(s,j,w,m),
 /R22_INV0_UNSIGNED_PAIR_DENIED_/);

test('offline witness schema explicitly cannot authorize signatures, Pages, Writer or Op',()=>{
 const r=inventory0UnsignedCandidate(source,js,wasm,INVENTORY0_PRODUCT_METHODS);
 assert.equal(inventory0UnsignedCandidateExact(r,source,js,wasm,INVENTORY0_PRODUCT_METHODS),true);
 assert.equal(r.source.product11SourcePinned,true);
 assert.equal(r.source.auxiliarySourceShaVerified,false);
 assert.equal(r.source.completeSourceVerified,false);
 assert.equal(r.release.signatureVerified,false);
 assert.equal(r.release.issuerAuthorized,false);
 assert.equal(r.release.publishedPages,false);
 assert.equal(r.release.productOpOn,false);
 assert.equal(r.release.writerAuthorized,false);
 assert.equal(r.release.genuineEncryptedProductV2Verified,false);
 assert.equal(r.latestProtectedMainCASVerified,false);
 assert.deepEqual(r.abi.methods,INVENTORY0_PRODUCT_METHODS);
 assert.equal(r.abi.entitlementEditingEnabled,false);
 assert.equal(r.abi.foreignChestEnabled,false);
 assert.equal(r.source.oldReaderCargoGitBlob,
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 for(const wrong of [
  {...r,contract:'wand.fake'},
  {...r,release:{...r.release,signatureVerified:true}},
  {...r,release:{...r.release,writerAuthorized:true}},
  {...r,release:{...r.release,productOpOn:true}},
  {...r,release:{...r.release,publishedPages:true}},
  {...r,release:{...r.release,independentSecurityL2Accepted:true}},
  {...r,source:{...r.source,features:['worker-wasm','indexed-read']}},
  {...r,subjects:{...r.subjects,wasm:{...r.subjects.wasm,sha256:'0'.repeat(64)}}},
  {...r,abi:{...r.abi,foreignChestEnabled:true}},
  {...r,extra:true}
 ])assert.equal(inventory0UnsignedCandidateExact(wrong,source,js,wasm,INVENTORY0_PRODUCT_METHODS),false);
});
test('changing a generated pair byte, source SHA/mode closure, or ABI fails closed',()=>{
 const r=inventory0UnsignedCandidate(source,js,wasm,INVENTORY0_PRODUCT_METHODS);
 assert.equal(inventory0UnsignedCandidateExact(r,source,Buffer.concat([js,Buffer.from('x')]),
  wasm,INVENTORY0_PRODUCT_METHODS),false);
 assert.equal(inventory0UnsignedCandidateExact(r,source,js,Buffer.concat([wasm,Buffer.from([0])]),
  INVENTORY0_PRODUCT_METHODS),false);
 denied({...source,cargoGitBlob:'a'.repeat(40)});
 denied({...source,sourceBytesPinned:true});
 denied({...source,completeSourceVerified:true});
 denied({...source,auxiliarySourceShaVerified:true});
 denied({...source,product11SourcePinned:false});
 denied({...source,mergeAuthorized:true});
 denied({...source,writerAuthorized:true});
 denied({...source,requiresNewSecurityL2:false});
 denied(source,Buffer.from('bad JS wrapper'));
 denied(source,js,Buffer.from('bad WASM'));
 denied(source,js,wasm,['append_chunk','finish']);
 denied(source,js,wasm,[...INVENTORY0_PRODUCT_METHODS,'discover_switch626_chest']);
 denied(source,js,wasm,[...INVENTORY0_PRODUCT_METHODS,'preview_steam626_comp03']);
 console.log('09P_INV0_UNSIGNED_GENUINE_ASSET_PAIR_FORMAT_NEGATIVE_NO_SIGNATURE_GRANT');
});

test('CI-root subject path is absolute, regular, private, and rejects parent symlinks',()=>{
 const temp=mkdtempSync(join(tmpdir(),'9p-inv0-pair-boundary-'));
 try{
  const root=join(temp,'runner'),sub=join(root,'09p-inv0-wasm');
  mkdirSync(root);mkdirSync(sub);
  const jsFile=join(sub,'ddv_save_core.js'),abi=join(sub,'abi.json');
  writeFileSync(jsFile,'class WorkerWasmSource {}',{mode:0o644,flag:'wx'});
  writeFileSync(abi,'[]',{mode:0o600,flag:'wx'});
  assert.equal(inventory0PairPath(root,jsFile,'ddv_save_core.js'),jsFile);
  assert.equal(inventory0PairPath(root,abi,'abi.json'),abi);
  const manifest=join(sub,'unsigned-pair.json');
  assert.equal(inventory0PairPath(root,manifest,'unsigned-pair.json',false),manifest);
  assert.throws(()=>inventory0PairPath(root,join(temp,'escape.js'),'ddv_save_core.js'),
    /R22_INV0_UNSIGNED_PAIR_DENIED_/);
  assert.throws(()=>inventory0PairPath(root,jsFile,'abi.json'),
    /R22_INV0_UNSIGNED_PAIR_DENIED_/);
  const rootAlias=join(temp,'root-alias');
  symlinkSync(root,rootAlias,'dir');
  assert.throws(()=>inventory0PairPath(rootAlias,join(rootAlias,'09p-inv0-wasm','ddv_save_core.js'),
   'ddv_save_core.js'),/R22_INV0_UNSIGNED_PAIR_DENIED_/);
  const parent=join(temp,'parent');
  mkdirSync(parent);symlinkSync(sub,join(parent,'09p-inv0-wasm'),'dir');
  assert.throws(()=>inventory0PairPath(parent,join(parent,'09p-inv0-wasm','ddv_save_core.js'),
   'ddv_save_core.js'),/R22_INV0_UNSIGNED_PAIR_DENIED_/);
  const forgedWasm=join(sub,'ddv_save_core_bg.wasm');
  symlinkSync(jsFile,forgedWasm);
  assert.throws(()=>inventory0PairPath(root,forgedWasm,'ddv_save_core_bg.wasm'),
   /R22_INV0_UNSIGNED_PAIR_DENIED_/);
  writeFileSync(manifest,'{}',{mode:0o600,flag:'wx'});
  assert.throws(()=>inventory0PairPath(root,manifest,'unsigned-pair.json',false),
   /R22_INV0_UNSIGNED_PAIR_DENIED_/);
  assert.equal(inventory0PairPath(root,manifest,'unsigned-pair.json',true),manifest);
  console.log('09P_INV0_PAIR_PARENT_SYMLINK_BASENAME_ESCAPE_MODE_AND_OVERWRITE_DENIED');
 }finally{rmSync(temp,{recursive:true,force:true})}
});
