//! Policy73 portable backup envelope. File-format only: no SaveSession,
//! native read, mutation, restore authorization, or browser ABI.
use crate::{CoreError, CoreResult};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const WAND_BACKUP_FORMAT: &str = "dreamwish-wand-backup";
pub const WAND_BACKUP_MAX_BYTES: usize = 1024 * 1024;
const INVENTORY_AMOUNT: &str = "inventory.existing-amount";
const STEAM_BUILD: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_AMOUNT: u64 = 9999;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InventoryAmountBackup {
    pub inventory_id: u32,
    pub item_id: u32,
    pub amount: u32,
    pub source_decoded_sha256: String,
    /// Exact canonical JSON payload, including unknown members. Data only.
    pub payload: Value,
}

fn err(s: &'static str) -> CoreError { CoreError(s) }
fn bounded(bytes: &[u8]) -> CoreResult<()> {
    if bytes.is_empty() || bytes.len() > WAND_BACKUP_MAX_BYTES {
        return Err(err("WAND_BACKUP_SIZE"));
    }
    Ok(())
}
fn hex_sha(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
fn sha_text(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn compact(v: &Value) -> CoreResult<Vec<u8>> {
    serde_json::to_vec(v).map_err(|_| err("WAND_BACKUP_JSON"))
}
// A canonical input must equal its complete reserialization, not just parse.
// This also rejects duplicate keys, alternate number encodings, invalid UTF-8,
// whitespace, trailing bytes, BOM, and any lossy numeric normalization.
fn parse_canonical(bytes: &[u8]) -> CoreResult<Value> {
    bounded(bytes)?;
    let v: Value = serde_json::from_slice(bytes).map_err(|_| err("WAND_BACKUP_JSON"))?;
    if compact(&v)?.as_slice() != bytes {
        return Err(err("WAND_BACKUP_NONCANONICAL"));
    }
    Ok(v)
}
fn keys(v: &Value, wanted: &[&str]) -> CoreResult<()> {
    let m = v.as_object().ok_or(err("WAND_BACKUP_OBJECT"))?;
    if m.len() != wanted.len() || !wanted.iter().all(|k| m.contains_key(*k)) {
        return Err(err("WAND_BACKUP_FIELDS"));
    }
    Ok(())
}
fn id(v: &Value) -> CoreResult<u32> {
    let n = v.as_u64().filter(|n| *n > 0 && *n <= u32::MAX as u64)
        .ok_or(err("WAND_BACKUP_TARGET"))?;
    Ok(n as u32)
}
fn amount(v: &Value) -> CoreResult<u32> {
    let n = v.get("amount").and_then(Value::as_u64)
        .filter(|n| *n > 0 && *n <= MAX_AMOUNT)
        .ok_or(err("WAND_BACKUP_AMOUNT"))?;
    Ok(n as u32)
}
fn steam_build() -> Value {
    json!({"platform":"SteamWindows","buildKind":"SteamFullVersion",
        "buildId":STEAM_BUILD,"gameVersion":"1.25.3","schema":626})
}
// Common versioned envelope, integrity over canonical JSON excluding sha256.
// The hash detects accidental corruption; it is not a signature or authority.
fn seal(mut body: Value) -> CoreResult<Vec<u8>> {
    let digest = hex_sha(&compact(&body)?);
    body.as_object_mut().ok_or(err("WAND_BACKUP_OBJECT"))?
        .insert("sha256".into(), Value::String(digest));
    let bytes = compact(&body)?;
    bounded(&bytes)?;
    Ok(bytes)
}
fn verify(bytes: &[u8]) -> CoreResult<Value> {
    let mut body = parse_canonical(bytes)?;
    keys(&body, &["format","schemaVersion","type","sourceBuild","target",
        "payload","provenance","sha256"])?;
    let digest = body.as_object_mut().ok_or(err("WAND_BACKUP_OBJECT"))?
        .remove("sha256").and_then(|v| v.as_str().map(str::to_owned))
        .ok_or(err("WAND_BACKUP_HASH"))?;
    if !sha_text(&digest) || digest != hex_sha(&compact(&body)?) {
        return Err(err("WAND_BACKUP_HASH"));
    }
    if body["format"] != WAND_BACKUP_FORMAT || body["schemaVersion"].as_u64() != Some(1) {
        return Err(err("WAND_BACKUP_VERSION"));
    }
    Ok(body)
}
/// Encode an Inventory existing-amount snapshot. Caller supplies canonical
/// payload bytes; this function does not read Save files or mint Core targets.
pub fn encode_inventory_amount_backup(
    inventory_id: u32, item_id: u32, source_decoded_sha256: &str,
    canonical_payload: &[u8],
) -> CoreResult<Vec<u8>> {
    let payload = parse_canonical(canonical_payload)?;
    let body = json!({"format":WAND_BACKUP_FORMAT,"schemaVersion":1,
        "type":INVENTORY_AMOUNT,"sourceBuild":steam_build(),
        "target":{"inventoryId":inventory_id,"itemId":item_id},
        "payload":payload,
        "provenance":{"decodedSha256":source_decoded_sha256}});
    let bytes = seal(body)?;
    // Use the same validator for both paths. Never emit an unreadable envelope.
    decode_inventory_amount_backup(&bytes)?;
    Ok(bytes)
}
/// Read-only, typed domain adapter. Does not accept a destination or build
/// authority from UI. A later restore router must resolve a fresh Core target,
/// current revision/old value, rights and capacity before staging the existing
/// Rust CAS engine; this data must never be treated as such a capability.
pub fn decode_inventory_amount_backup(bytes: &[u8]) -> CoreResult<InventoryAmountBackup> {
    let body = verify(bytes)?;
    if body["type"] != INVENTORY_AMOUNT { return Err(err("WAND_BACKUP_TYPE")); }
    if body["sourceBuild"] != steam_build() { return Err(err("WAND_BACKUP_BUILD")); }
    keys(&body["target"], &["inventoryId","itemId"])?;
    keys(&body["provenance"], &["decodedSha256"])?;
    let source = body["provenance"]["decodedSha256"].as_str()
        .filter(|s| sha_text(s)).ok_or(err("WAND_BACKUP_PROVENANCE"))?;
    let payload = &body["payload"];
    let item_id = id(&body["target"]["itemId"])?;
    // ID 0 is only the saved Furniture catalog route, never Container 0.
    // Existing positive-route wire compatibility is unchanged. The new
    // zero-route file is typed; current Core must still verify its mask.
    let inventory_id = if body["target"]["inventoryId"].as_u64()==Some(0){
        if item_id/10_000_000!=4 || payload["itemType"]!="ItemType_Furniture" {
            return Err(err("WAND_BACKUP_ZERO_ROUTE_TYPE"));
        }
        0
    }else{id(&body["target"]["inventoryId"])?};
    Ok(InventoryAmountBackup {
        inventory_id,
        item_id,
        amount: amount(payload)?,
        source_decoded_sha256: source.to_owned(),
        payload: payload.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    const SHA: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    fn fixture() -> Vec<u8> {
        encode_inventory_amount_backup(7, 42, SHA,
            br#"{"amount":49,"unknown":{"flag":true,"list":[null,7]}}"#).unwrap()
    }
    fn reseal(mut v: Value) -> Vec<u8> {
        v.as_object_mut().unwrap().remove("sha256");
        seal(v).unwrap()
    }
    #[test]
    fn portable_inventory_roundtrip_exact_unknowns_and_minified_bytes() {
        let bytes = fixture();
        let snapshot = decode_inventory_amount_backup(&bytes).unwrap();
        assert_eq!((snapshot.inventory_id,snapshot.item_id,snapshot.amount),(7,42,49));
        assert_eq!(snapshot.source_decoded_sha256,SHA);
        assert_eq!(snapshot.payload["unknown"]["list"],json!([null,7]));
        assert_eq!(bytes, encode_inventory_amount_backup(7,42,SHA,
            &compact(&snapshot.payload).unwrap()).unwrap());
        assert_eq!(bytes, compact(&parse_canonical(&bytes).unwrap()).unwrap());
        assert!(bytes.len() < 1024);
        eprintln!("WAND_BACKUP_SYNTHETIC_MINIFIED_BYTES={}",bytes.len());
    }
    #[test]
    fn portable_inventory_rejects_tamper_noncanonical_duplicate_and_bounds() {
        let bytes = fixture();
        let mut v = parse_canonical(&bytes).unwrap();
        v["payload"]["amount"] = json!(50);
        assert!(decode_inventory_amount_backup(&compact(&v).unwrap()).is_err());
        let mut trailing = bytes.clone(); trailing.push(b' ');
        assert!(decode_inventory_amount_backup(&trailing).is_err());
        let mut duplicate = bytes.clone(); duplicate.pop();
        duplicate.extend_from_slice(br#","type":"inventory.existing-amount"}"#);
        assert!(decode_inventory_amount_backup(&duplicate).is_err());
        assert!(decode_inventory_amount_backup(&[0xff]).is_err());
        assert!(decode_inventory_amount_backup(&vec![b' '; WAND_BACKUP_MAX_BYTES+1]).is_err());
        assert!(encode_inventory_amount_backup(7,42,SHA,br#"{"amount":49,"amount":50}"#).is_err());
        assert!(encode_inventory_amount_backup(7,42,SHA,br#"{"amount":49,"n":18446744073709551617}"#).is_err());
        let deep = format!("{{\"amount\":49,\"n\":{}0{}}}","[".repeat(140),"]".repeat(140));
        assert!(encode_inventory_amount_backup(7,42,SHA,deep.as_bytes()).is_err());
    }
    #[test]
    fn portable_inventory_valid_hash_never_bypasses_type_build_target_or_schema() {
        let good = parse_canonical(&fixture()).unwrap();
        for (key,value) in [
            ("type",json!("grid")),("schemaVersion",json!(2)),
            ("sourceBuild",json!({"platform":"Switch","schema":626})),
            ("target",json!({"inventoryId":0,"itemId":42})),
            ("target",json!({"inventoryId":"7","itemId":42})),
            ("payload",json!({"amount":0})),("payload",json!({"amount":10000})),
            ("payload",json!({"amount":49.0})),
            ("provenance",json!({"decodedSha256":"bad"})),
        ] {
            let mut v = good.clone(); v[key] = value;
            assert!(decode_inventory_amount_backup(&reseal(v)).is_err(), "{key}");
        }
        let mut v = good; v["writerAuthorized"] = json!(true);
        assert!(decode_inventory_amount_backup(&reseal(v)).is_err());
    }
}

// Policy73 capture and restore review on the existing single Rust session.
// DEV feature only. No new worker ABI, reader, writer or capability.
#[cfg(feature = "semantic-writer-dev")]
mod session_adapter {
    use super::*;
    use crate::{ExistingAmountItemType, ProductSession, WorkerEnvelope};

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum InventoryRestoreDisposition {
        AlreadyMatches,
        PositiveDecreaseCandidate,
        IncreaseUnsupported,
    }

    /// A read-only review of an exact original target, not a mutation grant.
    /// The receipt is advisory; any future writer must re-resolve and CAS.
    #[derive(Clone, Debug, PartialEq, Eq)]
    pub struct InventoryRestoreReview {
        pub inventory_id: u32,
        pub item_id: u32,
        pub current_amount: u32,
        pub backup_amount: u32,
        pub session_id: [u8; 16],
        pub revision: u64,
        pub index_generation: u64,
        pub current_decoded_sha256: [u8; 32],
        pub current_entry_sha256: [u8; 32],
        pub backup_decoded_sha256: String,
        pub backup_entry_sha256: String,
        pub disposition: InventoryRestoreDisposition,
    }

    fn digest_text(digest: &[u8; 32]) -> String {
        digest.iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().concat()
    }

    fn type_name(kind: ExistingAmountItemType) -> &'static str {
        match kind {
            ExistingAmountItemType::ActivityItem => "ItemType_ActivityItem",
            ExistingAmountItemType::Furniture => "ItemType_Furniture",
        }
    }

    impl ProductSession {
        /// Capture only the existing Amount field and typed source provenance
        /// from the Core-owned target. Unknown saved fields remain in the
        /// original Save; this is not a full Inventory row/domain backup.
        /// Capture is a historical snapshot at the validated read epoch.
        pub fn capture_inventory_amount_backup(
            &self, envelope: WorkerEnvelope, inventory_id: u32, item_id: u32,
        ) -> CoreResult<Vec<u8>> {
            let view = self.read_inventory_backup_amount(envelope,inventory_id,item_id)?;
            let payload = json!({
                "amount":view.old_amount,
                "entrySha256":digest_text(&view.entry_sha256),
                "itemType":type_name(view.compatible_item_type),
            });
            encode_inventory_amount_backup(inventory_id, item_id,
                &digest_text(&view.decoded_sha256), &compact(&payload)?)
        }

        /// Review Restore-to-original-target only. Different target Apply
        /// is intentionally not implemented. No implicit increase, no command,
        /// no trust in a recomputed file hash or claimed source provenance.
        pub fn review_inventory_amount_restore(
            &self, envelope: WorkerEnvelope, bytes: &[u8],
            inventory_id: u32, item_id: u32,
        ) -> CoreResult<InventoryRestoreReview> {
            let backup = decode_inventory_amount_backup(bytes)?;
            if (backup.inventory_id, backup.item_id) != (inventory_id, item_id) {
                return Err(err("WAND_BACKUP_RESTORE_TARGET_MISMATCH"));
            }
            // Only this amount-only adapter's exact payload is eligible for
            // review; generic envelopes with opaque extra restore fields
            // remain readable by the format, not silently discarded.
            keys(&backup.payload, &["amount", "entrySha256", "itemType"])?;
            let entry = backup.payload["entrySha256"].as_str()
                .filter(|s| sha_text(s)).ok_or(err("WAND_BACKUP_ENTRY_HASH"))?;
            let view = self.read_inventory_backup_amount(envelope,inventory_id,item_id)?;
            if backup.payload["itemType"] != type_name(view.compatible_item_type) {
                return Err(err("WAND_BACKUP_RESTORE_ITEM_TYPE_MISMATCH"));
            }
            let disposition = match backup.amount.cmp(&view.old_amount) {
                std::cmp::Ordering::Equal => InventoryRestoreDisposition::AlreadyMatches,
                std::cmp::Ordering::Less => InventoryRestoreDisposition::PositiveDecreaseCandidate,
                std::cmp::Ordering::Greater => InventoryRestoreDisposition::IncreaseUnsupported,
            };
            Ok(InventoryRestoreReview {
                inventory_id, item_id, current_amount:view.old_amount,
                backup_amount:backup.amount, session_id:view.session_id,
                revision:view.revision, index_generation:view.index_generation,
                current_decoded_sha256:view.decoded_sha256,
                current_entry_sha256:view.entry_sha256,
                backup_decoded_sha256:backup.source_decoded_sha256,
                backup_entry_sha256:entry.to_owned(), disposition,
            })
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::{BuildIdentity, BuildKind, Platform, WorkerAction,
            PRODUCT_WORKER_CONTRACT, TypedSemanticCommand, ExistingAmountSelection};

        const ITEM: u32 = 30000001;
        fn open(amount: u32) -> ProductSession {
            let doc = json!({"GameInfo":{"Version":626},"World":{},
                "Player":{"ListInventories":{"4":{"ID":4,
                    "CompatibleItemType":"ItemType_ActivityItem",
                    "Inventory":{"30000001":{"Amount":amount,"Marker":"Keep",
                        "Unknown":{"Retain":true}}}}}}});
            ProductSession::open_decoded_readonly(compact(&doc).unwrap(), BuildIdentity {
                platform:Platform::SteamWindows, build_kind:BuildKind::SteamFullVersion,
                build_id:STEAM_BUILD.into(), schema:626, externally_attested:true,
            }).unwrap()
        }
        fn scope(s: &ProductSession, action: WorkerAction) -> WorkerEnvelope {
            let r=s.receipt().unwrap();
            WorkerEnvelope { contract:PRODUCT_WORKER_CONTRACT, session_id:r.session_id,
                expected_revision:r.revision, expected_index_generation:r.index_generation,
                expected_decoded_sha256:r.decoded_sha256, action }
        }
        #[test]
        fn capture_exact_core_amount_and_review_same_target_without_mutation() {
            let source=open(49);
            let e=scope(&source,WorkerAction::ReadDomain);
            let bytes=source.capture_inventory_amount_backup(e,4,ITEM).unwrap();
            let decoded=decode_inventory_amount_backup(&bytes).unwrap();
            let witness=source.read_existing_amount_target(e,
                ExistingAmountSelection::Inventory{inventory_id:4,item_id:ITEM}).unwrap();
            assert_eq!(decoded.amount,49);
            assert_eq!(decoded.source_decoded_sha256,digest_text(&witness.view().decoded_sha256));
            assert_eq!(decoded.payload["entrySha256"],digest_text(&witness.view().entry_sha256));
            assert_eq!(decoded.payload["itemType"],"ItemType_ActivityItem");
            assert_eq!(source.receipt().unwrap().revision,0);
            let current=open(50);
            let review=current.review_inventory_amount_restore(
                scope(&current,WorkerAction::ReadDomain),&bytes,4,ITEM).unwrap();
            assert_eq!(review.disposition,InventoryRestoreDisposition::PositiveDecreaseCandidate);
            assert_eq!((review.current_amount,review.backup_amount),(50,49));
            assert_eq!(current.receipt().unwrap().revision,0);
            assert_eq!(source.review_inventory_amount_restore(e,&bytes,4,ITEM).unwrap().disposition,
                InventoryRestoreDisposition::AlreadyMatches);
            let lower=open(48);
            assert_eq!(lower.review_inventory_amount_restore(scope(&lower,WorkerAction::ReadDomain),
                &bytes,4,ITEM).unwrap().disposition,InventoryRestoreDisposition::IncreaseUnsupported);
            assert_eq!(lower.receipt().unwrap().revision,0);
            eprintln!("WAND_INVENTORY_CAPTURE_SYNTHETIC_BYTES={}",bytes.len());
        }
        #[test]
        fn capture_and_review_reject_wrong_target_forged_epoch_and_opaque_restore_fields() {
            let s=open(50);
            let e=scope(&s,WorkerAction::ReadDomain);
            let bytes=s.capture_inventory_amount_backup(e,4,ITEM).unwrap();
            assert!(s.capture_inventory_amount_backup(e,0,ITEM).is_err());
            assert!(s.capture_inventory_amount_backup(e,4,ITEM+1).is_err());
            assert!(s.review_inventory_amount_restore(e,&bytes,4,ITEM+1).is_err());
            let foreign=open(50);
            assert!(foreign.capture_inventory_amount_backup(e,4,ITEM).is_err());
            let mut bad=e; bad.expected_revision=1;
            assert!(s.capture_inventory_amount_backup(bad,4,ITEM).is_err());
            bad=e; bad.expected_index_generation=2;
            assert!(s.review_inventory_amount_restore(bad,&bytes,4,ITEM).is_err());
            bad=e; bad.action=WorkerAction::Stage;
            assert!(s.capture_inventory_amount_backup(bad,4,ITEM).is_err());
            let mut p=decode_inventory_amount_backup(&bytes).unwrap();
            p.payload["itemType"]=json!("ItemType_Furniture");
            let forged=encode_inventory_amount_backup(4,ITEM,&p.source_decoded_sha256,
                &compact(&p.payload).unwrap()).unwrap();
            assert!(s.review_inventory_amount_restore(e,&forged,4,ITEM).is_err());
            p.payload["itemType"]=json!("ItemType_ActivityItem");
            p.payload["unknownRestore"]=json!(true);
            let opaque=encode_inventory_amount_backup(4,ITEM,&p.source_decoded_sha256,
                &compact(&p.payload).unwrap()).unwrap();
            assert!(decode_inventory_amount_backup(&opaque).is_ok());
            assert!(s.review_inventory_amount_restore(e,&opaque,4,ITEM).is_err());
            assert_eq!(s.receipt().unwrap().revision,0);
        }
        #[test]
        fn read_only_amount_one_and_catalog_zero_preserve_writer_boundary() {
            let s=open(1);
            let e=scope(&s,WorkerAction::ReadDomain);
            let bytes=s.capture_inventory_amount_backup(e,4,ITEM).unwrap();
            assert_eq!(decode_inventory_amount_backup(&bytes).unwrap().amount,1);
            assert_eq!(s.review_inventory_amount_restore(e,&bytes,4,ITEM).unwrap().disposition,
                InventoryRestoreDisposition::AlreadyMatches);
            assert!(s.read_existing_amount_target(e,ExistingAmountSelection::Inventory{
                inventory_id:4,item_id:ITEM}).is_err());
            let doc=json!({"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{
                "0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
                    "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},
                    "Inventory":{"40000053":{"Amount":1,"Marker":"Keep"}}}}}});
            let open_doc=|v:&Value| ProductSession::open_decoded_readonly(compact(v).unwrap(),BuildIdentity{
                platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                build_id:STEAM_BUILD.into(),schema:626,externally_attested:true}).unwrap();
            let z=open_doc(&doc);let ze=scope(&z,WorkerAction::ReadDomain);
            let saved=z.capture_inventory_amount_backup(ze,0,40000053).unwrap();
            let snap=decode_inventory_amount_backup(&saved).unwrap();
            assert_eq!((snap.inventory_id,snap.item_id,snap.amount),(0,40000053,1));
            assert_eq!(z.review_inventory_amount_restore(ze,&saved,0,40000053).unwrap().disposition,
                InventoryRestoreDisposition::AlreadyMatches);
            assert!(z.read_existing_amount_target(ze,ExistingAmountSelection::Inventory{
                inventory_id:0,item_id:40000053}).is_err());
            for bad in [json!(null),json!({"List":["FurnitureItemType_Door"]}),
                json!({"List":["FurnitureItemType_Default","FurnitureItemType_Default"]})]{
                let mut d=doc.clone(); d["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]=bad;
                let t=open_doc(&d);assert!(t.capture_inventory_amount_backup(
                    scope(&t,WorkerAction::ReadDomain),0,40000053).is_err());
            }
            for n in [0,10000]{
                let t=open(n);assert!(t.capture_inventory_amount_backup(
                    scope(&t,WorkerAction::ReadDomain),4,ITEM).is_err());
            }
            assert!(encode_inventory_amount_backup(0,ITEM,&snap.source_decoded_sha256,
                br#"{"amount":1,"itemType":"ItemType_Furniture"}"#).is_err());
            assert!(encode_inventory_amount_backup(0,40000053,&snap.source_decoded_sha256,
                br#"{"amount":1,"itemType":"ItemType_ActivityItem"}"#).is_err());
            assert_eq!(z.receipt().unwrap().revision,0);
        }
        #[test]
        fn existing_stage_and_close_invalidate_capture_and_review() {
            let s=open(50);
            let e=scope(&s,WorkerAction::ReadDomain);
            let bytes=s.capture_inventory_amount_backup(e,4,ITEM).unwrap();
            s.stage_typed_semantic_batch(scope(&s,WorkerAction::Stage),
                &[TypedSemanticCommand::InventoryExistingAmountDecrease {
                    inventory_id:4,canonical_item_id:ITEM,
                    expected_compatible_item_type:"ItemType_ActivityItem".into(),
                    expected_old_amount:50,new_amount:49,
                }]).unwrap();
            assert!(s.capture_inventory_amount_backup(e,4,ITEM).is_err());
            let fresh=scope(&s,WorkerAction::ReadDomain);
            assert!(s.review_inventory_amount_restore(fresh,&bytes,4,ITEM).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.capture_inventory_amount_backup(scope(&s,WorkerAction::ReadDomain),4,ITEM).is_err());
            s.close().unwrap();
            assert!(s.capture_inventory_amount_backup(e,4,ITEM).is_err());
        }
    }
}
#[cfg(feature = "semantic-writer-dev")]
pub use session_adapter::{InventoryRestoreDisposition, InventoryRestoreReview};
