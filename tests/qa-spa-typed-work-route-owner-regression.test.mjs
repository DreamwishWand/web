import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTypedWorkQuery} from '../src/lib/community/typed-work-route.js';

const src=readFileSync('src/routes/qa/+page.svelte','utf8');
const question='44444444-4444-4444-8444-444444444444';
const tip='33333333-3333-4333-8333-333333333333';

test('Issue214 QR223: same component navigation reparses URL and clears old selected Work',()=>{
  assert.match(src,/afterNavigate\s*\(/);
  assert.match(src,/const generation = \+\+routeGeneration/);
  const start=src.indexOf('afterNavigate('),firstFetch=src.indexOf('void search(generation)',start);
  const block=src.slice(start,firstFetch);
  for(const marker of ['++searchGeneration','++detailGeneration','selected = null','selectedKind = null',
      'rows = []','invalidDetailUrl = false','parseTypedWorkQuery(params, kind)',
      "if (parsed.status !== 'valid'"])assert(block.includes(marker),marker);
  assert(!src.includes('onMount('));
});
test('Issue214 QR223: stale Request response never overwrites a later route',()=>{
  for(const marker of ['expectedRoute === routeGeneration && generation === searchGeneration',
    'expectedRoute === routeGeneration && generation === detailGeneration',
    'selected = result ?? null','selectedKind = result ? kind : null',
    'browseBusy = false','detailBusy = false'])
    assert(src.includes(marker),marker);
  assert(src.includes("community_get_question_public_v1"));
  assert(src.includes("community_get_tip_public_v1"));
  assert(src.includes("client.query<any>('question'"));
  assert(src.includes("p_unanswered_only: false"));
});
test('typed Query/parser denies mixed, repeated, malformed and unknown without Q&A Detail calls',()=>{
  assert.equal(parseTypedWorkQuery('?tip='+tip,'tip').workId,tip);
  assert.equal(parseTypedWorkQuery('?question='+question,'question').workId,question);
  for(const qs of ['?tip='+tip+'&tip='+tip,'?tip='+tip+'&question='+question,
    '?tip='+tip+'&x=1','?tip=invalid','?tip=','?tip='+tip+'&type=questions'])
    assert.equal(parseTypedWorkQuery(qs,'tip').status,'invalid',qs);
  assert(src.includes("params.getAll('type').length > 1"));
  assert(src.includes("['questions', 'tips'].includes"));
});
