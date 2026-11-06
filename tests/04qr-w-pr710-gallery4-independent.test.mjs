// 04 QR-W independent NEW_ONLY scope on 08 WEB Source PR710 ffdf: root4 routing only.
// No real Gallery Work, DreamSnaps submission, voter identity or private Account fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 STAGE1_GALLERY_PRODUCTS,STAGE1_GALLERY_CONTRACT,
 STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,
 stage1GalleryCopy,stage1GalleryPublicResults,stage1GalleryKindAllowed
} from '../src/lib/community/gallery-stage1-root.mjs';
import {DREAMSNAPS_STAGE1_DESTINATIONS} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const SOURCE='ffdf64aedacf7de03995ef8a388596be8452b8ef';
const PARENT='59e374d0bee4429fb8e72602b8b18ba2aeea0d66';
const sourceBlobs=new Map([
 ['.github/workflows/web-stage1-gallery-ux.yml','3b4c040d5501a8e653137c38985ed0e50272a3a3'],
 ['scripts/web-stage1-gallery-chrome.mjs','cee0f4d2d29cc300732136b8603f1a30f45414a0'],
 ['src/lib/community/gallery-stage1-root.mjs','cdb708a594079518af02cfb5bd266d846283fe49'],
 ['src/routes/gallery/+page.svelte','0577287bb777bfbefaabb376de700e2b16bd7934'],
 ['tests/web-stage1-gallery-root.test.mjs','a18f2bcde101cbd0a648841eb3bbacfcd8f84990']
]);
const qaFiles=[
 '.github/workflows/04qr-w-pr710-gallery4-independent.yml',
 'scripts/04qr-w-pr710-gallery4-chrome.mjs',
 'tests/04qr-w-pr710-gallery4-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const delta=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const route=readFileSync(new URL('../src/routes/gallery/+page.svelte',import.meta.url),'utf8');
const dream=readFileSync(new URL('../src/routes/dreamsnaps/+page.svelte',import.meta.url),'utf8');

test('Q710-01 original five Source Git blobs immutable; only three QA-only files added',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(delta(PARENT,SOURCE),[...sourceBlobs.keys()].sort());
 for(const [path,blob] of sourceBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+path),blob,'pinned Source '+path);
  assert.equal(git('hash-object',path),blob,'unchanged Source '+path);
 }
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(delta(SOURCE,'HEAD'),qaFiles);
});

test('Q710-02 four immutable root identities, DreamSnaps navigation only, never mixed Gallery domain',()=>{
 assert.equal(STAGE1_GALLERY_CONTRACT,'wand.gallery.stage1-root@2');
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS.map(x=>x.id),['decorations','touchOfMagic','myGallery','dreamsnaps']);
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS[0].kinds,['outdoor','indoor']);
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS[1].kinds,['tom_furniture','tom_clothing']);
 assert.equal(STAGE1_GALLERY_PRODUCTS[2].href,'/gallery/my/');
 assert.equal(STAGE1_GALLERY_PRODUCTS[3].href,'/dreamsnaps/');
 assert.equal('kinds' in STAGE1_GALLERY_PRODUCTS[3],false);
 assert.equal(Object.isFrozen(STAGE1_GALLERY_PRODUCTS),true);
 assert.ok(STAGE1_GALLERY_PRODUCTS.every(Object.isFrozen));
 assert.equal(stage1GalleryKindAllowed('dreamsnaps','outdoor'),false);
 assert.equal(stage1GalleryKindAllowed('dreamsnaps','dreamsnaps'),false);
 assert.equal(STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,false);
 assert.equal(STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,false);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),['community','submit','judge','results','my']);
});

test('Q710-03 hostile mixed Gallery results including pending private DreamSnaps never appear in DreamSnaps Gallery public results',()=>{
 const pending={work_id:'pending-submission',facets:{galleryKind:'dreamsnaps'},submissionStatus:'during-voting',privateResult:{rank:1}};
 const mixed=[{work_id:'dec-1',facets:{galleryKind:'outdoor'}},pending,{work_id:'tom-1',facets:{galleryKind:'tom_clothing'}},
  {work_id:'opaque',facets:{}}, {work_id:'undef'},null,0,false,{work_id:'fake',facets:{galleryKind:'outdoor '}},
  {work_id:'results',facets:{galleryKind:'official_result'}}];
 for(const category of ['dreamsnaps','DREAMSNAPS','/gallery/dreamsnaps','myGallery','results',null,'']){
  for(const filter of ['all','outdoor','dreamsnaps',undefined]){
   assert.deepEqual(stage1GalleryPublicResults(category,mixed,filter),[],String(category)+':'+String(filter));
  }
 }
 assert.deepEqual(stage1GalleryPublicResults('decorations',mixed).map(x=>x.work_id),['dec-1']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',mixed).map(x=>x.work_id),['tom-1']);
 assert.deepEqual(stage1GalleryPublicResults('decorations',mixed,'indoor'),[]);
 assert.deepEqual(stage1GalleryPublicResults('decorations',mixed,'outdoor').map(x=>x.work_id),['dec-1']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',mixed,'tom_clothing').map(x=>x.work_id),['tom-1']);
 for(const source of [null,{},'private',true,undefined])assert.deepEqual(stage1GalleryPublicResults('dreamsnaps',source),[]);
});

test('Q710-04 Gallery root only navigation, never legacy DreamSnaps public RPC or media/rights publish',()=>{
 assert.match(route,/data-stage1-gallery-root data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified"/);
 assert.match(route,/data-dreamsnaps-routing="independent" data-dreamsnaps-media="off"/);
 assert.match(route,/href=\{base\+card\.href\}/);
 assert.match(route,/data-stage1-gallery-hub/);
 assert.match(route,/function chooseCategory\(id:'decorations'\|'touchOfMagic'\)/);
 assert.match(route,/if \(workId\) void openWork\(workId\)/);
 for(const forbidden of [
  /community_search_gallery_dreamsnaps_public_v1/,
  /community_get_gallery_dreamsnap_public_v1/,
  /\/gallery\/dreamsnaps\/.*href=/,
  /uploadAndFinalizeImage|publishGallery|createGalleryWork|createPublicWork|saveSubmittedImage|officialResult|voteForSubmission/,
  /<img[\s>]|<video[\s>]|<source[\s>]/
 ])assert.doesNotMatch(route,forbidden);
 assert.match(dream,/data-stage1-dreamsnaps-root="1-3-1"/);
 assert.match(dream,/data-public-provider="off" data-writer="off" data-private-results="off" data-media-rights="unverified"/);
 assert.doesNotMatch(dream,/<img[\s>]|<video[\s>]/);
});

test('Q710-05 eight localized boundaries are not claims of public voting or official account-wide results',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 const vals=locales.map(l=>{
  const c=stage1GalleryCopy(l);
  assert.equal(typeof c.dreamsnaps,'string',l);
  assert.ok(c.dreamsnaps.trim().length>=8,l);
  assert.equal(typeof c.dreamsnapsBoundary,'string',l);
  assert.ok(c.dreamsnapsBoundary.length>=32,l);
  assert.ok(c.decorations.trim()&&c.tom.trim()&&c.mine.trim(),l);
  assert.ok(c.back.trim()&&c.outdoor.trim()&&c.clothing.trim(),l);
  assert.ok(!/^\s*$/.test(c.dreamsnapsBoundary));
  return c.dreamsnapsBoundary;
 });
 assert.equal(new Set(vals).size,8);
});

test('Q710-06 no synthesized private Entity or public media during static Gallery noindex gate',()=>{
 const head=route.slice(route.indexOf('<svelte:head>'),route.indexOf('</svelte:head>')+14);
 assert.match(head,/<title>/);
 assert.doesNotMatch(route,/createPublicWork|providerSignedMediaUrl|serverGeneratedPublicSubmission|setContext\(['"]privateResult/);
 assert.match(route,/workType: 'gallery'/);
 assert.match(route,/searchPublicWorks/);
 assert.match(route,/callPublicCommunityRpc\('community_get_gallery_public_v1'/);
 assert.match(route,/if \(!client\) return;/);
 assert.match(route,/@media\(max-width:520px\)/);
 assert.match(route,/\.gallery-hub-card:focus-visible/);
 // Static Gallery root is public navigation, not approval to index unverified Entity content.
 assert.doesNotMatch(route,/itemIdFromPath|personalCreatorPublishedTrue|indexPrivateWork/);
});