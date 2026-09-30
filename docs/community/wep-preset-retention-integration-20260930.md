# COMM ↔ WEP Preset Artifact retention integration — 2026-09-30

Status: **HIGH CONFIDENCE IMPLEMENTED / REAL STORAGE E2E PENDING**

## Boundary

This integration closes the code-level gap between Community account-retention orchestration and
WEP-owned Preset ArtifactBlob physical storage.

Ownership remains unchanged:

- COMM owns account-retention scheduling, holds, claim/complete/fail state, alerts, and the
  service-only ArtifactBlob DB finalizer.
- WEP owns Preset payload validation, physical artifact storage namespace, physical deletion, and
  Preset preflight/apply semantics.

Community does not become the owner of Preset payload bytes.

## WEP storage implementation

Branch: `dev/wep-v125`

Implemented migrations:

- `20260930124055_wep_preset_artifact_storage_v0.sql`
- `20260930124357_wep_preset_artifact_access_v0.sql`
- `20260930125310_wep_preset_retention_claim_v0.sql`

Implemented Edge functions:

- `wep-preset-artifact`
- `wep-preset-retention`

Staging storage bucket:

- `wand-preset-artifacts-staging`
- private
- JSON only
- 25 MiB maximum

Current publication validator accepts only Scene Preset payloads. Other declared Preset types fail
closed with `PRESET_TYPE_VALIDATOR_NOT_AVAILABLE` until their WEP validators exist.

The Scene validator rejects save-local Grid/GridObject identity fields and requires the current
portable Wand Scene envelope.

## Retention ordering

The retention path is now:

1. `community-retention` claims a content-payload retention job and owns its lock token.
2. If the job reports live ArtifactBlobs, COMM calls the internal
   `wep-preset-retention` Edge adapter using the same dedicated retention worker token.
3. WEP resolves only blobs belonging to the exact claimed processing job + lock token.
4. WEP validates each storage key is inside `published/<accountId>/...json`.
5. WEP physically removes the object from `wand-preset-artifacts-staging`.
6. Only after physical removal succeeds, WEP calls
   `community_finalize_artifact_blob_purge(blobId, expectedStorageKey)`.
7. COMM then removes any Gallery media objects for the same retention stage.
8. COMM completes the retention job.
9. Any adapter/storage/finalizer failure is routed through the existing retention failure/retry/
   dead-letter/Operations Alert path.

The code-level order therefore preserves the original fail-closed contract: account content purge
cannot report completion while a claimed Preset ArtifactBlob remains unfinalized.

## Static / staging verification

CONFIRMED implementation evidence:

- WEP storage/access/retention migrations are applied to staging.
- `wep-preset-artifact` is ACTIVE with JWT verification enabled.
- `wep-preset-retention` is ACTIVE with worker-token authentication and JWT verification disabled.
- `community-retention` version 2 is ACTIVE and delegates ArtifactBlob purge to WEP before media
  removal and job completion.
- contract tests assert:
  - WEP private bucket / Scene-only fail-closed validation;
  - claimed retention job + lock-token binding;
  - physical Storage removal precedes COMM finalizer;
  - WEP adapter call precedes COMM job completion.
- `dev/wep-v125` CI run #601 is SUCCESS.
- Security Advisor WARN count = 0.
- Performance Advisor unindexed-foreign-key count = 0.

Post-deployment staging state at verification time:

- active pending/processing/dead-letter retention jobs = 0;
- live ArtifactBlobs = 0;
- objects in `wand-preset-artifacts-staging` = 0.

No existing user payload was modified during this integration deployment.

## Evidence boundary

This is **not** the 10-step real-object acceptance from the COMM→WEP retention handoff.

Still PENDING:

1. create a disposable published Scene Preset through the actual WEP artifact path;
2. verify a real object exists in `wand-preset-artifacts-staging`;
3. create/tombstone a disposable account so content retention is due;
4. run the normal claimed retention worker path;
5. prove the real Storage object is absent afterward;
6. prove ArtifactBlob is a purged tombstone;
7. prove structural PresetArtifact/PresetRevision history remains;
8. prove signed/read access is unavailable;
9. prove the content-payload retention job completes;
10. clean the fixture and preserve secret-free evidence.

Until that real Storage E2E passes, classify the adapter as **HIGH CONFIDENCE IMPLEMENTED**, not
CONFIRMED runtime closure.
