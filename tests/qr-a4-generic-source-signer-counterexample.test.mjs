import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source.replace(/^import[^\n]+\n/gm,''),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__edge = {');
const actor='22222222-2222-4222-8222-222222222222';
const owner='11111111-1111-4111-8111-111111111111';
async function call(action,overrides={}){
 const calls=[];
 const storage={
  createSignedUploadUrl:async key=>{calls.push('createSignedUploadUrl');return{data:{signedUrl:'SYNTHETIC_NOT_REAL'},error:null};},
  createSignedUrl:async key=>{calls.push('createSignedUrl');return{data:{signedUrl:'SYNTHETIC_NOT_REAL'},error:null};},
  copy:async()=>{calls.push('copy');throw Error('QR_A4_COPY_MUST_NEVER_RUN')},
  remove:async()=>{calls.push('remove');throw Error('QR_A4_REMOVE_MUST_NEVER_RUN')}
 };
 const admin={
  storage:{from:()=>storage},
  rpc:async(name,args)=>{
   calls.push('rpc:'+name);
   if(name==='community_authorize_session')return{data:{accountId:owner},error:null};
   if(name==='community_consume_action_rate_limit')return{data:{allowed:true},error:null};
   if(name==='wep_get_accessible_preset_blob')return{data:{storageKey:'SYNTHETIC_NO_OBJECT',blobId:owner,byteSize:123,checksumSha256:'a'.repeat(64)},error:null};
   throw Error('QR_A4_UNEXPECTED_RPC:'+name);
  }
 };
 const env={__edge:null,Response,Blob,TextEncoder,TextDecoder,crypto:webcrypto,
  corsHeaders:{},resolveRuntimeWepPresetArtifactBucket:()=> 'isolated-nonprovider',
  withSupabase:(_opts,fn)=>req=>fn(req,{userClaims:{id:actor},jwtClaims:{iat:1793000000},supabaseAdmin:admin})};
 vm.runInNewContext(js,env,{filename:'qr-gatea4-observed-generic-source.js'});
 const r=await env.__edge.fetch({method:'POST',json:async()=>({
  action,byteSize:123,presetArtifactId:owner,creatorProfileId:owner,storageKey:'staging/'+owner+'/'+actor+'.json',
  idempotencyKey:'qr-gatea4-test',...overrides
 })});
 return {status:r.status,body:await r.json(),calls};
}
test('A4 source-only Generic read/upload actions still yield signer attempts: must not be labeled inert transition bundle',async()=>{
 const prep=await call('prepare');
 const read=await call('read');
 assert.ok(prep.calls.includes('createSignedUploadUrl'),JSON.stringify(prep));
 assert.ok(read.calls.includes('createSignedUrl'),JSON.stringify(read));
 assert.equal(prep.status,200);
 assert.equal(read.status,200);
 assert.equal(prep.calls.includes('copy')||prep.calls.includes('remove'),false);
 assert.equal(read.calls.includes('copy')||read.calls.includes('remove'),false);
 console.log('QR_A4_OWNER142_GENERIC_RUNTIME_SIGNER_COUNTEREXAMPLE_EXPECTED_BLOCKER',JSON.stringify({
  signedUploadAttempt:true,signedReadAttempt:true,sourceOnly:true,
  actualProviderCalled:false,realSignedURLCreated:false,transitionBundleAccepted:false
 }));
});
