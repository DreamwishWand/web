# Community Core launch Auth policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH BASELINE**

## v1 provider

Dreamwish Wand Community v1 uses **Supabase Auth** as the production authentication provider.

Launch sign-in baseline:

- verified email address;
- password authentication;
- email verification before the Community account is treated as launch-ready;
- PKCE password-recovery email flow;
- session-bound recent-auth for destructive/support-admin operations;
- Wand-side session cutoff in addition to provider session controls.

Social login, platform SSO and passkeys are not required for the first public release. The
provider-neutral `AuthIdentity` model remains the extension point for later providers without
changing WandAccount/Creator ownership.

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

1. configure production email sender/domain and provider quotas;
2. enable/verify email confirmation policy;
3. execute signup -> verification -> sign-in in a real browser;
4. execute PKCE recovery end-to-end;
5. execute all-session revocation;
6. verify provider/Wand session cutoff convergence;
7. set production abuse/rate limits for signup, login, recovery and verification.

Staging email-provider rate limiting during repeated E2E work is not promoted into a product
semantic conclusion.
