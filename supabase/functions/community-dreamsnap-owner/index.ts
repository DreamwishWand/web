// X05 Source150: nonpublic owner service only. Not a media/public issuer.
import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Obj = Record<string,unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[0-9a-f]{64}$/;
const VERSION = /^v[1-9][0-9]{0,6}$/;
const ACTIONS = new Set(['grant','preflight','concept','withdraw','delete']);
function reply(body:unknown,status=200):Response {
  return Response.json(body,{status,headers:{
    ...corsHeaders,
    'Cache-Control':'private, no-store, max-age=0',
    'CDN-Cache-Control':'no-store',
    'Surrogate-Control':'no-store',
    'Pragma':'no-cache',
    'Vary':'Authorization, Origin',
    'X-Content-Type-Options':'nosniff'
  }});
}
function object(v:unknown):v is Obj {return v!==null && typeof v==='object' && !Array.isArray(v);}
function exact(v:Obj,allow:string[]):boolean{return Object.keys(v).every(k=>allow.includes(k));}
function uuid(v:unknown):v is string {return typeof v==='string'&&UUID.test(v)&&v!=='00000000-0000-0000-0000-000000000000';}
function safeVersion(v:unknown,min=1):v is number{return Number.isSafeInteger(v)&&Number(v)>=min;}
export function parseOwnerRequest(v:unknown):{rpc:string;payload:Obj}|null {
  if(!object(v)||!exact(v,['operation','workId','expectedRowVersion','expectedAuthorizationEpoch','action',
    'photoRevisionId','photoMediaId','policyVersionText','policyDigest',
    'selfCaptureDeclared','explicitGrantAccepted','conceptRevisionId']))return null;
  if(!uuid(v.workId))return null;
  if(v.operation==='read'||v.operation==='pregrant'){
    return exact(v,['operation','workId'])
      ? {rpc:v.operation==='pregrant'
          ? 'community_dreamsnap_x05_pregrant_read_v1'
          : 'community_dreamsnap_x05_owner_read_v1',
         payload:{p_work_id:v.workId}}
      : null;
  }
  if(v.operation!=='action'||typeof v.action!=='string'||!ACTIONS.has(v.action))return null;
  if(!safeVersion(v.expectedAuthorizationEpoch,0)||!safeVersion(v.expectedRowVersion,0))return null;
  const payload:Obj={
    p_work_id:v.workId,
    p_expected_row_version:v.expectedRowVersion,
    p_expected_authorization_epoch:v.expectedAuthorizationEpoch,
    p_action:v.action
  };
  if(v.action==='grant'){
    if(!exact(v,['operation','workId','expectedRowVersion','expectedAuthorizationEpoch','action',
       'photoRevisionId','photoMediaId','policyVersionText','policyDigest',
       'selfCaptureDeclared','explicitGrantAccepted'])||
       !uuid(v.photoRevisionId)||!uuid(v.photoMediaId)||
       typeof v.policyVersionText!=='string'||!VERSION.test(v.policyVersionText)||
       typeof v.policyDigest!=='string'||!DIGEST.test(v.policyDigest)||
       v.selfCaptureDeclared!==true||v.explicitGrantAccepted!==true)return null;
    payload.p_photo_revision_id=v.photoRevisionId;
    payload.p_photo_media_id=v.photoMediaId;
    payload.p_policy_version=v.policyVersionText;
    payload.p_policy_digest=v.policyDigest;
    payload.p_self_capture_declared=true;
    payload.p_grant_accepted=true;
  }else if(v.action==='concept'){
    if(!exact(v,['operation','workId','expectedRowVersion','expectedAuthorizationEpoch','action','conceptRevisionId'])||
       !uuid(v.conceptRevisionId))return null;
    payload.p_concept_revision_id=v.conceptRevisionId;
  }else if(!exact(v,['operation','workId','expectedRowVersion','expectedAuthorizationEpoch','action']))return null;
  return {rpc:'community_dreamsnap_x05_owner_action_v1',payload};
}

const handler=withSupabase({auth:'user'},async (req,ctx)=>{
  if(req.method!=='POST')return reply({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const subject=ctx.userClaims?.id;
  const iat=Number(ctx.jwtClaims?.iat??0);
  const session=String(ctx.jwtClaims?.session_id??'');
  if(!uuid(subject)||!Number.isInteger(iat)||iat<=0||!uuid(session))
    return reply({ok:false,error:'AUTH_REQUIRED'},401);
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [A-Za-z0-9._-]+$/i.test(bearer))return reply({ok:false,error:'AUTH_REQUIRED'},401);
  // A server-verified actor, not request JSON, selects the auth subject.
  const {error:sessionError}=await ctx.supabaseAdmin.rpc('community_authorize_session',{
    p_auth_subject:subject,p_issued_at_epoch:iat,p_max_age_seconds:null
  });
  if(sessionError)return reply({ok:false,error:'SESSION_REVOKED_OR_INVALID'},401);

  const body=await req.json().catch(()=>null);
  const request=parseOwnerRequest(body);
  if(!request)return reply({ok:false,error:'INVALID_OWNER_REQUEST'},400);
  const url=Deno.env.get('SUPABASE_URL')??'';
  // Use only the unprivileged publishable/anon API key. This *cannot* call
  // Source149 private RPCs: public wrapper verifies user JWT again.
  const apiKey=Deno.env.get('SUPABASE_ANON_KEY')??'';
  if(!/^https?:\/\//.test(url)||!apiKey)
    return reply({ok:false,error:'TRUSTED_ISSUER_NOT_CONFIGURED'},503);
  let response:Response;
  try {
    response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+request.rpc,{
      method:'POST',headers:{
        'Content-Type':'application/json','apikey':apiKey,
        'Authorization':bearer,'Cache-Control':'no-store'
      },body:JSON.stringify(request.payload)
    });
  }catch{return reply({ok:false,error:'OWNER_BACKEND_UNAVAILABLE'},503);}
  if(!response.ok){
    // PostgREST maps PL/pgSQL RAISE EXCEPTION (P0001) to HTTP 400. Only
    // explicitly allowlisted CAS tags become HTTP 409, with no SQL details.
    const failure=await response.json().catch(()=>null);
    const tag=object(failure)&&typeof failure.message==='string'?failure.message:'';
    const conflict=response.status===409 ||
      tag.includes('X05_STALE_EPOCH_OR_REVISION') ||
      tag.includes('X05_ROW_VERSION_CONFLICT') ||
      tag.includes('X05_GRANT_CAS_OR_IMMUTABLE_MISMATCH') ||
      tag.includes('X05_TERMINAL_WITHDRAWN');
    return reply({ok:false,error:conflict?'VERSION_CONFLICT':'OWNER_REQUEST_DENIED'},
      conflict?409:response.status===401?401:403);
  }
  const result=await response.json().catch(()=>null);
  if(!object(result))return reply({ok:false,error:'OWNER_RESPONSE_UNAVAILABLE'},503);
  if(request.rpc.endsWith('_action_v1')&&result.publicActivationAllowed!==false)
    return reply({ok:false,error:'PUBLIC_ACTIVATION_GUARD'},503);
  if(request.rpc.endsWith('_pregrant_read_v1')){
    if(result.contractVersion!=='wand.dreamsnaps.pregrant-service@1'||
       result.grantRecorded!==false||result.publicActivationAllowed!==false||
       !['NEED_POLICY_ARTIFACT','PREGRANT_READY'].includes(String(result.state))||
       (result.state==='PREGRANT_READY')!== (result.grantAvailable===true))
       return reply({ok:false,error:'PREGRANT_VERSION_UNSUPPORTED'},503);
  } else if(request.rpc.endsWith('_read_v1')&&result.contractVersion!=='wand.dreamsnaps.owner-management-service@1')
    return reply({ok:false,error:'OWNER_VERSION_UNSUPPORTED'},503);
  return reply({ok:true,operation:body.operation,
    contractVersion:'wand.dreamsnaps.owner-management-service@1',
    data:result});
});
export default {
  fetch(req:Request) {
    if(req.method==='OPTIONS')return new Response('ok',{headers:{...corsHeaders,'Cache-Control':'private, no-store'}});
    return handler(req);
  }
};
