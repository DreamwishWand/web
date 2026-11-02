//! Independent QR research acceptance probes pinned to Wand PR312 HEAD
//! 473acaab467051a03b40e39d92878d2ed8197d31. Synthetic decoded JSON only.
//! This fixture intentionally demonstrates that asserted references/structural
//! preservation are NOT yet native-proven semantic Writer permission.
use ddv_save_core::session::{
    SaveSession,ReferenceIndex,ReferenceEdge,LogicalIdentity,Domain,TransactionPlan,
    SemanticCommand,CommandKind,ReadWitness,
};
use ddv_save_core::sha256;
use std::collections::BTreeSet;

fn identity(domain:Domain, key:&str)->LogicalIdentity{
    LogicalIdentity{domain,key:key.into()}
}
fn src()->Vec<u8>{
    br#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{"1":[{"ItemID":1,"Quantity":1}]},"CollectionSets":{"1":false},"ContainerInventories":{"A":{"Items":[]}}},"World":{"GridCollection":{"Grids":{"5":{"Objects":{"7":{"ID":7,"ItemID":1,"State":{"opaque":"KEEP","state":1},"Container":"A"}}}}},"RecurringEvents":{"0":{"ItemSpawning":{"NextOccurrence":"2126-08-20T00:00:00Z"}}}},"Quest":{"Progression":{"1":"Locked"}},"Unknown":{"e":"\u00e9","n":1.00,"arr":[null,3]}}"#.to_vec()
}
fn graph()->ReferenceIndex{
    let nodes=BTreeSet::from([
        identity(Domain::ListInventory,"list:1"),identity(Domain::CollectionSet,"set:1"),
        identity(Domain::ContainerInventory,"chest:A"),identity(Domain::Grid,"grid:5:obj:7"),
        identity(Domain::RecurringEvent,"event:0"),identity(Domain::Progression,"quest:1")
    ]);
    let edges=vec![ReferenceEdge{
        from:identity(Domain::Grid,"grid:5:obj:7"),to:identity(Domain::ContainerInventory,"chest:A")
    }];
    ReferenceIndex{nodes,edges}
}
fn open()->SaveSession {
    SaveSession::open_decoded_research(111,src(),626,graph()).unwrap()
}
fn edit(domain:Domain,logical:&str,path:&str,old:&str,new:&str)->SemanticCommand{
    SemanticCommand{domain,identity:identity(domain,logical),kind:CommandKind::ReplaceKnownSubtree,
        pointer:path.into(),expected_old_json:old.into(),new_json:new.into(),read_set:vec![]}
}
fn multi()->Vec<SemanticCommand>{
    vec![
        edit(Domain::ListInventory,"list:1","/Player/ListInventories/1",
             r#"[{"ItemID":1,"Quantity":1}]"#,r#"[{"ItemID":1,"Quantity":2},{"ItemID":5,"Quantity":1}]"#),
        edit(Domain::CollectionSet,"set:1","/Player/CollectionSets/1","false","true"),
        edit(Domain::ContainerInventory,"chest:A","/Player/ContainerInventories/A/Items","[]",
             r#"[{"ItemID":5,"Quantity":1}]"#),
        edit(Domain::Grid,"grid:5:obj:7","/World/GridCollection/Grids/5/Objects/7/State",
             r#"{"opaque":"KEEP","state":1}"#,r#"{"opaque":"KEEP","state":2,"nested":{"new":true}}"#),
        edit(Domain::Progression,"quest:1","/Quest/Progression/1",r#""Locked""#,r#""Ready""#),
        edit(Domain::RecurringEvent,"event:0","/World/RecurringEvents/0/ItemSpawning/NextOccurrence",
             r#""2126-08-20T00:00:00Z""#,r#""2022-09-06T00:00:00Z""#)
    ]
}
fn plan(s:&SaveSession,commands:Vec<SemanticCommand>,post:ReferenceIndex)->TransactionPlan {
    let postconditions=commands.iter().map(|c|ReadWitness{
        pointer:c.pointer.clone(),expected_raw_json:c.new_json.clone()
    }).collect();
    TransactionPlan{
        session_id:s.session_id(),expected_revision:s.revision(),
        expected_source_sha256:s.source_sha256(),commands,postconditions,post_references:post
    }
}
#[test]
fn independent_qr_cross_domain_atomic_revision_index_undo_redo_and_writer_denied(){
    let mut s=open();let original=src();let sha=sha256(&original);
    let first=s.query_paged(&["/Player/CollectionSets/1".into()],0,1).unwrap();
    assert_eq!(first[0].preview_json,"false");
    let changed=s.stage_command(plan(&s,multi(),graph())).unwrap();
    assert_eq!(changed.changed_paths.len(),6);
    assert_eq!(s.revision(),1);
    let page=s.query_paged(&["/Player/CollectionSets/1".into(),
        "/World/RecurringEvents/0/ItemSpawning/NextOccurrence".into()],0,2).unwrap();
    assert_eq!(page.len(),2);
    assert_eq!(page[0].preview_json,"true");
    assert_eq!(page[1].preview_json,r#""2022-09-06T00:00:00Z""#);
    let a=s.validate_transaction().unwrap();
    assert_eq!(a.transaction_count,1);
    assert_ne!(a.staged_sha256,sha);
    assert_eq!(a.source_sha256,sha);
    assert!(a.references_internally_consistent);
    assert!(!a.semantic_domain_guards_accepted);
    assert!(!a.encode_copy_authorized);
    assert!(!a.persistent_replace_authorized);
    assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
    s.undo(1).unwrap();assert_eq!(s.revision(),2);
    let a=s.query_paged(&["/Player/CollectionSets/1".into()],0,1).unwrap();
    assert_eq!(a[0].preview_json,"false");
    s.redo(2).unwrap();assert_eq!(s.revision(),3);
    let a=s.query_paged(&["/Player/CollectionSets/1".into()],0,1).unwrap();
    assert_eq!(a[0].preview_json,"true");
    assert_eq!(s.source_sha256(),sha);
    assert_eq!(sha256(&original),sha);
}
#[test]
fn independent_qr_revision_source_sha_read_cas_and_postcondition_atomic_denials(){
    let mut s=open();let sha=s.source_sha256();
    let mut stale=plan(&s,multi(),graph());stale.expected_revision=1;
    assert_eq!(s.stage_command(stale).unwrap_err(),"STALE_REVISION");
    let mut wrong=plan(&s,multi(),graph());wrong.session_id=112;
    assert_eq!(s.stage_command(wrong).unwrap_err(),"STALE_SESSION");
    let mut wrong=plan(&s,multi(),graph());wrong.expected_source_sha256=[0;32];
    assert_eq!(s.stage_command(wrong).unwrap_err(),"SOURCE_SHA_CAS_FAILED");
    let mut wrong=plan(&s,multi(),graph());
    wrong.commands[0].read_set.push(ReadWitness{
        pointer:"/Quest/Progression/1".into(),expected_raw_json:r#""Complete""#.into()
    });
    assert_eq!(s.stage_command(wrong).unwrap_err(),"READ_SET_CAS_FAILED");
    let mut wrong=plan(&s,multi(),graph());
    wrong.postconditions[0].expected_raw_json="[]".into();
    assert_eq!(s.stage_command(wrong).unwrap_err(),"POSTCONDITION_FAILED");
    assert_eq!(s.revision(),0);
    assert_eq!(s.index_generation(),0);
    assert_eq!(s.source_sha256(),sha);
    assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
    assert_eq!(s.undo(0).unwrap_err(),"UNDO_EMPTY");
}
#[test]
fn independent_qr_reference_edges_are_asserted_not_native_extracted(){
    let mut s=open();
    let missing=identity(Domain::ContainerInventory,"chest:A");
    let mut invalid=graph();invalid.nodes.remove(&missing);
    assert_eq!(s.stage_command(plan(&s,multi(),invalid)).unwrap_err(),"REFERENCE_TARGET_MISSING");
    let mut duplicate=graph();duplicate.edges.push(duplicate.edges[0].clone());
    assert_eq!(s.stage_command(plan(&s,multi(),duplicate)).unwrap_err(),"DUPLICATE_REFERENCE_EDGE");
    // Source document still stores Container:"A". Caller can assert an empty
    // graph, and research session accepts it because graph completeness
    // is NOT implemented. This MUST NOT be promoted to a true reference PASS.
    let silent=ReferenceIndex{nodes:graph().nodes,edges:vec![]};
    let mut p=plan(&s,vec![multi()[1].clone()],silent);
    p.postconditions.clear();
    s.stage_command(p).unwrap();
    assert_eq!(s.inspect_references(&identity(Domain::Grid,"grid:5:obj:7")).unwrap().len(),0);
    let receipt=s.validate_transaction().unwrap();
    assert!(receipt.references_internally_consistent);
    assert!(!receipt.semantic_domain_guards_accepted);
    assert!(!receipt.encode_copy_authorized);
}
#[test]
fn independent_qr_structural_parent_rewrite_could_drop_unknown_nested_field_and_remains_denied_for_export(){
    let mut s=open();
    let old=r#"{"opaque":"KEEP","state":1}"#;
    let new=r#"{"state":2}"#;
    let c=edit(Domain::Grid,"grid:5:obj:7",
        "/World/GridCollection/Grids/5/Objects/7/State",old,new);
    s.stage_command(plan(&s,vec![c],graph())).unwrap();
    const_check(&mut s);
}
fn const_check(s:&mut SaveSession){
    let rows=s.query_paged(&["/World/GridCollection/Grids/5/Objects/7/State".into(),
       "/Unknown".into()],0,2).unwrap();
    assert_eq!(rows[0].preview_json,r#"{"state":2}"#);
    assert!(rows[1].preview_json.contains(r#""n":1.00"#));
    assert!(rows[1].preview_json.contains(r#""e":"\u00e9""#));
    assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
    assert!(!s.validate_transaction().unwrap().semantic_domain_guards_accepted);
}
#[test]
fn independent_qr_true_pointer_collision_and_failing_mixed_patch_never_partially_publish(){
    let mut s=open();
    let mut commands=multi();
    commands[0].new_json=r#"[{"ItemID":1,"Quantity":2},{"ItemID":5,"Quantity":1}]"#.into();
    commands.push(edit(Domain::ListInventory,"list:1","/Player/ListInventories",r#"{"1":[{"ItemID":1,"Quantity":1}]}"#,
       r#"{"1":[]}"#));
    assert_eq!(s.stage_command(plan(&s,commands,graph())).unwrap_err(),"OVERLAPPING_COMMANDS");
    let mut commands=multi();commands[5].new_json="9007199254740992".into();
    assert!(s.stage_command(plan(&s,commands,graph())).is_err());
    assert_eq!(s.revision(),0);
    assert_eq!(s.validate_transaction().unwrap().transaction_count,0);
}
