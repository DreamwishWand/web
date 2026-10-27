# DDVRE — 04 QR Independent Provider B Acceptance Contract (03 COMM Handoff)

**2026-10-27 | Owner 03 COMM | DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**  
**Purpose:** new-only independently falsifiable Gate A/B negative Provider safety tests. No signed tests, live writes, deployment, physical delete or public Publisher authorized by this document. Existing PR #167/#171 Operator runbook controls remain primary. Source142 local Legacy Signer PR #185 and Source140/141 tests are accepted history; DO NOT repeat.

## 0. Prerequisite and responsibility split

- 03 COMM supplies [Owner Decision Packet](provider-b-immutable-object-authority-decision-packet-20261027.md), verified Provider contract and Source137 strict driver remains CAPABILITY_BLOCKED. Neither this contract nor Provider documentation constitutes operator approval.
- 04 QR owns independent signed normal A/nonowner B/Moderator M test orchestration, actual object byte verification and CDN. Must not impersonate normal actors with service_role, use real user data or extend approval to physical cleanup.
- 09 INT independently inventories all Generic/Scene/worker/privileged writers and DB-versus-Provider failure ordering. QR consumes its manifest, not an incomplete optimistic test environment.
- Operator #130 alone authorizes each protected Gate A and separately restricted Gate B; names, bucket, prefix, scope, backup, legal hold, credential holders and cleanup plan must be recorded, never assumed from 2026-10-01 historic genuine staging.
- Pre-Gate-A state: Last known stage116/21 ACTIVE Edge/7 Cron, old Generic14/Scene1/Retention6 Copy/Remove paths; **NOT_SAFE_TO_RUN**. Source142 PR134 frozen functional 0b90e6681507a20c5cfa637752fb6c5a575c5d06 CI40295103790/bootstrap40295103855 SUCCESS is Source+Local only.

## 1. Operator readiness: fail before any signed Storage mutation

| Gate item | Proof to request / check | No-proof action |
| --- | --- | --- |
| A0 consent | Named human owner approval, separate scope of Stage barrier and later B disposable object writes, valid normal actors A/B/M | CONFIGURATION_BLOCKED |
| A1 inventory | Immutable record of active Edge/worker/Cron/direct SQL/S3/TUS/REST routes, credentials, IAM, published bucket/prefix roles and exact deployed SHA | Unknown route => NO-GO |
| A2 quarantine | Externally enforced global hard stop old Generic/Scene/Retention, signed ingress/compensation and arbitrary privileged producer; attest no in-flight Copy/SQL/Remove or late retry | Any in-flight operation => NO-GO |
| A3 deploy order | Verified safe inert bundle bytes then only reviewed historical116-to-Source142 semantic SQL/ACL/RLS/Triggers | SQL revoke first forbidden |
| A4 restore & legal | Protected clone, PITR, full actual Storage bytes snapshot, legal/privacy/Cloud impact and rollback-to-fail-closed plan | No recovery proof => BLOCKED |
| B0 isolated media | Approved disposable private bucket/key-prefix, retention and actor credentials, exact Supabase region/storage build/API client version | No explicit B approval => NOT_EXECUTED |

No approval: only source static inventory/read-only documents. Do not run negative overwrite probes against real user or preexisting published objects.

## 2. Exact minimal Gate B independent experiments

All experiments use different **approved disposable** fixture keys; expected object hashes computed by a verifier independent of the publisher. Record request+response, external second full GET/sha256/size, actor/credential, HEAD/GET conditional headers/status, timestamp, lease fence, anonymized key, provider version/build; do not log bearer tokens. A failed probe never authorizes deletion.

| ID | Test action | Required outcome |
| --- | --- | --- |
| QR-B01 | Document actual Standard Upload upsert:false, S3 Get/Head/Copy options, and exact unsupported PUT destination condition/version features | No invented ETag-as-generation or VersionID; unsupported strict Source137 driver remains blocked |
| QR-B02 | OwnerA prepares bounded Stage payload; conditional full S3 GET If-Match vs wrong/stale ETag, 404, partial/mime mismatch | Only correct full body accepted; SHA/byte size measured independently |
| QR-B03 | Concurrent Generic vs Scene same never-used Published key, identical and differing payloads, reverse winner race; attempt 3+ parallel | Exactly one immutable winning physical object; losers nooverwrite; actual winner identity proved by independent bytes; ambiguity quarantined |
| QR-B04 | After winner, attempt S3 Put, Copy, REST upsert:true, resumable/TUS, signed upload, privileged service/old Retention/Scene overwrite/move/delete | EVERY reachable unauthorized path denied by effective rights; any success = CRITICAL RED and stop |
| QR-B05 | Independent verifier with distinct role, network/client reads published full bytes multiple times cold origin; trust nonce/receipt replay and wrong digest | SHA256+size equal frozen fixture on every read, attestation cannot be supplied by publisher/metadata; replay rejected |
| QR-B06 | Mutate Stage after initial GET before upload, simulate ETag ABA or different Stage writer and recheck lease; source content transiently changed | Versionless source only safe if immutable staging permissions actually prohibit writes; otherwise DENY, not hash-based generation assumption |
| QR-B07 | Delayed physical upload after Lease expiry, new monotonic fence; conflict with existing winner | Late upload cannot authorize SQL Commit or steal existing key; physical orphan retained/quarantined |
| QR-B08 | Inject network timeout/5xx/ACK-loss after/before Provider accepted bytes; simulate retried same-idempotency request | Unknown outcome never blindly re-uploads, overwrites, adopts winner or deletes; evidence distinguishes retained physical bytes from DB |
| QR-B09 | Force database rollback after physical success, delayed retry and late failed compensation; fail Postcommit provider GET/mutate bytes if safely isolated | No compensation remove of winner; orphan quarantined; postcommit integrity incident suppresses only newly guarded readers; no unsafe repair |
| QR-B10 | Normal JWT OwnerA, nonownerB, ModeratorM on candidate Storage read/metadata and after incident; Source exact issuer and SQL behavior | Strict per-role denial and pre-existing signed bearer handling; synthetic SQL service-role test not counted as JWT |
| QR-B11 | Previously issued actual private signed URL before incident, t0/t60/t300/after expiry; CDN warm/cold/browser cache and already streaming request | Measure success/refusal separately; do not assert SQL guard revokes old bearer; note cache beyond expiry and external copies |
| QR-B12 | Legal Hold, Creator change, Privacy suppression, linked Cloud/Preset/Gallery historical reference checks during in-flight attempt | Owner/Legal/Cloud unknown => publication DENIED; Gate C Cleanup remains OFF |
| QR-B13 | Simulate provider restart/retry and independent HEAD/GET divergence or consistency delay | Unknown 404 and ETag drift cause quarantine, never verified positive |
| QR-B14 | Attestor wrong signer/expired receipt/nonce replay, leaked role, receipt reused different reservation/key/fence | Terminal fail-closed; no positive capability derived from ordinary GET alone |

QR-B04 needs a **known comprehensive issuer manifest** from INT, not a list limited to two WEP handlers. Privileged operator break-glass is separately audited, cannot silently be claimed impossible; if any capability can overwrite published bytes, versionless design is NOT accepted. Signed bearer experimental data must be scrubbed from CI and copied into protected evidence.

## 3. Report format and acceptance rubric

One independent evidence ledger row per request and per actor: testID, tested HEAD/base, declared API vs actual deployed Storage build, direct or cached reader identity, API method, intended/observed SHA256+size, destination conflict result, immutable provider identifier (only if real), exact prerequisite Gate approval, sealed log artifact hash, limitation and evidence class.

Classes:
- **CONFIRMED DOCUMENTED** — official API docs, not an executed Gate B.
- **PASS REAL PROVIDER** — executed authorized scoped test with independent evidence, exactly matching build and actor/roles.
- **FAIL REAL PROVIDER** — observed counterexample; stop and notify operator.
- **NOT_EXECUTED / CONFIGURATION_BLOCKED** — no environment, approval or actor.
- **UNKNOWN** — no reliable proof, treated as NO-GO.

Do not write PASS to any Gate B remote test from Source137 mocks/local O_EXCL, Source135 synthetic SQL, Owner Source142 CI or HTTP 200 without independent Byte SHA/Size and effective issuer proof. Distinguish signed user JWT from service_role and cache vs uncached origin.

## 4. Stop / cleanup / exit

Stop immediately for unauthorized alternate write, missing full verifier bytes, stale lease DB Commit, unknown ACK winner adopted, partial physical removal, active old Scene/Generic issuer, ineffective new-read Incident suppression or unanticipated old signed bearer exposure. Maintain global write barrier, quarantine all test keys, append durable incident/report, preserve physical object and backups; **do not delete even disposable object** without Operator Gate C separate approved cleanup plan and reference/legal evaluation. SQL ROLLBACK does not revert Provider writes; no old unsafe bundle rollback.

**Requested 04 QR return:** exact Operator approval state, read-only Stage manifest change, B01–B14 table with explicit REAL PASS / RED / NOT_EXECUTED, independent byte and role evidence, PR #171 link and Issue #130 blocker updates; do not restart accepted PR185. If B all green, only recommend Owner architecture review, NOT publish-enable. R17 release still 0PASS/12PARTIAL/18BLOCKED; NO R18/R19.
