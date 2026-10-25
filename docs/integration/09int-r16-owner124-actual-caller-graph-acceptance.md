# DDVRE — 09 INT / R16 actual Caller Graph SHA two-backend independent acceptance

Date: 2026-10-26 JST. Owner source exact: 03 COMM Draft PR #134 commit 59270c14c5615e706c6b2d08207df96b3d937f9d (124 original source migrations). Source remains draft/DO_NOT_MERGE/DO_NOT_DEPLOY. R16 is work unit, NOT release R18.

## Independent executable evidence

Validation branch: validation/09int-r16-owner124-pinned-59270c-20261026. Actual test: tests/09int-r16-owner124-actual-pinned-two-session.py. CI GitHub Actions 40233423837 COMPLETED SUCCESS on isolated disposable Supabase local PostgreSQL after real 124-migration clean bootstrap. Test uses two distinct database backends and calls the actual public.community_gallery_graph_preflight_r15 and public.community_publish_gallery_pinned_r15; it does not implement any custom writer, prelock, caller digest, or R11–R15 contention replay. The only code adapted from Owner is synthetic record setup (not its tests); all new assertions are owned by 09 INT.

Confirmed result R16_INDEPENDENT_SOURCE124_TWO_BACKEND_CALLER_GRAPH PASS:
1. B obtains server-issued registryVersion=gallery-scene-scoped@r15, schemaVersion=1, old expectedGraphSha256 H0. Source response explicitly graphComplete=false.
2. Separate SQL connection A publishes Gallery A with H_A against same known Scene and COMMITs; shared historical GalleryRevisionPreset roster expands. B target Gallery Work rowVersion remains unchanged.
3. B issues a NEW actual pinned Writer request with H0, unused idempotency key. Source raises R15_STALE_GRAPH_TERMINAL; B WorkRevision, SearchDocument, Outbox, Idempotency/current pointer and rowVersion remain identical to pre-attempt.
4. B re-preflights current graph H1, H1 differs H0, and successfully publishes once with real Owner Writer. Exactly 1 B WorkRevision, SearchDocument, Outbox and Idempotency row is present.
5. After B commit, graph changes again. Repeating the completed same key, same original WorkVersion and H1 returns exact previous response with zero additional side effects; using same key with newly observed different SHA fails R15_IDEMPOTENCY_REQUEST_CONFLICT.
6. Legacy unpinned public.community_publish_gallery_v4 rejects linked Scene with R15_PINNED_GRAPH_REQUIRED.
All tests use disposable local synthetic identities/media metadata only; no real signed JWT, no real object Storage bytes, no CDN, no Staging/Production writes.

## Code Contract review and scope

Source API now provides service-role-only public.community_gallery_graph_preflight_r15, versioned SHA256 from private.gallery_r15_canonical_snapshot canonical JSONB including active identity, Account, target Work, requested PresetRevisions, old/new known Scene graph, current/historical Work/Revisions/Artifact and Media/Cover metadata. public.community_publish_gallery_pinned_r15 accepts expectedGraphSha256, checks it under R14 Account→sorted Artifact→PresetWork→GalleryWorks locks, distinguishes terminal stale from transient roster-change, validates Owner/Creator, and preserves immutable Revision/Search/Outbox/idempotency atomicity. Authenticated community-command Edge requires preflight pin registryVersion=gallery-scene-scoped@r15 and SHA format; never substitutes a fresh digest on retry. Scene-linked legacy 11-argument v4 now fail-closes. This is actual Source scoped enrollment, not universal registry; Graph SHA is not an independent all-facet all-writer digest.

The SQL pinned Writer takes Account lock before its already committed idempotency lookup (safe no-write replay) and under Graph locks validates fresh commands against exact original SHA. One-sided no-Preset Gallery v4 remains scoped R14. The Edge has bounded max3 separate RPC retries for 40P01/55P03/40001 with session authorization on repeat, but genuine injected transient Edge/normal signed actors have NOT been independently executed.

## All-Writer coverage delta

SOURCE_SCOPED_ENROLLED: real Gallery v4 no-Preset/known Scene preexisting R14 root/sorted locks; newly added single-known-Scene preflight→pinned actual Gallery Writer Caller SHA (R16 PASS). Three known historical reference trigger fences previously independently SOURCE_SCOPED_ENROLLED. Legacy Scene v4 bypass now FAIL_CLOSED.
SOURCE_FULLY_ENROLLED: NONE. Mixed five-facet complete old/new current/historical graph is NOT proven.
UNENROLLED: private Scene paired revision/paired Gallery cover candidate; dedicated Gallery Photo Writer; native/In-Game Preset and native DDV persistent apply; deferred Account/Media physical erasure.
FAIL_CLOSED: unsafe positive Generic Preset owner lifecycle, Gallery retirement/Delete/Unpublish, Cloud Private/Restore and unsupported direct Scene legacy publish.
UNKNOWN (positive operations fail closed): Biome, Floating Island, ToM Furniture, ToM Clothing source writers, native/in-game edges and Media/Cover/Cloud complete issuer/ref/dependency roster.
UNENROLLED with independent privacy/emergency safety behavior (SAFETY_INDEPENDENT): Account Privacy Phase1 suppression and emergency Moderator restrict/remove are not part of this globally enumerated Writer lock graph; do not suppress these protections while full cleanup remains disabled.
Global graphComplete=false, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false.

## R16 case disposition

G01 old B H0 after A current/historical publish while B Work version unchanged: PASS real two backend local.
G02 refreshed B H1 positive exactly once: PASS real Source scoped local.
G03 completed H1 replay after graph changes and changed-key digest conflict: PASS real Source scoped local.
G04 held Historical GalleryWork, held Artifact, held Account: accepted independently in prior R15 for Source119, NOT repeated on new pinned API. New pinned lock participation described by Source; full new signature race NOT independently accepted.
G05 Graph roster growth/multi Artifact, unknown facet reject: old R15 negative and new Source guard reviewed; no independent new real R16 race.
G06 Privacy phase1 vs new pinned writer, emergency Moderator restrict liveness, stale Actor change: NOT_EXECUTED in this isolated R16 test (prior privacy tests independent).
G07 injected 40P01/40001 authenticated Edge fresh transaction retry, original SHA fixed and terminal stale not retried: SOURCE STATIC/CONTRACT ONLY, runtime NOT_EXECUTED.
G08 Service-only read, forged SHA/registry, all Old/New Work/preset current/historical edge enumerations beyond single Scene: code review only; Signed normal A/B/Moderator M separate QA configuration BLOCKED.
G09 Actual registered ArtifactBlob/media bytes and historical Cover Storage/CDN t0/t60/t300/post expiry, cloud Private/Restore/physical cleanup: NOT_EXECUTED; positive operations OFF.

## 03 COMM and 04 QR remaining contract

03 COMM: run current final Source124 complete CI and bootstrap, maintain exclusive service-only preflight/pinned Writer ACL; independently verify bounded genuine Edge 40P01/40001/55P03 and Actor/Privacy before and during retry, including same key different digest and multiple Scene Artifact/other facets fail-closed. Design the full versioned all-five-facet + historical Gallery/Media/Cloud/native reference registry rather than silently promote Scene-only R15 token. Keep root lock ordering and same original SHA across new transactions. Shared public UX must use authenticated preflight, no direct private SQL.
04 QR: protected signed Owner A/Nonowner B/Moderator M, actual browser/client→Edge→RPC, privacy/retired identity, different tenant denial, old signed Media bearer URL t0/t60/t300/post and CDN, real Storage Object SHA/size and Cover lifecycle, injected transient retries, Moderator liveness. Local synthetic PG PASS does not count as Signed Staging acceptance.

Version/platform: Nintendo Switch DDV v1.25.0 BID 52BD625D9B4E0053 schema624; Switch v1.25.3 schema626 and Steam Native Writers OFF. ALL DRAFT PRS DO_NOT_MERGE/DEPLOY. Positive Gallery retirement/delete/unpublish, Cloud Private/Restore, physical cleanup/finalized72h, native World Editor writer/Product Apply OFF. R17 Product Tree PASS0/PARTIAL12/BLOCKED18 and seven seeding/Privacy/Legal/Ops blockers UNCHANGED. No R18.
