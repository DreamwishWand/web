import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STAGE1_GALLERY_CONTRACT, STAGE1_GALLERY_PRODUCTS,STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,
 STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,stage1GalleryCopy,stage1GalleryPublicResults
} from '../src/lib/community/gallery-stage1-root.mjs';
const page=readFileSync(new URL('../src/routes/gallery/+page.svelte',import.meta.url),'utf8');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const work=(kind,id)=>({work_id:id,facets:{galleryKind:kind},title:'Public sample'});
test('Owner-closed root exactly Decorations/Touch of Magic/My Gallery without DreamSnaps',()=>{
 assert.equal(STAGE1_GALLERY_CONTRACT,'wand.gallery.stage1-root@1');
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS.map(x=>x.id),['decorations','touchOfMagic','myGallery']);
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS[0].kinds,['outdoor','indoor']);
 assert.deepEqual(STAGE1_GALLERY_PRODUCTS[1].kinds,['tom_furniture','tom_clothing']);
 assert.equal(STAGE1_GALLERY_PRODUCTS[2].href,'/gallery/my/');
 assert.match(page,/data-stage1-gallery-hub/);
 assert.doesNotMatch(page,/\/gallery\/dreamsnaps\/|\/gallery\/publish\/|dreamsnaps\.gallery\.title/);
 assert.match(page,/data-gallery-child=\{card\.id\}/);
 assert.match(page,/class:prominent=\{card\.id==='decorations'\}/);
 assert.equal(STAGE1_GALLERY_PUBLIC_WRITER_ENABLED,false);
 assert.equal(STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED,false);
 assert.match(page,/data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified"/);
});
test('Provider-returned Gallery subtype must be exact; unknown/DreamSnaps never relabelled',()=>{
 const source=[work('outdoor','a'),work('indoor','b'),work('tom_furniture','c'),work('tom_clothing','d'),
 work('dreamsnaps','e'),work('other','f'),{work_id:'g',facets:{}},{work_id:'h'}];
 assert.deepEqual(stage1GalleryPublicResults('decorations',source).map(x=>x.work_id),['a','b']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',source).map(x=>x.work_id),['c','d']);
 assert.deepEqual(stage1GalleryPublicResults('decorations',source,'indoor').map(x=>x.work_id),['b']);
 assert.deepEqual(stage1GalleryPublicResults('touchOfMagic',source,'tom_clothing').map(x=>x.work_id),['d']);
 assert.deepEqual(stage1GalleryPublicResults('myGallery',source),[]);
 assert.deepEqual(stage1GalleryPublicResults('decorations',[{facets:{galleryKind:'outdoor '}}]),[]);
 assert.deepEqual(stage1GalleryPublicResults('decorations',null),[]);
});
test('eight-locale visual copy and safe existing browse RPC retained',()=>{
 for(const locale of locales){
  const c=stage1GalleryCopy(locale);
  for(const k of ['decorations','tom','mine','outdoor','indoor','furniture','clothing','back'])assert.ok(c[k],locale+':'+k);
 }
 assert.match(page,/workType: 'gallery'/);
 assert.match(page,/searchPublicWorks/);
 assert.match(page,/community_get_gallery_public_v1/);
 assert.match(page,/GalleryBrowse/);
 assert.match(page,/GalleryDetail/);
 assert.doesNotMatch(page,/uploadAndFinalizeImage|publishGallery|createGalleryWork|createPublicWork|localStorage/);
 assert.match(page,/@media\(max-width:520px\)/);
});
