# W-COMM-006 / R16–R17 — Stage116 two-track safe-forward prerequisite (non-executable)

**Status:** SOURCE_ONLY stage-evidence gate / DRAFT / NO_MERGE / NO_DEPLOY. This is a *negative release preflight*, not a repair migration, SQL generator, managed-stage verification, or approval to enable a Community Writer. Original 82 historical SQL file bytes/SHA MUST remain unchanged.

## Anchors and evidence categories

- 09P-SQL read-only managed Staging evidence **E-09P-SQL-R17-STAGING116-LEDGER-SHA256-20261106**: 116 applied versions; 112 distinct names; four name-duplicate pairs; all 116 stored statement lists present, zero rollback statements; manifest SHA256 `889bfd7dfa7e2ee9bba65a92f6f1f8675bf98ad165d870df1781b842f03c4861`, function catalogue SHA256 `c3c1d224139a633a601f516d815e77a1567a60bd241a42ad3be630ffd01fa6ac`. Hash roots identify the previous metadata observation only; they do not prove that the repo SQL bytes, function ACL semantics, or a future managed snapshot match.
- Same-named `community_core_v0_server_rpc` was applied as `20260930025609`; immutable repo original version is `20260930025132`, Git blob `bbf9bc830440d964c5da8b3c3cac7e926d281881`. Different versions cannot be silently aliased or rewritten. FK hardening `20260930115623` applied while source prerequisite `20260930115500` absent from applied ledger, even though physical table exists. Never replay either migration by name alone.
- On Staging, 6 retired legacy SQL RPCs have effective `service_role EXECUTE=true`, `anon/authenticated=false`, while none of Source164–169 is applied. The **exact** prerequisite `public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)` is **ABSENT**; merely having v2 Gallery Comments or Workspace signed Get/Delete does not satisfy Source164.
- Source164 SQL Git blob `8a272688b3f85e999e43cb772736dba6bc305606` has a precondition that explicitly requires R16 signed Gallery Comments and two Workspace grants. Direct Source164–169 Staging deployment would not satisfy its accepted preconditions. No developer may bypass these guards or reGRANT the old Writer.
- PR676 frozen Source HEAD `afeaf2955eb5515624d9ab27b8743e59e5a0145c` and independent QR-S QA682 `3354cff87395de8669de666711d97596545c4ba5`: **derived disposable local PostgreSQL169 only**. It does NOT claim managed source/ledger equivalence or genuine cumulative signed GoTrue ES256 two-PG. PR670/QA675 old parent scope reused. Raw original82 direct bootstrap CI41829584607 still fails SQLSTATE42601.

## Explicit safe-forward track split

**Track F / fresh installation:** canonical original 82 SQL bytes retained. A distinctly versioned, independently attested *derived* baseline process must demonstrate replay-safe provenance (not an old-file in-place edit); existing PR670/676 derived `/tmp` tests are diagnostic only. An unchanged original82 bootstrap has not passed.

**Track M / managed already-applied Staging116:** obtain complete `version + name + stored statement SHA` mapping plus actual schema and effective ACL fingerprints under 09P-SQL; reject name-only/partial equivalence. Preserve the applied ledger and all historical bytes. First design an independently reviewed, additive R16 signed prerequisite reconciliation that is compatible with the **actually applied** version/schema/ACL lineage. Do not assume any original Source153–163 SQL is safe to reapply; no automatic migration version insertion. Only after a stage-equivalent **disposable** clone and signed/role/RLS/SECURITY DEFINER chain are verified may the six precise revocations be proposed, with Source164–169 ordering and same-TX authenticated authorization. A missing prerequisite or unknown fingerprint is a block.

**Rollback:** before any proposed managed operation demand operator-approved snapshot/point-in-time recovery and failure/partial-apply rehearsal on an isolated clone. Rollback must *not* resurrect old `service_role` legacy EXECUTE or backfill/falsify the ledger. Keep product Flags OFF and use pre-authorized containment if an operation cannot be safely reversed.

## Negative contract (test-only)

`scripts/comm-stage116-safe-forward-gate.mjs` only evaluates the previous E669 **read-only** recorded metadata: it has no SQL generation, network, secrets, or database connection. Its *expected* output is always `HOLD_R16_SIGNED_PREREQUISITE` (matching E669), or `HOLD_REATTEST_STAGE116` (changed/missing/fabricated snapshot). Even fabricated `ownerApproved`, `deployReady`, `signedRuntimePass` options cannot authorize SQL or a flag. Tests cover missing signature, wrong statement hash, catalogue drift, unexpected grants/version/source migrations/rollback, missing or extra fields, and remote/credential environment rejection. Synthetic Node tests do **not** verify an actual Stage116 clone.

## Mandatory completion before any next SOURCE repair

1. **09P-SQL:** independently supply verified full 116-entry lineage provenance, effective signed R16/Workspace state and rollback snapshot without secrets or account rows; new E669-type hash when changed; no duplicate old read-only QA.
2. **03 COMM:** design a new *specific* R16 prerequisite/legacy six denial candidate against that lineage, with a fixed HEAD and exact SQL operations, separate fresh/managed plans, negative staged-equivalent clone and safe-failure rollback. No SQL candidate may bypass Source164 guard.
3. **04 QR-S:** new changed-only independently signed genuine GoTrue ES256 two-PG with revoked A1, healthy A2, 401/409, 3-role direct SQL42501, old Writer no data diff, parent/indirect SECURITY DEFINER, cross-PG and rollback. Previous QA675/682 cannot substitute.
4. **09 INT + Owner:** sole accepted source-file merge on latest main, cumulative CI/Pages; later concrete operator approval and managed runtime receipts before Stage116/Provider/Community Public/Writer/Cloud release.

**Gate:** `mayGenerateSql=false`, `mergeReady=false`, `deployReady=false`, `CommunityPublic=false`, `Writer=false`. Local Node unit PASS is only `SOURCE_ONLY_SYNTHETIC`; real Stage116 clone, signed combined runtime and Original82 raw clean bootstrap remain `NOT_RUN/RED`.
