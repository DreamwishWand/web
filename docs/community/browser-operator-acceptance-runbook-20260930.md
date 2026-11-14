# Community Core browser/operator acceptance contract

This public contract defines the required acceptance criteria for Community Core. It is not an operator runbook, runtime evidence, or release approval. Acceptance is scoped to isolated staging; production, public posting, and provider activation require their separate gates.

## Security and acceptance prerequisites

The product-shaped browser surface covers `/community-lab/`, `/community-lab/recovery/`, `/community-lab/account/`, and `/community-ops/`. Distinct publishing owner (A), non-owner (B), moderator (M), operator (O), and disposable deletion (D) roles are required; the labels designate test roles, not actual accounts.

Acceptance requires current staging migrations and Edge Functions, green branch CI, no Security Advisor WARN findings, and active required Community workers. Operator email is disabled unless its transactional provider is specifically under acceptance. Only publishable browser keys belong in the browser; privileged credentials and server configuration must not enter browser notes or evidence.

The launch recent-auth boundary is **900 seconds / 15 minutes** for account deletion, support/admin high-risk writes, and moderator/admin moderation actions. Recent-auth is session-bound and measured from `auth.sessions.created_at`; JWT refresh does not reset the window. The exposed Security Policy must represent the three 900-second defaults, `sessionBound = true`, and the same session source. Expired sessions reject high-risk writes with `RECENT_AUTH_REQUIRED`; a fresh authorized session is required for acceptance.

## Phase A — normal signup / verification / PKCE recovery

The real browser acceptance includes production-shaped staging verification email, verified sign-in, normal password recovery through the PKCE callback, password update, and sign-in with the new password. WandAccount and CreatorProfile stable IDs must survive recovery. Verification, recovery, and identity continuity are separate positive checks; secrets and email addresses are excluded from evidence.

## Phase B — A -> B -> Moderator vertical slice

The acceptance sequence must cover stable identity and profile edit; real image prepare, signed upload, finalize and signed read; Gallery draft and immutable publish; PUBLIC discovery positive and UNLISTED discovery negative. A distinct non-owner can directly read an authorized target, Save, Follow, Reaction, Comment, and Report, but all prohibited owner mutations must fail. A permitted reply to a stored parent comment creates the corresponding in-app notification for its author. Moderator restriction and restoration must converge with discovery and access. Owner visibility changes, unpublish and soft-delete must affect access; a stale SavedItem is only a reference, never an access grant.

Normal Comment/Reply/Reaction/Follow/Save activity must remain **in-app only**. It must not create transactional email.

## Phase C — operator / support acceptance

Operator recovery requires admin authorization, an opaque verification reference, omission of provider subject and raw verification-reference values in listings, rejection of Complete before Verify, and stable ownership after verified completion. The moderation queue must omit reporter WandAccount identity while retaining the necessary reason/detail and target state. Fresh authorized moderation restrict/remove/restore must persist ModerationAction and AuditEvent, resolve the case and close linked reports. A session older than 15 minutes must fail with `RECENT_AUTH_REQUIRED`; a fresh authorized session must pass the same valid operation.

The contract includes authorized, reviewed requeue of provider-cleanup and retention dead letters, external operator-email delivery visibility, and persistent Operations Alerts. An acknowledgment does not erase the incident; clearance auto-resolves the condition; recurrence creates a new occurrence.

## Phase D — self-service deletion

Deletion requires a disposable account, denial for a stale session, a fresh authorized session, and exact `DELETE` confirmation. Acceptance includes immediate Wand tombstone/de-identification, local/global browser session cleanup, queued provider cleanup, and eventual scheduled removal of the actual provider user with cleanup-job anonymization. Provider cleanup is not assumed complete from a Wand tombstone alone.

## Phase E — operator critical email acceptance

This acceptance is conditional on a verified sender domain, Resend and server-only recipient/credential configuration. The persistent Operations Alert remains the canonical incident record. The relay must enforce existing worker authentication and required server-held configuration; invalid worker/relay authorization fails closed. External `operator_email` is a projection of the incident.

The acceptance boundary requires exactly one minimized email per safe critical occurrence, acknowledgment and auto-resolution of the canonical alert, a new occurrence and email on recurrence, and visible retry/dead-letter behavior on controlled delivery failure without losing the alert. Mail must omit provider subjects, Wizard email addresses, raw report details, signed media URLs, passwords, tokens and DDV private data. Transport self-monitoring must not recursively enqueue to the failed email path.

A transactional email provider's outage cannot notify through that provider; a second independent notification channel is not launch-required for the current single-operator, non-life-safety, non-financial scope. This limitation is distinct from successful delivery acceptance.

## Secret-free evidence and gate boundary

Acceptance evidence consists of time, route, opaque role and object references, operation, expected/observed result, non-secret error code and cleanup outcome. Never record:

- Passwords, actual email addresses, JWT/access/refresh tokens, recovery tokens/codes or raw verification artifacts.
- Publishable-key values, service-role/secret keys, provider API or SMTP credentials, worker tokens or Vault secrets.
- Provider subjects, signed upload/read URLs or private DDV data.

The browser/operator gate requires actual real-browser Phases A-D; Phase E separately covers the operator-email launch requirement. Backend/database PASS does not substitute for the browser/operator runs. A contract, static test, or historical observation is not current runtime acceptance, production approval, or authorization to enable any feature.
