# 04 QR — R18-work Preset Storage Provider Concurrency / Signed Staging Operator Acceptance Gate

Status: **SIGNED_PROVIDER_NOT_EXECUTED / CONFIGURATION_BLOCKED**. No release R18. No Staging SQL/Edge/Storage mutation permitted by this document.

## Immutable Source Evidence Pins (do not conflate)
| Scope | Exact source commit | Evidence class |
| --- | --- | --- |
| 09 INT pre-fix audit | 03 COMM Source133 `8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec`, 09 INT CI `40246837794` | HIGH_CONFIDENCE source-order / abstract in-memory schedule, NOT runtime |
| 04 QR actual pre-fix Edge handler | QA Draft PR153 `f7d91a90ce0451bb89fbe846190df301ba68d0e9`, CI `40248876909` SUCCESS | ACTUAL TypeScript handler + MOCK Storage and MOCK DB, reproduced Copy→Discard→SQL dangling pointer, competing failed Compensation, replay unavailable |
| 02 WEP provisional fixed Edge | WEP Draft PR154 patched source `66dc71ee828d965af04685844508d000261263a5` | physical Published/Staging Discard fail-closed; Compensation/auto Staging physical remove disabled; Owner later PR154 HEAD `1ab0cfb6445cce098f63b13d899fb68195c85233` CI40249508738 / source safety40249501762 SUCCESS, source file same as 66dc (later workflow/docs only) |
| 04 QR independent WEP fix | QA Draft PR157 HEAD `601498c1ce7fadd18ac305abb38f0e892ac9cd9d`, targeted CI40249588257 + full CI40249592993 SUCCESS | ACTUAL fixed Edge TS + MOCK Storage/DB. No physical delete, same-key retry and in-flight compensation safe in mock |
| 03 COMM provisional Source134 | frozen `1e900d1ed18785cc3fc43e78a000b36124fc6a46` additive 02980, 134 migrations | PRIVATE reservation SourceSQL, old envelope and direct Published Blob insert fail closed; Owner HEAD actively evolving, no final provider acceptance; QA-only PR159 tests CURRENT+HISTORICAL refs real isolated PG |
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
