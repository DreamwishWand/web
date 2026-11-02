//! New scoped synthetic positive/negative contract: source links and opaque preservation.
use ddv_save_core::{sha256,index_selected_tokens};
use ddv_save_core::integrity::audit_grid_container_source;
use ddv_save_core::session::{
    SaveSession, ReferenceIndex, ReferenceEdge, LogicalIdentity, Domain, TransactionPlan,
    SemanticCommand, CommandKind, ReadWitness
};
use serde_json::{json,Value};
use std::collections::BTreeSet;

const GRID_PATH: &str = "/World/GridCollection/Grids/5/Objects/3";
const EVENT_PATH: &str = "/World/RecurringEvents/0/ItemSpawning/NextOccurrence";
fn id(domain: Domain, key: &str) -> LogicalIdentity {
    LogicalIdentity { domain, key: key.to_owned() }
}
fn graph(reference: &str) -> ReferenceIndex {
    let grid = id(Domain::Grid,"grid:5:object:3");
    let a = id(Domain::ContainerInventory,"container:ChestA");
    let b = id(Domain::ContainerInventory,"container:ChestB");
    let event = id(Domain::RecurringEvent, "event:2010000021");
    ReferenceIndex {
        nodes: BTreeSet::from([grid.clone(),a.clone(),b.clone(),event]),
        edges: vec![ReferenceEdge { from: grid,
            to: if reference == "ChestA" { a } else { b } }]
    }
}
fn source() -> Vec<u8> {
    json!({
      "GameInfo":{"Version":626},
      "Player":{"ContainerInventories":{"ChestA":{"Items":[]},"ChestB":{"Items":[]}}},
      "World":{
       "GridCollection":{"Grids":{"5":{"Objects":{"3":{
        "ID":3,"X":4,"ItemID":10,
        "State":{"Storage":{"ContainerInventoryID":"ChestA"},
                 "Mystery":{"nested":{"escaped":"é","number":1.0,"flags":[true,false]}}}
       }}}}},
       "RecurringEvents":{"0":{"ItemSpawning":{
        "RecurringEventItemID":2010000021,
        "NextOccurrence":"2126-08-20T00:00:00Z",
        "OneofVariant":"W1"
       }}}
      },
      "Unknown":{"untouched":{"key":"arbitrary"}}
    }).to_string().into_bytes()
}
fn span(src:&[u8], p:&str)->String {
    index_selected_tokens(src,&[p.into()]).unwrap().remove(0).value
}
fn command(domain:Domain, key:&str, ptr:&str, old:&str, new:&str)->SemanticCommand {
    SemanticCommand {
        domain,identity:id(domain,key),kind:CommandKind::ReplaceKnownSubtree,
        pointer:ptr.into(),expected_old_json:old.into(),new_json:new.into(),
        read_set:vec![]
    }
}
fn plan(s:&SaveSession, commands:Vec<SemanticCommand>, post:ReferenceIndex)->TransactionPlan {
    TransactionPlan {
        session_id:s.session_id(),expected_revision:s.revision(),
        expected_source_sha256:s.source_sha256(),
        postconditions:vec![],commands,post_references:post
    }
}
fn open(g:ReferenceIndex)->SaveSession {
    SaveSession::open_decoded_research(44,source(),626,g).unwrap()
}
#[test]
fn complete_known_source_link_and_unchanged_opaque_nested_state_pass() {
    let raw=source();
    let g=graph("ChestA");
    let audited=audit_grid_container_source(&raw,&g).unwrap();
    assert_eq!(audited.observed_container_links,1);
    assert!(audited.grid_container_scope_checked);
    assert!(!audited.cross_domain_reference_closure_complete);
    assert!(!audited.native_reference_semantics_verified);
    assert!(!audited.product_writer_authorized);
    let mut s=open(g.clone());
    let before=span(&raw,GRID_PATH);
    let after=before.replace("\"X\":4","\"X\":5");
    assert_ne!(before,after);
    let changes=s.stage_command_source_guarded(
        plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&before,&after)],g),
        &[format!("{GRID_PATH}/X")]
    ).unwrap();
    assert_eq!(changes.changed_paths,vec![GRID_PATH.to_owned()]);
    assert_eq!(s.revision(),1);
    let result=s.query_paged(&[format!("{GRID_PATH}/State")],0,1).unwrap();
    assert!(result[0].preview_json.contains("Mystery"));
    assert!(!s.validate_transaction().unwrap().encode_copy_authorized);
    assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
    s.undo(1).unwrap();
    assert_eq!(s.query_paged(&[format!("{GRID_PATH}/X")],0,1).unwrap()[0].preview_json,"4");
    s.redo(2).unwrap();
    assert_eq!(s.query_paged(&[format!("{GRID_PATH}/X")],0,1).unwrap()[0].preview_json,"5");
    assert_eq!(s.source_sha256(),sha256(&raw));
}
#[test]
fn omitted_or_invented_reference_does_not_pass_source_graph() {
    let raw=source();
    let mut omitted=graph("ChestA");
    omitted.edges.clear();
    assert_eq!(audit_grid_container_source(&raw,&omitted).unwrap_err(),
        "SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING");
    let mut fake=graph("ChestB");
    assert_eq!(audit_grid_container_source(&raw,&fake).unwrap_err(),
        "SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING");
    fake.nodes.remove(&id(Domain::ContainerInventory,"container:ChestB"));
    assert!(audit_grid_container_source(&raw,&fake).is_err());
    let mut s=open(omitted.clone());
    let old=span(&raw,GRID_PATH);
    let next=old.replace("\"X\":4","\"X\":5");
    assert_eq!(s.stage_command_source_guarded(
        plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&next)],omitted),
        &[format!("{GRID_PATH}/X")]
    ).unwrap_err(),"SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING");
    assert_eq!(s.revision(),0);
}
#[test]
fn nested_opaque_deletion_and_relexicalization_fail_before_commit() {
    let g=graph("ChestA");
    let mut s=open(g.clone());
    let raw=source();
    let old=span(&raw,GRID_PATH);
    let mut value:Value=serde_json::from_str(&old).unwrap();
    value.as_object_mut().unwrap().remove("State");
    value["X"]=json!(5);
    let deleted=value.to_string();
    let err=s.stage_command_source_guarded(
        plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&deleted)],g.clone()),
        &[format!("{GRID_PATH}/X")]).unwrap_err();
    assert_eq!(err,"GUARDED_OBJECT_KEYS_CHANGED");
    let changed=old.replace("\"X\":4","\"X\":5").replace("\"number\":1.0","\"number\":1.00");
    assert_ne!(old,changed);
    assert_eq!(s.stage_command_source_guarded(
        plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&changed)],g),
        &[format!("{GRID_PATH}/X")]
    ).unwrap_err(),"GUARDED_OPAQUE_BYTES_CHANGED");
    assert_eq!(s.revision(),0);
    assert_eq!(s.index_generation(),0);
}
#[test]
fn source_reference_rebound_rechecks_post_graph_and_mixed_domain_read_sets() {
    let g=graph("ChestA");let raw=source();
    let mut s=open(g.clone());
    let old=span(&raw,GRID_PATH);
    let new=old.replace("\"ContainerInventoryID\":\"ChestA\"",
        "\"ContainerInventoryID\":\"ChestB\"");
    let old_event=span(&raw,EVENT_PATH);
    let new_event="\"2022-09-06T00:00:00Z\"";
    let mut event=command(Domain::RecurringEvent,"event:2010000021",EVENT_PATH,
        &old_event,new_event);
    event.kind=CommandKind::ReplaceStringToken;
    event.read_set.push(ReadWitness {
        pointer:"/World/RecurringEvents/0/ItemSpawning/RecurringEventItemID".into(),
        expected_raw_json:"2010000021".into()
    });
    event.read_set.push(ReadWitness {
        pointer:"/World/RecurringEvents/0/ItemSpawning/OneofVariant".into(),
        expected_raw_json:"\"W1\"".into()
    });
    let commands=vec![
        command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&new),
        event
    ];
    let leaves=vec![
        format!("{GRID_PATH}/State/Storage/ContainerInventoryID"),
        EVENT_PATH.into()
    ];
    assert_eq!(s.stage_command_source_guarded(
        plan(&s,commands.clone(),g.clone()),&leaves
    ).unwrap_err(),"SOURCE_REFERENCE_INDEX_INCOMPLETE_OR_CONFLICTING");
    assert_eq!(s.revision(),0);
    let out=s.stage_command_source_guarded(
        plan(&s,commands,graph("ChestB")),&leaves).unwrap();
    assert_eq!(out.changed_paths.len(),2);
    assert_eq!(s.revision(),1);
    assert_eq!(s.inspect_references(&id(Domain::Grid,"grid:5:object:3")).unwrap()[0].to.key,
        "container:ChestB");
    s.undo(1).unwrap();
    assert_eq!(s.inspect_references(&id(Domain::Grid,"grid:5:object:3")).unwrap()[0].to.key,
        "container:ChestA");
    assert!(!s.validate_transaction().unwrap().semantic_domain_guards_accepted);
}
#[test]
fn unknown_reference_shape_missing_target_and_stale_cas_refused() {
    let g=graph("ChestA");let raw=source();
    let mut root:Value=serde_json::from_slice(&raw).unwrap();
    root["Unknown"]["rogue"]=json!({"ContainerInventoryID":"ChestA"});
    assert_eq!(audit_grid_container_source(root.to_string().as_bytes(),&g).unwrap_err(),
        "UNKNOWN_OR_UNSCANNED_CONTAINER_REFERENCE");
    let mut root:Value=serde_json::from_slice(&raw).unwrap();
    root["Player"]["ContainerInventories"].as_object_mut().unwrap().remove("ChestA");
    assert_eq!(audit_grid_container_source(root.to_string().as_bytes(),&g).unwrap_err(),
        "SOURCE_CONTAINER_REFERENCE_DANGLING");
    let mut s=open(g.clone());
    let old=span(&raw,GRID_PATH);
    let new=old.replace("\"X\":4","\"X\":5");
    let mut tx=plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&new)],g);
    tx.expected_source_sha256=[1;32];
    assert_eq!(s.stage_command_source_guarded(tx,&[format!("{GRID_PATH}/X")]).unwrap_err(),
        "SOURCE_SHA_CAS_FAILED");
    assert_eq!(s.revision(),0);
}

#[test]
fn caller_cannot_whitelist_unknown_nested_state_or_unwitnessed_w1() {
    let g=graph("ChestA"); let raw=source();
    let mut s=open(g.clone());
    let old=span(&raw,GRID_PATH);
    let changed=old.replace("\"escaped\":\"é\"","\"escaped\":\"replaced\"");
    assert_ne!(old,changed);
    assert_eq!(s.stage_command_source_guarded(
        plan(&s,vec![command(Domain::Grid,"grid:5:object:3",GRID_PATH,&old,&changed)],g.clone()),
        &[format!("{GRID_PATH}/State/Mystery/nested/escaped")]
    ).unwrap_err(),"GUARDED_FIELD_NOT_SEMANTICALLY_KNOWN");
    assert_eq!(s.revision(),0);
    let old_event=span(&raw,EVENT_PATH);
    let mut w1=command(Domain::RecurringEvent,"event:2010000021",EVENT_PATH,
        &old_event,"\"2022-09-06T00:00:00Z\"");
    w1.kind=CommandKind::ReplaceStringToken;
    assert_eq!(s.stage_command_source_guarded(
        plan(&s,vec![w1],g),&[EVENT_PATH.into()]
    ).unwrap_err(),"GUARDED_FIELD_NOT_SEMANTICALLY_KNOWN");
    assert_eq!(s.revision(),0);
}
