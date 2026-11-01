import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  canonicalWorkId,parseTypedWorkQuery,resolveTypedWorkRoute
} from '../src/lib/community/typed-work-route.js';

const file = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gallery=file('src/routes/gallery/+page.svelte');
const qa=file('src/routes/qa/+page.svelte');
const creator=file('src/routes/creator/+page.svelte');
const id='11111111-1111-4111-8111-111111111111';

test('Gallery ?work strict parser inherited from accepted WEB222: invalid/ambiguous/cross-type keys',()=>{
  assert.deepEqual(parseTypedWorkQuery('?work='+id,'work'),{status:'valid',workId:id});
  for(const qs of [
    '?work=', '?work=not-a-uuid','?work=00000000-0000-0000-0000-000000000000',
    '?work='+id+'&work='+id,'?work='+id+'&tip='+id,'?question='+id,
    '?tip='+id,'?work='+id+'&unknown=1','?work='+id+'%26question%3D'+id
  ])assert.equal(parseTypedWorkQuery(qs,'work').status,'invalid',qs);
  assert.equal(resolveTypedWorkRoute('','dreamsnap',id).href,'/dreamsnaps/');
  assert.equal(resolveTypedWorkRoute('','dreamsnap',id).status,'gated');
  assert.equal(canonicalWorkId(id.toUpperCase()),id);
});

test('Gallery list and detail have separate version guards against stale route or query',()=>{
  for(const fragment of [
    'let routeVersion = 0, browseVersion = 0, detailVersion = 0',
    '++browseVersion;', '++detailVersion;', 'works = [];',
    'browseBusy = false;', 'detailBusy = false;',
    'const generation = ++browseVersion',
    'expectedRoute !== routeVersion || generation !== browseVersion || invalidWorkUrl',
    'const generation = ++detailVersion',
    'expectedRoute !== routeVersion || generation !== detailVersion || invalidWorkUrl',
    'if (expectedRoute === routeVersion && generation === browseVersion)',
    'if (expectedRoute === routeVersion && generation === detailVersion)',
    'requestedQuery = query.trim()',
    'PUBLIC_GALLERY_UNAVAILABLE'
  ])assert.ok(gallery.includes(fragment),fragment);
  assert.ok(!gallery.includes('works = await client.searchPublicWorks'));
  assert.ok(!gallery.includes('finally { busy = false; }'));
});

test('Gallery list click validates canonical ID and response identity/type before rendering Media Detail',()=>{
  for(const fragment of [
    'const id = canonicalWorkId(workId)',
    'if (!id || invalidWorkUrl || expectedRoute !== routeVersion) return;',
    'p_work_id: id',
    'canonicalWorkId(detail.workId) !== id',
    "detail.workType !== 'gallery'",
    "detail.work_type !== 'gallery'",
    "canonicalWorkId(work?.work_id) !== null",
    "(work?.work_type ?? work?.workType) === 'gallery'",
    "resolveTypedWorkRoute(base,work?.work_type ?? work?.workType"
  ])assert.ok(gallery.includes(fragment),fragment);
  assert.ok(gallery.includes("parseTypedWorkQuery(to.url.search,'work')"));
});

test('accepted Q&A parser, Creator generation and unaccepted DreamSnaps remain unmodified',()=>{
  assert.match(qa,/let routeGeneration = 0, searchGeneration = 0, detailGeneration = 0/);
  assert.match(qa,/parseTypedWorkQuery\(params, kind\)/);
  assert.match(qa,/expectedRoute === routeGeneration && generation === detailGeneration/);
  assert.match(creator,/resolveTypedWorkRoute/);
  assert.match(creator,/if \(current !== generation\)/);
  assert.match(creator,/data-typed-work-route="dreamsnap-gated"/);
  assert.ok(!gallery.includes('community_get_gallery_dreamsnap_public_v1'));
  assert.ok(!gallery.includes('community-public-media'));
  assert.ok(!gallery.includes('dreamsnaps/community/?work='));
});
