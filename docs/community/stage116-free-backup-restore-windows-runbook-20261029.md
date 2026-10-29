# DDVRE / 09 INT CTRL54–55 — Free Stage116 DB, managed Auth and Storage practical recovery on Windows

STATUS: OPERATOR PREPARED ONLY. NO LIVE EXPORT/RESTORE AUTHORIZED. This runbook extends, but does not replace, docs/community/production-operations-backup-recovery-20261001.md and the accepted PR272 preflight. Stage is ptpdoxhrqopvczpclcij, Free, PG17.6, 116 applied migrations, 21 Edge, 7 Cron, 0 branches; 80,178,323 bytes is physical DB size only, never archive or Storage estimate. Original buckets: community-media-staging (images) and wand-preset-artifacts-staging (JSON), both private.

## A0: operator scope BEFORE any real export
Require written ticket with source and separate quarantine target, operator + distinct reviewer, allowed bulk personal/auth/media data classes, approved BitLocker/VeraCrypt private volume, encrypted independent offsite target, key custodian/ACL, destination/retention/deletion-ledger/holds, expected capacity and cost, snapshot consistency and abort/disposal plan. Neither read-only metadata authorization nor this code approves actual user-data export. No passwords, access tokens, decrypted Vault content, SQL bodies, object bytes, object paths or user records may enter GitHub/GDrive/chat/CI.
Windows workstation needs PowerShell 7, Docker Desktop, a PINNED Supabase CLI v2.120.0 for the existing five CLI commands, PostgreSQL CLIENT pg_dump/pg_restore/psql 17.6 matching Stage PG17.6, rclone, and Get-FileHash. Before source connection, compare the actual approved installed binaries with supabase --version, pg_dump --version, pg_restore --version, psql --version, all --help and private executable SHA256 records. If version/flag behavior differs, STOP/NEED_OPERATOR, do not silently upgrade or use PG16/18. Managed auth/storage rows require NATIVE PG17 pg_dump, not the Supabase CLI default managed-schema-excluding wrapper. Pin and check local versions and --help first. Never paste database passwords/credential URLs into shell arguments, repo files, logs or PowerShell transcripts. Run outside the repository and outside Desktop/Downloads/cloud sync on already-encrypted access-limited storage.

## Offline dry-run: NO network, NO operator actions
Run in Windows PowerShell (test target alias is synthetic; encrypted/approved flags are claims only, never A0 proof):
    node scripts/stage116-recovery-plan.mjs --self-test
    node scripts/stage116-recovery-plan.mjs --source-ref ptpdoxhrqopvczpclcij --target-ref offline:pg17-quarantine-01 --archive-root 'X:\WandRecovery\Stage116' --ticket-id CTRL54-TICKET --operator-id operatorA --reviewer-id reviewerB --encrypted yes --approved yes
Script has no execution mode. Same Stage as target, unapproved encryption/target, missing second reviewer or unexpected credential parameter => NEED_OPERATOR.

## P1: AFTER A0, official Supabase CLI logical DB export
Use vendor CLI linked-project credential store from trusted private work directory (supabase link --project-ref ptpdoxhrqopvczpclcij after separate approval), verify supabase db dump --help and protect local configuration. Do not put a secret-bearing --db-url in process args. Operator PowerShell commands after approval only:
    $a = 'X:\WandRecovery\Stage116\db'
    supabase db dump --linked --role-only --file "$a\roles.sql"
    supabase db dump --linked --file "$a\schema.sql"
    supabase db dump --linked --data-only --use-copy --exclude storage.buckets_vectors --exclude storage.vector_indexes --file "$a\data.sql"
    supabase db dump --linked --schema supabase_migrations --file "$a\history_schema.sql"
    supabase db dump --linked --schema supabase_migrations --data-only --use-copy --file "$a\history_data.sql"
Official docs: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore and https://supabase.com/docs/reference/cli/supabase-db-dump . These five exports are NOT a single atomic snapshot.


### P1M — Mandatory separate managed Auth/Storage DATA + definitions archive (CTRL55 fix; OPERATOR ONLY)

The preceding five Supabase CLI exports are INCOMPLETE for managed Auth/Storage: default CLI dumps omit managed schemas, and db diff only captures selected custom definitions, never rows. 00 CTRL confirmed Stage catalogue contains 27 ordinary Auth tables, 8 ordinary Storage tables, 7 non-internal Storage triggers, without reading rows. Treat these numbers as comparison anchors, NOT automatically complete backup evidence.

Use authorized, Windows-local PostgreSQL 17.6 native pg_dump --format=custom, separately from the Supabase CLI. Native pg_dump with --schema=auth --schema=storage captures schema-scoped DATA entries, including highly sensitive session, refresh token, identity and Storage metadata rows; it does NOT by itself prove it can restore into a different Supabase platform, nor does it include dependencies outside those schemas. The companion SCHEMA-ONLY dump is an audit of managed built-ins plus custom definitions, NOT an instruction to overwrite target-owned managed schemas.

Credentials: on the separately approved encrypted drive, keep a restricted operator-only pg_service.conf with source host, port, dbname=postgres, DB role and reviewed TLS (no password), and a separate private libpq PGPASSFILE; use libpq PGSERVICE to select a reviewed read/export role. Never put a password or secret URL in argv, PowerShell transcript, Git, chat or public logs. If the source role cannot read required managed tables, STOP; do NOT relax Stage ACL/RLS. Example after explicit A0 authorization ONLY:

    $a = 'X:\WandRecovery\Stage116\db'
    $env:PGSERVICEFILE = 'X:\WandRecovery\Private\pg_service.conf'
    $env:PGPASSFILE = 'X:\WandRecovery\Private\pgpass.conf'
    $env:PGSERVICE = 'wand_stage116_source_ro'
    supabase --version
    pg_dump --version
    pg_restore --version
    psql --version
    pg_dump -w --dbname=postgres --format=custom --data-only --schema=auth --schema=storage --file "$a\managed-auth-storage-DATA.dump"
    if ($LASTEXITCODE -ne 0) { throw 'STOP: managed data archive failed' }
    pg_dump -w --dbname=postgres --format=custom --schema-only --schema=auth --schema=storage --file "$a\managed-auth-storage-DEFINITIONS.dump"
    if ($LASTEXITCODE -ne 0) { throw 'STOP: managed definitions archive failed' }
    pg_restore --list "$a\managed-auth-storage-DATA.dump" > "$a\managed-data-TOC.private.txt"
    if ($LASTEXITCODE -ne 0) { throw 'STOP: managed data TOC failed' }
    pg_restore --list "$a\managed-auth-storage-DEFINITIONS.dump" > "$a\managed-definitions-TOC.private.txt"
    if ($LASTEXITCODE -ne 0) { throw 'STOP: managed definitions TOC failed' }

REVIEW/ARCHIVE MATRIX — EVERY actual managed table must be inventoried and assigned one disposition with reason, source row count, encrypted archive TOC coverage, target restore/revalidation decision and independent reviewer:
- auth.users, auth.identities: BACKUP all row/PK/FK references; RESTORE only under compatible target-owned Auth schema and reviewed identity mapping; REVALIDATE Wand Account/Linked DDV Profile/Creator reference, provider identity authority, account deletion.
- auth.sessions, auth.refresh_tokens, auth.one_time_tokens, auth.flow_state, OAuth/SSO/MFA token/factor and other authentication state: BACKUP into HIGH-SENSITIVITY private forensic archive. Default RESTORE=DISABLED/ARCHIVE_ONLY; if historical rows are temporarily loaded for confidential comparison they MUST remain non-user-visible and be revoked/invalidated before re-opening; REVALIDATE expired/session claims, JWT issuer, MFA/SSO compatibility and external deletion ledger. Never accidentally reactivate refresh/one-time credentials.
- Other Auth tables (including audit, schema_migrations, SAML, provider settings): record EVERY actual table in the 27, archive where approved; platform migration/version/config rows are NOT blindly replayed into a new platform. Record exclusions and verified target reinitialization with independent review.
- storage.buckets, storage.objects: BACKUP managed DB METADATA rows separately from the actual original private object BYTES. For each bucket and object map bucket ID, object ID/key, owner, size/MIME, version if the schema exposes it, privacy/holds, immutable revision reference and original object SHA256 manifest. RESTORE bucket metadata and objects by reviewed target-owned storage compatibility method only; REVALIDATE against BOTH private source buckets, object byte count/SHA/version/hold, DB media/Preset refs.
- Remaining Storage tables (including multipart/transient migrations/vector data): inventory every table in the 8, archive if necessary, do NOT auto-replay in-flight multipart tokens or platform migration rows; record explicit excluded/target-reinitialized disposition.

Before considering a capture complete, use private source catalogue inventory and full per-table counts and schema definitions. Source metadata query (approved-only, contains no user row values):

    SELECT n.nspname, c.relname, c.relkind, c.relispartition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('auth','storage') AND c.relkind IN ('r','p')
     ORDER BY 1,2;

For counts of EVERY ordinary nonpartitioned managed table, use an operator-approved PRIVATE psql script, generating properly identifier-quoted SELECT count(*) statements from pg_class and executing via psql \gexec. Record source/target output in encrypted private files, no row data in console. Example query in a protected psql input file (not Git/CI), executed on source and independently on quarantine:

    SELECT format('SELECT %L AS table_name, count(*)::bigint AS row_count FROM %I.%I;',
                  n.nspname||'.'||c.relname, n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('auth','storage') AND c.relkind='r' AND NOT c.relispartition
     ORDER BY 1
    \gexec

Inventory partition parents/children separately, with explicit no-double-count rule and approved per-parent coverage. Compare table list to archived pg_restore --list DATA TABLE DATA entries and relevant SEQUENCE SET items; if fewer than the 27 Auth/8 Storage observed originals are represented without approved rationale, missing/unknown table or insufficient SELECT rights => NEED_OPERATOR, NOT a complete source backup.

Preserve AUTH/STORAGE EXTRA DEFINITIONS apart from platform baseline: use pg_catalog snapshots of pg_policy, pg_trigger (7 Storage non-internal triggers), pg_proc definitions/SECURITY DEFINER/search_path, pg_get_constraintdef (PK/FK/unique), pg_class.relowner, grants/default ACL, schema ownership, extensions and publications, with protected source digests. Compare to target baseline; db diff may omit functions inside managed schemas and extension-owned objects. A managed SCHEMA-ONLY archive is for audit, NOT unconditional replay. Changes to built-in Supabase managed objects must use an explicitly reviewed version-compatible target-only migration, never broad DROP/CREATE.

Data snapshots are non-atomic ACROSS the five CLI exports, this managed custom pg_dump, Storage bytes and deletion ledger. Each native pg_dump is internally consistent, but the overall archive is not automatically one logical instant; source writer/retention/pg_net in-flight drift requires separately authorized quiescence or high-water reconciliation, otherwise cross-artifact consistency UNKNOWN. Record timestamps, number of archive TOC DATA items, per-table source counts, encrypted artifact length/SHA256, exclusions, object references, and offsite private readback. Preserve no raw Auth secrets in a public receipt. Archive retention and access controls must explicitly account for sensitive session/token data, external deletion ledger and holds.
 Capture timestamps and source writer/queue high-water conditions and stop if consistency cannot be proven; do not stop Cron or Source in CTRL54.
CRITICAL: normal CLI schema dump excludes managed auth/storage/extension schemas, and standard schema.sql does NOT include migration history. Retain original applied 116 journal rows/version/name/SQL statements and 5 Stage-only effects, plus 2 separate Provider cleanup migrations, duplicate tombstone migration history, WEP bucket provisioning, and 04 QR CTRL51 30-row historical diff (19 newline-only, 1 partially superseded, 10 need protected clone). Verify actual original SQL body provenance, not just row count. Never replace the 116 original managed journal with Source153 replay. Preserve all auth/storage custom RLS/policies/triggers/default privileges/ownership, SECURITY DEFINER/ACL/search_path, extension and Realtime publication definitions, role memberships, and Auth, Queue/Outbox/Retention/Media data. Vendor suggests separate supabase db diff --linked --schema auth,storage, but the diff is advisory and may miss bucket/publication changes. Original encrypted catalog and SHA/row-count evidence must be compared independently.
Vault/pgsodium encryption root is project-specific; plain SQL restore on different project cannot decrypt old Vault ciphertext using the target key. Key portability/re-key is separate protected operator action; NEVER export or paste root key here. If not attested, Vault worker routes remain disabled in quarantine. See https://supabase.com/docs/guides/database/vault .
On approved encrypted volume only, generate Get-FileHash -Algorithm SHA256 for each DB SQL file, record byte length, and seal the manifest into separately encrypted offsite archive. Physical database size 80 MB is not a backup-storage forecast. Free plan supports verified offsite logical dump, no mandatory PITR or paid upgrade.

## P2: ORIGINAL Storage byte archives, independent from DB
Supabase Storage S3-compatible endpoint allows rclone/Cyberduck/AWS client: https://supabase.com/docs/guides/storage/management/download-objects and https://supabase.com/docs/guides/storage/s3/compatibility . S3 versioning is not supported, so record current generation/immutable revision/hold/deletion ledger and never assume older deleted bytes are recoverable. Configure READ-ONLY private stageS3 alias and encrypted profile in operator environment; not this chat. After approval ONLY:
    rclone lsf 'stageS3:community-media-staging' --recursive --files-only > 'X:\WandRecovery\Stage116\media-index.txt'
    rclone copy 'stageS3:community-media-staging' 'X:\WandRecovery\Stage116\objects\community-media-staging' --immutable --transfers 4
    rclone lsf 'stageS3:wand-preset-artifacts-staging' --recursive --files-only > 'X:\WandRecovery\Stage116\artifact-index.txt'
    rclone copy 'stageS3:wand-preset-artifacts-staging' 'X:\WandRecovery\Stage116\objects\wand-preset-artifacts-staging' --immutable --transfers 4
NEVER rclone sync/move/delete. Note: even rclone --dry-run accesses/list remote data; NOT executed now. Compute Get-FileHash SHA256 and byte count of every local object; compare complete paginated inventory, bucket/path, storage.objects and Wand media_assets/Preset artifact references/revisions, Content-Type, visibility, retention/moderation/legal holds. ETag is not SHA256. If objects change during sequential copy, fail closed until an authorized consistent second pass/quiescence is proven. Seal DB and Storage in DIFFERENT encrypted recoverable offsite archives outside primary rollback domain; independently verify offsite readback, protection/retention (engineering Storage target 7d, hold exception separately), and minimal 90d external deletion ledger.

## P3: quarantine restore with ZERO external side effects
Before touching SQL, independently establish a dedicated data-bearing isolation target (NOT Stage, NOT dataless branch). Block network egress, Cron/pg_net dispatch, all 21 Edge/Workers/service-role/SMTP/webhooks, provider cleanup, Storage delete, signed URL issuance, queue retries and external notification. An ordinary PG17 Docker image may lack Supabase extensions and cannot certify a full A2 restore; use pinned compatible vendor stack or independently authorized full quarantine environment. A newly created hosted Supabase project is not automatically isolated. Never replay unreviewed statements that register Cron, call network, re-enable triggers or preserve live worker secrets.
On isolated compatible target only, after roles/extensions/default ACL review and target-only neutralizing overlay, vendor illustrates psql --single-transaction -v ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql, bound to a private PGSERVICE target alias (never source). Trigger suspension is temporary for import; verify origin status after. Separately restore history_schema.sql/history_data.sql only if target journal not prebootstrapped; never duplicate entries. Review auth/storage customizations before target-only application. Do not use supabase db push/reset or any restore_project against Stage.
Restore copied Storage original bytes into INERT quarantine-only object service with separate target credential, independently download again and verify SHA256/length/key against source local manifest AND DB reference; no overwriting stageS3, no public signed URLs. Compare exact migration 116 journal, 5 Stage-only, 30 historical delta/current catalog, RLS/ACL/triggers/roles/SECURITY DEFINER, Auth/Wand account/Creator/Work revisions, Queue/Retention/Outbox/Provider state, media/Preset links and zero Cron/pg_net/Worker/Email side effects. No new actor/Cloud read/write enabled.
Reconcile minimal out-of-rollback deletion ledger (deletionEventId, accountId, requestedAt) after snapshot to prevent resurrection of deleted account/Work/Creator/media and stale public search; require due purge only in separately approved quarantine and revoke/revalidate restored sessions. If ledger/Auth/privacy/hold unknown, FAIL CLOSED and keep target dark. Independent reviewer records DB and Storage RPO<=24h each, RTO target<=4h, signed bytes and verified restore parity. Existing accepted PR272 checks bounded A0/A1/A2 metadata receipt SHAPE but ALWAYS outputs a2Accepted:false: neither it nor this planner proves actual successful restore. True A2 requires operator + independent actual confidential recovery witness.

## Stop / operator unresolved register
NEED_OPERATOR: named signed A0, approved encrypted paths and offsite/storage/retention/holds, credentials and key custodian, complete 116 applied SQL bodies/canonical diff, object inventory and size/cost, consistency window and source producers, quarantine target network/config extension compatibility, Vault root-key portability, external deletion ledger, #32 Provider worker destination and old public media/CDN 300s-bearer side effects, independent review and tested rollback. No Stage export/download/restore/cloud/SQL/Edge/Cron/payment action authorized in CTRL54. A3–A7 and Source116→153 semantic migration belong to future separately scoped tasks. Provider B HOLD, physical C NOT_AUTHORIZED; all PR DRAFT DO_NOT_MERGE DO_NOT_DEPLOY.
