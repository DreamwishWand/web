# Community Core account retention/runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — retention scheduling, holds, staged redaction and final state transitions at the staging PostgreSQL boundary.
- **CONFIRMED PASS** — Vault-authenticated retention worker invocation.
- **CONFIRMED PASS** — physical deletion of a real Storage object followed by database redaction.
- **CONFIRMED PASS** — retention dead-letter and worker-health operations alerts.
- **PARTIAL / FAIL-CLOSED** — Preset ArtifactBlob physical storage purge remains blocked until WEP provides the production artifact-storage adapter/bucket contract.

## Engineering defaults

These are configuration-driven engineering defaults, **not legal conclusions**:

- immediate account tombstone and public-access removal at deletion time;
- content payload purge after **30 days**;
- restricted operational-detail scrub after **365 days**;
- retry base: 300 seconds with bounded exponential backoff;
- active moderation/security/legal holds delay purge;
- open/triaged reports, open/reviewing moderation cases and unresolved provider cleanup also delay purge.

Launch privacy/legal review may change the durations without changing the state model.

## Structural preservation

Retention does not destructively collapse the shared identity graph.

Preserved as tombstones/reference structure:

- CommunityEntity IDs;
- CommunityWork / revision IDs and revision numbers;
- revision relationships;
- deletion event identity;
- non-sensitive state needed to explain historical moderation/report relationships.

User-authored payload and personal/operational detail are scrubbed separately.

Published revision immutability remains the normal rule. Retention redaction uses a transaction-local
`app.community_retention_redaction=on` flag inside the service-only finalizer. DELETE remains
forbidden by the immutable-revision guard.

## Content-payload stage

At the 30-day stage, when no hold applies:

- physical Gallery media objects are removed from the private Storage bucket by
  `community-retention`;
- MediaAsset storage key becomes `purged:<mediaId>`;
- MediaAsset size/dimensions/checksum are neutralized and `purged_at` is set;
- media read requires `purged_at is null`;
- purged media cannot be linked to new revisions;
- CommunityWork shared metadata is cleared;
- Gallery title becomes `[deleted]`, description becomes null and metadata becomes empty;
- Preset revision metadata is cleared;
- account idempotency rows are removed;
- AccountDeletionEvent records `content_purged_at` and moves to `purge_scheduled`.

### Preset payload boundary

If an account still owns an unpurged `ArtifactBlob`, the content-payload finalizer fails closed
with:

`Preset artifact storage purge adapter is not available`

This is deliberate. Community Core will not pretend that a Preset blob is physically deleted until
WEP defines the actual artifact Storage adapter/bucket and proves deletion.

## Operational-detail stage

At the 365-day stage, after content purge and when no hold applies:

- notification actor linkage is cleared;
- closed/rejected report free-text detail is removed and deleted-account reporter identity can be nulled;
- resolved/closed moderation action detail is reduced while structural case/action records remain;
- deleted-account AuditEvent actor/correlation/payload detail is scrubbed;
- completed/cancelled/rejected recovery cases are removed;
- completed provider-cleanup jobs are removed;
- AccountDeletionEvent records `operational_scrubbed_at` and moves to `purged`.

## Real database runtime

Transaction-scoped tests rolled back their synthetic fixtures.

### Retention state machine — 8/8 PASS

1. active retention hold blocked job claim;
2. content job claimed after hold release;
3. media and user-authored revision payload were scrubbed;
4. deletion event advanced to `purge_scheduled`;
5. operational job became claimable only after content purge;
6. operational AuditEvent detail was scrubbed;
7. deletion event finished as `purged`;
8. revision identity remained present after payload redaction.

### Retention operations — 8/8 PASS

1. retention dead-letter opened a critical persistent Operations Alert;
2. admin could list the dead-letter job;
3. recent-auth admin requeue reset it to pending and audited the action;
4. resolved dead-letter auto-resolved the alert;
5. admin could add/list a security retention hold;
6. admin could release the hold and audit the release;
7. stale retention worker heartbeat opened a critical alert;
8. restored worker heartbeat auto-resolved the alert.

## Retention worker and scheduler

Edge:

`supabase/functions/community-retention/index.ts`

Worker authentication:

- dedicated 256-bit token generated inside Postgres;
- plaintext token stored only in Vault;
- SHA-256 hash stored in private Community worker-auth state;
- Edge verifies `x-community-worker-token` through the service-only verification RPC before claim.

Cron:

- job: `community-retention-hourly`
- schedule: `17 * * * *`

Retention alert Cron:

- job: `community-retention-alerts-every-minute`
- schedule: `* * * * *`

Manual staging invocation returned HTTP 200 with zero due jobs and updated the retention worker
heartbeat.

## Real Storage purge E2E

A disposable confirmed Auth user signed in through the normal password provider path. The test:

1. bootstrapped one WandAccount/Creator;
2. uploaded a real 1x1 PNG object to `community-media-staging`;
3. registered it as an owner MediaAsset;
4. executed the deployed self-service WandAccount tombstone;
5. verified the real Storage object still existed after tombstone;
6. completed provider-account cleanup;
7. advanced only the test content-retention job to due;
8. invoked the real Vault-authenticated `community-retention` worker.

Observed worker response:

- `claimed=1`;
- `completed=1`;
- `failed=0`;
- outcome `completed`.

Post-worker evidence:

- Storage object count for the real PNG: **0**;
- retention job: `completed`, attempts=1;
- MediaAsset storage key: `purged:<mediaId>`;
- MediaAsset byte size: 0;
- MediaAsset `purged_at`: set;
- AccountDeletionEvent `content_purged_at`: set;
- retention state: `purge_scheduled`.

The operational-detail test stage was then advanced for this disposable fixture and completed through
the real worker, reaching `retention_state=purged`.

Fixture cleanup:

- disposable WandAccount: 0;
- MediaAsset: 0;
- retention jobs: 0;
- linked AuditEvent identity/payload references: 0;
- temporary E2E worker-auth row: 0;
- temporary E2E Vault secret: 0;
- Storage objects under `retention-e2e/`: 0;
- one-time E2E function restored to JWT-required 410-only behavior.

## Current boundary

Account-deletion retention is production-shaped for Gallery/media payload and operational metadata.

Remaining retention dependency:

- WEP must provide/prove the Preset ArtifactBlob physical storage deletion adapter. Until then,
  accounts with unpurged Preset blobs cannot pass content-payload completion and will retry/dead-letter
  visibly rather than falsely report `purged`.

External escalation beyond the internal Operations Alert console remains a separate launch-operations
decision.
