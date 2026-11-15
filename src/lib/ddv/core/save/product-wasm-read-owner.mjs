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
export function createProductWasmReadOwner(wasmFactory,{allowDevSemanticWriter=false}={}){
 if(typeof allowDevSemanticWriter!=='boolean')fail('PRODUCT_WORKER_DEV_FLAG_INVALID');
 if(typeof wasmFactory!=='function')fail('PRODUCT_WORKER_WASM_FACTORY_REQUIRED');
 if(typeof document!=='undefined')fail('PRODUCT_WORKER_NOT_ISOLATED');
 let epoch=0,active=null;
 const revoke=()=>{
   epoch++;
   const prev=active;active=null;
   if(prev){try{prev.wasm.close()}catch{}}
 };
 const close=()=>{revoke();return Object.freeze({closed:true,writerAuthorized:false})};
 const openDecoded=async (args={})=>{
   // Revoke A synchronously BEFORE await, validation, or decoding B.
   revoke();const token=epoch;
   if(!isPlain(args)||Object.keys(args).sort().join(',')!=='build,decodedChunks')
       fail('PRODUCT_WORKER_UNTRUSTED_OPEN_ARGS');
   const {build,decodedChunks}=args;
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
 const nonzeroCursor=v=>typeof v==='string'&&sessionHex.test(v)&&
   !/^0{32}$/.test(v);
 // Inspect bounded raw JSON before JSON.parse collapses duplicate object keys.
 // Decode keys through JSON.parse so escaped-equivalent property names collide.
 const rejectDuplicateJsonKeys=raw=>{
   const stack=[];
   for(let i=0;i<raw.length;){
     const ch=raw[i];
     if(ch==='"'){
       const start=i++;
       let ended=false;
       while(i<raw.length){
         if(raw[i]==='\\'){i+=2;continue}
         if(raw[i]==='"'){i++;ended=true;break}
         i++;
       }
       if(!ended)throw Error('UNTERMINATED_JSON_STRING');
       const top=stack[stack.length-1];
       if(top?.kind==='object'&&top.expectKey){
         let j=i;
         while(j<raw.length&&[' ','\t','\r','\n'].includes(raw[j]))j++;
         if(raw[j]===':'){
           const key=JSON.parse(raw.slice(start,i));
           if(top.keys.has(key))throw Error('DUPLICATE_JSON_KEY');
           top.keys.add(key);
           top.expectKey=false;
         }
       }
       continue;
     }
     if(ch==='{'||ch==='['){
       if(stack.length>=32)throw Error('TYPED_JSON_DEPTH_BOUNDS');
       stack.push(ch==='{'?{kind:'object',keys:new Set(),expectKey:true}:{kind:'array'});
     }else if(ch==='}'||ch===']'){
       if(!stack.length||stack[stack.length-1].kind!==(ch==='}'?'object':'array'))
         throw Error('TYPED_JSON_BRACKETS');
       stack.pop();
     }else if(ch===','&&stack[stack.length-1]?.kind==='object'){
       stack[stack.length-1].expectKey=true;
     }
     i++;
   }
   if(stack.length)throw Error('TYPED_JSON_UNCLOSED');
 };
 const strictTypedJson=(raw,maxBytes)=>{
   if(typeof raw!=='string'||raw.length>maxBytes)fail('PRODUCT_WORKER_TYPED_RESPONSE_BOUNDS');
   try{
     rejectDuplicateJsonKeys(raw);
     return JSON.parse(raw);
   }catch{fail('PRODUCT_WORKER_TYPED_RESPONSE_JSON')}
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
      !nonzeroCursor(r.cursor)||a.cursors.has(r.cursor)||
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
         nonzeroCursor(r.nextCursor)&&r.nextCursor!==cursor&&
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
 // Saved DiffGrids R22: this is the SAME Rust ProductSession's existing
 // typed cursor grant namespace, not a second reader or product authority.
 // The untrusted Rust JSON receipt is strictly validated before projection.
 const savedDiffGridsContract='wand.worker.stored-diffgrids-typed-metadata-readonly@1';
 const savedDiffGridsDomain='/World/GridCollection/DiffGrids';
 const safeUInt=n=>Number.isSafeInteger(n)&&n>=0;
 const optionalSafeUInt=n=>n===null||safeUInt(n);
 const signedI32=n=>n===null||(Number.isInteger(n)&&n>=-2147483648&&n<=2147483647);
 const boundedText=(s,bytes)=>s===null||
   (typeof s==='string'&&new TextEncoder().encode(s).length<=bytes);
 const issueSavedDiffGridsCursor=scope=>{
   const a=typedScope(scope);
   if(a.cursors.size>=2)fail('PRODUCT_WORKER_CURSOR_LIMIT');
   if(typeof a.wasm.issue_saved_diffgrids_typed_cursor!=='function')
     fail('PRODUCT_WORKER_SAVED_DIFFGRIDS_FEATURE_DISABLED');
   let r;
   try{r=strictTypedJson(a.wasm.issue_saved_diffgrids_typed_cursor(
       scope.sessionId,BigInt(scope.revision),
       BigInt(scope.indexGeneration),scope.decodedSha256),4096)}
   catch{typedReadFailure()}
   if(!exactKeys(r,'contract,cursor,sessionId,revision,indexGeneration,decodedSha256,indexedRecords,maxRecordsPerPage,externalLayoutStatus,allNativeReferencesVerified,productReadAccepted,writerAuthorized')||
      r.contract!==savedDiffGridsContract||!nonzeroCursor(r.cursor)||
      a.cursors.has(r.cursor)||r.sessionId!==scope.sessionId||
      r.decodedSha256!==scope.decodedSha256||
      r.revision!==0||r.indexGeneration!==1||
      !safeUInt(r.indexedRecords)||r.indexedRecords>50000||
      r.maxRecordsPerPage!==8||
      r.externalLayoutStatus!=='UNRESOLVED_EXTERNAL_LAYOUT'||
      r.allNativeReferencesVerified!==false||
      r.productReadAccepted!==false||r.writerAuthorized!==false)typedReadFailure();
   a.cursors.set(r.cursor,savedDiffGridsDomain);
   // Only trusted Worker-local caller gets this Rust token; the new message
   // facade NEVER posts it to the page, UI, or cloud.
   return Object.freeze({cursor:r.cursor,indexedRecords:r.indexedRecords,
     maxRecordsPerPage:8,productReadAccepted:false,writerAuthorized:false});
 };
 const readSavedDiffGridsPage=(scope,cursor)=>{
   const a=typedScope(scope);
   if(!nonzeroCursor(cursor)||a.cursors.get(cursor)!==savedDiffGridsDomain)
     fail('PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');
   if(typeof a.wasm.read_saved_diffgrids_typed_page!=='function')
     fail('PRODUCT_WORKER_SAVED_DIFFGRIDS_FEATURE_DISABLED');
   let r;
   try{r=strictTypedJson(a.wasm.read_saved_diffgrids_typed_page(
       cursor,scope.sessionId,BigInt(scope.revision),
       BigInt(scope.indexGeneration),scope.decodedSha256),512*1024+4096)}
   catch{typedReadFailure()}
   if(!exactKeys(r,'contract,sessionId,revision,indexGeneration,decodedSha256,records,nextCursor,maxRecordsPerPage,externalLayoutStatus,nativeEffectiveGridVerified,allNativeReferencesVerified,productReadAccepted,writerAuthorized')||
      r.contract!==savedDiffGridsContract||
      r.sessionId!==scope.sessionId||r.decodedSha256!==scope.decodedSha256||
      r.revision!==0||r.indexGeneration!==1||r.maxRecordsPerPage!==8||
      r.externalLayoutStatus!=='UNRESOLVED_EXTERNAL_LAYOUT'||
      r.nativeEffectiveGridVerified!==false||
      r.allNativeReferencesVerified!==false||r.productReadAccepted!==false||
      r.writerAuthorized!==false||!Array.isArray(r.records)||
      r.records.length>8||
      !(r.nextCursor===null||(nonzeroCursor(r.nextCursor)&&
        r.nextCursor!==cursor&&!a.cursors.has(r.nextCursor))))typedReadFailure();
   let records;
   try{
     records=r.records.map(g=>{
       if(!exactKeys(g,'gridId,defaultLayoutGridId,gridDefaultLayoutPath,gridDefaultLayoutType,defaultGridHashCode,defaultGridDataHashCode,modifiedObjectIds,removedObjectIds,modifiedObjectCount,removedObjectCount,removedShape,modifiedRemovedSameIdPairs,externalLayoutStatus,nativeEffectiveGridVerified')||
          !safeUInt(g.gridId)||!optionalSafeUInt(g.defaultLayoutGridId)||
          !boundedText(g.gridDefaultLayoutPath,4096)||
          !boundedText(g.gridDefaultLayoutType,4096)||
          !signedI32(g.defaultGridHashCode)||
          !signedI32(g.defaultGridDataHashCode)||
          !Array.isArray(g.modifiedObjectIds)||
          !Array.isArray(g.removedObjectIds)||
          g.modifiedObjectIds.length>2048||g.removedObjectIds.length>2048||
          !g.modifiedObjectIds.every(safeUInt)||!g.removedObjectIds.every(safeUInt)||
          !safeUInt(g.modifiedObjectCount)||!safeUInt(g.removedObjectCount)||
          g.modifiedObjectCount!==g.modifiedObjectIds.length||
          g.removedObjectCount!==g.removedObjectIds.length||
          !['absent','array','object-map'].includes(g.removedShape)||
          !safeUInt(g.modifiedRemovedSameIdPairs)||
          g.modifiedRemovedSameIdPairs>Math.min(g.modifiedObjectCount,g.removedObjectCount)||
          g.externalLayoutStatus!=='UNRESOLVED_EXTERNAL_LAYOUT'||
          g.nativeEffectiveGridVerified!==false)throw Error('BAD_SAVED_DIFFGRIDS_ROW');
       // Explicit projection: no external paths/type strings, full ObjectID
       // arrays, Rust-owned cursor, inner JSON, or internal Read-set may leave.
       return Object.freeze({gridId:g.gridId,
         defaultLayoutGridId:g.defaultLayoutGridId,
         defaultGridHashCode:g.defaultGridHashCode,
         defaultGridDataHashCode:g.defaultGridDataHashCode,
         modifiedObjectCount:g.modifiedObjectCount,
         removedObjectCount:g.removedObjectCount,
         modifiedRemovedSameIdPairs:g.modifiedRemovedSameIdPairs,
         externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
         nativeEffectiveGridVerified:false});
     });
   }catch{typedReadFailure()}
   a.cursors.delete(cursor);
   if(r.nextCursor)a.cursors.set(r.nextCursor,savedDiffGridsDomain);
   return Object.freeze({
      records:Object.freeze(records),nextCursor:r.nextCursor,
      externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
      allNativeReferencesVerified:false,productReadAccepted:false,
      writerAuthorized:false
   });
 };

 // DEV-only private Worker path. Public signed WASM never includes this feature,
 // and no UI/Worker postMessage route can activate the constructor option.
 const devScope=scope=>{
   if(!allowDevSemanticWriter)fail('PRODUCT_WORKER_DEV_FLAG_OFF');
   return typedScope(scope);
 };
 const devAccept=(a,scope,r,applied)=>{
   if(!exactKeys(r,'contract,sessionId,revision,indexGeneration,originalDecodedSha256,stagedDecodedSha256,operationCount,applied,semanticChanged,nativeV3Verified,writerAuthorized,originalOverwriteAuthorized')||
     r.contract!=='wand.worker.dev-semantic-amount@1'||
     r.sessionId!==scope.sessionId||
     r.originalDecodedSha256!==scope.decodedSha256||
     !shaHex.test(r.stagedDecodedSha256)||
     r.stagedDecodedSha256===scope.decodedSha256||
     r.revision!==scope.revision+1||r.indexGeneration!==scope.indexGeneration+1||
     !Number.isSafeInteger(r.operationCount)||r.operationCount<1||r.operationCount>16||
     r.applied!==applied||r.semanticChanged!==true||
     r.nativeV3Verified!==false||r.writerAuthorized!==false||
     r.originalOverwriteAuthorized!==false) {
     revoke();fail('PRODUCT_WORKER_DEV_RECEIPT_DENIED');
   }
   if(a.devSha&&a.devSha!==r.stagedDecodedSha256){
     revoke();fail('PRODUCT_WORKER_DEV_HASH_CHANGED');
   }
   a.devSha=r.stagedDecodedSha256;a.devApplied=r.applied;
   a.receipt=Object.freeze({...a.receipt,revision:r.revision,indexGeneration:r.indexGeneration});
   a.cursors.clear();
   return Object.freeze({sessionId:r.sessionId,revision:r.revision,
     indexGeneration:r.indexGeneration,decodedSha256:scope.decodedSha256,
     stagedDecodedSha256:r.stagedDecodedSha256,operationCount:r.operationCount,
     applied:r.applied,nativeV3Verified:false,writerAuthorized:false});
 };
 const devStageTypedAmounts=(scope,commands)=>{
   const a=devScope(scope);
   if(a.devSha||!Array.isArray(commands)||commands.length<1||commands.length>16)
     fail('PRODUCT_WORKER_DEV_BATCH_DENIED');
   const positive=x=>Number.isSafeInteger(x)&&x>0&&x<=0xffffffff;
   const nonnegative=x=>Number.isSafeInteger(x)&&x>=0&&x<=0xffffffff;
   for(const c of commands){
     if(!c||Object.getPrototypeOf(c)!==Object.prototype)
       fail('PRODUCT_WORKER_DEV_COMMAND_PLAIN_REQUIRED');
     if(c.kind==='InventoryExistingAmountDecrease'){
       if(!exactKeys(c,'kind,inventoryId,canonicalItemId,compatibleItemType,expectedOldAmount,newAmount')||
         !positive(c.inventoryId)||!positive(c.canonicalItemId)||
         typeof c.compatibleItemType!=='string'||c.compatibleItemType.length>64||
         !nonnegative(c.expectedOldAmount)||!nonnegative(c.newAmount))
         fail('PRODUCT_WORKER_DEV_INVENTORY_ARGS');
     }else if(c.kind==='ChestExistingSlotAmountDecrease'){
       if(!exactKeys(c,'kind,containerId,slotIndex,expectedItemId,expectedOldAmount,newAmount')||
         !positive(c.containerId)||!nonnegative(c.slotIndex)||!positive(c.expectedItemId)||
         !nonnegative(c.expectedOldAmount)||!nonnegative(c.newAmount))
         fail('PRODUCT_WORKER_DEV_CHEST_ARGS');
     }else fail('PRODUCT_WORKER_DEV_OPERATION_DISABLED');
   }
   if(typeof a.wasm.dev_stage_typed_amounts!=='function')
     fail('PRODUCT_WORKER_DEV_WASM_FEATURE_ABSENT');
   let r;
   try{r=strictTypedJson(a.wasm.dev_stage_typed_amounts(
     JSON.stringify(commands),scope.sessionId,BigInt(scope.revision),
     BigInt(scope.indexGeneration),scope.decodedSha256),4096)}
   catch{fail('PRODUCT_WORKER_DEV_RUST_STAGE_DENIED')}
   return devAccept(a,scope,r,true);
 };
 const devToggle=(scope,redo)=>{
   const a=devScope(scope);
   if(!a.devSha||a.devApplied!==!redo)
     fail('PRODUCT_WORKER_DEV_UNDO_REDO_ORDER');
   const method=redo?'dev_redo_typed_amounts':'dev_undo_typed_amounts';
   if(typeof a.wasm[method]!=='function')
     fail('PRODUCT_WORKER_DEV_WASM_FEATURE_ABSENT');
   let r;
   try{r=strictTypedJson(a.wasm[method](scope.sessionId,BigInt(scope.revision),
     BigInt(scope.indexGeneration),scope.decodedSha256),4096)}
   catch{fail('PRODUCT_WORKER_DEV_RUST_TOGGLE_DENIED')}
   return devAccept(a,scope,r,redo);
 };
 const devTakeDecodedEditedOnce=scope=>{
   const a=devScope(scope);
   if(!a.devSha||a.devApplied!==true)
     fail('PRODUCT_WORKER_DEV_EXPORT_NOT_APPLIED');
   if(typeof a.wasm.dev_begin_edited_copy!=='function'||
      typeof a.wasm.dev_take_edited_chunk!=='function')
     fail('PRODUCT_WORKER_DEV_WASM_FEATURE_ABSENT');
   try{
     const r=strictTypedJson(a.wasm.dev_begin_edited_copy(scope.sessionId,
       BigInt(scope.revision),BigInt(scope.indexGeneration),
       scope.decodedSha256),4096);
     if(!exactKeys(r,'contract,totalBytes,stagedDecodedSha256,writerAuthorized,originalOverwriteAuthorized')||
       r.contract!=='wand.worker.dev-semantic-export@1'||
       !Number.isSafeInteger(r.totalBytes)||r.totalBytes<1||
       r.totalBytes>PRODUCT_WASM_WORKER_MAX_BYTES||
       r.stagedDecodedSha256!==a.devSha||
       r.writerAuthorized!==false||r.originalOverwriteAuthorized!==false)
       fail('PRODUCT_WORKER_DEV_EXPORT_RECEIPT_INVALID');
     let total=0;const parts=[];const decoder=new TextDecoder('utf-8',{fatal:true});
     while(total<r.totalBytes){
       const chunk=a.wasm.dev_take_edited_chunk();
       if(!(chunk instanceof Uint8Array)||chunk.length<1||
         chunk.length>PRODUCT_WASM_CHUNK_MAX_BYTES||total+chunk.length>r.totalBytes)
         fail('PRODUCT_WORKER_DEV_EXPORT_CHUNK_INVALID');
       total+=chunk.length;
       parts.push(decoder.decode(chunk,{stream:true}));
       chunk.fill(0);
     }
     parts.push(decoder.decode());
     return Object.freeze({jsonText:parts.join(''),
       stagedDecodedSha256:r.stagedDecodedSha256,
       writerAuthorized:false,originalOverwriteAuthorized:false});
   }finally{revoke();}
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
   issueSavedDiffGridsCursor,readSavedDiffGridsPage,
   close,submitOperation,getCapabilities,
   getReceipt:()=>active?.receipt??null,
   ...(allowDevSemanticWriter?{
     devStageTypedAmounts,
     devUndoTypedAmounts:scope=>devToggle(scope,false),
     devRedoTypedAmounts:scope=>devToggle(scope,true),
     devTakeDecodedEditedOnce
   }: {})
 });
}
