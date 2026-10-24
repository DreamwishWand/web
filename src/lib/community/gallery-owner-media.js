/** 03 COMM #116 Owner Gallery media: JWT-only POST metadata + JWT-only POST bytes.
 * PUBLIC Gallery and DreamSnaps must never call this owner reader.
 */
export const OWNER_MEDIA_MAX_BYTES=20*1024*1024;
export const OWNER_MEDIA_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIMES=new Set(['image/jpeg','image/png','image/webp']);
const CAPACITY_CODES=[
 'GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED','GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED',
 'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED','GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED',
 'GALLERY_GLOBAL_CLEANUP_STALLED'
];
export class GalleryOwnerMediaError extends Error{
 constructor(code,status=0,retryAfterSeconds=null,resetAt=null){
   super(code);this.name='GalleryOwnerMediaError';this.code=code;this.status=status;
   this.retryAfterSeconds=retryAfterSeconds;this.resetAt=resetAt;
 }
}
const fail=(code,status)=>{throw new GalleryOwnerMediaError(code,status)};
const validInt=n=>Number.isSafeInteger(n)&&n>0;
const safeRetry=(value)=>Number.isSafeInteger(value)&&value>0&&value<=86400?value:null;
export function parseGalleryCapacityError(error){
 const code=typeof error?.code==='string'?error.code:
   typeof error?.error==='string'?error.error:'';
 if(!CAPACITY_CODES.includes(code)||error?.status!==429)return null;
 return Object.freeze({code,retryAfterSeconds:safeRetry(error.retryAfterSeconds),
   resetAt:typeof error.resetAt==='string'&&!Number.isNaN(Date.parse(error.resetAt))?error.resetAt:null});
}
export function parseOwnerGalleryReadMetadata(body,mediaId){
 const m=body?.media;
 if(body?.ok!==true||body?.action!=='read'||!OWNER_MEDIA_UUID.test(mediaId)||!m||
   m.mediaId!==mediaId||m.transport!=='authenticated_edge_binary_post'||
   m.readAction!=='galleryReadBytes'||m.requiresOwnerBearer!==true||
   m.rawStorageSignedUrlIssued!==false||Object.hasOwn(m,'signedUrl')||
   !MIMES.has(m.mimeType)||!validInt(m.byteSize)||m.byteSize>OWNER_MEDIA_MAX_BYTES||
   !validInt(m.width)||!validInt(m.height)||m.width>32768||m.height>32768||
   typeof m.checksumSha256!=='string'||!/^[0-9a-f]{64}$/i.test(m.checksumSha256))
   fail('OWNER_MEDIA_INVALID_METADATA',409);
 return Object.freeze({mediaId,byteSize:m.byteSize,mimeType:m.mimeType,
   width:m.width,height:m.height,checksumSha256:m.checksumSha256.toLowerCase()});
}
async function checkedError(response){
 let body=null;
 try{body=await response.json()}catch{}
 const code=typeof body?.error==='string' && /^[A-Z][A-Z0-9_]{2,100}$/.test(body.error)
   ?body.error:'OWNER_MEDIA_REQUEST_FAILED';
 const retryHeader=Number(response.headers.get('Retry-After'));
 throw new GalleryOwnerMediaError(code,response.status,
   safeRetry(body?.retryAfterSeconds)??safeRetry(retryHeader),
   typeof body?.resetAt==='string'?body.resetAt:null);
}
function abortReason(signal,timedOut){
 if(timedOut())return new GalleryOwnerMediaError('OWNER_MEDIA_TIMEOUT',0);
 if(signal?.aborted)return new GalleryOwnerMediaError('OWNER_MEDIA_ABORTED',0);
 return new GalleryOwnerMediaError('OWNER_MEDIA_NETWORK_UNAVAILABLE',0);
}
/** Bounded streaming: reject an incorrect Content-Length and bytes >20MiB before Blob creation. */
async function readBounded(response,expected,assertCurrent,signal){
 const declared=response.headers.get('Content-Length');
 if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)!==expected.byteSize))
   fail('OWNER_MEDIA_SIZE_MISMATCH',409);
 if(response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!==expected.mimeType)
   fail('OWNER_MEDIA_MIME_MISMATCH',409);
 if(!response.body)fail('OWNER_MEDIA_MISSING_BYTES',409);
 const reader=response.body.getReader(), chunks=[];let size=0;
 try{
   while(true){
     assertCurrent();
     if(signal.aborted)fail('OWNER_MEDIA_ABORTED',0);
     const {done,value}=await reader.read();
     if(done)break;
     size+=value.byteLength;
     if(size>OWNER_MEDIA_MAX_BYTES||size>expected.byteSize)fail('OWNER_MEDIA_SIZE_MISMATCH',409);
     chunks.push(value);
   }
 }catch(e){await reader.cancel().catch(()=>{});throw e}
 finally{reader.releaseLock()}
 assertCurrent();
 if(size!==expected.byteSize)fail('OWNER_MEDIA_SIZE_MISMATCH',409);
 const bytes=new Uint8Array(size);let off=0;
 for(const c of chunks){bytes.set(c,off);off+=c.byteLength}
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 assertCurrent();
 if(hex!==expected.checksumSha256)fail('OWNER_MEDIA_CHECKSUM_MISMATCH',409);
 return new Blob([bytes],{type:expected.mimeType});
}
/** Token never enters a URL, DOM, console, cache or returned object. */
export async function readAuthenticatedGalleryOwnerMedia({
 endpoint,apikey,accessToken,mediaId,signal,assertCurrent=()=>{},fetcher=fetch,timeoutMs=20000
}){
 if(!OWNER_MEDIA_UUID.test(mediaId))fail('OWNER_MEDIA_ID_INVALID',400);
 if(typeof accessToken!=='string'||!accessToken||!/^https:\/\//.test(endpoint))
   fail('OWNER_MEDIA_AUTH_REQUIRED',401);
 const controller=new AbortController();let expired=false;
 const timeout=setTimeout(()=>{expired=true;controller.abort()},timeoutMs);
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 const headers={apikey,authorization:'Bearer '+accessToken,'content-type':'application/json',accept:'application/json'};
 const post=async(action)=>{
   assertCurrent();
   const response=await fetcher(endpoint,{method:'POST',headers,
     body:JSON.stringify({action,mediaId}),signal:controller.signal,cache:'no-store'});
   assertCurrent();
   if(!response.ok)await checkedError(response);
   return response;
 };
 try{
   const response=await post('read');
   const metadata=parseOwnerGalleryReadMetadata(await response.json().catch(()=>null),mediaId);
   assertCurrent();
   const binary=await post('galleryReadBytes');
   const blob=await readBounded(binary,metadata,assertCurrent,controller.signal);
   assertCurrent();
   return Object.freeze({blob,mimeType:metadata.mimeType,width:metadata.width,height:metadata.height,mediaId});
 }catch(e){
   if(e instanceof GalleryOwnerMediaError)throw e;
   if(controller.signal.aborted)throw abortReason(signal,()=>expired);
   throw new GalleryOwnerMediaError('OWNER_MEDIA_NETWORK_UNAVAILABLE',0);
 }finally{
   clearTimeout(timeout);signal?.removeEventListener('abort',abort);controller.abort();
 }
}
/** Component-owned URLs. Generation barriers fence unmount, close, retry and re-login. */
export class OwnerGalleryObjectUrlLease{
 constructor(createUrl=(blob)=>URL.createObjectURL(blob),revokeUrl=(url)=>URL.revokeObjectURL(url)){
   this.createUrl=createUrl;this.revokeUrl=revokeUrl;this.urls=[];this.controller=null;this.generation=0;this.destroyed=false;
 }
 reset(){
   this.controller?.abort();this.controller=null;this.generation++;
   for(const url of this.urls)this.revokeUrl(url);
   this.urls=[];
   return this.generation;
 }
 begin(){
   if(this.destroyed)throw new Error('OWNER_MEDIA_VIEW_DESTROYED');
   const generation=this.reset();
   this.controller=new AbortController();
   return {generation,signal:this.controller.signal};
 }
 append(blob,generation){
   if(this.destroyed||generation!==this.generation||this.controller?.signal.aborted)
     return null;
   const url=this.createUrl(blob);
   if(this.destroyed||generation!==this.generation||this.controller?.signal.aborted){
     this.revokeUrl(url);return null;
   }
   this.urls.push(url);return url;
 }
 current(generation){return !this.destroyed&&generation===this.generation&&!this.controller?.signal.aborted}
 close(){this.reset()}
 destroy(){this.close();this.destroyed=true}
}
