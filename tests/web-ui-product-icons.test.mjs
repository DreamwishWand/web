import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOME_STAGE1_CONSUMER,DECORATE_STAGE1_CONSUMER} from '../src/lib/ui/consumer-fixtures.js';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {decorateEntryCopy} from '../src/lib/decorate/copy.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const icon=read('src/lib/ui/Icon.svelte');
const card=read('src/lib/ui/VisualCard.svelte');
const home=read('src/routes/+page.svelte');
const decorate=read('src/routes/decorate/+page.svelte');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];

test('original SVG visually distinguishes six Home products and three Decorate actions',()=>{
 const a=HOME_STAGE1_CONSUMER.coreProducts;
 const b=DECORATE_STAGE1_CONSUMER.entryCards;
 assert.deepEqual(a.map(x=>x.id),['decorate','collection','guide','presets','gallery','dreamsnaps']);
 assert.deepEqual(b.map(x=>x.id),['explore','moodboards','worldEditor']);
 assert.equal(new Set(a.map(x=>x.icon)).size,6);
 assert.equal(new Set(b.map(x=>x.icon)).size,3);
 assert.equal(b.find(x=>x.id==='moodboards').icon,'moodboard');
 assert.equal(b.find(x=>x.id==='worldEditor').icon,'worldEditor');
 assert.notEqual(b[1].icon,a.find(x=>x.id==='gallery').icon);
 for(const {icon:name} of [...a,...b,HOME_STAGE1_CONSUMER.qa])
  assert.ok(icon.includes('    '+name+': ['),'explicit first-party SVG icon '+name);
 assert.match(icon,/moodboard: \[/);
 assert.match(icon,/worldEditor: \[/);
 assert.doesNotMatch(icon,/<img\b|https?:\/\//i);
});

test('visible SVG icons remain decorative but links convey text and unknown icon is safe fallback',()=>{
 assert.match(icon,/iconPaths = paths\[name\] \?\? paths\.sparkle/);
 assert.match(icon,/aria-hidden=\{decorative \? 'true' : undefined\}/);
 assert.match(icon,/aria-label=\{decorative \? undefined : label\}/);
 assert.match(card,/data-visual-card-icon=\{icon\}/);
 assert.match(card,/<Icon name=\{icon\} decorative=\{true\} size=\{32\}/);
 assert.match(card,/<a class="visual-card"/);
 assert.match(card,/<strong>\{title\}<\/strong>/);
 assert.match(home,/title=\{titleFor\(card\.id,copy\)\}/);
 assert.match(decorate,/title=\{titleFor\(card\.id\)\}/);
 assert.doesNotMatch(card,/<img|srcset|fetch\(|localStorage/);
});

test('eight locale labels, canonical navigation and existing Gallery identity unchanged',()=>{
 for(const locale of locales){
  const h=homeCopy(locale),d=decorateEntryCopy(locale);
  for(const k of ['decorate','collection','guide','presets','gallery','dreamsnaps'])
   assert.ok(typeof h[k]==='string'&&h[k].length>0,locale+' '+k);
  for(const k of ['explore','moodboards','worldEditor'])
   assert.ok(typeof d[k]==='string'&&d[k].length>0,locale+' '+k);
 }
 assert.deepEqual(HOME_STAGE1_CONSUMER.coreProducts.map(x=>x.href),[
  '/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/'
 ]);
 assert.deepEqual(DECORATE_STAGE1_CONSUMER.entryCards.map(x=>x.href),[
  '/explore/','/moodboards/','/editor/world/'
 ]);
});
