// 09P ACT1581: isolated genuine Rust WASM binary pairing, NEVER public issuer.
// The ONLY output is an OFF/unsigned candidate witness, never a signed binary.
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyR22Inventory0SourceCandidate} from './r22-inventory0-product-source.mjs';

export const INVENTORY0_PRODUCT_METHODS=Object.freeze([
 'append_chunk','finish','read_core_version_witness','issue_typed_cursor','read_typed_page',
 'issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page',
 'discover_scoped_amount','preview_scoped_amount','stage_scoped_amount',
 'toggle_scoped_edit','begin_scoped_edit_output','next_scoped_edit_output_chunk',
 'toggle_scoped_amount','begin_scoped_amount_output','next_scoped_amount_output_chunk','close'
].sort());
const oldReaderCargo='751a73da41d8b58f7de70643f50b97722a3c1260';
const deny=s=>{throw Error('R22_INV0_UNSIGNED_PAIR_DENIED_'+s)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const plain=(o,keys)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex40=s=>typeof s==='string'&&/^[0-9a-f]{40}$/.test(s);
const validSource=s=>plain(s,['contract','sourceHead','sourcePaths','coreTree',
 'cargoGitBlob','workerGitBlob','productSessionGitBlob','sourceBytesPinned',
 'oldBambooSignerGrantsThisBuild','productCandidateOnly','mergeAuthorized',
 'signerAuthorized','writerAuthorized','operationOn','requiresNewSecurityL2'])&&
 s.contract==='wand.r22.steam626.inventory0.source-candidate@1'&&
 hex40(s.sourceHead)&&s.sourcePaths===11&&
 s.coreTree==='6750ed91920f33be9f2acf180ca1326340d969ed'&&
 s.cargoGitBlob==='b3455c36d9d60b4a0e415026a095e47fe577644d'&&
 s.workerGitBlob==='775a2766f237d44ae77fa5347e9adf430c8580d2'&&
 s.productSessionGitBlob==='e53c4930a84f729ea245f38a1b301c7178146ced'&&
 s.sourceBytesPinned===true&&s.oldBambooSignerGrantsThisBuild===false&&
 s.productCandidateOnly===true&&s.mergeAuthorized===false&&
 s.signerAuthorized===false&&s.writerAuthorized===false&&s.operationOn===false&&
 s.requiresNewSecurityL2===true;

export function inventory0UnsignedCandidate(source,js,wasm,methods){
 if(!validSource(source))deny('SOURCE_AUTHORITY_OR_SHA');
 if(!Buffer.isBuffer(js)||js.length<512||js.length>4*1024*1024||
    !js.toString('utf8').includes('class WorkerWasmSource'))deny('GENERATED_JS_NOT_WORKER');
 if(!Buffer.isBuffer(wasm)||wasm.length<8||wasm.length>24*1024*1024||
    wasm.subarray(0,8).toString('hex')!=='0061736d01000000'||
    !WebAssembly.validate(wasm))deny('GENERATED_WASM_INVALID');
 if(!Array.isArray(methods)||!equal([...methods].sort(),INVENTORY0_PRODUCT_METHODS))
  deny('WASM_WORKER_PUBLIC_ABI_NOT_EXACT17');
 return Object.freeze({
  contract:'wand.r22.steam626.inventory0.unsigned-js-wasm-candidate@1',
  sourceHead:source.sourceHead,
  protectedSecurityAnchor:'f420bbe72fbc3374f0a3867403c660873ce5f06a',
  latestProtectedMainCASVerified:false,
  source:Object.freeze({coreTree:source.coreTree,
   cargoGitBlob:source.cargoGitBlob,workerGitBlob:source.workerGitBlob,
   productSessionGitBlob:source.productSessionGitBlob,
   oldReaderCargoGitBlob:oldReaderCargo,
   features:['worker-wasm','product-steam626-catalog0-scoped'],
   lockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',
   rustc:'1.99.1',wasmBindgenCli:'0.2.105'}),
  abi: Object.freeze({className:'WorkerWasmSource',methods:INVENTORY0_PRODUCT_METHODS,
   inventoryId:0,allowedProfile:'catalog0-furniture',
   foreignChestEnabled:false,entitlementEditingEnabled:false}),
  subjects:Object.freeze({js:Object.freeze({bytes:js.length,sha256:sha(js)}),
   wasm:Object.freeze({bytes:wasm.length,sha256:sha(wasm)})}),
  release:Object.freeze({kind:'OFF_UNSIGNABLE_SOURCE_WITNESS',
   signatureVerified:false,issuerAuthorized:false,
   publishedPages:false,productOpOn:false,writerAuthorized:false,
   browserConsumerOn:false,genuineEncryptedProductV2Verified:false,
   independentSecurityL2Accepted:false})
 });
}
export function inventory0UnsignedCandidateExact(receipt,source,js,wasm,methods){
 let expected;
 try{expected=inventory0UnsignedCandidate(source,js,wasm,methods)}
 catch{return false}
 return equal(receipt,expected);
}
const regular=(f)=>{
 const path=resolve(f),s=lstatSync(path);
 if(!s.isFile()||s.isSymbolicLink())deny('SUBJECT_PATH_NOT_REGULAR');
 return readFileSync(path);
};
async function cli(){
 const [action,jsPath,wasmPath,methodPath,manifestPath]=process.argv.slice(2);
 if(!['make','verify'].includes(action)||!jsPath||!wasmPath||!methodPath||!manifestPath)
  deny('CLI_EXACT_FIVE_ARGUMENTS');
 if(process.env.GITHUB_ACTIONS!=='true'||
    process.env.GITHUB_REPOSITORY_ID!=='1371485649'||
    process.env.GITHUB_REPOSITORY!=='DreamwishWand/web'||
    process.env.GITHUB_EVENT_NAME!=='pull_request')deny('UNTRUSTED_CI_CONTEXT');
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',env:{
  ...process.env,GIT_NO_REPLACE_OBJECTS:'1'}}).trim();
 if(process.env.WAND_SOURCE_HEAD!==head)deny('SOURCE_HEAD_NOT_CI');
 const original=verifyR22Inventory0SourceCandidate(head);
 const js=regular(jsPath),wasm=regular(wasmPath),
  methods=JSON.parse(regular(methodPath).toString('utf8'));
 const receipt=inventory0UnsignedCandidate(original,js,wasm,methods);
 if(action==='make'){
  writeFileSync(resolve(manifestPath),JSON.stringify(receipt)+'\n',
   {mode:0o600,flag:'wx'});
 }else{
  const stored=JSON.parse(regular(manifestPath).toString('utf8'));
  if(!inventory0UnsignedCandidateExact(stored,original,js,wasm,methods))
   deny('MANIFEST_OR_BINARY_DIGEST_MISMATCH');
 }
 console.log('R22_INVENTORY0_GENUINE_WASM_PAIR_UNSIGNED_ONLY_NO_RELEASE_NO_WRITER_NO_OP',action,
  receipt.sourceHead,receipt.subjects.js.sha256,receipt.subjects.wasm.sha256);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 await cli();
