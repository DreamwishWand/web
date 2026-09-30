# Community Core launch security hardening — 2026-10-01

Status: **HIGH CONFIDENCE POLICY / PROVIDER CONFIGURED / RUNTIME BOUNDARY CHECK PENDING**

## Scope

This closes the Community-side launch policy for the current Supabase Auth limitation where
Leaked Password Protection is unavailable on the current project/plan.

It does **not** claim that length controls replace breached-password screening. The remaining provider
warning stays visible until the feature becomes available or the project plan changes.

## Password baseline

Launch authentication is currently verified email + password without mandatory MFA.

The Wand product/client baseline is therefore:

- minimum password length: **15 Unicode code points**;
- no mandatory uppercase/lowercase/digit/symbol composition rule;
- passphrases and password managers are supported;
- no periodic password rotation requirement;
- password changes continue to use explicit reauthentication;
- successful password recovery/change continues to revoke provider + Wand sessions.

Rationale:

- current NIST SP 800-63B guidance requires at least 15 characters when a password is used as a
  single-factor authenticator and discourages composition rules;
- current Supabase guidance recommends a large minimum length and provides leaked-password
  screening only on plans where that feature is available.

The browser staging client enforces the same 15-character minimum. Provider configuration remains
authoritative and must be set to the same or stronger minimum before public launch so direct Auth API
requests cannot bypass the product-side check.

## Existing compensating controls

Already CONFIRMED or established in the Community contract:

- mandatory email verification for launch-ready accounts;
- PKCE password recovery;
- Supabase Auth endpoint/IP and resend throttling retained;
- WandAccount-scoped Community action rate limits;
- session-bound 900-second recent-auth for destructive/admin/moderation writes;
- JWT refresh does not reset recent-auth;
- all-session revocation after password recovery/change;
- Wand-side session cutoff independent of provider JWT lifetime;
- secret/service-role keys never exposed to browser clients;
- operator critical alerts are persistent and externally delivered.

## Supabase security-change notifications

Launch default should be **ON** for all currently exposed security-change notification toggles:

- Password changed;
- Email address changed;
- Phone number changed;
- Sign-in method linked;
- Sign-in method removed;
- MFA method added;
- MFA method removed.

These are security notifications, not normal Community activity email. They are consistent with the
launch notification-channel policy that allows important Security transactional mail.

If a capability is not exposed in the product (phone auth, social login, MFA), its notification can
remain enabled; no mail is generated until that provider event can occur.

## MFA / passkeys

Mandatory MFA or passkeys are not added to the first-launch contract by this hardening step.

If later introduced, authorization must use the provider's verified assurance/session state and must
not create a second Wand identity model.

## CAPTCHA / automated signup abuse

No new CAPTCHA vendor is required solely to close this item. Existing policy remains:

- preserve provider Auth throttling;
- enable CAPTCHA before broad public exposure if staging/closed-beta abuse evidence justifies it;
- CAPTCHA is deployment protection, not identity state.

## Provider configuration acceptance

Operator-confirmed configuration on 2026-10-01:

- Supabase Auth minimum password length changed to **15**;
- no mandatory character-composition rule added;
- all seven currently exposed Supabase security-change notification toggles enabled.

Post-change Security Advisor result:

- external security WARN count remains **1**;
- the sole WARN is `auth_leaked_password_protection`;
- nine `rls_enabled_no_policy` findings remain INFO and are the intentional server-only deny-all tables already tracked by Community;
- no new security WARN was introduced by the configuration change.

Still required before public launch:

1. verify a 14-code-point password is rejected by the real Auth provider boundary;
2. verify a 15-code-point passphrase is accepted by the real Auth provider boundary;
3. confirm email verification remains mandatory during the final Auth regression;
4. confirm signup/recovery resend throttles remain active;
5. verify normal password change still requires reauthentication;
6. verify password recovery/change revokes the expected sessions;
7. optionally exercise one representative security-change notification during final Auth QA; do not create synthetic repeated mail traffic solely to test all seven toggles.

## Evidence classification

**CONFIRMED**

- current project Advisor reports Leaked Password Protection Disabled;
- the current project/plan does not expose the feature;
- email/password + PKCE recovery browser acceptance already passed;
- session-bound recent-auth and revocation paths already passed;
- browser staging client now enforces the 15-character baseline.

**HIGH CONFIDENCE**

- 15-character, no-composition launch baseline is the correct compensating product policy for the
  current non-MFA password baseline.

**CONFIRMED (operator-configured / advisor-observed)**

- Supabase Dashboard minimum password length is configured to 15;
- all seven security-change notification toggles are enabled;
- post-change Security Advisor still reports only the unavailable leaked-password-protection WARN.

**PENDING**

- real Auth provider-boundary 14/15 acceptance check;
- final Auth regression for reauthentication/revocation behavior;
- optional representative security-notification delivery check during final QA.
