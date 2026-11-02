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
  let different=0,first=-1,last=-1;
  for(let i=0;i<sourceLen;i++)if(a[i]!==b[i]){
   different++;if(first===-1)first=i;last=i;
  }
  if(!different||last>=512||last-first>=32)throw Error('OUTSIDE_TIMESTAMP_DIFF');
  const after=new Uint8Array(await crypto.subtle.digest('SHA-256',b));
  if(after.every((v,i)=>v===sourceSha[i]))throw Error('UNCHANGED_HASH');
  const wasmLinearMemoryBytes=ex.memory.buffer.byteLength;
  const elapsedPatchMs=performance.now()-began;
  ex.ddv_probe_free(outputPtr,outputLen);
  ex.ddv_probe_free(sourcePtr,sourceLen);
  for(const slot of slots)ex.ddv_probe_free(slot.ptr,slot.len);
  self.postMessage({ok:true,sourceBytes:sourceLen,differentBytes:different,
    firstDifferentOffset:first,lastDifferentOffset:last,wasmLinearMemoryBytes,
    elapsedPatchMs,totalWorkerElapsedMs:performance.now()-t,
    workerJsHeapBytes:typeof performance.memory?.usedJSHeapSize==='number'?
      performance.memory.usedJSHeapSize:null,readOnlyResearch:true,
    p1gRebuildVerified:false,productWriterAuthorized:false});
 }catch(e){
  self.postMessage({ok:false,error:String(e?.message||e),elapsedMs:performance.now()-t});
 }
};
