# Community Core closure handoff — 2026-10-01

Status: PRIMARY + CLOSURE BROWSER ACCEPTANCE CONFIRMED

## Confirmed browser acceptance

Primary one-shot suite PASS:
- A/B/M/O/D real Supabase password sessions.
- A stable WandAccount + CreatorProfile.
- Signed media upload -> finalize -> authorized read.
- Gallery draft -> publish -> read -> public discovery.
- B Save / Follow / Reaction / Comment / Report.
- Non-moderator moderation denied 403.
- Moderator queue omitted reporter account identity.
- Moderator restrict -> search removal -> restore.
- A reply and notification convergence.
- Operator security policy: 900s account/admin/moderation recent-auth, session-bound.
- Non-admin admin operation denied 403.
- Operator action-rate policy read.
- Operator retention hold add/release.
- D self-delete; old JWT rejected; scheduled provider cleanup removed provider user.
- A visibility -> private removed discovery.

Closure suite PASS:
- PRIVATE direct read denied to B.
- stale SavedItem preserved with accessible=false.
- UNLISTED absent from discovery but direct authenticated access allowed.
- PUBLIC returned to discovery.
- B visibility/unpublish/delete owner mutations denied 403.
- report action limiter produced HTTP 429 RATE_LIMITED after 12 accepted reports with retry metadata.
- moderation cleanup closed linked reports and restored work.
- intentionally invalid publish returned 400 COMMAND_FAILED.
- failed-publish draft remained draft with no published revision.
- Community Ops read surfaces for recovery, provider cleanup, Operations Alerts, external delivery, retention jobs and retention holds all returned with real admin session.
- owner unpublish removed discovery/access while preserving stale SavedItem.
- owner soft delete removed access/discovery while preserving history semantics.

Backend follow-up:
- acceptance target work is deleted.
- newest failed-publish fixture remains draft with current published revision null.

## Auth / email current staging state

- Supabase Site URL: https://dreamwishwand.com
- temporary localhost recovery Redirect URL removed after PKCE acceptance.
- real signup -> confirmation -> sign-in PASS.
- PKCE recovery -> password update -> new-password sign-in PASS.
- confirmation email initially landed in iCloud Junk.
- recovery email later landed in iCloud Inbox.
- Cloudflare DMARC Management enabled with monitoring policy p=none.
- operator moved Junk-classified messages to Inbox and added ops@dreamwishwand.com to contacts.
- Resend domain dreamwishwand.com verified; SPF/DKIM verified.
- operator critical email transport/retry/recurrence confirmed; inbox placement still monitored.
- Supabase Leaked password protection is unavailable on the current project/plan.
- Supabase Security notification toggles are operator-confirmed ON for Password changed, Email address changed, Phone number changed, Sign-in method linked, Sign-in method removed, MFA method added, and MFA method removed.

## Repo / CI

Branch: dev/community-core-v0-20260930

Latest observed CI:
- push run #792 SUCCESS
- PR run #793 SUCCESS
- HEAD at that check: b3124c6c83dce4f1101f5331d16e54822e83755a

Browser runtime evidence:
- docs/community/community-browser-acceptance-20261001.md
- docs/community/auth-signup-runtime-20261001.md
- docs/community/operator-email-runtime-20261001.md
- docs/community/staging-acceptance-matrix-20260930.md

## Remaining Community release-critical work

1. **COMM side of the Scene Preset reuse vertical is CLOSED.** WEP runtime evidence now confirms validated Scene payload -> Community publish -> public discovery -> Library Save/query -> Preset detail -> signed ArtifactBlob read -> byte/SHA verification -> WEP revalidation -> destination preflight. Persistent Apply remains blocked by the WEP/Core DDV writer boundary and is no longer a Community implementation blocker.
2. Final launch privacy/legal/product approval remains open. The technical/policy split is now explicit in `docs/community/privacy-retention-launch-review-20261001.md` and `ops/community-retention-launch-review.json`; D1-D8 remain PENDING. The 30-day content / 365-day operational values remain engineering defaults, not legal conclusions.
3. Preserve backend-confirmed support Open -> Verify -> Complete procedure; re-exercise in operator UI only if release QA requires it.
4. Continue low-volume transactional-email inbox-placement monitoring while the new sender domain builds reputation. Latest existing-traffic observation: 5 sent / 5 provider-delivered / 0 bounced / 0 failed / 0 complained, with no synthetic warmup traffic. Inbox-vs-Junk placement remains PARTIAL.
5. Security hardening provider configuration is operator-confirmed. The real Auth provider boundary now rejects 14 and accepts 15, and provider-global + Wand session revocation is runtime-confirmed. The remaining Auth launch item is one representative signed-in reauthentication nonce -> password change -> all-session revoke flow using a real QA mailbox; no synthetic mail is generated solely for checklist closure.
6. Final cross-product/no-direct-SQL release-gate rerun after Product/WEP integration is complete. Do not rerun completed Community browser suites unless relevant code/config changed or regression evidence exists.

Do not redo the completed browser suites unless a regression or relevant code/config change requires it.


## Production operations / recovery checkpoint

Status: **STATIC CONTRACT IMPLEMENTED / PRODUCTION ENVIRONMENT + RESTORE DRILL PENDING**

Community production operations are now defined in:

- `ops/community-production-operations.json`;
- `scripts/verify-community-ops-readiness.mjs`;
- `docs/community/production-operations-backup-recovery-20261001.md`.

CONFIRMED repository hardening:

- production and staging must use distinct Supabase project refs;
- current Free `dreamwish-wand-staging` is not accepted as production backup evidence;
- DB and Storage object recovery are separate launch requirements;
- production migration replay requires the final integrated source tree;
- duplicate production migration versions are rejected in CI;
- staging-only SQL under `supabase/migrations` is rejected in CI;
- duplicate migration prefix `20260930081500` was corrected by moving support recovery verification to `20260930081600`;
- temporary one-time pg_net Auth-E2E SQL was moved from `supabase/migrations` to `supabase/staging`;
- current production migration audit: 51 SQL migrations, duplicate version count 0, staging-only migration count 0;
- `community-media` and `community-retention` require an explicit `COMMUNITY_MEDIA_BUCKET` outside the known staging project;
- `community-ops-email` and `community-ops-escalation` require `DREAMWISH_ENVIRONMENT` outside known staging.

Cross-stream production state:

- **CLOSED:** 02 WEP externalized Preset Storage bucket selection through a shared resolver;
- production/non-staging requires `WEP_PRESET_ARTIFACT_BUCKET`;
- non-staging cannot use `wand-preset-artifacts-staging`;
- known staging keeps its current private bucket without a rename/migration;
- deployed staging readback confirms `wep-preset-artifact v14` and `wep-preset-retention v6`;
- Community branch alone is still not a complete production migration source: final production replay must use the final integrated source tree.

Production release verifier:

`npm run verify:community-ops -- --require-ready`

must remain failing until a distinct production project exists, backup/restore + secret-rotation acceptance is complete, final integrated migration replay is proven, and all cross-stream blockers are CLOSED.

No production project, Supabase branch, paid-plan change, backup add-on or PITR add-on was created by this work.


## Privacy / retention review checkpoint

Retention launch approval is now a machine-enforced release gate:

- engineering packet: `docs/community/privacy-retention-launch-review-20261001.md`;
- decision state: `ops/community-retention-launch-review.json`;
- production verifier refuses `--require-ready` while the review is not approved.

The packet explicitly distinguishes immediate account/public removal, 30-day content-payload purge,
365-day operational-detail scrub, retention holds, structural tombstones and separate backup/provider
copy retention. It does not describe the 30-day content timer as an account-recovery entitlement.


## Road-inclusive Scene delta acceptance — 2026-10-01

**CONFIRMED:** WEP HEAD `4af63c9fc9a6a2a6954e0a5bdd6d4df54a678c28` changed the Scene
portable envelope by adding Core-backed Road topology. COMM therefore ran only the integration-sensitive
delta acceptance, not the already-closed primary/closure browser suites.

Live staging PASS covered real Auth disposable actors, signed upload, server validation, PUBLIC publish,
public discovery, second-user Library Save, signed ArtifactBlob read, SHA-256/byte-size verification and
Road network `r0` round-trip. The temporary harness completed HTTP 200 and was immediately restored to
JWT-required HTTP 410 `STAGING_E2E_DISABLED`.

WEP CI `36796732109` independently confirms Road-aware WEP revalidation/preflight, with
`ROAD_TOPOLOGY_APPLY_UNAVAILABLE` and `writeReady=false`. Persistent Apply remains outside COMM and
blocked by Core/WEP writer authorization.

Evidence:
- `docs/community/wep-road-integration-acceptance-20261001.md`
- `ops/community-wep-road-integration-acceptance-20261001.json`

The production Preset bucket externalization dependency is now CLOSED separately. No Scene or retention rerun was required because only environment selection changed and known-staging behavior remained identical.


## Auth provider-boundary / revocation checkpoint — 2026-10-01

**CONFIRMED RUNTIME:** a disposable provider fixture proved 14-character rejection and 15-character
acceptance without generating Auth email. The accepted account established two real provider sessions.
Provider global logout invalidated the second refresh token; the independent Wand cutoff rejected the
other old JWT with `SESSION_REVOKED_OR_INVALID`; a fresh password sign-in after cutoff succeeded.

The fixture completed normal account deletion. Provider users and fixture handles are absent; one
AccountDeletionEvent and its two future retention jobs remain by policy. One
`auth.sessions_revoked` AuditEvent was observed.

The temporary `community-auth-acceptance` function was restored to HTTP 410
`STAGING_AUTH_ACCEPTANCE_DISABLED` after the run.

Remaining Auth launch gate: one real mailbox-backed signed-in reauthentication nonce -> password
change -> provider/Wand all-session revocation acceptance. Do not create synthetic reauthentication
mail solely to warm or pad deliverability statistics.

Evidence:
- `docs/community/auth-provider-boundary-revocation-runtime-20261001.md`
- `ops/community-auth-launch-review.json`


## WEP Preset artifact bucket closure — 2026-10-01

**CONFIRMED:** the previous WEP production bucket hardcode blocker is CLOSED.

Current WEP source `c396413dc349829bc91f89b397321de38b55a3ba` routes both Preset Edge
Functions through one shared environment resolver. Production requires
`WEP_PRESET_ARTIFACT_BUCKET` and fails closed if it is absent or points at the staging bucket.
Known staging retains `wand-preset-artifacts-staging` only by explicit project-ref recognition.

Live staging readback confirms the new resolver is deployed in `wep-preset-artifact v14` and
`wep-preset-retention v6`, while the bucket remains private / JSON-only / 25 MiB.

No Community retention implementation was changed, and neither retention E2E nor the Scene reuse
vertical was repeated.


## Final integration / release-evidence hardening — 2026-10-01

03 COMM can now fail closed before production even though the production project does not yet exist.

Added:

- `ops/community-production-release-evidence.json`: one machine-readable index of closed and
  outstanding Community production launch gates;
- `scripts/verify-community-integrated-production-tree.mjs`: protects final integrated migration
  replay from stale WEP/COMM branch composition;
- `ops/community-integration-merge-risk-20261001.json`: pins the current branch-divergence hazards;
- `docs/community/final-integrated-production-tree-preflight-20261001.md`: operator/integration
  contract.

Static branch audit found one concrete integration hazard that must remain blocked:

- WEP carries an older Community migration snapshot containing support-recovery at
  `20260930081500` and two one-time staging pg_net migrations under `supabase/migrations`;
- COMM has already corrected that state to support-recovery `20260930081600` and moved the pg_net
  SQL under `supabase/staging`;
- final integration must preserve the COMM canonical replay fixes while also adding the three WEP
  Preset production migrations + new bucket resolver/functions.

Normal COMM CI accepts an entirely unintegrated Community-only tree, but fails a partial WEP
production integration. RC/production must run the integrated-tree verifier with
`--require-ready`.

No branch merge, production project, production migration replay, paid-plan change or runtime
Community browser suite was performed by this hardening step.


## 03 COMM 3 final release-gate delta — 2026-10-01

### 1. Auth final QA

**PENDING — operator/manual acceptance only.**

Already closed and not rerun:

- provider 14-character rejection / 15-character acceptance;
- provider global refresh revocation;
- independent Wand session cutoff;
- old-JWT rejection;
- fresh sign-in after cutoff.

Remaining flow only:

`real signed-in QA session -> reauthentication nonce -> password change -> provider global revoke -> Wand session cutoff -> old session rejected -> fresh sign-in succeeds`.

This requires a real QA mailbox. Synthetic reauthentication mail is prohibited.

### 2. Retention approval

**ENGINEERING CLOSED / APPROVAL PENDING.**

Engineering implementation/runtime evidence is complete and does not need reimplementation or a
retention-E2E rerun before policy approval.

Separate approval state:

- Product: PENDING;
- Privacy: PENDING;
- Legal: PENDING.

Current 30-day content / 365-day operational values remain engineering defaults and are not legal or
policy conclusions.

Evidence:
- `ops/community-retention-approval-state.json`;
- `docs/community/retention-final-approval-packet-20261001.md`.

### 3. Resend / email evidence

Provider evidence remains:

- sent 5;
- delivered 5;
- bounced 0;
- failed 0;
- complained 0;
- delivery-delayed 0;
- delivery rate 100%.

`dreamwishwand.com` remains verified with sending enabled in ap-northeast-1.

Provider delivery is CLOSED for the current sample. Human Inbox-vs-Junk placement remains PARTIAL.
No synthetic warming was generated.

### 4. WEP integrated-tree dependency

**CONFIRMED STATIC:** current WEP branch now preserves the canonical Community migration cleanup:
support-recovery `81600`, pg_net SQL under `supabase/staging`, plus all three WEP Preset
production migrations and environment-aware Edge bucket resolver.

**OPEN:** WEP production migration
`20260930124055_wep_preset_artifact_storage_v0.sql` still inserts
`wand-preset-artifacts-staging`.

Therefore:

- Edge-function bucket externalization remains CLOSED;
- production bucket **migration provisioning** is OPEN;
- final integrated production replay must not create/use the staging bucket;
- Scene reuse and ArtifactBlob retention runtime semantics remain CLOSED and were not rerun.

### 5. Production-only pending gates

Still require a distinct production environment or final release integration:

- distinct production Supabase project;
- final integrated source tree;
- fresh integrated migration replay;
- DB backup mechanism + restore drill;
- Storage backup mechanism + restore drill;
- controlled secret rotation;
- production function allowlist / staging denylist verification;
- production Cron/Vault inventory;
- production smoke;
- production Security Advisor.

Staging evidence cannot satisfy these gates.

### 6. Final `--require-ready` blocker

`ops/community-production-release-evidence.json` now separates:

- `already_closed`;
- `staging_only`;
- `production_only_pending`;
- `approval_pending`;
- `operator_manual_pending`;
- `cross_stream_pending`.

Current `launchReady=false` is correct.

Production `npm run verify:community-ops -- --require-ready` must remain failing until every required
gate is satisfied, all Product/Privacy/Legal retention approvals are explicit, the mailbox-backed
Auth flow passes, and the WEP production bucket migration blocker is closed.


## WEP production migration provisioning closure — 2026-10-01

**CONFIRMED STATIC / CLOSED:** WEP production migration provisioning no longer creates
`wand-preset-artifacts-staging`.

- production migration SHA:
  `099d7d4f6a653b1268596ab9a12d470e8b6760a2`;
- staging-only bootstrap SHA:
  `e3af6f5d019365f4dfc507d27e37a0b6810e2b16`;
- current integrated-tree verifier SHA:
  `006b02f70d2d99761a07f2eca62443e8609d720c`.

The production migration retains the generic `preset_artifact_prepare` rate policy only.
Known staging bucket bootstrap now lives under `supabase/staging`.

No Community transport, Scene reuse, signed-read, retention, or Apply semantics changed. Those
runtime suites were not rerun.

Remaining launch blockers are now Auth mailbox QA, Product/Privacy/Legal retention approvals,
human mailbox placement, and production-only environment/replay/backup/restore/rotation/inventory/
smoke/Security-Advisor gates.


## Remaining launch-gate refresh — 2026-10-01 18:25 JST

No completed backend/browser/Auth-boundary/retention-runtime suite was rerun.

**Auth:** one gate remains only — real signed-in mailbox session -> reauthentication nonce ->
password change -> provider global revoke -> Wand cutoff -> old session rejection -> fresh sign-in.
This is operator/manual QA and cannot be replaced with synthetic email.

**Retention:** Engineering remains CLOSED. Product / Privacy / Legal remain PENDING under the explicit
D1-D8 approval matrix. 30/365 remain engineering defaults only.

**Email:** existing traffic remains 5 sent / 5 delivered / 0 bounce / 0 failure / 0 complaint /
0 delay. Human Inbox-vs-Junk placement remains PARTIAL. No synthetic warming.

**Security Advisor:** current staging still reports the known unavailable
`auth_leaked_password_protection` warning plus the intentional server-only RLS INFO findings. The
unavailable warning is not an engineering blocker. Production Security Advisor acceptance remains a
separate production-only gate.

**WEP:** latest observed WEP HEAD
`02ca57a8d48d2b5623e034b91e9cd52f7fe7a8d8` changes GridData/full-design placement preflight and
authoritative capture bounds. It does not change Community transport or Preset Edge Functions.
Therefore the already-confirmed Preset publication/Library/signed-read vertical remains valid and no
integration-sensitive rerun is required at this checkpoint. Persistent Apply remains Core/WEP
writer-gated.

**Production:** no production project has been created. Distinct environment, final integrated
migration replay, DB/Storage restore drills, secret rotation, Function/Cron/Vault inventory,
production smoke and production Security Advisor remain pending. Staging evidence is not promoted.

Current release state remains `launchReady=false` and production `--require-ready` blocked.
