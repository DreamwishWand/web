import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IMAGE_RIGHTS_ATTRIBUTION,imageRightsAttribution} from '../src/lib/i18n/image-rights-attribution.js';
import {SUPPORTED_LOCALES} from '../src/lib/i18n/registry.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('public rights attribution exactly reuses eight DBK draft texts, no operator approval inferred',()=>{
 const draft=JSON.parse(read('../ops/ddv-item-image-operator-readiness-template.json'));
 assert.deepEqual(Object.keys(IMAGE_RIGHTS_ATTRIBUTION).sort(),SUPPORTED_LOCALES.map(x=>x.code).sort());
 assert.equal(Object.isFrozen(IMAGE_RIGHTS_ATTRIBUTION),true);
 for(const {code} of SUPPORTED_LOCALES){
  assert.equal(imageRightsAttribution(code),draft.locales[code].text,code);
  for(const name of ['Dreamwish Wand','Disney Dreamlight Valley','Disney','Gameloft'])
   assert.ok(imageRightsAttribution(code).includes(name),code+'/'+name);
  assert.doesNotMatch(imageRightsAttribution(code),/https?:\/\/|mailto:|@/);
 }
 assert.equal(new Set(Object.values(IMAGE_RIGHTS_ATTRIBUTION)).size,8);
 assert.equal(imageRightsAttribution('unsupported'),IMAGE_RIGHTS_ATTRIBUTION.en);
 assert.equal(imageRightsAttribution('JA'),IMAGE_RIGHTS_ATTRIBUTION.ja);
});
test('shared footer visible text follows locale, keeps existing Help link, no contact or media authority',()=>{
 const footer=read('../src/lib/SiteFooter.svelte');
 assert.match(footer,/data-image-rights-attribution>\{imageRightsAttribution\(\$locale\)\}/);
 assert.match(footer,/href=\{base \+ '\/help\/'\}/);
 assert.doesNotMatch(footer,/<img|<video|mailto:|\{@html|fetch\(|mediaPublic|rightsContact|operatorReceipt|humanReviewed/);
 assert.match(read('../src/routes/+layout.svelte'),/<SiteFooter \/>/);
});
