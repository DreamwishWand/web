import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const frozenWep = '66dc71ee828d965af04685844508d000261263a5';
const source = fs.readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
const compiled = ts.transpileModule(source.replace(/^import[^\n]+\n/gm,''), {
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__edge = {');
const account='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const creator='44444444-4444-4444-8444-444444444444';
const artifact={schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
  bounds:{w:1,h:1},originPolicy:'capture-region-top-left',
  objects:[{artifactObjectId:'o1',itemId:1,localX:0,localY:0,orientation:0,
    footprint:[{x:0,y:0}],dependencyIds:[]}]};
const payload=new TextEncoder().encode(JSON.stringify(artifact));
const stage='staging/'+account+'/55555555-5555-4555-8555-555555555555.json';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
async function published(id){
  const h=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(account+':'+id));
  return 'published/'+account+'/'+Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')+'.json';
}
function harness(){
  const objects=new Map([[stage,payload]]);
  const blobs=new Map();
  const events={remove:[],copy:[],rpc:[],commit:0};
  let publicationGate=null;
  const storage={
    download:async key=>objects.has(key)?{data:new Blob([objects.get(key)]),error:null}:{error:{message:'missing'}},
    copy:async (source,target)=>{
      events.copy.push([source,target]);
      if(!objects.has(source))return{error:{message:'missing'}};
      if(objects.has(target))return{error:{message:'destination exists'}};
      objects.set(target,objects.get(source));return{error:null};
    },
    remove:async keys=>{events.remove.push(...keys);keys.forEach(x=>objects.delete(x));return{error:null};}
  };
  const admin={
    storage:{from:()=>storage},
    from:()=>{throw Error('Unexpected committed Blob SQL lookup')},
    rpc:async(name,args)=>{
      events.rpc.push(name);
      if(name==='community_authorize_session')return{data:{accountId:args.p_auth_subject===other?'77777777-7777-4777-8777-777777777777':account},error:null};
      if(name==='community_publish_preset_envelope'){
        const result=publicationGate?await publicationGate(args):null;
        if(result?.error)return{error:result.error};
        if(blobs.has(args.p_artifact_storage_key))return{data:blobs.get(args.p_artifact_storage_key),error:null};
        const receipt={workId:'66666666-6666-4666-8666-666666666666'};
        blobs.set(args.p_artifact_storage_key,receipt);
        events.commit++;
        return{data:receipt,error:null};
      }
      throw Error('Unexpected RPC '+name);
    }
  };
  const scope={__edge:null,Response,TextEncoder,TextDecoder,Blob,crypto:webcrypto,
    corsHeaders:{},resolveRuntimeWepPresetArtifactBucket:()=> 'qa-isolated',
    withSupabase:(opts,handler)=>{
      assert.equal(opts.auth,'user');
      return req=>handler(req,{userClaims:{id:req.actor},jwtClaims:{iat:1761436800},supabaseAdmin:admin});
    }
  };
  vm.runInNewContext(compiled,scope,{filename:'actual-wep-edge-postfix.js'});
  const invoke=async(body,who=actor)=>{
    const res=await scope.__edge.fetch({method:'POST',actor:who,json:async()=>body});
    return{status:res.status,body:await res.json()};
  };
  return{objects,blobs,events,invoke,setGate:fn=>{publicationGate=fn}};
}
const publishBody=id=>({action:'publish',storageKey:stage,creatorProfileId:creator,
  visibility:'public',title:'Source-only QA',idempotencyKey:id});
test('R18-work WEP post-fix discard of unregistered published object cannot race delayed DB publication',async()=>{
  const h=harness(),id='qa-postfix-discard';
  const key=await published(id),start=deferred(),done=deferred();
  h.setGate(async()=>{start.resolve();return done.promise});
  const ongoing=h.invoke(publishBody(id));
  await start.promise;
  assert.equal(h.objects.has(key),true);
  assert.equal(h.blobs.has(key),false);
  const discard=await h.invoke({action:'discard',storageKey:key});
  assert.equal(discard.status,409);
  assert.equal(discard.body.error,'PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED');
  assert.deepEqual(h.events.remove,[]);
  done.resolve(null);
  const finished=await ongoing;
  assert.equal(finished.status,200);
  assert.equal(h.objects.has(key),true);
  assert.equal(h.blobs.has(key),true);
  assert.equal(h.objects.has(stage),true);
  assert.equal(h.events.commit,1);
});
test('R18-work WEP post-fix compensation never deletes second committed same-key object',async()=>{
  const h=harness(),id='qa-postfix-compensation';
  const key=await published(id),start=deferred(),done=deferred();
  let index=0;
  h.setGate(async()=>{
    index++;
    if(index===1){start.resolve();return done.promise}
    return null;
  });
  const older=h.invoke(publishBody(id));
  await start.promise;
  const newer=await h.invoke(publishBody(id));
  assert.equal(newer.status,200);
  done.resolve({error:{message:'injected older failure'}});
  const failed=await older;
  assert.equal(failed.status,400);
  assert.equal(failed.body.error,'PRESET_PUBLISH_FAILED');
  assert.equal(h.blobs.has(key),true);
  assert.equal(h.objects.has(key),true);
  assert.equal(h.objects.has(stage),true);
  assert.deepEqual(h.events.remove,[]);
  assert.equal(h.events.commit,1);
  const replay=await h.invoke(publishBody(id));
  assert.equal(replay.status,200);
  assert.equal(h.events.commit,1);
});
test('R18-work WEP post-fix staging, published, foreign paths denied with zero physical removal',async()=>{
  const h=harness(),key=await published('qa-postfix-keys');
  h.objects.set(key,payload);
  for(const [who,path,status,error] of [
    [actor,stage,409,'STAGING_ARTIFACT_DISCARD_REQUIRES_RESERVATION'],
    [actor,key,409,'PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED'],
    [other,key,403,'INVALID_STORAGE_KEY'],
    [actor,'published/'+account+'/../outside.json',403,'INVALID_STORAGE_KEY']
  ]){
    const r=await h.invoke({action:'discard',storageKey:path},who);
    assert.equal(r.status,status);
    assert.equal(r.body.error,error);
  }
  assert.equal(h.objects.has(key),true);
  assert.equal(h.objects.has(stage),true);
  assert.deepEqual(h.events.remove,[]);
  assert.equal(frozenWep.length,40);
});
