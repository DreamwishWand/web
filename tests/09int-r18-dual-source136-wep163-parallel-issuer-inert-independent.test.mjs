import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const pins={
 owner136:'a5bb6d24166eed66fc895447029c75b8014b81ec',
 wep163:'45963f55c1f53e5d2d8d08996098d0039be6fcfb'
};
const account='00000000-0000-4000-8000-000000000001';
const actor='00000000-0000-4000-8000-000000000002';
const creator='00000000-0000-4000-8000-000000000003';
const artifact='00000000-0000-4000-8000-000000000004';
const staging='staging/'+account+'/00000000-0000-4000-8000-000000000005.json';
const published='published/'+account+'/'+'a'.repeat(64)+'.json';
function signal(){let done;return {promise:new Promise(r=>done=r),done:()=>done()};}
function harness(){
 const actions=[],until=signal(),pending=signal();let authCount=0;
 const admin={
  rpc:async(name,args)=>{
   actions.push(['rpc',name,args]);
   if(name!=='community_authorize_session')throw Error('POSITIVE_SQL_WRITER_NOT_FENCED');
   authCount++;
   if(authCount===2)until.done();
   await pending.promise;
   return {data:{accountId:account},error:null};
  },
  from:table=>{
   actions.push(['from',table]);
   if(table!=='creator_profiles')throw Error('POSITIVE_TABLE_ACCESS_NOT_FENCED');
   const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{owner_account_id:account},error:null})};
   return q;
  },
  storage:{from:()=>{
   actions.push(['storage-access']);
   throw Error('STORAGE_COPY_REMOVE_SIGNING_NOT_AUTHORIZED');
  }}
 };
 function build(src){
  const out=ts.transpileModule(src.replace(/^import[^\n]+\n/gm,''),{
   compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText.replace(/\bexport default\s*\{/m,'__handler={');
  const box={
   __handler:null,Response,Blob,TextEncoder,TextDecoder,crypto,
   corsHeaders:{'Access-Control-Allow-Origin':'*'},
   withSupabase:(options,fn)=>{
    assert.equal(options.auth,'user');
    return req=>fn(req,{supabaseAdmin:admin,
     userClaims:{id:actor},jwtClaims:{iat:1761436800,session_id:'abc'}});
   }
  };
  vm.runInNewContext(out,box);
  assert.ok(box.__handler?.fetch);
  return box.__handler;
 }
 const current=build(fs.readFileSync(new URL('../supabase/functions/wep-scene-preset-product/index.ts',import.meta.url),'utf8'));
 const wep=build(fs.readFileSync(new URL('./fixtures/09int-r18-wep163-source135-scene-product-inert.ts.txt',import.meta.url),'utf8'));
 async function send(handler,body){
  const resp=await handler.fetch({method:'POST',json:async()=>body,headers:{get:()=>null}});
  return {status:resp.status,data:await resp.json()};
 }
 return {current,wep,send,until,pending,actions,
  verify:caseId=>{
   const storage=actions.filter(a=>a[0]==='storage-access');
   const issue=actions.filter(a=>a[0]==='rpc' && a[1]!=='community_authorize_session');
   assert.equal(storage.length,0);assert.equal(issue.length,0);
   console.log(JSON.stringify({case:caseId,pins,actualOwnerEdge:true,actualWepEdge:true,
    SQL:'mock session/creator',storage:'instrumented mock never called',
    actualPostgreSQL:false,realSignedProvider:false,storageCalls:storage.length,positiveRPCs:issue.length}));
  }};
}
test('parallel Owner Source136 and distinct WEP163 scene published same-account same key never copy or remove',async()=>{
 const h=harness();
 const publishedRequest={action:'publish',storageKey:staging,creatorProfileId:creator,
  title:'Preset Title',idempotencyKey:'same',mediaIds:[artifact]};
 const a=h.send(h.current,publishedRequest),b=h.send(h.wep,publishedRequest);
 await h.until.promise;
 h.pending.done();
 const [owner,wep]=await Promise.all([a,b]);
 assert.equal(owner.status,409);
 assert.equal(owner.data.error,'R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED');
 assert.equal(wep.status,409);
 assert.equal(wep.data.error,'R18_SCENE_PRODUCT_PUBLICATION_ISSUER_NOT_ENROLLED');
 h.verify('09INT_R18_DUAL_OWNER136_WEP163_PUBLISH_PARALLEL_NO_PROVIDER_COPY_OR_SQL');
});
test('parallel Old alias cleanup/discard/compensate to Owner136 and WEP163 has no provider remove',async()=>{
 for(const [action,key] of [['discard',staging],['compensate',published]]){
  const h=harness();
  const a=h.send(h.current,{action,storageKey:key,creatorProfileId:creator});
  const b=h.send(h.wep,{action,storageKey:key,creatorProfileId:creator});
  await h.until.promise;
  h.pending.done();
  const [owner,wep]=await Promise.all([a,b]);
  assert.equal(owner.status,409);
  assert.equal(wep.status,409);
  assert.equal(owner.data.cleanupAuthorized,false);
  assert.equal(wep.data.physicalDeleteAuthorized,false);
  h.verify('09INT_R18_DUAL_OWNER136_WEP163_'+action.toUpperCase()+'_PARALLEL_NO_STORAGE_REMOVE');
 }
});
test('cross-account foreign staging key is denied in WEP163 while Owner136 remains terminal',async()=>{
 const h=harness();
 const foreign='staging/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000088.json';
 const a=h.send(h.current,{action:'publish',storageKey:foreign,creatorProfileId:creator,
   idempotencyKey:'same',title:'x'});
 const b=h.send(h.wep,{action:'publish',storageKey:foreign,creatorProfileId:creator,
   idempotencyKey:'same',title:'x'});
 await h.until.promise;
 h.pending.done();
 const [owner,wep]=await Promise.all([a,b]);
 assert.equal(owner.status,409);
 assert.equal(wep.status,403);
 assert.equal(wep.data.error,'INVALID_STORAGE_KEY');
 h.verify('09INT_R18_DUAL_OWNER136_WEP163_FOREIGN_KEY_ENFORCED');
});
