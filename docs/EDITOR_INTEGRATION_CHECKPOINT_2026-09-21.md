# Dreamwish Wand — Editor integration checkpoint (2026-09-21)

## Repository and baseline

This **private** repository's `main` is the initial SvelteKit scaffold. It is **not** the executable local standalone Inventory v0.6 plus UI deltas. Do not claim that a functioning save editor, the Browser ProfileCodec, Game DB, or completed EditorSession exists in `main` or in this branch.

The latest locally assembled functional UI chain evaluated separately was `Standalone Inventory v0.6 → v0.6.2 canonical UI → Home Controls Fix → Footer Compact → Save Session UI → Inventory MVP staged quantity → Editor Entry/Backpack delta`. The separate v0.6.3 Layout/Flag/Theme delta is an alternative branch from v0.6.2 and has not been reconciled. The complete v0.6.1 original bundle is not independently available for byte-equivalent reconstruction.

Latest local patch in DDVRE Drive: `05_TOOLS/WebTools/DreamwishWand/DreamwishWand_Editor_Entry_Backpack_Delta_on_Inventory_MVP_2026-09-21.zip`. Its MANIFEST contains before/after SHA-256 for six changed/additional UI files; apply only after matching those before hashes. It must **not** be copied directly over this SvelteKit repo.

## Changes in this private branch

- `src/lib/editor/backpack-slots.mjs`: read-only `ContainerInventory.Size` slot projection; unknown materialized entries are never shown as writable empties; no save mutation.
- `tests/backpack-slots.test.mjs`: projection regressions; test execution in this GitHub branch still pending.
- `src/routes/editor/+layout.svelte`: editor header's inner width uses available viewport width. Existing scaffold styling remains otherwise unchanged.

No public repository, original save or production deployment has been changed. Do not merge this branch or turn on public editing solely on the strength of this scaffold change.

## Work remaining before integration

1. Reconcile this SvelteKit frontend with the **actual** standalone v0.6.x bundle, its bundled Game DB and verified original-format ProfileCodec. Choose one canonical current implementation and prevent stale scaffold routes from masquerading as the completed editor.
2. Implement a real shared in-memory `EditorSession` and a single local file import pipeline for Home/header/drop, with candidate validation before replacing the existing session. One OS file selection must load automatically; Editor must show Inventory/World/Misc selection with unfinished tools disabled.
3. Render the game-sized seven-column Backpack with the real save's logical `Size`, thumbnails and editable existing item slots; share a verified item-insertion planner and preserve unknown fields. Do not infer addability from an empty-looking grid cell.
4. Run Windows Edge file:// and served-web smoke, real-file read/edit/export/re-import, and representative 16:9, 16:10, 3:2/zoom UX checks. New local delta currently passed only pure JS tests and about:blank synthetic DOM; true iframe/file:// transfer, Windows usage and edited-device acceptance remain unverified.
5. Next: StorageIndexer (placed/stored/unresolved identity), item→chest contents search, then versioned EffectiveGrid location mapping; start with one densely furnished room before general outdoor map. Keep original v1.24.13 evidence for the September 23 migration.

Canonical decisions: https://docs.google.com/document/d/1II3Kl0cSkkVJL7uxDCWmIDwPfMUyKDx4NoRYKz6mHSQ/edit
