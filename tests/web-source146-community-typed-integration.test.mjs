import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseTypedWorkQuery,resolveTypedWorkRoute} from '../src/lib/community/typed-work-route.js';

const read=p=>readFileSync(p,'utf8');
const gitBlob=p=>{
  const bytes=readFileSync(p);
  return createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
};
const manifest=JSON.parse(read('docs/integration/web-source146-community-typed-owner-manifest-20261028.json'));
const work='33333333-3333-4333-8333-333333333333';

test('Source146 combined provenance: all 39 WEB accepted files byte-identical; unrelated branches not overlaid',()=>{
  assert.equal(manifest.contract,'08web.source146-community-web222.integrated-owner@1');
  assert.equal(manifest.baseline.communityHead,'5ddf4d23689643340c8d547e47b58f211e03291e');
  assert.equal(manifest.baseline.webHead,'99ed88fc717cf18bb4127695f16d6949e7609463');
  assert.equal(manifest.overlay.count,39);
  assert.equal(manifest.overlay.files.length,39);
  for(const f of manifest.overlay.files)assert.equal(gitBlob(f.path),f.blob,'WEB accepted Git Blob mismatch '+f.path);
  for(const f of manifest.overlay.files)assert(!/^(supabase\/|src\/lib\/wep\/|src\/lib\/ddv\/|src\/routes\/editor\/)/.test(f.path),'unexpected overlay '+f.path);
});

test('Source141–146 migration git blobs exactly backend accepted; Source146 no OR policy bypass',()=>{
  const set=manifest.communityAuthority.source141To146;
  assert.equal(set.length,6);
  for(const f of set)assert.equal(gitBlob(f.path),f.blob,'backend migration tampered '+f.path);
  const source146=read(set.find(f=>f.path.includes('source146')).path);
  for(const invariant of ['private.generic_public_search_work_accessible_r21',
    'private.dreamsnap_public_work_accessible_r20',
    'private.is_discoverable_work',
    'drop policy if exists search_documents_public_read',
    'create policy search_documents_public_read',
    'coalesce(private.generic_public_search_work_accessible_r21(work_id), false)',
    'revoke all on function private.generic_public_search_work_accessible_r21'])
    assert(source146.includes(invariant),invariant);
  assert.equal((source146.match(/create policy search_documents_public_read/g)||[]).length,1);
  const source143=read(set.find(f=>f.path.includes('account_global_official')).path);
  assert(/null/i.test(source143));
  const source144=read(set.find(f=>f.path.includes('f08_f09')).path);
  assert(source144.includes('private.dreamsnap_public_work_accessible_r20'));
  const source145=read(set.find(f=>f.path.includes('legacy_dreamsnap')).path);
  assert(source145.includes('private.dreamsnap_public_work_accessible_r20'));
});

test('Source146 integrated Edge is newer accepted no-store authority; allowlist & sanitizer preserved',()=>{
  const edgePath=manifest.communityAuthority.edge.path,edge=read(edgePath);
  assert.equal(gitBlob(edgePath),'232c71ec6b7b275a1f2652ffacd3de976f178810');
  const noStore=edge.slice(edge.indexOf('const noStore ='),edge.indexOf('const { data, error }'));
  assert(noStore.includes('community_get_dreamsnap_results_public_v1'));
  assert(noStore.includes('community_get_gallery_dreamsnap_public_v1'));
  assert(noStore.includes('community_search_gallery_dreamsnaps_public_v1'));
  assert(noStore.includes('community_list_dreamsnap_result_rounds_public_v1'));
  assert(edge.includes("'Cache-Control': noStore ? 'private, no-store' : 'public, max-age=30'"));
  assert(edge.includes('return reply(data, 200, noStore)'));
  assert(edge.includes("return reply({ error: notFound ? 'NOT_FOUND' : 'PUBLIC_QUERY_FAILED' }, notFound ? 404 : 400, noStore)"));
  for(const rpc of ['community_get_gallery_dreamsnap_public_v1','community_search_gallery_dreamsnaps_public_v1',
    'community_get_dreamsnap_results_public_v1','community_get_question_public_v1','community_get_tip_public_v1'])
    assert(edge.includes("'"+rpc+"'"),'allowlist '+rpc);
  for(const name of ['sanitizeSearchQuestions','sanitizeDreamsnapGallerySearch','singleUuidPayload',
    "if (!ALLOWED.has(rpc))","SCENE_PUBLIC_READER_COMPATIBILITY_UNVERIFIED"])
    assert(edge.includes(name),name);
  assert(edge.indexOf('if (params === null)')<edge.indexOf('const noStore ='),
    'accepted source pre-dispatch error behavior changed; re-review required');
});

test('WEB222 WorkID type routes & Community DreamSnaps no-ID fail-closed survive integration',()=>{
  assert.equal(resolveTypedWorkRoute('', 'gallery',work).href,'/gallery/?work='+work);
  assert.equal(resolveTypedWorkRoute('', 'question',work).href,'/qa/?question='+work);
  assert.equal(resolveTypedWorkRoute('', 'tip',work).href,'/qa/?tip='+work);
  const gated=resolveTypedWorkRoute('', 'dreamsnap',work);
  assert.equal(gated.status,'gated');
  assert.equal(gated.href,'/dreamsnaps/');
  assert(!gated.href.includes(work));
  for(const type of ['unknown','__proto__','DREAMSNAP'])assert.equal(resolveTypedWorkRoute('',type,work).href,null);
  for(const state of [{visibility:'private'}, {lifecycle_state:'deleted'},{retired:true},{moderationState:'held'},{privacySuppressed:true}])
    assert.equal(resolveTypedWorkRoute('','dreamsnap',work,state).href,null);
  for(const qs of ['?tip='+work+'&tip='+work,'?question='+work+'&tip='+work,
      '?question='+work+'&x=1','?tip=invalid'])
    assert.equal(parseTypedWorkQuery(qs,'tip').status,'invalid');
  const qa=read('src/routes/qa/+page.svelte'),creator=read('src/routes/creator/+page.svelte');
  for(const s of ['afterNavigate(','++routeGeneration','++searchGeneration','++detailGeneration',
    'selectedKind = null','rows = []','parseTypedWorkQuery(params, kind)'])
    assert(qa.includes(s),'QA Work reparse '+s);
  assert(creator.includes('data-typed-work-route="dreamsnap-gated"'));
  const detail=read('src/routes/dreamsnaps/community/+page.svelte');
  for(const forbidden of ['getPublicCommunityMedia','community_get_gallery_dreamsnap_public_v1','callPublicCommunityRpc'])
    assert(!detail.includes(forbidden));
  const saved=read('src/routes/gallery/my/+page.svelte');
  assert(saved.includes('saved?.accessible !== true'));
  assert(saved.includes('resolveTypedWorkRoute'));
});

test('No risky positive ops are implied by integrated source provenance',()=>{
  for(const gate of ['publicDreamsnapPositiveDetail','publicMediaSigner','savedShareE2E','cloud',
    'nativeWriter','physicalCleanup','stageDeploy','migrationDeploy','signedActors','independentCombinedQR'])
    assert.equal(manifest.gates[gate],false,gate);
});
