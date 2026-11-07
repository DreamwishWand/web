# 03 COMM / W-ENTITY-016 — Public user handle security boundary

Scope: Owner authority OWNER_PUBLIC_PROFILE_USERS_HANDLE_20261107; Canonical IA + issue214 comment6704409205. SOURCE_ONLY; not a DB migration, Auth/JWT/RLS acceptance, public resolver, or permission to deploy. Writer, Community Public, Provider, Stage116 and Cloud flags OFF.

## Identity and compatibility
- Canonical public profile path /users/{handle}/. AccountID and CreatorProfileID are stable server-owned UUID identities; handle and displayName are mutable and distinct. WorkID and Work URLs never change on handle rename. /library/ remains authenticated-private and noindex.
- Existing src/lib/community/domain.ts normalizeCreatorHandle uses NFKC and existing immutable migration 20260930044500 creator_profile_update permits 3–40 characters including dot/hyphen. These are legacy identities. New /users handle grammar is stricter: do not silently repurpose or rewrite accepted CreatorProfile data, historical82 SQL or typed P/S entity contract.
- inspectPublicProfileHandleSegment validates raw ASCII only, 3–24 characters, first ASCII letter, last alphanumeric, only single internal underscores, ASCII uppercase lowered, conservative protected namespace list. It rejects encoded percent/slash/dots, Unicode confusables, bidi, control, non-strings. A candidate is SYNTAX_ONLY_UNVERIFIED: all public profile/private Library read, index, alias redirect, write and Community-enable flags false. No HTTP URL/redirect code may originate from this syntax guard.
- The conservative reserved list is not the historic handle namespace or a proven anti-impersonation inventory. Only server-owned transactionally reserved active+old alias lineage and current permission can later authorize any public resolution.

## Actual server CAS/RLS/ACL and rollback (NOT_IMPLEMENTED)
1. Trusted authenticated actor/signed session with current revocation cutoff resolves AccountID and CreatorProfileID server-side. Never trust caller ActorID, profile owner, consent, age or moderation flags.
2. A new additive, separately versioned DB design must enforce exact normalized lower ASCII canonical key uniqueness across active and all historical aliases and protected names in one transaction. Lock account/profile and reservation keys, compare expected row_version and old handle, atomically reserve old key forever, update current key, audit, idempotency. Concurrent other-account rename/replay/conflicting CAS must fail without side effects.
3. Account retirement/deletion/tombstone or consent withdrawal suppresses both current and old alias. Same-owner alias temporary redirect only after fresh backend privacy/age/moderation/consent and CDN/search invalidation. Old alias must never be reassigned. Signed JWT revoke+refresh and subsequent DB attempts must remain denied in a separate session/PG.
4. Public projection must suppress private, minor, blocked, retired and unconsented profiles, private/draft/UNLISTED work, hidden DreamSnaps voting submissions, official private results and all private Library entries, even when a handle itself looks public.
5. Legacy /creator/?id=... requires verified CreatorProfileID authorization. Only verified, revocable 302/307 after runtime/SEO tests; 301/308 not authorized before cache/rollback receipts. SPA fallback200 is not direct-host SEO acceptance.
6. Stage116 existing history and fresh derived bootstrap are separate; preserve all original82 bytes/SHA, no ledger alteration/unsafe legacy reGRANT. E669 Stage116 116 applied, Source164 signed Gallery prerequisite absent, six privileged legacy Writers on, original82 SQLSTATE42601 TRUE_RED. Without authorized clone/statement/SHA/ACL parity, no concrete SQL migration, deployment or real rollback claim.

## Operation evidence and acceptance
- P1: casefolded ASCII syntax candidates, but no positive URL/authorization: Node synthetic only.
- P2: owner CAS rename preserving AccountID/ProfileID/WorkIDs and reserved old alias: DB NOT_RUN.
- P3: same-owner old alias safe temporary redirect after current privacy: DB/HTTP NOT_RUN.
- P4: Library remains private while profile public: DB/HTTP NOT_RUN.
- P5: eight-locale direct hosted HTTP/A11y/SEO evidence: NOT_RUN.
- N1: percent slash/dot, Unicode fullwidth/confusable/bidi, whitespace, protected root, malformed underscore, numeric prefix: Node synthetic covered.
- N2: simultaneous Account conflict, stale revision, idempotency mismatch, replay/revoked JWT/new refresh, 2PG: DB/signature NOT_RUN.
- N3: old alias takeover, tombstone/withdrawn profile/retired AuthIdentity resurrection: DB/rollback NOT_RUN.
- N4: private/minor/moderation index/cache/legacy URL exposure: DB/HTTP NOT_RUN.
- N5: cross-kind native P/S collisions, Work ID and alias unauthorized reassignment: backend/HTTP NOT_RUN.
- N6: hidden DreamSnaps submissions/private results, false SPA200 or permanent redirect: backend/host NOT_RUN.

Rollback now: abandon this source-only branch, no database, public route, or flags changed. Future server changes need 09P-SQL exact applied-ledger/ACL forward-safe preflight, 04 QR-S signed two-PG/RLS/CAS/rollback independent QA, 04 QR-W hosted negative, and 09 INT only accepted main merge.