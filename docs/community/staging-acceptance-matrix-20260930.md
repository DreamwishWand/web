# Community Core staging acceptance matrix — 2026-09-30

Status vocabulary:

- **CONFIRMED PASS** — exercised against the real isolated Supabase staging project.
- **PARTIAL** — a material sub-path is confirmed, but the complete acceptance case still has a missing runtime surface.
- **PENDING** — not yet exercised in the required production-shaped path.

Staging project: `dreamwish-wand-staging` / `ap-northeast-1`.

| Case | Status | Confirmed evidence | Remaining closure |
|---|---|---|---|
| VS-01 Identity / Creator stability | PARTIAL | Real Supabase Auth user creation + password sign-in produced an ES256 JWT; JWT-authenticated command/query round-tripped stable WandAccount + CreatorProfile IDs. Real staging DB profile-edit runtime also PASS: handle/display-name/bio/visibility edit preserves CreatorProfile ID, increments rowVersion, is idempotent on retry, rejects stale expectedVersion and emits AuditEvent. Internal Community Lab implements explicit same-ID proof across the edit. | Execute the implemented browser Lab identity/profile-edit path with a real staging user. Broader account recovery/support remains a separate launch requirement. |
| VS-02 Gallery draft -> validated media -> immutable publish | PARTIAL | Real DB/RPC path requires owner-controlled READY MediaAsset; Gallery revision is sealed at publish; media relation is immutable; empty/foreign media is rejected. `community-media` Edge adapter is deployed with signed upload, byte signature/dimension/SHA-256 validation and signed read support. | An actual file has not yet been uploaded through the deployed signed-upload Edge path because the one-time admin bootstrap approach was intentionally not bypassed after safety tooling blocked it. |
| VS-03 Public discovery identity consistency | CONFIRMED PASS | PUBLIC+CLEAR+PUBLISHED enters SearchDocument; UNLISTED does not; anon/auth cannot scan canonical Community tables; search resolves to stable work/entity IDs. Internal Lab can query the published/target work through the authorized query boundary. | Full Product Tree discovery presentation remains outside this Community vertical-slice gate. |
| VS-04 Save / Follow / Reaction / Comment / Reply + retry | CONFIRMED PASS | Real staging RPC state changes passed; duplicate Save/Follow/Reaction remain one logical row; comment/reply targets validated; idempotent publication retry returns the same revision. Internal Lab implements B target read, Save, Follow, Like and Comment after actor switch. | Execute the implemented A -> B browser path; reply-specific UI remains a later UX detail. |
| VS-05 Gallery -> Preset -> Library reuse | CONFIRMED PASS for Community backend | WEP-owned payload is kept opaque; Preset envelope + immutable Preset revision publish successfully; Gallery revision locks an exact Preset revision; User B resolves Preset detail and saves PresetArtifact into shared SavedItem/Library state; late link/rebind is rejected. | WEP-owned payload validation/preflight/apply remains outside COMM and must be exercised by WEP. |
| VS-06 Notifications | CONFIRMED PASS | Outbox -> NotificationEvent/Delivery passed; publish fan-out to two followers, follow/reaction/comment to creator, reply to parent author, self-notification suppression and no SavedItem notification passed. `pg_cron` runs outbox processing every minute. Internal Lab exposes authenticated Notification query for runtime convergence checks. | Execute browser recipient checks; preferences/non-inbox channel delivery remain later launch work. |
| VS-07 Reporting | CONFIRMED PASS | User B report creates Report and attaches it to a ModerationCase through server-only RPC. Internal Lab implements B Report and retains only the resulting case ID across actor switch. | Execute the implemented browser path; final reason taxonomy remains product-policy work. |
| VS-08 Moderation | CONFIRMED PASS | Moderator-only role check; restrict removes discovery; restore restores discovery; ModerationAction + AuditEvent persisted; non-moderator call rejected. Internal Lab implements moderator restrict/restore through JWT-authenticated `moderateWork`; role enforcement stays server-side. | Execute the implemented moderator browser path; production moderation console remains later work. |
| VS-09 Negative authorization | CONFIRMED PASS | B cannot change visibility, unpublish or delete A's work; non-moderator cannot moderate; privileged RPCs are not executable by anon/authenticated roles. Internal Lab has an explicit probe that requires all three B owner-mutation attempts to fail. | Execute the browser probe and preserve actionable error presentation. |
| VS-10 Visibility semantics | CONFIRMED PASS | PUBLIC discoverable; UNLISTED absent from discovery but direct authorized access works; PRIVATE/nonpublished access is denied to B. | Product default visibility remains a product-policy decision. |
| VS-11 Stale SavedItem | CONFIRMED PASS | SavedItem survives later privacy/unpublish/delete state but returns `accessible=false`; save is not an access grant. | UI handling for unavailable saved items remains pending. |
| VS-12 Media guards/delivery | PARTIAL | MediaAsset owner/READY/moderation checks, private-before-publication behavior, publication linkage, later-private access revocation and signed-read adapter are implemented/tested at DB level. | Actual signed upload -> finalize -> signed read network E2E with an image file remains pending. |
| VS-13 Concurrent/retry uniqueness | PARTIAL / HIGH CONFIDENCE | DB PK/UNIQUE constraints, idempotency rows and retry tests pass; max-three DDV Profile guard uses per-account transaction advisory lock. | A true parallel-session stress test has not yet been run. |
| VS-14 Failure atomicity / downstream retry | CONFIRMED PASS | Failed publish leaves no revision/publish outbox/idempotency completion; successful publication and outbox commit together. Poison outbox event no longer blocks later events; retry uses backoff and dead-letters after five failed attempts. | Operational dead-letter review UI/alerting remains pending. |
| VS-15 Tombstone/history preservation | CONFIRMED PASS | Owner soft delete tombstones CommunityEntity, removes discovery and access, preserves published revision/comment/report history, and keeps SavedItem as inaccessible reference. | Retention/anonymization policy for account deletion remains pending. |

## Gate conclusion

The **Community backend vertical slice is substantially proven**, including a real Supabase Auth JWT round trip and real PostgreSQL command/query/notification/moderation paths.

The overall Community Phase 2 release gate is **not yet complete** because the acceptance contract requires the production-shaped app path, not only direct staging RPC/DB evidence. Remaining release-critical work is:

1. execute the already-implemented internal Community Lab with real staging A/B/Moderator users and capture secret-free runtime evidence;
2. complete actual signed media upload/finalize/read E2E through that browser path;
3. run a true parallel-session stress test for uniqueness/concurrency behavior;
4. connect WEP's validated Preset payload/preflight/apply path to the already-proven Community Preset envelope/Library bridge, then rerun VS-01..VS-15 without direct SQL orchestration;
5. add operational handling for dead-letter outbox events and finalize account recovery/deletion retention policy.

The current public GitHub Pages deployment remains unchanged.
