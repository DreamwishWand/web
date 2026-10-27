import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalWorkId,resolveTypedWorkRoute,parseTypedWorkQuery} from '../src/lib/community/typed-work-route.js';
import {DREAMSNAPS_PRIVACY_COPY} from '../src/lib/dreamsnaps/privacy-copy.js';

const id='bbad9e37-31e4-4eba-831f-e453c96a2057';
const upper=id.toUpperCase();
const read=path=>readFileSync(path,'utf8');

test('typed Work resolver uses only explicit Gallery/Question/Tip/DreamSnaps routes',()=>{
  const expected={gallery:'/gallery/?work=',question:'/qa/?question=',tip:'/qa/?tip=',dreamsnap:'/dreamsnaps/community/?work='};
  for(const [type,suffix] of Object.entries(expected)) {
    const resolved=resolveTypedWorkRoute('/wand/',type,upper);
    assert.equal(resolved.href,'/wand'+suffix+id);
    assert.equal(resolved.workType,type);
    assert.equal(resolved.status,type==='dreamsnap'?'gated':'ready');
  }
  assert.equal(resolveTypedWorkRoute('','dreamsnap',id).availability,'pending-public-detail-authority');
  assert.equal(resolveTypedWorkRoute('','dreamsnap',id).href,'/dreamsnaps/community/?work='+id);
});
test('unknown type, invalid UUID, hidden/retired Work never falls back to Tip or Gallery',()=>{
  const types=['','DREAMSNAP','preset','shop','unknown','__proto__',null,undefined,0];
  for(const type of types) {
    const result=resolveTypedWorkRoute('',type,id);
    assert.equal(result.status,'unavailable');
    assert.equal(result.href,null);
  }
  for(const input of ['','abc','1','../qa/?tip=123',id+'&tip='+id,'00000000-0000-0000-0000-000000000000',
    id.replaceAll('-',''),null,undefined,42])
    assert.equal(resolveTypedWorkRoute('','gallery',input).href,null,String(input));
  for(const source of [
    {accessible:false}, {retired:true},{isRetired:true},{deleted:true},{privacySuppressed:true},
    {visibility:'private'},{visibility:'unlisted'},{work_visibility:'PRIVATE'},
    {lifecycle_state:'deleted'},{lifecycleState:'unpublished'},{moderationState:'held'},
    {moderation_state:'removed'},{accountState:'retired'}
  ]) for(const type of ['gallery','tip','question','dreamsnap'])
    assert.equal(resolveTypedWorkRoute('',type,id,source).href,null,type+' '+JSON.stringify(source));
  assert.equal(canonicalWorkId(upper),id);
});
test('typed direct link never allows duplicate, mixed, malformed or unknown query',()=>{
  for(const param of ['work','tip','question','id']) {
    assert.deepEqual(parseTypedWorkQuery('?'+param+'='+id,param),{status:'valid',workId:id});
    for(const q of ['','?'+param+'='+id+'&'+param+'='+id,
      '?'+param+'='+id+'&tip='+id,'?'+param+'='+id+'&unknown=1',
      '?'+param+'=invalid','?'+param+'=','?'+param+'='+id+'%26tip%3D'+id])
      assert.equal(parseTypedWorkQuery(q,param).status,'invalid',param+q);
  }
  assert.equal(parseTypedWorkQuery('?work='+id,'__proto__').status,'invalid');
});
test('Creator UI never routes unrecognized or DreamSnaps Works into Q&A Tip and clears stale requests',()=>{
  const src=read('src/routes/creator/+page.svelte');
  for(const marker of ['resolveTypedWorkRoute','parseTypedWorkQuery','data-typed-work-route="dreamsnap-gated"',
      "route.status === 'ready'","route.status === 'gated'",'data-typed-work-route="unavailable"',
      '++generation','if (current !== generation)','profile = null;','works = []'])
    assert(src.includes(marker),marker);
  assert(!src.includes("work.work_type === 'question' ? 'question' : 'tip'"));
  assert(!src.includes('/qa/?${work.work_type'));
});
test('Gated DreamSnaps Work Detail never enables Public Signer/SQL/Provider/media or leaks WorkID',()=>{
  const detail=read('src/routes/dreamsnaps/community/+page.svelte');
  for(const marker of ['parseTypedWorkQuery',"workEntry = selection.status === 'valid' ? 'gated' : 'invalid'",
    'data-dreamsnap-work-state="authority-pending"','data-dreamsnap-work-state="invalid-url"'])
    assert(detail.includes(marker),marker);
  for(const forbidden of ['getPublicCommunityMedia','callPublicCommunityRpc','community_get_gallery_dreamsnap_public_v1',
      'community_get_public_media_storage_v2','fetch(','entryId','officialResult','workId}'])
    assert(!detail.includes(forbidden),forbidden);
  assert(!read('src/routes/gallery/dreamsnaps/+page.svelte').includes('getPublicCommunityMedia'));
});
test('Saved links require typed accessible Work and old Gallery/Q&A direct links reject ambiguous WorkIDs',()=>{
  const saved=read('src/routes/gallery/my/+page.svelte');
  assert(saved.includes('resolveTypedWorkRoute'));
  assert(saved.includes('saved?.accessible !== true'));
  assert(saved.includes('data-saved-typed-work="unavailable"'));
  assert(!saved.includes('href={saved.accessible ?'));
  const gallery=read('src/routes/gallery/+page.svelte');
  const qa=read('src/routes/qa/+page.svelte');
  assert(gallery.includes("parseTypedWorkQuery(to.url.search,'work')"));
  assert(gallery.includes('data-gallery-state="invalid-work-url"'));
  assert(qa.includes('parseTypedWorkQuery(params,typedParam)'));
  assert(qa.includes('data-qa-state="invalid-work-url"'));
  assert(gallery.includes("community_get_gallery_public_v1"));
  assert(qa.includes("community_get_tip_public_v1"));
});
test('8 locale failclosed Community DreamSnaps copy remains available without supported public media',()=>{
  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  assert.deepEqual(Object.keys(DREAMSNAPS_PRIVACY_COPY).sort(),locales.sort());
  for(const locale of locales)for(const key of ['community','communityUnavailable','legacyUnavailable']){
    assert(DREAMSNAPS_PRIVACY_COPY[locale][key].length>3,locale+'/'+key);
  }
});
