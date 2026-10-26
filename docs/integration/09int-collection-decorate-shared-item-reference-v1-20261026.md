# 09 INT — Collection → Decorate shared Item Reference Link Contract
2026-10-26 JST · Existing 09 INT workstream · Source-only Draft · DO_NOT_MERGE / DO_NOT_DEPLOY

## Canonical identity, evidence, target

- 01D canonical Switch v1.25.0 Game DB contains **17,413 unique ItemIDs**, Tag catalog **397**, Set catalog **711**, with 8-locale labels, World, Universe, Expansion and provenance; core authoritative query index SHA256 `f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e`. Those are NOT 17,413 Collection entries.
- 08 WEB PR192 supplies existing `wand.collection.runtime@1` index and `wand.collection.records@1` decoded source records (12,552 Collection ItemIDs in 18 shard files, SHA256/byte-count checked at fetch), with current source manifest `COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2`; Switch 1.25.0 BID `52BD625D9B4E0053` / profile schema 624. PR192 baseline HEAD `f5647ea4d05fa26afcf3cf57933a1df09a101c18`, CI40313316025 and actual Chrome40313315995 SUCCESS. No new Item record model created; 09 INT imports the exact existing Collection decoder/validator. Collection item stateClass TRACKED/READ_ONLY is public reference classification and **NOT** Owned/Missing/Discovered proof.
- v1.25.3 Switch BID `9A239D3DB569756D`/schema626 only scoped read-only Core, NOT this Collection projection; Steam ItemID parity unknown. All cross-build/platform equality assumptions forbidden.

## Single read-only `wand.shared-item-reference@1` contract

Implementation: `src/lib/collection/shared-item-reference.js` plus 8-locale copy `shared-item-link-copy.js`, imported by both `/collection/` and `/explore/`. Uses existing common decoded records, canonical ItemID positive safe integer with canonical decimal encoding, validated Collection source manifest, platform/version/build, unique exact record and optional source/target record's family + *ordered* World/Universe/Expansion facets. It does not materialize another Item/Creator/Preset model or store a persistent cross-product registry.

- `resolveSharedItemLink({index,records,itemId,from:'collection',to:'decorate',basePath,sourceRecord,requestedTarget})` -> `{status:'linked',href:'/explore/?item=40200525',identity:{kind:'DDV_ITEM_ID',itemId:40200525,platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'}}` **only if** same checked record is in one of actual Explore decorating families [Buildings,Furniture,Landscaping,Roads & Fences,Touch of Magic,Wallpaper & Flooring]. 08 WEB adds one localized link to Collection Detail; Explore incoming exact canonical `?item=` opens existing Quick Review only if verified; invalid/unknown/wrong Build does not select item. No new Word Editor mutation handoff or placement authorization.
- `resolveSharedItemLink({index,records,itemId,from:'decorate',to:'collection',sourceRecord})` -> `/collection/?item=40200525`, reused existing PR192 Detail without ownership or media assertions. The item number is a fixture from **checked-in** `records-08.json`, not a made-up mapping. Collection workspace remains one Category(default)/World/Universe alternate view.
- Both directions are *reference-only*. Presence in static Game DB or Collection is not game availability, owned state, entitlement, native placement legality, rights-cleared artwork, online provenance or evidence that an item is usable in a particular save. Explicit RETIRED/UNAVAILABLE/WITHDRAWN rejects; absence of an explicit retirement signal is not proof of obtainable state. Source version mismatch, unsupported item/family, missing record, duplicate ItemID, conflicting family/world/universe/expansion mapping, malformed/noncanonical IDs, unsafe base paths fail closed.
- `resolveRelatedItemLink` needs an **explicit** unique versioned reviewed **01D item–Tag/Set–item relation** with source+target positive ItemIDs, exact Tag/Set numeric relation ID, authority and 64-char evidence hash. 01D Query Index **contains Tag/Set records** but checked-in 12,552 Collection projection does NOT carry per-item Tag/Set edges; **no actual Related Items links are published** until reviewed machine join edges are supplied. Same family/World/Universe/locale label is NOT a relationship or item ID.
- Guide `resolvePublishedGuideItemLink` accepts only a unique `DDV_ITEM_ID` item→Page edge marked `APPROVED_PUBLIC` with same platform/build AND an independently reviewed Page in a public allowlisted Guide detail route with `publicationState=PUBLISHED_APPROVED` + `publicRouteApproved=true`. Current 07 DBK articles all private: human QA0/315, rights0/45, public0/45. Both approved registries currently default **empty**, hence runtime outputs no Guide links. User-visible private draft leakage / guessed page routes prohibited.

## Distinct identities and safety

No implicit conversion between:
1. native canonical ItemID for 01D/Collection/Explore/WEP reference;
2. Collection Category Entry/facet dictionary index or World/Universe key;
3. Gallery `gallery_verified_subjects.subject_id` and typed `canonical_target_id`/ToM baseItemId (different registry and publication authority, requiring reviewed 01D type proof);
4. Room identity (save/HouseItemID/floor/RoomSlot and local Grid IDs);
5. ToM design `Design.Id`/motif/owned instance versus base ItemID;
6. preset artifact/revision UUID, Wand WorkID/object, World Editor `editorId` and logical instance IDs;
7. 01D Tag/Set identifiers and the separate item endpoints.

No Gallery Work, Guide public entity, Storage Provider, Community Registry, profile, ownership or Native Save Writer mutations made here.

## Consumer/QR acceptance

New `tests/09int-shared-item-reference-link.test.mjs` uses checked-in real Switch1250 index and shard 08 plus genuine PR192 Collection selection to verify both link directions, localized source decoding and negative paths: unknown ID, malformed, numeric overflow, duplicate, conflicting source/target (including World/Universe), retired/unavailable, unsupported Switch1253/Steam and wrong build/manifest, Room/Design/subject/Preset IDs not convertible, no guessed Tag/Set, private/unpublished/unapproved/unsafe Guide, duplicate Guide mapping. The synthetic *positive Guide* unit-case explicitly supplies hypothetical approved registry to verify a future gate, not a claim any public Guide exists.
08 WEB: link is a static source-backed navigation, no personal ownership/permission; ensure 8 locales/keyboard/320px (browser acceptance when available) and URL direct-load/Back/refresh. 04 QR: version/source tamper negative, no leakage of private Guide pages, no real inventory assertion, duplicate/mismatched IDs, and ensure World Editor persistent Writer remains OFF; Chrome signed save/provider/Community publish E2E is separate blocked scope. Release R17 PASS0/PARTIAL12/BLOCKED18 unchanged.

## Not closed

Full 01D 17,413-item mapping against Collection 12,552 subset, reviewed Tag/Set related edges, per-item retirement/actual availability, v1253/Steam parity, Guide article-to-Item public relationship, ownership/profile/Cloud/linked account, item images/media rights, detailed Native world-instance ability remain UNKNOWN. Do not auto-link across Product identity types.

This PR must target the exact 08 WEB PR192 branch, NOT overwrite its existing read-only implementation and not merge before WEB+QR acceptance. All Draft DO_NOT_MERGE/DEPLOY, Native Apply/Writer, Positive Publisher, Cloud, Physical Cleanup OFF.
