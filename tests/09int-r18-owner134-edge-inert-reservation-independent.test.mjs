import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const text=fs.readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
const code=ts.transpileModule(text.replace(/^import[^\n]+\n/gm,''),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__r18Edge = {');
const owner='00000000-0000-4000-8000-000000000001';
const actor='00000000-0000-4000-8000-000000000002';
const creator='00000000-0000-4000-8000-000000000003';
const stage='staging/'+owner+'/00000000-0000-4000-8000-000000000004.json';
const artifact={schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 originPolicy:'capture-region-top-left',bounds:{w:1,h:1},
 objects:[{artifactObjectId:'o1',itemId:10000001,localX:0,localY:0,
 orientation:0,footprint:[{x:0,y:0}],dependencyIds:[]}]};
async function invoke(body,params={}) {
 const calls=[];
 const bucket={
   download:async key=>{
     calls.push(['download',key]);
     return key===stage ? {data:new Blob([JSON.stringify(artifact)]),error:null}:{data:null,error:{message:'missing'}};
   },
   copy:async()=>{throw Error('INVALID positive provider COPY');},
   remove:async()=>{throw Error('INVALID positive provider REMOVE');},
   createSignedUrl:async key=>({data:{signedUrl:'mock://'+key},error:null})
 };
 const admin={
   storage:{from:()=>bucket},
   rpc:async(name,args)=>{
     calls.push(['rpc',name,args]);
     if(name==='community_authorize_session')
       return params.revoked?{data:null,error:{message:'revoked'}}:{data:{accountId:owner},error:null};
     if(name==='community_preset_storage_cleanup_preflight_r18')
       return {data:{cleanupAuthorized:false,physicalDeleteAuthorized:false,cleanupState:'DENIED'},error:null};
     if(name==='community_preset_storage_reserve_r18') {
       if(params.reserveError) return {data:null,error:{message:'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT'}};
       const raw=new TextEncoder().encode(owner+':'+args.p_idempotency_key);
       const digest=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
       return {data:{contract:'ddv.preset-storage-reservation@r18-work',
         reservationId:'00000000-0000-4000-8000-000000000005',reservationState:'RESERVED',stateVersion:1,
         publishedStorageKey:'published/'+owner+'/'+digest+'.json',publicationCommitAuthorized:false,
         realPublishedObjectBytesVerified:false,physicalCleanupAuthorized:false},error:null};
     }
     if(name==='wep_get_accessible_preset_blob')
       return {data:{storageKey:'published/'+owner+'/existing.json',presetArtifactId:'known',
         presetRevisionId:'knownrev',presetType:'scene',blobId:'knownblob',schemaVersion:1,
         contentType:'application/json',byteSize:30,checksumSha256:'a'.repeat(64)},error:null};
     throw Error('unexpected RPC '+name);
   }
 };
 const box={__r18Edge:null,Response,Blob,TextDecoder,TextEncoder,crypto:webcrypto,
   corsHeaders:{'Access-Control-Allow-Origin':'*'},
   resolveRuntimeWepPresetArtifactBucket:()=> 'wep-preset-artifacts',
   withSupabase:(auth,handler)=>req=>handler(req,box.context)};
 vm.runInNewContext(code,box);
 box.context={supabaseAdmin:admin,userClaims:{id:actor},jwtClaims:{iat:1761436800}};
 const response=await box.__r18Edge.fetch({method:'POST',json:async()=>body});
 return {status:response.status,body:await response.json(),calls};
}
test('Owner Source134 real Edge publish always terminal before RPC or Provider',async()=>{
 const r=await invoke({action:'publish',storageKey:stage});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED');
 assert.equal(r.body.publicationAuthorized,false);
 assert.deepEqual(r.calls.map(c=>c[1]),['community_authorize_session']);
});
test('Owner Source134 real Edge cleanup preflight explicitly denies physical delete',async()=>{
 const r=await invoke({action:'discard',storageKey:'published/'+owner+'/unregistered.json'});
 assert.equal(r.status,409);
 assert.equal(r.body.cleanupAuthorized,false);
 assert.deepEqual(r.calls.map(c=>c[1]),['community_authorize_session','community_preset_storage_cleanup_preflight_r18']);
});
test('Owner Source134 real Edge reservePublication verifies actual staged bytes, returns only inert reservation',async()=>{
 const r=await invoke({action:'reservePublication',storageKey:stage,
   creatorProfileId:creator,idempotencyKey:'r18-independent',visibility:'public',title:'actual capture'});
 assert.equal(r.status,200);
 assert.equal(r.body.publicationAuthorized,false);
 assert.equal(r.body.cleanupAuthorized,false);
 assert.equal(r.body.reservation.reservationState,'RESERVED');
 assert.equal(r.body.reservation.realPublishedObjectBytesVerified,false);
 assert.deepEqual(r.calls.map(c=>c[1]).filter(x=>x!=='download'),[
   'community_authorize_session','community_preset_storage_reserve_r18']);
 assert.equal(r.calls.filter(c=>c[0]==='download').length,1);
});
test('Owner Source134 real Edge forged account and revoked Session cannot authorize reservation',async()=>{
 const r=await invoke({action:'reservePublication',storageKey:stage,
   creatorProfileId:creator,idempotencyKey:'r18-independent',title:'actual capture',
   p_auth_subject:'00000000-0000-4000-8000-000000000999',
   ownerAccountId:'00000000-0000-4000-8000-000000000999'});
 assert.equal(r.status,200);
 const reserve=r.calls.find(c=>c[1]==='community_preset_storage_reserve_r18');
 assert.equal(reserve[2].p_auth_subject,actor);
 const revoked=await invoke({action:'publish',storageKey:stage},{revoked:true});
 assert.equal(revoked.status,401);
 assert.deepEqual(revoked.calls.map(c=>c[1]),['community_authorize_session']);
});
test('Owner Source134 denied reservation keeps private bytes with no positive Provider writes',async()=>{
 const r=await invoke({action:'reservePublication',storageKey:stage,
   creatorProfileId:creator,idempotencyKey:'r18-independent',title:'actual capture'},{reserveError:true});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'PRESET_RESERVATION_DENIED');
 assert.equal(r.body.reservation,undefined);
});
