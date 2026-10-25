
# 04 QR R17 — Source/Staging Parity and Signed Gallery Operator Gate

Status: READ-ONLY_PARITY_AUDIT_COMPLETE / CONFIGURATION_BLOCKED / NO_DEPLOYMENT.

## Source and Staging baselines

- Initial QA frozen parent: d657b86269135c77bae9ed6ed89ec91a57e74f0c, 130 source SQL migrations, provisional R17 fix candidate. Later Owner commits must be independently inspected; this branch does not automatically track them.
- Previous accepted R16 03 COMM HEAD: dcd63494f212ff2a947cbfe6d19674aa0470b927, 127 source migrations, CI 40239079445 SUCCESS, bootstrap 40239079471 SUCCESS. PRs #140-#146 stay intact.
- Staging project ptpdoxhrqopvczpclcij: 116 historical managed migrations, highest version 20261024043436 (read-only SQL). This is not a prefix of the source 130 files. Provider-only historic Scene/Identity migration provenance and different numerical migration versions require semantic reconciliation, not naive count-based application.
- Staging Edge observed: community-command v30 JWT ON; community-media v16 JWT ON; community-public-media v6 JWT OFF; community-query v14 JWT ON; community-retention v12 JWT OFF with separate worker-secret contract; community-account v3 JWT ON; community-admin v16 JWT ON. Version number alone is not source-byte parity.
- Verified Gallery subject scope Nintendo Switch DDV v1.25.0 BID 52BD625D9B4E0053 schema624. Nintendo Switch v1.25.3 schema626 is read-only; Steam independent; no DDV native writer/Apply.

## Read-only difference matrix

| Surface | R17 Source candidate | Live Staging catalog | Acceptance required |
| --- | --- | --- | --- |
| Phase1 account privacy | community_request_privacy_suppression_v1 | function missing | Owner session and identity, durable suppression/read-index denial, policy and old bearer limitation |
| R15 Gallery graph | community_gallery_graph_preflight_r15 and community_publish_gallery_pinned_r15 | both missing | registry-scoped immutable digest, historical/current transaction CAS, terminal stale |
| R16 comments CAS | community_set_gallery_comments_enabled_atomic_r16 | function missing | only safe Gallery metadata no Scene/Photo, WorkVersion/currentRevision pin, atomic idempotency |
| Old Gallery comments | R17 02920 v1 deny and 02930 Gallery-v2 deny, DreamSnaps v2 retained | old v1 and v2 still callable | direct/historical/both denial, no settings/search/audit/idempotency partial |
| Gallery Photo | R17 02940 direct/history guard, Account root first | older Photo v1 present | direct/history/both, account/artifact contention, media/creator/subject and rollback |
| Gallery v4 | R15 legacy Scene guard | earlier v4 present | old Scene route must fail closed without pinned preflight |
| Moderation | Emergency Restrict/Remove independent | moderator v5 exists | actual M signed authorization, liveness under owner/Account privacy races |
| Media | SQL READY/CLEAR and Storage.info metadata | media v16 / public media v6 | real signed PUT, downloaded-object byte SHA256, cover/history/private access |
| CDN/bearer | Edge no-store is insufficient to revoke old signed URLs | expiry/cache unproven | separately approved t0/60/300/post-expiry warm/cold HTTP/Browser run |
| Cloud/physical | graphComplete=false, retirementAuthorized=false | no accepted parity | keep Positive Retirement/Delete/Unpublish/Cloud/Physical 72h OFF |

Live Staging pg_get_functiondef SHA256 readings (function-definition text; NOT SQL migration bytes):
- Gallery comments v1 2e405550250eaaad005353f7656b8ac6dc690fc1274d6451e780af2515bcc121
- Gallery comments v2 29b57b4016e67581cbed37fa513f513a6a5f715bcd50aab44e20f9213ed8759d
- Photo v1 9fbc7c861ac0467e86507aa944b7efcf240ed6e0804abaef132adf1c2bba8134
- Gallery v4 d6b2cd7a3b5c5b721de24aafb3e95dddbd319bb0b7cd55335dd1ef06ab9e44c5

## Operator-only migration and recovery sequence

1. Freeze reviewed current 03 COMM/09 INT backend commit, migration/Edge/trigger/function signatures, CI+empty-bootstrap+reset/replay and exact QA pinned HEAD. Do not deploy from a moving draft. Confirm history-specific Gallery Photo and Comments fail-closed without damaging DreamSnaps under13/normal.
2. Authorized operator records pre-change schema/catalog/ACL/RLS/index/trigger/function hashes, historical managed 116 migration SQL statement lineage, deployment versions and scoped backup/PITR readiness. Review earlier provider identity and Scene historical migrations absent from canonical source. Do not publish credentials, user rows, Work/media keys or signed URLs.
3. Rehearse deterministic additive migration ordering against both a clean source schema and a separately authorized staging-equivalent isolated schema. Do NOT run the canonical 130 migrations blindly over the managed 116, rewrite migration history, remove historical functions without compatibility analysis, or restore obsolete unsafe Scene/media writers.
4. Securely roll out only through an independent Owner/Ops-approved change request: backend DDL dependencies first, old v1/v2 Comments and Photo fail-closed safeguards, approved R12/R15/R16 source RPCs, explicit SECURITY DEFINER service-only grants and RLS, trigger/function ordering; then matching deployed Edge command with attested source commit. During version mismatch fail-closed or disable affected positive actions. Keep moderator Emergency Restrict independent.
5. Read back actual installed function definition digests, overload/signatures, RLS/ACL, trigger list, managed ledger, Edge version+code bundle fingerprint. Repeat read-only parity audit and then isolate real disposable A/B/M. No signed launch test when parity fails.
6. Recovery is forward-corrective or operator-approved PITR/backup restore, not speculative reverse migration. On partial failure stop positive Edge writes, preserve deny guards, retain immutable media and idempotency evidence, inspect transaction outcomes, reconcile documented Work state, never force Cron33, no shared Storage.remove or remote db reset.

## Signed Gallery PR #132 compatibility and operator configuration

- The original Signed Gallery Draft PR #132 is unchanged, pinned to integrated Backend PR #129 HEAD 02750fcbcfd3f94fc12b39c8adf5757fa24a5646. It cannot be silently promoted as R17 signed proof or automatically repinned to newer R17 migrations. An exact review of the evolved Source and deployed Edge/SQL, plus a separate controlled integration QA branch, is needed.
- Repository Actions Variables: DREAMWISH_SUPABASE_URL, DREAMWISH_SUPABASE_PUBLISHABLE_KEY (publishable key only; not service role).
- Protected human-reviewed Actions Environment: staging-gallery-signed-acceptance, approved integration branch and named reviewer restriction.
- Environment Variables: DREAMWISH_GALLERY_E2E_APPROVAL, DREAMWISH_GALLERY_BACKEND_SHA, DREAMWISH_GALLERY_SUBJECT_ID, DREAMWISH_GALLERY_DB_MIGRATION, DREAMWISH_GALLERY_EDGE_VERSIONS, DREAMWISH_GALLERY_A_ACCOUNT_ID, DREAMWISH_GALLERY_B_ACCOUNT_ID, DREAMWISH_GALLERY_M_ACCOUNT_ID, DREAMWISH_GALLERY_M_MODERATOR_APPROVED.
- Environment Secrets: normal disposable A/B/M credentials separately as DREAMWISH_GALLERY_A_EMAIL/PASSWORD, B_EMAIL/PASSWORD, M_EMAIL/PASSWORD. Real passwords/JWTs/bearer URLs never in issue or logs. Human operator approves account identity, Creator owner, B nonowner, M authorized moderator, subject provenance, testing/disposition of disposable media.
- Real signed cases only after parity+human approval: normal A/B/M login and auth freshness; signed Prepare -> actual Storage PUT -> Finalize READY/CLEAR -> bytes SHA256; wrong-owner/moderator/anon 403 and stale/graph 409; Account Suppression new Media URL denial; Moderator Emergency Restrict; cross-session pinned graph/Edge SQLSTATE retry.
- Already-issued Storage bearer replay must use a separate prior-created authorized disposable URL, sampled t0/60/300/post-expiry including warm and cold CDN/Chrome, never counterfeit or reopen closed old issuer merely to pass. Existing signed harness does not automatically create the old preissued URL. Do not use service_role as stand-in Actor.

## Acceptance classification and release boundary

Current Source tests and isolated PostgreSQL are NOT true signed JWT/HTTP/PostgREST/Staging/Storage E2E. No operator approval is demonstrated. Keep Signed Gallery CONFIGURATION_BLOCKED/NOT_EXECUTED.
R17 = 30 nodes PASS0/PARTIAL12/BLOCKED18; 7 seed gates blocked; Guide HumanQA0/315, Rights0/45, PublicEligible0/45; Privacy/Legal/Ops and Issues #138/#139 separate blockers; no R18. GraphComplete=false, retirementAuthorized=false, Gallery Positive Delete/Unpublish/Private/Restore, Scene SaveRevision, native DDV writer/Apply, physical cleanup/72h OFF. All Drafts DO_NOT_MERGE / DO_NOT_DEPLOY.
