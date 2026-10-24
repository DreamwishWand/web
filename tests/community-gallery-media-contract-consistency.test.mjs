import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const typed=read('src/lib/community/gallery-retirement-contract.ts');
const owner=read('supabase/functions/community-media/index.ts');
const publicEdge=read('supabase/functions/community-public-media/index.ts');
const ownerGate=read('supabase/migrations/20261025000800_gallery_owner_historical_cover_issuer_guard_v1.sql');
const ownerPreflight=read('supabase/migrations/20261025001000_gallery_cloud_preservation_readiness_v1.sql');

function immutableContract(name){
  const m=typed.match(new RegExp('export const '+name+'=Object\\.freeze\\(\\{([\\s\\S]*?)\\} as const\\);'));
  assert.ok(m,'missing contract '+name);
  return m[1];
}

test('legacy Gallery retirement metadata and newer owner issuer contract agree: no NEW Gallery Storage URL',()=>{
  const old=immutableContract('GALLERY_MEDIA_RETIREMENT_V1');
  const preflight=immutableContract('GALLERY_RETIREMENT_OWNER_PREFLIGHT_V1');
  const boundary=immutableContract('GALLERY_OWNER_CLOUD_RETIREMENT_BOUNDARY_V1');
  assert.match(old,/authenticatedOwnerReadMayCreateNewSignedUrl:false/);
  assert.doesNotMatch(old,/authenticatedOwnerReadMayCreateNewSignedUrl:true/);
  assert.match(preflight,/authenticatedOwnerReadStillMintsSignedStorageUrl:false/);
  assert.match(boundary,/galleryOwnerStorageSignedUrlIssuerEnabled:false/);
  assert.match(ownerPreflight,/'authenticatedOwnerReadMayMintStorageSignedUrl',false/);
  // Previously minted credentials and fetched/cached bytes are NOT revoked.
  assert.match(old,/existingSignedUrlMaxLifetimeSeconds:300/);
  assert.match(old,/previouslyIssuedUrlsRevoked:false/);
  assert.match(old,/oldUrlReplayTested:false/);
  assert.match(old,/cacheOrCDNRevocationProven:false/);
  assert.match(old,/inFlightResponsesCannotBeRevoked:true/);
  assert.match(old,/publicVisibilityCannotGuaranteeImmediateErase:true/);
  assert.match(preflight,/historicalStorageURLsMayStillBeRedeemed:true/);
  assert.match(boundary,/oldStorageBearerTokensImmediatelyRevoked:false/);
  assert.match(boundary,/distributedCDNCachePurged:false/);
});

test('owner request executes authoritative historical Gallery classification BEFORE legacy nonGallery issuer',()=>{
  const action=owner.indexOf("if (action === 'read' || action === 'galleryReadBytes')");
  const gateway=owner.indexOf("'community_gallery_owner_media_read_v1'",action);
  const gallery=owner.indexOf('if (gallery.galleryManaged===true)',gateway);
  const authorized=owner.indexOf('if(gallery.ownerAuthorized!==true)',gallery);
  const digest=owner.indexOf("crypto.subtle.digest('SHA-256',bytes)",authorized);
  const binary=owner.indexOf('return new Response(bytes,',digest);
  const blockedNonGallery=owner.indexOf("if(action==='galleryReadBytes')",binary);
  const issuer=owner.indexOf('.createSignedUrl(media.storageKey, 300)',blockedNonGallery);
  assert.ok(action>=0&&gateway>action&&gallery>gateway&&authorized>gallery);
  assert.ok(digest>authorized&&binary>digest&&blockedNonGallery>binary&&issuer>blockedNonGallery);
  assert.doesNotMatch(owner.slice(gallery,blockedNonGallery),/\.createSignedUrl\(/);
  assert.match(owner.slice(gallery,blockedNonGallery),/rawStorageSignedUrlIssued:false/);
  assert.match(owner.slice(gallery,blockedNonGallery),/GALLERY_OWNER_MEDIA_FORBIDDEN/);
  assert.match(owner.slice(blockedNonGallery,issuer),/MEDIA_NOT_GALLERY/);
  assert.match(ownerGate,/where f\.cover_media_id=p_media_id/);
  assert.match(ownerGate,/v_gallery:=v_gallery or v_photo_bound or v_cover_bound/);
  assert.match(ownerGate,/v_media\.owner_account_id is distinct from v_account/);
  assert.match(ownerGate,/'signedStorageUrlIssued',false/);
  // This does not remove the legacy non-Gallery / DreamSnaps code path.
  assert.match(owner,/if \(action === 'dreamsnapJudgeRead'\)/);
  assert.match(owner.slice(issuer),/signedUrl: signed\.signedUrl/);
});

test('public Gallery gateway also authenticates every stream, hashes before bytes and isolates nonGallery signer',()=>{
  const gateway=publicEdge.indexOf("'community_gallery_media_gateway_v1'");
  const gallery=publicEdge.indexOf('if (gallery.galleryManaged === true)',gateway);
  const authorized=publicEdge.indexOf('if (gallery.publiclyAccessible !== true)',gallery);
  const digest=publicEdge.indexOf("crypto.subtle.digest('SHA-256',verifiedBytes)",authorized);
  const binary=publicEdge.indexOf('return new Response(verifiedBytes,',digest);
  const fallback=publicEdge.indexOf('.createSignedUrl(String(media.storageKey),300)',binary);
  assert.ok(gateway>=0&&gallery>gateway&&authorized>gallery);
  assert.ok(digest>authorized&&binary>digest&&fallback>binary);
  assert.doesNotMatch(publicEdge.slice(gallery,fallback),/\.createSignedUrl\(/);
  assert.match(publicEdge,/GALLERY_MEDIA_STORAGE_CHECKSUM_MISMATCH/);
  assert.match(publicEdge,/rawStorageSignedUrlIssued:false/);
});

test('Cloud entitlement and retirement remain independently blocked',()=>{
  const old=immutableContract('GALLERY_MEDIA_RETIREMENT_V1');
  const cloud=immutableContract('GALLERY_CLOUD_PRESERVATION_READINESS_V1');
  const boundary=immutableContract('GALLERY_OWNER_CLOUD_RETIREMENT_BOUNDARY_V1');
  assert.match(old,/cloudPrivateTransitionAuthorized:false/);
  assert.match(old,/deletionAuthorized:false/);
  assert.match(cloud,/cloudEntitlementSourceConfigured:false/);
  assert.match(cloud,/incompleteCrossProductGraphFailsClosed:true/);
  assert.match(cloud,/disabledOperations:\['unpublishKeepPrivate','delete','restorePrivate','republishPrivate'\]/);
  assert.match(boundary,/crossProductDependencyGraphComplete:false/);
  assert.match(boundary,/cloudPrivateRestoreVerified:false/);
});
