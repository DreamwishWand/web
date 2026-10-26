# 04 QR — R18-work Preset Storage Provider Concurrency / Signed Staging Operator Acceptance Gate

Status: **SIGNED_PROVIDER_NOT_EXECUTED / CONFIGURATION_BLOCKED**. No release R18. No Staging SQL/Edge/Storage mutation permitted by this document.

## Immutable Source Evidence Pins (do not conflate)
| Scope | Exact source commit | Evidence class |
| --- | --- | --- |
| 09 INT pre-fix audit | 03 COMM Source133 `8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec`, 09 INT CI `40246837794` | HIGH_CONFIDENCE source-order / abstract in-memory schedule, NOT runtime |
| 04 QR actual pre-fix Edge handler | QA Draft PR153 `f7d91a90ce0451bb89fbe846190df301ba68d0e9`, CI `40248876909` SUCCESS | ACTUAL TypeScript handler + MOCK Storage and MOCK DB, reproduced Copy→Discard→SQL dangling pointer, competing failed Compensation, replay unavailable |
| 02 WEP provisional fixed Edge | WEP Draft PR154 patched source `66dc71ee828d965af04685844508d000261263a5` | physical Published/Staging Discard fail-closed; Compensation/auto Staging physical remove disabled; Owner later PR154 HEAD `1ab0cfb6445cce098f63b13d899fb68195c85233` CI40249508738 / source safety40249501762 SUCCESS, source file same as 66dc (later workflow/docs only) |
| 04 QR independent WEP fix | QA Draft PR157 HEAD `601498c1ce7fadd18ac305abb38f0e892ac9cd9d`, targeted CI40249588257 + full CI40249592993 SUCCESS | ACTUAL fixed Edge TS + MOCK Storage/DB. No physical delete, same-key retry and in-flight compensation safe in mock |
| 03 COMM provisional Source134 | frozen `cb86ac1ba4601d57dbaeb6a0c3e5c59e61d0749b` additive 02980, 134 migrations | PRIVATE reservation SourceSQL, old envelope and direct Published Blob insert fail closed; Owner HEAD actively evolving, no final provider acceptance; QA-only PR159 tests CURRENT+HISTORICAL refs real isolated PG |
| Previous accepted source | PR132, 140–152 | Untouched. Do not rerun already accepted Gallery/Photo/Privacy/Scene/Guide regressions |

## Independent Case Matrix and Evidence Type

| Case | Required invariant | Evidence state |
| --- | --- | --- |
| Published Key Discard, before DB registration | HTTP reject without Storage.remove; registration cannot point to missing bytes | 02 WEP SOURCE MOCK confirmed (PR157), REAL PROVIDER NOT_EXECUTED |
| Staging Key Discard vs in-flight Prepare / Copy | Reject without unsafe delete until DB Lease/cleanup permit | WEP SOURCE MOCK confirmed, REAL PROVIDER NOT_EXECUTED |
| Same-key concurrent Publish | Exactly one committed immutable key, no cross-request delete or mismatched checksum | WEP SOURCE MOCK, SQL Reservation source test separate; cross-system REAL PROVIDER NOT_EXECUTED |
| Copy→Discard→DB registration | Physical object remains until transaction outcome and durable references are known | PRE-FIX MOCK counterexample confirmed; post-fix WEP MOCK deny, REAL PROVIDER NOT_EXECUTED |
| Failed Publish Compensation | No Storage.remove on unknown SQL commit; record recoverable state and reconcile later | PRE-FIX MOCK counterexample; WEP MOCK denies destructive compensation; end-to-end RECOVERY NOT_EXECUTED |
| DB Reservation / Cleanup Denial | Owner-scoped Creator, Content hash, idempotency + stateVersion; Cleanup false under registered, in-flight, historical/current, Cloud unknown | Source134 isolated real PostgreSQL QA PR159 pending; provider NOT_EXECUTED |
| Completed Idempotency Replay | Return same immutable artifact without repeat Work/Revision/Outbox, actual download same bytes SHA | Mock local partial; genuine provider and DB commit route DISABLED, NOT_EXECUTED |
| Owner / Nonowner / Moderator / Privacy | Legitimate signed A only; B and retired denied; emergency M restrict independent of Owner lease, Phase1 privacy serializes | SQL/Handler synthetic inherited, actual signed Stage NOT_EXECUTED |
| Historical/current Preset refs | Never physically delete any blob referenced by old or current Revision or published Gallery scene | Source SQL reference counts partial; complete all facet registration and real provider retention NOT_EXECUTED |
| Binary Integrity | Download signed object bytes, calculate SHA256 independently, compare exact byte length and DB-declared hash; metadata-only hash is insufficient | NOT_EXECUTED |
| Old bearer/CDN t=0/60/300/post expiry | Distinguish newly requested URL denial from already issued bearer TTL/cache (warm and cold CDN, browser) | NOT_EXECUTED |
| Zero unexpected Work/Revision/Outbox mutations | Any rejected or rolled back writer leaves all related rows unchanged (except legitimate moderation/audit) | Source mock/source PG partial; genuine signed Stage NOT_EXECUTED |

## Read-only Staging Parity Gate

Staging Supabase project `ptpdoxhrqopvczpclcij` most recent **read-only** catalog: 116 historical managed migration ledger entries, highest `20261024043436`. WEP preset Edge v14 ACTIVE with JWT-on. Existing `community_publish_preset_envelope` RPC is present; current R18-work reservation / cleanup functions and table must be verified absent/present by exact read-only catalog before any operator migration. Source R12 Phase1 privacy, R15 Gallery graph/pinned Writer, R16 Atomic Gallery Comments, R17 Photo observer are missing. **Source134  != Staging116. Do NOT automatically apply 18 migration files**, do not rewrite `supabase_migrations.schema_migrations`, no remote db reset, no Cron33 forcing.

Operator prerequisites:
1. Freeze exact accepted **03 COMM SQL HEAD + 02 WEP Edge HEAD** and their integrated Edge route graph, migration numbers, ACL/RLS/trigger definitions, idempotency/recovery semantics. Ensure no staging deploy with mismatched SQL/Edge between WEP source and COMM freeze.
2. Separately review historical Staging116 provider-only versions against canonical Source134, reconcile function definition fingerprints, role grants, trigger ordering, reservation table ownership, byte metadata and Update/version policy. Rehearse both fresh source DB and a private staging-equivalent DB; record exact SQL statements/hashes/expected schema ledger.
3. Human Ops approves encrypted backup/PITR, immutable audit, retention/legal holds, recovery owner, rollback/rollforward procedure. On partial copy/error, **do not** physically delete unknown published keys; quarantine/reserve and reverify object bytes/DB references. No old user data reset.
4. Dedicated protected Actions Environment, e.g. `staging-preset-storage-signed-acceptance` with human required reviewers, approved integration branch, explicit exact backend SHA/Edge deployment identities; this is a new **proposal**, not an existing configured environment. Issue130 Gallery `staging-gallery-signed-acceptance` remains separate and its approval must not be silently generalized to Preset deletion.
5. Normal disposable Owner A, Nonowner B, Moderator M with **real credentials, JWT and verified Supabase sessions**, Creator Profiles and authorized Moderator role. Use only approved disposable Preset Work, private dedicated media prefixes and verified game scope (Switch DDV v1.25.0, BID52BD625D9B4E0053, schema624); no real user objects. NEVER pass a service_role key as Actor.
6. Actual signed Storage Prepare → PUT raw bytes → SHA256 calculated from independent downloaded bytes → authorized Copy → reservation verification → commit → readback; record object etag/checksum/byte size/content type and reference graph pre-/post-state. Same-key parallel requests from two clients, staged and published discard concurrently at controlled barriers, failure injection around Copy and DB COMMIT, retry and historical reference preservation. Reserve recoverable object after injected uncertainty rather than delete.
7. Separate operator-authorized old preissued signed URL fixture at t0/t60/t300/post-expiry, warm/cold CDN and browser. Previously issued bearer cannot be claimed instantly revoked by private/no-store Edge response.
8. Post-run reconcile disposable files and DB records under approved legal/retention rules. Do NOT use Gallery positive retire/unpublish/cloud restore, physical 72h cleanup, Scene paired Save or native DDV writer as test cleanup shortcuts.

## Recovery / Stop Conditions

On parity mismatch, stale Owner/Creator, unknown replay outcome, missing provider bytes, SHA mismatch, unregistered Writer family, historical/current reference unknown or old bearer unverified: **fail closed**, preserve source object and SQL evidence, freeze unsafe mutations, stop signed run. Approved ops owns PITR or corrective forward migration; no inferred deletion authority from a read-only preflight. Zero automated physical removals while reservation committed/pending/unknown.

Release remains Product Tree R17 **PASS 0 / PARTIAL 12 / BLOCKED 18**, seven seed gates/Guide Human QA0/315/Rights0/45/Privacy Legal Ops Issues138/139 blocked. `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`; SOURCE_FULLY_ENROLLED=0. Every Draft DO_NOT_MERGE/DO_NOT_DEPLOY. No formal Release R18 until genuine signed Provider E2E, cross-system DB/Storage reconciliation, moderation/privacy and legal gates accepted.


## 04 QR final exact-pin source QA evidence / Staging Edge inventory (2026-10-26)

Frozen Source134 Owner = cb86ac1ba4601d57dbaeb6a0c3e5c59e61d0749b. Owner CI40250228079 and clean bootstrap40250228046/40250223188 SUCCESS. Independent QA isolated **real local PostgreSQL** CI40250532648 SUCCESS (134 migrations): same-key replay, alternate staging-key conflict, foreign account/creator denial, 2 seeded current and historical Preset references with cleanup DENIED, reservation row lock 55P03, direct published Blob/old Publisher rejected, service-only ACL and zero unexpected Work/Revision/Outbox mutations.

Independent actual Source134 **Preset artifact Edge TypeScript with MOCK Storage/RPC** eleven cases: normal owned staged Scene SHA256/length derived from mocked Blob, deterministic published key/response validation, no actor spoofing, invalid staging bytes, foreign account, Privacy/Creator/Idempotency injected RPC denial, publish 409 BEFORE copy, discard always denies without physical removal, recovery state-only with stale CAS rejection, missing/retired session. **Source134 Retention Edge actual TypeScript with MOCK Worker RPC** three cases: authenticated worker 409 before blob claim, Storage.remove or finalizer; invalid/missing token 401, malformed request 400, nonPOST 405. Latest ordinary CI40252527369 SUCCESS (1050 total, 1038 PASS / 0 FAIL / 12 inherited SKIP), QA-only code, no Owner SQL/Edge changes. No real Storage Provider bytes/GET, no signed JWT actor/worker, no DB+Provider atomicity.

Fresh READ-ONLY Stage was still historical116 managed migrations, max20261024043436, old Preset Publisher RPC present; new Source134 Reserve/Recover/Cleanup RPC and private reservation table+published-registration trigger ABSENT. Actual deployed Edge executable contents MUST BE FINGERPRINTED and separately approved, NOT inferred from version labels or Source assumptions:

| Staging Edge slug | Version | verify_jwt | Operator parity significance |
| --- | ---: | --- | --- |
| wep-preset-artifact | 14 | true | Source134 publication/reservation handler parity missing |
| wep-preset-retention | 6 | false | Worker-token-gated; exact deployed physical delete behavior UNVERIFIED |
| wep-preset-flow-e2e | 9 | true | Audit all extra preset entrypoints |
| wep-retention-e2e | 4 | false | Audit worker token/purge callers |
| community-wep-retention-e2e | 5 | true | Audit additional Community cleanup callers |
| wep-scene-preset-product | 1 | true | Scene/Preset consumer, no native Writer authorization |
| community-command | 30 | true | Source R12/R15/R16 RPC parity absent |
| community-query | 14 | true | Source R17 Photo Preflight absent |
| community-retention | 12 | false | Separate global cleanup; do not conflate with preset purge |

Operator signed-provider acceptance must prove EVERY source/Edge/worker entrypoint's failclosed semantic parity with reviewed 134 SQL migrations and provider historical116 lineage; no blind 18-file append, migration history rewrites, remote DB reset, deploy or object manipulation absent explicit #130 approval. Require encrypted backup/PITR, safe forward/recovery, legally held refs, and normal disposable Owner A, Nonowner B, Moderator M with genuine JWT; service_role never impersonates a normal actor. Controlled parallel prepare/PUT/copy/discard/failed compensation/replay and reservation recovery must verify independently downloaded Provider object bytes, length and SHA256; preserve all current/historical refs and deny all unauthorized physical deletion. Separate old signed bearer t=0/60/300/post-expiry and CDN warm/cold (preissued token fixture). Unknown provider outcome must preserve object for reconciliation rather than delete.

Provider signed A/B/M/Storage GET byte integrity, CDN old bearer and real concurrent SQL+Object Storage race remain CONFIGURATION_BLOCKED / NOT_EXECUTED. Release stays R17 30 PASS0/PARTIAL12/BLOCKED18; no formal R18; all Drafts DO_NOT_MERGE/DO_NOT_DEPLOY and positive Preset publication/physical cleanup, Gallery retirement/Cloud, Scene paired Save/Native Apply OFF.
