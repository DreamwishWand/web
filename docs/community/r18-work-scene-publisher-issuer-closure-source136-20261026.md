# 03 COMM R18-work Source136 — Scene Product Issuer Closure and Verified Storage Publication Contract

Status: DRAFT / SOURCE ONLY / DO_NOT_MERGE / DO_NOT_DEPLOY. R18-work is not Release Acceptance R18. Source135 Reservation/Lease/Fence/Readback remains authoritative. This delta is a P0 source issuer inventory and default-deny barrier, not a certified real-Provider positive publisher.

## Evidence and separately versioned surfaces

- CONFIRMED source baseline: PR #134 Source135 exact a0e9063af96b28b069fd92b7a9f16261fa8990a4; 135 migrations, CI40256406315 and Bootstrap40256406319 SUCCESS. This document covers only Source136 delta.
- CONFIRMED deployed source read-only inventory via 09 INT/04 QR: ACTIVE Staging wep-scene-preset-product v1 SHA256 6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045, JWT verify true; ACTIVE wep-preset-artifact v14 fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa; ACTIVE wep-preset-retention v6 675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e.
- The distinct Scene Product publisher uses the same WEP published/{account}/{SHA256(account:idempotency)}.json namespace, copies before public.community_publish_scene_preset_product_v1, compensates SQL failure by physical Storage.remove(published), deletes stage after success, discards stage physically, and separately calls community_unpublish_scene_preset_v1 and community_delete_scene_preset_v1. Read-only catalog confirms three Scene lifecycle SQL functions on historical staging. No observed real incident, no evidence that Source136 is deployed.
- HIGH CONFIDENCE structural collision: same key can be addressed by Generic and Scene endpoints; uncoordinated Copy/compensation can threaten another winner. This is not a runtime-confirmed collision.
- UNKNOWN: other unregistered Cron/indirect SQL/Storage issuers, Cloud/versioned objects, operator deployment ordering and actual signed JWT Provider behavior.

## New Source136 entrypoint closure

- New supabase/functions/wep-scene-preset-product/index.ts is a source-only authenticated fail-closed stub. It checks normal session authority, then responds 409 on prepare/publish/unpublish/delete/cleanup/compensate/discard/unknown. It neither calls Storage.copy/remove nor any positive Scene lifecycle RPC.
- New additive 20261025003000_r18_scene_product_publisher_source_closure.sql dynamically revokes EXECUTE on all existing public signatures of community_publish_scene_preset_product_v1, community_unpublish_scene_preset_v1 and community_delete_scene_preset_v1 from PUBLIC/anon/authenticated/service_role. It explicitly verifies no role retains EXECUTE on any discovered matching signature and is harmless on source-only empty bootstrap where historical functions are absent. Revocation is not enough to prevent old deployed Edge pre-SQL Copy/remove and should not be described as live closure.
- R16 private Registry gains separate deployed Scene positive, Source stub, shared-key collision, failed SQL compensation, Staging discard, postcommit stage removal, Scene lifecycle and WEP retention issuers. Deployed entries stay SOURCE_PRESENT_UNENROLLED, not incorrectly FAIL_CLOSED; only the new Source Alias is FAIL_CLOSED. No existing accepted Gallery/Privacy/Identity or Source134/135 Writer is reenrolled.
- Source136 does not grant a new public RPC, does not touch Source135 release gate (OFF), does not create positive Provider attestor, does not change Storage, Staging or live Cron.

## Verified positive protocol (NOT IMPLEMENTED / FAIL CLOSED)

1. A single Account/Creator/Auth/Privacy Idempotency authority must own both Generic and Scene entrypoints, with a reservation UNIQUE(Account, Idempotency), immutable request hash, and globally collision-free destination identity. Treat Source135 deterministic published key as a conflict domain, not an overwrite permission.
2. Claim creates a server-issued monotonic fence, 90s lease and expected stateVersion. The provider operation must support a documented atomic destination-create-if-absent precondition, must never upsert, and must bind the exact immutable Object Version/ETag and source object identity to reservation and fence. If this capability is unsupported or stale, stop before Copy.
3. A credible attestor must be independent of both the caller's claimed checksum and the Edge reader self-report. Use provider-backed immutable version identity, independent account-authorized readback of the exact version, SHA256 over actual Published bytes and byte size, a receipt whose issuer and replay/expiry can be authenticated server-side, and a protected transaction that validates attestation under lock. Edge readback metadata alone stays EDGE_READBACK_UNATTESTED.
4. SQL publication must lock Account → Reservation → associated Artifact/Work/Scene/Gallery graph in documented order, check active creator/account/privacy and all current/historical links, immutable version and lease fence, moderation, reference graph completeness and release gate, then write Blob/Work/Revision/Publication/Search/Outbox/Idempotency and committed reservation in one DB transaction. Failed SQL never deletes the Published destination. Same exact completed request replays the same committed result, conflicting request hash rejects.
5. SQL rollback and interrupted Copy leave a quarantined recoverable reservation/object. Retried winner checks destination existence/version/bytes before any further Copy. A late first publisher and expired lease cannot replace or erase a later winner. Provider object loss after committed DB publication requires suppression/recovery, not unsafe silent republish.
6. Signed OwnerA/NonownerB/ModeratorM normal JWT, Provider no-overwrite, immutable version and independent binary SHA, failed Copy/Commit/Compensation, stale actor/fence, twin-endpoint same key, Cloud and CDN replay must pass 04 QR before enabling any positive Publisher. 09 INT owns independent Source-only two-PG tests. No local mock or SQL synthetic attestation promotes this contract to Provider acceptance.

## Independent cleanup authority (NOT IMPLEMENTED / FAIL CLOSED)

Claim, eligibility proof and physical delete are three separate operations. Cleanup claim must fence specific immutable provider object version and verify no current or historical PresetRevision, PresetPublication, GalleryRevision/Scene links, current Work, other active Reservation, Cloud retention/restore, outstanding live signed URL/CDN bearer, legal hold/erasure exception, moderator dispute or concurrent publish reference remains. An enrolled worker must re-check this complete graph and provider object identity/version immediately before conditional physical delete and atomically log the receipt before finalizing purge. Missing graph, unknown provider conditional delete, 404 race, lost lock, expired cleanup lease, Old Signed URL/CDN or Unknown Cloud hold => NOT AUTHORIZED. Source135 discard/retention and new Source Scene stub still call no physical remove. Privacy suppression is independent and remains available.

## Required Operator #130 order (NOT EXECUTED)

1. Obtain explicit human approval with disposable signed actors, legal/privacy/PITR backups and protected staging; reconcile historical managed Staging116 ledger against Source136, not by blind append.
2. Establish a global inbound write/worker quiescence barrier for BOTH Generic and Scene routes plus WEP retention before changing SQL. Drain or inventory all in-flight Copies/compensation; blocking SQL alone can trigger old Edge physical compensation.
3. Verify complete Edge route/worker/SQL/cron issuer SHA manifest and persistence/rollback plan; ensure unknown issuer -> fail closed.
4. In the approved window, replace the existing Scene Edge bundle with reviewed terminal Source stub and Generic/Retention counterparts, then add compatible SQL ACL barriers; independently verify exact deployed bundles and live permissions. Restore only safe read-only traffic; all positive/physical paths stay OFF.
5. Obtain separate provider conditional object API contract, authoritative byte receipt and reviewed positive implementation, 09 INT independent tests and 04 QR signed tests before authorizing positive publication; yet another Operator approval is required for physical cleanup.

Source files cannot disable an already ACTIVE remote Edge. Current release and safety flags: SOURCE_FULLY_ENROLLED=0; graphComplete=false; retirementAuthorized=false; saveRevisionAuthorized=false; pairedGalleryPublishAuthorized=false; physicalCleanupAuthorized=false; all positive Preset/Scene Publish, Delete/Unpublish, Gallery retirement, Cloud Private/Restore, Native DDV Writer/Apply OFF. R17 Product Tree PASS0/PARTIAL12/BLOCKED18, NO Release R18.

## New independent acceptance cases

- Source136 isolated empty + reset Bootstrap, additive reapplication with RPC ACL, duplicate Registry insert conflict stability; Source135 preserved.
- Actual transpiled Scene stub + MOCK Supabase: normal signed-shaped Owner publish/unpublish/delete/prepare/discard/failed compensation all 409 before any Storage calls; anon/revoked 401. MOCK is not signed E2E.
- Actual local PostgreSQL test creates disposable synthetic historical three Scene SQL functions, grants service/anon/authenticated, reruns 03000 in rollback, verifies all grants revoked, Source alias fail-closed, deployed entries explicitly unenrolled and no persistent mutation on second connection.
- 09 INT followup: exact Owner HEAD independent both-endpoint same-key mock interleaving and archival graph audit, stale/fresh lease and submitted proof downgrade, SQL rollback/no unauthorized delete; no repeat of frozen Source134/135 accepted cases.
- 04 QR: Operator130 signed Provider/byte/ETag/same-key winner/old bearer t0/60/300/historical/legal/cleanup and migration/runtime parity. CONFIGURATION_BLOCKED until operator approval.

