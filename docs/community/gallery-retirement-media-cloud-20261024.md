# 03 COMM Gallery retirement, issued-media URL and Wand Cloud — 2026-10-24

Request: `03-COMM-GALLERY-RETIREMENT-MEDIA-CLOUD-CONTRACT-V1` / Issue #116.
Parent: canonical 03 COMM PR #108 at `a7a492254d9e5f571e41adf151e2fe893d84c813`.
Stacked: 09 INT PR #113 at `9af8683fbd43958af8f3bc9c9908d0ea59931c32`.
Work branch: `dev/community-gallery-retirement-media-cloud-20261024`, created from exact PR #113 HEAD. This branch has **no alternate publication RPC, no competing Media store or duplicated Gallery domain**.

**Status: PARTIAL.** Do not merge draft PR #108/#113/#105 or enable Delete/Unpublish/Republish until the remaining end-to-end gates close. DDV save writers and Apply remain OFF.

## Verified public subject lookup — implemented/staging DB PASS

- Additive source migration: `supabase/migrations/20261024222000_community_gallery_verified_subject_public_lookup_v1.sql`, service-only invoker RPC `public.community_list_verified_gallery_subjects_v1(p_gallery_kind text default null,p_limit integer default 50)`.
- The **existing** anonymous `community-public-query` Edge uses a fixed allowlist, validated `p_gallery_kind` filter (null/outdoor/indoor/tom_furniture/tom_clothing) and integer `p_limit` 1–100; no dynamic RPC/table names or user-supplied SQL predicates.
- Response `{contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:[{subjectId,galleryKind,subjectType,canonicalTargetId,baseItemId,platform,gameVersion,buildId,profileSchema,displayIdentity,displayName,verificationState,evidenceRef}],catalogStatus:'partial_verified_only',displayNamesVerified:false}`.
- Verified present rows: **13 Floating Island**, Nintendo Switch DDV 1.25.0, BID 52BD625D9B4E0053, schema624. All other four types return empty; never manufacture missing ids. `displayIdentity` is deliberately `SceneItemId <ID>`; `displayName=null` until official localized display metadata is reviewed. This is not a claim of item ownership, save compatibility, or ToM import.
- The raw `gallery_verified_subjects` table has no anon/authenticated SELECT; direct RPC grants remain restricted to service_role. Public access traverses only the reviewed Edge allowlist.
- Staging migration applied, explicit transaction `supabase/staging/acceptance/gallery-retirement-subject-lookup-v1.sql` PASSED with 13/13 approved lookup + zero unverified kinds + ACL + existing negative retirement gate; transaction rolled back without fixture content. Edge public-query v6 deployed (JWT OFF by existing design). **Live external HTTP/Chrome catalog query NOT_EXECUTED** due environment limitations.
- Public-query output for Gallery photo detail and new catalog has `private, no-store` to minimize stale public projections. This does not guarantee removal from a previously saved/cache-retained response.

## Media / CDN retirement — implemented response hardening; positive revoke remains UNKNOWN

Distinct revocation surfaces:
1. DB Work visibility/Creator/search/detail: existing #108/#113 authorization can remove new public queries; no claimed positive delete execution under current global negative trigger.
2. **New** Storage URL issuance: `community_get_public_media_storage_v2` enforces current visibility. Denying it revokes new tokens, not old tokens.
3. **Public-media Edge token-bearing response cache:** changed from `public,max-age=60` to `private,no-store`, plus `Pragma:no-cache` and `Vary:Origin`. Staging `community-public-media v3` deployed (existing JWT OFF). This reduces accidental *future* caching of new bearer tokens. It does not clear old tokens.
4. **Previously issued Supabase Storage signed URLs:** issuer uses `createSignedUrl(...,300)`, 300-second token TTL. No mechanism shown to cancel an already issued signed URL selectively; revoking JWT or stopping issuance cannot cancel it.
5. **CDN/browser cache:** expiry of an individual signed token does not necessarily purge cached content. Supabase Smart CDN docs say deletion invalidation may propagate for up to 60s and browsers may retain copies. Whether Smart CDN is enabled for this staging plan and real old-URL replay timing are **NOT_EXECUTED/UNKNOWN**. **Never claim true immediate revocation.**
6. Storage objects/retention: do not physically delete the only source image during a PUBLIC->CLOUD private migration. Object-key deletion may be appropriate only after a verified durable private object copy, full dependency graph, and separate rollback and retention contract. Media that is historically referenced must be preserved according to approved policy; unrelated images never purged.

Current safe default: **classified PHOTO Delete and Cloud Unpublish remain BLOCKED** by the existing 09 INT negative gate `GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN` and original Cloud/dependency guards. A future delayed-retirement design MAY express `requested` then `pending_expiry` then `retired`, with actual status and user messaging. It cannot call the Work deleted/private immediately while old URLs remain reachable. A mere 300s timer is insufficient without CDN/browser observations and approved policy. Do not create an unbounded, impossible-to-prove wait silently.

Preferred eventual direction: object-key isolation and/or a per-request authenticated/authorized media proxy with no externally reusable Storage signed URL. Public delivery must not leak bypassable signed origin URLs. Before any API activation, prove the exact deletion/privacy guarantee with production-equivalent CDN and browser caches and tested temporal authorization. If a bounded non-immediate removal policy is accepted, product-visible state and privacy claims must explicitly match it.

Supabase source contracts: https://supabase.com/docs/guides/storage/serving/downloads and https://supabase.com/docs/guides/storage/cdn/smart-cdn .

## Wand Cloud private preservation — contract, **NOT ACTIVATED**

No production/staging Wand Cloud subscription-entitlement/owner-private gallery store contract was observed in current connected staging schema. Free PUBLIC storage must never silently become free server-private storage. PC local export is independent and never substitutes for durable Wand Cloud.

Required positive service contract before any PUBLIC->PRIVATE Work transition:
1. Bind an **authorized Wand Cloud entitlement** to Wand Account and exact Creator/Work. Never trust a client-supplied paid flag.
2. Reserve an owner-only, privately versioned immutable source manifest (original Work identity, ordered media+cover, source Revision IDs, exact linked Preset revision links, content hash/checksum and ownership). Preserve originals, not just pointers to future-purge public media.
3. Copy media to **new private-only object keys** (old public URL tokens MUST NOT grant access); verify content/checksum, object existence and owner-only ACL, with no public URL. The upload/copy+DB commit needs an idempotent recovery protocol since Storage writes are outside the PostgreSQL transaction.
4. Prove a restore/read round-trip and snapshot durability **before** removing a public listing. Preserve moderation holds, report/audit/revision history, cloud retention/billing boundaries. Backups, expired subscriptions and account deletion need explicit policy.
5. 09 INT supplies a **complete** dependent Preset/ToM/native graph and atomic/fail-closed public delist; 03 COMM applies a server-side locked transaction with expectedVersion and original Creator owner checks, then denies public searches/links/media and detaches old source keys safely.
6. Re-publish must re-authorize entitlement/ownership, latest safe subject registry, 1–10 READY/CLEAR media, version provenance and immutable revision identity; it may never turn hidden/restricted content public through a stale copy.
7. Negative tests: Free/expired Cloud, other owner, moderator unauthorized restore, old-session/revoked token, concurrent publish/unpublish, partial Storage copy, failed checksum, graph UNKNOWN, active report/hold, stale expectedVersion, orphan cleanup retry, idempotent repeated request.

No evidence currently proves the above. `Unpublish and Keep Private` is **disabled**; no phantom snapshot table, no client-only Cloud claim and no entitlement bypass were introduced.

## 09 INT dependency graph — consume, not own

`private.gallery_photo_dependency_snapshot_v1(uuid)` is the authoritative service-only *negative* snapshot. Coverage for Biome/Floating Island/ToM/native listings is `unknown_not_deployed`; therefore `graphComplete=false` and `retirementAuthorized=false`. The accepted #113 trigger blocks even unlinked DELETE until old-URL proof. 03 COMM must not interpret absent tables as zero dependents or implement speculative domain joins. Native DDV-issued codes remain separate; Preset-only delist may preserve an original public Gallery photo.

Positive retirement requires 09 INT to materialize trusted registries, include public/owner revision-linked relations, snapshot and lock their versions, offer exact immutable delist transaction semantics, and reject any partial listing or published media edge surviving the change. 03 COMM is responsible for auth/session/RLS, media visibility, the Work lifecycle transaction and Cloud storage only after that handoff.

## Acceptance matrix / actual results

| Gate | Evidence | Status |
|---|---|---|
| Branch lineage (#113 on #108) | GitHub exact HEAD comparison | CONFIRMED |
| 13 real reviewed Floating Island subjects | staging SQL read | CONFIRMED |
| New subject public RPC/service-only ACL | rollback transaction | PASS |
| Unknown categories not leaked | rollback transaction | PASS |
| New media Edge response no-store | code + staging v3 deployed | DEPLOYED / real HTTP NOT_EXECUTED |
| Public subject/query Edge no-store | code + staging v6 deployed | DEPLOYED / real HTTP NOT_EXECUTED |
| Prior URL replay at 0s / 300s / expiry / CDN | no safe actor/Storage URL invocation path | NOT_EXECUTED |
| Owner/nonowner/anon/moderator signed Chrome | GitHub variables and authorized actors unavailable | CONFIGURATION_BLOCKED |
| Linked public dependency atomic retirement | 09 INT graph incomplete | BLOCKED |
| Cloud paid private durable copy+restore | entitlement/object-private store absent | BLOCKED |
| Any classified photo Delete or Unpublish | old signed URL and graph proof missing | DENIED / fail-closed |
| Product launch | independent additional gates | BLOCKED |

## Downstream contracts

- **09 INT**: keep reviewed subject registry authority and graph semantic ownership; supply the missing four exact kinds via 01D and positive all-dependent atomic retirement once deployed. The public subject picker is now available through existing `community-public-query` Edge. Never grant direct registry SQL to browsers.
- **08 WEB**: may integrate public verified subject lookup and preserve `displayName=null` gracefully (show canonical ID placeholder where needed), but must keep Delete/Cloud Unpublish disabled. Future enabled buttons require actual positive server acceptance and truthful pending/done state. No invented ToM base icon.
- **04 QR**: test live HTTP anonymous category/limit rejection and direct RPC 403/permission denial; signed A/B/Moderator end-to-end; media signed token issued before retirement and replay with exact same URL at 0, 60, 300 and beyond token expiry across warmed/unwarmed CDN nodes, caching headers, auth semantics and Storage physical-object lifecycle; verify private copy ownership/durability only after Cloud engine exists. Never mark a skipped Chrome step PASS.
- **00 CTRL**: this is bounded partial engineering progress, not a newly closable launch node. PR #108/#113/#105 remain DRAFT/DO_NOT_MERGE, and persistent DDV save writers remain disabled.

No production resources changed. No verified subject evidence was fabricated. No real user media was accessed, copied or deleted.
