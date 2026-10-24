/**
 * Typed public-media response gate. Public Gallery is strictly per-request
 * authorized Edge proxy; DreamSnaps and non-Gallery retain signed-URL delivery.
 * Never reconstruct a Storage object URL or downgrade a Gallery error to legacy.
 */
export const GALLERY_PUBLIC_MEDIA_ROUTE='/functions/v1/community-public-media';
export const PUBLIC_MEDIA_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_MIMES=new Set(['image/png','image/jpeg','image/webp']);
const invalid=(code)=>{throw new Error(code)};
const positiveInteger=n=>Number.isSafeInteger(n)&&n>0;

/** @param {unknown} input @param {string} mediaId @param {string} supabaseUrl */
export function requireGalleryEdgeMedia(input,mediaId,supabaseUrl){
  if(!PUBLIC_MEDIA_UUID.test(mediaId)||!input||typeof input!=='object')invalid('GALLERY_MEDIA_INVALID');
  const m=input;
  if(m.mediaId!==mediaId||m.transport!=='edge_proxy'||m.rawStorageSignedUrlIssued!==false||
    typeof m.streamUrl!=='string'||Object.hasOwn(m,'signedUrl')||
    !IMAGE_MIMES.has(m.mimeType)||!positiveInteger(m.byteSize)||m.byteSize>20971520)
    invalid('GALLERY_MEDIA_TRANSPORT_INVALID');
  const dimensions=[m.width,m.height];
  if(dimensions.some(v=>v!==null && !(positiveInteger(v)&&v<=32768)))invalid('GALLERY_MEDIA_DIMENSIONS_INVALID');
  let url,base;
  try{url=new URL(m.streamUrl);base=new URL(supabaseUrl)}catch{invalid('GALLERY_MEDIA_STREAM_URL_INVALID')}
  if(base.protocol!=='https:'&&base.hostname!=='gallery-lookup-browser.invalid')
    invalid('GALLERY_MEDIA_CONFIG_UNSAFE');
  if(url.origin!==base.origin || url.pathname!==(base.pathname.endsWith('/')?base.pathname.slice(0,-1):base.pathname)+GALLERY_PUBLIC_MEDIA_ROUTE ||
    url.searchParams.get('mediaId')!==mediaId || Array.from(url.searchParams.keys()).some(k=>k!=='mediaId') ||
    url.hash || url.username || url.password)invalid('GALLERY_MEDIA_STREAM_URL_INVALID');
  return Object.freeze({transport:'edge_proxy',streamUrl:m.streamUrl,mimeType:m.mimeType,
    width:m.width,height:m.height,byteSize:m.byteSize,mediaId});
}
/** Only for DreamSnaps/other non-Gallery; never call after Gallery proxy rejection. */
export function requireNonGalleryLegacyMedia(input,mediaId){
  if(!PUBLIC_MEDIA_UUID.test(mediaId)||!input||typeof input!=='object')invalid('PUBLIC_MEDIA_INVALID');
  const m=input;
  if(m.transport==='edge_proxy'||m.mediaId!==mediaId||typeof m.signedUrl!=='string')
    invalid('LEGACY_MEDIA_TRANSPORT_INVALID');
  let u;try{u=new URL(m.signedUrl)}catch{invalid('LEGACY_MEDIA_URL_INVALID')}
  if(u.protocol!=='https:'||u.username||u.password)invalid('LEGACY_MEDIA_URL_INVALID');
  return Object.freeze({transport:'legacy_signed',signedUrl:m.signedUrl,mimeType:IMAGE_MIMES.has(m.mimeType)?m.mimeType:null,
    width:positiveInteger(m.width)?m.width:null,height:positiveInteger(m.height)?m.height:null,mediaId});
}
export function classifyGalleryMediaFailure(error){
  const status=Number(error?.status??0);
  if(status===403)return 'forbidden';
  if(status===404)return 'missing_or_revoked';
  if(status===503)return 'unavailable';
  return 'unavailable';
}
/**
 * Future server-authoritative temporary expiry. Server must explicitly activate.
 * No local 72-hour calculation, client countdown, or unbound Cloud preservation.
 */
export function temporaryUploadExpiry(state){
  if(state?.retentionActive!==true||typeof state.expires_at!=='string')return null;
  const value=Date.parse(state.expires_at);
  return Number.isFinite(value)?new Date(value).toISOString():null;
}
