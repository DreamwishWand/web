//! Post-PR322 isolated regression; synthetic schema626 only. No product Writer grant.
use ddv_save_core::{sha256, index_selected_tokens};
use ddv_save_core::integrity::audit_grid_container_source;
use ddv_save_core::session::{
    CommandKind, Domain, LogicalIdentity, ReferenceEdge, ReferenceIndex,
    SaveSession, SemanticCommand, TransactionPlan,
};
use std::collections::BTreeSet;

const GRID: &str = "/World/GridCollection/Grids/5/Objects/3";
fn ident(domain: Domain, key: &str) -> LogicalIdentity {
    LogicalIdentity { domain, key: key.into() }
}
fn graph() -> ReferenceIndex {
    let src=ident(Domain::Grid,"grid:5:object:3");
    let dst=ident(Domain::ContainerInventory,"container:ChestA");
    ReferenceIndex {
        nodes:BTreeSet::from([src.clone(),dst.clone()]),
        edges:vec![ReferenceEdge{from:src,to:dst}],
    }
}
fn fixture() -> Vec<u8> {
    br#"{"GameInfo":{"Version":626},"Player":{"ContainerInventories":{"ChestA":{"Items":[]}}},"World":{"GridCollection":{"Grids":{"5":{"Objects":{"3":{"ID":3,"X":4,"State":{"Storage":{"ContainerInventoryID":"ChestA"},"Mystery":{"flags":[1,2],"shadow":"KEEP"}}}}}}}},"Unknown":{"escape":"\u00e9","decimal":1.00}}"#.to_vec()
}
fn command(before:&str,after:&str) -> SemanticCommand {
    SemanticCommand {
        domain:Domain::Grid,identity:ident(Domain::Grid,"grid:5:object:3"),
        kind:CommandKind::ReplaceKnownSubtree,
        pointer:GRID.into(),expected_old_json:before.into(),new_json:after.into(),
        read_set:vec![],
    }
}
fn plan(s:&SaveSession,old:&str,new:&str) -> TransactionPlan {
    TransactionPlan {
        session_id:s.session_id(),expected_revision:s.revision(),
        expected_source_sha256:s.source_sha256(),commands:vec![command(old,new)],
        postconditions:vec![],post_references:graph(),
    }
}
fn old_object(bytes:&[u8]) -> String {
    index_selected_tokens(bytes,&[GRID.into()]).unwrap().remove(0).value
}
fn denied_without_side_effects(old:&str,new:&str,expected:&str) {
    let original=fixture();
    let mut s=SaveSession::open_decoded_research(81,original.clone(),626,graph()).unwrap();
    let baseline_sha=sha256(&original);
    let tx=plan(&s,old,new);
    assert_eq!(
        s.stage_command_source_guarded(tx,&[format!("{GRID}/X")]).unwrap_err(),
        expected
    );
    assert_eq!(s.revision(),0);
    assert_eq!(s.index_generation(),0);
    assert_eq!(s.source_sha256(),baseline_sha);
    let current=s.query_paged(&[GRID.into()],0,1).unwrap();
    assert_eq!(current[0].preview_json,old);
    assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn unknown_array_reorder_rejected_despite_valid_known_leaf() {
    let raw=fixture();let old=old_object(&raw);
    let changed=old.replace("\"X\":4","\"X\":5").replace("[1,2]","[2,1]");
    assert_ne!(old,changed);
    denied_without_side_effects(&old,&changed,"GUARDED_OPAQUE_BYTES_CHANGED");
}
#[test]
fn unknown_array_append_and_shrink_are_rejected_without_revision_change() {
    let raw=fixture();let old=old_object(&raw);
    let append=old.replace("\"X\":4","\"X\":5").replace("[1,2]","[1,2,3]");
    denied_without_side_effects(&old,&append,"GUARDED_OPAQUE_BYTES_CHANGED");
    let shrink=old.replace("\"X\":4","\"X\":5").replace("[1,2]","[1]");
    denied_without_side_effects(&old,&shrink,"GUARDED_OPAQUE_BYTES_CHANGED");
}
#[test]
fn unknown_new_reference_key_is_rejected_even_with_existing_target() {
    let raw=fixture();let old=old_object(&raw);
    let new=old.replace("\"X\":4","\"X\":5").replace(
        "\"shadow\":\"KEEP\"",
        "\"shadow\":\"KEEP\",\"ContainerInventoryID\":\"ChestA\""
    );
    denied_without_side_effects(&old,&new,"GUARDED_OPAQUE_BYTES_CHANGED");
}
#[test]
fn known_source_edge_still_cannot_confer_product_capability() {
    let raw=fixture();
    let witness=audit_grid_container_source(&raw,&graph()).unwrap();
    assert_eq!(witness.observed_container_links,1);
    assert!(!witness.cross_domain_reference_closure_complete);
    assert!(!witness.native_reference_semantics_verified);
    assert!(!witness.product_writer_authorized);
    let mut s=SaveSession::open_decoded_research(82,raw.clone(),626,graph()).unwrap();
    let old=old_object(&raw);
    let new=old.replace("\"X\":4","\"X\":5");
    let tx=plan(&s,&old,&new);
    let stage=s.stage_command_source_guarded(tx,&[format!("{GRID}/X")]).unwrap();
    assert_eq!(stage.to_revision,1);
    let receipt=s.validate_transaction().unwrap();
    assert!(!receipt.semantic_domain_guards_accepted);
    assert!(!receipt.encode_copy_authorized);
    assert!(!receipt.persistent_replace_authorized);
    assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
    assert_eq!(s.source_sha256(),sha256(&raw));
}
