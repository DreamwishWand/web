// 04 QR / #130: real, operator-approved Gallery Staging acceptance.
// No service_role, Vault, direct SQL, privileged Storage remove or Cron calls.
// CLI --preflight is secret-free and never performs a network request.
// CLI --live REQUIRES an explicitly approved, disposable, three-actor scope.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const STAGING_URL = 'https://ptpdoxhrqopvczpclcij.supabase.co';
export const BACKEND_SHA = '02750fcbcfd3f94fc12b39c8adf5757fa24a5646';
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a6UAAAAASUVORK5CYII=', 'base64'
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const MAX_BYTES = 20 * 1024 * 1024;
const APPROVAL = 'APPROVED_DISPOSABLE_GALLERY_STAGING_ONLY';
const actors = ['A', 'B', 'M'];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export function validateLiveConfig(env) {
  const required = [
    'DREAMWISH_SUPABASE_URL', 'DREAMWISH_SUPABASE_PUBLISHABLE_KEY',
    'DREAMWISH_GALLERY_E2E_APPROVAL', 'DREAMWISH_GALLERY_BACKEND_SHA',
    'DREAMWISH_GALLERY_SUBJECT_ID', 'DREAMWISH_GALLERY_DB_MIGRATION', 'DREAMWISH_GALLERY_EDGE_VERSIONS',
    ...actors.flatMap((actor) => [
      'DREAMWISH_GALLERY_' + actor + '_EMAIL',
      'DREAMWISH_GALLERY_' + actor + '_PASSWORD',
      'DREAMWISH_GALLERY_' + actor + '_ACCOUNT_ID'
    ])
  ];
  const missing = required.filter((name) => typeof env[name] !== 'string' || env[name].length === 0);
  if (missing.length) throw new Error('EXTERNAL_ENVIRONMENT: missing ' + missing.join(','));
  if (env.DREAMWISH_SUPABASE_URL !== STAGING_URL) throw new Error('STAGING_TARGET_NOT_APPROVED');
  if (!env.DREAMWISH_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))
    throw new Error('PUBLISHABLE_KEY_REQUIRED');
  if (env.DREAMWISH_GALLERY_E2E_APPROVAL !== APPROVAL) throw new Error('DISPOSABLE_SCOPE_NOT_APPROVED');
  if (env.DREAMWISH_GALLERY_BACKEND_SHA !== BACKEND_SHA) throw new Error('BACKEND_SHA_NOT_PINNED');
  if (!UUID.test(env.DREAMWISH_GALLERY_SUBJECT_ID)) throw new Error('VERIFIED_SUBJECT_ID_REQUIRED');
  if (PNG_BYTES.length < 1 || PNG_BYTES.length > MAX_BYTES) throw new Error('TEST_IMAGE_BOUNDS');
  for (const actor of actors) {
    if (!UUID.test(env['DREAMWISH_GALLERY_' + actor + '_ACCOUNT_ID']))
      throw new Error('APPROVED_ACTOR_ID_REQUIRED_' + actor);
  }
  if (!/^20\d{12}$/.test(env.DREAMWISH_GALLERY_DB_MIGRATION)) throw new Error('DB_MIGRATION_ATTESTATION_REQUIRED');
  if (!/^community-media:v\d+;community-public-media:v\d+;community-query:v\d+;community-command:v\d+;community-retention:v\d+$/.test(env.DREAMWISH_GALLERY_EDGE_VERSIONS))
    throw new Error('EDGE_VERSIONS_ATTESTATION_REQUIRED');
  const ids = actors.map((actor) => env['DREAMWISH_GALLERY_' + actor + '_ACCOUNT_ID'].toLowerCase());
  if (new Set(ids).size !== 3) throw new Error('ACTOR_ACCOUNT_COLLISION');
  if (env.CI === 'true' && !(env.GITHUB_REF || '').startsWith('refs/heads/integration/'))
    throw new Error('INTEGRATION_BRANCH_REQUIRED');
  if (env.DREAMWISH_GALLERY_M_MODERATOR_APPROVED !== 'true')
    throw new Error('MODERATOR_SCOPE_NOT_APPROVED');
  return {
    url: STAGING_URL,
    key: env.DREAMWISH_SUPABASE_PUBLISHABLE_KEY,
    subjectId: env.DREAMWISH_GALLERY_SUBJECT_ID,
    approvedAccountIds: ids,
    credentials: actors.map((actor) => ({
      label: actor,
      email: env['DREAMWISH_GALLERY_' + actor + '_EMAIL'],
      password: env['DREAMWISH_GALLERY_' + actor + '_PASSWORD']
    }))
  };
}
export function assertSignedUploadUrl(raw, ownerUserId) {
  const url = new URL(raw);
  if (url.origin !== STAGING_URL) throw new Error('SIGNED_UPLOAD_EXTERNAL_ORIGIN');
  if (!url.pathname.startsWith('/storage/v1/object/upload/sign/community-media-staging/'))
    throw new Error('SIGNED_UPLOAD_BUCKET_OR_PATH');
  if (!url.pathname.includes('/' + ownerUserId + '/'))
    throw new Error('SIGNED_UPLOAD_OWNER_PATH');
  if (!url.searchParams.has('token')) throw new Error('SIGNED_UPLOAD_TOKEN_MISSING');
  return raw;
}
export function assertBinary(bytes, expected) {
  assert(Number.isSafeInteger(expected.byteSize) && expected.byteSize > 0 && expected.byteSize <= MAX_BYTES);
  assert.equal(bytes.length, expected.byteSize, 'BINARY_SIZE_MISMATCH');
  assert.match(expected.checksumSha256, /^[a-f0-9]{64}$/i);
  assert.equal(sha256(bytes), expected.checksumSha256.toLowerCase(), 'BINARY_SHA256_MISMATCH');
}
function ensureUuid(value, error) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(error);
  return value;
}
function statusError(result, label) {
  const e = new Error(label + '_HTTP_' + result.status);
  e.status = result.status;
  e.code = typeof result.data?.error === 'string' && /^[A-Z0-9_]{1,70}$/.test(result.data.error)
    ? result.data.error : 'HTTP_STATUS';
  return e;
}
function safeEvent(log, name, status, extra = {}) {
  log.push({case: name, status, ...extra});
}
export function verifySubjectCatalog(result, subjectId) {
  if (result?.contract !== 'ddv.gallery-verified-subject-public-lookup@1' ||
      !Array.isArray(result.subjects))
    throw new Error('VERIFIED_SUBJECT_CATALOG_CONTRACT_MISMATCH');
  const subject = result.subjects.find(v => v?.subjectId === subjectId);
  if (!subject || subject.galleryKind !== 'outdoor' ||
      subject.verificationState !== 'verified' ||
      subject.platform !== 'switch' ||
      subject.gameVersion !== '1.25.0' ||
      subject.buildId !== '52BD625D9B4E0053' ||
      subject.profileSchema !== 624)
    throw new Error('APPROVED_SWITCH_1250_SUBJECT_NOT_VERIFIED');
  return subjectId;
}
export async function runSignedGallery(env, transport = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const cfg = validateLiveConfig(env); // MUST preflight all scopes before network
  const evidence = {
    kind: 'REAL_SIGNED_STAGING_ONLY',
    backendSha: BACKEND_SHA,
    runnerSha: /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') ? env.GITHUB_SHA : 'LOCAL',
    deployedVersions: {source: 'OPERATOR_ATTESTED_NOT_RUNTIME_VERIFIED', dbMigration: env.DREAMWISH_GALLERY_DB_MIGRATION, edge: env.DREAMWISH_GALLERY_EDGE_VERSIONS},
    actorScope: 'APPROVED_DISPOSABLE_A_B_M',
    mediaSha256: sha256(PNG_BYTES),
    mediaByteSize: PNG_BYTES.length,
    events: [],
    remaining: []
  };
  const active = [];
  const prepared = [];
  let workId = null;
  let publicationAttempted = false;
  const headers = (session, type = 'application/json') => {
    const value = {apikey: cfg.key, 'cache-control': 'no-store'};
    if (type) value['content-type'] = type;
    if (session) value.authorization = 'Bearer ' + session.access_token;
    return value;
  };
  async function call(path, body, session, method = 'POST') {
    const response = await transport(cfg.url + path, {
      method, headers: headers(session),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    let data = null;
    try { data = await response.json(); } catch { /* status remains authoritative */ }
    return {status: response.status, data, cacheControl: response.headers.get('cache-control')};
  }
  async function binary(path, body, session, method = 'POST') {
    const response = await transport(cfg.url + path, {
      method, headers: headers(session, method === 'GET' ? null : 'application/json'),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    if (response.status !== 200) return {status: response.status, data: null};
    const raw = Buffer.from(await response.arrayBuffer());
    return {status: response.status, bytes: raw, cacheControl: response.headers.get('cache-control')};
  }
  const requireStatus = (res, expected, label) => {
    if (res.status !== expected) throw statusError(res, label);
    safeEvent(evidence.events, label, 'PASS', {httpStatus: res.status});
    return res.data;
  };
  const paths = {
    media: '/functions/v1/community-media',
    command: '/functions/v1/community-command',
    query: '/functions/v1/community-query',
    publicQuery: '/functions/v1/community-public-query',
    publicMedia: '/functions/v1/community-public-media'
  };
  const media = (actor, action, body) => call(paths.media, {action, ...body}, actor);
  const command = (actor, commandName, payload) => call(paths.command, {command: commandName, payload}, actor);
  const query = (actor, name, payload = {}) => call(paths.query, {query: name, payload}, actor);
  const nonce = randomUUID();
  try {
    // Fresh normal Supabase password sessions; no JWT mint or admin impersonation.
    for (const item of cfg.credentials) {
      const result = await call('/auth/v1/token?grant_type=password',
        {email: item.email, password: item.password}, null);
      const session = requireStatus(result, 200, 'auth_' + item.label);
      ensureUuid(session?.user?.id, 'NORMAL_AUTH_USER_ID_MISSING');
      if (!session?.access_token || !session?.refresh_token) throw new Error('NORMAL_AUTH_SESSION_MISSING');
      active.push(session);
      const me = requireStatus(await query(session, 'me'), 200, 'identity_' + item.label);
      const index = actors.indexOf(item.label);
      const account = ensureUuid(me?.data?.accountId, 'WAND_ACCOUNT_NOT_LINKED_' + item.label);
      assert.equal(account.toLowerCase(), cfg.approvedAccountIds[index], 'ACTOR_ACCOUNT_NOT_APPROVED_' + item.label);
      if (item.label === 'A') ensureUuid(me?.data?.creatorProfileId, 'OWNER_CREATOR_PROFILE_MISSING');
    }
    const [a, b, m] = active;
    // No user-case data may be returned. In this deployed SQL contract the
    // moderator role check precedes p_state validation. Invalid p_state makes
    // authorized M return 400 ADMIN_OPERATION_FAILED, non-staff B return 403
    // FORBIDDEN, and neither branch performs the SELECT of moderation cases.
    const roleProbe = {operation:'listModerationCases',
      payload:{state:'qr_probe_invalid_state_no_rows',limit:1}};
    const role = await call('/functions/v1/community-admin',roleProbe,m);
    requireStatus(role, 400, 'moderator_role_verified_without_case_read');
    if (role.data?.error !== 'ADMIN_OPERATION_FAILED' ||
        !String(role.data?.message??'').includes('Unsupported moderation-case state'))
      throw new Error('MODERATOR_ROLE_PROOF_CONTRACT_MISMATCH');
    const notStaff = await call('/functions/v1/community-admin',roleProbe,b);
    requireStatus(notStaff, 403, 'nonmoderator_role_denied_without_case_read');
    if (notStaff.data?.error !== 'FORBIDDEN')
      throw new Error('NONMODERATOR_ROLE_PROOF_CONTRACT_MISMATCH');
    const subjects = requireStatus(await call(paths.publicQuery, {
      rpc: 'community_list_verified_gallery_subjects_v1',
      payload: {p_gallery_kind:'outdoor', p_limit:100}
    }, null), 200, 'verified_subjects');
    verifySubjectCatalog(subjects,cfg.subjectId);
    const identity = requireStatus(await query(a, 'me'), 200, 'owner_profile_for_publish');
    const creatorProfileId = ensureUuid(identity?.data?.creatorProfileId, 'CREATOR_PROFILE_MISSING');
    const uploaded = [];
    for (let i = 0; i < 2; i += 1) {
      const name = 'media_' + (i + 1);
      const preparedBody = requireStatus(await media(a, 'galleryPrepare',
        {mimeType:'image/png', byteSize:PNG_BYTES.length}), 200, name + '_prepare');
      const storageKey = String(preparedBody?.storageKey || '');
      if (!storageKey.startsWith(a.user.id + '/') || !/\.png$/.test(storageKey) ||
          !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i.test(storageKey))
        throw new Error('UNEXPECTED_DISPOSABLE_STORAGE_KEY');
      prepared.push({storageKey, bound:false});
      if (!evidence.disposableStorageKeyDigests) evidence.disposableStorageKeyDigests = [];
      evidence.disposableStorageKeyDigests.push(sha256(storageKey));
      const signedUrl = assertSignedUploadUrl(preparedBody?.signedUpload?.signedUrl, a.user.id);
      const form = new FormData();
      form.append('cacheControl', '0');
      form.append('', new Blob([PNG_BYTES], {type:'image/png'}), 'qr-disposable.png');
      const put = await transport(signedUrl, {
        method:'PUT', headers:{'x-upsert':'false'}, body:form, redirect:'error',
        cache:'no-store', signal:AbortSignal.timeout(20000)
      });
      if (![200,201].includes(put.status)) throw new Error(name + '_SIGNED_PUT_HTTP_' + put.status);
      safeEvent(evidence.events, name + '_signed_put', 'PASS', {httpStatus:put.status});
      const finalized = requireStatus(await media(a, 'galleryFinalize', {storageKey}), 200, name + '_finalize');
      const mediaId = ensureUuid(finalized?.data?.mediaId, 'FINALIZED_MEDIA_ID_MISSING');
      if (finalized?.data?.state !== 'ready' || finalized?.data?.moderationState !== 'clear' ||
          Number(finalized?.data?.byteSize) !== PNG_BYTES.length ||
          String(finalized?.data?.checksumSha256).toLowerCase() !== evidence.mediaSha256)
        throw new Error('FINALIZED_READY_CLEAR_DIGEST_NOT_VERIFIED');
      requireStatus(await media(a, 'galleryStatus', {storageKey}), 200, name + '_owner_status');
      uploaded.push({storageKey, mediaId});
    }
    const payload = (index, extra = {}) => ({
      galleryKind:'outdoor', creatorProfileId, subjectId:cfg.subjectId,
      title:'QA approved disposable ' + nonce.slice(0, 8) + ' rev ' + (index + 1),
      description:'Temporary signed Gallery acceptance; not a user work',
      mediaIds:[uploaded[index].mediaId], coverMediaId:uploaded[index].mediaId,
      originalityAttested:true, idempotencyKey:randomUUID(), ...extra
    });
    publicationAttempted = true; // commit outcome might become unknown after a network failure
    const created = requireStatus(await command(a, 'publishGalleryPhoto', payload(0)), 200, 'gallery_public_create');
    workId = ensureUuid(created?.data?.workId, 'PUBLIC_WORK_ID_MISSING');
    evidence.disposableWorkId = workId;
    evidence.disposableMediaIds = uploaded.map((v) => v.mediaId);
    prepared[0].bound = true;
    const revision = Number(created?.data?.rowVersion);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('CREATE_ROW_VERSION_MISSING');
    const newer = requireStatus(await command(a, 'publishGalleryPhoto',
      payload(1, {workId,expectedVersion:revision})), 200, 'gallery_immutable_update');
    prepared[1].bound = true;
    const newerVersion = Number(newer?.data?.rowVersion);
    if (!Number.isSafeInteger(newerVersion) || newerVersion <= revision)
      throw new Error('IMMUTABLE_VERSION_NOT_ADVANCED');
    const stale = await command(a, 'publishGalleryPhoto',
      payload(1, {workId,expectedVersion:revision}));
    requireStatus(stale, 409, 'gallery_stale_revision_conflict');
    const descriptor = requireStatus(await call(paths.publicMedia,
      {mediaId:uploaded[1].mediaId}, null), 200, 'public_binary_descriptor');
    if (descriptor?.media?.rawStorageSignedUrlIssued !== false ||
        descriptor?.media?.transport !== 'edge_proxy')
      throw new Error('RAW_PUBLIC_STORAGE_SIGNER_DETECTED');
    const expected = {byteSize:PNG_BYTES.length,checksumSha256:evidence.mediaSha256};
    const publicGet = await binary(paths.publicMedia + '?mediaId=' + uploaded[1].mediaId, undefined, null,'GET');
    if (publicGet.status !== 200) throw statusError(publicGet,'public_binary_get');
    assertBinary(publicGet.bytes,expected);
    if (!/no-store/.test(publicGet.cacheControl || '')) throw new Error('PUBLIC_BINARY_CACHE_CONTROL');
    safeEvent(evidence.events,'public_binary_get_sha256','PASS',{httpStatus:200,bytes:publicGet.bytes.length});
    const ownerGet = await binary(paths.media, {action:'galleryReadBytes',mediaId:uploaded[1].mediaId},a);
    if (ownerGet.status !== 200) throw statusError(ownerGet,'owner_binary_read');
    assertBinary(ownerGet.bytes,expected);
    safeEvent(evidence.events,'owner_binary_sha256','PASS',{httpStatus:200,bytes:ownerGet.bytes.length});
    for (const [label, actor] of [['B',b],['M',m],['anonymous',null]]) {
      const denied = await media(actor,'galleryReadBytes',{mediaId:uploaded[1].mediaId});
      requireStatus(denied, actor ? 403 : 401, label + '_owner_binary_denial');
    }
    requireStatus(await call(paths.publicMedia,{mediaId:uploaded[0].mediaId},null),
      404,'historical_public_denial');
    const historicalOwner = await binary(paths.media, {action:'galleryReadBytes',mediaId:uploaded[0].mediaId}, a);
    if (historicalOwner.status !== 200) throw statusError(historicalOwner, 'historical_owner_binary');
    assertBinary(historicalOwner.bytes,expected);
    safeEvent(evidence.events,'historical_owner_binary_sha256','PASS',{httpStatus:200,bytes:historicalOwner.bytes.length});
    const preflight = requireStatus(await query(a,'galleryRetirementPreflight',{workId}),
      200,'owner_cloud_readonly_preflight');
    const cloud = preflight?.data?.cloudPreservation;
    if (preflight?.data?.contract !== 'ddv.gallery-public-retirement-preflight@1' ||
        preflight?.data?.workId !== workId ||
        preflight?.data?.ownerEligible !== true ||
        preflight?.data?.operationAuthorized !== false ||
        preflight?.data?.deleteAuthorized !== false ||
        preflight?.data?.cloudEntitlementVerified !== false ||
        preflight?.data?.previousSignedUrlsRevoked !== false ||
        preflight?.data?.dependencySnapshotNotAtomicMutationFence !== true ||
        cloud?.contract !== 'ddv.gallery-cloud-preservation-readiness@1' ||
        cloud?.cloudEntitlementVerified !== false ||
        cloud?.cloudPrivateStorageAclVerified !== false ||
        cloud?.cloudBackupAndRestoreVerified !== false ||
        cloud?.privateSaveAuthorized !== false ||
        cloud?.restoreAuthorized !== false ||
        cloud?.entitlement?.source !== 'not_configured')
      throw new Error('CLOUD_PRESERVATION_FAIL_CLOSED_CONTRACT_MISMATCH');
    requireStatus(await query(b,'galleryRetirementPreflight',{workId}),
      403,'nonowner_cloud_preflight_denial');
    evidence.remaining.push('OLD_ISSUED_STORAGE_URL_TIMING_NOT_EXECUTED: requires approved independent historical bearer fixture');
    evidence.remaining.push('BROWSER_CDN_CACHE_NOT_EXECUTED: requires dedicated old bearer and controlled browser timing');
    evidence.remaining.push('PHYSICAL_DELETE_NOT_EXECUTED: separate operator/legal/ops approval');
    evidence.remaining.push('DISPOSABLE_PUBLISHED_WORK_RETAINED: no unsafe delete/unpublish authorization');
    return evidence;
  } catch (err) {
    safeEvent(evidence.events,'signed_gallery_e2e','FAILED',{
      errorCode: /^[A-Z0-9_]+$/.test(err?.code || '') ? err.code : 'ASSERTION_FAILED',
      status: Number.isInteger(err?.status) ? err.status : null
    });
    throw Object.assign(new Error('SIGNED_GALLERY_E2E_FAILED'), {evidence});
  } finally {
    // Best-effort journal cancellation of strictly newly prepared, unbound
    // keys only. This queues logical cleanup; it NEVER removes Storage objects.
    if (publicationAttempted && prepared.some(p=>!p.bound)) {
      // A lost HTTP reply could conceal a committed public revision. Keep
      // uncertain blobs untouched for owner-scoped operator inventory.
      evidence.remaining.push('UNCERTAIN_PUBLICATION_OUTCOME: preserve media; operator read-only inventory required');
    }
    if (!publicationAttempted && active[0]) for (const entry of prepared.filter((p) => !p.bound)) {
      try {
        const abort = await media(active[0],'galleryAbort',{storageKey:entry.storageKey});
        safeEvent(evidence.events,'unbound_abort_requested',
          abort.status === 200 && abort.data?.ok === true ? 'PASS' : 'NOT_CONFIRMED',
          {httpStatus:abort.status});
      } catch {
        safeEvent(evidence.events,'unbound_abort_requested','NOT_CONFIRMED');
      }
    }
    for (const session of active) {
      try {
        await transport(cfg.url + '/auth/v1/logout?scope=local',
          {method:'POST',headers:headers(session),signal:AbortSignal.timeout(10000)});
      } catch { /* no session details in evidence */ }
    }
  }
}
export async function main(env = process.env, args = process.argv.slice(2)) {
  if (args.includes('--preflight')) {
    console.log(JSON.stringify({status:'HARNESS_PREFLIGHT_ONLY',networkRequests:0,
      staging:STAGING_URL,backendSha:BACKEND_SHA,liveAcceptance:'NOT_EXECUTED'}));
    return;
  }
  if (!args.includes('--live')) throw new Error('EXPLICIT_LIVE_FLAG_REQUIRED');
  let result;
  try {
    result = await runSignedGallery(env);
    console.log(JSON.stringify(result));
  } catch (error) {
    const evidence = error?.evidence || {kind:'REAL_SIGNED_STAGING_ONLY',events:[],
      remaining:['LIVE_NOT_ACCEPTED']};
    console.log(JSON.stringify({ ...evidence, overall:'FAIL_OR_INCOMPLETE' }));
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('SIGNED_GALLERY_PRECONDITION_REJECTED'); // never print secrets or URLs
    process.exitCode = 2;
  });
}
