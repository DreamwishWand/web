# Community Core launch Auth policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH BASELINE**

## v1 provider

Dreamwish Wand Community v1 uses **Supabase Auth** as the production authentication provider.

Launch sign-in baseline:

- verified email address;
- password authentication;
- email verification before the Community account is treated as launch-ready;
- PKCE password-recovery email flow;
- session-bound recent-auth for destructive/support-admin/moderation operations;
- Wand-side session cutoff in addition to provider session controls.

Social login, platform SSO and passkeys are not required for the first public release. The
provider-neutral `AuthIdentity` model remains the extension point for later providers without
changing WandAccount/Creator ownership.

Production Auth mail should use the selected Resend transactional email provider shared with operator critical mail and approved Wand transactional email. Supabase custom SMTP is the initial Auth delivery boundary; Auth verification/recovery tokens do not enter Community domain tables.

## Privacy boundary

- email is Auth-provider data, not CreatorProfile data;
- email is never a public Creator identifier;
- Community APIs use WandAccount/Creator stable IDs, not email addresses;
- support/operator listings do not expose provider subjects;
- credentials, tokens and recovery codes are never persisted in Community domain tables.

## Recovery

Normal recovery:

- Supabase PKCE password recovery.

Exceptional ownership recovery:

- Community Ops Open -> Verify -> Complete procedure;
- current strong method: `provider_recovery`;
- `linked_ddv_profile` proof disabled until CORE confirms a stable DDV Profile claim contract;
- public profile information/screenshots are not sufficient ownership proof.

## Production deployment acceptance

Before launch:

1. verify `dreamwishwand.com` in Resend; configure Supabase Auth custom SMTP with `smtp.resend.com`, sender `Dreamwish Wand <no-reply@dreamwishwand.com>`, a dedicated Auth SMTP credential, and accepted provider/rate-limit quotas;
2. enable/verify email confirmation policy;
3. execute signup -> verification -> sign-in in a real browser;
4. execute PKCE recovery end-to-end;
5. execute all-session revocation;
6. verify provider/Wand session cutoff convergence;
7. record and accept the production Auth rate-limit configuration without weakening Supabase endpoint/IP protections;
8. size aggregate Auth-email quota only after the transactional email provider and expected launch traffic are known;
9. decide CAPTCHA enablement from staging/closed-beta abuse evidence.

Staging email-provider rate limiting during repeated E2E work is not promoted into a product
semantic conclusion.


## Recent-auth launch defaults

First-launch recent-auth windows are finalized at:

- self-service account deletion: **900 seconds / 15 minutes**;
- support/admin high-risk writes: **900 seconds / 15 minutes**;
- moderator/admin moderation writes: **900 seconds / 15 minutes**.

All three remain configuration-driven for future security review, but are no longer an unresolved launch
parameter. Recent-auth proof remains bound to `auth.sessions.created_at`; refreshing a JWT does not
refresh the recent-auth clock.


## Abuse / rate-limit contract

Detailed launch boundary:

`docs/community/auth-abuse-launch-policy-20260930.md`

Endpoint/IP protection is a fixed security invariant. Aggregate email throughput is a deployment
capacity value and remains pending until the production transactional-email provider is configured.
