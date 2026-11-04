/** Independent 04QR-W new-only Stage1 Gallery Source privacy/UI guard.
 * PR525 fixed Source latest mainfabfd; no actual Community provider, actor or Media.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 STAGE1_GALLERY_PRODUCTS,STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,
 stage1GalleryCopy,stage1GalleryKindAllowed,stage1GalleryPublicResults
} from '../src/lib/community/gallery-stage1-root.mjs';
const MAIN='fabfd17c8dd192707d55a6cc12cccf65797d564e',SOURCE='3a612e4a689ebde64f1838c8efbee1ac339d5059';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const src=[
 '.github/workflows/web-stage1-gallery-ux.yml',
 'scripts/web-stage1-gallery-chrome.mjs',
 'src/lib/community/gallery-stage1-root.mjs',
 'src/routes/gallery/+page.svelte',
 'tests/web-stage1-gallery-root.test.mjs'
],qa=[
 '.github/workflows/04qr-w-pr525-gallery-visual-independent.yml',
 'scripts/04qr-w-pr525-gallery-visual-chromium.mjs',
 'tests/04qr-w-pr525-gallery-visual-independent.test.mjs'
];
const page=readFileSync('src/routes/gallery/+page.svelte','utf8');
const work=(id,kind)=>({id,facets:kind===undefined?{}:{galleryKind:kind}});
test('exact five Source changes on newest protected main, 3 QA-only additions; no Community client mutations',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),src);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('hash-object','src/routes/gallery/+page.svelte'),'22a2ca880708487211f8bbaa88ccdb7924770371');
 assert.equal(git('hash-object','src/lib/community/gallery-stage1-root.mjs'),'a53e579198678a1ff064facdb9a3f7bcf8eb8a0c');
});
test('exact Owner Gallery three-card route and genuine 8-locale copy without DreamSnaps root or publish control',()=>{
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS.map(x=>x.id),['decorations','touchOfMagic','myGallery']);
 assert.equal(STAGE1_GALLERY_PRODUCTS[2].href,'/gallery/my/');
 assert.equal(STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,false);
 assert.equal(STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,false);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=stage1GalleryCopy(locale);
  for(const k of ['decorations','tom','mine','all','outdoor','indoor','furniture','clothing','unavailable'])
   assert.ok(typeof c[k]==='string'&&c[k].length>0,locale+'/'+k);
 }
 assert.notEqual(stage1GalleryCopy('fr').decorations,stage1GalleryCopy('en').decorations);
 assert.notEqual(stage1GalleryCopy('ja').decorations,stage1GalleryCopy('en').decorations);
 assert.match(page,/data-stage1-gallery-hub/);
 assert.doesNotMatch(page,/href=\{\x60\$\{base\}\/gallery\/dreamsnaps\//);
 assert.doesNotMatch(page,/publishWork\(|createPublicWork\(|saveEditedCopy\(/);
});
test('No invented Gallery public eligibility: missing, forged, unknown and dreamsnaps subtype excluded',()=>{
 const works=[work('a','outdoor'),work('b','indoor'),work('c','tom_furniture'),work('d','tom_clothing'),
  work('e','dreamsnaps'),work('f',''),work('g','unknown'),work('h'),null,{},'garbage'];
 assert.deepEqual(stage1GalleryPublicResults('decorations',works).map(x=>x.id),['a','b']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',works).map(x=>x.id),['c','d']);
 assert.deepEqual(stage1GalleryPublicResults('decorations',works,'indoor').map(x=>x.id),['b']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',works,'tom_clothing').map(x=>x.id),['d']);
 for(const category of ['dreamsnaps','myGallery','unknown','gallery']){
  assert.deepEqual(stage1GalleryPublicResults(category,works),[]);
  assert.equal(stage1GalleryKindAllowed(category,'outdoor'),false);
 }
 assert.deepEqual(stage1GalleryPublicResults('decorations',null),[]);
 assert.equal(stage1GalleryKindAllowed('decorations','tom_furniture'),false);
 assert.equal(stage1GalleryKindAllowed('touchOfMagic','outdoor'),false);
});
test('Root prevents unrestricted fetch and media positive claim until user selected a verified category',()=>{
 assert.match(page,/if \(workId\) void openWork\(workId\)/);
 assert.match(page,/if \(!client \|\| !category\) return/);
 assert.match(page,/visibleWorks=category\?stage1GalleryPublicResults\(category,works,facet\):\[\]/);
 assert.match(page,/data-public-eligibility="provider-gated" data-media-rights="unverified"/);
 assert.match(page,/data-writer="off"/);
 assert.doesNotMatch(page,/setDreamsnapOfficialResultPublication|uploadMedia\(|service_role|grantPublicRights/);
});
