// Isolated fresh Chrome Worker: official 01A P1G Codec only.
// This is NOT a second Rust ProductSession/Reader and is NOT an
// independent OS process acceptance (05 QR-L is separate).
import {p1gPackagedProfileCodec} from '../ddv/core/save/p1g-packaged-profile-codec.js';
const hex=async bytes=>Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async ({data})=>{
  // Separate from the caller's original encrypted copy: this is the browser
  // structured-clone allocation delivered to the fresh Codec-only Worker.
  const encrypted=data?.ciphertext;
  let verified=false;
  try{
    if(!data||Object.keys(data).sort().join(',')!=='ciphertext,expectedDecodedSha256'||
      !(encrypted instanceof Uint8Array)||
      !/^[0-9a-f]{64}$/.test(data.expectedDecodedSha256))
      throw Error('DENIED');
    const p=await p1gPackagedProfileCodec.loadProfile(encrypted);
    const decodedBytes=new TextEncoder().encode(p.jsonText);
    let reopened;
    try{reopened=await hex(decodedBytes)}
    finally{Uint8Array.prototype.fill.call(decodedBytes,0)}
    if(reopened!==data.expectedDecodedSha256)throw Error('DENIED');
    verified=true;
  }catch{
    verified=false;
  }finally{
    // Do not send even a boolean acknowledgement before disposing of the
    // Worker-received ciphertext. On mismatch/decode rejection still wipe.
    if(encrypted instanceof Uint8Array)Uint8Array.prototype.fill.call(encrypted,0);
  }
  self.postMessage({freshWorkerReopenVerified:verified,privatePayloadPosted:false});
};
