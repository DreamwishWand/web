# WEP Preset product-flow runtime — 2026-09-30

Status: **CONFIRMED RUNTIME PASS**

## Scope

This acceptance covers the current safe Scene Preset Community/WEP vertical slice on the isolated
Supabase staging project. It does **not** authorize persistent DDV save writing.

Accepted path:

`local WEP validation → signed upload → publish → public discovery → work→Preset resolution →
Library Save/query → Preset detail → signed ArtifactBlob read → byte-size/SHA-256 verification →
downloaded WEP revalidation → destination preflight`

The accepted preflight remained `writeReady=false` with
`CORE_COMMIT_ADAPTER_NOT_BOUND`.

## Runtime

Staging project: `dreamwish-wand-staging` / `ap-northeast-1`.

Successful internal HTTP run:

- pg_net request id: `598`
- WEP artifact service: `wep-preset-artifact` v11
- result: HTTP 200 / `ok=true`
- synthetic Auth user used normal password sign-in
- WandAccount + CreatorProfile were created through `community-command`
- Scene artifact was uploaded through the signed Storage URL
- publication used `wep-preset-artifact`
- public discovery used `community_search_public`
- exact Community work resolved back to the expected PresetArtifact
- SavedItem/Library save and query succeeded with `accessible=true`
- Preset detail query succeeded
- WEP signed read succeeded
- downloaded byte size matched registered byte size
- downloaded SHA-256 matched registered checksum
- downloaded JSON passed WEP Scene validation again
- destination preflight succeeded
- persistent write remained locked
- fixture WandAccount tombstone and provider-user deletion succeeded

The temporary harness returned these checks as true:

- localValidation
- signedUpload
- publish
- publicDiscovery
- workResolve
- librarySaveAndQuery
- presetDetail
- signedRead
- byteSize
- checksumSha256
- downloadedValidation
- destinationPreflight
- persistentWriteLocked
- accountTombstone
- providerUserDeleted

## Runtime defect found and fixed

The first two disposable probes correctly failed closed during publication.

The first probe exposed that the publish fallback discarded the initial staging validation error and
reported the published-key fallback error instead. The service now preserves the meaningful staging
validation error when the idempotent published fallback is absent.

The second probe then identified the actual defect: the server-side portable identity regular
expressions had been committed/deployed with an extra backslash and rejected valid `o0` Scene root
IDs (and equivalently affected `cN` / `nN` patterns).

The Edge validator was corrected to executable patterns:

- root object: `/^o\d+$/`
- SubGrid child: `/^c\d+$/`
- Fence node: `/^n\d+$/`

A source-level regression now rejects the over-escaped forms and also reasserts that Preset Storage
uses durable WandAccount namespaces rather than provider Auth subjects.

## Cleanup

Three disposable attempts were tombstoned and fully processed through the normal account-retention
worker.

All six fixture retention stages completed with:

- attempts = 1
- last_error = null

Final staging cleanup:

- Preset Storage objects = 0
- live ArtifactBlobs = 0
- active pending/processing/dead-letter retention jobs = 0
- fixture provider-cleanup jobs = 0

The successful PresetArtifact and PresetRevision structural history remains, while the referenced
ArtifactBlob is tombstoned as expected:

- storage key rewritten to `purged:<blobId>`
- byte size = 0
- content type = `application/x-purged`
- revision metadata = `{}`

## Temporary harness shutdown

The temporary `wep-preset-flow-e2e` function is now v2 with JWT verification enabled and returns
HTTP 410 `STAGING_E2E_DISABLED`.

Its dedicated worker-auth row and Vault token were deleted after acceptance. The temporary validator
copy was removed from the current source tree; immutable Git history retains the acceptance
implementation.

## Evidence classification

**CONFIRMED**

- product-shaped Scene publication/discovery/Library/read/preflight chain on real staging HTTP;
- exact work→Preset resolution;
- signed ArtifactBlob integrity verification before reuse;
- downloaded payload WEP revalidation;
- persistent writer lock remains enforced;
- cleanup through normal retention;
- temporary E2E credentials and execution path disabled after use.

## Boundary

This closes the current WEP P2 runtime gate **through destination preflight**.

It does not close Core Gate D. Persistent Scene apply, Road/Fence mutation, Biome/Floating Island
apply, inventory consumption/refund, native identity allocation, codec commit and atomic save
replacement remain unavailable until their owning Core capabilities are explicitly promoted.
