# 04 QR / CTRL49 — Stage116 → Source153 independent migration pre-operator rehearsal

**Status:** `PARTIAL / LEDGER_CLASSIFIED / SOURCE143_146_SYNTHETIC_PARTIAL_REHEARSAL / NEED_OPERATOR_PROTECTED_STAGE116_CLONE`. This is a *read-only evidence collection* from the real Staging116 plus a **separate disposable synthetic PostgreSQL** test. It **does not** prove real full Stage116→153 replay, a Stage schema clone, data preservation, or authorization to apply 37 migrations. No Stage SQL writer, Edge/Cron deployment, Storage action, account creation or real user-data SELECT was performed.

## Exact provenance and live ledger classification

Live managed Supabase Staging project alias `dreamwish-wand-staging`, PostgreSQL 17.6, current **116 applied migrations** last `20261024043436 gallery_known_reference_writer_fence_v1`; target immutable Source153 Owner PR265 HEAD `b24eec2cb4dae4ab30824636670c520d7c6eea40`, **153 SQL files**. Immutable read-only snapshot of all **116 Stage version/name rows** and **153 Source name/version/Git blob/path objects**: [machine-readable evidence](./evidence/qr-ctrl49-stage116-source153-ledger-20261029.json). No secrets, auth rows or media IDs are stored.

| Classification | Count | Evidence boundary |
|---|---:|---|
| Same migration version + name | **23** | Managed ledger identity only, **NOT SQL byte equivalence** |
| Same name but Stage uses a different version | **88 Stage rows** | **84 unique Source names**; four Stage names duplicated at two distinct Stage versions |
| Stage-only migration names | **5** | Not in current immutable Source153 tree; do **not** drop or fabricate |
| Source-only migration names | **46** | **35 earlier dependencies + all 11 Source143–153**, not `153-116` simple append |
| Same version, different migration name | **0** | Does not remove object/DDL collisions or version/name remapping |
| Stage same-name duplicates | **4 names, each twice** | Need actual applied SQL body and schema semantic reconciliation |

**Five Stage-only migrations:** `20260930032030 community_core_v0_staging_media_bucket`, `20260930033214 community_staging_pg_net`, `20260930034107 community_staging_remove_pg_net`, `20261007135856 scene_preset_product_vertical_v1`, `20261007201915 scene_preset_unattached_media_discard_v1`. Their original executed SQL is not present in the frozen Source153 migrations directory. Absence in Source is **not** evidence to undo those effects. The Stage-only Scene and Media/pg_net semantics are material to WEP PR189, direct SQL issuers and PostgreSQL extensions.

**Four duplicated Stage names:** `community_core_v0_account_tombstone_generated_handle_fix` (20260930070309/70335), `community_core_v0_provider_cleanup_queue` (20260930070539/70602), `community_ddv_profile_workspace_lifecycle_v2` (20261001233225/234029), `community_ddv_profile_workspace_fk_index_v3` (20261001233707/234035). The two latter timestamp shorthands are **20261001234029** and **20261001234035** respectively. Names alone cannot determine which migration body, semantic version or reapplication is safe. No Version-ID collision was found in the ledger.

**Source-only 35 before Source143** require object/dependency/DDL parity assessment: five early operational/Auth/Provider functions (four `community_core_v0_*` and `provider_identity_cleanup_parent_bootstrap_v1`), the known-writer Scene parent/bootstrap SQL, and account Privacy/active identity/Gallery R14→R19 Writer+Incident+Reader+Media/Signer sequence through `r19_legacy_media_signer_authority`. Then **11 sequential Source143–153** in the exact fixed Git blob list below. The 35 earlier functions are **not necessarily safe optional deltas**: Source144/146 rely on R19 issuer/security primitives, Source149–153 rely on newer Account/Privacy/Work/Media/Writer contracts. Direct or guessed `117..153` application is forbidden.

**Source143–153 precise immutable SQL blobs / main side effects:**

| Source | SQL version | Git blob | Main DDL/DML, risk and bounded acceptance |
|---|---|---|---|
|143|20261027000000|5364449011a06d1b53dff92c4d16bc47305766aa|New private Account-global consent (RLS ON, revoked); **UPDATE all legacy per-entry public_fields to empty and published_at to NULL**, add CHECK preventing resurrection; replace legacy service-role setter with explicit failure, old private public-result helper hard returns NULL. Requires prior-value backup and review of existing opt-in semantics. |
|144|20261027000010|64fe31ac0424b0032553c51a9aca7f10d79f6d36|New private Work-liveness predicate; replace public WAND Results and public Media SQL issuer, retain Source141/142 R19 Incident suppression; check old authenticated/service-role caller signatures and no new URL. |
|145|20261027000020|b1fc4990a057f810aeb4b1a12a602a68c9b0330f|Replace legacy public DreamSnaps Gallery search/detail readers to use Source144 predicate; no Public Publisher. Verify privacy, retired identity and stale cached search/document visibility under actual RLS. |
|146|20261027000030|278bb69e990fc62956d28ee9563c9ecbc53b9f03|New SECURITY DEFINER `private.generic_public_search_work_accessible_r21`, SELECT EXECUTE anon/authenticated; **DROP POLICY IF EXISTS + CREATE POLICY** `search_documents_public_read` on existing RLS-enabled public SearchDocument. Postgres permissive policies OR together: any extra Stage policy or broken private schema USAGE is a stop. Other Work types must retain `private.is_discoverable_work`; Dreamsnap uses Source144 r20. |
|147|20261028000000|5c2b1b85b07821d7e60a84de40d933d59c4cc19d|Create private PostEvent STAGED table, FK/checks/index and SECURITY DEFINER invariant trigger; no synthetic competition Entry or public Media release, unknown DDV challenge/rights remain UNKNOWN. |
|148|20261028000010|f6438fe596ed2eaca88bdb034173431f6bd511aa|Replace Source147 private STAGED trigger predicate with stronger Account/Identity liveness; no provider Incident claim. |
|149|20261028000020|0d0c4e85a1fc1d0e2e3ba06aade8d55f305e1fd0|Create private Work Control/Consent events/Purge tracking tables; revoke private RPC and tables, CAS and Work lock/outbox/withdraw to PRIVATE, public activation fixed FALSE. |
|150|20261028000030|85e9de1874ca489133fd39be522f57ee1cfac6ab|Create private Policy registry initially EMPTY and authenticated Source150 Owner read/action with pinned JWT subject/CAS; **ALTER existing `public.validate_current_published_revision()` from SECURITY INVOKER to SECURITY DEFINER** to preserve authenticated deferred trigger validation; body unchanged. Audit function owner, search_path and ACL. |
|151|20261028000040|451735e05b6a18c826851a51000909c40c42bb9f|Create immutable Policy Receipt table+activation guard triggers, pregrant on correct Work/READY Photo/Media; no real Owner-approved Policy v1 seeded. |
|152|20261028000050|cd297f48111afbb315651c6cb7e911afb1bcc03d|Authenticated first Work/Media bootstrap and real PostEvent no Entry; advisory lock/idempotency transaction, rollback, no actual Storage upload. |
|153|20261028000060|356cc10138cd351674fde8dd943acc968e26fbbc|Authenticated-only Authority projection `owner-authority-projection@1`/Consumer target v2, Work-specific Media, Control/CAS and last Grant consent, no public/Provider/Cloud/CDN authority. |

The Git blobs are Source153 HEAD identities only, **not** Staging applied migration content digests.

### Stage current read-only object preflight (catalog only; no user rows)

- Real Staging `public.dreamsnap_official_result_publication` exists, has `public_fields text[]`, `published_at timestamptz`, `updated_at timestamptz`, RLS ON; we **did not read any values or counts**. Source143 UPDATE may affect actual rows. Existing `public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])` SECURITY DEFINER currently grants **service_role EXECUTE**; Source143 explicitly revokes and replaces its behavior with fail-closed error.
- Real Staging `public.search_documents` exists, RLS ON and **one** permissive `search_documents_public_read` SELECT policy for anon/authenticated with current `private.is_discoverable_work(work_id)`. Source146 correctly targets this name for replacement; catalog observation is **not** independently signed at A5 and must be repeated on the protected clone / immediately before controlled migration, including other policies/roles and grants.
- Stage `public.community_works` has deferred `community_works_current_revision_guard` linked to `public.validate_current_published_revision()` currently **SECURITY INVOKER**, exactly the known Source150 prerequisite. Multiple additional gallery/public/retention guard triggers exist on this table; no positive writer may be inferred compatible until protected clone negative testing.
- Staging `private.is_discoverable_work(uuid)` is currently SECURITY DEFINER and executable by anon/authenticated; `private.dreamsnap_public_official_result(uuid)` exists but source143 will replace behavior. Reader functions Source144/145 names already exist in older form. New Source146 r21 and Source153 authority do **not** exist.
- 00 CTRL catalog found expected six Source147–151 private tables + eight selected Source143–153 functions **all absent (14/14)**, consistent with Stage116 not having Source153. Absence is not an ACL proof or a complete issuer census.
- Real Stage still 21 ACTIVE Edge / 7 ACTIVE Cron, WEP Generic14/Scene1/Retention6 live, PR189 THREE-route stop bundles **not deployed**. No verified global barrier, 300-second historic bearer revocation, Provider data or actual old Media object readback.

## Executable isolated test scope and explicit limitations

New isolated targeted script `tests/qr-ctrl49-stage116-143-146-partial-synthetic-pg.py` constructs **only minimal Stage116-like search + official-result structures** on disposable local PostgreSQL; it applies the *actual immutable* Source143 and Source146 SQL text, not modified copies, and checks:
1. Existing positive per-entry official-result public_fields/published_at are OFF after Source143; old setter fails, even fake Account-global ON never makes public official result visible.
2. Actual old SearchDocument single permissive policy -> replacement by Source146. NonDreamSnaps preserve discoverability, DreamSnaps use R20; anon/authenticated both fail closed. Unrecognized extra permissive OR policy triggers preflight STOP.
3. Both SQL files inside a failing transaction roll back to prior policy/flags; successful single transaction and a second same-SQL invocation preserve public OFF and policy count (limited idempotent replay).

**ONLY** `SYNTHETIC_PARTIAL_STAGE116_OBJECT_RECONSTRUCTION`. No historical Stage-only DDL or 35 earlier missing Source scripts, no real Stage schema, live Work/Media/Privacy/Consent/old signer/Storage/Provider bytes, or protected restorable backup. **Not `STAGE116_REAL_CLONE_PASS` and never conclude full 116→153 migration from this targeted test.** New-only ledger integrity/source static preflight separately checks all 116+153 version/name and frozen Source143–153 blobs (does not run old accepted QR266/264/269/270).

The full actual 116→153 replay cannot legitimately be performed with the current connector alone: management `list_migrations` lacks SQL hashes and full historical migration bodies; no verified Stage-only DDL artifacts, protected Stage116 schema/data restore, original Storage object bytes, PITR/replica/access boundaries or fenced privileged issuer graph has been supplied. No automatic normalized renumbering, fake insert into migration ledger, down migration or direct new SQL should be proposed as a substitute.

## Operator execution sequence, gated independently (NOT authorization)

A0: human names the exact Stage project, approver+separate QA reviewer, migration window, planned SQL artifact hash, scope and abort ticket. **NEED_OPERATOR**.

A1: human/operator independently obtains exact per-replica/alias deployment/source hashes for 21 active Edge, every Cron (7) and non-Edge direct SQL/worker/service_role/issued URL signer (including legacy public query/media); actual Data API exposure and caller matrix, 300s legacy signed bearer inventory. Abort on any unknown ingress/issuer. **NEED_OPERATOR**.

A2: operator creates protected **real Stage116** restorable DB snapshot/PITR (including all migration ledger, RLS/policies/ACL/definer owners/triggers and row revisions), and separately verifies recoverable **ORIGINAL** Storage bytes/object version/retention/legal holds; restore test and 2-person readback. DB dump alone is not enough. **NEED_OPERATOR**.

A3: while barrier maintained, stop and drain Generic14/Scene1/Retention6 plus Community Media/Command/Public/retention, Cron7, queues, in-flight jobs and direct SQL. Pause physical Copy/Remove and old token issuance; avoid returning forbidden response to already-issued bearer without verification. **NEED_OPERATOR**.

A4: under barrier, deploy/verify exactly PR189 inert Generic/Scene/Retention THREE-route bundle hashes and all other identified terminal issuers. Check per-replica actual deployed hashes/negative signed calls. **Do not revoke historic Scene SQL first.** Without all issuer negatives, STOP. **NEED_OPERATOR**.

A5: on **protected actual Stage116-shaped clone** only, reconcile all 23 version/name and all 88 name/remap cases with underlying SQL-body/object checksums, five Stage-only effects and 46 Source-only dependencies; prepare explicitly reviewed forward-only bridge/resolved migration catalog, never blind `117..153`. Replay with appropriate transaction scope and independent 2PG A/B/M/anon privacy & Media+Consent+Search+old reader/legacy setter/read-only parity, Source141 Incident, Trigger/ACL RLS, idempotent replay, failure injection and backup restore. Source143 legacy opt-in reset intentional **but irreversible without protected prior values**, log prior state to protected backup only, not in QA logs. Source146 exact one-policy replacement and no extra OR. Require independently signed acceptance; current evidence **PARTIAL/NOT_EXECUTED**.

A6: separately authorized real signed JWT Actor A/B/Moderator and anon HTTP + URL/Cache/Provider negative test, old bearer expiry, remote object and Cloud/CDN issuer claims. Provider B remains HOLD. **NEED_OPERATOR**.

A7: explicitly allowlisted **read-only** routes and monitoring only after A0–A6, keep Publisher, new Signer, Owner edits, Cloud and native Writer/Apply OFF; no automatic launch. **NEED_OPERATOR**.

**Abort and recovery:** any unknown privileged caller, source/Stage SQL SHA mismatch, altered Storage bytes, unresolved legal hold, wrong RLS OR policy, pre-existing object signature collision, unexpected media/consent data change, old key still valid, writer/queue not drained or missed replication prevents A5. Freeze ingress and keep PR189 inert routes, DO NOT automatically redeploy old v14/v1/v6 Edge nor run destructive reverse SQL. If live migration ever fails, preserve audit/backup, assess PITR+Storage rollforward/restore together with two-person review, independent old/new bearer and preserved data readback, then decide reviewed forward-fix or full restore. Human authorization explicitly required before affecting Stage.

**Project gate:** `A0..A7 HUMAN NO-GO`, `Provider B HOLD`, `Cleanup C NOT_AUTHORIZED`, signed Auth and Public/Native Writer OFF, R17 30 product nodes PASS0/PARTIAL12/BLOCKED18 plus 7 human gates, `PUBLIC RELEASE NO-GO`. All PRs DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. No TRUE RED of frozen Source code is established by ledger metadata alone.
