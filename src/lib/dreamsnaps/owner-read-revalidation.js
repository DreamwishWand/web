import {canonicalWorkId} from '../community/typed-work-route.js';

// No Owner authority is decided here. The server binds the signed subject;
// WEB267 remains the exclusive strict Source153 HTTP/cache decoder.
export const OWNER_REVALIDATION_PRODUCTION_ENABLED = false;
export const OWNER_REVALIDATION_CONTRACT = 'wand.dreamsnaps.owner-read-revalidation@1';
const invalidations = new Set([
  'WORK_CHANGED','ACCOUNT_CHANGED','SESSION_CHANGED','LOGOUT','WITHDRAWAL',
  'POLICY_CHANGED','CAS_CONFLICT','HIDDEN','BLUR','OFFLINE','PAGEHIDE'
]);
const resumptions = new Set(['VISIBLE','FOCUS','ONLINE','PAGESHOW']);
const viewStatus='SOURCE153_SCHEMA_CANDIDATE_ONLY';
const closed = (status='AUTH_REQUIRED') => Object.freeze({
  status, view:null, sourceCandidateOnly:false, working:false,
  canInspect:false, canFreshRead:false, ownerReadVerified:false, actionsEnabled:false,
  liveBackendEnabled:false, snapshot:null
});
const sourceSafe = r => r?.status===viewStatus &&
  r.sourceCandidateOnly===true && r.snapshot===null &&
  r.ownerReadVerified===false && r.actionsEnabled===false &&
  r.liveBackendEnabled===false &&
  ['OriginalCompetition','PostEventCreation'].includes(r.kind) &&
  Number.isSafeInteger(r.rowVersion) && r.rowVersion>0 &&
  Number.isSafeInteger(r.authorizationEpoch) && r.authorizationEpoch>0 &&
  ['FROZEN_ORIGINAL_ENTRY','NO_COMPETITION_ENTRY'].includes(r.entryState) &&
  r.entryState===(r.kind==='OriginalCompetition'?'FROZEN_ORIGINAL_ENTRY':'NO_COMPETITION_ENTRY') &&
  ['recorded','withdrawn'].includes(r.grantState) &&
  ['APPROVED_CANONICAL_RECEIPT','UNVERIFIED'].includes(r.policyScope) &&
  typeof r.publicDisabled==='boolean' &&
  (r.grantState!=='withdrawn'||r.publicDisabled===true);
const sanitized = r => Object.freeze({
  status:viewStatus,kind:r.kind,entryState:r.entryState,grantState:r.grantState,
  // A source claim is never a right or locally approved policy.
  policyScope:r.policyScope,publicDisabled:r.publicDisabled,
  rowVersion:r.rowVersion,authorizationEpoch:r.authorizationEpoch,
  sourceCandidateOnly:true, ownerReadVerified:false,actionsEnabled:false,
  liveBackendEnabled:false,snapshot:null
});

/** Inert-by-default session-scoped Owner candidate controller.
 *  Caller must provide the existing strict Source153 adapter as read.
 *  Never expose the JWT, actor AccountID, Work locator, or raw HTTP DTO in state.
 */
/** @param {{read:(args:any)=>Promise<any>, onChange?:(state:any)=>void}} adapter */
export function createOwnerReadRevalidation({read,onChange=()=>{}}={}) {
  if(typeof read!=='function'||typeof onChange!=='function')throw Error('INVALID_OWNER_REVALIDATION_ADAPTER');
  let workId=null, bearer=null, anonKey=null, generation=0, active=null;
  let visible=true, online=true, focused=true, disposed=false;
  let lastCas=null, needsExplicitFresh=false, state=closed();
  const publish=(status,view=null,working=false)=>{
    const allowed=Boolean(workId&&bearer&&anonKey&&!disposed);
    state=Object.freeze({
      ...closed(needsExplicitFresh?'REFRESH_REQUIRED':status),
      view:needsExplicitFresh?null:view,sourceCandidateOnly:!!view && !needsExplicitFresh,working,
      canInspect:allowed && visible && online && focused && !working && !needsExplicitFresh,
      canFreshRead:allowed && visible && online && focused && !working && needsExplicitFresh
    });
    onChange(state);
    return state;
  };
  const cancel=()=>{
    generation++;
    active?.abort();
    active=null;
  };
  const clear=(status='REVALIDATION_REQUIRED',keepCas=true)=>{
    cancel();
    if(!keepCas)lastCas=null;
    return publish(status);
  };
  const ready=()=>!disposed&&!!workId&&!!bearer&&!!anonKey&&visible&&online&&focused;
  const revalidate=async({fresh=false}={})=>{
    if(needsExplicitFresh && !fresh)return publish('REFRESH_REQUIRED');
    if(!ready())return publish(needsExplicitFresh?'REFRESH_REQUIRED':(!bearer?'AUTH_REQUIRED':'REVALIDATION_REQUIRED'));
    if(active)return state;
    if(fresh){
      // Only the caller's explicit fresh-read action may unlock a CAS refusal.
      needsExplicitFresh=false;
      lastCas=null;
    }
    cancel();
    const requestGeneration=generation,controller=new AbortController();
    active=controller;
    const previousCas=lastCas;
    publish('READING_SOURCE',null,true);
    let result;
    try {
      result=await read({
        workId,token:bearer,anonKey,requestGeneration,
        latestGeneration:requestGeneration,
        expectedRowVersion:previousCas?.rowVersion,
        expectedAuthorizationEpoch:previousCas?.authorizationEpoch,
        signal:controller.signal
      });
    } catch {result=null;}
    if(disposed||controller.signal.aborted||generation!==requestGeneration||
       active!==controller)return state;
    active=null;
    if(!sourceSafe(result)){
      const status=typeof result?.status==='string' &&
        ['REFRESH_REQUIRED','BACKEND_UNAVAILABLE','UNSAFE_CACHE_POLICY',
         'SOURCE_CONTRACT_REJECTED','STALE_RESPONSE','AUTH_UNAVAILABLE'].includes(result.status)
        ? result.status : 'SOURCE_CONTRACT_REJECTED';
      // Keep prior CAS and the sticky latch until an explicit Fresh action.
      // Ordinary Inspect and all lifecycle resumes are prohibited meanwhile.
      if(status==='REFRESH_REQUIRED')needsExplicitFresh=true;
      return publish(status);
    }
    const view=sanitized(result);
    lastCas=Object.freeze({rowVersion:view.rowVersion,authorizationEpoch:view.authorizationEpoch});
    return publish(viewStatus,view);
  };
  const routeChanged=value=>{
    const normalized=canonicalWorkId(value);
    const changed=workId!==normalized;
    if(changed){
      workId=normalized;
      needsExplicitFresh=false;
      // Drop the old signed session BEFORE publishing canInspect. Never leave
      // a stale enabled read control on the newly selected Work.
      bearer=null;
      anonKey=null;
      clear(normalized?'AUTH_REQUIRED':'INVALID_WORK',false);
    }
    return state;
  };
  const replaceSession=(token,key)=>{
    needsExplicitFresh=false;
    clear('AUTH_REQUIRED',false);
    bearer=typeof token==='string'&&token?token:null;
    anonKey=typeof key==='string'&&key?key:null;
    return publish(bearer&&anonKey?'SIGNED_LOCAL_SESSION_CANDIDATE':'AUTH_REQUIRED');
  };
  const invalidate=(reason)=>{
    if(!invalidations.has(reason))return state;
    if(reason==='WORK_CHANGED'||reason==='ACCOUNT_CHANGED'||reason==='SESSION_CHANGED'||reason==='LOGOUT'){
      needsExplicitFresh=false;
      bearer=null;anonKey=null;
      return clear('AUTH_REQUIRED',false);
    }
    if(reason==='HIDDEN')visible=false;
    if(reason==='BLUR')focused=false;
    if(reason==='OFFLINE')online=false;
    if(reason==='CAS_CONFLICT'){
      needsExplicitFresh=true;
      return clear('REFRESH_REQUIRED');
    }
    return clear('REVALIDATION_REQUIRED');
  };
  const resume=reason=>{
    if(!resumptions.has(reason))return Promise.resolve(state);
    if(reason==='VISIBLE')visible=true;
    if(reason==='FOCUS')focused=true;
    if(reason==='ONLINE')online=true;
    // PAGESHOW must not assert visibility/focus/online status on its own.
    // A CAS refusal survives every resume. No implicit fresh/HTTP is allowed.
    if(needsExplicitFresh)return Promise.resolve(clear('REFRESH_REQUIRED'));
    clear('REVALIDATION_REQUIRED');
    return ready()?revalidate():Promise.resolve(state);
  };
  const dispose=()=>{
    if(disposed)return;
    disposed=true;needsExplicitFresh=false;bearer=null;anonKey=null;workId=null;
    clear('AUTH_REQUIRED',false);
  };
  return Object.freeze({
    getState:()=>state,routeChanged,replaceSession,invalidate,resume,
    revalidate,dispose
  });
}

// Event notifications are local observation only. They cannot prove that a
// passive view was remotely revoked before the next actual signed read.
export function attachOwnerReadBrowserLifecycle(controller,{documentRef,windowRef}={}) {
  if(!controller || !documentRef?.addEventListener || !windowRef?.addEventListener)
    return ()=>{};
  const listeners=[
    [documentRef,'visibilitychange',()=>{
      if(documentRef.visibilityState==='hidden')controller.invalidate('HIDDEN');
      else if(documentRef.visibilityState==='visible')void controller.resume('VISIBLE');
    }],
    [windowRef,'blur',()=>controller.invalidate('BLUR')],
    [windowRef,'focus',()=>void controller.resume('FOCUS')],
    [windowRef,'offline',()=>controller.invalidate('OFFLINE')],
    [windowRef,'online',()=>void controller.resume('ONLINE')],
    [windowRef,'pagehide',()=>controller.invalidate('PAGEHIDE')],
    [windowRef,'pageshow',()=>void controller.resume('PAGESHOW')]
  ];
  for(const [target,name,callback] of listeners)target.addEventListener(name,callback);
  return ()=>{for(const [target,name,callback] of listeners)
    target.removeEventListener(name,callback);};
}
