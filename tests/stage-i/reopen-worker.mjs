// Fresh independent Chrome Worker realm. Synthetic fixture only.
import {p1gPackagedProfileCodec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async event=>{
 try{
   const {ciphertext,expectedSha256}=event.data||{};
   if(!(ciphertext instanceof Uint8Array)||typeof expectedSha256!=='string')throw Error('INPUT');
   const reopened=await p1gPackagedProfileCodec.loadProfile(ciphertext);
   const bytes=new TextEncoder().encode(reopened.jsonText);
   const parsed=JSON.parse(reopened.jsonText);
   const valid=await hash(bytes)===expectedSha256&&
     parsed.Player.ListInventories['4'].Inventory['30000001'].Amount===49&&
     parsed.Player.ContainerInventories['5'].Inventory[0].Amount===11&&
     parsed.Opaque.future.keep==='opaque-marker';
   self.postMessage({ok:valid});
 }catch{self.postMessage({ok:false})}
};
