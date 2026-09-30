# Community Core Auth signup runtime — 2026-10-01

Status: **CONFIRMED FUNCTIONAL / REDIRECT + INBOX PLACEMENT PARTIAL**

## Scope

Real staging email/password signup using Supabase Auth custom SMTP through Resend.

## Observed

CONFIRMED:

- normal email/password signup accepted;
- email confirmation remained required (no immediate authenticated session);
- confirmation email was sent from `Dreamwish Wand <no-reply@dreamwishwand.com>`;
- Resend provider status was `delivered`;
- user received the confirmation email;
- confirmation link verified the email successfully;
- password sign-in after confirmation returned a valid authenticated session;
- Community branch normal-signup UI/client path now exists;
- branch push CI passed for the signup implementation.

PARTIAL:

- iCloud placed the confirmation email in Junk;
- the current Supabase Auth Site URL redirected the successful confirmation to `http://localhost:3000`, which is not a production-shaped callback.

PENDING:

- set a real staging/public Site URL and allowed redirect URLs;
- repeat one confirmation flow against the corrected redirect;
- execute PKCE password recovery end-to-end;
- recheck iCloud inbox placement after DMARC propagation/reputation improves.

## Evidence boundary

No email address, password, access token, refresh token, confirmation token or provider credential is
stored in this document.
