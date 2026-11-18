// 08 WEB: one-shot browser presentation of already-verified ENCRYPTED P1G
// bytes. No operation authority, Save decoding, filename, Worker, or Blob
// persistence belongs to this helper. Blob() copies bytes synchronously;
// wipe the transient verified-download buffer before returning to the UI.
const deny=()=>{throw Error('AMOUNT_DOWNLOAD_CONSUMER_DENIED')};
export function consumeVerifiedAmountDownloadBytes(bytes,consume){
 if(!(bytes instanceof Uint8Array))deny();
 try{
  if(bytes.byteLength===0||typeof consume!=='function')deny();
  // Never pass an encrypted private P1G buffer to an asynchronous consumer.
  // Any asynchronous use would outlive the zeroization boundary.
  const result=consume(bytes);
  if(result&&typeof result.then==='function')deny();
  return result;
 }finally{
  bytes.fill(0);
 }
}
