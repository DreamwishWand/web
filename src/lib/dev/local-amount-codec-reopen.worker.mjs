// Isolated fresh Chrome Worker: official 01A P1G Codec only.
// This is NOT a second Rust ProductSession/Reader and is NOT an
// independent OS process acceptance (05 QR-L is separate).
import {p1gPackagedProfileCodec} from '../ddv/core/save/p1g-packaged-profile-codec.js';
const hex=async bytes=>Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async ({data})=>{
  try{
    if(!data||Object.keys(data).sort().join(',')!=='ciphertext,expectedDecodedSha256'||
      !(data.ciphertext instanceof Uint8Array)||
      !/^[0-9a-f]{64}$/.test(data.expectedDecodedSha256))
      throw Error('DENIED');
    const p=await p1gPackagedProfileCodec.loadProfile(data.ciphertext);
    const reopened=await hex(new TextEncoder().encode(p.jsonText));
    if(reopened!==data.expectedDecodedSha256)throw Error('DENIED');
    self.postMessage({freshWorkerReopenVerified:true,privatePayloadPosted:false});
  }catch{
    self.postMessage({freshWorkerReopenVerified:false,privatePayloadPosted:false});
  }
};
