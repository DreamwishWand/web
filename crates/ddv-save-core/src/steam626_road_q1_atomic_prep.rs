//! 01A ACT1664 Steam626 ordinary Road 40100068 single-Q1 atomic PREPARATION.
//! No Stage, mutation, inventory debit, Rights admission, Export, Worker method,
//! typed Registry permission, or user-facing feature is implemented here.
//! The snapshot parameters below are UNTRUSTED CAS candidates, NOT Core-minted
//! target/geometry/rights witnesses. Future Stage must mint the real target
//! and verify external provider rights + indirect subscribers before applying.
//! The single existing ProductSession supplies only identity/epoch/source CAS.
use super::{BuildKind, Platform, ProductSession, WorkerAction, WorkerEnvelope};
use crate::{CoreError, CoreResult};
use serde_json::Value;
use sha2::{Digest, Sha256};
use super::indexed_read::{self, Span};

#[path = "road_mixed_shape.rs"]
mod road_mixed_shape;

const EXACT_STEAM: &str =
    "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const ITEM_ID: u32 = 40100068;
const GRID: u32 = 1;
const AREA: u32 = 6;
const STOCK_MAX: u32 = 9999;

/// Untrusted, typed expected-old inputs. None of these fields is a right or
/// a substitute for an indexed/read-only Core-minted physical target.
#[derive(Clone, Copy, Debug)]
#[allow(dead_code)]
pub(super) struct RoadQ1ExpectedOld {
    pub(super) envelope: WorkerEnvelope,
    pub(super) source_sha: [u8; 32],
    pub(super) area: u32,
    pub(super) grid: u32,
    pub(super) next_object_id: u32,
    pub(super) stock: u32,
    pub(super) x: u32,
    pub(super) y: u32,
    pub(super) root_sha: [u8; 32],
    pub(super) grid_sha: [u8; 32],
    pub(super) stock_sha: [u8; 32],
    pub(super) refs_sha: [u8; 32],
    pub(super) ambient_sha: [u8; 32],
}

/// Proposed exact3 changes only. All public/auth flags are deliberately absent.
/// This type cannot be passed as a Writer command; no caller gains a capability.
#[derive(Clone, Debug, PartialEq)]
#[allow(dead_code)]
pub(super) struct RoadQ1ReadOnlyPreparation {
    pub(super) proposed_object: Value,
    pub(super) expected_new_id: u32,
    pub(super) expected_next_after: u32,
    pub(super) expected_stock_after: u32,
    pub(super) proposed_changed_targets: usize,
    pub(super) stage_authorized: bool,
    pub(super) export_authorized: bool,
}

fn denied(message: &'static str) -> CoreError { CoreError(message) }

fn raw<'a>(b: &'a [u8], span: Span) -> CoreResult<&'a [u8]> {
    b.get(span.begin..span.end).ok_or(denied("ROAD_Q1_OLD_SPAN"))
}
fn field_opt(b: &[u8], parent: Span, name: &str) -> CoreResult<Option<Span>> {
    if parent.end <= parent.begin + 1 || parent.end > b.len()
        || b.get(parent.begin) != Some(&b'{')
        || b.get(parent.end - 1) != Some(&b'}') {
        return Err(denied("ROAD_Q1_OLD_OBJECT_REQUIRED"));
    }
    let mut pos = parent.begin + 1;
    let mut budget = 0usize;
    loop {
        pos = indexed_read::skip_ws(b, pos);
        if pos == parent.end - 1 { return Ok(None); }
        budget += 1;
        if budget > 100_000 || pos >= parent.end - 1 {
            return Err(denied("ROAD_Q1_OLD_OBJECT_BOUND"));
        }
        let key_end = indexed_read::string_end(b, pos)?;
        if key_end - pos > 128 { return Err(denied("ROAD_Q1_OLD_KEY_BOUND")); }
        let key: String = serde_json::from_slice(raw(b, Span { begin: pos, end: key_end })?)
            .map_err(|_| denied("ROAD_Q1_OLD_KEY"))?;
        let colon = indexed_read::skip_ws(b, key_end);
        if b.get(colon) != Some(&b':') { return Err(denied("ROAD_Q1_OLD_COLON")); }
        let begin = indexed_read::skip_ws(b, colon + 1);
        let end = indexed_read::value_end(b, begin)?;
        if end > parent.end - 1 { return Err(denied("ROAD_Q1_OLD_FIELD_BOUND")); }
        let next = indexed_read::skip_ws(b, end);
        let span = Span { begin, end };
        // ProductSession already performed full-document duplicate-key denial.
        if key == name { return Ok(Some(span)); }
        match b.get(next) {
            Some(b',') if next < parent.end - 1 => pos = next + 1,
            Some(b'}') if next == parent.end - 1 => return Ok(None),
            _ => return Err(denied("ROAD_Q1_OLD_FIELD_DELIMITER")),
        }
    }
}
fn field(b: &[u8], parent: Span, name: &str) -> CoreResult<Span> {
    field_opt(b, parent, name)?.ok_or(denied("ROAD_Q1_OLD_FIELD_MISSING"))
}
fn integer(b: &[u8], span: Span) -> CoreResult<u32> {
    let bytes = raw(b, span)?;
    if bytes.is_empty() || bytes.len() > 10 ||
        !bytes.iter().all(u8::is_ascii_digit) ||
        (bytes.len() > 1 && bytes[0] == b'0') {
        return Err(denied("ROAD_Q1_OLD_UINT_CANONICAL"));
    }
    std::str::from_utf8(bytes).map_err(|_| denied("ROAD_Q1_OLD_UINT_UTF8"))?
        .parse::<u32>().map_err(|_| denied("ROAD_Q1_OLD_UINT_BOUNDS"))
}
fn digest(b: &[u8], span: Span) -> CoreResult<[u8; 32]> {
    Ok(Sha256::digest(raw(b, span)?).into())
}
/// Validate the saved object's own identity namespace, not just the
/// absence of the next candidate key. This is ID arithmetic only, NOT
/// authoritative geometry / references / floor / rights validation.
fn verify_existing_object_ids(b: &[u8], objects: Span, next: u32) -> CoreResult<usize> {
    if b.get(objects.begin) != Some(&b'{') ||
       b.get(objects.end.saturating_sub(1)) != Some(&b'}') ||
       objects.end > b.len() {
        return Err(denied("ROAD_Q1_OBJECTS_MAP_REQUIRED"));
    }
    let mut pos = objects.begin + 1;
    let mut count = 0usize;
    loop {
        pos = indexed_read::skip_ws(b, pos);
        if pos == objects.end - 1 { return Ok(count); }
        count += 1;
        if count > 250_000 || pos >= objects.end - 1 {
            return Err(denied("ROAD_Q1_OBJECT_COUNT_BOUND"));
        }
        let key_end = indexed_read::string_end(b, pos)?;
        if key_end - pos > 32 { return Err(denied("ROAD_Q1_OBJECT_KEY_BOUND")); }
        let key: String = serde_json::from_slice(raw(b, Span { begin: pos, end: key_end })?)
            .map_err(|_| denied("ROAD_Q1_OBJECT_KEY_PARSE"))?;
        let id = key.parse::<u32>().map_err(|_| denied("ROAD_Q1_OBJECT_KEY_UINT"))?;
        if id == 0 || id >= next || key != id.to_string() {
            return Err(denied("ROAD_Q1_OBJECT_ID_NAMESPACE"));
        }
        let colon = indexed_read::skip_ws(b, key_end);
        if b.get(colon) != Some(&b':') { return Err(denied("ROAD_Q1_OBJECT_COLON")); }
        let begin = indexed_read::skip_ws(b, colon + 1);
        let end = indexed_read::value_end(b, begin)?;
        if end > objects.end - 1 { return Err(denied("ROAD_Q1_OBJECT_SPAN")); }
        if integer(b, field(b, Span { begin, end }, "ID")?)? != id {
            return Err(denied("ROAD_Q1_OBJECT_VALUE_ID_MISMATCH"));
        }
        let after = indexed_read::skip_ws(b, end);
        match b.get(after) {
            Some(b',') if after < objects.end - 1 => pos = after + 1,
            Some(b'}') if after == objects.end - 1 => return Ok(count),
            _ => return Err(denied("ROAD_Q1_OBJECT_DELIMITER")),
        }
    }
}
#[derive(Clone, Copy)]
struct ActualRoadQ1Readset {
    next: u32, stock: u32,
    area_sha: [u8; 32], grid_sha: [u8; 32], stock_sha: [u8; 32],
}
/// Authenticate a deliberately limited subset of old values from the SAME
/// immutable Rust-owned decoded document. Geometry/halo/rights/ref subscriber
/// closure are still unknown. No edit, new SaveSession or second Engine.
fn read_actual_old(b: &[u8]) -> CoreResult<ActualRoadQ1Readset> {
    let roots = indexed_read::roots(b)?;
    let villages = field(b, roots.world, "Villages")?;
    if b.get(villages.begin) != Some(&b'[') ||
       b.get(villages.end - 1) != Some(&b']') {
        return Err(denied("ROAD_Q1_VILLAGES_REQUIRED"));
    }
    let vi = indexed_read::skip_ws(b, villages.begin + 1);
    if vi >= villages.end - 1 { return Err(denied("ROAD_Q1_VILLAGE_EMPTY")); }
    let village = Span { begin: vi, end: indexed_read::value_end(b, vi)? };
    if village.end >= villages.end { return Err(denied("ROAD_Q1_VILLAGE_BOUND")); }
    let area = field(b, field(b, village, "Areas")?, "6")?;
    if raw(b, field(b, area, "Unlocked")?)? != b"true" {
        return Err(denied("ROAD_Q1_AREA_LOCKED"));
    }
    let ids = field(b, area, "GridIDs")?;
    if ids.end - ids.begin > 512 { return Err(denied("ROAD_Q1_GRID_IDS_BOUND")); }
    let grid_ids: Vec<u32> = serde_json::from_slice(raw(b, ids)?)
        .map_err(|_| denied("ROAD_Q1_GRID_IDS_TYPE"))?;
    if grid_ids != [GRID] { return Err(denied("ROAD_Q1_GRID_ROOT_MISMATCH")); }

    let gc = field(b, roots.world, "GridCollection")?;
    let grid = field(b, field(b, gc, "Grids")?, "1")?;
    if integer(b, field(b, grid, "ID")?)? != GRID {
        return Err(denied("ROAD_Q1_GRID_ID_MISMATCH"));
    }
    if integer(b, field(b, grid, "TessellationFactor")?)? != 2 ||
       raw(b, field(b, grid, "GridDefaultLayoutPath")?)? != b"\"\"" {
        return Err(denied("ROAD_Q1_GRID_LAYOUT_DENIED"));
    }
    let diff = field(b, gc, "DiffGrids")?;
    if field_opt(b, diff, "1")?.is_some() {
        return Err(denied("ROAD_Q1_GRID_OVERLAY_DENIED"));
    }
    let next = integer(b, field(b, grid, "NextGridObjectID")?)?;
    if next == 0 || next.checked_add(1).is_none_or(|v| v > i32::MAX as u32) {
        return Err(denied("ROAD_Q1_ACTUAL_COUNTER_BOUND"));
    }
    let objects = field(b, grid, "Objects")?;
    // A single stale/noncanonical saved Object ID makes a prospective
    // NextObjectID unsafe even when the literal "next" key is absent.
    verify_existing_object_ids(b, objects, next)?;
    let route = field(b, field(b, roots.player, "ListInventories")?, "0")?;
    if integer(b, field(b, route, "ID")?)? != 0 {
        return Err(denied("ROAD_Q1_CATALOG0_MISMATCH"));
    }
    let entry = field(b, field(b, route, "Inventory")?, "40100068")?;
    let stock = integer(b, field(b, entry, "Amount")?)?;
    if stock < 2 || stock > STOCK_MAX {
        return Err(denied("ROAD_Q1_ACTUAL_STOCK_BOUNDS"));
    }
    Ok(ActualRoadQ1Readset {
        next, stock,
        area_sha: digest(b, area)?,
        grid_sha: digest(b, grid)?,
        stock_sha: digest(b, entry)?,
    })
}

impl ProductSession {
    /// Bounded non-authorizing sketch. Does NOT scan/validate the ambient
    /// halo, grid occupancy, counter aliases, provider entitlement or game
    /// subscriber effects. Therefore this never authorizes Stage or Export.
    /// Do not promote this result to a Core-minted target.
    #[allow(dead_code)]
    pub(super) fn prepare_steam626_road_single_q1_readonly(
        &self,
        old: RoadQ1ExpectedOld,
    ) -> CoreResult<RoadQ1ReadOnlyPreparation> {
        let build = &self.native_source_build;
        if build.platform != Platform::SteamWindows
            || build.build_kind != BuildKind::SteamFullVersion
            || build.build_id != EXACT_STEAM
            || build.schema != 626
            || !build.externally_attested
        {
            return Err(denied("ROAD_Q1_EXACT_STEAM_BUILD_REQUIRED"));
        }
        if old.envelope.action != WorkerAction::ReadDomain {
            return Err(denied("ROAD_Q1_READ_DOMAIN_ONLY"));
        }
        // One ProductSession scope validator rejects staged-ledger reads as well
        // as stale/foreign/replayed session identity, epoch and decoded SHA.
        // Hold one existing Session mutex throughout the immutable old-value
        // scan. Close/Stage cannot invalidate the CAS before this receipt ends.
        let _state = self.lock()?;
        indexed_read::validate_scope(self, &_state, &old.envelope)?;
        if old.source_sha != self.sha
            || old.envelope.expected_decoded_sha256 != self.sha
        {
            return Err(denied("ROAD_Q1_SOURCE_SHA_CAS"));
        }
        if old.area != AREA || old.grid != GRID {
            return Err(denied("ROAD_Q1_FIXED_AREA_GRID"));
        }
        // These nonzero hash guards only reject missing old-value tokens.
        // They do not authenticate caller claims against the decoded Save.
        if [
            old.root_sha, old.grid_sha, old.stock_sha,
            old.refs_sha, old.ambient_sha,
        ].iter().any(|digest| *digest == [0; 32]) {
            return Err(denied("ROAD_Q1_OLD_HASH_REQUIRED"));
        }
        if old.stock < 2 || old.stock > STOCK_MAX {
            return Err(denied("ROAD_Q1_NO_UNAUTHORIZED_DEBIT"));
        }
        // These THREE old-value witnesses are now authenticated against
        // the Rust-owned document, not merely the caller's nonzero hashes.
        // References/ambient/rights remain explicitly UNVERIFIED.
        let actual = read_actual_old(&self.decoded)?;
        if old.next_object_id != actual.next || old.stock != actual.stock ||
           old.root_sha != actual.area_sha || old.grid_sha != actual.grid_sha ||
           old.stock_sha != actual.stock_sha {
            return Err(denied("ROAD_Q1_ACTUAL_OLD_VALUES_CAS"));
        }
        let proposed_object =
            road_mixed_shape::exact_steam626_road_single_orthogonal(
                old.next_object_id, old.x, old.y,
            ).ok_or(denied("ROAD_Q1_ID_OR_COORD_BOUNDS"))?;
        if proposed_object["ItemID"] != ITEM_ID
            || proposed_object["ID"] != old.next_object_id
            || proposed_object["State"] != Value::Null
        {
            return Err(denied("ROAD_Q1_UNEXPECTED_SHAPE"));
        }
        let expected_next_after = old.next_object_id.checked_add(1)
            .ok_or(denied("ROAD_Q1_COUNTER_OVERFLOW"))?;
        let expected_stock_after = old.stock.checked_sub(1)
            .ok_or(denied("ROAD_Q1_STOCK_UNDERFLOW"))?;
        Ok(RoadQ1ReadOnlyPreparation {
            proposed_object,
            expected_new_id: old.next_object_id,
            expected_next_after,
            expected_stock_after,
            proposed_changed_targets: 3,
            stage_authorized: false,
            export_authorized: false,
        })
    }
}

#[cfg(test)]
mod road_q1_prep_tests {
    use super::*;
    use super::super::{BuildIdentity, PRODUCT_WORKER_CONTRACT};
    use serde_json::json;

    fn fixture(switch: bool) -> ProductSession {
        let build = BuildIdentity {
            platform: if switch { Platform::Switch } else { Platform::SteamWindows },
            build_kind: if switch { BuildKind::SwitchBid } else { BuildKind::SteamFullVersion },
            build_id: if switch { "9A239D3DB569756D" } else { EXACT_STEAM }.into(),
            schema: 626,
            externally_attested: true,
        };
        ProductSession::open_decoded_readonly(
            serde_json::to_vec(&json!({
                "GameInfo": { "Version": 626 },
                "World": {
                    "Villages": [{"Areas": {"6": {"Unlocked": true, "GridIDs": [1]}}}],
                    "GridCollection": {"Grids": {"1": {
                        "ID": 1, "GridDataPath": "GridData/Worlds/Plaza-GridData.json",
                        "GridDefaultLayoutPath": "", "TessellationFactor": 2,
                        "NextGridObjectID": 15949, "Objects": {
                            "8": {"ID": 8, "ItemID": 40100068, "X": 20, "Y": 30,
                                  "Orientation": "GridOrientation_Down", "State": null}
                        }
                    }}, "DiffGrids": {}}
                },
                "Player": {"ListInventories": {"0": {"ID": 0,
                    "CompatibleItemType": "ItemType_Furniture",
                    "Inventory": {"40100068": {"Amount": 9, "Marker": "ItemMarker_Favorite"}}
                }}},
                "Unknown": { "keep": [1, 2, 3] }
            })).unwrap(),
            build,
        ).unwrap()
    }
    fn expected(session: &ProductSession) -> RoadQ1ExpectedOld {
        let r = session.receipt().unwrap();
        let actual = read_actual_old(&session.decoded).unwrap();
        RoadQ1ExpectedOld {
            envelope: WorkerEnvelope {
                contract: PRODUCT_WORKER_CONTRACT,
                session_id: r.session_id,
                expected_revision: r.revision,
                expected_index_generation: r.index_generation,
                expected_decoded_sha256: r.decoded_sha256,
                action: WorkerAction::ReadDomain,
            },
            source_sha: r.decoded_sha256,
            area: AREA, grid: GRID, next_object_id: 15949,
            stock: 9, x: 40, y: 20,
            root_sha: actual.area_sha, grid_sha: actual.grid_sha,
            stock_sha: actual.stock_sha, refs_sha: [4; 32], ambient_sha: [5; 32],
        }
    }

    #[test]
    fn road_q1_prep_exact3_draft_never_grants_stage_or_export() {
        let s = fixture(false);
        let old = expected(&s);
        let before = s.receipt().unwrap();
        let proposal = s.prepare_steam626_road_single_q1_readonly(old).unwrap();
        assert_eq!(proposal.proposed_object, json!({
            "ID":15949, "ItemID":40100068, "X":40, "Y":20,
            "Orientation":"GridOrientation_Down", "State":null
        }));
        assert_eq!((proposal.expected_next_after, proposal.expected_stock_after,
            proposal.proposed_changed_targets), (15950, 8, 3));
        assert!(!proposal.stage_authorized && !proposal.export_authorized);
        assert_eq!(s.receipt().unwrap(), before);
        assert!(s.dispatch(WorkerEnvelope {
            action: WorkerAction::Stage, ..old.envelope
        }).is_err());
        assert!(s.dispatch(WorkerEnvelope {
            action: WorkerAction::ExportEditedCopy, ..old.envelope
        }).is_err());
    }

    #[test]
    fn road_q1_prep_saved_ids_must_be_canonical_unique_below_actual_counter() {
        let s = fixture(false);
        let original: Value = serde_json::from_slice(&s.decoded).unwrap();
        let key = |id: &str, value_id: u32| {
            let mut d = original.clone();
            d["World"]["GridCollection"]["Grids"]["1"]["Objects"]
                .as_object_mut().unwrap().insert(
                    id.into(),
                    json!({"ID":value_id,"ItemID":40100068,"X":22,"Y":30,
                          "Orientation":"GridOrientation_Down","State":null})
                );
            let bytes = serde_json::to_vec(&d).unwrap();
            assert!(read_actual_old(&bytes).is_err(), "unexpected object key {id}");
        };
        key("0", 0);
        key("0009", 9);
        key("15949", 15949);
        key("15950", 15950);
        key("7", 6);
        key("not-a-number", 7);
        // The counter cannot move behind any already persisted object.
        let mut stale = original.clone();
        stale["World"]["GridCollection"]["Grids"]["1"]["NextGridObjectID"] = json!(8);
        assert!(read_actual_old(&serde_json::to_vec(&stale).unwrap()).is_err());
        // Exact unchanged original remains a positive non-authorizing input.
        assert!(read_actual_old(&s.decoded).is_ok());
    }

    #[test]
    fn road_q1_prep_wrong_build_session_cas_rights_and_bounds_denied() {
        let s = fixture(false);
        let old = expected(&s);
        let mut wrong = old;
        wrong.envelope.action = WorkerAction::Stage;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.envelope.expected_revision += 1;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.envelope.expected_index_generation += 1;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.envelope.session_id = [9; 16];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.envelope.expected_decoded_sha256 = [9; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.source_sha = [9; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.grid = 7;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.area = 2;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.stock = 1;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.stock = 10_000;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.next_object_id = 0;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.next_object_id = i32::MAX as u32;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.x = i32::MAX as u32 + 1;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.y = u32::MAX;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.root_sha = [99; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.grid_sha = [99; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.stock_sha = [99; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.stock = 8;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.next_object_id = 15948;
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        wrong = old;
        wrong.refs_sha = [0; 32];
        assert!(s.prepare_steam626_road_single_q1_readonly(wrong).is_err());
        assert!(fixture(true).prepare_steam626_road_single_q1_readonly(old).is_err());
        let foreign = fixture(false);
        assert!(foreign.prepare_steam626_road_single_q1_readonly(old).is_err());
        s.close().unwrap();
        assert!(s.prepare_steam626_road_single_q1_readonly(old).is_err());
    }
}
