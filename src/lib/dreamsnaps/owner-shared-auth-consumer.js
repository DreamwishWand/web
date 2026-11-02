import {canonicalWorkId} from '../community/typed-work-route.js';
import {ownerProductSignedSessionCandidate} from './owner-product-readonly.js';

// This is a Consumer of the one shared Community Session coordinator.
// It does not refresh, persist, verify, broadcast or replay bearer credentials.
export const OWNER_SHARED_AUTH_CONSUMER_CONTRACT =
  'wand.dreamsnaps.owner-shared-auth-consumer@1';

/** @param {{client?:any,controller?:any,enabled?:boolean,
 * onSessionChange?:(signedIn:boolean)=>void}} options */
export function createOwnerSharedAuthConsumer({
  client,controller,enabled=false,onSessionChange=()=>{}
}={}) {
  let workId=null, generation=0, inFlight=null, abort=null;
  let unsubscribe=()=>{}, attached=false, disposed=false, bound=null;

  const signedIn=()=>Boolean(client?.session);
  const notify=()=>onSessionChange(signedIn());
  const invalidate=(reason='SESSION_CHANGED')=>{
    generation++;
    abort?.abort();
    abort=null;
    inFlight=null;
    bound=null;
    controller?.invalidate(reason);
  };
  const onSessionEvent=event=>{
    // Events from the common coordinator carry metadata only, never tokens.
    if(disposed || !event || typeof event.generation!=='number' ||
       typeof event.logoutEpoch!=='number')return;
    invalidate(event.kind==='logged-out'?'LOGOUT':
      event.kind==='account-changed'?'ACCOUNT_CHANGED':'SESSION_CHANGED');
    notify();
  };
  const attach=()=>{
    if(attached||disposed)return;
    attached=true;
    if(typeof client?.subscribeSession==='function')
      unsubscribe=client.subscribeSession(onSessionEvent);
    notify();
  };
  const routeChanged=value=>{
    const next=canonicalWorkId(value);
    if(next!==workId){
      invalidate('WORK_CHANGED');
      workId=next;
      controller?.routeChanged(next);
    }
    return controller?.getState?.()??null;
  };
  // On focus/pageshow, check only the local session copy; this does NOT
  // promise instant remote revocation or implicitly issue a Source153 read.
  const inspectLocalSession=()=>{
    if(disposed)return;
    const now=ownerProductSignedSessionCandidate(client);
    if(bound && (!now || bound.token!==now.token ||
       bound.userId!==now.sessionUserId || bound.expiresAt!==now.expiresAt))
      invalidate('SESSION_CHANGED');
    notify();
  };
  const inspect=async({fresh=false}={})=>{
    if(disposed || !enabled || !controller || !workId ||
       typeof client?.getValidSignedSession!=='function')
      return controller?.getState?.()??null;
    const before=controller.getState();
    // The PR291 sticky 403/CAS state cannot be bypassed by an ordinary
    // inspect, even if the Community session needs refreshing.
    if(before.working || (!fresh && before.canFreshRead) ||
       (fresh && !before.canFreshRead))return before;
    if(inFlight)return inFlight;
    const ownGeneration=generation, ownWork=workId;
    const requestAbort=new AbortController();
    abort=requestAbort;
    const promise=(async()=>{
      try {
        const signed=await client.getValidSignedSession({signal:requestAbort.signal});
        if(requestAbort.signal.aborted || disposed ||
           generation!==ownGeneration || workId!==ownWork)
          return controller.getState();
        const current=ownerProductSignedSessionCandidate(client);
        // A token-bearing signed-session candidate still has NO Owner rights.
        if(!current || signed?.accessToken!==current.token ||
           signed?.userId!==current.sessionUserId ||
           signed?.expiresAt!==current.expiresAt){
          invalidate('SESSION_CHANGED');
          return controller.getState();
        }
        if(!bound || bound.token!==current.token ||
           bound.userId!==current.sessionUserId ||
           bound.expiresAt!==current.expiresAt){
          // replaceSession clears previous Work CAS, but only on an actual
          // shared session boundary, never on a same-session recheck.
          bound={token:current.token,userId:current.sessionUserId,
            expiresAt:current.expiresAt};
          controller.replaceSession(current.token,current.anonKey);
        }
        const state=controller.getState();
        if(fresh ? !state.canFreshRead : !state.canInspect)
          return state;
        return await controller.revalidate({fresh});
      }catch{
        if(!disposed && !requestAbort.signal.aborted &&
           generation===ownGeneration)invalidate('SESSION_CHANGED');
        return controller.getState();
      }finally{
        if(abort===requestAbort)abort=null;
      }
    })();
    inFlight=promise;
    try{return await promise;}
    finally{if(inFlight===promise)inFlight=null;}
  };
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    invalidate('LOGOUT');
    unsubscribe();
    unsubscribe=()=>{};
  };
  return Object.freeze({attach,routeChanged,inspectLocalSession,
    inspect,dispose,getState:()=>controller?.getState?.()??null});
}
