import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
import {HOME_STAGE1_CONSUMER} from '../src/lib/ui/consumer-fixtures.js';

const route=readFileSync(new URL('../src/routes/+page.svelte',import.meta.url),'utf8');

test('canonical Home keeps six equal Core and distinct Community Help Center with no new dashboard',()=>{
 assert.deepEqual(HOME_STAGE1_CONSUMER.coreProducts.map(x=>x.id),
 ['decorate','collection','guide','presets','gallery','dreamsnaps']);
 assert.match(route,/home-product-grid/);
 assert.match(route,/home-qa-entry/);
 assert.match(route,/href=\{base \+ '\/help\/'\}/);
 assert.doesNotMatch(route,/Recently Used|Recently Viewed|Continue Editing|news-feed/);
});
test('all eight locale Home cards are reactive to new language even through helper functions',()=>{
 assert.match(route,/titleFor\(id: string, labels: typeof copy\)/);
 assert.match(route,/detailFor\(id: string, labels: typeof copy\)/);
 assert.match(route,/title=\{titleFor\(card.id,copy\)\}/);
 assert.match(route,/description=\{detailFor\(card.id,copy\)\}/);
 const langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const lang of langs){
  const c=homeCopy(lang);
  for(const field of ['products','decorate','collection','guide','presets','gallery','dreamsnaps',
    'guideDetail','presetsDetail','galleryDetail','dreamsnapsDetail','qa','qaDetail']){
   assert.ok(typeof c[field]==='string'&&c[field].trim().length>0,lang+'/'+field);
  }
  assert.equal(c.qa,helpStage1Copy(lang).title,lang+' canonical Help naming');
 }
 assert.notEqual(homeCopy('ja').guideDetail,homeCopy('en').guideDetail);
});
test('Guide issues belong to Help; no implied accepted Gallery, Presets or DreamSnaps publishing',()=>{
 const en=homeCopy('en');
 assert.match(en.guideDetail,/Quests, Star Paths, Events and Systems/);
 assert.match(en.guideDetail,/Community Issues are in Help Center/);
 assert.doesNotMatch(en.guideDetail,/in one curated place/);
 assert.match(en.galleryDetail,/where rights and visibility allow/);
 assert.match(en.presetsDetail,/which preset operations are supported/);
 assert.match(en.dreamsnapsDetail,/when authorized/);
 assert.match(en.qaDetail,/publication requires authorization/);
 assert.match(homeCopy('ja').guideDetail,/Help Center/);
 assert.doesNotMatch(route,/publishWork\(|openSave\(|fetch\(|cloudUpload\(/);
});
test('Home is still a visible UX shell not a Writer/Account entitlement promotion',()=>{
 assert.match(route,/HOME_STAGE1_CONSUMER\.coreProducts/);
 assert.match(route,/helpStage1Copy\(\$locale\)/);
 assert.match(route,/data-test-site-availability/);
 assert.match(route,/base \+ '\/rc-status\/'/);
 assert.doesNotMatch(route,/<img\b|<video\b|<canvas\b/);
});
