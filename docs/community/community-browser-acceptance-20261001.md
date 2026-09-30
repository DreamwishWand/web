# Community Core browser acceptance — 2026-10-01

Status: **CONFIRMED PASS — PRIMARY COMMUNITY BROWSER SLICE**

## Scope

Production-shaped browser execution against the real isolated Supabase staging project using:

- real Supabase password sessions for A/B/Moderator/Operator/Delete actors;
- deployed Community Edge boundaries;
- actual signed Storage upload/finalize/read;
- no direct SQL orchestration for the browser actions under test.

## User-observed browser result

The one-shot browser acceptance suite completed with all steps PASS:

- Auth sessions A/B/M/O/D;
- A stable WandAccount + CreatorProfile identity;
- canonical fixture identities;
- A validated media signed upload -> finalize -> authorized read;
- A Gallery publish -> authenticated read -> public discovery;
- B Save / Follow / Reaction / Comment;
- B report -> ModerationCase;
- B moderation denial (403 FORBIDDEN);
- moderator queue visibility with reporter account identity omitted;
- moderator restrict -> public search removal;
- moderator restore -> public search restoration;
- A parent-comment reply;
- operator security policy read with 900-second account/admin/moderation windows and session-bound source;
- B admin denial (403 FORBIDDEN);
- operator action-rate policy read;
- operator retention hold add/release through a fresh recent-auth session;
- A notification convergence through the normal query path;
- D self-service account deletion with explicit DELETE confirmation;
- D old JWT rejected with 401 SESSION_REVOKED_OR_INVALID;
- A visibility -> private removed the work from discovery.

## Backend post-verification

Backend state independently matched the browser result for the acceptance Gallery fixture:

- final work state: published / private / moderation clear;
- SearchDocument absent after owner private transition;
- SavedItem: 1;
- Follow: 1;
- Like reaction: 1;
- Comments/replies: 2;
- Reports: 1;
- ModerationActions: 2;
- moderation AuditEvents: 2;
- NotificationDeliveries targeting the work: 5;
- active retention holds for delete fixture: 0;
- disposable D provider user absent after scheduled provider cleanup.

The structural publication/revision/history records are intentionally preserved under staging history rules.

## Evidence classification

**CONFIRMED**

- primary A -> B -> Moderator -> Operator -> Delete Community browser slice;
- browser media path;
- authorization boundaries;
- moderation privacy and convergence;
- notification convergence;
- recent-auth protected operator mutation;
- self-delete and post-delete session rejection;
- scheduled provider cleanup of the disposable D Auth user.

## Remaining browser closure

A second one-shot closure suite is reserved for the remaining browser-specific gaps:

- PRIVATE / UNLISTED / PUBLIC semantics;
- stale SavedItem accessibility;
- B owner-mutation denial;
- intentional 429 presentation;
- failed publish atomicity;
- Community Ops read surfaces;
- owner unpublish / soft-delete convergence.

WEP-owned Preset payload validation/preflight/apply remains a separate WEP acceptance boundary.
