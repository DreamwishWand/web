# WEP Preset Artifact Storage Environment Contract — 2026-10-01

## Scope

This contract covers the Storage bucket used by:

- `wep-preset-artifact`
- `wep-preset-retention`

It externalizes deployment configuration only. It does not change Preset ownership,
publication, access control, retention orchestration, or DDV apply/write authorization.

## Environment variable

Production and every non-staging Supabase project must set:

`WEP_PRESET_ARTIFACT_BUCKET=<environment-specific-private-bucket-id>`

The value is read by both WEP Preset Edge Functions through the shared
`wep-preset-artifact-bucket.ts` resolver.

## Known staging compatibility

The known staging project is:

`ptpdoxhrqopvczpclcij`

Only that project may omit `WEP_PRESET_ARTIFACT_BUCKET`. When omitted there,
the resolver retains the existing bucket:

`wand-preset-artifacts-staging`

No staging bucket rename or migration is part of this change.

Outside the known staging project:

- missing `WEP_PRESET_ARTIFACT_BUCKET` fails closed;
- explicitly configuring `wand-preset-artifacts-staging` also fails closed;
- there is no production fallback to the staging bucket.

## Bucket contract

The configured bucket must preserve the existing WEP Preset ArtifactBlob storage
semantics:

- private bucket;
- `application/json` artifacts;
- 25 MiB maximum object size unless a separately approved contract supersedes it;
- WandAccount-stable object namespaces:
  - `staging/<wandAccountId>/...`
  - `published/<wandAccountId>/...`
- private signed reads;
- no public-object URL contract.

Production provisioning must create and verify the environment-specific bucket
before deploying the WEP Preset functions. The historical staging migration is
not a production bucket-selection mechanism.

## Retention invariant

Community Core continues to own retention-job claim/fail/complete orchestration.

`wep-preset-retention` must preserve this order for each ArtifactBlob:

1. validate the claimed retention job and WandAccount namespace;
2. physically delete the Storage object from the configured WEP bucket;
3. only after physical deletion succeeds, call
   `community_finalize_artifact_blob_purge(blobId, expectedStorageKey)`.

A Storage deletion failure must prevent finalization.

## Current verification

At WEP checkpoint `d577f2d170e9118a0e03df281af35996901e8220`:

- known-staging fallback: regression PASS;
- non-staging missing bucket: fail-closed regression PASS;
- non-staging explicit staging bucket: fail-closed regression PASS;
- WandAccount namespace and signed-read regression: PASS;
- physical-delete-before-finalizer ordering regression: PASS;
- staging deployment:
  - `wep-preset-artifact` v14 ACTIVE / JWT required;
  - `wep-preset-retention` v6 ACTIVE / worker-token auth retained;
- staging bucket readback remains private, 25 MiB, `application/json`;
- runtime no-token retention smoke reached function code and returned
  `WORKER_AUTH_REQUIRED`, confirming the known-staging resolver path initializes
  without an explicit bucket env value.

Persistent DDV Apply remains outside this contract and disabled.


## Production migration provisioning

The production migration chain no longer creates `wand-preset-artifacts-staging`.

Current split:

- `supabase/migrations/20260930124055_wep_preset_artifact_storage_v0.sql`
  retains only the generic `preset_artifact_prepare` action-rate policy;
- `supabase/staging/20260930124055_wep_preset_artifact_storage_bucket.sql`
  owns the known-staging private bucket bootstrap;
- production Release Operations must provision the private bucket selected by
  `WEP_PRESET_ARTIFACT_BUCKET` before deploying the WEP Preset functions.

This closes the production migration provisioning blocker without changing publication, signed-read,
retention, WandAccount namespace or DDV Apply semantics.
