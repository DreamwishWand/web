// 08 WEB Account source-only UI boundary. Existing 03 COMM CommunityLabClient owns
// GoTrue/Auth/session/refresh; this module never implements a parallel Auth client.
export const FIRST_ACCOUNT_UI_OPERATION = 'WEB_SOURCE_ONLY_FAILCLOSED_SIGNUP_PROFILE_PRIVATE_LIBRARY_UI';
export const FIRST_ACCOUNT_PUBLIC_ENABLED = false;
export const PUBLIC_PROFILE_RUNTIME_ACCEPTED = false;
export const PRIVATE_LIBRARY_RUNTIME_ACCEPTED = false;
export const OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN = 'https://ptpdoxhrqopvczpclcij.supabase.co';
const disposableHosts=new Set(['localhost','127.0.0.1','dreamwishwand.github.io']);

export function resolveFirstAccountTestGate({
 flag='',hostname='',supabaseUrl='',publishableKey=''
}={}) {
 if(flag!=='OWNER_DISPOSABLE_STAGING_TEST')return Object.freeze({allowed:false,reason:'OWNER_TEST_OPT_IN_OFF'});
 if(!disposableHosts.has(hostname))return Object.freeze({allowed:false,reason:'NOT_A_DISPOSABLE_TEST_HOST'});
 if(supabaseUrl!==OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN)return Object.freeze({allowed:false,reason:'STAGING_ORIGIN_UNVERIFIED'});
 if(typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(publishableKey))
  return Object.freeze({allowed:false,reason:'STAGING_PUBLISHABLE_KEY_MISSING'});
 return Object.freeze({allowed:true,reason:'LOCAL_OR_EXPLICIT_TEST_PAGES_ONLY'});
}

export async function registerDisposableFirstAccount(client,email,password) {
 if(!client || typeof client.signUpWithPassword!=='function')throw Error('ACCOUNT_TEST_AUTH_OFF');
 if(client.session)throw Error('SIGN_OUT_FIRST');
 const result=await client.signUpWithPassword(email,password);
 if(result?.requiresEmailConfirmation!==true) {
  // A provider skipping email confirmation is an unacceptable signup configuration.
  if(typeof client.signOut==='function')await client.signOut();
  throw Error('EMAIL_CONFIRMATION_POLICY_NOT_MET');
 }
 return Object.freeze({status:'WAIT_EMAIL_CONFIRMATION'});
}

async function verifyActor(client,session) {
 if(!session||typeof session.userId!=='string'||!session.userId ||
  typeof session.expiresAt!=='number'||session.expiresAt<=Date.now())
  throw Error('CURRENT_AUTH_SESSION_NOT_VERIFIED');
 const response=await client.query('me');
 const actual=response?.data?.accountId;
 if(response?.ok!==true || typeof actual!=='string' || actual!==session.userId)
  throw Error('OTHER_ACCOUNT_OR_UNKNOWN_PROFILE_DENIED');
 return Object.freeze({status:'DISPOSABLE_STAGING_IDENTITY_VERIFIED',
  userId:session.userId, email:typeof session.email==='string'?session.email:null,
  privateLibraryAuthorized:false,publicProfilePublished:false});
}

export async function verifyDisposableFirstAccount(client) {
 if(!client||typeof client.query!=='function'||typeof client.signOut!=='function')
  throw Error('ACCOUNT_TEST_AUTH_OFF');
 try{return await verifyActor(client,client.session);}
 catch(error){await client.signOut();throw error;}
}

export async function signInDisposableFirstAccount(client,email,password) {
 if(!client||typeof client.signInWithPassword!=='function')throw Error('ACCOUNT_TEST_AUTH_OFF');
 try {
  const signed=await client.signInWithPassword(email,password);
  return await verifyActor(client,signed);
 }catch(error){
  if(typeof client.signOut==='function')await client.signOut();
  throw error;
 }
}

export async function signOutDisposableFirstAccount(client) {
 if(!client||typeof client.signOut!=='function')throw Error('ACCOUNT_TEST_AUTH_OFF');
 await client.signOut();
 return Object.freeze({status:'SIGNED_OUT_LOCAL_NO_PRIVATE_DATA'});
}
