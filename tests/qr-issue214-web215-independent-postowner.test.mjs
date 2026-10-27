import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { collectionWorkspaceState, collectionWorkspaceHref, collectionReferenceSelection } from '../src/lib/collection/reference-navigation.js';
import { COLLECTION_RUNTIME_INDEX_SHA256, filterCollectionRecords } from '../src/lib/collection/runtime.js';
import { DREAMSNAPS_PRIVACY_COPY } from '../src/lib/dreamsnaps/privacy-copy.js';
import { HELP_STAGE1_COPY } from '../src/lib/community/help-stage1-copy.js';
import { COLLECTION_STAGE1_COPY } from '../src/lib/collection/stage1-copy.js';
const read=p=>readFileSync(p,'utf8');
const route=p=>read('src/routes/'+p+'/+page.svelte');
const url=s=>collectionWorkspaceState(new URL('https://qr.invalid/collection/'+s));
const legacy=route('gallery/dreamsnaps');
const my=route('dreamsnaps/my');
const community=route('dreamsnaps/community');
const root=route('dreamsnaps');
const col=route('collection');
const qa=route('qa');
const browser=read('src/lib/community/QaBrowse.svelte');
test('D07: independent original in-repo Index trust anchor 12,552/18/unique-target, not owned denominator',()=>{
 const b=readFileSync('static/ddv/collection/v1.25/index.json');
 const sha=createHash('sha256').update(b).digest('hex');
 assert.equal(sha,'a74f6df131e114c66759bc3f463266e3b68fea629ac6a360062423ce6fc133c9');
 assert.equal(COLLECTION_RUNTIME_INDEX_SHA256,sha);
 const index=JSON.parse(b.toString());
 assert.equal(index.n,12552);
 assert.equal(index.shards.length,18);
 assert.equal(index.shards.reduce((x,y)=>x+y.count,0),12552);
 assert.equal(index.t.platform,'Nintendo Switch');
 assert.equal(index.t.gameVersion,'1.25.0');
 assert.equal(index.t.buildID,'52BD625D9B4E0053');
 assert.equal(index.l.length,8);
});
test('D07: hostile legacy switch, duplicate, unknown parameter and malformed IDs reject without rewriting to another ItemID',()=>{
 for(const s of ['?view=world','?view=universe&universe=Frozen','?view=category','?world=Valley','?q=A&q=B','?item=4&item=5','?item=0004','?item=1e3','?item=-1','?item=%3Cimg%3E','?version=','?expansion=A&expansion=B','?unknown=1'])
  assert.equal(url(s).invalid,true,s);
 assert.equal(url('?item=507').invalid,false);
 assert.equal(url('?version=1.25.3').version,'1.25.3');
 assert.equal(collectionReferenceSelection([{itemId:507}],'507','1.25.3').status,'unsupported-version');
 assert.equal(collectionReferenceSelection([{itemId:507}],'507','Steam').status,'unsupported-version');
 assert.throws(()=>collectionWorkspaceHref('',{view:'world'}),/Unsupported permanent/);
 assert.ok(col.includes('invalidUrl || invalidFacet'));
 assert.ok(col.includes('data-collection-state="unsupported-version"'));
});
test('D07: only contextual Universe/Expansion, no World/Universe browse modes, valid back/context/search',()=>{
 for(const marker of ['bind:value={family}','bind:value={universe}','bind:value={expansion}','loadCollectionRuntime(base)','on:click={reload}'])assert.ok(col.includes(marker),marker);
 assert.ok(!col.includes('setView('));
 assert.ok(!col.includes('bind:value={world}'));
 const s=url('?family=Furniture&universe=Mickey&expansion=BaseGame&q=chair&item=507');
 assert.equal(s.invalid,false);
 const back=collectionWorkspaceHref('/wand',s);
 assert.ok(back.includes('universe=Mickey')&&back.includes('expansion=BaseGame'));
 assert.ok(!back.includes('item='));
 assert.equal(url(back.slice(back.indexOf('?'))).family,'Furniture');
 const data=[{itemId:507, family:'Furniture',universes:['Mickey'],expansions:['BaseGame'],worlds:['Valley'],searchText:'chair'}];
 assert.equal(filterCollectionRecords(data,{family:'Furniture',universe:'Mickey',expansion:'BaseGame',query:'chair'}).length,1);
 assert.equal(filterCollectionRecords(data,{expansion:'Unknown'}).length,0);
 assert.ok(!col.includes('Owned: Yes')&&!col.includes('setOwned'));
});
test('D06: UI cannot issue per-entry official/public Gallery Work disclosure and retains owner-private claims only',()=>{
 for(const needle of ['setDreamsnapOfficialResultPublication','selectedFields','publicFields:','toggleField(','saveOfficialSharing(','publishDreamsnapGallery','publishGallery('])
  assert.ok(!my.includes(needle),'legacy result disclosure caller '+needle);
 assert.ok(my.includes('entry.officialResult'));
 assert.ok(my.includes('data-dreamsnaps-disclosure="private-until-account-authority"'));
 assert.ok(!my.includes('setDreamsnapOfficialAccountConsent'));
 assert.ok(!my.includes("client.command('"));
 assert.ok(my.includes('privacyCopy.accountWidePending'));
});
test('D03: old Gallery DreamSnaps route has no public RPC, media signer, Creator, ranking or private result detail',()=>{
 assert.ok(legacy.includes('data-legacy-dreamsnaps="fail-closed"'));
 assert.ok(legacy.includes('/dreamsnaps/'));
 for(const body of [legacy,community])for(const forbidden of ['callPublicCommunityRpc','community_search_gallery_dreamsnaps_public_v1','getPublicCommunityMedia','getCommunityBrowserConfig','signedUrl'])
  assert.ok(!body.includes(forbidden),forbidden);
 assert.ok(!route('gallery').includes('/gallery/dreamsnaps/'));
});
test('D01/D02/D04/D09: Guide four, CHC four, DreamSnaps five 1-3-1 and unresolved variants disabled',()=>{
 const g=route('guide'),help=route('help'),nav=read('src/lib/community/DreamsnapsTabs.svelte');
 assert.ok(g.includes("['quests','starPaths','events','systems']"));
 assert.ok(!g.includes("|'issues'"));
 for(const s of ['questions','tips','issues','my'])assert.ok(help.includes('/help/'+s+'/'));
 assert.ok(help.includes('data-help-root="four-children"'));
 assert.ok(help.includes('disabled aria-describedby="help-search-pending"'));
 assert.ok(root.includes('class="dreamsnaps-map"')&&root.includes('class="stage"'));
 assert.ok(root.includes('/dreamsnaps/community/'));
 assert.equal((nav.match(/href=/g)||[]).length,5);
 assert.ok(qa.includes('p_unanswered_only: false'));
 assert.ok(browser.includes('data-resolution-authority="pending"'));
 assert.ok(browser.includes('class="nested-no-answers"'));
 assert.ok(!qa.includes('unansweredOnly'));
});
test('All owner-facing new privacy, Help and Expansion labels represented for exact 8 locales',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const obj of [DREAMSNAPS_PRIVACY_COPY,HELP_STAGE1_COPY,COLLECTION_STAGE1_COPY])
  assert.deepEqual(Object.keys(obj).sort(),[...locales].sort());
 for(const locale of locales) {
  assert.ok(DREAMSNAPS_PRIVACY_COPY[locale].privateDefault.length>2);
  assert.ok(DREAMSNAPS_PRIVACY_COPY[locale].accountWidePending.length>2);
  assert.ok(HELP_STAGE1_COPY[locale].noAnswers.length>1);
  assert.ok(COLLECTION_STAGE1_COPY[locale].expansion.length>1);
 }
});
