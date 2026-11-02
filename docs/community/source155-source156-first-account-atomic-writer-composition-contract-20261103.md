# 03 COMM / 09 INT — Source155 + Source156 First-Account and Atomic R16 Writer Composition Contract

**Date:** 2026-11-03 (JST)  
**State:** PHASE A DESIGN ONLY — DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC NO-GO  
**Authority:** no independently accepted cumulative HEAD. This file neither cherry-picks source code nor authorizes Phase B.
**04 QR activation gate:** independently accepted, exact-head **both** PR #318 and PR #321, explicitly recorded in Issue #121. As of preparation, they remain owner-local CI PASS and 04 QR PENDING.
**Control/09 INT:** reconcile this graph with X05/X09/X12 in Issue #119; production/backend/browser acceptance stays unproven.

## 1. Frozen evidence & non-equivalence

| Input | Immutable target | Demonstrated bound | Explicit limit |
|---|---|---|---|
| PR #316 | HEAD \`3a331d4f1fc35d43857554ed7483034a7c4de109\` | 3 repaired legacy routes; local signed A1 revoked401, A2 positive | **Not** all old RPC Writer atomic |
| PR #318 | HEAD \`ff8ec5b232003b5ce11bac5e840caf475443757d\`, [signed CI 41459161586](https://github.com/DreamwishWand/web/actions/runs/41459161586) | actual forward **Source155** signed unregistered GoTrue A0 → Account + initially private Creator, concurrent/replay/negative | no Media/Preset and no R16 atomic extension |
| PR #321 | HEAD \`81ad6a672196d90c38193fa1b74aafc4d604c78f\`, [signed CI 41461794557](https://github.com/DreamwishWand/web/actions/runs/41461794557) | **FULL154 + temporary SQL overlay**, eligible A2 Media/Preset HTTP200 and CAS-valid R16 writer/Source154 revoker contention | no real Source155 bootstrap; SQL overlay is **not a migration** |
| PR #314 | HEAD \`e1dfb27ab0cdf1e9673880308d19c107c1df6ac1\` | historical A1 revoked still me/myDreamsnaps/Workspace200 and unauthorized actual Workspace INSERT | retain this **CONFIRMED RED** fixture; do not overwrite with new PASS |
| PR #309 | HEAD \`c817a0188a4373ee9aa86a675e4bf4791448a2f3\` | FULL154 clean-bootstrap targeted acceptance / frozen 148 prefix | do not treat old hardcoded 148-count workflow as 156-ready |

For all comparisons, exact full SHA, Git blob SHA, and parent-ancestor/merge base are evidence. The siblings are **not** equivalent Source155 migrations. Both change \`supabase/functions/community-command/index.ts\`; merging full sibling branches or reusing PR321's 154-count test as-is is invalid.

## 2. Sole proposed chronological migration path

1. **Historical prefix remains exactly frozen:** all 154 ordered migration files at PR316 HEAD, including \`20261102000000_community_source153_signed_session_lineage_v2.sql\` Git blob \`680cb043934a1c0a0e75bd59ba22ce6828a8eedc\`. No edits, drops, renames, reordered timestamps or backfills.
2. **Source155:** exact PR318 \`supabase/migrations/20261102010000_community_source155_verified_first_account_bootstrap.sql\`, current Git blob \`115f2c0f7224984acd8830cfc606af8c6a1bf3af\`. Keep its signed enrollment proof and ACL unchanged unless 04 QR identifies a concrete flaw; changing it requires a new isolated re-review.
3. **Source156 proposed:** \`supabase/migrations/20261103010000_community_source156_signed_gallery_r16_atomic_writer.sql\` (name not yet created). Port **only** PR321 \`supabase/candidates/20261102000010_source155_atomic_legacy_writer_draft.sql\` implementation as the additive forward migration. Do not import candidate with its existing version/name and do not leave runtime overlay activation in CI. The current candidate defines (a) private \`community_legacy_signed_writer_guard_v1(uuid,bigint,uuid)\`, (b) public \`community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)\`, (c) original R16 service-role EXECUTE revocation and only-new-wrapper service-role EXECUTE grant.
4. The exact count after Source156 must be **156**, with **148 original protected prefix**, **154 unchanged PR316 prefix**, **one exact Source155**, **one unique Source156**. A separate manifest verifies ordered version timestamps, content hashes and schema_migrations ledger, rather than globally replacing historic “148/154/155” assertions.
5. No successor Source155 migration named by PR321 is permitted; no staging/production SQL until independent, cumulative acceptance and separate release authorization. This proposal does not confer it.

**Forward-only/error recovery:** SQL migrations run transactionally; a failed local application must leave no partially granted EXECUTE or partial tables/functions. Test retry/reset only with disposable local database. If a post-commit rollback is ever needed, prepare an explicit **later forward-only compensating migration** that first revokes new Writer EXECUTE and fails closed; do not delete applied migration ledgers, silently downgrade a live DB, mutate historical Source154/155, or destroy real user data. Record after-upgrade restore/backup tests separately (UNKNOWN until proven).

## 3. Edge reconciliation, exact conflict resolution

Adopt PR318 \`community-command/index.ts\` as the **single source baseline** in post-QA Phase B, then apply only the following PR321-specific deltas (not the sibling file wholesale):

| Control | Required cumulative behavior |
|---|---|
| \`commandToRpc.ensureAccountCreator\` | \`community_ensure_account_creator_signed_v1\` from PR318. Never revert to PR321's \`community_ensure_account_creator\`. |
| Initial A0 path | Keep PR318 authenticated/nonanonymous signed JWT shape check; **skip the existing-account-dependent Edge v2 preflight for only ensureAccountCreator**. The service-role SQL wrapper must verify real GoTrue registration, revocations, Account/Identity state, and perform v2 postcheck within one DB transaction. No body-supplied subject/session. |
| All other commands | Retain Source154 signed v2 session and active Account/Privacy/global cutoff precheck. An Edge precheck alone is **not** the atomic writer guarantee. |
| \`commandToRpc.setGalleryCommentsAtomicR16\` | \`community_set_gallery_comments_enabled_atomic_signed_v1\`, **not** old \`community_set_gallery_comments_enabled_atomic_r16\`. Add \`p_issued_at_epoch=issuedAt\` and \`p_session_id=sessionId\` from server-trusted JWT to the existing correctly pinned CAS payload. |
| Legacy R16 unbound RPC | Source156 must revoke service_role EXECUTE and verify it **after all migrations**. Wrapper gets service_role EXECUTE; private guard denied to \`public,anon,authenticated,service_role\`. A security-definer owner call to the old R16 implementation needs actual SQL ACL/ownership verification. |
| Retry | Reuse same Work version/current revision/idempotency key across bounded retries; reauthorize true signed session on retry, and rely on new SQL-transaction signed guard. Do not “repin” stale Work to retry. Treat new auth/session denial terminal; forbid hidden 401→retry-to-success. |
| Cache | Keep stricter PR318 \`Cache-Control: private, no-store, max-age=0\`, CDN no-store, Surrogate no-store, Vary Authorization+Origin; do not regress to PR321's shorter cache-control literal. Apply PR321 Media/Preset four-private-header change to **authenticated JSON** responses. Anonymous pre-handler responses may be middleware-owned; inspect explicitly. No unsafe CDN caching. |
| Media/Preset | Port only relevant Edge response headers/eligible fixtures; ensure the local-only buckets \`COMMUNITY_MEDIA_BUCKET\` and \`WEP_PRESET_ARTIFACT_BUCKET\` are explicit for disposable environment. Do not create real Storage objects, upload, make signed URLs, enable publication or Native writers. |
| Other legacy writers | **Do not** route via new R16 guard without individually proving valid owner/CAS, lock graph, idempotency and atomic DB mutation. Existing R17/Signed scene and Preset fail-closed paths remain OFF/NO-GO. |

Product Auth/WEB267/Source150 X05/Store logic is not modified by composition. A0 identity+Creator is initially PRIVATE; Account existence is not public visibility, verified age, guardian consent, proof of entitlement, Moderation or creator publication authority.

## 4. Transaction graph / lock-order contract (validate, not infer)

**Bootstrap (Source155):** signed JWT Edge -> service-role RPC -> \`pg_advisory_xact_lock(identity:subject)\` -> real matching \`auth.sessions FOR SHARE\` -> existing \`auth_identities FOR SHARE\` when present -> local/global revocation and Account/Privacy/retirement checks -> inherited Account/Identity/PRIVATE Creator/Outbox atomic creation -> signed v2 postcheck -> COMMIT. Competing A0 retries and different GoTrue sessions must yield a **single** Account/Creator/Outbox.

**R16 (Source156):** Edge verified JWT subject/iat/session_id -> SQL RPC -> \`auth_identities FOR SHARE\` -> \`community_authorize_signed_session_v2\` while lock held -> existing R16 \`wand_accounts FOR SHARE\`, owned \`community_works FOR UPDATE NOWAIT\`, original CAS + dependent graph guards + idempotency lock + Gallery/Search/Audit/Idempotency mutations -> COMMIT.

**Source154 revoker:** same active \`auth_identities FOR UPDATE\` -> terminal local tombstone or global Account/Identity cutoff -> COMMIT. Both lock orders must be tested:
- revoke lock wins: Writer must block/\`55P03\` and post-revocation must reject valid-CAS stale signed JWT with **no** Work/Search/Audit/Idempotency/Revision delta;
- R16 Writer SHARE lock wins: revoker must not complete before the Writer atomically commits or rolls back. Successful pre-revoke writer is not a post-revoke bypass; global/local revocation then denies subsequent signed requests.

**Potential deadlock/provenance review:** PR318 bootstrap takes per-subject advisory lock and \`auth.sessions\` SHARE before Identity SHARE; Source154 revoker and Source156 writer have different call graphs. Inspect all nested \`private.resolve_active_account\` / \`community_authorize_signed_session_v2\` locks; capture actual \`pg_blocking_pids\`, distinct backend PIDs, SQLSTATE and lock timeout behavior. No inference from test-only \`55P03\` without valid owner, real CAS, correct session. Source156 does not prove arbitrary GoTrue provider session-deletion concurrency, other writers, real multi-tab/browser refresh or Managed ingress.

## 5. Cumulative isolated signed acceptance sequence after both independent QR PASS

Only one new fixed composite HEAD gets accepted. Use **fresh disposable FULL156**, actual local GoTrue ES256 signer and \`auth.sessions\` registry; no fabricated signing keys accepted as JWT. Proposed required cases:

| Order | Signed/DB acceptance | Evidence required |
|---|---|---|
| C00 | Verify merge ancestry and actual unchanged 154 prefix, Source155 exact blob, Source156 single successor | git hash/diff, migration manifest, SQL ledger 156 |
| C01 | Previously unlinked registered GoTrue signed A0 creates exactly one WandAccount/AuthIdentity/PRIVATE Creator/Outbox | HTTP200, SQL counts, creator visibility/owner |
| C02 | Concurrent same + distinct GoTrue signed sessions create/replay | 1 Account, 1 Creator, 1 outbox, no duplicate/auditable rollback |
| C03 | A1 LOCAL revoke, A1 old JWT + GoTrue refresh same Session; A2 stays valid | revoked old/rotated401; A2 owner positive200; legacy PR314 \`me\`, \`myDreamsnaps\`, \`createDdvProfileWorkspace\` no unauthorized row INSERT |
| C04 | A2 fully eligible owner Gallery Media journal, private/no URL; A2 existing owned Scene Preset readiness | both HTTP200; proper Work/Creator/Media/Preset ownership; 4 private headers; B/M/anon denied |
| C05 | Normal R16 current Work revision/version, correct Owner and idempotency | signed HTTP200, Gallery settings/Search/Audit/Idempotency changes once, Work revision unchanged, optimistic version consistent |
| C06 | R16 Local revoker-first and Writer-first **two PG connections** | real signed A2/A3 valid CAS, \`pg_blocking_pids\`, \`55P03\`, Writer pre/post DB snapshots, no side effects on denial |
| C07 | Global revoke after eligible authenticated preflight then correct-CAS R16 Writer | revoked JWT denied; new genuinely GoTrue A3 post-cutoff valid; no stale Writer/old Query/Workspace resurrect |
| C08 | JWT/subject JSON spoof, cross-owner B/M, anonymous, invalid/session-unregistered, stale CAS, idempotency changed request | terminal denial, no DB delta; Moderator is not blanket Owner/Writer |
| C09 | Direct authenticated and service-role SQL ACL | public/anon/authenticated cannot invoke signed Bootstrap/Writer or private guard; original unbound R16 service-role denied; no direct PostgREST privilege escalation |
| C10 | Cold **clean install** then **supabase db reset --no-seed** for FULL156 | both actual SQL ledgers 156, ordered/hashes same, previous Source149–154 RLS/privacy/retention protections remain, no hidden 154-count-only pipeline |
| C11 | Replay combined C01–C09 on reset or separate independent disposable instance | same genuine signed functional outcome and DB invariant |
| C12 | Headers and error/rollback negative paths with no actual provider Media URL | Cache-Control/CDN/Surrogate/Vary on authenticated private responses; no leakage or provider mutation |

Do not claim a success from standalone PR318 or PR321 CI in lieu of new composite C00–C12 CI. Conditional final CI must run **both** true signed FULL156 and normal TS/build/Node, plus an updated version-aware clean-bootstrap/Reset workflow. Existing inherited \`comm-clean-bootstrap-acceptance.yml\` has historical hardcoded \`len(fs)==148\`; its failure cannot be relabeled green or skipped. Preserve the 148-version predecessor tests, add honest version-aware successor replay checks rather than blanket count replacements. Negative controls must show the correct *reason* (not HTTP500/403/409 as substitute for a genuine positive).

## 6. Composition procedure, dependencies, authority boundary

**Phase A (NOW, parallel with 04 QR and 09 INT):**
1. Inspect frozen PR318 and PR321 exact heads, Source154/155 hashes and actual Edge conflict; agree this doc and Writer lock ordering with 09 INT.
2. Prepare integration plan and acceptance fixture mapping; no migrated SQL or combined product branch until two explicit QR independent verdicts.
3. Keep both original PRs Draft; no approval gate for ordinary doc design. Keep PR314 confirmed RED as archived negative provenance.

**Phase B (ONLY after both independent QR PASS):**
1. Create a **new isolated cumulative branch off PR318 exact accepted HEAD** (not a merge of PR321 commits).
2. Port PR321’s Source156 SQL from candidate and reconcile Edge + private Media/Preset headers with PR318 baseline; keep bootstrap special case.
3. Reconcile PR318 155-count historical tests and PR321 154-count workflows into new 156-aware checks; add combined genuine signed SQL fixture and clean-install+db-reset.
4. Run exact-head normal and signed FULL156 CI, inspect 154-prefix byte invariance and 04 QR issue records. Repair only newly exposed bugs in that isolated branch.
5. Submit **new composite PR** to 04 QR with exact HEAD/merge-base/changed-path/SQL+Edge hashes, two independent CI runs, HTTP, ledger, lock graph, Work/Search/Audit/Idempotency/Revision DB diffs and remaining known unknowns. Request **new-only** independent cumulative verdict.

**NO-GO remains:** all other legacy Service-role Writer RPCs, R17 photo/preset publication, Native Save Writer, Store/entitlements, real-media provider tokens/URL issuance, Staging/Stage116, Managed I01–I14, real browsers, cross-platform game-version validation, age/guardian/publication/operational/privacy moderation acceptance and production launch. Unaccepted or unexpected paths **fail closed**; never widen the signed session verifier or silently activate a writer.

## 7. QA / 09 INT handoff checkpoints

- Independent QA results for [PR318 intake](https://github.com/DreamwishWand/web/issues/121#issuecomment-6579301720) and [PR321 intake](https://github.com/DreamwishWand/web/issues/121#issuecomment-6579669516): **PENDING at this document's creation**.
- 09 INT: update X05/X09/X12 diagram only as *proposed* Source155→Source156 lineage; mark verified source vs eligible Local CI vs not executed composite. Do not promote product flags or Managed tests.
- Current cumulative backend status: **UNKNOWN / NOT YET CONSTRUCTED**. Last three revoked-legacy routes PR316 remain *limited accepted*. PR314 real RED historical evidence is retained; PR318/321 Owner-local results are not community-wide authorizations.

**Next trigger:** a posted, explicit independent 04 QR PASS for **each** exact PR318 and PR321 HEAD. A PARTIAL/RED or changed HEAD blocks Phase B and requires a new independent verdict or bounded correction before composition.
