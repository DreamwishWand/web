# Community Core vertical slice v0

Status: implementation contract for the first production-shaped Community milestone.

## Boundary

Community Core is shared infrastructure. Gallery, Presets, DreamSnaps and Q&A may own subtype tables and validation, but they must reuse the same Wand Account, Creator Profile, CommunityEntity, visibility, ownership, save/follow/reaction/comment, notification, reporting, moderation and discovery contracts.

The current web repository is still a static GitHub Pages starter. This branch adds the provider-neutral domain contract and the first PostgreSQL/Supabase schema without changing the production Pages adapter. A server runtime is intentionally a separate next step so the public static deployment is not broken before staging infrastructure exists.

## Transaction rules

Every retriable mutation carries an idempotency key. Mutable aggregates use an expected row version. Publication and its outbox event commit in the same database transaction. Published revisions and artifact payload revisions are immutable. Search is a derived projection and never grants authorization.

## Required vertical-slice path

1. User A has a Wand Account and Creator Profile.
2. A creates a Gallery draft, associates validated media, and publishes immutable revision 1.
3. The work is PUBLIC + CLEAR + PUBLISHED and becomes discoverable.
4. User B discovers the same stable work/entity IDs.
5. B saves the work, follows A, reacts, comments and replies.
6. A Gallery revision can link to a specific immutable Preset revision; B can save the Preset entity without copying ownership.
7. Outbox processing creates allowed notifications while suppressing self-notifications and save notifications.
8. B reports the work/comment.
9. A moderator reviews the case, restricts/removes/restores content, and every privileged action is audited.
10. Direct reads, search results and media delivery converge to the new moderation/visibility state.

## Negative acceptance

B cannot mutate A's work, media or Preset. PRIVATE is owner/staff-only. UNLISTED is excluded from normal search. A prior SavedItem never becomes an access grant. Quarantined/rejected media cannot publish. Duplicate retried saves/follows/reactions remain single logical relationships. A transaction failure creates neither publication nor outbox event; a downstream worker failure leaves the committed outbox row retryable.

## Implementation sequence

1. Apply and review the migration in an isolated staging database.
2. Add a Supabase-backed CommunityCommandBus adapter and server-only auth mapping.
3. Move the staging SvelteKit build to a server-capable Cloudflare adapter without changing local DDV save processing.
4. Implement the smallest Gallery + Preset vertical-slice endpoints and internal UI.
5. Run VS-01 through VS-15 with two ordinary accounts and one moderator.
6. Only then let product workstreams add production community UI on top of the shared contract.
