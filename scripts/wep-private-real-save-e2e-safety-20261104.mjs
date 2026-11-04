/**
 * Owner-local World E2E harness policy. Pure functions only.
 * CI may test this policy with synthetic data, but MUST NEVER invoke the
 * owner-private P1G executor or collect any real profile/SHA/receipt.
 */
export const WEP_PRIVATE_624_BID = '52BD625D9B4E0053';
export const WEP_PRIVATE_626_BID = '9A239D3DB569756D';

export function requireOwnerPrivateScope({
  env = process.env,
  sourcePath = env.WEP_PRIVATE_P1G_PATH,
  claimedBid = env.WEP_PRIVATE_BUILD_ID,
  ownerAck = env.WEP_PRIVATE_LOCAL_ONLY_ACK,
  externalBuildConfirmed = env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED,
  targetUrl = env.WEP_PRIVATE_LOCAL_URL ?? 'http://127.0.0.1:4197/editor/world/'
} = {}) {
  if (env.CI || env.GITHUB_ACTIONS)
    throw Error('PRIVATE_SAVE_CI_FORBIDDEN');
  if (!sourcePath || typeof sourcePath !== 'string')
    return Object.freeze({status:'NOT_RUN_PRIVATE_SOURCE_NOT_AVAILABLE',url:null,bid:null});
  if (ownerAck !== 'YES' || externalBuildConfirmed !== 'YES')
    return Object.freeze({status:'NOT_RUN_EXTERNAL_BUILD_CONSENT_REQUIRED',url:null,bid:null});
  const bid = String(claimedBid ?? '').trim().toUpperCase();
  if (![WEP_PRIVATE_624_BID,WEP_PRIVATE_626_BID].includes(bid))
    return Object.freeze({status:'NOT_RUN_EXACT_BUILD_UNSUPPORTED',url:null,bid:null});
  let url;
  try { url = new URL(targetUrl); }
  catch { throw Error('PRIVATE_BROWSER_MUST_BE_LOCALHOST_ONLY'); }
  if (url.protocol !== 'http:' ||
      !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
      url.pathname !== '/editor/world/' ||
      url.username || url.password || url.hash || url.search)
    throw Error('PRIVATE_BROWSER_MUST_BE_LOCALHOST_ONLY');
  return Object.freeze({status:'READY',url,bid});
}

/**
 * Save.LastSaveDeviceInfo is NOT an extraction/executable authority. A Switch
 * file extracted from actual Switch storage can show Windows as the previous
 * device. Only owner-confirmed extraction + independently attested BID are
 * accepted as the V0 source claim. We still validate the Save's own schema.
 */
export function inspectExternallyAttestedSaveProfile(profile, claimedBid) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
      !profile.GameInfo || typeof profile.GameInfo !== 'object' ||
      !profile.World || typeof profile.World !== 'object' ||
      !profile.Player || typeof profile.Player !== 'object')
    throw Error('PRIVATE_PROFILE_REQUIRED_SECTIONS_MISSING');
  const schema = profile.GameInfo.Version;
  if (!Number.isSafeInteger(schema) ||
      (schema !== 624 && schema !== 626) ||
      claimedBid !== (schema === 624 ? WEP_PRIVATE_624_BID : WEP_PRIVATE_626_BID))
    throw Error('PRIVATE_SCHEMA_BUILD_BOUNDARY_MISMATCH');
  return Object.freeze({
    schema,platform:'Nintendo Switch',
    gameVersion:schema === 624 ? '1.25.0' : '1.25.3',
    bid:claimedBid,
    lastSaveDeviceTypeIsAuthority:false
  });
}

export function classify626ReferenceIndex(index) {
  if (!index || index.version?.schema !== 626 ||
      index.geometryFor2d !== 'NOT_VERIFIED' ||
      index.persistentWriteAuthorized !== false ||
      index.productApplyAuthorized !== false ||
      !Array.isArray(index.objects) || !Array.isArray(index.grids) ||
      !Array.isArray(index.issues))
    throw Error('PRIVATE_626_READONLY_REFERENCE_CONTRACT_INVALID');
  if (index.status !== 'READ_ONLY_REFERENCE_INDEX' ||
      index.issues.length !== 0) {
    return Object.freeze({
      status:'PARTIAL_626_SOURCE_REFERENCE_ERRORS_FAIL_CLOSED',
      checkStatus:'PARTIAL',
      issueCount:index.issues.length
    });
  }
  return Object.freeze({
    status:'SOURCE_626_REFERENCE_INDEX_ONLY_2D_NOT_RUN',
    checkStatus:'PASS',
    issueCount:0
  });
}

export function checkPrivateCandidateSource(profile, editorId) {
  const match = /^g(0|[1-9][0-9]*):o(0|[1-9][0-9]*)$/.exec(String(editorId ?? ''));
  if (!match) return null;
  const gridId=Number(match[1]),objectId=Number(match[2]);
  if (!Number.isSafeInteger(gridId)||!Number.isSafeInteger(objectId))return null;
  const grid=profile?.World?.GridCollection?.Grids?.[String(gridId)];
  const raw=grid?.Objects?.[String(objectId)];
  if (!grid || grid.ID!==gridId || !raw || raw.ID!==objectId ||
      !Number.isSafeInteger(raw.ItemID)||!Number.isSafeInteger(raw.X)||
      !Number.isSafeInteger(raw.Y))
    return null;
  return Object.freeze({
    editorId,gridId,objectId,itemId:raw.ItemID,x:raw.X,y:raw.Y
  });
}
