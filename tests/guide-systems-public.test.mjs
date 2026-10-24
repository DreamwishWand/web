import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYSTEM_CATEGORIES, APPROVED_SYSTEM_PAGES, PAGE_INDEX, SYSTEMS_SOURCE } from '../src/lib/guide/systems-catalog.js';
import { REVIEWED_EN_PAGES, REVIEWED_EN_PAGE_INDEX } from './fixtures/guide-systems-reviewed-en.js';
import { SYSTEMS_UI_COPY } from '../src/lib/guide/systems-copy.js';
import {
  SYSTEMS_LOCALES, SYSTEMS_PUBLIC_SCHEMA, validateSystemsPublicManifest,
  browsePublishedSystems, publishedSystemById, canonicalSystemHref,
  relatedPublishedSystems, systemsCategoryCounts, loadPublishedSystems
} from '../src/lib/guide/systems-public.js';

const target={platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',saveSchema:624};
const empty={schema:SYSTEMS_PUBLIC_SCHEMA,target,articles:[]};
const syntheticPageIndex = new Map(['DREAMSNAPS','PHOTO_MODE'].map(id => [id, {...REVIEWED_EN_PAGE_INDEX.get(id),approved:true}]));
const acceptSynthetic = payload => validateSystemsPublicManifest(payload, syntheticPageIndex);
const mock=(id='DREAMSNAPS')=>{
  const source=REVIEWED_EN_PAGE_INDEX.get(id);
  return {id,categoryId:source.categoryId,groupId:source.groupId,primaryMechanicKey:source.mechanicKey,
    publicationStatus:'PUBLISHED',publicationApproved:true,rightsApproved:true,currentVersionReviewed:true,
    allEightLocalesReviewed:true,sourceEnglishGuidanceSha256:source.sourceHash,
    sourceLabel:'Synthetic reviewed test source',confidence:'CONFIRMED',reviewedAt:'2026-10-24',
    dlcContext:[],relatedArticleIds:[],
    localized:Object.fromEntries(SYSTEMS_LOCALES.map(locale=>[locale,{
      title:id==='DREAMSNAPS'?'DreamSnaps':source.titleEN,
      summary:'Synthetic published fixture, not user-visible live article.',
      prerequisites:[],instructions:['Synthetic instruction'],warnings:[]
    }]))};
};
test('Owner taxonomy stays ordered 7 categories/21 groups; reviewed EN article distribution is not public publication',()=>{
  assert.deepEqual(SYSTEM_CATEGORIES.map(x=>x.en),[
    'Basics, Progression & Settings','Exploration, Travel & Tools','Villagers, Companions & Mounts',
    'Gathering, Cooking & Crafting','Inventory, Collections & Shops',
    'Decorating & Customization','Photography, Social & Activities'
  ]);
  assert.equal(SYSTEM_CATEGORIES.reduce((sum,c)=>sum+c.groups.length,0),21);
  assert.equal(REVIEWED_EN_PAGES.length,45);
  assert.deepEqual(SYSTEM_CATEGORIES.map(x=>REVIEWED_EN_PAGES.filter(p=>p.categoryId===x.id).length),[7,6,5,8,10,4,5]);
  assert.equal(new Set(REVIEWED_EN_PAGES.map(x=>x.id)).size,45);
  assert.equal(SYSTEMS_SOURCE.publicApprovedCount,0);
  assert.equal(APPROVED_SYSTEM_PAGES.length,0);
  assert.equal(PAGE_INDEX.size,0);
});

test('Production JS/catalog contains no unpublished EN title, source hash or primary page identifier',()=>{
  const shipping = readFileSync('src/lib/guide/systems-catalog.js','utf8') +
    readFileSync('src/lib/guide/systems-public.js','utf8') +
    readFileSync('static/ddv/guide/v1.25/systems-public.json','utf8');
  for(const record of REVIEWED_EN_PAGES) {
    assert.equal(shipping.includes(record.sourceHash), false, record.id + ' unpublished source hash exposed');
    assert.equal(shipping.includes('"' + record.id + '"'), false, record.id + ' unpublished identifier exposed');
    assert.equal(shipping.includes('"titleEN": "' + record.titleEN + '"'), false, record.id + ' unpublished editorial title record exposed');
  }
});
test('Forged approval booleans and matching source hashes cannot bypass compiled 0-page allowlist',()=>{
 const forged={...empty,articles:[mock('DREAMSNAPS')]};
 assert.throws(()=>validateSystemsPublicManifest(forged), /Invalid published article envelope/);
 assert.equal(canonicalSystemHref('DREAMSNAPS'),null);
 assert.equal(publishedSystemById({articles:[forged.articles[0]]},'DREAMSNAPS'),null);
});

test('Every UI locale has structural copy while article content cannot fall back to unreviewed translations',()=>{
  for(const locale of SYSTEMS_LOCALES){
    for(const key of Object.keys(SYSTEMS_UI_COPY.en))assert.equal(typeof SYSTEMS_UI_COPY[locale][key],'string',locale+' '+key);
  }
});
test('Production runtime and public manifest contain zero unapproved source article bodies',()=>{
  const runtime=JSON.parse(readFileSync('static/ddv/guide/v1.25/runtime.json','utf8'));
  const published=JSON.parse(readFileSync('static/ddv/guide/v1.25/systems-public.json','utf8'));
  assert.equal(runtime.records.systems.length,0);
  assert.equal(runtime.records.issues.length,0);
  assert.deepEqual(validateSystemsPublicManifest(published).articles,[]);
  assert.equal(systemsCategoryCounts(published).reduce((sum,c)=>sum+c.count,0),0);
});
test('Strict positive synthetic preview is an 8-reviewed-rights-approved source-matching publication, not an automatic EN promotion',()=>{
  const synthetic={...empty,articles:[mock()]};
  assert.throws(()=>validateSystemsPublicManifest(synthetic), /Invalid published article envelope/);
  const approved=acceptSynthetic(synthetic);
  assert.equal(approved.articles.length,1);
  assert.equal(publishedSystemById(approved,'DREAMSNAPS','1.25.0',syntheticPageIndex)?.id,'DREAMSNAPS');
  assert.equal(canonicalSystemHref('DREAMSNAPS','/web',syntheticPageIndex),'/web/guide/systems/?article=DREAMSNAPS');
  assert.equal(canonicalSystemHref('UNVERIFIED'),null);
  assert.deepEqual(browsePublishedSystems(approved,{query:'dreamsnaps',locale:'ja'}).map(x=>x.id),['DREAMSNAPS']);
  assert.deepEqual(browsePublishedSystems(approved,{query:'写真と',locale:'en'}).map(x=>x.id),['DREAMSNAPS']);
  assert.deepEqual(browsePublishedSystems(approved,{query:'ドリーム',locale:'en'}).map(x=>x.id),[]);
  assert.deepEqual(browsePublishedSystems(approved,{categoryId:'basics-progression-settings'}),[]);
  assert.deepEqual(browsePublishedSystems(approved,{groupId:'photos-dreamsnaps'}).map(x=>x.id),['DREAMSNAPS']);
  assert.deepEqual(browsePublishedSystems(approved,{version:'1.25.3'}),[]);
  assert.equal(publishedSystemById(approved,'DREAMSNAPS','1.25.3',syntheticPageIndex),null);
  assert.deepEqual(relatedPublishedSystems(approved,approved.articles[0]),[]);
});
test('Fail closed on wrong build/schema, incomplete translations, missing rights, mismatch, forged reviewed ID, duplicate and unknown record',()=>{
  const bads=[
    {...empty,target:{...target,gameVersion:'1.25.3'}},
    {...empty,target:{...target,buildID:'unknown'}},
    {...empty,articles:[{...mock(),rightsApproved:false}]},
    {...empty,articles:[{...mock(),publicationApproved:false}]},
    {...empty,articles:[{...mock(),currentVersionReviewed:false}]},
    {...empty,articles:[{...mock(),allEightLocalesReviewed:false}]},
    {...empty,articles:[{...mock(),sourceEnglishGuidanceSha256:'0'.repeat(64)}]},
    {...empty,articles:[{...mock(),id:'UNKNOWN'}]},
    {...empty,articles:[{...mock(),groupId:'fake'}]},
    {...empty,articles:[{...mock(),localized:{en:mock().localized.en}}]},
    {...empty,articles:[mock(),mock()]},
    {...empty,articles:[{...mock(),relatedArticleIds:['FAKE']}]},
    {...empty,articles:[{...mock(),relatedArticleIds:['DREAMSNAPS','DREAMSNAPS']}]}
  ];
  for(const bad of bads)assert.throws(()=>acceptSynthetic(bad),TypeError);
});
test('Public loader rejects HTTP failures and unsupported payload versions',async()=>{
  await assert.rejects(()=>loadPublishedSystems('',async()=>({ok:false,status:403})),/could not be loaded/);
  await assert.rejects(()=>loadPublishedSystems('',async()=>({ok:true,json:async()=>({...empty,schema:'unknown'})})),/Unknown Systems publication schema/);
  const ok=await loadPublishedSystems('/web',async(path,options)=>{
    assert.equal(path,'/web/ddv/guide/v1.25/systems-public.json');assert.equal(options.cache,'no-store');
    return {ok:true,json:async()=>empty};
  });
  assert.equal(ok.articles.length,0);
});
test('Root uses canonical four children; Guide does not mount legacy 45 unapproved System entries in UI',()=>{
  const root=readFileSync('src/routes/guide/+page.svelte','utf8');
  const page=readFileSync('src/routes/guide/systems/+page.svelte','utf8');
  assert.match(root,/href=\{base \+ '\/guide\/systems\/'\}/);
  assert.match(root,/\['quests','starPaths','events'\]/);
  assert.match(page,/data-guide-systems/);
  assert.match(page,/aria-pressed/);
  assert.match(page,/data-systems-state="unpublished"/);
  assert.match(page,/systems-version/);
});
