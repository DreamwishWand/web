//! Source-bound, intentionally *bounded* Grid/Container reference and opaque-preservation
//! proof. It is NOT a complete native DDV cross-domain reference model and grants NO writer rights.
use crate::{EngineResult, index_selected_tokens, validate_json, sha256};
use crate::session::{Domain, LogicalIdentity, ReferenceEdge, ReferenceIndex, SemanticCommand};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub const MAX_GUARDED_SOURCE_BYTES: usize = 2 * 1024 * 1024;
const MAX_PROTECTED_SPANS: usize = 512;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceGraphReceipt {
    pub decoded_sha256: [u8; 32],
    pub observed_container_links: usize,
    pub grid_container_scope_checked: bool,
    pub cross_domain_reference_closure_complete: bool,
    pub native_reference_semantics_verified: bool,
    pub product_writer_authorized: bool,
}

/// Fail closed unless every serialized Grid.State.Storage.ContainerInventoryID has exactly
/// one matching Player.ContainerInventories record and a matching declared typed graph edge.
/// All occurrences of the reference field *outside* this exact shape are rejected.
/// This supports only the explicitly declared map-shaped research fixture; other shapes
/// require a new native-specific extractor, not an inference from the asserted graph.
pub fn audit_grid_container_source(bytes: &[u8], graph: &ReferenceIndex)
    -> EngineResult<SourceGraphReceipt>
{
    if bytes.len() > MAX_GUARDED_SOURCE_BYTES { return Err("SOURCE_GRAPH_AUDIT_UNSUPPORTED_SIZE"); }
    validate_json(bytes)?;
    graph.check()?;
    let root: Value = serde_json::from_slice(bytes).map_err(|_| "SOURCE_GRAPH_JSON_INVALID")?;
    let grids = root.pointer("/World/GridCollection/Grids")
        .and_then(Value::as_object).ok_or("SOURCE_GRID_SHAPE_UNKNOWN")?;
    let containers = root.pointer("/Player/ContainerInventories")
        .and_then(Value::as_object).ok_or("SOURCE_CONTAINER_SHAPE_UNKNOWN")?;
    let mut expected = BTreeSet::new();
    let mut known_paths = BTreeSet::new();
    for (grid_key, grid) in grids {
        let objects = grid.get("Objects").and_then(Value::as_object)
            .ok_or("SOURCE_GRID_OBJECTS_SHAPE_UNKNOWN")?;
        for (object_key, object) in objects {
            let obj = object.as_object().ok_or("SOURCE_GRID_OBJECT_SHAPE_UNKNOWN")?;
            if let Some(stored) = obj.get("ID") {
                let key = stored.as_u64().map(|n| n.to_string())
                    .ok_or("SOURCE_GRID_OBJECT_ID_UNKNOWN")?;
                if key != *object_key { return Err("SOURCE_GRID_OBJECT_ID_CONFLICT"); }
            }
            let Some(state) = obj.get("State") else { continue };
            let state = state.as_object().ok_or("SOURCE_STATE_SHAPE_UNKNOWN")?;
            let Some(storage) = state.get("Storage") else { continue };
            let storage = storage.as_object().ok_or("SOURCE_STORAGE_SHAPE_UNKNOWN")?;
            let Some(reference) = storage.get("ContainerInventoryID") else { continue };
            let id = match reference {
                Value::String(s) if !s.is_empty() => s.clone(),
                Value::Number(n) if n.as_u64().is_some() => n.as_u64().unwrap().to_string(),
                _ => return Err("SOURCE_CONTAINER_REFERENCE_INVALID")
            };
            if !containers.contains_key(&id) { return Err("SOURCE_CONTAINER_REFERENCE_DANGLING"); }
            let src = LogicalIdentity { domain: Domain::Grid,
                key: format!("grid:{grid_key}:object:{object_key}") };
            let dst = LogicalIdentity { domain: Domain::ContainerInventory,
                key: format!("container:{id}") };
            if !expected.insert((src, dst)) { return Err("SOURCE_REFERENCE_CONFLICT"); }
            known_paths.insert(format!(
                "/World/GridCollection/Grids/{}/Objects/{}/State/Storage/ContainerInventoryID",
                escape(grid_key), escape(object_key)));
        }
    }
    let mut all_paths = BTreeSet::new();
    collect_named_reference_fields(&root, "", &mut all_paths)?;
    if all_paths != known_paths { return Err("UNKNOWN_OR_UNSCANNED_CONTAINER_REFERENCE"); }
    if expected.is_empty() { return Err("SOURCE_REFERENCE_SCOPE_EMPTY"); }
    let declared: BTreeSet<(LogicalIdentity, LogicalIdentity)> = graph.edges.iter()
        .filter(|e| e.from.domain == Domain::Grid || e.to.domain == Domain::ContainerInventory)
        .map(|e| (e.from.clone(), e.to.clone())).collect();
    if declared != expected { return Err("SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING"); }
    for (src, dst) in &expected {
        if !graph.nodes.contains(src) || !graph.nodes.contains(dst) {
            return Err("SOURCE_REFERENCE_IDENTITY_MISSING");
        }
    }
    Ok(SourceGraphReceipt {
        decoded_sha256: sha256(bytes),
        observed_container_links: expected.len(),
        grid_container_scope_checked: true,
        cross_domain_reference_closure_complete: false,
        native_reference_semantics_verified: false,
        product_writer_authorized: false
    })
}
fn escape(part: &str) -> String { part.replace('~', "~0").replace('/', "~1") }
fn collect_named_reference_fields(
    value: &Value, path: &str, out: &mut BTreeSet<String>
) -> EngineResult<()> {
    match value {
        Value::Object(obj) => for (key, child) in obj {
            let next = format!("{path}/{}", escape(key));
            if key == "ContainerInventoryID" { out.insert(next.clone()); }
            collect_named_reference_fields(child, &next, out)?;
        },
        Value::Array(arr) => for (i, child) in arr.iter().enumerate() {
            collect_named_reference_fields(child, &format!("{path}/{i}"), out)?;
        },
        _ => {}
    }
    Ok(())
}

/// Every untouched subtree must retain its exact JSON token bytes (including unknown
/// nested State, escape spelling, number lexical form, and opaque values). A mutation
/// manifest may enumerate only existing scalar leaves, never a parent object/array.
/// Array reshape / field addition / removal cannot pass this gate without a future
/// separately accepted structural semantic validator.
pub fn verify_opaque_preservation(
    before: &[u8], after: &[u8], commands: &[SemanticCommand],
    allowed_scalar_leaf_paths: &[String]
) -> EngineResult<()> {
    if allowed_scalar_leaf_paths.is_empty() || allowed_scalar_leaf_paths.len() > 64 {
        return Err("GUARDED_MUTATION_SCOPE_INVALID");
    }
    let mut allowed = BTreeSet::new();
    for p in allowed_scalar_leaf_paths {
        if !p.starts_with('/') || p.len() > 1024 || !allowed.insert(p.clone()) {
            return Err("GUARDED_MUTATION_POINTER_INVALID");
        }
    }
    let mut used = BTreeSet::new();
    let mut immutable = BTreeSet::new();
    for cmd in commands {
        let old: Value = serde_json::from_str(&cmd.expected_old_json)
            .map_err(|_| "GUARDED_OLD_SUBTREE_INVALID")?;
        let new: Value = serde_json::from_str(&cmd.new_json)
            .map_err(|_| "GUARDED_NEW_SUBTREE_INVALID")?;
        protect_recursive(&old, &new, &cmd.pointer, &allowed, &mut used, &mut immutable)?;
    }
    if used != allowed { return Err("GUARDED_MUTATION_SCOPE_UNCONSUMED"); }
    if immutable.len() > MAX_PROTECTED_SPANS { return Err("GUARDED_OPAQUE_SCOPE_TOO_LARGE"); }
    let watch: Vec<String> = immutable.into_iter().collect();
    let pre = index_selected_tokens(before, &watch)?;
    let post = index_selected_tokens(after, &watch)?;
    if pre.len() != watch.len() || post.len() != watch.len() {
        return Err("GUARDED_OPAQUE_FIELD_DROPPED");
    }
    let post_map: BTreeMap<String, String> = post.into_iter()
        .map(|x| (x.pointer, x.value)).collect();
    for token in pre {
        if post_map.get(&token.pointer) != Some(&token.value) {
            return Err("GUARDED_OPAQUE_BYTES_CHANGED");
        }
    }
    Ok(())
}
fn protect_recursive(
    old: &Value, new: &Value, path: &str, allowed: &BTreeSet<String>,
    used: &mut BTreeSet<String>, immutable: &mut BTreeSet<String>
) -> EngineResult<()> {
    let nested = allowed.iter().any(|a| a.starts_with(&format!("{path}/")));
    if allowed.contains(path) {
        if old.is_object() || old.is_array() || new.is_object() || new.is_array() {
            return Err("GUARDED_COMPLEX_REPLACEMENT_REFUSED");
        }
        if std::mem::discriminant(old) != std::mem::discriminant(new) || old == new {
            return Err("GUARDED_SCALAR_CHANGE_INVALID");
        }
        used.insert(path.to_owned());
        return Ok(());
    }
    if !nested {
        immutable.insert(path.to_owned());
        return Ok(());
    }
    match (old, new) {
        (Value::Object(a), Value::Object(b)) => {
            if a.keys().collect::<BTreeSet<_>>() != b.keys().collect::<BTreeSet<_>>() {
                return Err("GUARDED_OBJECT_KEYS_CHANGED");
            }
            for (key, a_child) in a {
                protect_recursive(a_child, &b[key], &format!("{path}/{}", escape(key)),
                    allowed, used, immutable)?;
            }
        },
        (Value::Array(a), Value::Array(b)) => {
            if a.len() != b.len() { return Err("GUARDED_ARRAY_LENGTH_CHANGED"); }
            for (i, (one, two)) in a.iter().zip(b.iter()).enumerate() {
                protect_recursive(one, two, &format!("{path}/{i}"),
                    allowed, used, immutable)?;
            }
        },
        _ => return Err("GUARDED_PARENT_STRUCTURE_CHANGED"),
    }
    Ok(())
}
