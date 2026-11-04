// 08 WEB — delivery preflight ONLY, not a public eligibility/rights/authorization service.
// No user/media/Save-derived field may authorize indexing or a response by itself.
// On deployed GitHub Pages the only effective 200 is an actual prerendered index.html;
// this module DOES NOT modify routing, deploy pages, or cause HTTP 301.
// A trusted build/host must separately attest source, rights, consent, moderation and QA.
import { parseSharedPrimaryId, SUPPORTED_DETAIL_LOCALES } from '../entity/shared-catalog-detail.mjs';

export const ENTITY_HOST_PLAN_CONTRACT = 'wand.public-entity-http-preflight@1';
export const ENTITY_PUBLISHING_ENABLED = false;
export const APPROVED_ENTITY_ROUTE_MANIFEST = Object.freeze([]);
const requiredKeys = ['platform','fullVersion','bid','schema'];
const id = x => typeof x === 'string' && parseSharedPrimaryId(x) !== null;
const hexSha = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const safeSlug = x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(x) && !/^[0-9]+$/.test(x);
const key = x => String(x).replace(/^\/+|\/+$/g,'');
export function entityPathIdentity(path,base='/web') {
  if(typeof path !== 'string'||typeof base !== 'string'||!/^\/[a-zA-Z0-9_-]+$/.test(base))return null;
  if(!path.startsWith(base+'/'))return null;
  const pathPart=path.slice(base.length);
  if(!/^\/(?:[A-Za-z0-9_-]+\/){1,4}$/.test(pathPart))return null;
  const parts=key(pathPart).split('/');
  const [locale,primary,secondary,slug]=parts;
  if(!SUPPORTED_DETAIL_LOCALES.includes(locale)||!id(primary))return null;
  if(parts.length<2||parts.length>4)return null;
  if(parts.length===3&&!id(secondary)&&!safeSlug(secondary))return null;
  if(parts.length===4&&(!id(secondary)||!safeSlug(slug)))return null;
  return Object.freeze({locale,primary,secondary:parts.length===4?secondary:(id(secondary)?secondary:null),
    slug:parts.length===4?slug:(parts.length===3?secondary:null)});
}
function sameScope(a,b){
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(requiredKeys.some(x=>a[x]!==b[x]))return false;
 return a.platform==='Nintendo Switch'&&typeof a.fullVersion==='string'&&
  /^[0-9]+(?:\.[0-9]+){2,3}$/.test(a.fullVersion)&&/^[A-F0-9]{16}$/.test(a.bid)&&
  Number.isInteger(a.schema)&&a.schema>0&&
  (a.dlc??null)===(b.dlc??null)&&hexSha(a.sourceDigest)&&a.sourceDigest===b.sourceDigest;
}
function validEvidence(e){
 if(!e||typeof e!=='object')return false;
 return e.entityKind==='ITEM'&&e.visibility==='PUBLIC'&&e.rights==='ACCEPTED'&&
   e.privacy==='PUBLIC_OPT_IN'&&e.moderation==='ACCEPTED'&&
   e.independentQa==='PASS'&&e.publishConsent==='VERIFIED'&&
   e.rightsVersion&&typeof e.rightsVersion==='string'&&e.rightsVersion.length<80&&
   typeof e.publishedRevision==='string'&&hexSha(e.publishedRevision)&&
   sameScope(e.sourceScope,e.acceptedSourceScope);
}
// Testable server configuration planner. Positive entries are NOT sourced from
// static item Catalog or browser hints; only an independent release actor may
// supply an accepted manifest and a serving host with matching capabilities.
export function compileEntityHostPlan(entries=APPROVED_ENTITY_ROUTE_MANIFEST,{base='/web'}={}){
 if(!Array.isArray(entries)||entries.length>20000)return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'INVALID_MANIFEST'});
 const pages=[],redirects=[],seen=new Set();
 for(const e of entries){
  if(!validEvidence(e)||typeof e.canonicalPath!=='string')return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'UNACCEPTED_RECORD'});
  const loc=entityPathIdentity(e.canonicalPath,base);
  if(!loc||loc.slug||e.canonicalPath!==base+'/'+loc.locale+'/'+loc.primary+(loc.secondary?'/'+loc.secondary:'')+'/')
   return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'UNSUPPORTED_CANONICAL'});
  if(e.primaryId!==loc.primary|| (e.secondaryId??null)!==loc.secondary)
   return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'IDENTITY_CONFLICT'});
  if(loc.secondary && e.specializationEvidence!=='INDEPENDENT_PASS')
   return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'SPECIALIZATION_UNVERIFIED'});
  if(seen.has(e.canonicalPath))return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'DUPLICATE_CANONICAL'});
  seen.add(e.canonicalPath);
  pages.push(Object.freeze({path:e.canonicalPath,sourceScope:Object.freeze({...e.sourceScope}),
    publishedRevision:e.publishedRevision,htmlRequirement:'SSR_OR_PRERENDERED_HTML_HTTP200'}));
  if(!Array.isArray(e.aliases))return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'ALIASES_NOT_AUTHORITATIVE'});
  for(const alias of e.aliases){
   if(typeof alias?.path!=='string'||!alias.path.startsWith(base+'/')||!alias.samePublicEntityProof||
     alias.samePublicEntityProof!=='INDEPENDENT_PASS'||!sameScope(alias.sourceScope,e.sourceScope)||
     alias.path===e.canonicalPath||seen.has(alias.path))
    return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'ALIAS_UNVERIFIED'});
   const parsed=entityPathIdentity(alias.path,base);
   if(!parsed||parsed.primary!==e.primaryId||parsed.secondary!==(e.secondaryId??null))
    return Object.freeze({status:'DENIED',pages:Object.freeze([]),redirects:Object.freeze([]),reason:'ALIAS_IDENTITY_MISMATCH'});
   seen.add(alias.path);
   redirects.push(Object.freeze({from:alias.path,to:e.canonicalPath,
     status:301,serverRequired:true}));
  }
 }
 return Object.freeze({status:'COMPILED_ONLY',pages:Object.freeze(pages),redirects:Object.freeze(redirects),
    publicEnabled:false,hostAccepted:false});
}
export function expectedDirectHttpStatus(path,compiled=compileEntityHostPlan()){
 if(compiled?.status!=='COMPILED_ONLY')return Object.freeze({status:404,reason:'UNACCEPTED_MANIFEST'});
 if(compiled.pages.some(x=>x.path===path))return Object.freeze({status:200,reason:'REQUIRES_REAL_PRERENDER_OR_SSR'});
 const alias=compiled.redirects.find(x=>x.from===path);
 if(alias)return Object.freeze({status:301,location:alias.to,reason:'REQUIRES_REAL_HTTP_REDIRECT_HOST'});
 return Object.freeze({status:404,reason:'UNPUBLISHED_OR_UNVERIFIED'});
}
