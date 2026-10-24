import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  kinds, categoryFor, validateGalleryImages, validateGalleryComposition,
  assertClassifiedPhotoPublishContract, GALLERY_PUBLICATION_BLOCKER,
  canUseClassifiedPhotoPublishApi, moveMedia
} from '../src/lib/gallery/stage1.js';
import { galleryStage1Catalogs } from '../src/lib/i18n/messages/community/gallery-stage1.js';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const file=(n)=>({name:n+'.png',type:'image/png',size:128,lastModified:n.length});
test('Gallery Stage1 is only Decorations/ToM; unknown and DreamSnaps never enter Gallery family',()=>{
  assert.deepEqual(kinds,['outdoor','indoor','tom_furniture','tom_clothing']);
  assert.equal(categoryFor('outdoor'),'decorations');
  assert.equal(categoryFor('indoor'),'decorations');
  assert.equal(categoryFor('tom_clothing'),'tom');
  assert.equal(categoryFor('dreamsnap'),null);
  assert.equal(categoryFor('new_unsupported'),null);
});
test('photo-only validation enforces title, one declared target, authentic creator declaration and 1–10 supported images',()=>{
  const input={
    kind:'outdoor',targetType:'biome',targetName:'A declared location',baseItemId:'',
    title:'Garden',description:'',files:[file('one')],originalityConfirmed:true
  };
  assert.deepEqual(validateGalleryComposition(input),[]);
  assert.ok(validateGalleryComposition({...input,targetType:'room'}).includes('target'));
  assert.ok(validateGalleryComposition({...input,targetName:''}).includes('targetName'));
  assert.ok(validateGalleryComposition({...input,originalityConfirmed:false}).includes('originality'));
  assert.ok(validateGalleryComposition({...input,files:[]}).includes('images_count'));
  assert.ok(validateGalleryComposition({...input,files:Array.from({length:11},(_,i)=>file('n'+i))}).includes('images_count'));
  assert.ok(validateGalleryComposition({...input,kind:'tom_furniture',targetType:'base_item',baseItemId:'bad'}).includes('baseItem'));
  assert.equal(validateGalleryImages([file('one'),file('one')]),'duplicate');
  assert.equal(validateGalleryImages([file('existing'),file('new'),file('new')]),'duplicate');
  assert.equal(validateGalleryImages([{...file('x'),type:'text/plain'}]),'type');
});
test('cover ordering is reversible with non-drag buttons',()=>{
  const first=[file('one'),file('two'),file('three')];
  assert.deepEqual(moveMedia(first,1,-1).map(x=>x.name),['two.png','one.png','three.png']);
  assert.deepEqual(moveMedia(first,0,-1),first);
});
test('classification/media atomicity must be positively proven; default API is fail-closed',()=>{
  assert.equal(canUseClassifiedPhotoPublishApi(null),false);
  assert.equal(canUseClassifiedPhotoPublishApi({classificationValidated:true,mediaAtomicity:true,publicOnly:true}),false);
  assert.throws(()=>assertClassifiedPhotoPublishContract(null),{message:GALLERY_PUBLICATION_BLOCKER});
});
test('new owner-visible Gallery copy exists in all eight launch locales with placeholder parity',()=>{
  const keys=Object.keys(galleryStage1Catalogs.en).sort();
  for(const locale of locales){
    const catalog=galleryStage1Catalogs[locale];
    assert.deepEqual(Object.keys(catalog).sort(),keys,locale);
    for(const key of keys){
      assert.ok(typeof catalog[key]==='string' && catalog[key].trim(),locale+' '+key);
      const enParams=[...galleryStage1Catalogs.en[key].matchAll(/\{([a-zA-Z]+)\}/g)].map(x=>x[1]).sort();
      const params=[...catalog[key].matchAll(/\{([a-zA-Z]+)\}/g)].map(x=>x[1]).sort();
      assert.deepEqual(params,enParams,locale+' placeholder '+key);
    }
  }
});
test('Gallery root and publish composer preserve owner-closed IA, PUBLIC-only and media-preview fail-closed contract',()=>{
  const home=read('src/routes/gallery/+page.svelte');
  assert.match(home,/gallery\/decorations\//);
  assert.match(home,/gallery\/tom\//);
  assert.match(home,/gallery\/my\//);
  assert.doesNotMatch(home,/gallery\/dreamsnaps\//);
  const composer=read('src/routes/gallery/publish/+page.svelte');
  assert.match(composer,/PhotoPreview/);
  assert.match(composer,/moveMedia/);
  assert.match(composer,/on:change=\{chooseFiles\}/);
  assert.match(composer,/validateGalleryImages\(\[\.\.\.images\.map\(item=>item\.file\), \.\.\.selected\]\)/);
  assert.match(composer,/mediaValid = validateGalleryImages\(images\.map\(item=>item\.file\)\)/);
  assert.match(composer,/originalityConfirmed/);
  assert.match(composer,/assertClassifiedPhotoPublishContract\(null\)/);
  assert.doesNotMatch(composer,/client\.command\('createGalleryWork'|uploadAndFinalizeImage\(/);
});
test('owner management never invokes unsafe unpublish/delete or unproven revision API',()=>{
  const s=read('src/routes/gallery/my/+page.svelte');
  assert.match(s,/setGalleryCommentsEnabled/);
  assert.match(s,/disabled aria-disabled="true">\{t\('galleryv1\.publishUpdate'/);
  assert.match(s,/disabled aria-disabled="true">\{t\('galleryv1\.deleteWork'/);
  assert.doesNotMatch(s,/client\.command\('deleteWork'|client\.command\('unpublishWork'/);
  assert.match(s,/query\('myGallery'/);
});
test('Gallery/DreamSnaps legacy path redirects to independent DreamSnaps Product',()=>{
 const s=read('src/routes/gallery/dreamsnaps/+page.svelte');
 assert.match(s,/goto\(base\+'\/dreamsnaps\/'/);
});
