# Community Core Auth abuse / rate-limit launch policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT / PROVIDER CONFIG PENDING**

## Purpose

This policy separates launch security invariants from provider-capacity tuning.

Dreamwish Wand must not weaken Supabase Auth's built-in endpoint protections in order to make
signup/recovery testing easier. At the same time, project-wide email throughput must not be frozen
until the production transactional-email provider and expected launch volume are known.

## Fixed launch invariants

- v1 public authentication is verified email + password through Supabase Auth.
- Anonymous sign-in is not part of the Community v1 launch surface.
- Email confirmation is required before a new Community identity is considered launch-ready.
- Password recovery uses the PKCE recovery path.
- Browser code uses only the publishable key; secret/service-role credentials never enter the
  browser.
- Wand-side session cutoff remains independent of provider JWT expiry.
- High-risk recent-auth remains bound to provider session creation time.
- Account deletion and support/admin high-risk operations use the finalized 900-second recent-auth
  window.
- Auth endpoint/IP protections must remain enabled at least at the effective Supabase baseline unless
  a documented security review intentionally tightens them.
- Signup/recovery resend throttling must remain enabled; repeated test execution is never a reason to
  remove the throttle in production.
- Community domain tables do not become an IP-address, password-attempt, recovery-token or CAPTCHA
  telemetry store.

## Provider-dependent values

The following are deliberately not canonical numbers yet:

- aggregate Auth email sends per hour;
- transactional-provider daily/monthly quota;
- provider burst/concurrency limits;
- optional provider-specific suppression/bounce thresholds.

These values depend on the transactional email provider, sender-domain reputation, closed-beta size
and public-launch traffic estimate.

They become deployment configuration evidence after the provider account is selected. Changing those
capacity values later must not change WandAccount/AuthIdentity ownership semantics.

## CAPTCHA / automated abuse protection

Supabase supports CAPTCHA on public Auth endpoints.

Launch policy:

- keep CAPTCHA integration available as a deployment control;
- enable it for public signup/recovery before broad public exposure if staging/closed-beta evidence
  shows automated abuse or if the chosen provider requires stronger protection;
- do not make a CAPTCHA vendor part of Community identity or ownership state;
- CAPTCHA failure must not bypass normal Supabase/Wand session authorization.

CAPTCHA provider selection is therefore an operational hardening choice, not a blocker for backend
Community acceptance.

## Enumeration / recovery behavior

Public UX must not expose support-only provider subjects or recovery evidence.

Normal recovery remains provider-controlled PKCE email recovery. Exceptional recovery remains the
admin Open -> Verify -> Complete procedure and must not be reachable through normal public command
surfaces.

## Launch acceptance

Before public launch:

1. record the actual Supabase Auth rate-limit configuration in secret-free deployment evidence;
2. confirm signup confirmation and password-recovery resend throttles are active;
3. confirm email verification is mandatory;
4. execute normal signup -> verification -> sign-in;
5. execute PKCE recovery;
6. confirm repeated resend requests are throttled rather than generating an unbounded mail stream;
7. confirm provider email quota is sized for the expected launch population;
8. confirm provider bounce/suppression behavior does not leak secrets into Community logs;
9. decide whether CAPTCHA is enabled based on staging/closed-beta abuse evidence;
10. re-run Security Advisor and the browser/operator acceptance runbook.

No provider API key, SMTP password, CAPTCHA secret, user password, recovery token or real email
address belongs in canonical evidence.
