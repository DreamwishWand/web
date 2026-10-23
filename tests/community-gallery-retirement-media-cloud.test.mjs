import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261024222000_community_gallery_verified_subject_public_lookup_v1.sql');
const query=read('supabase/functions/community-public-query/index.ts');
const media=read('supabase/functions/community-public-media/index.ts');
const negative=read('supabase/migrations/20261024201000_gallery_retirement_negative_gate_v1.sql');
const cloud=read('src/lib/community/gallery-retirement-contract.ts');

test('reviewed public subject lookup is service-only and never guesses identities',()=>{
  assert.match(migration,/community_list_verified_gallery_subjects_v1/);
  assert.match(migration,/verification_state='verified'/);
  assert.match(migration,/displayName',null/);
  assert.match(migration,/SceneItemId /);
  assert.match(migration,/revoke all on function public.community_list_verified_gallery_subjects_v1\(text,integer\)/);
  assert.match(migration,/from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public.community_list_verified_gallery_subjects_v1\(text,integer\) to service_role/);
  assert.match(query,/'community_list_verified_gallery_subjects_v1'/);
  assert.match(query,/sanitizeVerifiedGallerySubjects\(payload\)/);
  assert.match(query,/Number\(raw\)>100/);
  assert.match(query,/rpc === 'community_list_verified_gallery_subjects_v1'/);
  assert.match(query,/noStore \? 'private, no-store'/);
  assert.match(cloud,/displayNamesVerified:false/);
});

test('new media resolver responses cannot cache bearer signed URLs',()=>{
  assert.match(media,/'Cache-Control': 'private, no-store'/);
  assert.match(media,/'Pragma': 'no-cache'/);
  assert.doesNotMatch(media,/'Cache-Control': 'public, max-age=60'/);
  // NO fabricated assertion that an already-issued Storage URL disappears.
  assert.match(media,/createSignedUrl\(String\(media.storageKey\), 300\)/);
  assert.match(cloud,/previouslyIssuedUrlsRevoked:false/);
  assert.match(cloud,/oldUrlReplayTested:false/);
  assert.match(cloud,/deletionAuthorized:false/);
  assert.match(cloud,/cloudPrivateTransitionAuthorized:false/);
});

test('staged retirement remains fail closed until actual URL and dependency proof',()=>{
  assert.match(negative,/GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN/);
  assert.match(negative,/graphComplete',false/);
  assert.match(negative,/retirementAuthorized',false/);
  assert.match(negative,/issuedSignedUrlRevocationProven',false/);
});
