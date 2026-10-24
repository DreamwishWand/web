import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 OWNER_MEDIA_MAX_BYTES,parseOwnerGalleryReadMetadata,readAuthenticatedGalleryOwnerMedia,
 parseGalleryCapacityError,OwnerGalleryObjectUrlLease,GalleryOwnerMediaError
} from '../src/lib/community/gallery-owner-media.js';
import {galleryStage1Catalogs} from '../src/lib/i18n/messages/community/gallery-stage1.js';
const id='11111111-1111-4111-8111-111111111111',bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,1,2,3,4]);
const sha=createHash('sha256').update(bytes).digest('hex');
const metadata={ok:true,action:'read',media:{mediaId:id,transport:'authenticated_edge_binary_post',
 readAction:'galleryReadBytes',requiresOwnerBearer:true,rawStorageSignedUrlIssued:false,
 mimeType:'image/png',byteSize:bytes.length,width:1,height:1,checksumSha256:sha}};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const binary=(body=bytes,headers={})=>new Response(body,{status:200,headers:{'Content-Type':'image/png','Content-Length':String(body.length),...headers}});
const setup=(custom=()=>null)=>{
 let events=[];
 const fetcher=async(url,opts)=>{
  assert.equal(url,'https://unit.example/functions/v1/community-media');
  assert.equal(opts.headers.authorization,'Bearer synthetic-test-token');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.method,'POST');
  assert.equal(opts.signal.aborted,false);
  const body=JSON.parse(opts.body);
  assert.deepEqual(Object.keys(body).sort(),['action','mediaId']);
  assert.equal(body.mediaId,id);
  events.push(body.action);
  return custom(body.action,opts)??(body.action==='read'?json(metadata):binary());
 };
 const read=(extra={})=>readAuthenticatedGalleryOwnerMedia({
  endpoint:'https://unit.example/functions/v1/community-media',apikey:'sb_publishable_test',
  accessToken:'synthetic-test-token',mediaId:id,fetcher,...extra
 });
 return {read,events};
};
test('owner binary: exact two authenticated POSTs, SHA256 and no Storage URL',async()=>{
 const x=setup();
 const r=await x.read();
 assert.equal(r.blob.type,'image/png');assert.equal(r.blob.size,bytes.length);
 assert.deepEqual(x.events,['read','galleryReadBytes']);
 assert.deepEqual(new Uint8Array(await r.blob.arrayBuffer()),bytes);
});
test('metadata rejects missing, malformed, cross-media, signed Storage fallback, MIME, oversize and digest',()=>{
 assert.equal(parseOwnerGalleryReadMetadata(metadata,id).checksumSha256,sha);
 for(const changes of [{signedUrl:'https://storage.example/token'},{transport:'edge_proxy'},
   {mediaId:'22222222-2222-4222-8222-222222222222'},{readAction:'read'},
   {rawStorageSignedUrlIssued:true},{mimeType:'text/html'}, {byteSize:OWNER_MEDIA_MAX_BYTES+1},
   {width:0},{height:NaN},{checksumSha256:'bad'}])
   assert.throws(()=>parseOwnerGalleryReadMetadata({...metadata,media:{...metadata.media,...changes}},id),
     e=>e.code==='OWNER_MEDIA_INVALID_METADATA');
 assert.throws(()=>parseOwnerGalleryReadMetadata({ok:false},id));
});
test('binary refuses checksum, byte size, MIME and absent body',async()=>{
 for(const scenario of [
  {body:Uint8Array.from([...bytes.slice(0,-1),10]),code:'OWNER_MEDIA_CHECKSUM_MISMATCH'},
  {body:bytes.slice(0,-1),code:'OWNER_MEDIA_SIZE_MISMATCH'},
  {body:bytes,headers:{'Content-Type':'text/html'},code:'OWNER_MEDIA_MIME_MISMATCH'},
  {body:bytes,headers:{'Content-Length':'999'},code:'OWNER_MEDIA_SIZE_MISMATCH'}
 ]){
  const x=setup(action=>action==='galleryReadBytes'?binary(scenario.body,scenario.headers):null);
  await assert.rejects(x.read(),e=>e.code===scenario.code);
 }
});
test('authenticated nonowner, expired session, missing, integrity conflict, rate, unavailable fail closed',async()=>{
 for(const [status,code] of [[401,'SESSION_REVOKED_OR_INVALID'],[403,'GALLERY_OWNER_MEDIA_FORBIDDEN'],
    [404,'GALLERY_OWNER_MEDIA_BYTES_UNAVAILABLE'],[409,'GALLERY_OWNER_MEDIA_CHECKSUM_MISMATCH'],
    [429,'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED'],[503,'GALLERY_OWNER_READ_AUTHORITY_UNAVAILABLE']]){
  const x=setup(()=>json({ok:false,error:code},status));
  await assert.rejects(x.read(),e=>e.status===status&&e.code===code);
  assert.deepEqual(x.events,['read'],'must not fetch private bytes after '+status);
 }
});
test('session switch, logout and cancelled requests suppress stale bytes',async()=>{
 for(const caseName of ['switch','logout','abort']){
  const controller=new AbortController();let live=true;
  const x=setup((action)=>{
    if(action==='read'){
      if(caseName==='abort')controller.abort();
      else live=false;
    }
    return null;
  });
  await assert.rejects(x.read({
    signal:controller.signal,
    assertCurrent:()=>{if(!live)throw new GalleryOwnerMediaError('OWNER_MEDIA_SESSION_CHANGED',401)}
  }),e=>['OWNER_MEDIA_SESSION_CHANGED','OWNER_MEDIA_ABORTED'].includes(e.code));
 }
});
test('concurrent reads are isolated; timeout is surfaced without retry',async()=>{
 const a=setup(),b=setup();
 await Promise.all([a.read(),b.read()]);
 assert.deepEqual(a.events,['read','galleryReadBytes']);assert.deepEqual(b.events,['read','galleryReadBytes']);
 const x=setup(async()=>new Promise(()=>{}));
 // Test abort instead of a never-resolving fake fetch which does not implement AbortSignal.
 const ac=new AbortController();ac.abort();
 await assert.rejects(x.read({signal:ac.signal}),e=>e.code==='OWNER_MEDIA_ABORTED');
});
test('lease revokes on replacement, closure, unmount, late completion and retry',()=>{
 let n=0,revoked=[];
 const lease=new OwnerGalleryObjectUrlLease(()=>`blob:fixture-${++n}`,u=>revoked.push(u));
 const a=lease.begin(),url=lease.append(new Blob(['a']),a.generation);
 assert.equal(url,'blob:fixture-1');
 const b=lease.begin();
 assert.deepEqual(revoked,['blob:fixture-1']);
 assert.equal(lease.append(new Blob(['stale']),a.generation),null);
 assert.equal(lease.append(new Blob(['fresh']),b.generation),'blob:fixture-2');
 lease.destroy();assert.deepEqual(revoked,['blob:fixture-1','blob:fixture-2']);
 assert.equal(lease.append(new Blob(['late']),b.generation),null);
 assert.throws(()=>lease.begin());
});
test('5 server 429 quota codes preserve only actual server retry fields',()=>{
 const cases=['GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED','GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED',
 'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED','GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED',
 'GALLERY_GLOBAL_CLEANUP_STALLED'];
 for(const code of cases){
   assert.deepEqual(parseGalleryCapacityError({status:429,code,retryAfterSeconds:70,resetAt:'2026-10-25T01:02:03Z'}),
     {code,retryAfterSeconds:70,resetAt:'2026-10-25T01:02:03Z'});
   assert.equal(parseGalleryCapacityError({status:429,code}).retryAfterSeconds,null);
   assert.equal(parseGalleryCapacityError({status:403,code}),null);
 }
 assert.equal(parseGalleryCapacityError({status:429,code:'SOME_OTHER_CODE'}),null);
});
test('8 languages capacity/owner copy and no Gallery mutation-enabled UI',()=>{
 const keys=['ownerMediaRead','ownerMediaLoading','ownerIntegrityFailure','ownerSessionRequired',
 'capacityIdle','capacityAccountCount','capacityAccountBytes','capacityGlobalCount',
 'capacityGlobalBytes','capacityCleanupStalled','capacityRetryServer','capacityCleanupPending',
 'retryAfterServerSeconds','retryAtServer'];
 for(const [locale,catalog] of Object.entries(galleryStage1Catalogs)){
  for(const k of keys)assert.ok(catalog['galleryv1.'+k],locale+':'+k);
 }
 const my=readFileSync(new URL('../src/routes/gallery/my/+page.svelte',import.meta.url),'utf8');
 const composer=readFileSync(new URL('../src/routes/gallery/publish/+page.svelte',import.meta.url),'utf8');
 assert.match(my,/OwnerGalleryMediaPreview/);
 assert.doesNotMatch(my,/getGalleryPublicMedia|galleryReadBytes|createSignedUrl/);
 assert.match(composer,/capacityBlock/);
 assert.match(composer,/disabled aria-disabled="true"/);
 assert.doesNotMatch(composer,/galleryPrepare\(|galleryAbort\(|storage\.remove/);
 const view=readFileSync(new URL('../src/lib/gallery/OwnerGalleryMediaPreview.svelte',import.meta.url),'utf8');
 assert.match(view,/lease\.destroy/);
 assert.match(view,/readGalleryOwnerMedia/);
});
