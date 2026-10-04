# Community Auth final signed-in reauthentication mailbox runbook — 2026-10-01

Status: **COMPLETED / CONFIRMED PASS**

## Completion

The single representative mailbox-backed QA transaction completed successfully on 2026-10-01.
Canonical runtime evidence is recorded in
`docs/community/auth-final-mailbox-reauth-runtime-20261001.md`.

Do not repeat this transaction for checklist closure, sender warming, or duplicate mailbox evidence.
Reopen only if the Auth/session/mail transport contract materially changes.

## Purpose

Close the only remaining Community Auth launch item after the provider 14/15 boundary and
provider/Wand revocation regressions passed.

This run is intentionally mailbox-backed. It must not be repeated for domain warming or to test all
security-notification toggles.

## Preconditions

- use the real staging project;
- use one QA account whose mailbox can be inspected by the operator;
- password is at least 15 Unicode code points;
- establish two independent provider sessions, A and B;
- both sessions can reach a normal Community query before the test;
- record no email address, password, access token, refresh token, OTP/nonce or provider subject in
  canonical evidence.

## Execution

1. In session A, invoke the product's signed-in reauthentication action.
2. Confirm exactly one reauthentication Auth message is requested.
3. Observe provider delivery and human mailbox placement (Inbox/Junk) without copying the OTP into
   canonical documentation.
4. Enter the received nonce in the product reauthentication/password-change flow.
5. Set a new password that satisfies the 15-code-point baseline.
6. Confirm password update succeeds.
7. Allow the existing product flow to run provider global logout followed by Wand
   `revokeSessions`.
8. With session B's pre-change credentials/session state:
   - verify refresh cannot mint a usable new provider session;
   - verify its old access JWT is rejected by a normal Community API with
     `SESSION_REVOKED_OR_INVALID`.
9. Sign in with the new password and confirm a fresh session reaches the normal Community query
   boundary.
10. If the enabled Password changed security notification arrives as part of this same real
    transaction, record provider delivery + Inbox/Junk placement. Do not trigger an extra password
    change merely to test the notification.

## PASS criteria

All must hold:

- reauthentication message delivered by the configured Auth SMTP path;
- operator receives the nonce in the QA mailbox;
- nonce-backed password update succeeds;
- old session B refresh is unusable after the change/revoke flow;
- old session B access JWT is rejected by Wand cutoff;
- new password sign-in succeeds;
- new session reaches Community normally;
- no repeated/synthetic warming traffic is generated.

## Failure handling

- One delivery delay or mailbox-placement failure is recorded as deliverability evidence; do not
  immediately loop retries.
- A provider or Wand revocation failure keeps the Auth launch gate open.
- Do not weaken the 15-character policy, session cutoff, or reauthentication requirement to make
  the test pass.
- Do not enable unavailable Leaked Password Protection by code.

## Completion update

After one PASS:

- set `SIGNED_IN_REAUTHENTICATION_MAILBOX_QA` to CLOSED in
  `ops/community-auth-launch-review.json`;
- set `launchApproved=true` in that Auth review only if no other Auth launch item is open;
- update `ops/community-production-operations.json.authLaunchReview`;
- rerun normal Community CI;
- do not rerun the primary/closure Community browser suites.
