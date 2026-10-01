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

Cross-stream production blocker:

- 02 WEP `wep-preset-artifact` and `wep-preset-retention` on current `dev/wep-v125` still hardcode `wand-preset-artifacts-staging`;
- WEP must externalize that bucket with equivalent fail-closed behavior before production promotion;
- Community branch alone is not a complete production migration source because latest WEP Storage/retention migrations are still owned by the WEP branch.

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

The production Preset bucket externalization blocker remains OPEN in WEP; this acceptance does not close
that deployment dependency.


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
