import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const source = readFileSync(new URL('../supabase/functions/_shared/preset-conditional-provider-r18.ts',import.meta.url),'utf8');
const transpiled = ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const exports={};
vm.runInNewContext(transpiled,{exports,crypto:webcrypto,Uint8Array,Promise},{filename:'conditional-provider-source.js'});
const {inspectConditionalPromotion,inspectPostCommitObject}=exports;
const owner='11111111-1111-4111-8111-111111111111';
const staging='staging/'+owner+'/22222222-2222-4222-8222-222222222222.json';
const published='published/'+owner+'/'+'f'.repeat(64)+'.json';
const bytes=new TextEncoder().encode('{"schema":"dreamwish-wand-preset","type":"scene"}');
const digest=async b=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');

class LocalCAS {
 constructor(){
  this.objects=new Map([[staging,{bytes,version:'source-v1',etag:'staging-etag'}]]);
  this.capabilities={createIfAbsentAtomic:true,immutableVersionRead:true,conditionalSourceVersion:true};
  this.calls={reads:0,copies:0,removes:0};
  this.throwAfterCopy=false;
  this.tamperDestination=false;
 }
 async readVersion(key,version){
  this.calls.reads++;
  const v=this.objects.get(key);
  return !v || (version && version!==v.version) ? null : v;
 }
 async copyIfAbsent(sourceKey,sourceVersion,dest){
  this.calls.copies++;
  const src=this.objects.get(sourceKey);
  if(!src || src.version!==sourceVersion)throw Error('SOURCE_VERSION_CONFLICT');
  if(this.objects.has(dest))return {created:false,version:'',etag:''};
  const object={bytes:this.tamperDestination?new TextEncoder().encode('wrong'):src.bytes,
    version:'published-generation-1',etag:'published-etag-1'};
  this.objects.set(dest,object);
  if(this.throwAfterCopy)throw Error('NETWORK_RESPONSE_LOST_AFTER_PROVIDER_SUCCESS');
  return {created:true,version:object.version,etag:object.etag};
 }
}
async function harness(provider=new LocalCAS(),lease=async()=>true){
 const f={reservationId:'r1',ownerAccountId:owner,creatorProfileId:'c1',
  idempotencyKey:'same-idempotency',requestHash:'a'.repeat(64),
  leaseToken:'token',leaseFence:1n,stateVersion:2n,stagingKey:staging,
  publishedKey:published,stagingVersion:'source-v1',byteSize:bytes.byteLength,
  checksumSha256:await digest(bytes)};
 return {provider,f,run:()=>inspectConditionalPromotion(provider,f,lease)};
}
test('Source137 provider adapter hard-requires authoritative conditional-copy capabilities',async()=>{
 for(const missing of ['createIfAbsentAtomic','immutableVersionRead','conditionalSourceVersion']){
  const h=await harness();
  h.provider.capabilities[missing]=false;
  const r=await h.run();
  assert.equal(r.state,'CAPABILITY_BLOCKED');
  assert.equal(r.publicationAuthorized,false);
  assert.equal(h.provider.calls.copies,0);
 }
});
test('Source137 immutable local provider readback produces observations, never provider attestation or SQL commit',async()=>{
 const h=await harness();
 const r=await h.run();
 assert.equal(r.state,'COPY_OBSERVED_UNATTESTED');
 assert.equal(r.downloadedSha256,h.f.checksumSha256);
 assert.equal(r.downloadedSize,h.f.byteSize);
 assert.equal(r.objectVersion,'published-generation-1');
 assert.equal(r.publicationAuthorized,false);
 assert.equal(r.physicalCleanupAuthorized,false);
 assert.equal(r.evidenceClass,'LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED');
 assert.equal(h.provider.calls.copies,1);
 assert.equal(h.provider.calls.removes,0);
});
test('Source137 Generic/Scene same key concurrent CAS permits one winner and preserves its immutable bytes',async()=>{
 const h=await harness();
 const [a,b]=await Promise.all([h.run(),h.run()]);
 assert.deepEqual([a.state,b.state].sort(),['COPY_OBSERVED_UNATTESTED','DESTINATION_CONFLICT'].sort());
 const saved=await h.provider.readVersion(published,'published-generation-1');
 assert.equal(await digest(saved.bytes),h.f.checksumSha256);
 assert.equal(h.provider.calls.copies,2);
 assert.equal(h.provider.calls.removes,0);
});
test('Source137 delayed copy with expired lease quarantines possibly-created object instead of deleting winner',async()=>{
 let checks=0;
 const h=await harness(new LocalCAS(),async()=>++checks<=2);
 const r=await h.run();
 assert.equal(r.state,'LEASE_STALE');
 assert.equal(r.copyMayHaveSucceeded,true);
 assert.equal(r.publicationAuthorized,false);
 assert.ok(h.provider.objects.has(published));
 assert.equal(h.provider.calls.removes,0);
});
test('Source137 late stale lease before copy never contacts conditional provider',async()=>{
 const h=await harness(new LocalCAS(),async()=>false);
 const r=await h.run();
 assert.equal(r.state,'LEASE_STALE');
 assert.equal(r.copyMayHaveSucceeded,false);
 assert.equal(h.provider.calls.copies,0);
});
test('Source137 response lost after successful provider copy cannot be blindly compensated or replayed',async()=>{
 const h=await harness();
 h.provider.throwAfterCopy=true;
 const r=await h.run();
 assert.equal(r.state,'COPY_OUTCOME_UNKNOWN');
 assert.equal(r.copyMayHaveSucceeded,true);
 assert.equal(h.provider.calls.removes,0);
 assert.ok(h.provider.objects.has(published));
 const retry=await h.run();
 assert.equal(retry.state,'DESTINATION_CONFLICT');
 assert.equal(h.provider.calls.removes,0);
});
test('Source137 wrong source bytes or version refuse copying and wrong destination bytes reject publication',async()=>{
 const a=await harness();
 a.provider.objects.get(staging).bytes=new TextEncoder().encode('malformed');
 assert.equal((await a.run()).state,'STAGING_MISMATCH');
 assert.equal(a.provider.calls.copies,0);
 const b=await harness();
 b.provider.tamperDestination=true;
 const r=await b.run();
 assert.equal(r.state,'VERSION_DRIFT');
 assert.equal(r.evidenceClass,'PROVIDER_OBJECT_QUARANTINED');
 assert.equal(r.publicationAuthorized,false);
 assert.equal(b.provider.calls.removes,0);
});
test('Source137 independent helper does not call legacy Generic/Scene APIs, cleanup, commit or attestation RPC',()=>{
 for(const forbidden of ['.remove(','.copy(','.rpc(','.upsert(', 'verification_evidence_state=\'PROVIDER_ATTESTED\'',
  'preset_storage_commit_candidate_r18','community_publish_preset_envelope']){
  assert.equal(source.includes(forbidden),false,forbidden);
 }
});

test('Source137 postcommit missing object is quarantined, not compensating physical remove',async()=>{
 const h=await harness();
 const first=await h.run();
 assert.equal(first.state,'COPY_OBSERVED_UNATTESTED');
 const expectation={publishedKey:published,objectVersion:first.objectVersion,etag:first.objectETag,
  checksumSha256:h.f.checksumSha256,byteSize:h.f.byteSize};
 assert.equal((await inspectPostCommitObject(h.provider,expectation)).state,
  'PUBLISHED_OBJECT_OBSERVED_UNATTESTED');
 h.provider.objects.delete(published); // injected external provider loss, not the writer
 const failure=await inspectPostCommitObject(h.provider,expectation);
 assert.equal(failure.state,'POST_COMMIT_MISSING');
 assert.equal(failure.providerOriginAttested,false);
 assert.equal(failure.physicalCleanupAuthorized,false);
 assert.equal(h.provider.calls.removes,0);
});

test('Source137 postcommit version drift is quarantined and lacks automatic repair authority',async()=>{
 const h=await harness();
 const first=await h.run();
 h.provider.objects.set(published,{bytes,version:'foreign-version',etag:'foreign-etag'});
 const r=await inspectPostCommitObject(h.provider,{publishedKey:published,
  objectVersion:first.objectVersion,etag:first.objectETag,
  checksumSha256:h.f.checksumSha256,byteSize:h.f.byteSize});
 assert.equal(r.state,'POST_COMMIT_MISSING');
 assert.equal(r.providerOriginAttested,false);
 assert.equal(r.publicationAuthorized,false);
});
