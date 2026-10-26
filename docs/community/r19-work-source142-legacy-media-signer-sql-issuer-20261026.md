# 03 COMM — Source142 Legacy Media Signer Direct SQL Incident Authority (2026-10-26)

Status **DRAFT / SOURCE ONLY / DO_NOT_MERGE / DO_NOT_DEPLOY**. Existing Community Core workstream, not formal Release R18/R19. Do not reimplement Source134–141. Source141 Owner PR134 frozen baseline SHA `74622922b0851f585eceb1e845863f3b675caea2`, SQL03050 blob `755c45a5edfe0d8cdab4b4320ecdfa02443183fe`. Source140 03040 blob `12ec679135ec00033e94760446dcff86ed70884d`. No edits to accepted files.

## Trigger: Independent Source141 actual SQL counterexample

09 INT PR184 exact HEAD `9d375807aa278d03bee47c50e79b4ce85b56cc4d`, ordinary CI40291822508 + actual isolated two-PG40291822456 SUCCESS: after durable synthetic local Published-object Integrity Incident, direct service_role SQL `public.community_get_media_storage_key(uuid,uuid)` returns affected Gallery Media `storageKey` despite separate R19 early `community-media` Edge guard; Public V2 and Owner Gallery read direct SQL guards remain safe. This is **CONFIRMED SOURCE141 LOCAL SQL**, not remote signed bearer, real Supabase Storage, Staging or public read evidence. INT PR180 caller census notes authenticated legacy non-Gallery fallback uses this RPC prior to 300-second signed URL. Separate DreamSnaps judge issuer is not this SQL route.

## Minimal Source142 addition

New additive Migration `20261025003060_r19_legacy_media_signer_authority.sql` recreates **only** the effective function body from `20260930082000_community_core_v0_retention_policy.sql`, with one added statement:

`perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);`

The call occurs **after** `private.resolve_active_account(p_auth_subject)` and `private.can_access_entity(p_media_id,v_account_id)`, and **before** reading `media_assets` or constructing JSON with `storageKey`. Existing `processing_state='ready'`, `moderation_state='clear'`, `purged_at is null`, missing-media exception, Owner eligibility and returned-field schema remain byte-identical. The SQL function remains SECURITY DEFINER with pinned `search_path=pg_catalog,public,private` and the existing `(uuid,uuid)` signature. A separate explicit `REVOKE ALL FROM public,anon,authenticated,service_role; GRANT EXECUTE TO service_role` preserves the known privileged Edge signer caller and prohibits general Data API SQL invocation. No new public direct SQL capability.

Source142 **does not edit** Source141 Direct Public/Owner guarded SQL, original private Owner helper EXECUTE Revoke, Source140 historical Gallery/Cover-only, Source139 incident logic, Source137 provider protocol, Signed URL creation, Source Edge, DDV native writer or physical cleanup. Normal unrelated Media, Gallery and independent DreamSnaps are not globally suppressed: only media in `private.preset_storage_media_quarantined_r19` graph raises established error `R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED`. Previously-issued signed Storage bearer/CDN remain unrevoked.

## Scoped acceptance and limits

Owner-only static exact-source equivalence strips the single guard and compares old/new effective function body; checks order, semantics, ACL and no-enabled-writer, with 142 ordered source migrations. Existing Owner postcommit synthetic **two real PostgreSQL backend** test adds ONLY new legacy signer checks:
- valid Owner and owned unrelated normal media before Incident, nonOwner denial, direct service_role vs anon/authenticated privileges;
- Reporter transaction uncommitted: separate reader continues authorized visibility under READ COMMITTED;
- Reporter COMMIT: impacted media direct legacy SQL denied before a Storage Key, repeated denial idempotent, unaffected ordinary media remains readable; the same postincident check passes under `SET LOCAL ROLE service_role`;
- committed Incident/history/search and Source141 direct SQL results remain unchanged, release Gate OFF.

These are actual local PostgreSQL with synthetic object metadata, **not** real Supabase Storage Provider blob, JWT, CDN, or Staging. Positive provider attestation, Incident Resolution, Physical Cleanup, Cloud Private/Restore and Native Save Writer/Apply remain OFF. Independent Source142 09 INT and 04 QR **new delta only** must re-pin final Owner SHA+03060 Blob, verify effective service_role ACL/caller routes; owner/nonOwner/Retired/Privacy/Moderator session; impacted current/historical/direct Gallery/cover-only versus unaffected Gallery/DreamSnaps; Reporter race and direct signer return, without re-running INT184/QR182; Stage-only Scene/Cloud/legal graph remains UNKNOWN.

## Operator boundary

Stage last read-only historic116/21 active Edge/7 Cron, old Generic14, separate Scene Product1, Retention6 include Copy-before-SQL and Remove. Human Operator issue130 A/B/C not approved: A externally quiesce all ingress, direct SQL, cron, workers, old signed uploads; prove all in-flight Copy/SQL/Remove and compensation drained; attest fail-closed Edge/Worker deployed bundle SHA **BEFORE** reviewed Stage116→Source142 SQL/ACL/RLS/Trigger cutover under PITR/legal/real Storage byte restoration. Never SQL revoke first while old Scene Publisher can copy then delete on SQL failure. B true normally signed OwnerA/nonOwnerB/ModeratorM remote atomic Provider, independent downloaded actual SHA256/Size and signed URL/CDN timeline still BLOCKED. Native Supabase S3 Object Versioning unsupported; Standard Upload upsert:false + pinned GET/readback remains HYPOTHESIS, not acceptance. C historical/Cloud/Privacy/Legal reference-aware conditional physical cleanup NOT AUTHORIZED. No Staging mutations.

Release R17 30 nodes PASS0 / PARTIAL12 / BLOCKED18, source enrollment0, graphComplete=false, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false, physicalCleanupAuthorized=false. All drafts DO_NOT_MERGE/DO_NOT_DEPLOY.
