# Community Auth final signed-in reauthentication mailbox runtime — 2026-10-01

Status: **CONFIRMED PASS / CLOSED**

## Scope

This is the single representative real-mailbox transaction required by
`docs/community/auth-final-mailbox-reauth-runbook-20261001.md`.

Environment:

- real staging project;
- normal browser `/community-lab/` product path;
- one representative QA mailbox;
- two independent provider sessions A and B;
- no synthetic Auth/warming traffic.

No email address, password, access token, refresh token, OTP/nonce, provider subject, or message
subject is stored in this evidence.

## Pre-change acceptance

CONFIRMED:

- normal email/password signup and mailbox confirmation completed;
- first-time WandAccount / CreatorProfile bootstrap completed through `ensureAccountCreator`;
- A normal Community `saved` query PASS;
- B independent-session normal Community `saved` query PASS.

This established that both sessions were healthy before revocation.

## Signed-in reauthentication / password update

CONFIRMED:

- session A requested signed-in reauthentication exactly once;
- the real reauthentication message arrived in the representative Gmail Inbox;
- the operator entered the mailbox nonce in the product flow;
- a new password satisfying the 15-code-point baseline was accepted;
- `Change password + revoke all` completed successfully;
- the enabled password-changed security notification arrived in the same Inbox.

## Old session B rejection

CONFIRMED:

- B's pre-change `community-query` request returned HTTP 401;
- its internal `community_authorize_session` call failed at the Wand session boundary;
- `community-query` maps that authorization failure to
  `SESSION_REVOKED_OR_INVALID`;
- the browser client then attempted its normal one-time refresh retry;
- provider refresh returned HTTP 400 with `refresh_token_not_found`.

Therefore both required layers are proven:

1. already-issued old access JWT rejected by the Wand cutoff;
2. old refresh token unable to mint a new provider session after global logout.

## Fresh sign-in

CONFIRMED:

- new-password provider grant returned HTTP 200;
- the fresh session then reached `community-query` successfully with HTTP 200;
- the browser `SavedItem query` reported PASS.

## Mailbox placement

The same normal transaction provided low-volume human placement evidence:

- signup confirmation: Inbox;
- reauthentication message: Inbox;
- password-changed security notification: Inbox.

Resend readback after completion showed the current observed sample at 8 sent / 8 delivered.

This closes the representative human-mailbox launch gate. Earlier iCloud Inbox/Junk observations
remain valid and are not overwritten; this evidence does not claim universal Inbox placement across
all mailbox providers.

## Classification

**CONFIRMED / CLOSED**

- `SIGNED_IN_REAUTHENTICATION_MAILBOX_QA`: CLOSED;
- Auth launch review: approved;
- representative mailbox placement gate: CLOSED;
- synthetic substitute/warming traffic: none.

No primary Community browser suite, closure suite, retention E2E, Preset vertical, or other already
closed runtime suite was rerun.
