import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orientationCopy,ORIENTATION_DESTINATIONS} from '../src/lib/product-home/orientation-stage1-copy.mjs';
const page=readFileSync(new URL('../src/routes/discover/+page.svelte',import.meta.url),'utf8');
const ids=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
const hrefs=['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/'];

test('Discover Stage1 is orientation for exactly seven distinct Product jobs, not Home duplicated cards',()=>{
 assert.deepEqual(ORIENTATION_DESTINATIONS,hrefs);
 assert.deepEqual(orientationCopy('en').products.map(p=>p.id),ids);
 assert.deepEqual(orientationCopy('en').products.map(p=>p.path),hrefs);
 assert.equal(new Set(orientationCopy('en').products.map(p=>p.path)).size,7);
 assert.match(page,/data-discover-stage1="orientation-not-dashboard"/);
 assert.match(page,/data-discover-seven-products/);
 assert.match(page,/data-discover-product=\{product.id\}/);
 assert.match(page,/data-discover-destination=\{product.id\}/);
 assert.match(page,/href=\{base\+product.path\}/);
 assert.doesNotMatch(page,/GroupedCardGrid|HOME_STAGE1_CONSUMER|VisualCard/);
 assert.doesNotMatch(page,/href=\{base\s*\+\s*'\/qa\/'\}/);
});
test('every locale has purpose, one actionable first step and all three optional/gated states',()=>{
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=orientationCopy(locale);
  assert.equal(copy.products.length,7,locale);
  for(const product of copy.products){
   assert.ok(product.purpose.trim().length>18,locale+'/'+product.id+' purpose');
   assert.ok(product.step.trim().length>8,locale+'/'+product.id+' first action');
   assert.ok(Object.isFrozen(product),locale+'/'+product.id+' immutable');
  }
  for(const k of ['intro','start','purpose','action','scope','seeStatus',
    'accountTitle','account','saveTitle','save','supportTitle','support']){
   assert.ok(typeof copy[k]==='string'&&copy[k].length>7,locale+'/'+k);
  }
 }
 assert.notEqual(orientationCopy('ja').products[0].purpose,orientationCopy('en').products[0].purpose);
 assert.notEqual(orientationCopy('fr').saveTitle,orientationCopy('en').saveTitle);
});
test('Guide Issues, Community Help entry, Private Save and unaccepted Writer remain separated',()=>{
 const c=orientationCopy('en');
 assert.match(c.products[2].purpose,/Quests, Star Paths, Events, and Systems/);
 assert.match(c.products[2].purpose,/Community Issues belong in Help Center/);
 assert.equal(c.products[6].path,'/help/');
 assert.match(c.products[6].purpose,/Posting requires a permitted account/);
 assert.match(c.save,/never uploaded automatically/);
 assert.match(c.save,/disabled until the exact version and operation are verified/);
 assert.match(c.account,/without signing in/);
 assert.match(c.support,/does not mean its writer, publishing or linked media is enabled|not a publication or writer permission/);
 for(const s of ['data-public-writer="off"','data-save-auto-upload="off"','data-discover-account-optional',
  'data-discover-save-optional','data-discover-capability-gated',
  "base+'/rc-status/'", 'productTitle(product.id,titles,helpTitle)']){
  assert.ok(page.includes(s),s);
 }
 for(const unsafe of ['onMount(','fetch(','publishWork(','loadSave(','cloudUpload(','<img','<video']){
  assert.equal(page.includes(unsafe),false,unsafe);
 }
});
test('responsive, 320px/200% keyboard orientation does not add dashboard or account pressure',()=>{
 assert.match(page,/\.discover-products\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(page,/\.mental-model-grid\{display:grid;grid-template-columns:repeat\(3/);
 assert.match(page,/@media\(max-width:680px\)/);
 assert.match(page,/@media\(max-width:360px\)/);
 assert.match(page,/\.discover-product-link:focus-visible/);
 assert.doesNotMatch(page,/Recently Used|Continue editing|Sign in to continue|Claim your rewards/);
});
