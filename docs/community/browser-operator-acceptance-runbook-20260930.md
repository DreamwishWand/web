# Community Core browser/operator acceptance runbook — 2026-09-30

Status: **EXECUTION-READY / RUNTIME PENDING**

This runbook closes the procedural gap between backend/network acceptance and the required
production-shaped browser/operator acceptance for Community Core.

It does not mark the browser cases PASS by itself.

## Scope

Execute only against isolated staging.

Required internal routes:

- `/community-lab/`
- `/community-lab/recovery/`
- `/community-lab/account/`
- `/community-ops/`

Required actor labels:

- **A** — publishing owner;
- **B** — interacting non-owner;
- **M** — moderator;
- **O** — admin/operator;
- **D** — disposable account-deletion user.

Use opaque labels in evidence. Never record real email addresses.

## Preconditions

Before execution:

1. staging Edge Functions and migrations are current;
2. Security Advisor has no WARN findings;
3. branch CI is green;
4. Community worker Crons are active;
5. operator critical email remains disabled unless its transactional provider is intentionally under
   acceptance;
6. only publishable browser keys are used in the browser;
7. no service-role key, provider API key, SMTP credential, worker token or Vault secret is copied to
   browser notes or evidence.

Launch recent-auth defaults are:

- account deletion: **900 seconds / 15 minutes**;
- support/admin high-risk writes: **900 seconds / 15 minutes**.

Recent-auth is measured from `auth.sessions.created_at`; JWT refresh does not reset the window.

## Phase A — normal signup / verification / PKCE recovery

This phase requires production-shaped staging email delivery.

1. Sign up disposable A through the normal browser path.
2. Receive and complete email verification.
3. Sign in and bootstrap WandAccount + CreatorProfile.
4. Sign out.
5. Initiate normal password recovery.
6. Follow the PKCE recovery email link into the hidden recovery callback.
7. Set a new password.
8. Sign in with the new password.
9. Require the same WandAccount + CreatorProfile stable IDs.

PASS evidence:

- verification email received;
- verified sign-in PASS;
- PKCE callback PASS;
- password update PASS;
- stable account/profile IDs before/after recovery;
- no token/email address recorded in evidence.

## Phase B — A -> B -> Moderator vertical slice

Use `/community-lab/`.

Execute the existing product-shaped path in this order:

1. A stable identity/profile edit.
2. A real image prepare -> signed upload -> finalize -> signed read.
3. A Gallery draft.
4. Immutable publish.
5. PUBLIC discovery positive probe.
6. UNLISTED discovery negative probe.
7. Sign out A.
8. B stable identity.
9. B direct target read.
10. B Save.
11. B Follow.
12. B Reaction.
13. B Comment.
14. B Report.
15. B owner-mutation negative probe; all prohibited mutations must fail.
16. Sign in A or another permitted non-parent author.
17. Reply to B's stored parent comment.
18. Sign in B and confirm reply Notification after processing.
19. Sign in M.
20. Restrict the reported work.
21. Confirm discovery/access convergence.
22. Restore.
23. Sign in A.
24. Exercise visibility/unpublish/soft-delete.
25. Sign in B.
26. Confirm stale SavedItem remains a reference but is not an access grant.

Normal Comment/Reply/Reaction/Follow/Save activity must remain **in-app only**. It must not create
transactional email.

## Phase C — operator / support acceptance

Use `/community-ops/` as O.

1. Sign in with an admin account.
2. Load Security Policy and require:
   - accountDeleteRecentAuthSeconds = 900;
   - supportAdminRecentAuthSeconds = 900;
   - sessionBound = true;
   - source = auth.sessions.created_at.
3. Load Recovery cases.
4. Open a disposable `provider_recovery` case using only an opaque evidence reference.
5. Confirm the listing omits provider subject and verification-reference value.
6. Attempt Complete before Verify; require rejection.
7. Verify.
8. Complete.
9. Confirm ownership graph remains stable.
10. Review provider-cleanup dead letters if present and exercise reviewed requeue with a fixture.
11. Review retention dead letters if present and exercise reviewed requeue with a fixture.
12. Review external operator-email delivery queue.
13. Review persistent Operations Alerts.
14. Acknowledge a safe open alert.
15. Clear the underlying condition and confirm auto-resolution.
16. Recreate the condition and confirm a new occurrence.

Recent-auth negative proof:

1. use a provider session older than 15 minutes for one high-risk write;
2. require `RECENT_AUTH_REQUIRED`;
3. sign out and sign in again;
4. repeat the same high-risk write with the fresh session and require acceptance.

## Phase D — self-service deletion

Use `/community-lab/account/` as disposable D.

1. Bootstrap D.
2. Make the provider session older than 15 minutes.
3. Attempt deletion; require `RECENT_AUTH_REQUIRED`.
4. Sign out and sign in again.
5. Type exact `DELETE`.
6. Execute deletion.
7. Confirm immediate Wand tombstone/de-identification.
8. Confirm local/global browser session cleanup.
9. Confirm provider-cleanup job queued.
10. Confirm scheduled worker later removes the actual provider user and anonymizes the cleanup job.

## Phase E — operator critical email acceptance

Execute only after a transactional email provider, verified sender domain and operator recipient are
configured outside source control.

1. Keep the persistent Operations Alert as the canonical incident record.
2. Enable `operator_email`.
3. Induce one safe critical staging alert.
4. Require exactly one operator email for the occurrence.
5. Confirm the email contains only minimized operational fields.
6. Confirm no provider subject, Wizard email, raw report detail, signed media URL, password, token or
   DDV private data appears.
7. Acknowledge the alert in Community Ops.
8. Clear the condition and confirm canonical auto-resolution.
9. Recreate the condition and require a new occurrence/new email.
10. Induce a controlled mail-delivery failure.
11. Confirm the canonical Operations Alert remains.
12. Confirm the external delivery retries/dead-letters visibly in Community Ops.
13. Confirm the transport's own self-monitor alert does not recursively enter the same email queue.

The transactional email provider's own outage cannot notify through that same provider. This is an
accepted first-launch blind spot; a second independent notification channel is not launch-required
for the current single-operator workload.

## Secret-free evidence format

For every phase record only:

- timestamp;
- route;
- opaque actor label;
- relevant Community object IDs;
- operation name;
- expected result;
- observed PASS/FAIL;
- non-secret error code if failure is expected;
- cleanup result.

Never record:

- password;
- email address;
- JWT/access/refresh token;
- publishable-key value;
- service-role/secret key;
- provider subject;
- provider API/SMTP credential;
- recovery token/code;
- raw verification artifact;
- worker token;
- Vault secret;
- signed upload/read URL.

## Acceptance result

Community browser/operator acceptance is complete only when Phases A-D pass through the real browser
surface. Phase E additionally closes the operator-email launch requirement.

Backend/database PASS evidence remains valid, but it does not substitute for these browser/operator
runs.
