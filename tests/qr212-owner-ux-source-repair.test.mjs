import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionWorkspaceState,collectionWorkspaceHref,collectionReferenceSelection} from '../src/lib/collection/reference-navigation.js';
import {filterCollectionRecords,COLLECTION_RUNTIME_INDEX_SHA256} from '../src/lib/collection/runtime.js';
import {DREAMSNAPS_PRIVACY_COPY} from '../src/lib/dreamsnaps/privacy-copy.js';
import {HELP_STAGE1_COPY} from '../src/lib/community/help-stage1-copy.js';
import {COLLECTION_STAGE1_COPY} from '../src/lib/collection/stage1-copy.js';

const read=p=>readFileSync(p,'utf8');
const my=read('src/routes/dreamsnaps/my/+page.svelte');
const old=read('src/routes/gallery/dreamsnaps/+page.svelte');
const nav=read('src/lib/community/DreamsnapsTabs.svelte');
const root=read('src/routes/dreamsnaps/+page.svelte');
const collection=read('src/routes/collection/+page.svelte');
const guide=read('src/routes/guide/+page.svelte');
const qa=read('src/routes/qa/+page.svelte');
const qaBrowse=read('src/lib/community/QaBrowse.svelte');
const help=read('src/routes/help/+page.svelte');
const state=s=>collectionWorkspaceState(new URL('/collection/'+s,'https://offline.invalid'));

test('D06: No per-entry/field official-result public write or unapproved DreamSnaps Work publish on My',()=>{
  for(const bad of ['setDreamsnapOfficialResultPublication','officialPublicFields','selectedFields','toggleField','publicFields:','saveOfficialSharing','publishDreamsnapGallery','publishGallery('])
    assert(!my.includes(bad),'unsafe legacy UI source '+bad);
  for(const good of ['myDreamsnaps','entry.officialResult','data-dreamsnaps-disclosure="private-until-account-authority"','privacyCopy.accountWidePending'])
    assert(my.includes(good),'owner private read/status '+good);
  assert(!old.includes('community_search_gallery_dreamsnaps_public_v1'));
  assert(!old.includes('getPublicCommunityMedia'));
  assert(!old.includes('community_get_gallery_dreamsnap_public_v1'));
  assert(old.includes('data-legacy-dreamsnaps="fail-closed"'));
  assert(!read('src/routes/dreamsnaps/community/+page.svelte').includes('getPublicCommunityMedia'));
  assert(!read('src/routes/dreamsnaps/community/+page.svelte').includes('callPublicCommunityRpc'));
});
test('D07: Category-first contextual Universe/Expansion without permanently switchable World/Universe and still trusted source',()=>{
  assert(!collection.includes('setView('));
  assert(!collection.includes('class="view-switch"'));
  for(const name of ['bind:value={family}','bind:value={universe}','bind:value={expansion}','stage1Copy.expansion','invalidUrl || invalidFacet','loadCollectionRuntime(base)','data-collection-state="item-detail"'])assert(collection.includes(name),name);
  assert.equal(COLLECTION_RUNTIME_INDEX_SHA256,'a74f6df131e114c66759bc3f463266e3b68fea629ac6a360062423ce6fc133c9');
  const source=[{itemId:507,searchText:'mickey chair',family:'Furniture',worlds:['IsDreamlightValley'],universes:['Mickey'],expansions:['BaseGame']}];
  assert.equal(filterCollectionRecords(source,{family:'Furniture',universe:'Mickey',expansion:'BaseGame'}).length,1);
  assert.equal(filterCollectionRecords(source,{expansion:'Expansion01'}).length,0);
  assert.equal(collectionReferenceSelection(source,'507').status,'found');
});
test('D07: valid contextual deep-link and back plus invalid/legacy/noncanonical modes fail closed',()=>{
  const valid=state('?q=%E6%A4%85%E5%AD%90&family=Furniture&universe=Mickey&expansion=BaseGame&item=507');
  assert.equal(valid.invalid,false);assert.equal(valid.itemId,'507');assert.equal(valid.view,'category');
  const back=collectionWorkspaceHref('',valid);
  const after=state(new URL(back,'https://offline.invalid').search);
  assert.equal(after.invalid,false);assert.equal(after.universe,'Mickey');assert.equal(after.expansion,'BaseGame');assert.equal(after.itemId,'');
  for(const s of ['?view=world&world=IsDreamlightValley&item=507','?view=universe&universe=Mickey','?view=category','?world=IsDreamlightValley','?item=507&item=507','?item=0507','?family=Furniture&family=Clothing','?expansion=BaseGame&expansion=Expansion01','?unknown=1','?item=','?version='])
    assert.equal(state(s).invalid,true,s);
  assert.throws(()=>collectionWorkspaceHref('',{view:'world'},507),/Unsupported permanent/);
});
test('D01 D03 D04 D09: four Guide roots, five DreamSnaps jobs 1-3-1, no Gallery DreamSnaps and four Help children',()=>{
  assert(!guide.includes("'quests'|'starPaths'|'events'|'systems'|'issues'"));
  assert(guide.includes("['quests','starPaths','events','systems']"));
  assert(!read('src/routes/gallery/+page.svelte').includes('/gallery/dreamsnaps/'));
  assert(nav.includes('/dreamsnaps/community/'));
  for(const segment of ['/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/'])assert(nav.includes(segment));
  assert(root.includes('class="stage"')&&root.includes('class="feature"'));
  for(const route of ['/help/questions/','/help/tips/','/help/issues/','/help/my/'])assert(help.includes(route));
  assert(help.includes('class="personal"'));
  assert(!help.includes('community_search_issues_public'));
  assert(read('src/routes/help/issues/+page.svelte').includes('copy.issuesPending'));
});
test('D02: do not conflate Unresolved (answered or unanswered) with zero answers',()=>{
  assert(!qaBrowse.includes('bind:checked={unansweredOnly}'));
  assert(qaBrowse.includes('data-resolution-authority="pending"'));
  assert(qaBrowse.includes('class="nested-no-answers"'));
  assert(qa.includes('p_unanswered_only: false'));
  assert(!qa.includes('unansweredOnly'));
});
test('Eight language labels for private consent/CHC contextual facets, without writer activation',()=>{
  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  for(const obj of [DREAMSNAPS_PRIVACY_COPY,HELP_STAGE1_COPY,COLLECTION_STAGE1_COPY])assert.deepEqual(Object.keys(obj).sort(),[...locales].sort());
  for(const locale of locales) {
    for(const key of ['privateDefault','accountWidePending','community','legacyUnavailable'])assert(DREAMSNAPS_PRIVACY_COPY[locale][key]?.length>2,locale+'/'+key);
    for(const key of ['questions','tips','issues','activity','unresolved','solved','noAnswers'])assert(HELP_STAGE1_COPY[locale][key]?.length>1,locale+'/'+key);
    assert(COLLECTION_STAGE1_COPY[locale].expansion.length>1);
  }
});
