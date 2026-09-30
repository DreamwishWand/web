# Community Core staging acceptance matrix — 2026-09-30

Status vocabulary:

- **CONFIRMED PASS** — exercised against the real isolated Supabase staging project.
- **PARTIAL** — a material sub-path is confirmed, but the complete acceptance case still has a missing runtime surface.
- **PENDING** — not yet exercised in the required production-shaped path.

Staging project: `dreamwish-wand-staging` / `ap-northeast-1`.

| Case | Status | Confirmed evidence | Remaining closure |
|---|---|---|---|
| VS-01 Identity / Creator stability | PARTIAL | Real Supabase Auth user creation + password sign-in produced an ES256 JWT; JWT-authenticated `community-command` created/reused WandAccount + CreatorProfile; JWT-authenticated `community-query` returned the same stable IDs; test identity was fully cleaned up. | Creator-profile edit/recovery lifecycle through the product-facing app is not yet exercised. |
| VS-02 Gallery draft -> validated media -> immutable publish | PARTIAL | Real DB/RPC path requires owner-controlled READY MediaAsset; Gallery revision is sealed at publish; media relation is immutable; empty/foreign media is rejected. `community-media` Edge adapter is deployed with signed upload, byte signature/dimension/SHA-256 validation and signed read support. | An actual file has not yet been uploaded through the deployed signed-upload Edge path because the one-time admin bootstrap approach was intentionally not bypassed after safety tooling blocked it. |
| VS-03 Public discovery identity consistency | CONFIRMED PASS | PUBLIC+CLEAR+PUBLISHED enters SearchDocument; UNLISTED does not; anon/auth cannot scan canonical Community tables; search resolves to stable work/entity IDs. | Product discovery UI remains to be wired. |
| VS-04 Save / Follow / Reaction / Comment / Reply + retry | CONFIRMED PASS | Real staging RPC state changes passed; duplicate Save/Follow/Reaction remain one logical row; comment/reply targets validated; idempotent publication retry returns the same revision. | Product UI remains to be wired. |
| VS-05 Gallery -> Preset -> Library reuse | CONFIRMED PASS for Community backend | WEP-owned payload is kept opaque; Preset envelope + immutable Preset revision publish successfully; Gallery revision locks an exact Preset revision; User B resolves Preset detail and saves PresetArtifact into shared SavedItem/Library state; late link/rebind is rejected. | WEP-owned payload validation/preflight/apply remains outside COMM and must be exercised by WEP. |
| VS-06 Notifications | CONFIRMED PASS | Outbox -> NotificationEvent/Delivery passed; publish fan-out to two followers, follow/reaction/comment to creator, reply to parent author, self-notification suppression and no SavedItem notification passed. `pg_cron` runs outbox processing every minute. | Product inbox UI/preferences/channel delivery remain pending. |
| VS-07 Reporting | CONFIRMED PASS | User B report creates Report and attaches it to a ModerationCase through server-only RPC. | Product reporting UI/reason taxonomy finalization remains pending. |
| VS-08 Moderation | CONFIRMED PASS | Moderator-only role check; restrict removes discovery; restore restores discovery; ModerationAction + AuditEvent persisted; non-moderator call rejected. | Moderator console/UI remains pending. |
| VS-09 Negative authorization | CONFIRMED PASS | B cannot change visibility, unpublish or delete A's work; non-moderator cannot moderate; privileged RPCs are not executable by anon/authenticated roles. | App-level error presentation remains pending. |
| VS-10 Visibility semantics | CONFIRMED PASS | PUBLIC discoverable; UNLISTED absent from discovery but direct authorized access works; PRIVATE/nonpublished access is denied to B. | Product default visibility remains a product-policy decision. |
| VS-11 Stale SavedItem | CONFIRMED PASS | SavedItem survives later privacy/unpublish/delete state but returns `accessible=false`; save is not an access grant. | UI handling for unavailable saved items remains pending. |
| VS-12 Media guards/delivery | PARTIAL | MediaAsset owner/READY/moderation checks, private-before-publication behavior, publication linkage, later-private access revocation and signed-read adapter are implemented/tested at DB level. | Actual signed upload -> finalize -> signed read network E2E with an image file remains pending. |
| VS-13 Concurrent/retry uniqueness | PARTIAL / HIGH CONFIDENCE | DB PK/UNIQUE constraints, idempotency rows and retry tests pass; max-three DDV Profile guard uses per-account transaction advisory lock. | A true parallel-session stress test has not yet been run. |
| VS-14 Failure atomicity / downstream retry | CONFIRMED PASS | Failed publish leaves no revision/publish outbox/idempotency completion; successful publication and outbox commit together. Poison outbox event no longer blocks later events; retry uses backoff and dead-letters after five failed attempts. | Operational dead-letter review UI/alerting remains pending. |
| VS-15 Tombstone/history preservation | CONFIRMED PASS | Owner soft delete tombstones CommunityEntity, removes discovery and access, preserves published revision/comment/report history, and keeps SavedItem as inaccessible reference. | Retention/anonymization policy for account deletion remains pending. |

## Gate conclusion

The **Community backend vertical slice is substantially proven**, including a real Supabase Auth JWT round trip and real PostgreSQL command/query/notification/moderation paths.

The overall Community Phase 2 release gate is **not yet complete** because the acceptance contract requires the production-shaped app path, not only direct staging RPC/DB evidence. Remaining release-critical work is:

1. wire SvelteKit/selected server runtime to Supabase Auth/session lifecycle and the deployed Edge adapters;
2. complete actual signed media upload/finalize/read E2E;
3. connect WEP's validated Preset payload/preflight/apply path to the already-proven Community Preset envelope/Library bridge;
4. build the minimum internal Gallery/Library/notifications/report/moderation UI path and rerun VS-01..VS-15 without direct SQL test orchestration;
5. add operational handling for dead-letter outbox events and finalize account recovery/deletion retention policy.

The current public GitHub Pages deployment remains unchanged.
