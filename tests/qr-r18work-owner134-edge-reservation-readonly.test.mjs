import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const ownerHead='cb86ac1ba4601d57dbaeb6a0c3e5c59e61d0749b';
const source=readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
assert.ok(source.includes('community_preset_storage_reserve_r18'));
assert.ok(source.includes('community_preset_storage_recovery_r18'));
assert.ok(source.includes('community_preset_storage_cleanup_preflight_r18'));
const script=ts.transpileModule(source.replace(/^import[^\n]+\n/gm,''),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__qrEdge = {');
const owner='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const foreignAccount='44444444-4444-4444-8444-444444444444';
const creator='55555555-5555-4555-8555-555555555555';
const reservationId='66666666-6666-4666-8666-666666666666';
const staging='staging/'+owner+'/77777777-7777-4777-8777-777777777777.json';
const scene={schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
  bounds:{w:2,h:2},originPolicy:'capture-region-top-left',
  objects:[{artifactObjectId:'o1',itemId:123,localX:0,localY:0,orientation:0,
    footprint:[{x:0,y:0}],dependencyIds:[]}]};
const bytes=new TextEncoder().encode(JSON.stringify(scene));
const digest=async v=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  typeof v==='string'?new TextEncoder().encode(v):v)),b=>b.toString(16).padStart(2,'0')).join('');
async function harness(options={}){
  const calls={rpc:[],downloads:[],copies:[],removes:[],signed:[]};
  const stored=new Map([[staging,options.badBytes??bytes]]);
  const expectedPublished='published/'+owner+'/'+await digest(owner+':reused-key')+'.json';
  const storage={
    download:async key=>{
      calls.downloads.push(key);
      return stored.has(key)?{data:new Blob([stored.get(key)]),error:null}:{data:null,error:{message:'not found'}};
    },
    copy:async(...args)=>{calls.copies.push(args);throw Error('UNAUTHORIZED_STORAGE_COPY')},
    remove:async(...args)=>{calls.removes.push(args);throw Error('UNAUTHORIZED_PHYSICAL_REMOVE')},
    createSignedUrl:async(...args)=>{calls.signed.push(args);throw Error('UNAUTHORIZED_SIGNED_DOWNLOAD')}
  };
  const admin={
    storage:{from:()=>storage},
    from:()=>{throw Error('UNEXPECTED_DATA_API_CALL')},
    rpc:async(name,args)=>{
      calls.rpc.push({name,args:structuredClone(args)});
      if(name==='community_authorize_session'){
        if(options.sessionError)return{data:null,error:{message:'invalid session'}};
        return{data:{accountId:args.p_auth_subject===actor?owner:foreignAccount},error:null};
      }
      if(name==='community_preset_storage_reserve_r18'){
        if(options.reserveError)return{data:null,error:{message:options.reserveError}};
        return{data:{
          contract:'ddv.preset-storage-reservation@r18-work',
          reservationId,reservationState:'RESERVED',stateVersion:1,
          publishedStorageKey:options.wrongPublished?'published/'+owner+'/other.json':expectedPublished,
          realPublishedObjectBytesVerified:false,publicationCommitAuthorized:false,
          physicalCleanupAuthorized:false
        },error:null};
      }
      if(name==='community_preset_storage_cleanup_preflight_r18'){
        if(options.cleanupError)return{data:null,error:{message:'R18_PRESET_CLEANUP_FORBIDDEN'}};
        return{data:{cleanupAuthorized:false,physicalDeleteAuthorized:false},error:null};
      }
      if(name==='community_preset_storage_recovery_r18'){
        if(options.recoveryError)return{data:null,error:{message:'R18_PRESET_RESERVATION_STALE'}};
        return{data:{reservationId,reservationState:'FAILED_RECOVERABLE',stateVersion:2,
          publicationCommitAuthorized:false,physicalCleanupAuthorized:false},error:null};
      }
      throw Error('UNEXPECTED_RPC '+name);
    }
  };
  const env={__qrEdge:null,Response,Blob,TextEncoder,TextDecoder,crypto:webcrypto,
    corsHeaders:{'Access-Control-Allow-Origin':'*'},
    resolveRuntimeWepPresetArtifactBucket:()=> 'qa-isolated',
    withSupabase:(config,handler)=>{
      assert.equal(config.auth,'user');
      return req=>handler(req,{
        userClaims:req.forgetActor?{}:{id:req.actor??actor},
        jwtClaims:{iat:req.badIssuedAt?0:1761436800},supabaseAdmin:admin
      });
    }
  };
  vm.runInNewContext(script,env,{filename:'owner134-preset-edge-actual-source.js'});
  return{
    calls,expectedPublished,stored,
    invoke:async(body,opts={})=>{
      const response=await env.__qrEdge.fetch({
        method:opts.method??'POST',
        actor:opts.actor,forgetActor:opts.forgetActor,badIssuedAt:opts.badIssuedAt,
        json:async()=>body
      });
      return{status:response.status,body:await response.json(),
        cache:response.headers.get('Cache-Control')};
    }
  };
}
const reserveBody=()=>({action:'reservePublication',storageKey:staging,
  creatorProfileId:creator,idempotencyKey:'reused-key',visibility:'public',
  title:'QA Synthetic',description:'read-only contract',metadata:{category:'scene'}});
function noMutation(h){
  assert.deepEqual(h.calls.copies,[]);
  assert.deepEqual(h.calls.removes,[]);
  assert.deepEqual(h.calls.signed,[]);
  assert.equal(h.calls.rpc.some(x=>x.name==='community_publish_preset_envelope'),false);
}
test('R18-work Source134 real Edge reserve: authenticated actor, staging bytes SHA and deterministic key, no positive rights',async()=>{
  const h=await harness();
  const result=await h.invoke({...reserveBody(),p_auth_subject:other,accountId:foreignAccount});
  assert.equal(result.status,200);
  assert.equal(result.cache,'private, no-store');
  assert.equal(result.body.ok,true);
  assert.equal(result.body.publicationAuthorized,false);
  assert.equal(result.body.cleanupAuthorized,false);
  assert.equal(result.body.reservation.publishedStorageKey,h.expectedPublished);
  assert.equal(h.calls.downloads.length,1);
  assert.deepEqual(h.calls.rpc.map(x=>x.name),[
    'community_authorize_session','community_preset_storage_reserve_r18']);
  const args=h.calls.rpc[1].args;
  assert.equal(args.p_auth_subject,actor);
  assert.equal(args.p_creator_profile_id,creator);
  assert.equal(args.p_source_staging_key,staging);
  assert.equal(args.p_idempotency_key,'reused-key');
  assert.equal(args.p_schema_version,1);
  assert.equal(args.p_preset_type,'scene');
  assert.equal(args.p_byte_size,bytes.byteLength);
  assert.equal(args.p_checksum_sha256,await digest(bytes));
  assert.match(args.p_request_hash,/^[0-9a-f]{64}$/);
  noMutation(h);
});
test('R18-work Source134 authentic different account cannot reserve original owner staging key',async()=>{
  const h=await harness();
  const r=await h.invoke(reserveBody(),{actor:other});
  assert.equal(r.status,409);
  assert.equal(r.body.error,'PRESET_RESERVATION_STAGING_NOT_VERIFIED');
  assert.equal(h.calls.rpc.some(x=>x.name==='community_preset_storage_reserve_r18'),false);
  noMutation(h);
});
test('R18-work Source134 invalid bytes fail BEFORE reservation and keep staging',async()=>{
  const h=await harness({badBytes:new TextEncoder().encode('{"bad":true}')});
  const r=await h.invoke(reserveBody());
  assert.equal(r.status,409);
  assert.equal(r.body.error,'PRESET_RESERVATION_STAGING_NOT_VERIFIED');
  assert.ok(h.stored.has(staging));
  assert.equal(h.calls.rpc.some(x=>x.name==='community_preset_storage_reserve_r18'),false);
  noMutation(h);
});
test('R18-work Source134 denial of wrong published key server response (collision/mismatch) no publish rights',async()=>{
  const h=await harness({wrongPublished:true});
  const r=await h.invoke(reserveBody());
  assert.equal(r.status,409);
  assert.equal(r.body.error,'PRESET_RESERVATION_DENIED');
  noMutation(h);
});
test('R18-work Source134 DB Privacy/Creator/Idempotency error remains terminal 409 and no physical compensation',async()=>{
  for(const reason of ['R18_PRESET_RESERVATION_ACTOR_INACTIVE','R18_PRESET_RESERVATION_CREATOR_FORBIDDEN',
    'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT']){
    const h=await harness({reserveError:reason});
    const r=await h.invoke(reserveBody());
    assert.equal(r.status,409);
    assert.equal(r.body.error,'PRESET_RESERVATION_DENIED');
    noMutation(h);
  }
});
test('R18-work Source134 old publish fails before Storage.copy, registration, download and physical removal',async()=>{
  const h=await harness();
  const r=await h.invoke({...reserveBody(),action:'publish'});
  assert.equal(r.status,409);
  assert.equal(r.body.error,'R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED');
  assert.equal(r.body.publicationAuthorized,false);
  assert.equal(r.body.cleanupAuthorized,false);
  assert.equal(h.calls.downloads.length,0);
  assert.deepEqual(h.calls.rpc.map(x=>x.name),['community_authorize_session']);
  noMutation(h);
});
test('R18-work Source134 published/staging Discard only performs cleanup preflight, no Storage.remove',async()=>{
  const h=await harness();
  for(const storageKey of [staging,h.expectedPublished]){
    const r=await h.invoke({action:'discard',storageKey});
    assert.equal(r.status,409);
    assert.equal(r.body.error,'PRESET_STORAGE_CLEANUP_NOT_AUTHORIZED');
    assert.equal(r.body.cleanupPreflight.physicalDeleteAuthorized,false);
  }
  const lookups=h.calls.rpc.filter(x=>x.name==='community_preset_storage_cleanup_preflight_r18');
  assert.deepEqual(lookups.map(x=>x.args.p_storage_key),[staging,h.expectedPublished]);
  assert.ok(lookups.every(x=>x.args.p_auth_subject===actor));
  noMutation(h);
});
test('R18-work Source134 cross-owner Cleanup SQL refusal results 403/no physical delete',async()=>{
  const h=await harness({cleanupError:true});
  const r=await h.invoke({action:'discard',storageKey:h.expectedPublished},{actor:other});
  assert.equal(r.status,403);
  assert.equal(r.body.error,'PRESET_STORAGE_DISCARD_FORBIDDEN');
  noMutation(h);
});
test('R18-work Source134 Recovery stays state-only, CAS forwarded without caller auth subject override',async()=>{
  const h=await harness();
  const r=await h.invoke({action:'recoverPublication',reservationId,expectedVersion:1,
    failureCode:'SQL_FAILED',p_auth_subject:other});
  assert.equal(r.status,200);
  assert.equal(r.body.publicationAuthorized,false);
  assert.equal(r.body.cleanupAuthorized,false);
  assert.equal(r.body.reservation.reservationState,'FAILED_RECOVERABLE');
  const call=h.calls.rpc.find(x=>x.name==='community_preset_storage_recovery_r18');
  assert.deepEqual(call.args,{p_auth_subject:actor,p_reservation_id:reservationId,
    p_expected_version:1,p_failure_code:'SQL_FAILED'});
  noMutation(h);
});
test('R18-work Source134 stale Recovery, invalid CAS/version/reason all deny without Storage.delete',async()=>{
  for(const input of [
    {action:'recoverPublication',reservationId,expectedVersion:0,failureCode:'SQL_FAILED'},
    {action:'recoverPublication',reservationId,expectedVersion:1,failureCode:'invalid lowercase'},
    {action:'recoverPublication',reservationId:'invalid',expectedVersion:1,failureCode:'SQL_FAILED'}
  ]){
    const h=await harness();
    const r=await h.invoke(input);
    assert.equal(r.status,400);
    assert.equal(r.body.error,'PRESET_RECOVERY_INPUT_INVALID');
    noMutation(h);
  }
  const h=await harness({recoveryError:true});
  const r=await h.invoke({action:'recoverPublication',reservationId,expectedVersion:1,failureCode:'SQL_FAILED'});
  assert.equal(r.status,409);
  assert.equal(r.body.error,'PRESET_RECOVERY_DENIED');
  noMutation(h);
});
test('R18-work Source134 revoked JWT session/bad claims deny all three routes before reservation/storage',async()=>{
  for(const options of [
    {harness:{sessionError:true}},
    {invoke:{forgetActor:true}},
    {invoke:{badIssuedAt:true}}
  ]){
    const h=await harness(options.harness??{});
    const r=await h.invoke(reserveBody(),options.invoke??{});
    assert.equal(r.status,401);
    assert.equal(h.calls.downloads.length,0);
    assert.equal(h.calls.rpc.some(x=>x.name==='community_preset_storage_reserve_r18'),false);
    noMutation(h);
  }
});
assert.equal(ownerHead.length,40);
