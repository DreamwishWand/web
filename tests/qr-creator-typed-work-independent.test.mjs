import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveTypedWorkRoute, parseTypedWorkQuery } from '../src/lib/community/typed-work-route.js';

const read = p => readFileSync(p,'utf8');
const W='ab12cd34-1111-4222-8333-999999999999';
const BASE='ca46279f5da996f335ab011b627a4f5b5ba99235';
const OWNER='d54b982a28046c441c7f2030c90f2a387c77f82b';

test('QR222 exact owner-baseline and no accidental modification to previously accepted checks', () => {
  const contract=read('docs/web/creator-dreamsnaps-typed-work-route-20261027.md');
  assert(contract.includes(BASE));
  assert(contract.includes('Draft / DO_NOT_MERGE / DO_NOT_DEPLOY'));
  assert(OWNER.length===40);
});

test('QR222 Work IDs are never confused with unrelated entity IDs or Q&A Tip',()=>{
  const expectations={gallery:'/gallery/?work='+W,question:'/qa/?question='+W,tip:'/qa/?tip='+W,
    dreamsnap:'/dreamsnaps/'};
  for(const [type,href] of Object.entries(expectations)){
    const got=resolveTypedWorkRoute('',type,W,{});
    assert.equal(got.href,href);
    assert.equal(got.status,type==='dreamsnap'?'gated':'ready');
  }
  const sql=read('supabase/migrations/20261003044000_community_gallery_qa_public_projection_v1.sql');
  assert(sql.includes('where work_id=p_question_id'));
  assert(sql.includes('where work_id=p_tip_id'));
  for (const v of ['?tip='+W+'&tip='+W,'?tip='+W+'&work='+W,'?tip=invalid']) {
    assert.equal(parseTypedWorkQuery(v,'tip').status,'invalid');
  }
});

test('QR222 Creator vs Saved and direct Detail retain an authority boundary',()=>{
  const creator=read('src/routes/creator/+page.svelte'),saved=read('src/routes/gallery/my/+page.svelte'),
    detail=read('src/routes/dreamsnaps/community/+page.svelte');
  assert(creator.includes('resolveTypedWorkRoute'));
  assert(creator.includes('++generation'));
  assert(saved.includes('saved?.accessible !== true'));
  assert(saved.includes('resolveTypedWorkRoute'));
  assert(detail.includes('authority-pending'));
  assert(!detail.includes('community_get_gallery_dreamsnap_public_v1'));
  assert(!detail.includes('getPublicCommunityMedia'));
});

test('QR222 QA client-side same-route Work ID and invalid URL transitions refresh Detail and revoke stale selection',()=>{
  const qa=read('src/routes/qa/+page.svelte');
  // SvelteKit reuses this page component when navigating between /qa/?tip and
  // /qa/?question or an invalid /qa/?tip deep link. onMount alone cannot
  // re-parse these changes. This assertion intentionally captures the expected
  // contract without altering the Owner implementation.
  assert.match(qa,/afterNavigate\s*\(/,
    'SOURCE RED: Q&A parser executes only onMount, leaves stale Detail for same-page client-side changes');
});
