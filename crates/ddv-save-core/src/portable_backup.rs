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
    Ok(InventoryAmountBackup {
        inventory_id: id(&body["target"]["inventoryId"])?,
        item_id: id(&body["target"]["itemId"])?,
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
