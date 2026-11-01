import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  resolveTypedWorkRoute, canonicalWorkId, parseTypedWorkQuery
} from '../src/lib/community/typed-work-route.js';
import {
  DREAMSNAPS_PRIVACY_COPY, dreamsnapPrivacyCopy
} from '../src/lib/dreamsnaps/privacy-copy.js';

const workId='55555555-5555-4555-8555-555555555555';
const creator=readFileSync(new URL('../src/routes/creator/+page.svelte',import.meta.url),'utf8');

test('type resolver routes only four exact Work types, never uses a DreamSnaps WorkID in a public link',()=>{
  const paths={
    gallery:'/gallery/?work='+workId,
    question:'/qa/?question='+workId,
    tip:'/qa/?tip='+workId,
    dreamsnap:'/dreamsnaps/'
  };
  for(const [type,path] of Object.entries(paths)){
    const result=resolveTypedWorkRoute('/wand/',type,workId.toUpperCase());
    assert.equal(result.href,'/wand'+path);
    assert.equal(result.status,type==='dreamsnap'?'gated':'ready');
    assert.equal(result.workType,type);
  }
  assert.equal(resolveTypedWorkRoute('','dreamsnap',workId).availability,'pending-public-detail-authority');
  assert.ok(!resolveTypedWorkRoute('','dreamsnap',workId).href.includes(workId));
});

test('invalid type and any missing, NIL, malformed, or injected UUID must not create links',()=>{
  for(const type of [null,undefined,'','DREAMSNAP','preset','__proto__','constructor','toString','Tip','new'])
    assert.deepEqual(resolveTypedWorkRoute('',type,workId),{status:'unavailable',href:null,workType:null});
  for(const input of [null,undefined,0,'','abc','00000000-0000-0000-0000-000000000000',
    workId+'&tip='+workId,'/qa/?tip='+workId,workId.replaceAll('-','')]){
    for(const type of ['gallery','question','tip','dreamsnap'])
      assert.equal(resolveTypedWorkRoute('',type,input).href,null,JSON.stringify({type,input}));
  }
  assert.equal(canonicalWorkId(workId.toUpperCase()),workId);
});

test('private/held/retired/suppressed Work can never get an actionable Creator work link',()=>{
  for(const source of [
    {accessible:false},{retired:true},{isRetired:true},{deleted:true},
    {privacySuppressed:true},{visibility:'private'},{visibility:'unlisted'},
    {work_visibility:'PRIVATE'},{lifecycleState:'draft'},{lifecycle_state:'deleted'},
    {moderationState:'held'},{moderation_state:'removed'},{accountState:'restricted'}
  ]) for(const type of ['gallery','question','tip','dreamsnap'])
    assert.equal(resolveTypedWorkRoute('',type,workId,source).href,null,JSON.stringify({type,source}));
});

test('Creator direct query is strict; duplicate/mixed params never become public reads',()=>{
  assert.deepEqual(parseTypedWorkQuery('?id='+workId,'id'),{status:'valid',workId});
  for(const s of ['', '?id=', '?id=abc','?id='+workId+'&id='+workId,
    '?id='+workId+'&tip='+workId,'?id='+workId+'&unknown=1'])
    assert.equal(parseTypedWorkQuery(s,'id').status,'invalid',s);
});

test('main-based Creator uses verified redaction and gated root route without fallback',()=>{
  for(const marker of ['resolveTypedWorkRoute','parseTypedWorkQuery',
    "route.status === 'ready'","route.status === 'gated'",
    'data-typed-work-route="dreamsnap-gated"','data-typed-work-route="unavailable"',
    '++generation','if (current !== generation)', 'profile = null;', 'works = []'])
    assert.ok(creator.includes(marker),marker);
  assert.ok(!creator.includes("work.work_type === 'question' ? 'question' : 'tip'"));
  assert.ok(!creator.includes('/qa/?${work.work_type'));
  assert.ok(creator.includes('dreamsnapPrivacyCopy($locale).communityUnavailable'));
  assert.ok(creator.includes('<div class="card" data-typed-work-route="unavailable" role="status">'));
});

test('eight launch language privacy notices and no new public detail, signer or publishing',()=>{
  const codes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  assert.deepEqual(Object.keys(DREAMSNAPS_PRIVACY_COPY).sort(),codes.sort());
  for(const code of codes){
    const copy=dreamsnapPrivacyCopy(code);
    assert.ok(copy.communityUnavailable.length>10);
    assert.ok(copy.legacyUnavailable.length>10);
  }
  for(const forbidden of ['getPublicCommunityMedia','signMedia','community_get_gallery_dreamsnap_public_v1',
    'community_get_public_media_storage_v2','publishWork','createSignedUrl'])
    assert.ok(!creator.includes(forbidden),forbidden);
});
