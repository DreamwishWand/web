# COMM ↔ WEP Preset Artifact retention integration — 2026-09-30

Status: **CONFIRMED RUNTIME PASS**

## Boundary

This integration closes the Community account-retention path for WEP-owned Preset ArtifactBlob
physical storage without moving Preset payload semantics into Community Core.

Ownership remains unchanged:

- COMM owns account-retention scheduling, holds, claim/complete/fail state, alerts, and the
  service-only ArtifactBlob DB finalizer.
- WEP owns Preset payload validation, physical artifact storage namespace, physical deletion, and
  Preset read/preflight/apply semantics.

Community does not own or interpret Preset payload bytes.

## WEP storage implementation

Branch: `dev/wep-v125`

Migrations:

- `20260930124055_wep_preset_artifact_storage_v0.sql`
- `20260930124357_wep_preset_artifact_access_v0.sql`
- `20260930125310_wep_preset_retention_claim_v0.sql`

Edge functions:

- `wep-preset-artifact`
- `wep-preset-retention`

Staging storage bucket:

- `wand-preset-artifacts-staging`
- private
- JSON only
- 25 MiB maximum

Current publication validation supports Scene Presets. Other declared Preset types fail closed with
`PRESET_TYPE_VALIDATOR_NOT_AVAILABLE` until WEP supplies their validators.

The Scene validator rejects save-local Grid/GridObject identity recursively and validates the
current portable Scene/SubGrid/Road/Fence artifact envelope.

## Durable storage identity rule

Preset physical Storage keys use the durable WandAccount identity:

- `staging/<wandAccountId>/...`
- `published/<wandAccountId>/...`

They must **not** use the Supabase Auth provider subject as the storage namespace.

This rule was established by runtime evidence. The first disposable retention E2E exposed a mismatch:
the publication service originally wrote `published/<providerSubject>/...`, while retention correctly
validated `published/<accountId>/...`. Account deletion intentionally retires/tombstones provider
subjects, so provider identity is not a durable artifact-storage key.

The first content-retention attempt therefore failed closed and returned the job to `pending`
rather than deleting or falsely completing it. WEP publication was corrected to derive accountId
from the verified `community_authorize_session` result. Contract tests now prohibit
provider-subject namespaces.

## Retention ordering

The accepted path is:

1. `community-retention` claims a content-payload retention job and owns its lock token.
2. If the job reports live ArtifactBlobs, COMM calls `wep-preset-retention` using the same dedicated
   retention worker token and the exact retentionJobId + lockToken.
3. WEP resolves only blobs belonging to that claimed processing content-payload job.
4. WEP validates each Storage key is in `published/<accountId>/...json`.
5. WEP physically deletes the object from `wand-preset-artifacts-staging`.
6. Only after deletion succeeds, WEP calls
   `community_finalize_artifact_blob_purge(blobId, expectedStorageKey)`.
7. COMM removes any Gallery media for the same retention stage.
8. COMM completes the retention job.
9. Any adapter/storage/finalizer failure uses the existing retry/dead-letter/Operations Alert path.

The database finalizer still independently refuses content completion while any owned ArtifactBlob
remains live.

## Real Storage-object E2E — CONFIRMED

A temporary internal harness was protected by the existing retention worker token and returned no
email, password, JWT, provider subject, worker token, or API secret.

The accepted disposable fixture executed the real staging path:

1. created a disposable confirmed Supabase Auth user;
2. performed normal password sign-in;
3. bootstrapped a real WandAccount + CreatorProfile through `community-command`;
4. prepared a private Scene Preset through `wep-preset-artifact`;
5. uploaded a real JSON object through the signed Storage upload;
6. published the Preset through the WEP publication service;
7. confirmed one live ArtifactBlob and one real Storage object;
8. tombstoned the WandAccount through `community-account`;
9. deleted the disposable provider user;
10. advanced only that fixture's 30-day content job to due and invoked the normal Vault-authenticated
    `community-retention` worker.

Pre-retention evidence:

- other due content jobs = 0;
- fixture Storage object = 1;
- live fixture ArtifactBlob = 1;
- PresetArtifact row = 1;
- PresetRevision row = 1;
- content job = pending, attempts 0.

Worker result:

- claimed = 1;
- completed = 1;
- failed = 0;
- retention job = completed;
- attempts = 1;
- last_error = null.

Function logs independently recorded HTTP 200 for `wep-preset-retention` followed by HTTP 200 for
`community-retention`.

Post-retention evidence:

- physical Preset Storage object count = 0;
- ArtifactBlob `purged_at` set;
- ArtifactBlob storage key = `purged:<blobId>`;
- byte size = 0;
- content type = `application/x-purged`;
- checksum = all-zero neutral value;
- AccountDeletionEvent `content_purged_at` set;
- PresetArtifact stable row remains;
- PresetRevision stable row remains and still references the tombstoned ArtifactBlob;
- PresetRevision metadata = `{}`;
- CommunityWorkRevision stable row remains.

Because the physical object no longer exists and `wep_get_accessible_preset_blob` rejects purged
ArtifactBlobs before signed-URL creation, the normal WEP read path cannot issue a new signed read for
the purged payload.

## Operational stage and cleanup

For the two disposable fixtures used while closing this contract, only their own 365-day
operational-detail jobs were advanced. The normal retention worker returned:

- claimed = 2;
- completed = 2;
- failed = 0.

Final staging cleanup state:

- active pending/processing/dead-letter retention jobs = 0;
- fixture provider-cleanup jobs = 0;
- WEP Preset Storage objects = 0;
- live ArtifactBlobs = 0;
- both fixture AccountDeletionEvents reached `retention_state=purged`;
- temporary pg_net response bodies = 0.

The temporary E2E Edge function was returned to JWT-required HTTP 410
`STAGING_E2E_DISABLED` behavior. Immutable structural/audit history was not bypassed or erased.

## Verification

Current evidence after closure:

- `dev/wep-v125` HEAD `306cafd0a952a63f1012b68820ce78c952570c24`;
- CI run #621: SUCCESS;
- `community-retention` v2 ACTIVE;
- `wep-preset-retention` v3 ACTIVE;
- `wep-preset-artifact` v7 ACTIVE with user JWT verification;
- temporary `community-wep-retention-e2e` v3 ACTIVE only as JWT-required 410-disabled code;
- Security Advisor WARN = 0;
- Performance Advisor unindexed-foreign-key findings = 0.

## Evidence classification

**CONFIRMED**

- private WEP Preset Storage boundary;
- WandAccount-based durable Storage namespace;
- claimed retention job + lock-token binding;
- COMM → WEP retention delegation;
- physical delete before COMM ArtifactBlob finalizer;
- real physical Storage object removal;
- ArtifactBlob tombstoning;
- content-retention completion;
- structural Preset/revision preservation;
- operational-stage completion and fixture cleanup.

The Preset retention dependency from COMM to WEP is closed for the tested staging Scene Preset path.

Remaining WEP/Community work is product flow, not retention plumbing: publication/discovery/Library →
read/preflight/apply and the no-direct-SQL product-shaped vertical slice. Other Preset types remain
fail-closed until their WEP validators exist.
