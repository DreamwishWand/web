# 02 WEP — R18-work Distinct Scene Preset Product Issuer Source Fail-closed

Date: 2026-10-26 JST. Workstream: existing 02 WEP. Release remains R17. Scope: Source-only alternate Edge issuer.

## Evidence and platform
- CONFIRMED directly read-only fetched ACTIVE Supabase Staging `wep-scene-preset-product` version 1; ezbr SHA256 `6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045`; JWT verification enabled.
- Staging v1 `prepare` signs upload; `publish` validates Scene, copies Staging to `published/{account}/{sha256(account:idempotency)}.json` before `community_publish_scene_preset_product_v1` SQL; SQL error invokes published remove; SQL success removes staging; `unpublish`/`delete` invoke separate Scene lifecycle SQL; `discard` removes Staging after committed-only artifact_blobs lookup; `read` signs a scene object. LIVE BUNDLE SOURCE, not proof of actual user-impact runtime incident.
- Owner PR #134 Source135 exact pin `a0e9063af96b28b069fd92b7a9f16261fa8990a4`, 02990 Lease/Readback candidate. Source135 path `supabase/functions/wep-scene-preset-product/index.ts` returned NOT_FOUND before this isolated addition. Source135 old preset Artifact Publisher is deliberately blocked. Source135 R18 Reservation/fence does not, by itself, authorize or protect unregistered alternate legacy route.
- Same Published Key namespace with `wep-preset-artifact`; cross-route same-key copy/compensation interleaving is HIGH CONFIDENCE SOURCE HAZARD, not proven real Provider race or actual deletion.
- Product native scope Switch DDV v1.25.0 BID `52BD625D9B4E0053`, schema624. Switch v1.25.3 schema626 READ ONLY, Steam native writer unsupported.
- Staging historical managed migration ledger 116, Source135 migration set 135. Semantic deployment parity is BLOCKED, no migrations deployed.

## Source Caller/Route inventory
| Source135 path | Observation |
|---|---|
| `src/lib/community/staging-http-client.ts` line 508 | `preset(...)` calls `#edge('wep-preset-artifact',...)`; NOT the distinct Scene Product route |
| `src/lib/wep/preset-community-bridge.ts` lines 173,204,215 | `preset('prepare'/'publish'/'discard')` via shared `community.preset` |
| `src/lib/wep/preset-community-bridge.ts` lines 347,467 | `preset('read'/'revisionReadiness')` via existing transport |
| `supabase/functions/wep-preset-artifact/index.ts` | Existing Owner Source135 reservation, inspection and safe reader; no alternate Scene Product issuer |
| `supabase/functions/wep-scene-preset-product/index.ts` | ABSENT in Owner135 exact pin; added only in this isolated WEP branch |
| `community_publish_scene_preset_product_v1`, `community_unpublish_scene_preset_v1`, `community_delete_scene_preset_v1` | deployed v1 caller names, not proof of Source135 SQL guard/permission closure |

Bounded source files and default-branch GitHub code-search for these alternate identifiers produced no positive alternate caller. Full deployed 21-issuer semantic census remains OWNER/09 INT responsibility; an absent search hit is not a global nonexistence proof.

## Stub behavior
- Keep original alternate slug but no positive route, and do not register new SQL/RPC permissions.
- `withSupabase({auth:'user'})` and `community_authorize_session` check subject, iat, active Account and revoked Session before reading body.
- Invalid / cross-account Staging or Published keys deny HTTP 403; malformed UUID/inputs 400; missing/revoked identity 401; unsupported methods 405.
- Creator ownership checked read-only against `creator_profiles.owner_account_id`; missing/foreign denied 403 before disabled publish.
- `prepare` denies 409 without signed upload, `publish` denies 409 without COPY, `unpublish`/`delete` deny 409 without lifecycle RPC, `discard` denies 409 without REMOVE, compensation aliases deny 409 without REMOVE.
- The distinct `read` alias is disabled 409; existing R15 read-only consumers remain on prior `wep-preset-artifact`/Community route and are not modified.
- No Storage.copy, Storage.remove, signed Storage, or other positive RPC calls in this stub.
- Denials use private no-store responses; validation does not imply authority. Existing source positive Preset publishing still OFF; no loss of existing R15 Reader route.
- Security caveat: Stub exists only in isolated GitHub source; live active Staging v1 code remains unchanged and risky until operator-approved coordinated rollout and provider tests. Source-only denial CANNOT stop still-deployed issuer.

## Test acceptance boundary
`tests/wep-r18-scene-product-issuer-edge-handler.test.mjs` dynamically transpiles the actual TypeScript Handler. Storage is a throwing sentinel; mock RPC only `community_authorize_session`; creator ownership lookup is read-only. Covers same-key parallel Publisher denials, no failed SQL compensation unlink, no Scene lifecycle RPC, no Staging Discard or cross-account path, signed revoked Actor, foreign Creator, read alias unavailability, upload suspension and no positive RPC. Test harness is MOCK; cannot prove actual Provider atomicity, Stage JWT, byte SHA/CDN or deployment parity.

## Integration conditions / handoffs
**03 COMM OWNER**: Preserve stronger Source135 Lease/Reservation and 02990 private-gated candidate; never cherry-pick Source133 PR154 whole Edge. Own SQL service-only terminal guards covering legacy Scene Product publish/unpublish/delete and aliases, full 21-issuer registry; no DB-only after-Copy guard is sufficient. Adopt distinct route shutdown through reviewed deployable Source under Ops #130; later Provider immutable conditional-copy receipt, trusted independent binary SHA/version/ETag, lease-fenced commit, same-key multi-endpoint exclusion and recovery/quarantine+legal-hold reference-aware cleanup. Keep positive flags OFF.
**09 INT**: Cross-entry same owner/idempotency shared Published-key: alternate Scene Product copy(A) vs artifact route publish(B); SQL-fail compensation(A) while B commits; both aliases Discard vs copy-before-register; reused idempotency with different hash; revoked owner/creator; history/Cloud refs and stale lease replay. Independent exact new Edge Source vs negative two-backend tests; do not re-run accepted R11-R17 or treat mock as real Provider.
**04 QR**: Source135 vs managed Staging116 and live alternate Scene v1, old artifact v14, retention v6, community-command v30 / community-retention v12 issuer parity; actual deployment closure requires Operator Issue #130, signed OwnerA/B/ModeratorM, JWT/RLS, stored bytes SHA/etag, old bearer/CDN expiry t0/60/300/post, recovery, backup/PITR/legal hold. Do not deploy without approval; no Stage mutation performed.
**00 CTRL**: This is not Release R18. R17 30 nodes PASS0/PARTIAL12/BLOCKED18. All Draft DO_NOT_MERGE/DO_NOT_DEPLOY, SOURCE_FULLY_ENROLLED=0, graphComplete=false, retirementAuthorized=false, saveRevisionAuthorized=false, pairedGalleryPublishAuthorized=false, physicalCleanupAuthorized=false. Native DDV Save/Apply, Gallery/Cloud retention cleanup OFF.

Parent Source135 exact pin only; PR #135/#147 read-only, PR #154 frozen Source133, Scene Save Revision, Native DDV Writer untouched.
