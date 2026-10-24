import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requireGalleryEdgeMedia,requireNonGalleryLegacyMedia,temporaryUploadExpiry,
 classifyGalleryMediaFailure} from '../src/lib/community/public-media.js';
import {parseGalleryRetirementPreflight} from '../src/lib/community/gallery-preflight.js';
import {galleryStage1Catalogs} from '../src/lib/i18n/messages/community/gallery-stage1.js';
const id='11111111-1111-4111-8111-111111111111', work='22222222-2222-4222-8222-222222222222';
const base='https://gallery-lookup-browser.invalid';
const proxy={mediaId:id,transport:'edge_proxy',streamUrl:`${base}/functions/v1/community-public-media?mediaId=${id}`,
 rawStorageSignedUrlIssued:false,mimeType:'image/png',byteSize:1024,width:400,height:300};
const legacy={mediaId:id,signedUrl:'https://cdn.example.test/storage/v1/object/sign/dreamsnaps?id=1',mimeType:'image/jpeg',width:400,height:300};
const parsed={contract:'ddv.gallery-public-retirement-preflight@1',workId:work,rowVersion:2,revisionId:id,
 ownerEligible:true,graphComplete:false,dependencyCoverage:{},blockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
 cloudEntitlementVerified:false,cloudPrivateStorageVerified:false,previousSignedUrlsRevoked:false,
 cdnAndBrowserPurgeProven:false,operationAuthorized:false,deleteAuthorized:false,
 unpublishKeepPrivateAuthorized:false};
const check=(m)=>requireGalleryEdgeMedia(m,id,base);
test('Gallery streamUrl exact Edge origin/path/uuid with MIME and dimensions',()=>{
  assert.equal(check(proxy).transport,'edge_proxy');
  assert.equal(check(proxy).streamUrl,proxy.streamUrl);
  for(const changes of [
    {signedUrl:legacy.signedUrl},{transport:'legacy_signed'},
    {mediaId:work},{rawStorageSignedUrlIssued:true},
    {streamUrl:`${base}/storage/v1/object/sign/media?mediaId=${id}`},
    {streamUrl:`https://evil.example/functions/v1/community-public-media?mediaId=${id}`},
    {streamUrl:`${base}/functions/v1/community-public-media?mediaId=${work}`},
    {streamUrl:`${base}/functions/v1/community-public-media?mediaId=${id}&token=leak`},
    {mimeType:'text/html'},{byteSize:20971521},{width:-1}
  ])assert.throws(()=>check({...proxy,...changes}));
});
test('DreamSnaps legacy signed URL is preserved but never Gallery fallback',()=>{
  assert.equal(requireNonGalleryLegacyMedia(legacy,id).signedUrl,legacy.signedUrl);
  assert.throws(()=>requireNonGalleryLegacyMedia(proxy,id));
  assert.throws(()=>check(legacy));
  assert.throws(()=>requireNonGalleryLegacyMedia({...legacy,signedUrl:'javascript:alert(1)'},id));
});
test('Gallery failure classification never produces raw signed URL fallback',()=>{
  for(const [status,type] of [[403,'forbidden'],[404,'missing_or_revoked'],[503,'unavailable'],[0,'unavailable']])
    assert.equal(classifyGalleryMediaFailure({status}),type);
  const browser=readFileSync(new URL('../src/lib/community/browser-client.ts',import.meta.url),'utf8');
  assert.match(browser,/getGalleryPublicMedia/);
  assert.match(browser,/requireGalleryEdgeMedia/);
  assert.match(browser,/requireNonGalleryLegacyMedia/);
  assert.doesNotMatch(browser,/createSignedUrl|storage\\.from/);
});
test('Owner preflight validates work, revision/version, but cannot authorize retirement',()=>{
  const value=parseGalleryRetirementPreflight(parsed,work);
  assert.equal(value.rowVersion,2);
  assert.equal(value.deleteEnabled,false);
  assert.equal(value.keepPrivateEnabled,false);
  assert.equal(value.restoreEnabled,false);
  for(const x of [{...parsed,workId:id},{...parsed,ownerEligible:false},
    {...parsed,rowVersion:'2'},{...parsed,revisionId:'bad'},
    {...parsed,blockedReasons:'none'}])
    assert.throws(()=>parseGalleryRetirementPreflight(x,work));
  const my=readFileSync(new URL('../src/routes/gallery/my/+page.svelte',import.meta.url),'utf8');
  assert.match(my,/client.query\('galleryRetirementPreflight',\{workId\}\)/);
  assert.match(my,/if\(!client\?\.session\|\|!ownerDetail\?\.isOwner/);
  for(const key of ['publishUpdate','deleteWork','unpublish'])assert.ok(my.includes(`disabled aria-disabled="true">{t('galleryv1.${key}'`));
  assert.doesNotMatch(my,/deleteGalleryPhoto|unpublishKeepPrivate|client.command\('galleryAbort'/);
});
test('Temporary media retention stays inactive without server activation or expires_at',()=>{
  assert.equal(temporaryUploadExpiry({retentionActive:false,expires_at:'2026-11-01T12:00:00Z'}),null);
  assert.equal(temporaryUploadExpiry({retentionActive:true}),null);
  assert.equal(temporaryUploadExpiry({retentionActive:true,expires_at:'invalid'}),null);
  assert.equal(temporaryUploadExpiry({retentionActive:true,expires_at:'2026-11-01T12:00:00Z'}),'2026-11-01T12:00:00.000Z');
  const composer=readFileSync(new URL('../src/routes/gallery/publish/+page.svelte',import.meta.url),'utf8');
  assert.match(composer,/galleryv1.temporaryNotice/);
  assert.match(composer,/galleryv1.ownerDiscardUnavailable/);
  assert.doesNotMatch(composer,/storage.remove\(|galleryAbort\(|setInterval\(/);
  for(const locale of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
    for(const key of ['mediaUnavailable','temporaryNotice','uploadInactive','ownerDiscard',
      'expiredReupload','retirementPreflight','preflightUnavailable','disabledReasons'])
      assert.ok(galleryStage1Catalogs[locale][`galleryv1.${key}`],locale+':'+key);
  }
});
test('Only Gallery display fetches Edge proxy; no DreamSnaps transport change',()=>{
  for(const p of ['src/lib/gallery/GalleryStage1Browse.svelte','src/lib/community/GalleryDetail.svelte','src/routes/gallery/my/+page.svelte']){
    const source=readFileSync(new URL('../'+p,import.meta.url),'utf8');
    assert.match(source,/getGalleryPublicMedia/);
    assert.doesNotMatch(source,/\.signedUrl/);
  }
  const edge=readFileSync(new URL('../supabase/functions/community-public-media/index.ts',import.meta.url),'utf8');
  assert.match(edge,/community_get_public_media_storage_v2/);
});
