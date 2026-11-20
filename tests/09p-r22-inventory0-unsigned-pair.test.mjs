import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY0_PRODUCT_METHODS,inventory0UnsignedCandidate,
 inventory0UnsignedCandidateExact} from '../scripts/wasm-distribution/r22-inventory0-unsigned-pair.mjs';
const source=Object.freeze({
 contract:'wand.r22.steam626.inventory0.source-candidate@1',
 sourceHead:'f'.repeat(40),sourcePaths:11,
 coreTree:'6750ed91920f33be9f2acf180ca1326340d969ed',
 cargoGitBlob:'b3455c36d9d60b4a0e415026a095e47fe577644d',
 workerGitBlob:'775a2766f237d44ae77fa5347e9adf430c8580d2',
 productSessionGitBlob:'e53c4930a84f729ea245f38a1b301c7178146ced',
 sourceBytesPinned:true,oldBambooSignerGrantsThisBuild:false,
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
 denied({...source,sourceBytesPinned:false});
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
