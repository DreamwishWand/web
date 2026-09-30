# Community Core Auth signup runtime — 2026-10-01

Status: **CONFIRMED SIGNUP + PKCE RECOVERY / INBOX PLACEMENT MIXED**

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

Additional CONFIRMED runtime acceptance:

- Supabase Site URL was corrected from the localhost default to `https://dreamwishwand.com`;
- an exact staging-only recovery redirect `http://localhost:8765/recovery/` was allow-listed;
- a real password-recovery email was sent from `Dreamwish Wand <no-reply@dreamwishwand.com>`;
- Resend provider status was `delivered`;
- the password-recovery email reached the user's normal Inbox rather than Junk;
- the recovery link returned to the local staging callback;
- PKCE authorization-code exchange succeeded in the same browser;
- password update succeeded;
- sign-in with the new password succeeded;
- the temporary hosted Auth acceptance Edge surface was returned to HTTP 410 after use.

INBOX-PLACEMENT STATUS:

- signup confirmation: delivered by provider but filtered to iCloud Junk;
- password recovery: delivered by provider and placed in iCloud Inbox;
- deliverability is therefore improving but should remain monitored while the new sending domain establishes reputation and DMARC reports accumulate.

PENDING:

- repeat a signup confirmation flow against the corrected production Site URL when the public callback surface is deployed;
- remove the temporary localhost recovery allow-list entry after browser acceptance is complete;
- continue DMARC/inbox-placement observation before launch.

## Evidence boundary

No email address, password, access token, refresh token, confirmation token or provider credential is
stored in this document.
