# 09 INT / R18-work — Preset Storage publish, discard and compensation independent atomicity

Scope: isolated 09 INT continuation, not a new workstream, not Release Acceptance R18. Owner 03 COMM PR #134 Source133 exact HEAD `8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec`, original 133 SQL migrations. WEP parent #135 `d07b6bb5e976afb9df790562f9eb3fc2baf73d63` and isolated read-only child #147 `f9d94f7c4574933290018ec7fd0591d2f65d6efb` have **not** delivered the new Edge Guard. Owner PR #134 has **not** delivered a DB Reservation/Publication Protocol. No Owner/WEP code changed by this branch.

## Independent executable test

`tests/09int-r18-preset-storage-actual-edge-mock-atomicity.test.mjs` transpiles and executes the **actual Owner133 TypeScript Edge Handler** `supabase/functions/wep-preset-artifact/index.ts`, importing no Owner test assertions. The handler's authentication wrapper, request branching, read, discard, publish, deterministic key, live SHA of the artifact bytes, Storage API call order and RPC arguments execute in-process. `withSupabase`, session authorization, `community_publish_preset_envelope`, `artifact_blobs` lookup and Storage provider are mocks. Purpose: controlled asynchronous interleaving which advances beyond prior static source ordering, **not actual PostgreSQL, Deno Edge, real JWT, provider Storage, CDN or Staging**. Claim category: **CONFIRMED for actual transpiled Edge under deterministic mocks; HIGH CONFIDENCE for real-world exploitability pending provider acceptance**.

New tests:

1. **A copy → A RPC paused → B published-key discard → A commit**: B removes the unregistered published object and A commits metadata, yielding a DB pointer with absent mock Storage bytes. Expected unsafe witness on frozen Owner133, never a repair PASS.
2. **A copy → A RPC paused → B same deterministic published key and same idempotency key, differing title → B SQL success → A late SQL key-hash conflict → A compensating Storage.remove**: A removes B's successfully registered published object. This second independent unsafe compensation schedule was not previously executed through actual handler. Existing DB SQL request hash includes title and service idempotency, so differential request hash conflict is source-supported; mocked SQL scheduling is still not actual PG.
3. **A validates staging → copy paused → B discards staging → A fails promotion**: no dangling DB registration in mock, but in-flight publish liveness is not protected by a reservation; staging discard can sabotage safe in-flight publication.
4. **Foreign account and revoked session**: Edge route rejects foreign-prefix discard and revoked authorization before destructive Storage operation. Existing scoped auth boundary remains intact under mock.
5. **Authorized owner read**: mock read returns signed metadata without Storage mutation. No genuine signed provider bytes or privacy runtime proof.

Historical R11–R17 Lock, Graph SHA, Gallery Comments/Photo, Observer and QR race suites are retained; not recreated.

## Registry / Writer Matrix (Source133)

| Route or graph family | Status | Exact boundary |
| --- | --- | --- |
| Preset Envelope `community_publish_preset_envelope` | UNENROLLED (Source present) | SQL idempotency and local commit; no cross-provider reservation or complete reference graph |
| `artifact_blobs` -> current Preset revision | SOURCE_SCOPED metadata; Storage bytes UNKNOWN | SQL references can exist without Storage proof |
| `published/` key, copy promotion | UNENROLLED | object copied before database reservation/registration; deterministic key re-used |
| `staging/` preparation/upload | SOURCE_SCOPED prepare/session; concurrent discard UNENROLLED | signed staging and real signed provider not independently accepted |
| published Discard | UNENROLLED **unsafe present** | prior committed-row lookup is not publication fence, must FAIL_CLOSED via WEP change |
| staging Discard | UNENROLLED concurrency | staging-only owner prefix insufficient against in-flight publisher |
| failed-Publish compensation and physical remove | UNENROLLED **unsafe present** | removes a shared deterministic key after competing successful commit |
| current/historical `preset_revisions` and Artifact refs | SOURCE_SCOPED known / global UNKNOWN | no complete storage retention/Graph registry |
| Account/Creator/Work/Revision identity | SOURCE_SCOPED existing SQL/auth | full owner lifecycle, retired and privacy across provider boundary unproven |
| Gallery/Scene/Cloud/Native direct+historical refs | UNKNOWN or existing FAIL_CLOSED | distinct registered Gallery scoped repairs do not establish all-Preset graph |
| storage cleanup issuers, delayed cleanup, old signed URLs | UNKNOWN / disable destructive writes | no single enforceable reservation/retention authority |
| all graph complete / Source Fully Enrolled | FALSE | no Source-only mock promotion to global/full authority |

## Requested 02 WEP Edge Guard

- Reject ANY `published/` key for the user-triggered `discard` action **before any DB/Storage call**. Test foreign ownership, same-owner, forged session, privacy suppression, retired identity, no mutations. Do not replace it with an unrestricted cleanup endpoint.
- Require immutable staging upload/publish reservation claim for safe `staging/` discard; if producer is in flight, return terminal conflict/no physical delete. Temporary fail-closed staging discard is acceptable if safe ownership cannot be proven.
- Never execute automatic physical `remove(publishedStorageKey)` on SQL RPC failure; a deterministic published key may now belong to a competing successful publisher. Fail-closed plus separately authorized recovery/reconciliation is safer.
- Preserve user-signed session, correct Account/Creator, private read-only, owner-only preview and 8 locale UI existing contracts. Do not enable Scene Save Revision/Cloud/native Apply.

## Requested 03 COMM Source Reservation / publication protocol

- Additive migration and versioned service-only RPC for pre-copy reservation and post-copy storage-proof attestation, with source/account/creator/session binding, deterministic idempotency and exact immutable content SHA+size, explicit `RESERVED→COPYING→STORAGE_VERIFIED→COMMITTED` semantics and terminal rejected/suppressed/retired paths.
- Enforce same-key conflicts, lease expiry and ownership, stable snapshot and revalidation under locks, reservation reclamation and replay; allow a successful commit only after server-confirmed provider-object existence **and** byte hash check. DB code cannot check provider storage atomically by SQL alone: pair SQL state transitions with provider-side serialization/conditional operation or an owner-controlled immutable-key/no-delete protocol and reconciliation.
- Compensating physical deletes must be forbidden while ANY committed current/historical Artifact/Preset/Gallery/Scene/Cloud reference, pending reservation or unverified in-flight publisher exists. No destructive cleanup from absence of a single `artifact_blobs` row.
- Owner must provide tests with two real PostgreSQL backend sessions over ORIGINAL new SQL source, including late idempotency hash conflict, same-key replay, stale Session/Privacy/Moderator, and transactional rollback; 09 INT will independently pin and run only new cases. Until delivered, 2-PG new Reservation **NOT_EXECUTED**.

## 04 QR genuine provider release acceptance matrix

| Barrier / actor | Test | Required verdict |
| --- | --- | --- |
| Signed normal OwnerA, nonownerB, ModeratorM | JWT/session/retired/privacy and cross-account staging/published operations | HTTP denial with no provider mutation for unauthorized actors |
| Real bytes + staged upload | Prepare→signed PUT→Finalize/validate→Provider download actual sha256/length | verified immutable actual bytes, not metadata-only |
| A copy held / B discard | same published destination while pending registration | no deletion; no registered public Preset with missing bytes |
| A SQL failure / B success | same deterministic published key, differing request hash, retry | no compensation delete of B bytes |
| A active staging copy / B staging discard | asynchronous provider race | lease conflict or no destructive removal while owned |
| Same-key concurrent A/B | DB idempotent replay and source/bytes mismatch | replay same response or explicit terminal conflict; no poisoned key |
| Current and historical references | retire/unpublish/revision/Cloud/Creator all reference paths | no physical object removal while reachable |
| Owner Privacy and Moderator emergency | Phase1 suppression, retired identity, actual staff Restrict during publisher | prompt public-read suppression and no later unsafe commit |
| Recovery, crash and delayed cleanup | lost copy response, SQL outage, orphan retries, 72h | leak-safe durable recovery, no physical delete before provenance proof |
| Signed URL + CDN | prior bearer t0/t60/t300/post-expiry | no overclaim of revocation; actual CDN/cache behavior measured |

Real provider test is **NOT_EXECUTED / CONFIGURATION_BLOCKED** by Issue #130 and Source133→Staging116 semantic migration/Edge parity. No auto deployment or service_role substitution for normal signed actors.

## Release boundaries

`SOURCE_FULLY_ENROLLED=0`; `graphComplete=false`, `retirementAuthorized=false`, `saveRevisionAuthorized=false`, `pairedGalleryPublishAuthorized=false`. Positive Gallery retirement/unpublish/delete, Cloud Private/Restore, physical media cleanup/72h, Scene paired revision and Native DDV writer/Product Apply OFF. All Draft PRs DO_NOT_MERGE/DEPLOY. R17 release matrix stays 30 nodes: PASS0 / PARTIAL12 / BLOCKED18; no Release R18. Switch v1.25.0 schema624 native source only; Switch v1.25.3 schema626 read-only; Steam626 Native Writer OFF.
