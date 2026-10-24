# 04 QR — Signed Gallery Staging A/B/M operator runbook (Issue #130 / #121)

Status: HARNESS IMPLEMENTED / OFFLINE CONTRACT TEST REQUIRED / REAL AUTH SIGNED E2E NOT YET ACCEPTED.

## Source boundary

- QA branch: `integration/qr-signed-gallery-e2e-harness-20261024`, initially branched from 03 COMM Draft PR #129 `02750fcbcfd3f94fc12b39c8adf5757fa24a5646`; this is the exact backend SHA pinned by the harness. PR #123 -> #126 -> #129 integration was confirmed at this SHA. If any parent/child source or deployed migration advances, review, repin and rerun CI before signed acceptance.
- Existing anonymous workflow `.github/workflows/community-public-browser-acceptance.yml` is preserved; manual `signed_gallery=true` adds a separately gated A/B/M job. No new repository/test stack. Node 22 built-in fetch/FormData and tests under existing `scripts/`, `tests/`.
- Operator must verify actual deployed migrations/Edge versions independently and record them in the approved private run. Harness output labels backend SHA as pinned source, NOT an automatically attested live deployment revision.

## Minimum GitHub configuration, no secret content in reports

Operator opens `DreamwishWand/web > Settings > Secrets and variables > Actions`.

At **repository Variables**, add/check:

- `DREAMWISH_SUPABASE_URL` = `https://ptpdoxhrqopvczpclcij.supabase.co`
- `DREAMWISH_SUPABASE_PUBLISHABLE_KEY` = currently enabled staging **publishable** key, taken directly from project dashboard (public key; never paste in Issues/Drive/logs).
  
Create/protect **Environment** `staging-gallery-signed-acceptance`: require named human reviewer approval; restrict to the authorized QA `integration/**` branch and reviewers with staging/operator permission. Environment-protection setup must be checked in GitHub UI; merely naming the environment in YAML does not prove reviewer protection.

Within **that Environment Variables**, set:

- `DREAMWISH_GALLERY_E2E_APPROVAL=APPROVED_DISPOSABLE_GALLERY_STAGING_ONLY` **only after** separate explicit scoped media/auth operator authorization;
- `DREAMWISH_GALLERY_BACKEND_SHA=02750fcbcfd3f94fc12b39c8adf5757fa24a5646` **only if** this exact target is reviewed and deployed;
- `DREAMWISH_GALLERY_SUBJECT_ID` = one pre-reviewed verified Switch v1.25.0/schema624 Floating Island UUID appropriate to Gallery kind `outdoor`;
- `DREAMWISH_GALLERY_DB_MIGRATION` = operator-verified latest applied Staging DB migration version (14 digits; e.g. `20261025002200`, not an unverified guess);
- `DREAMWISH_GALLERY_EDGE_VERSIONS` = operator-verified exact `community-media:vN;community-public-media:vN;community-query:vN;community-command:vN`, current example `community-media:v16;community-public-media:v6;community-query:v14;community-command:v30`. Harness labels these attestations, not independent deployment proof;
- `DREAMWISH_GALLERY_A_ACCOUNT_ID`, `DREAMWISH_GALLERY_B_ACCOUNT_ID`, `DREAMWISH_GALLERY_M_ACCOUNT_ID` = three distinct approved **disposable** Wand account UUIDs, never real user accounts;
- `DREAMWISH_GALLERY_M_MODERATOR_APPROVED=true` only after independently checking that M has correct moderator membership. Harness proves M role **without reading any moderation-case data** by asking for deliberately invalid `state` with `limit:1`: real M receives `400 ADMIN_OPERATION_FAILED` after the role check, ordinary B receives `403 FORBIDDEN` before parameter validation. No case SELECT is reached. This uses the inspected current deployed SQL ordering; a contract change must fail closed and prompt review.

Within **that Environment Secrets**, set these six values separately:

- `DREAMWISH_GALLERY_A_EMAIL` / `DREAMWISH_GALLERY_A_PASSWORD`
- `DREAMWISH_GALLERY_B_EMAIL` / `DREAMWISH_GALLERY_B_PASSWORD`
- `DREAMWISH_GALLERY_M_EMAIL` / `DREAMWISH_GALLERY_M_PASSWORD`

Never paste emails, passwords, JWTs, service-role keys, Vault tokens, historical signed Storage URLs or sensitive project data into GitHub Issues, Drive Docs, actions logs, shell commands, or the chat. Use only normal password sessions.

## Execution

1. Review the exact current integrated Draft PR SHA/deploy versions, staging subject provenance and approved isolated media/account scope. Verify the three disposable accounts have fresh confirmed password login, Wand Account, A CreatorProfile and M moderator role. Review that unrelated staging works/media will not be affected.
2. Run `node --test tests/community-gallery-signed-acceptance.test.mjs` and `node scripts/community-gallery-signed-acceptance.mjs --preflight` without credentials. These are offline only and cannot be counted as signed PASS.
3. Manually dispatch **Community public browser acceptance** from the QA integration branch. First run anonymous browser with `signed_gallery=false` after setting public repo Variables; require actual Chrome steps *executed*, not just green workflow envelope. For the signed run select `signed_gallery=true` and approve the protected environment only after scope review.
4. The signed job fails closed before network on wrong origin, wrong integrated SHA, missing variables, missing actor IDs, collision, missing scope or main branch. It then performs real password login A/B/M and owner/role checks before allocating upload media.
5. For A, the script prepares two unique disposable media intents, PUTs image bytes to Storage returned signed URLs (never prints URLs), finalizes READY/CLEAR, verifies owner status, publishes Gallery Photo for the reviewed verified Subject, creates a second immutable revision, checks stale-rowVersion 409 and public/owner binary SHA-256+byte length. It expects B/M 403 and anonymous 401 on owner binary, historical public media 404, Owner Cloud Retirement preflight read-only and B 403. A failed assertion prevents further steps.
6. On failure **before any Gallery publication attempt**, the harness attempts only **logical `galleryAbort` on its OWN unbound keys**, confirming the HTTP result. After a publication request starts, any lost/uncertain response preserves all media for read-only operator reconciliation; it never guesses whether the transaction committed. No physical Storage.remove or Cron. A published fixture is **not automatically deleted** because Gallery retirement and Cloud safety have not been accepted. Operator must inventory preserved disposable work/media afterward using approved safe read-only checks and documented preservation/cleanup disposition.
7. Only after an independently approved previously-issued *disposable* signed Storage bearer fixture is available, add a separate controlled timed 0/60/300/post-expiry and CDN/browser cache acceptance. **The current harness does not manufacture any old raw Gallery signed URL**; this is explicitly still NOT_EXECUTED.
8. Optional old-issued Storage bearer/browser cache **separate** runner: `scripts/community-gallery-preissued-cache-acceptance.mjs` with offline test `tests/community-gallery-preissued-cache.test.mjs`. This does not issue any token. The operator must capture a genuinely **already-issued** signed Storage URL *from an approved disposable fixture* at issuance time, and launch the controlled local/isolated runner within 15 seconds with `--live`, `CHROME_BIN` and `playwright-core`; GitHub dispatch delays are not suitable for the t=0 guarantee. Provide via encrypted runner environment only: `DREAMWISH_GALLERY_PREISSUED_APPROVAL=APPROVED_PREISSUED_DISPOSABLE_URL_ONLY`, `DREAMWISH_GALLERY_PREISSUED_SIGNED_URL` (secret), `DREAMWISH_GALLERY_PREISSUED_OWNER_SUBJECT_ID` (secret/approved disposable), `DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256`, `DREAMWISH_GALLERY_PREISSUED_BYTES_SHA256`, `DREAMWISH_GALLERY_PREISSUED_BYTE_SIZE`, `DREAMWISH_GALLERY_PREISSUED_ISSUED_AT` (UTC ISO), `DREAMWISH_SUPABASE_URL` (Staging). Script requires exact origin/private bucket/owner/path/digest, compares same old URL at issuance/~60/~300/~360 sec with separate HTTP and persistent Chrome page, rejects retained HTTP/browser 200 post-expiry; records only status/cache headers and no token. If old Gallery raw Storage issuer is already closed and a fresh sanctioned pre-issued URL **cannot** be obtained without weakening safety, record NOT_EXECUTED, never re-enable a raw signer just to pass the test.
9. Physical Storage deletion/Retention races require their **own** Operator+Privacy+Legal+Ops authorization, origin isolation, signed token+2h+5m elapsed, holds/race coverage and no shared Cron #33 forced run. Default physical delete gate and 72h finalized-unbound TTL remain OFF.

## Evidence rules

Allowed: QA branch/runner SHA, backend source SHA, inspected migration/Edge versions, generic actor labels A/B/M, disposable Work/Media UUIDs, action names, HTTP status, strict image bytes/SHA-256, blocked reason, test outcome, cleanup *request* status. Never claim logical cancellation physically removed Storage.

Forbidden: emails, passwords, tokens, refresh tokens, signed URLs, unrelated account IDs, raw moderation queue or personal content, service_role/Vault, native writer/apply.

**Acceptance classification:** OFFLINE HARNESS TESTS != REAL SIGNED ACCEPTANCE. Preserve R17 30 nodes PASS0/PARTIAL12/BLOCKED18 pending actual sanctioned HTTP evidence. Child PR remains Draft and must not be merged to main.

## Final integration verification — 2026-10-24

Backend lineage after upstream owner synchronization: PR #123 `a4c5f5df8dc229aaec9474b83214bd1b8da5951a` → PR #126 `cf6f153099ecdbcf5990878d60ca102f006b7061` → PR #129 `02750fcbcfd3f94fc12b39c8adf5757fa24a5646`. Initial QA snapshot was updated through explicit reviewed backend merge commits. Recheck exact current heads before a real signed run. Latest tests source-check stacked migrations `20261025002200` Abort Cover, `20261025002300` capacity physical 0/h, `20261025002400` known reference writer fence, and source/Edge contract. Staging read-only PostgreSQL confirmed all three known writer triggers, Abort Cover reference guard and capacity effective throughput diagnostics; this is not a true two-session concurrency test.

Verified Subject public RPC returns `{contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:[...]}` and the selected `outdoor` subject must be independently verified `switch` / `1.25.0` / BID `52BD625D9B4E0053` / schema `624`. An earlier runner expecting a top-level array was corrected. Owner Cloud nested `{contract:'ddv.gallery-cloud-preservation-readiness@1'}` must be negative for entitlement/private ACL/restore while blocked; no positive private Cloud acceptance. Normal authorized M role check is a no-row invalid-filter probe, **not** a real moderation queue read. No migration or Edge revision proves GitHub Actions Environment approvals; those remain human Operator-controlled.
