import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync('supabase/migrations/20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql','utf8');
const contract=readFileSync('docs/community/x05-shared-dreamsnaps-public-work-metadata-staged-v1.md','utf8');
const edge=readFileSync('supabase/functions/community-public-query/index.ts','utf8');

test('X05 staging has disjoint WorkID and no fabricated competition Entry or positive publish',()=>{
 for(const required of [
  'work_id uuid primary key references public.dreamsnap_works(work_id)',
  'immutable_photo_revision_id uuid',
  'concept_revision_id uuid',
  'publication_state text not null default \'staged\'',
  "check (publication_state = 'staged')",
  "check (official_voting_authority = 'unknown')",
  "check (wand_voting_authority = 'unknown')",
  "check (rights_provenance = 'unknown')",
  'not exists (select 1 from public.dreamsnap_entries e',
  'not exists (select 1 from public.dreamsnap_gallery_publications gp',
  'dr.integrity_state=\'eligible\'',
  'm.owner_account_id=w.owner_account_id',
  'w.current_published_revision_id=new.concept_revision_id',
  'dw.managed_under13=false'
 ])assert(migration.includes(required),required);
 assert(!/entry_id\s+uuid.*references\s+public\.dreamsnap_entries/i.test(migration),
  'PostEvent must not add a competition EntryID');
});

test('X05 metadata reader reuses Source144 and Source145 yet denies ambiguous/staged/unsafe',()=>{
 for(const required of [
  'private.dreamsnap_public_work_accessible_r20(p_work_id)',
  'public.community_get_gallery_dreamsnap_public_v1(p_work_id)',
  'gp.revision_id=e.entry_revision_id',
  'w.current_published_revision_id=e.entry_revision_id',
  'c.lifecycle_state in (\'results\',\'closed\')',
  'e.managed_under13=false',
  "if exists(select 1 from private.dreamsnap_post_event_staged_v1",
  "'contractVersion','wand.dreamsnaps.public-work-detail-metadata@1'",
  "'kind','OriginalCompetition'",
  "'entryId',v_identity.entry_id",
  "'entryRevisionId',v_identity.entry_revision_id",
  "'publishedRevisionId',v_identity.published_revision_id",
  "'media',false",
  "'social',false",
  "'officialResults',false",
  "revoke all on function private.dreamsnap_shared_public_work_metadata_v1(uuid)"
 ])assert(migration.includes(required),required);
 assert(!migration.includes('grant execute on function'), 'new metadata read is not public');
 for(const forbidden of ['createSignedUrl','storageKey','p_auth_subject','private.dreamsnap_public_official_result'])
  assert(!migration.includes(forbidden),forbidden);
 assert(!edge.includes('dreamsnap_shared_public_work_metadata_v1'),
  'public Edge must not route new metadata reader');
 assert(!edge.includes('dreamsnap_post_event_staged_v1'),
  'public Edge must not read stage');
});

test('X05 contract distinguishes original, PostEvent and unresolved operator authority',()=>{
 for(const term of ['OriginalCompetition','PostEventCreation',
  'EntryID','WorkID','NEED_SOURCE','NEED_SIGNED_RUNTIME',
  'DO_NOT_MERGE','DO_NOT_DEPLOY','X07 Saved','X08 Share',
  'not exposed','300-second'])
   assert(contract.includes(term),term);
});
