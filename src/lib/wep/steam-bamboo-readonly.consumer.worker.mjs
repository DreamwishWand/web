// Dedicated thin product Worker, not a second Codec, Session or Rust Engine.
// No File listener exists until the independent per-Operation signed public
// Bamboo JS/WASM/manifest release has passed its exact protected-loader gate.
import {loadProtectedBambooReadonlyWorker} from '$lib/ddv/core/save/product-steam626-bamboo-readonly-release.mjs';
import {createP1gRustWorkerReadOnlyBridge} from '$lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {
 BAMBOO_CONSUMER_CONTRACT,BAMBOO_READY_KIND,BAMBOO_READ_KIND,
 BAMBOO_RESULT_KIND,BAMBOO_STEAM_FULL_VERSION,
 exactBambooRequest,projectBambooReadOnlyResult
} from '$lib/wep/steam-bamboo-readonly-consumer.mjs';

const MAX_ENCRYPTED_BYTES=128*1024*1024;
const build=Object.freeze({
 platform:'steam-windows',buildKind:'steam-full-version',
 buildId:BAMBOO_STEAM_FULL_VERSION,schema:626,externallyConfirmed:true
});
const ready=(available)=>self.postMessage(Object.freeze({
 contract:BAMBOO_CONSUMER_CONTRACT,kind:BAMBOO_READY_KIND,
 ready:available,writerAuthorized:false,stageAuthorized:false,operationOn:false
}));
const reject=()=>{throw Error('BAMBOO_CONSUMER_LOCAL_READ_DENIED')};
const isP1g=(file)=>{
 if(typeof File==='undefined'||!(file instanceof File))return false;
 const size=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(file);
 const name=Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(file);
 return Number.isSafeInteger(size)&&size>=16&&size<=MAX_ENCRYPTED_BYTES&&
  size%16===0&&typeof name==='string'&&name.toLowerCase().endsWith('.p1g');
};
const hex=bytes=>[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
void (async()=>{
 try{
  // Never take release pins, selector, profile, build or authorization from UI.
  const sealed=await loadProtectedBambooReadonlyWorker();
  if(sealed?.attestationVerifiedAtBuild!==true||
     sealed.readOnlyOperationAuthorized!==true||
     sealed.writerAuthorized!==false||sealed.stageAuthorized!==false||
     sealed.productConsumerEnabled!==false||
     sealed.checkedBothJsAndWasm!==true||sealed.sameOriginFetchOnly!==true||
     typeof sealed.WorkerWasmSource!=='function')reject();

  // Single Worker-local Rust owner, one ProductSession per open. No path to
  // Stage, Export, Edit, Undo/Redo, media or network upload.
  const bridge=createP1gRustWorkerReadOnlyBridge(
   async()=>({WorkerWasmSource:sealed.WorkerWasmSource}),
   {allowSteam626BambooReadOnlySource:true}
  );
  let consumed=false;
  self.addEventListener('message',event=>{
   if(consumed)return;
   consumed=true; // consume BEFORE even a malformed request or async decode
   const data=event?.data;
   void (async()=>{
    let encrypted=null;
    try{
     if(!exactBambooRequest(data)||!isP1g(data.file))reject();
     const originalSize=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(data.file);
     encrypted=new Uint8Array(await Blob.prototype.arrayBuffer.call(data.file));
     if(encrypted.byteLength!==originalSize)reject();
     // SHA never leaves the isolated Worker. Detect read races and a changed
     // File source before Rust opens a new ProductSession.
     const sha=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encrypted)));
     if(!/^[0-9a-f]{64}$/.test(sha))reject();
     const opened=await bridge.openEncrypted({build,encryptedBytes:encrypted});
     if(opened?.fullDocumentJsonValidated!==true||opened?.schema!==626||
        opened?.writerAuthorized!==false||opened?.applyAuthorized!==false||
        opened?.editedCopyAuthorized!==false||opened?.productReadAccepted!==false)
       reject();
     // One narrow Rust-only typed read. Core checks target identity/CAS and
     // rejects foreign Build, wrong grid/XY, replay and unsupported references.
     const result=projectBambooReadOnlyResult(bridge.readSteam626BambooSingleTarget({
      gridId:data.gridId,x:data.x,y:data.y
     }));
     self.postMessage({
      contract:BAMBOO_CONSUMER_CONTRACT,kind:BAMBOO_RESULT_KIND,
      requestId:1,ok:true,result
     });
    }catch{
     // Generic failure; no plaintext, hash, pathname, Session ID, stack or
     // private fixture/Save metadata crosses this Worker boundary.
     self.postMessage({
      contract:BAMBOO_CONSUMER_CONTRACT,kind:BAMBOO_RESULT_KIND,
      requestId:1,ok:false,error:'BAMBOO_CONSUMER_LOCAL_READ_DENIED'
     });
    }finally{
     if(encrypted)encrypted.fill(0);
     try{bridge.close()}catch{/* preserve fail closed */}
    }
   })();
  });
  ready(true);
 }catch{
  // In current protected main the separate Bamboo anchor is null. The
  // signed normal R22 Pages bundle MUST NOT be treated as Bamboo enabled.
  ready(false);
 }
})();
