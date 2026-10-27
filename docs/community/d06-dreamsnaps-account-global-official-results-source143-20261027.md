# DDVRE 03 COMM / D06 — Account-global Official DDV Results Disclosure Authority

**2026-10-27 / Issue #213 / based on QR #212 D06.**
**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.**
**Evidence class:** SQL/Edge Source candidate, not independently QR accepted, real signed JWT/Storage/CDN not tested. **Public Official Result Projection intentionally OFF even when consent ON.**

## Source evidence and prior work preserved

- 06G Final Stage1 Owner: ONE WandAccount-level toggle default OFF/PRIVATE applies to all historical, current and future linked DDV Profile Workspaces and all eligible imported Results. No per Entry, Work, Challenge or Field overrides. Owner-private In-Game Results remain available.
- QR #212 main HEAD 71e568c9b576c54f8d100fae2ae883c835de7602 catches per-entry UI and persisted publication SQL; source mismatch, not proven real leak.
- Owner PR #134 functional Source142 accepted HEAD 0b90e6681507a20c5cfa637752fb6c5a575c5d06, ordinary CI40295103790 and local142/bootstrap40295103855 SUCCESS; QR185/INT187 new-only legacy media SQL guard accepted locally. Docs-only Owner parent HEAD 949a9812e4b8c506006822f070ae6689f43cfb89. This child Draft is **stacked ON THAT PARENT** and does not modify earlier Source134–142 migrations, accepted negative SQL, Community Core account/identity/Work models, or Provider B gate.
- Last historic Staging managed116/21 active Edge/7 Cron; Publisher old Copy/Remove and Scene aliases active. No Staging, real actor, real provider mutation allowed by this Draft.

## Exact observed D06 ingress and public graph

1. UI main `src/routes/dreamsnaps/my/+page.svelte` uses per-entry `selectedFields[entryId]` and `setDreamsnapOfficialResultPublication({entryId,publicFields})`; 08 WEB Issue #214 owns UI removal. Not an independent backend authority.
2. `community-command` formerly forwards legacy name to `community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])`; effective Source44800 rewrites per-entry `dreamsnap_official_result_publication(public_fields,published_at)`.
3. Public `private.dreamsnap_public_official_result(uuid)` current Source44800 consults per-entry fields and `dreamsnap_official_results` source_kind save/official_evidence; used by `community_get_dreamsnap_results_public_v1` (In-Game list) and `community_get_gallery_dreamsnap_public_v1` (Gallery Detail). Those functions are SECURITY DEFINER and current public Edge invokes with service role, so RLS alone cannot enforce D06.
4. `community_search_gallery_dreamsnaps_public_v1` returns public Works/media without official numeric field; `search_documents` for native DreamSnaps contains Challenge/Comments rather than official scores; any future official sort/filter/index/cache must check account consent at query-time and invalidate server-side materialized results on OFF. The existing `community-public-query` has 30-second public cache default; D06 Source changes those DreamSnaps public result/detail/search/round routes to `private, no-store`. Previously cached responses, CDN, existing bearer and external copies remain unrecalled.
5. The owner-private `community_get_my_dreamsnaps_v1` separately reads `dreamsnap_official_results` without public helper and retains official structured data. Its historical `officialPublicFields` becomes empty once legacy rows neutralized, but 08 WEB must stop rendering per-entry controls and use new global Consent read.
6. `community_get_public_media_storage_v2`, `community_get_dreamsnap_judge_media_storage_v1` and Media/Signer paths may disclose images independently of official numeric results, subject to their separate phase/rights/embargo/privacy checks. Neither new consent OFF nor new SQL purports to revoke an already-signed bearer. Stage-only and hidden direct Caller aliases remain UNKNOWN and 09 INT/QR must independently inventory.

## Source143 bounded implementation

- Migration `20261027000000_d06_dreamsnaps_account_global_official_consent.sql` adds **exactly one** private consent row per `wand_accounts(account_id)` (not a new Work or Profile model); missing row OFF and rowVersion0, explicit OFF creates a row; ON/OFF stored as `enabled` with monotonic optimistic rowVersion. RLS enabled; PUBLIC/anon/authenticated/service_role table CRUD not granted. Expose only service-role authenticated RPCs; no direct client SQL.
- Legacy `dreamsnap_official_result_publication` flags are set empty/NULL in an idempotent migration, constrained to empty forever; its old service-role RPC is replaced with unconditional terminal `D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED`, EXECUTE revoked to service_role and other external roles. No interpretation of historical work/field flags as an Account-wide ON. Existing structured private results are never deleted or copied into a new result table.
- `community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)`: normal session authorization on OFF; actual `private.require_recent_session` with max300s and explicit whole-account disclosure acknowledgement on ON; active Identity, account row lock, Phase1 suppression ON veto under lock, single Account CAS/rowVersion, audit event. No EntryID/Field/Challenge input. Stale or cross-account attempts are terminal, no retry overwrite. ON expresses consent only.
- `community_dreamsnap_get_account_official_result_consent_r20(uuid)`: service-only owner query with explicit default OFF, rowVersion0, scope all linked current/future Profiles, and truthful `publicProjectionAuthorized=false`. The Source `community-query` uses authenticated session recheck and `private,no-store`.
- Public Source44800 successor `private.dreamsnap_public_official_result(uuid)` requires existing matching Account consent (plus not managed-under13 and eligible Entry) but **ALWAYS returns NULL** until independently proven exact judged-image binding, source provenance, phase, rights, active linked DDV Account/Profile association, privacy and minor protections are implemented and QR-accepted. No new public Result claims or new sorter are enabled by global ON. Source community-public-query results/detail/search/round data are `private,no-store` going forward. The method is intentionally a hard stop and must **not** be interpreted as finished positive official-results publishing.
- Edge `setDreamsnapOfficialAccountConsent` strictly validates enabled boolean, nonnegative safe integer CAS version, acknowledgment for ON, JWT subject/iat/session_id and RPC; legacy Entry name hard-denies before invoking RPC. Source type mapping still preserves legacy name for backward-compatibility failure (old clients get 409, not a new disclosure). ON cannot pass session-less tests. No safe positive UI toggle until 08 WEB consumes truthful `publicProjectionAuthorized=false`.

## Evidence matrix / QR independent contract

| Scenario | Required outcome |
| --- | --- |
| Fresh active Account, zero row | get enabled=false/rowVersion0; no public claims |
| A and B linked Workspace or newly imported result under same Account | single global row inherited, never field-scoped; no automatic public projection |
| Legacy per Entry nonempty fields / old Edge command / direct SQL privileged call | migration clears flags, invariant CHECK blocks new fields and legacy RPC terminal denies, no implicit ON |
| ON without acknowledgment / recently verified session | terminal fail; ON requires session-bound 300s reauth and explicit confirmation; UNKNOWN JWT/session => fail |
| OFF then concurrent ON/OFF, stale version, old Identity/retired/Privacy | serialized Account lock + CAS; Phase1 veto on ON; old/mismatched actor cannot change another Account |
| Consent ON but no judged-image binding, mismatched historic imported value or managed-under13 | `private.dreamsnap_public_official_result` returns NULL in EVERY case |
| Published Work/official Score in Results, Gallery Detail, Search/Sort/Filter and direct SECURITY DEFINER | no official field claims; entry count no secret aggregate; new public query no-store |
| Independent Owner-private `myDreamsnaps` Results | score/rank/reward owner-visible regardless of global OFF (authorization still required) |
| Existing pre-issued signed Storage URL/CDN/old 30-second Edge cache | **NOT_REVOKED by Source; REAL SIGNED acceptance BLOCKED** |
| Unverified Stage-only Scene/Cloud/Media readers and Privileged SQL | UNKNOWN; treat as release NO-GO, not a Source143 PASS |

Owner source static tests: `tests/community-d06-account-global-official-consent-contract.test.mjs`.
Isolated actual local PostgreSQL two-backend negative fixture: `tests/comm-d06-account-global-consent-two-session.py` (the ON positive is intentionally not tested with a real authenticated recent Provider session). Source143 exact migration and local bootstrap must PASS before source-only acceptance. Existing Source142 function definitions were not changed; workflow's migration count adjusts to 143 and keeps previous 31 additive replays plus two D06-specific same-schema replays. Historical SQL acceptance remains historical; do not infer signed Staging acceptance from CI.

### Handoff 09 INT (new-only)

Cross-product issued-work projection census: `community-public-query`, `community-query`, `community-command`, direct `SECURITY DEFINER`, Search/Index/Sort/Challenge/Work Detail, Gallery/native media signer, DreamSnaps judged-media/old bearer, Cloud linked-profile/Creator/Legal, cache/materialized responses. Enumerate all Source and active Stage-only signatures/overloads and direct service-role callers; prove no bypass of global OFF. Audit lock ordering against R12 Privacy and moderator/reassignment transitions, imported result Work binding and linked Profile addition/retirement; zero public result fields on unknown Account. R17/Provider B previously accepted scopes NOT rerun. Unknown stage issuer => graphComplete=false.

### Handoff 04 QR (new-only)

Pin corrected Owner child Draft exact HEAD and frozen accepted parent Source142. Independently inspect effective migration ordering, SQL helper final body, auth/ACL/trigger/constraints, 2-PG account OFF/CAS/legacy negative, real private owner results, privacy suppression, retired Identity, managed minor, strict no-public projection including direct SQL/public index/Sort, stale cached response. The existing 06G requirement permits public disclosure only with independently proven image/evidence binding and rights: current Source candidate deliberately **fails closed even when ON**, therefore D06 positive release remains PARTIAL/BLOCKED. Real signed A/B/Moderator M, actual multi-linked-profile imported historic match, old URL/CDN, browser 8 locales and legal review require Gate #130 and a separately accepted positive authority. No interpretation of QR #212 old source RED as signed runtime leak.

**Release:** Source142/Provider B unchanged; Public Positive Publish, Incidents Resolution, Physical Cleanup, Cloud Restore and DDV Native Writer/Apply OFF. R17 ProductTree30 PASS0/PARTIAL12/BLOCKED18, seven content/human/privacy/legal/ops gates blocked. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
