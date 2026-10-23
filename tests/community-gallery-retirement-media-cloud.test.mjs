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
  assert.match(media,/createSignedUrl\(String\(media.storageKey\),\s*300\)/);
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

test('current Gallery revision media requires the public Edge proxy, historical media is denied',()=>{
 const migration=read('supabase/migrations/20261024235500_community_gallery_retirement_gateway_preflight_v1.sql');
 assert.match(migration,/community_gallery_media_gateway_v1/);
 assert.match(migration,/private\.is_discoverable_work\(w\.work_id\)/);
 assert.match(migration,/w\.current_published_revision_id=r\.revision_id/);
 assert.match(migration,/galleryManaged',true,'publiclyAccessible',false/);
 assert.match(migration,/grant execute on function public\.community_gallery_media_gateway_v1\(uuid\)\s+to service_role/);
 assert.match(media,/rpc\(\s*'community_gallery_media_gateway_v1'/);
 assert.match(media,/gallery\.galleryManaged === true/);
 assert.match(media,/if \(gallery\.publiclyAccessible !== true\)/);
 assert.match(media,/\.download\(String\(gallery\.storageKey\)\)/);
 assert.match(media,/'CDN-Cache-Control':'no-store'/);
 assert.match(media,/'Surrogate-Control':'no-store'/);
 assert.match(media,/'X-Content-Type-Options':'nosniff'/);
 assert.match(media,/rawStorageSignedUrlIssued:false/);
 assert.match(media,/transport:'edge_proxy'/);
 assert.match(cloud,/previouslyIssuedUrlsRevoked:false/);
});
test('owner retirement preflight consumes 09 INT graph and never enables premature PRIVATE',()=>{
 const migration=read('supabase/migrations/20261024235500_community_gallery_retirement_gateway_preflight_v1.sql');
 const authorized=read('supabase/functions/community-query/index.ts');
 const acceptance=read('supabase/staging/acceptance/gallery-retirement-gateway-preflight-v1.sql');
 assert.match(migration,/private\.gallery_photo_dependency_snapshot_v1\(p_gallery_work_id\)/);
 assert.match(migration,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(migration,/GALLERY_RETIREMENT_NOT_OWNER/);
 assert.match(migration,/'graphComplete',coalesce\(\(v_dep->>'graphComplete'\)::boolean,false\)/);
 assert.match(migration,/'operationAuthorized',false/);
 assert.match(migration,/'deleteAuthorized',false/);
 assert.match(migration,/'unpublishKeepPrivateAuthorized',false/);
 assert.match(migration,/'cdnAndBrowserPurgeProven',false/);
 assert.match(migration,/'cloudEntitlementVerified',false/);
 assert.match(authorized,/galleryRetirementPreflight: 'community_gallery_retirement_preflight_v1'/);
 assert.match(authorized,/case 'galleryRetirementPreflight'/);
 assert.match(authorized,/community_authorize_session/);
 assert.match(acceptance,/HISTORICAL_GALLERY_IMAGE_STILL_TOKENABLE/);
 assert.match(acceptance,/PREMATURE_PRIVATE_TRANSITION_ACCEPTED/);
 assert.match(acceptance,/NONOWNER_PREFLIGHT_SUCCEEDED/);
 assert.match(acceptance,/rollback;\s*$/);
 assert.match(cloud,/blockedOperations:\['delete','unpublishKeepPrivate','restorePrivate','republishPrivate'\]/);
});

test('retirement preflight does not claim universal signed token issuance halt',()=>{
 const migration=read('supabase/migrations/20261024235800_community_gallery_retirement_other_token_issuers_v1.sql');
 const signedOwnerRead=read('supabase/functions/community-media/index.ts');
 const acceptance=read('supabase/staging/acceptance/gallery-retirement-gateway-preflight-v1.sql');
 assert.match(migration,/'newPublicGalleryStorageSignedUrlIssued',false/);
 assert.match(migration,/'authenticatedOwnerReadMayMintStorageSignedUrl',true/);
 assert.match(migration,/GALLERY_AUTHENTICATED_MEDIA_READ_STILL_MINTS_SIGNED_URL/);
 assert.match(signedOwnerRead,/if \(action === 'read'\)/);
 assert.match(signedOwnerRead,/\.createSignedUrl\(media\.storageKey, 300\)/);
 assert.match(acceptance,/authenticatedOwnerReadMayMintStorageSignedUrl/);
 assert.match(cloud,/authenticatedOwnerReadStillMintsSignedStorageUrl:true/);
});
