import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto, createHash} from 'node:crypto';

const provenance={
 scene:{name:'wep-scene-preset-product',version:1, deployedBundleSHA:'6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045',
 path:'09int-r18-deployed-scene-product-v1.ts.txt'},
 artifact:{name:'wep-preset-artifact',version:14,deployedBundleSHA:'fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa',
 path:'09int-r18-deployed-preset-artifact-v14.ts.txt'},
 worker:{name:'wep-preset-retention',version:6,deployedBundleSHA:'675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e',
 path:'09int-r18-deployed-preset-retention-v6.ts.txt'}
};
const account='00000000-0000-4000-8000-000000000001';
const subject='00000000-0000-4000-8000-000000000002';
const creator='00000000-0000-4000-8000-000000000003';
const stageA='staging/'+account+'/00000000-0000-4000-8000-000000000004.json';
const stageB='staging/'+account+'/00000000-0000-4000-8000-000000000005.json';
const keyId='same-idempotency';
const published='published/'+account+'/'+createHash('sha256').update(account+':'+keyId).digest('hex')+'.json';
const original={
 schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',originPolicy:'capture-region-top-left',
 bounds:{w:1,h:1},objects:[{artifactObjectId:'o1',layer:'furniture',itemId:10000001,
 localX:0,localY:0,orientation:0,footprint:[{x:0,y:0}],dependencyIds:[]}]
};
const variants=[original,{...original,objects:[{...original.objects[0],itemId:10000002}]}];
const blob=v=>new Blob([JSON.stringify(v)],{type:'application/json'});
function signal() {
 let release;
 const promise=new Promise(r=>release=r);
 return {promise,release};
}
function rig({different=false}={}) {
 const storage=new Map([[stageA,blob(original)],[stageB,blob(variants[different?1:0])]]);
 const registered=new Set(),events=[];
 let ownerSQL=async()=>({data:{sceneArtifactId:'scene123'},error:null});
 let artifactSQL=async()=>({data:{presetArtifactId:'generic123'},error:null});
 let claimed=async()=>({data:{accountId:account,blobs:[{blobId:'blob123',storageKey:published}]},error:null});
 let workerVerify=async()=>({data:true,error:null});
 const bucket={
  download:async key=>{
   events.push(['download',key]);
   if(!storage.has(key))return {data:null,error:{message:'NOT_FOUND'}};
   return {data:storage.get(key),error:null};
  },
  copy:async (source,destination)=>{
   events.push(['copy',source,destination]);
   if(!storage.has(source))return {error:{message:'COPY_SOURCE_MISSING'}};
   if(storage.has(destination))return {error:{message:'ALREADY_EXISTS'}};
   storage.set(destination,storage.get(source));
   events.push(['copied',destination]);
   return {error:null};
  },
  remove:async keys=>{
   for(const key of keys){events.push(['remove',key]);storage.delete(key);}
   return {error:null};
  },
  createSignedUrl:async key=>({data:{signedUrl:'mock://'+key},error:null})
 };
 const admin={
  storage:{from:()=>bucket},
  rpc:async(name,args)=>{
   events.push(['rpc',name,args]);
   if(name==='community_authorize_session')return {data:{accountId:account},error:null};
   if(name==='community_consume_action_rate_limit')return {data:{allowed:true},error:null};
   if(name==='community_publish_scene_preset_product_v1')return ownerSQL(args);
   if(name==='community_publish_preset_envelope')return artifactSQL(args);
   if(name==='community_verify_worker_token')return workerVerify(args);
   if(name==='wep_get_claimed_retention_artifact_blobs')return claimed(args);
   if(name==='community_finalize_artifact_blob_purge')return {data:true,error:null};
   throw Error('Unexpected SQL RPC '+name);
  },
  from:table=>{
   assert.equal(table,'artifact_blobs');
   let storageKey;
   const q={
    select:()=>q,
    eq:(column,v)=>{assert.equal(column,'storage_key');storageKey=v;return q;},
    maybeSingle:async()=>({data:registered.has(storageKey)?{blob_id:'blob123'}:null,error:null})
   };
   return q;
  }
 };
 const hosts={};
 function instantiate(kind) {
  const raw=fs.readFileSync(new URL('./fixtures/'+provenance[kind].path,import.meta.url),'utf8');
  assert.ok(raw.includes('community_'),kind+' is not the frozen deployed source');
  const compiled=ts.transpileModule(raw.replace(/^import[^\n]+\n/gm,''),{
   compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText.replace(/\bexport default\s*\{/,'__edge={');
  const context={
   __edge:null,Response,Blob,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,
   corsHeaders:{'Access-Control-Allow-Origin':'*'},
   resolveRuntimeWepPresetArtifactBucket:()=> 'wand-preset-artifacts-staging',
   withSupabase:(opts,handler)=>{
    assert.equal(opts.auth,kind==='worker'?'none':'user');
    return req=>handler(req,{supabaseAdmin:admin,userClaims:{id:subject},
      jwtClaims:{iat:1761436800,session_id:'session123'}});
   }
  };
  vm.runInNewContext(compiled,context,{filename:provenance[kind].path});
  assert.ok(context.__edge?.fetch,'Cannot execute actual deployed handler '+kind);
  return context.__edge;
 }
 for(const kind of Object.keys(provenance)) hosts[kind]=instantiate(kind);
 async function invoke(kind,body){
  const req={method:'POST',json:async()=>body,
   headers:{get:name=>name==='x-community-worker-token'?'fake-worker-token':null}};
  const response=await hosts[kind].fetch(req);
  return {status:response.status,body:await response.json()};
 }
 function prove(name,extra={}){
  console.log(JSON.stringify({name,
   mode:'actual-deployed-Edge-TS-snapshot + MOCK RPC/Storage; NOT real provider',
   snapshots:Object.fromEntries(Object.entries(provenance).map(([k,v])=>[k,{version:v.version,bundleSHA:v.deployedBundleSHA}])),
   objectPresent:storage.has(published),registeredBlob:registered.has(published),
   publishedRemoved:events.filter(x=>x[0]==='remove'&&x[1]===published).length,...extra}));
 }
 return {storage,registered,events,invoke,published,stageA,stageB,prove,
  sceneSQL:fn=>{ownerSQL=fn;},artifactSQL:fn=>{artifactSQL=fn;},
  retentionClaim:fn=>{claimed=fn;},verifyWorker:fn=>{workerVerify=fn;}};
}
const sceneRequest={action:'publish',storageKey:stageA,creatorProfileId:creator,title:'Scene',
 idempotencyKey:keyId,mediaIds:['00000000-0000-4000-8000-000000000006']};
const genericRequest={action:'publish',storageKey:stageB,creatorProfileId:creator,title:'Generic',
 idempotencyKey:keyId,visibility:'public'};

test('dual Writer A Scene copies; B generic shares immutable key & commits; A failed SQL compensation deletes B',async()=>{
 const b=rig(),atSceneSql=signal(),releaseScene=signal();
 b.sceneSQL(async()=>{atSceneSql.release();await releaseScene.promise;
  return {data:null,error:{message:'SCENE_SQL_IDEMPOTENCY_CONFLICT'}};});
 b.artifactSQL(async args=>{b.registered.add(args.p_artifact_storage_key);
  return {data:{presetArtifactId:'B-success'},error:null};});
 const a=b.invoke('scene',sceneRequest);
 await atSceneSql.promise;
 assert.equal(b.storage.has(published),true);
 const winner=await b.invoke('artifact',genericRequest);
 assert.equal(winner.status,200,JSON.stringify(winner));
 assert.equal(b.registered.has(published),true);
 releaseScene.release();
 const loser=await a;
 assert.equal(loser.status,400);
 assert.equal(loser.body.error,'SCENE_PRESET_PRODUCT_PUBLISH_FAILED');
 assert.equal(b.storage.has(published),false);
 b.prove('DUAL_WRITER_SCENE_LOSES_AND_PHYSICALLY_DELETES_ARTIFACT_WINNER',{winner:200,loser:400,unsafe:true});
});

test('dual Writer A generic copies; B Scene commits; A failed SQL compensation deletes B',async()=>{
 const b=rig(),atArtifactSql=signal(),releaseArtifact=signal();
 b.artifactSQL(async()=>{atArtifactSql.release();await releaseArtifact.promise;
  return {data:null,error:{message:'ARTIFACT_SQL_IDEMPOTENCY_CONFLICT'}};});
 b.sceneSQL(async args=>{b.registered.add(args.p_artifact_storage_key);
  return {data:{presetArtifactId:'scene-success'},error:null};});
 const a=b.invoke('artifact',genericRequest);
 await atArtifactSql.promise;
 assert.equal(b.storage.has(published),true);
 const winner=await b.invoke('scene',sceneRequest);
 assert.equal(winner.status,200,JSON.stringify(winner));
 assert.equal(b.registered.has(published),true);
 releaseArtifact.release();
 const loser=await a;
 assert.equal(loser.status,400);
 assert.equal(loser.body.error,'PRESET_PUBLISH_FAILED');
 assert.equal(b.storage.has(published),false);
 b.prove('DUAL_WRITER_ARTIFACT_LOSES_AND_PHYSICALLY_DELETES_SCENE_WINNER',{winner:200,loser:400,unsafe:true});
});

test('dual Writer same published destination, different payload content, second route fails closed before SQL',async()=>{
 const b=rig({different:true}),atSceneSql=signal(),releaseScene=signal();
 b.sceneSQL(async args=>{atSceneSql.release();await releaseScene.promise;
  b.registered.add(args.p_artifact_storage_key);
  return {data:{presetArtifactId:'scene-success'},error:null};});
 const first=b.invoke('scene',sceneRequest);
 await atSceneSql.promise;
 const second=await b.invoke('artifact',genericRequest);
 assert.notEqual(second.status,200);
 assert.equal(b.events.filter(e=>e[0]==='rpc'&&e[1]==='community_publish_preset_envelope').length,0);
 assert.ok(b.storage.has(published));
 releaseScene.release();
 const completed=await first;
 assert.equal(completed.status,200);
 b.prove('DUAL_WRITER_DIFFERENT_HASH_CONTENT_CONFLICT_BEFORE_SQL',{differentPayload:true,secondStatus:second.status});
});

test('delayed already-claimed Retention worker removes a newly referenced published object',async()=>{
 const b=rig(),claimed=signal(),allowClaim=signal();
 b.retentionClaim(async()=>{claimed.release();await allowClaim.promise;
  return {data:{accountId:account,blobs:[{blobId:'blob123',storageKey:published}]},error:null};});
 const worker=b.invoke('worker',{retentionJobId:'retention-1',lockToken:'lease-1'});
 await claimed.promise;
 const winner=await b.invoke('scene',sceneRequest);
 assert.equal(winner.status,200);
 b.registered.add(published);
 assert.equal(b.storage.has(published),true);
 allowClaim.release();
 const complete=await worker;
 assert.equal(complete.status,200,JSON.stringify(complete));
 assert.equal(b.storage.has(published),false);
 assert.ok(b.registered.has(published));
 b.prove('LATE_RETENTION_CLAIM_DELETES_NEWLY_REFERENCED_PUBLISHED_OBJECT',{unsafe:true,lateWorker:true});
});

test('foreign-account physical key discard blocked by both actual deployed Edge sources',async()=>{
 const b=rig();
 const invalid='published/00000000-0000-4000-8000-000000000099/'+('a'.repeat(64))+'.json';
 for(const kind of ['scene','artifact']){
  const r=await b.invoke(kind,{action:'discard',storageKey:invalid});
  assert.equal(r.status,403,JSON.stringify(r));
 }
 assert.equal(b.events.filter(x=>x[0]==='remove').length,0);
 b.prove('DUAL_WRITER_FOREIGN_ACCOUNT_PHYSICAL_DISCARD_DENIED',{scopedAuthPass:true});
});

test('neither the recorded mock SQL registries nor old worker claim guarantee actual provider byte persistence',()=>{
 const b=rig();
 assert.equal(b.registered.size,0);
 b.prove('CROSS_SYSTEM_ATOMICITY_NOT_ESTABLISHED_BY_MOCK',{actualPostgreSQL:false,realSignedStorage:false});
});
