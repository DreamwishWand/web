// Optional Issue #130 old bearer/CDN/browser TTL probe.
// NEVER mints a new Gallery Storage URL, touches unrelated media, or prints the URL.
// Can run only with a separately authorized already-issued disposable token.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { STAGING_URL } from './community-gallery-signed-acceptance.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const APPROVAL = 'APPROVED_PREISSUED_DISPOSABLE_URL_ONLY';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validatePreissuedConfig(env, now = Date.now()) {
  if (env.DREAMWISH_SUPABASE_URL !== STAGING_URL) throw Error('STAGING_TARGET_REQUIRED');
  if (env.DREAMWISH_GALLERY_PREISSUED_APPROVAL !== APPROVAL) throw Error('OLD_TOKEN_SCOPE_NOT_APPROVED');
  const required = [
    'DREAMWISH_GALLERY_PREISSUED_SIGNED_URL',
    'DREAMWISH_GALLERY_PREISSUED_OWNER_SUBJECT_ID',
    'DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256',
    'DREAMWISH_GALLERY_PREISSUED_BYTES_SHA256',
    'DREAMWISH_GALLERY_PREISSUED_BYTE_SIZE',
    'DREAMWISH_GALLERY_PREISSUED_ISSUED_AT'
  ];
  if (required.some(k => !env[k])) throw Error('OLD_TOKEN_SCOPED_FIXTURE_REQUIRED');
  const actor = env.DREAMWISH_GALLERY_PREISSUED_OWNER_SUBJECT_ID;
  if (!UUID.test(actor)) throw Error('OLD_TOKEN_OWNER_UUID');
  const value = env.DREAMWISH_GALLERY_PREISSUED_SIGNED_URL;
  const url = new URL(value);
  const prefix = '/storage/v1/object/sign/community-media-staging/' + actor + '/';
  if (url.origin !== STAGING_URL || !url.pathname.startsWith(prefix) ||
      !/^\/storage\/v1\/object\/sign\/community-media-staging\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(url.pathname))
    throw Error('OLD_TOKEN_STORAGE_SCOPE_MISMATCH');
  if (!url.searchParams.has('token') || url.searchParams.get('token').length < 8)
    throw Error('OLD_TOKEN_NOT_SIGNED');
  const storageKey = decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/community-media-staging/'.length));
  if (!SHA256.test(env.DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256) ||
      sha(storageKey) !== env.DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256.toLowerCase())
    throw Error('OLD_TOKEN_KEY_NOT_ALLOWLISTED');
  if (!SHA256.test(env.DREAMWISH_GALLERY_PREISSUED_BYTES_SHA256)) throw Error('OLD_TOKEN_CONTENT_HASH_MISSING');
  const size = Number(env.DREAMWISH_GALLERY_PREISSUED_BYTE_SIZE);
  if (!Number.isSafeInteger(size) || size < 1 || size > 20 * 1024 * 1024)
    throw Error('OLD_TOKEN_BYTES_UNSAFE');
  const issued = Date.parse(env.DREAMWISH_GALLERY_PREISSUED_ISSUED_AT);
  if (!Number.isFinite(issued) || now < issued || now - issued > 15000)
    throw Error('OLD_TOKEN_T0_WINDOW_EXPIRED');
  return {signedUrl:value,issuedAt:issued,bytes:size,bytesSha256:env.DREAMWISH_GALLERY_PREISSUED_BYTES_SHA256.toLowerCase()};
}
export async function probePreissued(env, options = {}) {
  const cfg = validatePreissuedConfig(env, options.now?.() ?? Date.now());
  const clock = options.now || (() => Date.now());
  const sleep = options.sleep || ((ms) => new Promise(r => setTimeout(r,ms)));
  const fetcher = options.fetcher || fetch;
  const browserLauncher = options.browserLauncher;
  if (!browserLauncher) throw Error('CONTROLLED_BROWSER_REQUIRED');
  const browser = await browserLauncher();
  const page = await browser.newPage();
  const evidence = {kind:'PREISSUED_STORAGE_BEARER_TTL',fixture:'OPERATOR_ALLOWLISTED_DISPOSABLE',
    observations:[], outcome:'NOT_ACCEPTED'};
  try {
    for (const sec of [0,60,300,360]) {
      const due = cfg.issuedAt + sec * 1000;
      if (clock() < due) await sleep(due - clock());
      // Same old signed URL every time; never issue or refresh a Storage token.
      const response = await fetcher(cfg.signedUrl, {
        method:'GET',redirect:'manual',cache:'default',
        signal:AbortSignal.timeout(20000)
      });
      const status = response.status;
      if (status === 200) {
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.length,cfg.bytes,'OLD_TOKEN_RESPONSE_SIZE_MISMATCH');
        assert.equal(sha(bytes),cfg.bytesSha256,'OLD_TOKEN_BYTES_MUTATED');
      }
      // Separate browser context retains cache across same-token visits.
      const browserResult = await page.goto(cfg.signedUrl,{waitUntil:'commit',timeout:20000})
        .then(r => r?.status() ?? null).catch(() => null);
      evidence.observations.push({
        elapsedTargetSeconds:sec,storageHttpStatus:status,browserHttpStatus:browserResult,
        cacheControl:response.headers.get('cache-control')?.slice(0,100) ?? null,
        cdnCacheStatus:response.headers.get('cf-cache-status')?.slice(0,40) ?? null
      });
      if (sec === 0 && status !== 200) throw Error('OLD_TOKEN_INITIAL_NOT_ACCESSIBLE');
      if (sec === 360 && (status === 200 || browserResult === 200)) throw Error('OLD_TOKEN_POST_EXPIRY_STILL_PUBLIC');
    }
    evidence.outcome='PASS_ONLY_BEARER_TIMING';
    return evidence;
  } catch {
    evidence.outcome='FAIL_OR_INCOMPLETE';
    return evidence;
  } finally {
    await page.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
}
export async function main(env=process.env, args=process.argv.slice(2)) {
  if (args.includes('--preflight')) {
    console.log(JSON.stringify({mode:'OLD_BEARER_OFFLINE_PREFLIGHT',requests:0,realAcceptance:'NOT_EXECUTED'}));
    return;
  }
  if (!args.includes('--live')) throw Error('EXPLICIT_LIVE_REQUIRED');
  const {chromium}=await import('playwright-core');
  const chrome = env.CHROME_BIN;
  if (!chrome || !/^\//.test(chrome)) throw Error('CHROME_PATH_REQUIRED');
  const evidence = await probePreissued(env,{
    browserLauncher:()=>chromium.launch({headless:true,executablePath:chrome,
      args:['--no-sandbox','--disable-dev-shm-usage']})
  });
  console.log(JSON.stringify(evidence));
  if (evidence.outcome!=='PASS_ONLY_BEARER_TIMING') process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(()=>{console.error('OLD_BEARER_CONFIGURATION_OR_BROWSER_BLOCKED');process.exitCode=2;});
