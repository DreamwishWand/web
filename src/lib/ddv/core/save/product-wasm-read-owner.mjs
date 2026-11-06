// R04 opt-in read-only boundary owned by the SAME local Worker. No product UI
// export/import path until a signed wasm build and independent QA are accepted.
export const PRODUCT_WASM_READ_CONTRACT='wand.product.single-save-session.boundary@1';
export const PRODUCT_WASM_WORKER_MAX_BYTES=128*1024*1024;
export const PRODUCT_WASM_CHUNK_MAX_BYTES=1024*1024;
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SWITCH='9A239D3DB569756D';
const fail=code=>{throw Error(code)};
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const shaHex=/^[0-9a-f]{64}$/;
const sessionHex=/^[0-9a-f]{32}$/;
function exactBuild(b){
 if(!isPlain(b)||b.externallyConfirmed!==true||b.schema!==626||
    !((b.platform==='steam-windows'&&b.buildKind==='steam-full-version'&&b.buildId===STEAM)||
      (b.platform==='switch'&&b.buildKind==='switch-bid'&&b.buildId===SWITCH)))
   fail('PRODUCT_WORKER_BUILD_NOT_VERIFIED');
 return Object.freeze({platform:b.platform,buildKind:b.buildKind,buildId:b.buildId,schema:626});
}
function strictReceipt(r){
 if(!isPlain(r)||r.contract!==PRODUCT_WASM_READ_CONTRACT||
    !sessionHex.test(r.sessionId)||!shaHex.test(r.decodedSha256)||
    r.revision!==0||r.indexGeneration!==1||r.schema!==626||
    r.fullDocumentJsonValidated!==true||r.productWorkerBound!==true||
    r.allDomainReferencesVerified!==false||r.productReadAccepted!==false||
    r.writerAuthorized!==false||r.editedCopyAuthorized!==false||r.applyAuthorized!==false)
    fail('PRODUCT_WORKER_RUST_RECEIPT_INVALID');
 return Object.freeze({contract:r.contract,sessionId:r.sessionId,
    decodedSha256:r.decodedSha256,revision:0,indexGeneration:1,schema:626,
    fullDocumentJsonValidated:true,productWorkerBound:true,
    allDomainReferencesVerified:false,productReadAccepted:false,
    writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
}
/** Worker-only adapter. No caller/UI-supplied SessionID, readset, cursor or flags.
 * wasmFactory is a trusted static Worker import, not a message field. The
 * worker-side decode source owns the async decoded-chunk iterable.
 */
export function createProductWasmReadOwner(wasmFactory){
 if(typeof wasmFactory!=='function')fail('PRODUCT_WORKER_WASM_FACTORY_REQUIRED');
 if(typeof document!=='undefined')fail('PRODUCT_WORKER_NOT_ISOLATED');
 let epoch=0,active=null;
 const revoke=()=>{
   epoch++;
   const prev=active;active=null;
   if(prev){try{prev.wasm.close()}catch{}}
 };
 const close=()=>{revoke();return Object.freeze({closed:true,writerAuthorized:false})};
 const openDecoded=async ({build,decodedChunks}={})=>{
   // Revoke A synchronously BEFORE await, validation, or decoding B.
   revoke();const token=epoch;
   const identity=exactBuild(build);
   if(!decodedChunks||typeof decodedChunks[Symbol.asyncIterator]!=='function')
     fail('PRODUCT_WORKER_CHUNK_SOURCE_REQUIRED');
   let wasm=null,bytes=0;
   try{
     const module=await wasmFactory();
     if(token!==epoch)fail('PRODUCT_WORKER_OPEN_REVOKED');
     if(!isPlain(module)||typeof module.WorkerWasmSource!=='function')
       fail('PRODUCT_WORKER_WASM_UNAVAILABLE');
     const entropy=new Uint8Array(32);
     if(!globalThis.crypto?.getRandomValues)fail('PRODUCT_WORKER_ENTROPY_UNAVAILABLE');
     globalThis.crypto.getRandomValues(entropy);
     if(entropy.every(x=>x===0))fail('PRODUCT_WORKER_ENTROPY_UNAVAILABLE');
     try{
       wasm=new module.WorkerWasmSource(identity.platform,identity.buildKind,
           identity.buildId,identity.schema,true,entropy);
     }finally{entropy.fill(0)}
     for await(const chunk of decodedChunks){
       if(token!==epoch)fail('PRODUCT_WORKER_OPEN_REVOKED');
       if(!(chunk instanceof Uint8Array)||chunk.byteLength===0||
          chunk.byteLength>PRODUCT_WASM_CHUNK_MAX_BYTES||
          bytes+chunk.byteLength>PRODUCT_WASM_WORKER_MAX_BYTES)
          fail('PRODUCT_WORKER_CHUNK_BOUNDS');
       bytes+=chunk.byteLength;
       wasm.append_chunk(chunk); // never postMessage whole JSON/UI/Cloud
     }
     if(token!==epoch)fail('PRODUCT_WORKER_OPEN_REVOKED');
     if(bytes===0)fail('PRODUCT_WORKER_EMPTY_DOCUMENT');
     const receipt=strictReceipt(JSON.parse(wasm.finish()));
     if(token!==epoch)fail('PRODUCT_WORKER_OPEN_REVOKED');
     active={wasm,receipt,identity,cursors:new Map()};wasm=null;
     return receipt;
   }catch(error){
     // Already fail closed: no stale A is retained if B fails.
     if(error instanceof Error&&/^PRODUCT_WORKER_/.test(error.message))throw error;
     fail('PRODUCT_WORKER_RUST_FAILURE');
   }finally{
     if(wasm){try{wasm.close()}catch{}}
   }
 };
 const readCoreVersion=scope=>{
   const a=active;
   if(!a)fail('PRODUCT_WORKER_SESSION_CLOSED');
   if(!isPlain(scope)||Object.keys(scope).sort().join(',')!==
       'decodedSha256,indexGeneration,revision,sessionId'||
       scope.sessionId!==a.receipt.sessionId||
       scope.decodedSha256!==a.receipt.decodedSha256||
       scope.revision!==a.receipt.revision||
       scope.indexGeneration!==a.receipt.indexGeneration)
     fail('PRODUCT_WORKER_SCOPE_CAS');
   let result;
   try{result=JSON.parse(a.wasm.read_core_version_witness(scope.sessionId,
          BigInt(scope.revision),BigInt(scope.indexGeneration),scope.decodedSha256))}
   catch{fail('PRODUCT_WORKER_RUST_READ_REJECTED')}
   if(!isPlain(result)||result.sessionId!==a.receipt.sessionId||
       result.revision!==0||result.indexGeneration!==1||
       result.decodedSha256!==a.receipt.decodedSha256||
       result.coreOwnedReadset!=='/GameInfo/Version'||
       result.completeAllDomains!==false||result.writerAuthorized!==false)
     fail('PRODUCT_WORKER_RUST_READ_RECEIPT_INVALID');
   return Object.freeze({sessionId:result.sessionId,revision:0,indexGeneration:1,
      decodedSha256:result.decodedSha256,coreOwnedReadset:'/GameInfo/Version',
      completeAllDomains:false,writerAuthorized:false});
 };
 // Source-only Stage D inside the trusted Worker. These methods are NOT
 // connected to the public Worker message router or UI/Save consumer.
 const typedScope=scope=>{
   const a=active;
   if(!a)fail('PRODUCT_WORKER_SESSION_CLOSED');
   if(!isPlain(scope)||Object.keys(scope).sort().join(',')!==
      'decodedSha256,indexGeneration,revision,sessionId'||
      scope.sessionId!==a.receipt.sessionId||
      scope.revision!==a.receipt.revision||
      scope.indexGeneration!==a.receipt.indexGeneration||
      scope.decodedSha256!==a.receipt.decodedSha256)
      fail('PRODUCT_WORKER_SCOPE_CAS');
   return a;
 };
 const strictTypedJson=(raw,maxBytes)=>{
   if(typeof raw!=='string'||raw.length>maxBytes)fail('PRODUCT_WORKER_TYPED_RESPONSE_BOUNDS');
   try{return JSON.parse(raw)}catch{fail('PRODUCT_WORKER_TYPED_RESPONSE_JSON')}
 };
 const exactKeys=(obj,names)=>isPlain(obj)&&
   Object.keys(obj).sort().join(',')===names.split(',').sort().join(',');
 const typedReadFailure=()=>{
   revoke();
   fail('PRODUCT_WORKER_RUST_TYPED_RECEIPT_INVALID');
 };
 const issueTypedCursor=(scope,domain)=>{
   const a=typedScope(scope);
   if(domain!=='player'&&domain!=='world')fail('PRODUCT_WORKER_DOMAIN_DENIED');
   if(a.cursors.size>=2)fail('PRODUCT_WORKER_CURSOR_LIMIT');
   if(typeof a.wasm.issue_typed_cursor!=='function')
      fail('PRODUCT_WORKER_TYPED_FEATURE_DISABLED');
   let r;
   try{r=strictTypedJson(a.wasm.issue_typed_cursor(domain,scope.sessionId,
       BigInt(scope.revision),BigInt(scope.indexGeneration),scope.decodedSha256),4096)}
   catch{typedReadFailure()}
   if(!exactKeys(r,'cursor,sessionId,revision,indexGeneration,decodedSha256,domain,maxEntriesPerPage,completeAllDomains,productReadAccepted,writerAuthorized')||
      !sessionHex.test(r.cursor)||a.cursors.has(r.cursor)||
      r.sessionId!==scope.sessionId||r.decodedSha256!==scope.decodedSha256||
      r.revision!==0||r.indexGeneration!==1||
      r.domain!==('/'+(domain==='player'?'Player':'World'))||
      r.maxEntriesPerPage!==16||r.completeAllDomains!==false||
      r.productReadAccepted!==false||r.writerAuthorized!==false)
       typedReadFailure();
   a.cursors.set(r.cursor,r.domain);
   return Object.freeze({cursor:r.cursor,sessionId:r.sessionId,
     revision:0,indexGeneration:1,decodedSha256:r.decodedSha256,
     domain:r.domain,maxEntriesPerPage:16,
     completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
 };
 const readTypedPage=(scope,cursor)=>{
   const a=typedScope(scope);
   if(typeof cursor!=='string'||!sessionHex.test(cursor)||
      !a.cursors.has(cursor))fail('PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');
   if(typeof a.wasm.read_typed_page!=='function')
      fail('PRODUCT_WORKER_TYPED_FEATURE_DISABLED');
   const expectedDomain=a.cursors.get(cursor);
   let r;
   try{r=strictTypedJson(a.wasm.read_typed_page(cursor,scope.sessionId,
       BigInt(scope.revision),BigInt(scope.indexGeneration),scope.decodedSha256),8192)}
   catch{typedReadFailure()}
   if(!exactKeys(r,'sessionId,revision,indexGeneration,decodedSha256,domain,fields,nextCursor,completeAllDomains,productReadAccepted,writerAuthorized')||
      r.sessionId!==scope.sessionId||r.decodedSha256!==scope.decodedSha256||
      r.revision!==0||r.indexGeneration!==1||
      r.domain!==expectedDomain||r.completeAllDomains!==false||
      r.productReadAccepted!==false||r.writerAuthorized!==false||
      !Array.isArray(r.fields)||r.fields.length>16||
      !(r.nextCursor===null||(typeof r.nextCursor==='string'&&
         sessionHex.test(r.nextCursor)&&r.nextCursor!==cursor&&
         !a.cursors.has(r.nextCursor))))typedReadFailure();
   let descriptors;
   try{
      descriptors=r.fields.map(f=>{
         if(!exactKeys(f,'key,kind,valueBytes')||
           typeof f.key!=='string'||new TextEncoder().encode(f.key).length>128||
           !['object','array','string','number','boolean','null'].includes(f.kind)||
           !Number.isSafeInteger(f.valueBytes)||f.valueBytes<1||
           f.valueBytes>PRODUCT_WASM_WORKER_MAX_BYTES)throw Error('BAD_DESCRIPTOR');
         return Object.freeze({key:f.key,kind:f.kind,valueBytes:f.valueBytes});
      });
   }catch{typedReadFailure()}
   // Only commit local cursor rotation after successful Rust receipt validation.
   a.cursors.delete(cursor);
   if(r.nextCursor)a.cursors.set(r.nextCursor,expectedDomain);
   return Object.freeze({sessionId:r.sessionId,revision:0,indexGeneration:1,
     decodedSha256:r.decodedSha256,domain:expectedDomain,
     fields:Object.freeze(descriptors),nextCursor:r.nextCursor,
     completeAllDomains:false,productReadAccepted:false,writerAuthorized:false});
 };
 const submitOperation=()=>fail('PRODUCT_WORKER_WRITER_DISABLED');
 const getCapabilities=()=>Object.freeze({
   productWorkerBoundary:true,productReadAccepted:false,
   typedMetadataSourceOnly:true,canReadTypedMetadataInProduct:false,
   oneRustSession:true,readCoreVersionOnly:true,completeAllDomains:false,
   canStage:false,canExportEditedCopy:false,canApply:false,
   canOriginalOverwrite:false,maxChunkBytes:PRODUCT_WASM_CHUNK_MAX_BYTES,
   maxDecodedBytes:PRODUCT_WASM_WORKER_MAX_BYTES
 });
 return Object.freeze({openDecoded,readCoreVersion,issueTypedCursor,readTypedPage,
   close,submitOperation,getCapabilities,
   getReceipt:()=>active?.receipt??null});
}
