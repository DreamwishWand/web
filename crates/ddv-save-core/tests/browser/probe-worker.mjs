// Research-only actual Chromium Worker WASM memory probe. Synthetic decoded JSON only.
const enc=new TextEncoder(),sourcePointer='/World/RecurringEvents/0/ItemSpawning/NextOccurrence';
const old='2126-08-20T00:00:00Z',target='2022-09-06T00:00:00Z';
self.onmessage=async({data})=>{
 const t=performance.now();
 try{
  const wasmData=await (await fetch('./ddv_save_core.wasm',{cache:'no-store'})).arrayBuffer();
  const {instance}=await WebAssembly.instantiate(wasmData,{});
  const ex=instance.exports;
  if(!(ex.memory instanceof WebAssembly.Memory)||typeof ex.ddv_probe_patch!=='function')
   throw Error('WASM_ABI_MISSING');
  let bytes=new Uint8Array(await (await fetch('./fixture.json',{cache:'no-store'})).arrayBuffer());
  const sourceLen=bytes.byteLength;
  const sourceSha=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const sourcePtr=ex.ddv_probe_allocate(sourceLen);
  if(!sourcePtr)throw Error('WASM_SOURCE_ALLOCATION_DENIED');
  new Uint8Array(ex.memory.buffer,sourcePtr,sourceLen).set(bytes);
  bytes=null; // no further JS source copy; retained immutable reference is WASM input.
  const fields=[sourceSha,enc.encode(sourcePointer),enc.encode(old),enc.encode(target)];
  const slots=fields.map(arr=>{
   const ptr=ex.ddv_probe_allocate(arr.length);
   if(!ptr)throw Error('WASM_METADATA_ALLOC_DENIED');
   new Uint8Array(ex.memory.buffer,ptr,arr.length).set(arr);
   return {ptr,len:arr.length};
  });
  const began=performance.now();
  const outputPtr=ex.ddv_probe_patch(sourcePtr,sourceLen,slots[0].ptr,626n,
   slots[1].ptr,slots[1].len,slots[2].ptr,slots[2].len,slots[3].ptr,slots[3].len);
  if(!outputPtr)throw Error('WASM_COPY_DENIED_CODE_'+ex.ddv_probe_error_code());
  const outputLen=ex.ddv_probe_output_len();
  if(outputLen!==sourceLen)throw Error('UNEXPECTED_LENGTH_CHANGE');
  const a=new Uint8Array(ex.memory.buffer,sourcePtr,sourceLen);
  const b=new Uint8Array(ex.memory.buffer,outputPtr,outputLen);
  // Compare EVERY source/output byte. The expected changed span is derived
  // independently from the source prefix; same-length mutations elsewhere fail.
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const prefix=decoder.decode(a.subarray(0,Math.min(512,sourceLen)));
  const expectedMarker='"NextOccurrence":"'+old+'"';
  const targetMarker='"NextOccurrence":"'+target+'"';
  const markerStart=prefix.indexOf(expectedMarker);
  if(markerStart<0 || prefix.indexOf(expectedMarker,markerStart+1)>=0)
   throw Error('SELECTED_TIMESTAMP_MARKER_NOT_UNIQUE');
  const expectedBegin=markerStart+'"NextOccurrence":"'.length;
  const expectedEnd=expectedBegin+old.length;
  let different=0,first=-1,last=-1,unexpectedMutation=false;
  for(let i=0;i<sourceLen;i++)if(a[i]!==b[i]){
   if(i<expectedBegin||i>=expectedEnd)unexpectedMutation=true;
   different++;if(first===-1)first=i;last=i;
  }
  if(unexpectedMutation||!different||last-first>=old.length)
   throw Error('OUTSIDE_SELECTED_TIMESTAMP_TOKEN');
  if(decoder.decode(b.subarray(expectedBegin,expectedEnd))!==target)
   throw Error('TARGET_TIMESTAMP_NOT_EXACT');
  // The source bytes are retained in WASM input and may not be mutated by
  // an in-place editor. Verify the complete original SHA after patch.
  const sourceAfter=new Uint8Array(await crypto.subtle.digest('SHA-256',a));
  if(sourceAfter.some((v,i)=>v!==sourceSha[i]))throw Error('SOURCE_BUFFER_MUTATED');
  let sameLengthMutationRejected=null;
  if(sourceLen===16000000){
   // Mutate a digit in the 16MB source in-place without changing byte length.
   // The original source digest must make this second attempt fail closed.
   const saved=a[expectedBegin];
   a[expectedBegin]=saved===50?51:50;
   const denied=ex.ddv_probe_patch(sourcePtr,sourceLen,slots[0].ptr,626n,
    slots[1].ptr,slots[1].len,slots[2].ptr,slots[2].len,slots[3].ptr,slots[3].len);
   sameLengthMutationRejected=!denied && ex.ddv_probe_error_code()===3;
   a[expectedBegin]=saved;
   if(!sameLengthMutationRejected)throw Error('MUTATED_SOURCE_SHA_CAS_ACCEPTED');
  }
  const after=new Uint8Array(await crypto.subtle.digest('SHA-256',b));
  if(after.every((v,i)=>v===sourceSha[i]))throw Error('UNCHANGED_HASH');
  const wasmLinearMemoryBytes=ex.memory.buffer.byteLength;
  const elapsedPatchMs=performance.now()-began;
  ex.ddv_probe_free(outputPtr,outputLen);
  ex.ddv_probe_free(sourcePtr,sourceLen);
  for(const slot of slots)ex.ddv_probe_free(slot.ptr,slot.len);
  self.postMessage({ok:true,sourceBytes:sourceLen,differentBytes:different,
    allUnchangedBytesCompared:true,sourceSHARecheckedAfterPatch:true,
    sameLengthMutationRejected,
    firstDifferentOffset:first,lastDifferentOffset:last,wasmLinearMemoryBytes,
    elapsedPatchMs,totalWorkerElapsedMs:performance.now()-t,
    workerJsHeapBytes:typeof performance.memory?.usedJSHeapSize==='number'?
      performance.memory.usedJSHeapSize:null,readOnlyResearch:true,
    p1gRebuildVerified:false,productWriterAuthorized:false});
 }catch(e){
  self.postMessage({ok:false,error:String(e?.message||e),elapsedMs:performance.now()-t});
 }
};
