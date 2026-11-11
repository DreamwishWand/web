# 01D CORE — Steam626 Tier A typed existing-field handoff (2026-11-11)

Task: W-01D-Inventory / R08. Base: protected main ef0372a58b9619a442c65b31cecbb88c3cca0029. Owner: 01D. Downstream: 01A single Rust ProductSession, 01E only evidenced producer/consumer, 05 QR-C/L scoped independent QA. Operation DEV_READY only. Writer/Apply/Cloud/Provider/CommunityPublic/MediaPublic OFF. This new code NEVER reads, decodes or writes private P1G.

## Evidence and reuse

1. Owner historical observation: an earlier v1.24.13 Inventory existing stock 50→49 edit reflected inside the game. This is an accepted historical functional precedent, NOT a re-tested original byte witness or automatic Steam1.25.3 acceptance. A redundant game-device V4 is not necessary merely to reconfirm the same elementary operation unless evidence of risk requires it.
2. PR97 merged (01B): Switch v1.25.0 / BID 52BD625D9B4E0053 / schema624 Furniture stored-object identity. GridObject.State.Storage.ContainerInventoryID links to Player.ContainerInventories, ParentItemID is Furniture ItemID. Nonempty orphan reuse and cross-grid move have specific semantics. PR98 merged (01A): restricted storage-furniture transition operations preserving full ContainerInventory and all slots. These PRs DO NOT authorize generic Chest slot mutation and are NOT Steam626 proof.
3. Current main Source 01D item-semantics-contract.mjs: Player.ListInventories[InventoryID].CompatibleItemType, Inventory[CanonicalItemID].Amount numeric raw nonnegative; zero differs from absent. CollectionSets array keyed by CollectionDefinitionID, GroupData[GroupIndex].GroupsCollectionItems[ItemID] raw bool; true/false/absent are structural only, NOT verified collected/owned/missing. CanonicalItemID may differ from presented Variation ItemID.
4. Switch624 verified fixture only: Player.ContainerInventories[ContainerInventoryID] record ID, Size, Inventory slot array of ItemID/Amount/ItemState, BelongsToPlayer, ParentItemID, ExtraSize. Player.NextContainerInventoryID and World active references independently link storage. The shape MUST be checked against a genuine Steam626 Source before any Chest write.
5. 01A current Rust ProductSession owns source build identity, full-document validation, SessionID, Revision, IndexGeneration, decoded SHA and indexed access. The new 01D adapter is an INERT REQUEST DESCRIPTOR. Every field supplied from UI/JS is untrusted, including source SHA and Session receipt; Rust MUST independently re-read and validate.

Steam target is platform Steam/Windows, gameVersion 1.25.3, buildKind SteamFullVersion, FullVersion releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22, GameInfo.Version schema626. Do NOT derive external Steam Build from GameInfo.Version or LastSaveDeviceInfo. Do NOT borrow Switch BID 9A239D3DB569756D or the older Switch schema624.

## Tier A operation matrix

| Operation | Candidate structural path | Current contract | 01A / 01E gate |
|---|---|---|---|
| Inventory.ExistingAmountDecrease (A1) | /Player/ListInventories/{InventoryID}/Inventory/{CanonicalItemID}/Amount | Existing inventory ID positive, CompatibleItemType string and oldAmount; existing positive amount only, Rust DEV conservative 1..9999, decrease to positive number only; no new entry/stock creation/increase, no writer | Rust actual Source external Build + Session/Revision/IndexGeneration/decodedSHA + original encrypted SHA; native maximum stack & variation route, exact CAS, full doc/reference validation, backup→different Edited-copy→separate-process Reopen; 01E only if proven cross-domain effects |
| Chest.ExistingSlotAmountDecrease (A2) | /Player/ContainerInventories/{ContainerInventoryID}/Inventory/{slotIndex}/Amount | Candidate only, WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE | Core recheck ContainerInventory.ID, BelongsToPlayer, ParentItemID, Size, existing Inventory slot ItemID, old Amount, opaque ItemState SHA and all active grid references; 01E if real native container recalculation required |
| Collection.InspectRawGroupFlag | /Player/CollectionSets[*]/GroupData[*]/GroupsCollectionItems[ItemID] | RAW bool/ABSENT read, no writer | Native GetNewGroup/ignored/IsValidItemForCollection/availability/GroupIndex before ownership interpretation |
| Ownership.Change | UNKNOWN | WAIT_EVIDENCE | Saved/native ownership representation, cross-domain dependents, Provider entitlement exclusions |
| Variation.Change | UNKNOWN | WAIT_EVIDENCE | Canonical vs displayed ItemID variation/native vtable resolution |
| Group.Change | UNKNOWN | WAIT_EVIDENCE | Native category and producer/consumer evidence |
| Appearance.Change | UNKNOWN | WAIT_EVIDENCE | Genuine Steam626 edited field, old value, dependent consumer |
| Wardrobe.Change | UNKNOWN | WAIT_EVIDENCE | Genuine Steam626 outfit/equip state and ownership, no external entitlement |
| OwnedSkin.Select | UNKNOWN | WAIT_EVIDENCE | Player-owned-only Skin choice, same-build Native consumer/receipt exclusions |

A1 and A2 are intentionally the ONLY named scalar candidate descriptors. Current parallel 01A draft PR914 (not independently accepted or merged) defines Rust DEV variants InventoryExistingAmountDecrease and ChestExistingSlotAmountDecrease, names inventory.existing.amount.decrease@1 and chest.existing.slot.amount.decrease@1. This 01D Source emits exact corresponding snake_case NativeDevCommand fields as a nonauthoritative proposal. Source PR914 enforces positive ids, positive decreases with old<=9999, native String CompatibleItemType excluding protected classes and Chest Size==Inventory.length<=256; strict 01D preflight is aligned, but 01A may still revise its Source. A2 does not infer current Steam626 Chest legality from Switch624 tests. Its synthetic size must exactly equal the number of actual Inventory slots (not merely at most Size) and be bounded to 256, matching the current unmerged 01A DEV source. Every ItemState and active reference still requires 01A/01B genuine verification. No operation can call a Rust writer via this module. The contract name is wand.01d.tier-a-existing-field-request@1; all proposals report writerAuthorized=false, exportAuthorized=false, productOperationEnabled=false and authoritativeCoreValidationRequired=true.

## Rust 01A proposed interface (not yet implemented ABI)

Input: bounded target external identity, originalEncryptedSha256, one Rust ProductSession snapshot (SessionID, Revision, IndexGeneration, decodedSHA), and one existing scalar entry command with exact keys. The descriptor returns a single leaf JSON-pointer allowlist, expected oldAmount and candidate newAmount, and a typed readset that Rust MUST re-verify against its own current original data. The input is not trusted simply because strings resemble hashes or session IDs.

01A must independently enforce: authenticated original Steam build; Version/schema; session ownership, full decoded document validation, current stale Revision/IndexGeneration, exact old value CAS and canonical ItemID/CompatibleItemType; permitted non-premium stock/ownership/Native stack bounds; no double ownership or invented slot; full-document exact diff; atomic one-time Edited-copy to a different filename; original backup and SHA invariant; separate-process decode/Reopen; 05 QR-C and QR-L scoped independent acceptance. Neither this proposal nor synthetic CI proves actual Native V2/V3/Writer gate.

For Chest preserve ItemState and every unrelated slot/field EXACTLY, and do not create/delete/reorder slots or copy ContainerInventoryID between saves. A2 MUST remain WAIT until genuine Steam626 fields + proper active reference evidence are available. For Collection, Variation, Ownership, Group, Appearance, Wardrobe and Skin no guessable edit path may be emitted; use native evidence/typed Group and owner-only exclusions.

## Focused positive and negative tests

Synthetic positive: Inventory existing 50→49 produces exact Amount leaf and readset; Chest existing 10→9 produces one Amount leaf with ParentItemID/Size/BelongsToPlayer/ItemState/active-reference obligations yet still WAIT. Neither emits an editable product operation.

Fail-closed negatives: wrong Switch/Steam Build, schema624, malformed SHA, forged session fields, stale or negative Revision, amount zero/negative/fractional/overflow above 9999, unchanged/increased count, unknown/zero/string ItemID, missing entry, compatible item type mismatch shape, forged DLC/Premium/Receipt/Entitlement/ownership extra keys, Chest foreign owner, capacity overflow, index out of bounds, multiple active references, accidental Slot/Container creation, unrecognized operation, claimed authorized Writer or public image.

## Ownership, gates and rollback

01D adds only versioned pure typed-contract source, synthetic focused tests, technical handoff, and focused CI. 01A ProductSession Rust source remains untouched; 01C Road/Fence untouched. 01E request only when a specific Native consumer/producer or required cross-domain recalculation is proven; no artificial Tier B blocker.

05 QR-C separately validates any new Rust adapter only. 05 QR-L independently checks genuine private Steam Edited-copy/Reopen when 01A authorizes scope; original Save never enters public Actions. 09 INT is sole selective Merge owner and reuses already accepted ancestors. Rollback removes only this additive descriptor/tests/doc/workflow; protected Pages and all Owner private sources preserved. All production Writer, Apply, Cloud, Provider, CommunityPublic and MediaPublic flags remain OFF.


## Concurrent 01A DEV variant exact mapping (not product authority)

- 01D Inventory.ExistingAmountDecrease → 01A InventoryExistingAmountDecrease:
  inventory_id / canonical_item_id / expected_compatible_item_type / expected_old_amount / new_amount.
- 01D Chest.ExistingSlotAmountDecrease → 01A ChestExistingSlotAmountDecrease:
  container_id / slot_index / expected_item_id / expected_old_amount / new_amount.
- 01A PR914 ProductSession DEV Rust semantic writer is **not** a received/current main ABI and its synthetic success is not real Steam Edited-copy. Its own checks of container ParentItemID, Size, slot ItemID and Owner are useful inherited Source evidence; 01D still requires the richer ItemState/active ref readset, and deliberately does not authorize a Chest product edit.
- Source 01A CLI and Cargo feature semantic-writer-dev are separate from public worker-wasm and must remain OFF. Re-evaluate fixed Source HEAD when 01A completes independent QA, do not duplicate its Rust code or create a competing executor.
