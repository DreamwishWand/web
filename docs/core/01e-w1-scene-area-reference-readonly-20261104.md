# 01E CORE — W1 SceneItemId → saved Area/Grid reference (read-only)

**Scope:** Nintendo Switch DDV v1.25.3; external BID `9A239D3DB569756D`, profile schema 626, W1 EventID `2010000021` (original Registry `Wood!Wetland_Softwood`). This is an additional **SOURCE_ONLY** structural guard, not an Editor, Native emulator, provenance authenticator, runtime capability, or V3 acceptance.

## Why this exact link matters

The same-BID original GameData `RecurringEvent.json` event selects `VillageRestriction.SceneID=1540000000` (Village04) and `AreaSpecification.SpecificAreas=[VillageAreaType.Wetland=1]`. The saved schema626 `World.Villages` is an **array**, where the Village record has `SceneItemId` and `Areas`, and each `Areas[areaKey]` has `GridIDs[]` and a saved `Unlocked` boolean.

The function `inspectW1SceneAreaReferences(profile, sourceContext)` requires one and only one `World.Villages[*].SceneItemId===1540000000`, then enumerates the matching source record's canonical decimal Area keys and referenced GridIDs. It verifies `World.GridCollection.Grids`/ `DiffGrids` dictionary membership and each object's `ID` field. It reports `GRIDS_ONLY`, `DIFF_ONLY_DEFAULT_UNRESOLVED` or `GRIDS_AND_DIFF_UNRESOLVED`. No actual raw Save bytes, GridIDs, personal object placements, crypto key, account data or decrypted JSON are included in this repository.

The enumeration is not an authorization oracle. **Native enum Wetland=1 is not independently proven to be the same ID system as the saved `Areas["1"]`.** A numerically matching string is not a Native semantic check. `Unlocked` is the saved flag, not a verified game event-ready/Quest/Tree/Quota state. The source SHA/Revision passed by a caller are consistency hints only, not proof of a real encrypted P1G SHA, full decoded SHA or Core-issued Session/Revision. The function never authorizes changes and never normalizes the intentional future year 2126.

## Remaining W1 Native V3 and operation gates

1. Resolve the exact same-build native **VillageAreaType → Saved Area ID** mapping (the last ID bridge, distinct from the SceneItemId match), and check any game conditions/scene membership.
2. Validate actual original installed external `GridData/GridDefaultLayoutPath` source bytes and SHA, `Grids` precedence, `DiffGrids` default + `ModifiedObjects` − `RemovedObjects`, eligible Tree!Any tag 2001200008 radius4, collisions, Softwood 31700014 effective quota and producer/owner grouping across eight distinct event definitions.
3. Validate Clock/Now host vs local, startup `ActualizeRecurringEvents`, authoritative `ExecuteRecurringEvent` positive/negative, LastOccurrence stamp and NextOccurrence Reschedule/re-arm after a real game cold save/reopen. Static original ELF call edges are **SOURCE_ONLY**. This is not settled by any read-set hash.
4. Actual product Writer requires original encrypted/decoded SHA, external version/BID/schema and authentic Registry/Tag/Scene, trusted Core single Session/Revision/IndexGeneration and operation-specific dynamic CAS, exact old lexical/decoded Next UTC, `LastOccurrence` and nullable `EndDate` pinned, atomic one-field exact diff, unchanged unknown data, original-first backup, separate modified P1G file with independent reopen, per-operation independent 05 QR and 00 CTRL enablement. Only proposed future edited path is `/World/RecurringEvents/155/ItemSpawning/NextOccurrence`, **not currently authorized**.
5. V4 only for a remaining exact cold-game load/Tree-Quota behavior that cannot be settled offline, with separate Owner permission. Native V3, Device V4 and Product Writer/Edited-copy Export/Apply/OriginalOverwrite remain **OFF**.

## Test and evidence discipline

Run `node --test tests/01e-w1-scene-area-reference-readonly.test.mjs`. Synthetic cases cover unique SceneID match, exact Version/BID/schema, optional area `"1"` without Native membership assertion, missing/duplicate/forged SceneID, duplicate/noncanonical Area and Grid map IDs, missing/unverified Diff-only default/overlap, caller-forged Native/Writer flags and unchanged 2126. **No genuine private P1G appears in CI.**

A separate, original-SHA-checked **Owner-private read-only P1G inspection** is recorded in the private SSoT rather than in GitHub. Its successful SceneItemId link is a **REAL_SAVE structural V1 observation** and must not be promoted to Native gameplay V3, real Rust product edited-copy V2 or Device V4. Previous PR459/QA464 (Registry event→Item) and PR465/QA471 (Spatial candidate grouping) have independent scoped SOURCE_ONLY acceptance and must not be rerun as part of this delta.
