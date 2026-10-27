# DDVRE 03 COMM R17-X02 — Photo Cover Ordinal Consistency

## Evidence and defect

09 INT independently exercised actual original 03 COMM Source132 owner-only `community_gallery_photo_media_preflight_r17` and found: a Photo cover present in `work_revision_media` with `ordinal=1` yields `coverInRevisionMedia=true`, `coverFirst=false`, yet `knownDependencyCounts.coverSubjectOrReferenceMismatch=0` and no `MEDIA_COVER_METADATA_INCONSISTENT` block. The aggregate used to check subject equality and cover presence at any ordinal, not cover at ordinal zero.

This does not grant unsafe writer authority because `graphComplete=false`, `mutationAuthorized=false`, `retirementAuthorized=false` remain hardcoded false. But the source-facing consolidated metadata summary must not contradict its constituent Cover predicate.

## Scoped Owner repair

New additive migration `20261025002970_r17_photo_cover_ordinal_consistency.sql` redefines only the existing service-only stable read-only SQL function, preserving migration 02960 byte-for-byte in historical source. The aggregate cover mismatch filter now also treats a cover with no matching `work_revision_media` at **ordinal=0** as inconsistent. With a cover at ordinal1, `coverFirst=false`, mismatch increments and `MEDIA_COVER_METADATA_INCONSISTENT` is emitted. The predicate covers both current and historical revisions; no positive Graph SHA or Owner Writer right is granted. Previous contract field name `coverSubjectOrReferenceMismatch` is retained to avoid breaking existing consumer DTOs, and now encompasses cover ordering. This compatibility caveat must be documented for future consumers.

Synthetic source fixture cases exercise:
1. Current Photo Cover at ordinal0 → coverFirst=true, mismatch0, no inconsistency block.
2. Historical Scene-linked Gallery Photo Cover at ordinal1, also present in revision Media → coverInRevisionMedia=true, coverFirst=false, mismatch1 and inconsistency block.
3. Scene-linked Gallery Photo Cover absent from its revision Media with mismatching bound subject → coverFirst=false, coverInRevisionMedia=false, subjectMatches=false, mismatch1 and inconsistency block.

No real Storage binary, checksum verification or signed user HTTP is implied by any fixture. Service-role-only ACL and authenticated `community-query` gateway unchanged. All mutations, Media Cleanup, Gallery retirement/private/restore, paired Scene writer and Native DDV Apply remain OFF.

## Independent handoff and deploy boundary

After exact Owner HEAD ordinary CI and empty/local reset/replay Source133 pass, 09 INT and 04 QR independently pin **new** X02 SQL only, validating ordinal0/ordinal1/missing cover/subject mismatch, nonowner/retired/privacy actor, no side effects or URL leakage. Previously accepted R12–R17 old Legacy Gallery Comments, Photo Writer races, moderation and DreamSnaps remain closed; do not rerun without a changed Writer SQL body.

Live staging remains managed 116 historic migration entries, not Source133 prefix; Owner/Ops parity and approved operator #130 required before any staging integration. Source tests are not true signed Staging/Storage/CDN JWT acceptance. All Drafts DO_NOT_MERGE / DO_NOT_DEPLOY. R17 release Product Tree PASS0/PARTIAL12/BLOCKED18, no R18.
