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
- Supabase Security notification toggles observed OFF: Password changed, Email address changed, Phone number changed, Sign-in method linked, Sign-in method removed, MFA method added, MFA method removed.

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

1. WEP integration: validated Preset payload -> Community publication -> Library -> read -> preflight -> apply.
2. Final launch privacy/legal approval of 30-day content / 365-day operational retention defaults.
3. Preserve backend-confirmed support Open -> Verify -> Complete procedure; re-exercise in operator UI only if release QA requires it.
4. Continue low-volume transactional-email inbox-placement monitoring while the new sender domain builds reputation.
5. Finalize production security-hardening choices for unavailable Leaked password protection and currently disabled Supabase security-notification toggles.
6. Final cross-product/no-direct-SQL release-gate rerun after WEP/product integration is complete.

Do not redo the completed browser suites unless a regression or relevant code/config change requires it.
