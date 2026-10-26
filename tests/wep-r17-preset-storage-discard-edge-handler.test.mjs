import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts', import.meta.url),'utf8');
const OWNER = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const CREATOR = '33333333-3333-4333-8333-333333333333';
const uuid = '44444444-4444-4444-8444-444444444444';
const other = '55555555-5555-4555-8555-555555555555';
const stagingA = `staging/${OWNER}/${uuid}.json`;
const stagingB = `staging/${OWNER}/66666666-6666-4666-8666-666666666666.json`;
const artifact = {
  schema: 'dreamwish-wand-preset',artifactVersion:1,type:'scene',
  bounds:{w:1,h:1}, originPolicy:'capture-region-top-left',
  objects:[{artifactObjectId:'o0',itemId:1001,localX:0,localY:0,
    orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[]}],
  networks:{roads:null,fences:null}
};
const artifactText = JSON.stringify(artifact);
const published = async (id='same-key') => {
  const raw = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${OWNER}:${id}`));
  const hex=Array.from(new Uint8Array(raw)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return `published/${OWNER}/${hex}.json`;
};
const rewritten = source
  .replace("import { withSupabase } from 'npm:@supabase/server';",
    'const withSupabase = (_opts,handler) => (req) => handler(req, globalThis.__wepMockContext);')
  .replace("import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';",
    'const corsHeaders = {};')
  .replace("import { resolveRuntimeWepPresetArtifactBucket } from '../_shared/wep-preset-artifact-bucket.ts';",
    "const resolveRuntimeWepPresetArtifactBucket = () => 'wep-preset-artifacts';");
assert.doesNotMatch(rewritten,/^import /m,'all Edge imports must be mocked explicitly');
const js=ts.transpileModule(rewritten,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const edge = (await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;

function mkCtx() {
  const objects = new Map([[stagingA,new Blob([artifactText],{type:'application/json'})],
    [stagingB,new Blob([artifactText],{type:'application/json'})]]);
  const calls={remove:[],copy:[],download:[],signed:[],sql:[],lookup:[]};
  const registered = new Map();
  let rpcError=null,holdNextPublish=null;
  const storage={
    async download(key){calls.download.push(key);return objects.has(key)?{data:objects.get(key),error:null}:{data:null,error:{message:'missing'}}},
    async copy(src,dst){calls.copy.push([src,dst]);if(!objects.has(src))return {error:{message:'missing'}};if(objects.has(dst))return {error:{message:'already exists'}};objects.set(dst,objects.get(src));return {error:null}},
    async remove(keys){calls.remove.push([...keys]);for(const key of keys)objects.delete(key);return {error:null}},
    async createSignedUrl(key,expiresIn){calls.signed.push([key,expiresIn]);return {data:{signedUrl:'https://signed.invalid/blob'},error:null}},
    async createSignedUploadUrl(){return {data:{token:'mock'},error:null}}
  };
  const ctx={
    userClaims:{id:ACTOR},jwtClaims:{iat:1234567890},
    supabaseAdmin:{
      storage:{from(){return storage}},
      from(table){calls.lookup.push(table);return {select(){return {eq(){return {maybeSingle:async()=>({data:null,error:null})}}}}}},
      async rpc(name,args){
        calls.sql.push([name,args]);
        if(name==='community_authorize_session')return {data:{accountId:OWNER},error:null};
        if(name==='community_publish_preset_envelope'){
          if(holdNextPublish){let fn=holdNextPublish;holdNextPublish=null;await fn();}
          if(rpcError)return {data:null,error:{message:rpcError}};
          if(registered.has(args.p_idempotency_key)){
            const existing=registered.get(args.p_idempotency_key);
            if(existing.key!==args.p_artifact_storage_key || existing.checksum!==args.p_checksum_sha256)
              return {data:null,error:{message:'Idempotency key reused with different input'}};
            return {data:existing.data,error:null};
          }
          const data={presetArtifactId:'77777777-7777-4777-8777-777777777777'};
          registered.set(args.p_idempotency_key,{
            key:args.p_artifact_storage_key,checksum:args.p_checksum_sha256,data});
          return {data,error:null};
        }
        if(name==='wep_get_accessible_preset_blob')return {
          data:{presetArtifactId:'77777777-7777-4777-8777-777777777777',
          presetRevisionId:'88888888-8888-4888-8888-888888888888',
          storageKey:registered.get('same-key')?.key??await published(),
          byteSize:artifactText.length,checksumSha256:'0'.repeat(64),
          contentType:'application/json',schemaVersion:1,presetType:'scene'},error:null
        };
        return {data:null,error:{message:'UNEXPECTED_RPC'}};
      }
    }
  };
  return {
    objects,calls,registered,ctx,
    setRpcError(value){rpcError=value},
    holdPublishUntil(fn){holdNextPublish=fn}
  };
}
async function invoke(env,action,body={},ctx=env.ctx){
  globalThis.__wepMockContext=ctx;
  const response=await edge.fetch(new Request('https://api.invalid/functions/v1/wep-preset-artifact',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}));
  return {status:response.status,data:await response.json()};
}
const pub = (key=stagingA,idempotencyKey='same-key')=>({
  storageKey:key,creatorProfileId:CREATOR,title:'Safe Scene',visibility:'public',idempotencyKey
});
test('Published physical Discard refuses with no DB lookup/remove, registered or unregistered',async()=>{
 const env=mkCtx();const key=await published();
 env.objects.set(key,new Blob([artifactText]));
 for(const state of ['uncommitted','committed']){
   if(state==='committed')env.registered.set('same-key',{key,checksum:'0'.repeat(64),data:{}});
   const response=await invoke(env,'discard',{storageKey:key});
   assert.equal(response.status,409);
   assert.equal(response.data.error,'PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED');
   assert.ok(env.objects.has(key));
 }
 assert.deepEqual(env.calls.remove,[]);
 assert.deepEqual(env.calls.lookup,[]);
});
test('Staging key Owner/path validation is preserved; destructive discard requires future reservation',async()=>{
 const env=mkCtx();
 const own=await invoke(env,'discard',{storageKey:stagingA});
 assert.equal(own.status,409);
 assert.equal(own.data.error,'STAGING_ARTIFACT_DISCARD_REQUIRES_RESERVATION');
 for(const key of [
  `staging/${other}/${uuid}.json`,
  `published/${other}/${'a'.repeat(64)}.json`,
  `staging/${OWNER}/../${uuid}.json`,
  `staging/${OWNER}/%2e%2e/${uuid}.json`,
  `staging/${OWNER}//${uuid}.json`,
  `staging/${OWNER}/${uuid}.png`,
  `staging/${OWNER}/${uuid}.json/x`,
  `staging/${OWNER}/${uuid}.json\\evil`,
  `published/${OWNER}/${uuid}.json`
 ]) {
  const r=await invoke(env,'discard',{storageKey:key});
  assert.equal(r.status,403,key);
  assert.equal(r.data.error,'INVALID_STORAGE_KEY',key);
 }
 assert.deepEqual(env.calls.remove,[]);
 assert.ok(env.objects.has(stagingA));
});
test('Copy→DB gap: concurrent discard cannot remove published or staging while commit waits',async()=>{
 const env=mkCtx();
 let allowCommit;
 const gate=new Promise(resolve=>{allowCommit=resolve});
 let copied;
 const copySeen=new Promise(resolve=>{copied=resolve});
 env.holdPublishUntil(async()=>{copied();await gate});
 const inFlight=invoke(env,'publish',pub());
 await copySeen;
 const key=await published();
 assert.ok(env.objects.has(key),'copy completed before SQL registration');
 assert.equal(env.registered.size,0,'no committed blob reference before release');
 const [publishedDiscard,stagingDiscard]=await Promise.all([
  invoke(env,'discard',{storageKey:key}),invoke(env,'discard',{storageKey:stagingA})
 ]);
 assert.equal(publishedDiscard.status,409);
 assert.equal(stagingDiscard.status,409);
 assert.ok(env.objects.has(key));
 allowCommit();
 const result=await inFlight;
 assert.equal(result.status,200);
 assert.ok(env.objects.has(env.registered.get('same-key').key));
 assert.deepEqual(env.calls.remove,[]);
});
test('Same deterministic key concurrent retry and completed replay cannot remove shared published bytes',async()=>{
 const env=mkCtx();
 const first=await invoke(env,'publish',pub(stagingA));
 const second=await invoke(env,'publish',pub(stagingB));
 assert.equal(first.status,200);
 assert.equal(second.status,200);
 assert.deepEqual(first.data.data.presetArtifactId,second.data.data.presetArtifactId);
 const key=await published();
 assert.equal(env.calls.copy.length,2);
 assert.equal(env.registered.size,1);
 assert.ok(env.objects.has(key));
 env.objects.delete(stagingA);
 env.objects.delete(stagingB);
 const replay=await invoke(env,'publish',pub(stagingA));
 assert.equal(replay.status,200);
 assert.equal(replay.data.data.presetArtifactId,first.data.data.presetArtifactId);
 assert.ok(env.objects.has(key));
 assert.deepEqual(env.calls.remove,[]);
});
test('Post-copy SQL failure preserves published object for deferred authority-driven cleanup',async()=>{
 const env=mkCtx();env.setRpcError('synthetic transactional rollback');
 const r=await invoke(env,'publish',pub());
 assert.equal(r.status,400);
 assert.equal(r.data.error,'PRESET_PUBLISH_FAILED');
 const key=await published();
 assert.ok(env.objects.has(key));
 assert.equal(env.registered.size,0);
 assert.deepEqual(env.calls.remove,[]);
 assert.ok(env.objects.has(stagingA));
});
test('Committed published bytes remain readable through existing owner/public preflight path',async()=>{
 const env=mkCtx();
 const committed=await invoke(env,'publish',pub());
 assert.equal(committed.status,200);
 const ownerRead=await invoke(env,'read',{presetArtifactId:committed.data.data.presetArtifactId});
 assert.equal(ownerRead.status,200);
 assert.equal(ownerRead.data.preset.signedUrl,'https://signed.invalid/blob');
 assert.equal(ownerRead.data.preset.expiresIn,300);
 assert.deepEqual(env.calls.remove,[]);
 assert.ok(env.objects.has(await published()));
});
test('Unauthorized JWT or missing session prevents destructive discard and publish before Storage',async()=>{
 const env=mkCtx();
 const signedIn={...env.ctx,userClaims:{id:null}};
 const response=await invoke(env,'discard',{storageKey:stagingA},signedIn);
 assert.equal(response.status,401);
 assert.deepEqual(env.calls.copy,[]);
 assert.deepEqual(env.calls.remove,[]);
});
test('Source Edge has no physical remove callsite in any action pending future Owner cleanup contract',()=>{
 assert.doesNotMatch(source,/storage\.from\(BUCKET\)\.remove\s*\(/);
 assert.doesNotMatch(source,/\.from\(['"]artifact_blobs['"]\).*\.maybeSingle\(/s);
 assert.match(source,/PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED/);
 assert.match(source,/STAGING_ARTIFACT_DISCARD_REQUIRES_RESERVATION/);
 assert.match(source,/community_publish_preset_envelope/);
 assert.match(source,/Storage\.copy|\.copy\(storageKey, publishedStorageKey\)/);
});
