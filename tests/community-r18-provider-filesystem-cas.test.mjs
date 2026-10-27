import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,mkdir,open,readFile,writeFile,unlink,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const bytes=new TextEncoder().encode('{"schema":"dreamwish-wand-preset","type":"scene","objects":[{"itemId":1}]}');
const digest=async v=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',v)),x=>x.toString(16).padStart(2,'0')).join('');
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/preset-conditional-provider-r18.ts',import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(code,{exports,crypto:webcrypto,Uint8Array,Promise});
const {inspectConditionalPromotion,inspectPostCommitObject}=exports;
const account='11111111-1111-4111-8111-111111111111',sk='staging/'+account+'/file.json';
const pk='published/'+account+'/'+'e'.repeat(64)+'.json';

class ExclusiveFilesystemProvider {
 constructor(root){this.root=root;this.versions=new Map([[sk,{version:'staging-generation-1',etag:'src-etag'}]]);
  this.capabilities={createIfAbsentAtomic:true,immutableVersionRead:true,conditionalSourceVersion:true};
  this.copyCalls=0;this.physicalDeletesByWriter=0;
 }
 full(key){return path.join(this.root,...key.split('/'));}
 async readVersion(key,expected){
  const meta=this.versions.get(key);
  if(!meta || expected && meta.version!==expected)return null;
  try{return {bytes:new Uint8Array(await readFile(this.full(key))),version:meta.version,etag:meta.etag};}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async copyIfAbsent(sourceKey,sourceVersion,destKey){
  this.copyCalls++;
  const from=await this.readVersion(sourceKey,sourceVersion);
  if(!from)throw Error('STALE_SOURCE_VERSION');
  const dst=this.full(destKey);
  await mkdir(path.dirname(dst),{recursive:true});
  let fd;
  try{fd=await open(dst,'wx');}
  catch(e){if(e.code==='EEXIST')return {created:false,version:'',etag:''};throw e;}
  try{await fd.writeFile(from.bytes);}
  finally{await fd.close();}
  const version='fs-created-only-generation-1';
  const etag='fs-local-content-hash-'+(await digest(from.bytes));
  this.versions.set(destKey,{version,etag});
  return {created:true,version,etag};
 }
}

test('Source137 real local filesystem O_EXCL creates exactly one immutable winner across both Publisher aliases',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'ddvre-provider-'));
 try{
  await mkdir(path.dirname(path.join(temp,...sk.split('/'))),{recursive:true});
  await writeFile(path.join(temp,...sk.split('/')),bytes,{flag:'wx'});
  const provider=new ExclusiveFilesystemProvider(temp);
  const fence={reservationId:'same-reservation',ownerAccountId:account,creatorProfileId:'creator',
   idempotencyKey:'same-idempotency',requestHash:'d'.repeat(64),leaseToken:'lease',
   leaseFence:1n,stateVersion:2n,stagingKey:sk,publishedKey:pk,
   stagingVersion:'staging-generation-1',byteSize:bytes.byteLength,checksumSha256:await digest(bytes)};
  const [generic,scene]=await Promise.all([
   inspectConditionalPromotion(provider,fence,async()=>true),
   inspectConditionalPromotion(provider,fence,async()=>true)
  ]);
  assert.deepEqual([generic.state,scene.state].sort(),
    ['COPY_OBSERVED_UNATTESTED','DESTINATION_CONFLICT'].sort());
  const observed=generic.state==='COPY_OBSERVED_UNATTESTED'?generic:scene;
  assert.equal((await digest(await readFile(provider.full(pk)))),fence.checksumSha256);
  assert.equal(observed.publicationAuthorized,false);
  assert.equal(provider.physicalDeletesByWriter,0);
  const expected={publishedKey:pk,objectVersion:observed.objectVersion,
   etag:observed.objectETag,checksumSha256:fence.checksumSha256,byteSize:fence.byteSize};
  assert.equal((await inspectPostCommitObject(provider,expected)).state,'PUBLISHED_OBJECT_OBSERVED_UNATTESTED');
  await unlink(provider.full(pk)); // EXTERNAL loss injected by test only
  const post=await inspectPostCommitObject(provider,expected);
  assert.equal(post.state,'POST_COMMIT_MISSING');
  assert.equal(post.physicalCleanupAuthorized,false);
  assert.equal(post.providerOriginAttested,false);
  console.log('R18_SOURCE137_LOCAL_FILESYSTEM_EXCLUSIVE_CREATE_WINNER_PRESERVED_AND_POSTCOMMIT_QUARANTINE');
 }finally{await rm(temp,{recursive:true,force:true});}
});
