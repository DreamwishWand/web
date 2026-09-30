# Community Core staging acceptance matrix — 2026-09-30

Status vocabulary:

- **CONFIRMED PASS** — exercised against the real isolated Supabase staging project.
- **PARTIAL** — a material sub-path is confirmed, but the complete acceptance case still has a missing runtime surface.
- **PENDING** — not yet exercised in the required production-shaped path.

Staging project: `dreamwish-wand-staging` / `ap-northeast-1`.

| Case | Status | Confirmed evidence | Remaining closure |
|---|---|---|---|
| VS-01 Identity / Creator stability | PARTIAL | Real Auth identity round-trip, stable CreatorProfile edit, support-assisted ownership recovery and Wand session-cutoff behavior are CONFIRMED. Safe first-time identity bootstrap is now CONFIRMED 10/10: new subjects bootstrap once; existing active subjects use normal cutoff; retired, deletion-pending and open-recovery-reserved subjects fail closed in both authorizer and creation RPC. Recent-auth remains session-bound to verified session_id + auth.sessions.created_at. The internal Lab implements PKCE recovery, reauthentication/password change and all-session revocation; Community Ops implements admin recovery/dead-letter/alert operations. | Execute normal provider/browser signup/recovery + identity path with real staging users and execute Community Ops with a real staging admin. The support-verification procedure is defined and backend-confirmed; launch recent-auth defaults are finalized at 900 seconds for account deletion, support/admin high-risk writes, and moderator/admin moderation writes. |
| VS-02 Gallery draft -> validated media -> immutable publish | CONFIRMED PASS | Real HTTP staging E2E used a real Supabase Auth JWT, `community-media.prepare`, actual PNG signed Storage PUT, server-side finalize/re-download, MIME+dimension+SHA-256 validation, READY MediaAsset registration, Gallery draft and `community_publish_gallery_v3`. Identity/prepare/upload/finalize/publish/query all returned 200; published work read back as `published` and normal revision sealing/media immutability applied. Detailed evidence: `docs/community/vs02-vs12-media-network-runtime-20260930.md`. | Product-shaped browser execution through Community Lab remains separate from the backend/network acceptance. |
| VS-03 Public discovery identity consistency | CONFIRMED PASS | PUBLIC+CLEAR+PUBLISHED enters SearchDocument; UNLISTED does not; anon/auth cannot scan canonical Community tables; search resolves to stable work/entity IDs. Launch search backend is now PostgreSQL SearchDocument + `community_search_public` with `SECURITY INVOKER`, pg_trgm title/text indexes, work-type/Creator/tag filters and stable cursor pagination. A rollback anon-role staging test using Japanese keyword `夜空` returned PUBLIC=1, UNLISTED=0 and tag-filter match=1. No external search provider is launch-required. | Execute keyword/filter/pagination and moderation/unpublish/delete convergence through the browser product path. |
| VS-04 Save / Follow / Reaction / Comment / Reply + retry | CONFIRMED PASS | Real staging RPC state changes passed; duplicate Save/Follow/Reaction remain one logical row; comment/reply targets validated; idempotent publication retry returns the same revision. Internal Lab implements B target read, Save, Follow, Like, Comment and stored-parent Reply after actor switch. | Execute the implemented A -> B -> reply browser path. |
| VS-05 Gallery -> Preset -> Library reuse | CONFIRMED PASS for Community backend | WEP-owned payload is kept opaque; Preset envelope + immutable Preset revision publish successfully; Gallery revision locks an exact Preset revision; User B resolves Preset detail and saves PresetArtifact into shared SavedItem/Library state; late link/rebind is rejected. | WEP-owned payload validation/preflight/apply remains outside COMM and must be exercised by WEP. |
| VS-06 Notifications | CONFIRMED PASS | Outbox -> NotificationEvent/Delivery passed; publish fan-out to two followers, follow/reaction/comment to creator, reply to parent author, self-notification suppression and no SavedItem notification passed. `pg_cron` runs outbox processing every minute. Internal Lab exposes authenticated Notification query for runtime convergence checks. Email policy is now explicit: Comment/Reply/Reaction/Follow/Save/normal publication activity remain in-app only; Auth verification/recovery, important Security/Moderation, Wand Cloud purchase/Gift, and operator critical alerts are separate transactional-mail surfaces. | Execute browser recipient checks. Approved Wizard transactional email implementation remains later launch work; normal Community activity is intentionally not an email channel. |
| VS-07 Reporting | CONFIRMED PASS | User B report creates Report and attaches it to a ModerationCase through server-only RPC. Internal Lab implements B Report and retains only the resulting case ID across actor switch. | Execute the implemented browser path; final reason taxonomy remains product-policy work. |
| VS-08 Moderation | CONFIRMED PASS | Moderator/admin role checks, restrict/remove/restore, discovery convergence, ModerationAction + AuditEvent persistence, and non-staff rejection are established. Production-shaped moderation operations are now implemented in hidden Community Ops: role-gated case queue, reporter identity omitted, report reason/detail exposed only to staff, and session-bound 900-second recent-auth for writes. Rollback staging runtime confirmed a 20-minute session rejection, fresh-session restrict -> work restricted, case resolved, one linked report closed, SearchDocument removed, restore -> work clear + SearchDocument restored, two ModerationActions + two AuditEvents persisted, and reporter identity absent from the queue response. A third-party automated moderation provider is not a first-launch dependency. | Execute report -> Ops review -> action -> restore with real browser moderator/admin sessions and preserve secret-free evidence. |
| VS-09 Negative authorization | CONFIRMED PASS | B cannot change visibility, unpublish or delete A's work; non-moderator cannot moderate; privileged RPCs are not executable by anon/authenticated roles. Internal Lab has an explicit probe that requires all three B owner-mutation attempts to fail. | Execute the browser probe and preserve actionable error presentation. |
| VS-10 Visibility semantics | CONFIRMED PASS | PUBLIC discoverable; UNLISTED absent from discovery but direct authorized access works; PRIVATE/nonpublished access is denied to B. | Product default visibility remains a product-policy decision. |
| VS-11 Stale SavedItem | CONFIRMED PASS | SavedItem survives later privacy/unpublish/delete state but returns `accessible=false`; save is not an access grant. | UI handling for unavailable saved items remains pending. |
| VS-12 Media guards/delivery | CONFIRMED PASS | DB guards already passed. Real HTTP staging E2E additionally completed signed upload -> finalize -> server byte validation -> signed read URL -> actual signed read fetch with an image file. Server detected `image/png`, 1×1 dimensions and a 64-hex SHA-256; returned bytes matched upload length. Fixture, Storage object and temporary E2E mechanism were fully removed; Security Advisor returned WARN 0 afterward. | Product browser UX and final production storage/provider policy remain separate launch work. |
| VS-13 Concurrent/retry uniqueness | CONFIRMED PASS | True overlapping multi-backend staging stress passed using independent pg_cron workers with ~1 second measured overlap. Save: 6 workers/6 PIDs -> 1 SavedItem. Follow: 6/6 -> 1 Follow + 1 Outbox event. Reaction: 6/6 -> 1 Reaction + 1 Outbox event. Same Gallery-draft idempotency key: 6/6 returned one identical workId with 1 idempotency row/work/outbox event. DDV Profile cap race from starting count 2: two overlapping workers -> exactly one third link and one max-three rejection; final count 3. Full fixture cleanup verified residue 0 and immutable guards re-enabled. | Browser/app acceptance remains separate; no further database parallel-session blocker. |
| VS-14 Failure atomicity / downstream retry | CONFIRMED PASS | Failed publish leaves no revision/publish outbox/idempotency completion; successful publication and outbox commit together. Poison outbox event no longer blocks later events; retry uses backoff and dead-letters after five failed attempts. Hidden Community Ops exposes reviewed requeue paths. Persistent Operations Alerts detect provider-cleanup/outbox/retention failures and worker-health failures. External critical transport is now specifically `operator_email`: occurrence-keyed queue, Vault-authenticated worker, retry/backoff/dead-letter, active worker/monitor Cron, self-monitor alerts, non-recursive filtering, recent-auth Ops retry, and a dedicated `community-ops-email` worker. A rollback staging probe produced one transport dead-letter alert and zero recursive external deliveries. | Browser/operator execution remains pending. One real operator mailbox delivery must be accepted end-to-end. Transactional provider/domain/operator-recipient configuration remains pending; a second independent channel is not a first-launch requirement. |
| VS-15 Tombstone/history preservation | CONFIRMED PASS | Owner soft delete tombstones CommunityEntity, removes discovery and access, preserves immutable history, and keeps SavedItem from becoming an access grant. Self-service Wand tombstone is CONFIRMED 8/8. Provider cleanup queue and Vault-token Cron scheduler are CONFIRMED. An admin-created disposable **existing** Supabase Auth user then used normal password sign-in -> safe bootstrap -> deployed self-service tombstone; while Cron was paused the provider user remained real/present, and the next restored scheduled worker run deleted that actual Auth user, completed the job in one attempt and anonymized its stored provider subject. Persistent dead-letter/heartbeat alerting is CONFIRMED. Evidence: `docs/community/identity-bootstrap-runtime-20260930.md`, `docs/community/account-deletion-runtime-20260930.md`, `docs/community/provider-cleanup-runtime-20260930.md`, `docs/community/operations-alerts-runtime-20260930.md`. | Account retention is now production-shaped at the staging boundary: two-stage scheduling/holds/alerts are CONFIRMED and a real Gallery Storage object was physically deleted by the retention worker. The configurable 30-day content / 365-day operational defaults still require launch privacy/legal review; Preset ArtifactBlob physical purge remains WEP-dependent and fail-closed; browser self-service deletion acceptance remains pending. Normal public signup remains a VS-01 item; the actual provider-deletion E2E used an admin-created fixture because staging email signup hit rate limiting. |

## Gate conclusion

The **Community backend/network vertical slice is substantially proven**, including a real Supabase Auth JWT round trip, actual signed media upload/finalize/read + media-backed Gallery publish, real PostgreSQL command/query/notification/moderation paths, and true overlapping multi-backend concurrency stress for VS-13. Media evidence: `docs/community/vs02-vs12-media-network-runtime-20260930.md`. Concurrency evidence remains in the VS-13 runtime documents.

The overall Community Phase 2 release gate is **not yet complete** because the acceptance contract requires the production-shaped app path, not only direct staging RPC/DB evidence. Remaining release-critical work is:

1. execute the already-implemented internal Community Lab with real staging A/B/Moderator users and capture secret-free runtime evidence;
2. complete actual signed media upload/finalize/read E2E through that browser path;
3. connect WEP's validated Preset payload/preflight/apply path to the already-proven Community Preset envelope/Library bridge, then rerun VS-01..VS-15 without direct SQL orchestration;
4. complete operations closure: execute Community Ops with a real staging admin, execute the hidden self-service account-deletion route in a real browser, configure and test operator email for critical Operations Alerts, use the finalized 900-second recent-auth defaults and review the current 30-day/365-day retention defaults, and preserve the backend-confirmed Open -> Verify -> Complete support procedure. Actual existing-provider-user deletion through scheduled cleanup is already CONFIRMED.

The current public GitHub Pages deployment remains unchanged.


## Account deletion / provider cleanup operations checkpoint

Wand-side account tombstone and provider-account deletion are intentionally decoupled.

- Wand tombstone requires recent authentication and immediately removes Community access.
- Original provider subject is copied only into a private retry queue before public AuthIdentity mappings are anonymized.
- Queue claims use lock tokens plus `FOR UPDATE SKIP LOCKED`.
- Failed cleanup retries with backoff and dead-letters on the fifth failed attempt.
- `community-auth` is invoked by a Vault-backed dedicated worker token; it is not a browser/user-JWT endpoint.
- provider-cleanup Cron scheduling and idempotent already-absent cleanup are CONFIRMED end-to-end in staging;
- persistent provider-cleanup/outbox/scheduler health alerts are CONFIRMED at the backend boundary.
- Detailed evidence: `docs/community/provider-cleanup-runtime-20260930.md` and `docs/community/operations-alerts-runtime-20260930.md`.

Actual deletion of an existing disposable staging Auth user through the scheduled worker is CONFIRMED. Operational acceptance still requires browser/operator surface execution, operator critical-email runtime acceptance, and final launch review of the 30-day/365-day retention policy values. Recent-auth launch defaults are finalized at 900 seconds for account deletion, support/admin, and moderation staff writes.


## Session-bound recent-auth / support operations checkpoint

High-risk operations no longer use JWT age as recent-auth proof.

- verified JWT `session_id` is matched to `auth.sessions.user_id`;
- recent-auth age is calculated from `auth.sessions.created_at`;
- refreshed JWTs do not reset the recent-auth clock;
- missing/mismatched sessions fail closed;
- legacy iat-only recent-auth calls fail closed;
- account tombstone and admin recovery/provider-cleanup writes use the session-bound helper.

Real staging DB tests confirm fresh-session acceptance and stale-session rejection even with a
current JWT `iat`.

The hidden `/community-ops/` route and JWT-required `community-admin` Edge boundary are
implemented for recovery case operations plus provider/outbox/retention/external-delivery review
and recent-auth requeue.
Detailed operator runbook: `docs/community/community-ops-v0.md`.

Browser/operator runtime acceptance remains pending.
