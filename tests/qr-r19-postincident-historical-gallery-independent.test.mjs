import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/migrations/20261025003030_r19_preset_postcommit_read_suppression.sql',import.meta.url),'utf8');
const source138=readFileSync(new URL('../supabase/migrations/20261025003020_r18_preset_integrity_incident_commit_veto.sql',import.meta.url),'utf8');

function sqlFunction(name) {
  const nameRe=name.replaceAll('.', '\\.');
  const re=new RegExp('create or replace function\\s+'+nameRe+'\\s*\\(','gi');
  const matches=[...source.matchAll(re)];
  assert.equal(matches.length,1,'duplicate/wrong definitive R19 function '+name);
  const start=matches[0].index;
  const next=source.indexOf('create or replace function',start+matches[0][0].length);
  return source.slice(start,next<0?source.length:next);
}

test('QR R19 new historical Gallery association remains covered by LIVE dynamic quarantine, not trigger-only snapshot',()=>{
  const fn=sqlFunction('private.preset_storage_work_quarantined_r19');
  assert.match(fn,/from private\.preset_storage_integrity_incidents_r18 i/);
  assert.match(fn,/join private\.preset_storage_reservations_r18 r/);
  assert.match(fn,/join public\.preset_revisions pr/);
  assert.match(fn,/(?:from|join) public\.gallery_revision_presets gp/);
  assert.match(fn,/join public\.community_work_revisions wr/);
  assert.match(fn,/wr\.work_id=p_work_id/);
  assert.doesNotMatch(fn,/current_published_revision_id/);
  assert.match(fn,/QUARANTINED_PENDING_OPERATOR/);
});

test('QR R19 changed read/signed gateway SQL denies work and actual immutable Blob, not just search index',()=>{
 const edge=sqlFunction('public.wep_get_accessible_preset_blob');
 assert.match(edge,/perform private\.preset_storage_assert_blob_readable_r19\(v_blob.blob_id\)/);
 for (const name of ['public.community_get_preset','public.community_get_gallery_public_v1','public.community_get_gallery_v1']) {
  const fn=sqlFunction(name);
  assert.match(fn,/perform private\.preset_storage_assert_work_readable_r19\(v_work.work_id\)/,name);
 }
 const search=sqlFunction('private.preset_storage_search_reinsert_guard_r19');
 assert.match(search,/private\.preset_storage_work_quarantined_r19\(new.work_id\)/);
 assert.match(source,/before insert or update on public\.search_documents/);
});

test('QR R19 quarantine remains stable across three named RLS restrictive public reads and includes prior-fence incidents',()=>{
  for(const table of ['community_works','search_documents','preset_artifacts']){
    const pattern=new RegExp('on public\\.'+table+' as restrictive for select to anon,authenticated','i');
    assert.match(source,pattern);
  }
  assert.doesNotMatch(sqlFunction('private.preset_storage_blob_quarantined_r19'),/observed_lease_fence\s*=/);
  assert.match(source138,/perform private\.preset_storage_assert_no_integrity_incident_r18\(v_res.reservation_id\)/);
});

test('QR R19 administrative readiness is a terminal non-resolution and cleanup inventory cannot authorize remove',()=>{
 for(const name of ['public.community_preset_storage_resolution_readiness_r19','public.community_preset_storage_cleanup_inventory_r19']){
  const fn=sqlFunction(name);
  assert.match(fn,/physicalCleanupAuthorized',false|'physicalDeleteAuthorized',false/);
  assert.match(fn,/for update/);
 }
 assert.match(source,/'versionFencedResolutionAuthorized',false/);
 assert.match(source,/'operatorApprovalRequired',true/);
 assert.match(source,/'cloudAndLinkedProfileReferenceGraphProven',false/);
 assert.match(source,/'previouslyIssuedBearerAndCdnRevocationProven',false/);
 assert.doesNotMatch(source,/incident_state='RESOLVED'/);
 assert.doesNotMatch(source,/storage\.remove\(|storage\.copy\(/);
});
