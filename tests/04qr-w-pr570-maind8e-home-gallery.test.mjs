// 04 QR-W independent PR570 new-main d8e integration-risk, not duplicate Gallery 8-locale source QA528/QA571.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {STAGE1_GALLERY_PRODUCTS,STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,stage1GalleryPublicResults} from '../src/lib/community/gallery-stage1-root.mjs';
import {HOME_STAGE1_CONSUMER} from '../src/lib/ui/consumer-fixtures.js';
const MAIN='d8e67925c2417d3fc3505611ac22919bdf354e75';
const SOURCE='566f9336e36ee60fef84045b09e5fbb2cac397fb';
const OLD='1e1bae1db21a3910c38e97fbf7e90d7328538132';
const PREV_MAIN='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const ownerFiles=['.github/workflows/web-stage1-gallery-ux.yml','scripts/web-stage1-gallery-chrome.mjs','src/lib/community/gallery-stage1-root.mjs','src/routes/gallery/+page.svelte','tests/web-stage1-gallery-root.test.mjs'].sort();
const qaFiles=['.github/workflows/04qr-w-pr570-maind8e-home-gallery-chrome.yml','scripts/04qr-w-pr570-maind8e-home-gallery-chrome.mjs','tests/04qr-w-pr570-maind8e-home-gallery.test.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();

test('fixed Source is direct descendant of protected d8e; exactly accepted five Gallery and exactly three QA-only paths',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).trim().split('\n').sort(),ownerFiles);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').trim().split('\n').sort(),qaFiles);
 for(const [path,sha] of Object.entries({
  'src/routes/gallery/+page.svelte':'22a2ca880708487211f8bbaa88ccdb7924770371',
  'src/lib/community/gallery-stage1-root.mjs':'a53e579198678a1ff064facdb9a3f7bcf8eb8a0c',
  'scripts/web-stage1-gallery-chrome.mjs':'c7d5ee5b4f3d8e82148b097dabc1e764878eb3bf',
  'tests/web-stage1-gallery-root.test.mjs':'4bc6d3602727c1a53f94eefd28cd0019d468df78',
  '.github/workflows/web-stage1-gallery-ux.yml':'ab7664596105aeb45869243d1276fe142636fcb4'
 })) {
  assert.equal(git('rev-parse',SOURCE+':'+path),sha);
  assert.equal(git('rev-parse',OLD+':'+path),sha,'ancestral independently accepted Gallery blob must remain byte-identical');
 }
});

test('new current-main changes Home only, not Gallery or community rights; Home six-core gallery link remains canonical',()=>{
 assert.equal(git('merge-base',PREV_MAIN,MAIN),PREV_MAIN);
 assert.deepEqual(git('diff','--name-only',PREV_MAIN,MAIN).trim().split('\n').sort(),[
  '.github/workflows/web-stage1-home-copy-locale.yml','scripts/web-stage1-home-copy-locale-chrome.mjs',
  'src/lib/product-home/copy.js','src/routes/+page.svelte','tests/web-stage1-home-canonical-copy-locale.test.mjs'
 ].sort());
 assert.equal(git('rev-parse',MAIN+':src/routes/+page.svelte'),'173d7b128b22db16fb2478961fcd60205754a293');
 assert.equal(git('rev-parse',MAIN+':src/lib/product-home/copy.js'),'daca1ccbe505d9e49aaf11a03472a7d1fde43cd9');
 assert.equal(HOME_STAGE1_CONSUMER.coreProducts.find(p=>p.id==='gallery')?.href,'/gallery/');
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS.map(p=>p.id),['decorations','touchOfMagic','myGallery']);
 assert.equal(STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,false);
 assert.equal(STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,false);
 assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/routes/+page.svelte','src/lib/product-home/copy.js','src/lib/wep/','src/lib/ddv/','supabase/'),'');
});

test('source-only Gallery unknown/forged kind must never create public Works or DreamSnaps results',()=>{
 const rows=[
  {id:1,facets:{galleryKind:'outdoor'}},
  {id:2,facets:{galleryKind:'indoor'}},
  {id:3,facets:{galleryKind:'tom_furniture'}},
  {id:4,facets:{galleryKind:'tom_clothing'}},
  {id:5,facets:{galleryKind:'dreamsnaps'}},
  {id:6,facets:{}},
  {id:7},
  {id:8,facets:{galleryKind:'__proto__'}},
  null,
  {id:9,facets:{galleryKind:['outdoor']}}
 ];
 assert.deepEqual(stage1GalleryPublicResults('decorations',rows).map(x=>x.id),[1,2]);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',rows).map(x=>x.id),[3,4]);
 assert.deepEqual(stage1GalleryPublicResults('decorations',rows,'indoor').map(x=>x.id),[2]);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',rows,'tom_clothing').map(x=>x.id),[4]);
 assert.deepEqual(stage1GalleryPublicResults('myGallery',rows),[]);
 assert.deepEqual(stage1GalleryPublicResults('dreamsnaps',rows),[]);
 assert.deepEqual(stage1GalleryPublicResults('__proto__',rows),[]);
 assert.deepEqual(stage1GalleryPublicResults('decorations',{}),[]);
 const ui=readFileSync('src/routes/gallery/+page.svelte','utf8');
 assert.match(ui,/data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified"/);
 assert.doesNotMatch(ui,/publishWork\(|uploadAndFinalizeImage\(|writeSave\(/);
 const workflow=readFileSync('.github/workflows/web-stage1-gallery-ux.yml','utf8');
 for(const file of ownerFiles)assert.ok(workflow.includes("'"+file+"'"),file);
 assert.match(workflow,/test "\$\(wc -l <\/tmp\/08web-gallery-stage1\)" -eq 5/);
 assert.match(workflow,/github\.event\.pull_request\.base\.sha/);
 // Known caveat: non-PR push fallback is old main14f; do not assert it is main-d8e validated.
 assert.match(workflow,/14f85625c06f277f580581f73897748367bcfe7a/);
});

test('QA-only action is read-only without private Save, public publish, staging Provider or actual media',()=>{
 const workflow=readFileSync('.github/workflows/04qr-w-pr570-maind8e-home-gallery-chrome.yml','utf8');
 assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(workflow,/playwright-core@1\.55\.0/);
 assert.doesNotMatch(workflow,/secrets\.|deploy-pages|workflow_dispatch|write-all/);
 assert.equal(git('diff','--name-only',SOURCE,'HEAD','--','src/','static/','supabase/','.github/workflows/pages.yml'),'');
});