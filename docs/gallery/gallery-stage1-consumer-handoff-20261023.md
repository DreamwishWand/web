# 08 WEB — Gallery Stage 1 Publish/Manage Consumer — 2026-10-23

## Scope / evidence
- Active: `08-WEB-GALLERY-STAGE1-PUBLISH-MANAGE-CONSUMER-V1`
- Base: `52166f81c107de66dbfab8a6c16aaecc33b21ee0`
- Product authority: `GALLERY-FINAL-01..11`, CLOSED for UX; this does not authorize API semantics changes.
- Status: **PARTIAL**, NOT signed publication or production release accepted.

## Implemented UI
- Gallery root: exactly Decorations / Touch of Magic / My Gallery. DreamSnaps legacy path redirects to independent DreamSnaps Product.
- Decorations discovery All / Outdoor / Indoor; ToM discovery All / Furniture / Clothing; scoped public search, image-first cards via existing public detail/media boundary, loading/empty/error/retry.
- Visible Publish Work entry per discovery surface.
- Responsive photo-only composer with Content/Classification → Images/Presentation → Card/Detail Preview; truthful specific target and ToM Base Item entry; 1–10 JPEG/PNG/WebP selection, duplicate rejection, keyboard-accessible image reorder, cover as first image, removal, no implicit upload or browser/server draft; title/description and originality attestation.
- My Gallery: signed My Works / Saved, category/search, owner menu, View Work; authorized Community comments-enabled toggle; Unsave via existing command.
- Explicit unavailable states on unsupported initial Publish, immutable Publish Update, linked deletion, cloud-private conversion. Disabled or fail closed rather than create misleading Work.
- One shared Community HTTP client and shared locale/runtime (8 catalogs), shared Sheet/OverflowMenu/A11Y shell; no separate work/auth/locale persistence.
- Direct signed production E2E remains CONFIGURATION_BLOCKED (missing authorized staging credentials + disposable signed actors). Unsigned browser tests do not count as signed API pass.

## Confirmed available Community capabilities
- `createGalleryWork` → `community_create_gallery_work_v1`, initially `draft/public` row. **Do not invoke for classified photo-only until server subject contract is valid.** Creates an otherwise orphaned draft on abandoned flow.
- `publishGallery` → `community_publish_gallery_v4`; accepts title, description, media IDs (1–10), existing Gallery kind, optional preset link, used/featured item lists. Critically DOES NOT accept verified Outdoor Biome/Floating Island, Indoor Room or confirmed ToM single Base Item classification.
- `publish_gallery_v4` only accepts lifecycle `draft` or `unpublished`, **not `published`**. It therefore cannot implement immutable Publish Update of a live Work.
- `community_get_gallery_public_v1`, `community_search_public`, `community-public-media`: public discover/detail/media when available.
- Authenticated `myGallery` and `gallery` queries; `unsaveEntity`, `setGalleryCommentsEnabled` existing server-authorized commands.

## Blocking owner contracts / requests
**03 COMM**:
1. A typed server-authorized direct photo-only creation/publication transaction or versioned preflight, accepting and persisting ONE game-DB validated Outdoor Biome/Floating Island, Indoor Room, or a supported ToM Base Item ID with verified Furniture/Clothing type; differentiate creator claim from verified provenance. No client-synthesized motif/native Design ownership. PUBLIC only, 1–10 owner media, immutable public revision, idempotency + upload cancellation/cleanup + moderation/rights/processing.
2. Atomic Publish Update of a `published` Work (live prior revision remains until successful commit; optimistic version/idempotent conflict/retry; stable Work ID/subject/Creator/social graph; no retargeting to unrelated subject).
3. Atomic public retirement of Work plus dependent public Preset/ToM/native listings/URLs/search/Saved media access, fail-closed at shared public access boundary even during asynchronous cleanup. Destructive impact-preflight + audit/retention/retry + separate Cloud-private-preservation capability, not reinterpret `unpublishWork` as Cloud entitlement. Free public Delete remains available.
4. Owner-safe Gallery Work cover/ordered media and exact Like/Save/Comment aggregate projections, without exposing saver identities or private album membership; full Saved album reference management and reliable card image projections. Current search index exposes title/kind but not cover; UI currently resolves public cover through bounded extra public calls.
5. Creator original screenshot/rights validation, genuine ToM Base Item catalog mapping, public URL/SEO canonical route + media CDN/policies, upload size/format enforcement and rate limits; no false automatic authenticity assurance.

**09 INT**:
6. Verified single-Work Presets/ToM/native atomic first Publish/revision relation, Related Preset only on positively authorized reusable artifact. Public Work retirement cross-product dependent listing transaction; Preset-only delist leaves photo-only Work publicly visible with stable social identity, and DDV-issued share code expiry never falsely revoked.
7. Supply precise authoritative, versioned selectable Biome/Floating Island/Room and ToM game-DB Base Item mapping to 08 WEB UI instead of free-text target/number. Unknown/unsupported fail closed.

**04 QR**:
8. With first-party browser staging variables `DREAMWISH_SUPABASE_URL` + `DREAMWISH_SUPABASE_PUBLISHABLE_KEY` and authorized disposable actors: exercise real signed upload/classification/revision/delete/revocation, older revisions, RLS, media retention, moderation/report, authentic screenshot, creator privacy, keyboard/screen reader, 8 locales/320px and seed. Browser SUCCESS with signed assertions skipped != signed PASS.

## Safety invariants
- No FREE persistent server-private Gallery draft, UNLISTED/follower-only options, Work-to-Moodboard artificial membership, DreamSnaps Gallery child, fabricated ToM Design/Motifs, new backend/permissions schema in 08 WEB.
- No persistent DDV save writer changes; unsupported DDV v1.25.3 writer remains fail-closed.
- Current public Gallery detail uses legacy `/gallery/?work=ID` URL; canonical per-Work SEO route and redirect must be 09 INT / routing acceptance, not fabricated here.
