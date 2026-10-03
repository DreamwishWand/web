import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const FROZEN_HEAD = '775c5d50d80ad68c4c2c5f37f94bb09835222f12';
const supabaseUrl = process.env.QR_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const publishableKey = process.env.QR_SUPABASE_PUBLISHABLE_KEY ?? '';
const baseUrl = (process.env.QR_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/+$/, '');
const chromeBin = process.env.CHROME_BIN || undefined;
const runId = process.env.GITHUB_RUN_ID ?? crypto.randomUUID().replaceAll('-', '');
const tag = 'qr-gqa-' + runId;
const outDir = path.resolve('.artifacts/gallery-qa-qr');
await mkdir(outDir, { recursive: true });

if (!supabaseUrl.startsWith('https://')) throw new Error('QR_CONFIG_SUPABASE_URL');
if (!publishableKey.startsWith('sb_publishable_')) throw new Error('QR_CONFIG_PUBLISHABLE_KEY');

const report = {
  schema: 'dreamwish-wand-qr-gallery-qa-browser@1',
  timestamp: new Date().toISOString(),
  frozenHead: FROZEN_HEAD,
  gitHead: process.env.GITHUB_SHA ?? null,
  backend: {
    projectRef: 'ptpdoxhrqopvczpclcij',
    edgeVersions: {
      communityCommand: 25,
      communityQuery: 11,
      communityAdmin: 15,
      communityPublicMedia: 1,
      communityPublicQuery: 1
    }
  },
  result: 'FAIL',
  checks: [],
  defects: [],
  entities: {},
  consoleErrorCount: 0,
  pageErrorCount: 0,
  cleanup: { requested: false, state: 'NOT_STARTED' }
};

const secrets = [];
const actors = {
  A: {
    email: 'delivered@resend.dev',
    password: 'QRa!' + crypto.randomBytes(24).toString('base64url') + '7z'
  },
  B: {
    email: 'bounced@resend.dev',
    password: 'QRb!' + crypto.randomBytes(24).toString('base64url') + '8y'
  },
  M: {
    email: 'complained@resend.dev',
    password: 'QRm!' + crypto.randomBytes(24).toString('base64url') + '9x'
  }
};
for (const a of Object.values(actors)) secrets.push(a.email, a.password);

function sanitize(value) {
  let text = String(value ?? '');
  for (const secret of secrets) if (secret) text = text.split(secret).join('[REDACTED]');
  text = text.replace(/https?:\/\/[^\s"'<>]+/g, '[URL_REDACTED]');
  text = text.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[TOKEN_REDACTED]');
  text = text.replace(/sb_publishable_[A-Za-z0-9_-]+/g, '[PUBLISHABLE_KEY_REDACTED]');
  return text.slice(0, 500);
}

function addCheck(id, actor, route, expected, pass, observed, entityIds = {}, errorCode = null) {
  report.checks.push({
    id, actor, route, expected,
    observed: sanitize(observed),
    result: pass ? 'PASS' : 'FAIL',
    entityIds,
    errorCode
  });
}

function addDefect(id, route, detail) {
  report.defects.push({ id, route, detail: sanitize(detail) });
}

async function signup(actor) {
  const response = await fetch(supabaseUrl + '/auth/v1/signup', {
    method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: actor.email, password: actor.password })
  });
  if (!response.ok) throw new Error('QR_AUTH_SIGNUP_' + response.status);
  await response.json();
}

async function trySignIn(actor) {
  const response = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: actor.email, password: actor.password })
  });
  if (response.ok) return true;
  if ([400, 401, 403].includes(response.status)) return false;
  throw new Error('QR_AUTH_POLL_' + response.status);
}

console.log('QR_BOOTSTRAP_BEGIN tag=' + tag);
for (const actor of Object.values(actors)) await signup(actor);
console.log('QR_BOOTSTRAP_READY tag=' + tag + ' actors=3');

let ready = false;
for (let attempt = 0; attempt < 72; attempt += 1) {
  const status = await Promise.all(Object.values(actors).map(trySignIn));
  if (status.every(Boolean)) { ready = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!ready) {
  report.result = 'WAIT_FOR_CONFIGURED_BROWSER_ENVIRONMENT';
  report.cleanup.state = 'BOOTSTRAP_NOT_CONFIRMED';
  await writeFile(path.join(outDir, 'gallery-qa-browser-report.json'), JSON.stringify(report, null, 2));
  throw new Error('QR_ACTOR_BOOTSTRAP_TIMEOUT');
}
console.log('QR_ACTORS_READY tag=' + tag);

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeBin,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const contexts = {};
const pages = {};
const routeErrors = new Map();

function attachErrors(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrorCount += 1;
      const list = routeErrors.get(label) ?? [];
      list.push('console:' + sanitize(msg.text()));
      routeErrors.set(label, list);
    }
  });
  page.on('pageerror', (err) => {
    report.pageErrorCount += 1;
    const list = routeErrors.get(label) ?? [];
    list.push('page:' + sanitize(err?.message ?? err));
    routeErrors.set(label, list);
  });
}

async function newActorContext(label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachErrors(page, label);
  contexts[label] = ctx;
  pages[label] = page;
  return page;
}

async function signInUi(page, actor) {
  await page.locator('input[type="email"]').fill(actor.email);
  await page.locator('input[type="password"]').fill(actor.password);
  await page.getByRole('button', { name: /Sign in/i }).click();
}

async function commandResponse(page, commandName, action) {
  const responsePromise = page.waitForResponse((response) => {
    if (!response.url().includes('/functions/v1/community-command')) return false;
    try {
      const body = JSON.parse(response.request().postData() || '{}');
      return body.command === commandName;
    } catch { return false; }
  });
  await action();
  const response = await responsePromise;
  let body = {};
  try { body = await response.json(); } catch {}
  return { status: response.status(), body };
}

async function directBrowserCommand(page, command, payload) {
  return page.evaluate(async ({ supabaseUrl, publishableKey, command, payload }) => {
    const raw = localStorage.getItem('dreamwishwand-community-session-v1');
    if (!raw) return { status: 0, code: 'NO_BROWSER_SESSION' };
    const session = JSON.parse(raw);
    const response = await fetch(supabaseUrl + '/functions/v1/community-command', {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        authorization: 'Bearer ' + session.accessToken,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ command, payload })
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return {
      status: response.status,
      ok: response.ok,
      code: body?.error ? String(body.error) : null,
      message: body?.message ? String(body.message) : null,
      data: body?.data ?? null
    };
  }, { supabaseUrl, publishableKey, command, payload });
}

async function publicMediaProbe(page, mediaId) {
  return page.evaluate(async ({ supabaseUrl, publishableKey, mediaId }) => {
    const response = await fetch(supabaseUrl + '/functions/v1/community-public-media', {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({ mediaId })
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return {
      status: response.status,
      ok: response.ok,
      resultOk: body?.ok === true,
      error: body?.error ? String(body.error) : null,
      expiresInSeconds: body?.media?.expiresInSeconds ?? null,
      hasStorageKey: Boolean(body?.media && Object.hasOwn(body.media, 'storageKey')),
      hasSignedUrl: Boolean(body?.media?.signedUrl)
    };
  }, { supabaseUrl, publishableKey, mediaId });
}

async function publicQuestionProbe(page, questionId) {
  return page.evaluate(async ({ supabaseUrl, publishableKey, questionId }) => {
    const response = await fetch(supabaseUrl + '/functions/v1/community-public-query', {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        rpc: 'community_get_question_public_v1',
        payload: { p_question_id: questionId }
      })
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return {
      status: response.status,
      resolutionState: body?.resolutionState ?? null,
      acceptedAnswerId: body?.acceptedAnswerId ?? null,
      freshness: body?.freshness ?? null
    };
  }, { supabaseUrl, publishableKey, questionId });
}

async function visibleText(page, text) {
  return page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
}

try {
  const A = await newActorContext('A');
  const B = await newActorContext('B');
  const M = await newActorContext('M');
  const anon = await newActorContext('anon');

  await A.goto(baseUrl + '/gallery/publish/', { waitUntil: 'networkidle' });
  await A.locator('input[type="email"]').fill(actors.A.email);
  await A.locator('input[type="password"]').fill('deliberately-wrong-password');
  await A.getByRole('button', { name: /Sign in/i }).click();
  const alertVisible = await A.locator('[role="alert"]').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  addCheck('A11Y-FORM-ERROR-LIVE', 'A', '/gallery/publish/', 'Invalid sign-in error exposed through role=alert', alertVisible, alertVisible ? 'role=alert visible' : 'No role=alert');

  await A.goto(baseUrl + '/gallery/publish/', { waitUntil: 'networkidle' });
  await signInUi(A, actors.A);
  await A.getByLabel(/Work type/i).waitFor();
  addCheck('GALLERY-A-SIGNIN-CREATOR', 'A', '/gallery/publish/', 'A signs in and Creator identity resolves', true, 'Publish form available');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
    'base64'
  );
  await A.locator('input[type="file"]').setInputFiles({ name: 'qr-gallery.png', mimeType: 'image/png', buffer: png });
  const title = 'QR Gallery ' + runId;
  await A.getByLabel(/^Title$/i).fill(title);
  await A.getByLabel(/Description/i).fill('Focused QR Gallery browser acceptance fixture.');
  let mediaId = null;
  A.on('response', async (response) => {
    if (!response.url().includes('/functions/v1/community-media')) return;
    try {
      const request = JSON.parse(response.request().postData() || '{}');
      if (request.action !== 'finalize') return;
      const body = await response.json();
      if (body?.data?.mediaId) mediaId = String(body.data.mediaId);
    } catch {}
  });
  const publish = await commandResponse(A, 'publishGallery', async () => {
    await A.getByRole('button', { name: /^Publish$/i }).click();
  });
  const workId = String(publish.body?.data?.workId ?? '');
  if (workId) report.entities.galleryWorkId = workId;
  if (mediaId) report.entities.galleryMediaId = mediaId;
  addCheck('GALLERY-A-PUBLISH', 'A', '/gallery/publish/', 'Gallery work publishes PUBLIC and returns work ID', publish.status === 200 && Boolean(workId), 'HTTP ' + publish.status, workId ? { workId } : {});

  await A.goto(baseUrl + '/gallery/my/', { waitUntil: 'networkidle' });
  const myWorkVisible = await visibleText(A, title);
  addCheck('GALLERY-A-MY-WORKS', 'A', '/gallery/my/', 'Published work appears in My Gallery > My Works', myWorkVisible, myWorkVisible ? 'Work visible' : 'Work missing', workId ? { workId } : {});

  let anonMediaRequestNoJwt = null;
  let anonMediaResponse = null;
  anon.on('request', (request) => {
    if (request.url().includes('/functions/v1/community-public-media')) {
      const headers = request.headers();
      anonMediaRequestNoJwt = !('authorization' in headers);
    }
  });
  anon.on('response', async (response) => {
    if (!response.url().includes('/functions/v1/community-public-media')) return;
    try {
      const body = await response.json();
      anonMediaResponse = {
        status: response.status(),
        ok: body?.ok === true,
        expiresInSeconds: body?.media?.expiresInSeconds ?? null,
        hasStorageKey: Boolean(body?.media && Object.hasOwn(body.media, 'storageKey')),
        hasSignedUrl: Boolean(body?.media?.signedUrl)
      };
    } catch {}
  });
  await anon.goto(baseUrl + '/gallery/?work=' + encodeURIComponent(workId), { waitUntil: 'networkidle' });
  const anonTitle = await visibleText(anon, title);
  const image = anon.locator('.detail img').first();
  const imageOk = await image.count() > 0 && await image.evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
  const publicMediaPass = Boolean(
    anonTitle && imageOk && anonMediaRequestNoJwt === true &&
    anonMediaResponse?.status === 200 && anonMediaResponse?.ok === true &&
    anonMediaResponse?.expiresInSeconds === 300 &&
    anonMediaResponse?.hasStorageKey === false && anonMediaResponse?.hasSignedUrl === true
  );
  addCheck('GALLERY-ANON-PUBLIC-MEDIA-POSITIVE', 'anon', '/gallery/?work=<id>',
    'Anonymous public detail + image through server-authorized 300s signed-media path; no JWT/storageKey',
    publicMediaPass,
    JSON.stringify({
      title: anonTitle, imageLoaded: imageOk, noAuthorizationHeader: anonMediaRequestNoJwt,
      mediaStatus: anonMediaResponse?.status ?? null, expiresInSeconds: anonMediaResponse?.expiresInSeconds ?? null,
      storageKeyExposed: anonMediaResponse?.hasStorageKey ?? null
    }),
    { workId, mediaId: mediaId ?? '' }
  );

  await B.goto(baseUrl + '/gallery/interact/?work=' + encodeURIComponent(workId), { waitUntil: 'networkidle' });
  await signInUi(B, actors.B);
  await B.getByRole('heading', { name: title }).waitFor();
  await commandResponse(B, 'saveEntity', () => B.getByRole('button', { name: /^Save$/i }).click());
  await commandResponse(B, 'addReaction', () => B.getByRole('button', { name: /^React$/i }).click());
  const commentText = 'QR viewer comment ' + runId;
  await B.locator('textarea').fill(commentText);
  const commentResp = await commandResponse(B, 'addComment', () => B.getByRole('button', { name: /^Comment$/i }).click());
  const commentId = String(commentResp.body?.data?.commentId ?? '');
  if (commentId) report.entities.galleryCommentId = commentId;
  const reportResp = await commandResponse(B, 'reportEntity', () => B.getByRole('button', { name: /^Report$/i }).first().click());
  const galleryCaseId = String(reportResp.body?.data?.caseId ?? reportResp.body?.caseId ?? '');
  if (galleryCaseId) report.entities.galleryModerationCaseId = galleryCaseId;
  const bInteractionsPass = commentResp.status === 200 && reportResp.status === 200;
  addCheck('GALLERY-B-INTERACTIONS', 'B', '/gallery/interact/?work=<id>',
    'B discovers detail, saves, reacts, comments and reports',
    bInteractionsPass, 'Save/React executed; comment HTTP ' + commentResp.status + '; report HTTP ' + reportResp.status,
    { workId, ...(commentId ? { commentId } : {}), ...(galleryCaseId ? { caseId: galleryCaseId } : {}) });

  await B.goto(baseUrl + '/gallery/my/', { waitUntil: 'networkidle' });
  const savedVisible = await visibleText(B, title);
  addCheck('GALLERY-B-SAVED', 'B', '/gallery/my/', 'Saved reference appears and is accessible before moderation', savedVisible, savedVisible ? 'Saved work visible' : 'Saved work missing', { workId });

  const ownerNegative = await directBrowserCommand(B, 'setGalleryCommentsEnabled', { workId, enabled: false });
  const ownerDenied = ownerNegative.status >= 400 || ownerNegative.ok === false;
  addCheck('GALLERY-B-OWNER-MUTATION-DENIED', 'B', '/gallery/interact/?work=<id>',
    'Non-owner cannot mutate owner-only Gallery comment state',
    ownerDenied, 'HTTP ' + ownerNegative.status + ' code=' + (ownerNegative.code ?? 'none'), { workId }, ownerNegative.code);

  await A.goto(baseUrl + '/gallery/interact/?work=' + encodeURIComponent(workId), { waitUntil: 'networkidle' });
  const authorSeesComment = await visibleText(A, commentText);
  addCheck('GALLERY-A-SEES-INTERACTION', 'A', '/gallery/interact/?work=<id>', 'Author sees B comment', authorSeesComment, authorSeesComment ? 'Comment visible' : 'Comment missing', { workId, ...(commentId ? { commentId } : {}) });
  const authorControl = await A.getByRole('button', { name: /disable comments|enable comments|remove comment/i }).count();
  const authorControlPass = authorControl > 0;
  addCheck('GALLERY-A-COMMENT-CONTROL-UI', 'A', '/gallery/interact/?work=<id>',
    'Author comment-control action is reachable through production-shaped UI',
    authorControlPass, authorControlPass ? 'Author comment control reachable' : 'No author comment-control action rendered', { workId },
    authorControlPass ? null : 'UI_CONTROL_NOT_FOUND');
  if (!authorControlPass) addDefect('GALLERY-AUTHOR-COMMENT-CONTROL-NOT-EXPOSED', '/gallery/interact/', 'Backend owner comment controls exist, but no production-shaped author comment-control action is rendered.');

  await M.goto(baseUrl + '/community-ops/', { waitUntil: 'networkidle' });
  await M.getByLabel('Supabase URL').fill(supabaseUrl);
  await M.getByLabel('Publishable key').fill(publishableKey);
  await M.getByLabel('Email').fill(actors.M.email);
  await M.getByLabel('Password').fill(actors.M.password);
  await M.getByRole('button', { name: /^Sign in$/ }).click();
  await M.getByText(/Admin sign-in: PASS/).waitFor();
  if (galleryCaseId) {
    await M.getByLabel('Moderation case ID').first().fill(galleryCaseId);
    await M.getByLabel('Action').first().selectOption('remove');
    await M.getByLabel(/Moderation reason|Review reason/).first().fill('QR Gallery focused browser acceptance remove');
    await M.getByRole('button', { name: /Apply moderation action/i }).first().click();
    await M.getByText(/Apply moderation action: PASS/).waitFor();
  }
  addCheck('GALLERY-M-MODERATION', 'M', '/community-ops/', 'Moderator removes reported Gallery target through targeted Ops UI',
    Boolean(galleryCaseId), galleryCaseId ? 'Moderation action PASS' : 'No caseId captured',
    { workId, ...(galleryCaseId ? { caseId: galleryCaseId } : {}) },
    galleryCaseId ? null : 'CASE_ID_MISSING');

  const negativeMedia = mediaId ? await publicMediaProbe(anon, mediaId) : { status: 0, error: 'MEDIA_ID_MISSING' };
  await anon.goto(baseUrl + '/gallery/?work=' + encodeURIComponent(workId), { waitUntil: 'networkidle' });
  const moderatedStillVisible = await visibleText(anon, title);
  const moderationNegativePass = !moderatedStillVisible && negativeMedia.status === 404 && negativeMedia.error === 'MEDIA_NOT_PUBLIC';
  addCheck('GALLERY-ANON-MODERATION-NEGATIVE', 'anon', '/gallery/?work=<id>',
    'Removed work is no longer public and its media signing is rejected',
    moderationNegativePass,
    'Public title visible=' + moderatedStillVisible + '; media HTTP ' + negativeMedia.status + ' code=' + (negativeMedia.error ?? 'none'),
    { workId, mediaId: mediaId ?? '' }, negativeMedia.error ?? null);

  await B.goto(baseUrl + '/gallery/my/', { waitUntil: 'networkidle' });
  const inaccessibleSaved = await B.locator('a.row[aria-disabled="true"]').count() > 0;
  addCheck('GALLERY-SAVED-NOT-ACCESS-GRANT', 'B', '/gallery/my/',
    'Saved reference remains non-access-grant after moderation',
    inaccessibleSaved, inaccessibleSaved ? 'Saved row inaccessible' : 'Inaccessible saved row not observed', { workId });

  await A.goto(baseUrl + '/qa/ask/', { waitUntil: 'networkidle' });
  await A.getByLabel(/Question title/i).waitFor();
  const qTitle = 'QR Question ' + runId;
  await A.getByLabel(/World Editor/i).check();
  await A.getByLabel(/Question title/i).fill(qTitle);
  await A.getByLabel(/Describe the problem/i).fill('How should this focused staging Q&A browser fixture be resolved?');
  await A.getByLabel(/Platform/i).fill('Switch');
  await A.getByLabel(/Game version/i).fill('1.25.0');
  const askResp = await commandResponse(A, 'askQuestion', () => A.getByRole('button', { name: /Publish Question/i }).click());
  const questionId = String(askResp.body?.data?.questionId ?? '');
  if (questionId) report.entities.questionId = questionId;
  addCheck('QA-A-ASK-CONTEXT', 'A', '/qa/ask/', 'Ask with structured Context Tags publishes', askResp.status === 200 && Boolean(questionId), 'HTTP ' + askResp.status, questionId ? { questionId } : {});

  await anon.goto(baseUrl + '/qa/', { waitUntil: 'networkidle' });
  await anon.getByPlaceholder(/Search questions/i).fill(qTitle);
  await anon.getByLabel(/Unanswered only/i).check();
  await anon.getByRole('button', { name: /^Search$/ }).click();
  const unansweredVisible = await visibleText(anon, qTitle);
  addCheck('QA-UNANSWERED-FILTER', 'anon', '/qa/', 'Unanswered is a filter/view and finds CURRENT+UNRESOLVED Question', unansweredVisible, unansweredVisible ? 'Question found under filter' : 'Question not found', { questionId });

  await B.goto(baseUrl + '/qa/participate/?question=' + encodeURIComponent(questionId), { waitUntil: 'networkidle' });
  await B.getByRole('heading', { name: qTitle }).waitFor();
  await commandResponse(B, 'setSameHere', () => B.getByRole('button', { name: /Same Here/i }).click());
  const answerText = 'Reusable QR answer ' + runId;
  await B.getByLabel(/Write an answer/i).fill(answerText);
  const answerResp = await commandResponse(B, 'addAnswer', () => B.getByRole('button', { name: /^Answer$/i }).last().click());
  const answerId = String(answerResp.body?.data?.answerId ?? '');
  if (answerId) report.entities.answerId = answerId;
  const utilityResp = await commandResponse(B, 'setAnswerUtility', () => B.getByRole('button', { name: /^Helpful$/i }).click());
  addCheck('QA-B-SAMEHERE-ANSWER-UTILITY', 'B', '/qa/participate/?question=<id>',
    'B Same Here on CURRENT+UNRESOLVED, Answer, and utility state succeed',
    answerResp.status === 200 && utilityResp.status === 200 && Boolean(answerId),
    'Answer HTTP ' + answerResp.status + '; utility HTTP ' + utilityResp.status,
    { questionId, ...(answerId ? { answerId } : {}) });

  await anon.goto(baseUrl + '/qa/', { waitUntil: 'networkidle' });
  await anon.getByPlaceholder(/Search questions/i).fill(qTitle);
  await anon.getByLabel(/Unanswered only/i).check();
  await anon.getByRole('button', { name: /^Search$/ }).click();
  const stillUnanswered = await visibleText(anon, qTitle);
  addCheck('QA-UNANSWERED-NOT-MODEL', 'anon', '/qa/', 'Answered Question drops from Unanswered filter without a separate content model', !stillUnanswered, stillUnanswered ? 'Question incorrectly remained' : 'Question absent as expected', { questionId });

  await A.goto(baseUrl + '/qa/participate/?question=' + encodeURIComponent(questionId), { waitUntil: 'networkidle' });
  await A.getByRole('heading', { name: qTitle }).waitFor();
  const acceptResp = await commandResponse(A, 'resolveQuestion', () => A.getByRole('button', { name: /Accepted Answer/i }).click());
  const acceptedVisible = await A.getByText(/Accepted Answer/i).isVisible().catch(() => false);
  addCheck('QA-A-SOLVE-REUSABLE', 'A', '/qa/participate/?question=<id>',
    'Question solves only with accepted reusable Answer or valid Solution Note',
    acceptResp.status === 200 && acceptedVisible, 'Resolve HTTP ' + acceptResp.status + '; accepted marker=' + acceptedVisible,
    { questionId, answerId });

  await B.goto(baseUrl + '/qa/tip/?question=' + encodeURIComponent(questionId) + '&answer=' + encodeURIComponent(answerId), { waitUntil: 'networkidle' });
  await B.getByRole('button', { name: /Create Tip from this Answer/i }).waitFor();
  const tipResp = await commandResponse(B, 'createTip', () => B.getByRole('button', { name: /Create Tip from this Answer/i }).click());
  const tipId = String(tipResp.body?.data?.tipId ?? '');
  if (tipId) report.entities.tipId = tipId;
  addCheck('QA-B-ANSWER-TO-TIP', 'B', '/qa/tip/', 'Explicit Answer -> Tip creation succeeds', tipResp.status === 200 && Boolean(tipId), 'HTTP ' + tipResp.status, { questionId, answerId, ...(tipId ? { tipId } : {}) });

  await B.goto(baseUrl + '/qa/my/', { waitUntil: 'networkidle' });
  const myAnswer = answerId ? await visibleText(B, answerId) : false;
  const myTip = tipId ? await visibleText(B, tipId) : false;
  addCheck('QA-B-MY-ACTIVITY', 'B', '/qa/my/', 'My Activity shows Answer and Tip contributions', myAnswer && myTip, 'answer=' + myAnswer + '; tip=' + myTip, { answerId, tipId });

  await anon.goto(baseUrl + '/qa/?tip=' + encodeURIComponent(tipId), { waitUntil: 'networkidle' });
  const tipNeedsUi = await anon.getByRole('button', { name: /Needs recheck/i }).count() > 0;
  addCheck('QA-TIP-NEEDS-RECHECK-UI', 'B', '/qa/?tip=<id>',
    'Tip owner can transition Tip to NEEDS_RECHECK through production-shaped route',
    tipNeedsUi, tipNeedsUi ? 'Needs recheck control visible' : 'No Tip freshness control rendered', { tipId },
    tipNeedsUi ? null : 'UI_CONTROL_NOT_FOUND');
  if (!tipNeedsUi) addDefect('QA-TIP-FRESHNESS-CONTROL-NOT-EXPOSED', '/qa/', 'Backend freshness command exists but no production-shaped Tip owner freshness control is rendered.');

  const tipNeedsEdge = await directBrowserCommand(B, 'setQaFreshness', { targetEntityId: tipId, freshness: 'needs_recheck' });
  await anon.goto(baseUrl + '/qa/', { waitUntil: 'networkidle' });
  await anon.getByRole('button', { name: /^Tips$/i }).click();
  await anon.getByPlaceholder(/Search questions and tips/i).fill(qTitle);
  await anon.getByRole('button', { name: /^Search$/ }).click();
  const tipStillDiscoverable = await visibleText(anon, qTitle);
  addCheck('QA-TIP-NEEDS-RECHECK-BROWSER-EDGE', 'B', '/qa/',
    'Supporting browser-edge proof: NEEDS_RECHECK Tip removed from ordinary discovery',
    tipNeedsEdge.status === 200 && !tipStillDiscoverable,
    'Edge HTTP ' + tipNeedsEdge.status + '; ordinary discovery visible=' + tipStillDiscoverable, { tipId });

  await B.goto(baseUrl + '/qa/participate/?question=' + encodeURIComponent(questionId), { waitUntil: 'networkidle' });
  const answerReportResp = await commandResponse(B, 'reportEntity', () => B.getByRole('button', { name: /^Report$/i }).last().click());
  const answerCaseId = String(answerReportResp.body?.data?.caseId ?? answerReportResp.body?.caseId ?? '');
  if (answerCaseId) report.entities.answerModerationCaseId = answerCaseId;

  await M.goto(baseUrl + '/community-ops/', { waitUntil: 'networkidle' });
  const signInButton = M.getByRole('button', { name: /^Sign in$/ });
  if (await signInButton.isEnabled().catch(() => false)) {
    await M.getByLabel('Supabase URL').fill(supabaseUrl);
    await M.getByLabel('Publishable key').fill(publishableKey);
    await M.getByLabel('Email').fill(actors.M.email);
    await M.getByLabel('Password').fill(actors.M.password);
    await signInButton.click();
    await M.getByText(/Admin sign-in: PASS/).waitFor();
  }
  if (answerCaseId) {
    await M.getByLabel('Moderation case ID').first().fill(answerCaseId);
    await M.getByLabel('Action').first().selectOption('remove');
    await M.getByLabel(/Moderation reason|Review reason/).first().fill('QR Q&A accepted Answer removal');
    await M.getByRole('button', { name: /Apply moderation action/i }).first().click();
    await M.getByText(/Apply moderation action: PASS/).waitFor();
  }
  const reopened = await publicQuestionProbe(anon, questionId);
  const reopenPass = Boolean(answerCaseId) && reopened.status === 200 && reopened.resolutionState === 'unresolved' && !reopened.acceptedAnswerId;
  addCheck('QA-MODERATION-REOPENS-QUESTION', 'M', '/community-ops/',
    'Removing accepted Answer clears acceptance and re-opens Question',
    reopenPass,
    'Question HTTP ' + reopened.status + '; resolution=' + reopened.resolutionState + '; accepted=' + Boolean(reopened.acceptedAnswerId),
    { questionId, answerId, ...(answerCaseId ? { caseId: answerCaseId } : {}) });

  await A.goto(baseUrl + '/qa/ask/', { waitUntil: 'networkidle' });
  await A.getByLabel(/World Editor/i).check();
  const dupTitle = qTitle + ' duplicate';
  await A.getByLabel(/Question title/i).fill(dupTitle);
  await A.getByLabel(/Describe the problem/i).fill('Duplicate QR question.');
  await A.getByLabel(/Question title/i).blur();
  await A.waitForTimeout(800);
  const relatedVisible = await visibleText(A, qTitle);
  addCheck('QA-RELATED-DUPLICATE-DISCOVERY', 'A', '/qa/ask/', 'Related Questions shows strong candidate before duplicate publication', relatedVisible, relatedVisible ? 'Related original visible' : 'Related original missing', { questionId });

  const dupAskResp = await commandResponse(A, 'askQuestion', () => A.getByRole('button', { name: /Publish Question/i }).click());
  const duplicateId = String(dupAskResp.body?.data?.questionId ?? '');
  if (duplicateId) report.entities.duplicateQuestionId = duplicateId;
  await A.goto(baseUrl + '/qa/participate/?question=' + encodeURIComponent(duplicateId), { waitUntil: 'networkidle' });
  const duplicateUi = await A.getByRole('button', { name: /duplicate|withdraw|redirect/i }).count() > 0;
  addCheck('QA-DUPLICATE-WITHDRAW-UI', 'A', '/qa/participate/?question=<duplicate>',
    'Strong duplicate withdraw/redirect is executable through production-shaped UI',
    duplicateUi, duplicateUi ? 'Duplicate control visible' : 'No duplicate withdraw/redirect control rendered',
    { questionId: duplicateId, targetQuestionId: questionId },
    duplicateUi ? null : 'UI_CONTROL_NOT_FOUND');
  if (!duplicateUi) addDefect('QA-DUPLICATE-WITHDRAW-NOT-EXPOSED', '/qa/participate/', 'Backend duplicate-withdraw/redirect command exists but no production-shaped owner action is rendered.');

  const dupEdge = await directBrowserCommand(A, 'withdrawDuplicateQuestion', { questionId: duplicateId, targetQuestionId: questionId });
  const redirectProbe = await anon.evaluate(async ({ supabaseUrl, publishableKey, duplicateId }) => {
    const response = await fetch(supabaseUrl + '/functions/v1/community-public-query', {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        rpc: 'community_get_question_redirect_public_v1',
        payload: { p_question_id: duplicateId }
      })
    });
    let body = null; try { body = await response.json(); } catch {}
    return { status: response.status, targetQuestionId: body?.targetQuestionId ?? null };
  }, { supabaseUrl, publishableKey, duplicateId });
  addCheck('QA-DUPLICATE-REDIRECT-BROWSER-EDGE', 'A', '/qa/',
    'Supporting browser-edge proof: duplicate withdrawal produces public redirect',
    dupEdge.status === 200 && redirectProbe.status === 200 && String(redirectProbe.targetQuestionId) === questionId,
    'withdraw HTTP ' + dupEdge.status + '; redirect HTTP ' + redirectProbe.status,
    { questionId: duplicateId, targetQuestionId: questionId });

  await anon.goto(baseUrl + '/qa/', { waitUntil: 'networkidle' });
  await anon.locator('#site-locale').selectOption('de');
  await anon.waitForFunction(() => document.documentElement.lang === 'de');
  const deLang = await anon.evaluate(() => document.documentElement.lang);
  const deOverflow = await hasHorizontalOverflow(anon);
  await anon.keyboard.press('Tab');
  const focusTag = await anon.evaluate(() => document.activeElement?.tagName ?? '');
  addCheck('COMMUNITY-FOCUSED-A11Y-L10N-SMOKE', 'anon', '/qa/',
    'Keyboard focus available, active locale applies, representative non-EN route has no whole-page overflow',
    deLang === 'de' && !deOverflow && focusTag !== 'BODY',
    'lang=' + deLang + '; overflow=' + deOverflow + '; focused=' + focusTag);

  report.cleanup.requested = true;
  const cleanupResults = [];
  if (tipId) cleanupResults.push(await directBrowserCommand(B, 'deleteWork', { workId: tipId, expectedVersion: null, idempotencyKey: crypto.randomUUID() }));
  if (questionId) cleanupResults.push(await directBrowserCommand(A, 'deleteWork', { workId: questionId, expectedVersion: null, idempotencyKey: crypto.randomUUID() }));
  if (workId) cleanupResults.push(await directBrowserCommand(A, 'deleteWork', { workId, expectedVersion: null, idempotencyKey: crypto.randomUUID() }));
  report.cleanup.browserOwnerDeleteAttempted = cleanupResults.length;
  report.cleanup.browserOwnerDeleteHttp = cleanupResults.map((x) => x.status);
  report.cleanup.state = cleanupResults.every((x) => x.status === 200) ? 'OWNER_DELETE_REQUESTS_ACCEPTED' : 'OWNER_DELETE_PARTIAL';

  await anon.goto(baseUrl + '/qa/', { waitUntil: 'networkidle' });
  await anon.screenshot({ path: path.join(outDir, 'qa-public-final.png'), fullPage: true });

  const mandatory = [
    'GALLERY-A-SIGNIN-CREATOR','GALLERY-A-PUBLISH','GALLERY-A-MY-WORKS',
    'GALLERY-ANON-PUBLIC-MEDIA-POSITIVE','GALLERY-B-INTERACTIONS','GALLERY-B-SAVED',
    'GALLERY-B-OWNER-MUTATION-DENIED','GALLERY-A-SEES-INTERACTION','GALLERY-A-COMMENT-CONTROL-UI',
    'GALLERY-M-MODERATION','GALLERY-ANON-MODERATION-NEGATIVE','GALLERY-SAVED-NOT-ACCESS-GRANT',
    'QA-A-ASK-CONTEXT','QA-UNANSWERED-FILTER','QA-B-SAMEHERE-ANSWER-UTILITY','QA-UNANSWERED-NOT-MODEL',
    'QA-A-SOLVE-REUSABLE','QA-B-ANSWER-TO-TIP','QA-B-MY-ACTIVITY','QA-TIP-NEEDS-RECHECK-UI',
    'QA-MODERATION-REOPENS-QUESTION','QA-RELATED-DUPLICATE-DISCOVERY','QA-DUPLICATE-WITHDRAW-UI',
    'COMMUNITY-FOCUSED-A11Y-L10N-SMOKE','A11Y-FORM-ERROR-LIVE'
  ];
  const byId = new Map(report.checks.map((c) => [c.id, c]));
  const allMandatoryPass = mandatory.every((id) => byId.get(id)?.result === 'PASS');
  const noMeaningfulErrors = report.consoleErrorCount === 0 && report.pageErrorCount === 0;
  report.result = allMandatoryPass && noMeaningfulErrors && report.cleanup.state === 'OWNER_DELETE_REQUESTS_ACCEPTED'
    ? 'PASS'
    : 'FAIL';
} catch (error) {
  report.result = report.result === 'WAIT_FOR_CONFIGURED_BROWSER_ENVIRONMENT' ? report.result : 'FAIL';
  report.fatalError = sanitize(error instanceof Error ? error.message : error);
} finally {
  for (const ctx of Object.values(contexts)) await ctx.close().catch(() => {});
  await browser.close().catch(() => {});
  report.routeErrors = Object.fromEntries(Array.from(routeErrors.entries()).map(([key, value]) => [key, value]));
  report.timestampCompleted = new Date().toISOString();
  await writeFile(path.join(outDir, 'gallery-qa-browser-report.json'), JSON.stringify(report, null, 2));
  console.log('QR_RESULT=' + report.result + ' checks=' + report.checks.length + ' defects=' + report.defects.length + ' consoleErrors=' + report.consoleErrorCount + ' pageErrors=' + report.pageErrorCount);
}

if (report.result !== 'PASS') process.exitCode = 1;
