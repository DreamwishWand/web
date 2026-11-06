#![cfg(feature="indexed-read")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,IndexedDomain,IndexedKind,WorkerAction,
    WorkerEnvelope,PRODUCT_WORKER_CONTRACT,INDEX_PAGE_ENTRIES_MAX
};
use sha2::{Digest,Sha256};
fn build()->BuildIdentity {
    BuildIdentity {platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn sample(fields:usize)->Vec<u8>{
    let mut player=String::new();
    for n in 0..fields {
        if n>0 {player.push(',');}
        let typed=match n%6{
            0=>r#"{"inner":"a,b,[c]","emoji":"🌿"}"#,
            1=>r#"[1,2,{"deep":[true,false,null]}]"#,
            2=>r#""text with \" quote and unicode""#,
            3=>"999",
            4=>"false",
            _=>"null",
        };
        player.push_str(&format!("\"field_{n:03}\":{typed}"));
    }
    format!(r#"{{"GameInfo":{{"Version":626}},"UnknownFuture":{{"opaque":{{"literal":"preserve"}}}},"Player":{{{player}}},"World":{{"WorldRoot":{{"Area":{{"Unknown":true}}}},"Clock":0}}}}"#).into_bytes()
}
fn open(fields:usize)->ProductSession { ProductSession::open_decoded_readonly(sample(fields),build()).unwrap() }
fn scope(s:&ProductSession)->WorkerEnvelope {
    let r=s.receipt().unwrap();
    WorkerEnvelope { contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain }
}
#[test]
fn two_whitelisted_typed_domain_pages_are_bounded_core_issued_and_not_raw_json(){
    let s=open(33);let r=s.receipt().unwrap();let e=scope(&s);
    let first=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    assert_eq!(first.session_id,r.session_id);
    assert_eq!(first.revision,0);assert_eq!(first.index_generation,1);
    assert_eq!(first.domain.path(),"/Player");
    assert_eq!(first.max_entries_per_page,INDEX_PAGE_ENTRIES_MAX);
    assert!(!first.complete_all_domains && !first.product_read_accepted && !first.writer_authorized);
    let p1=s.read_indexed_page(e,first.cursor).unwrap();
    assert_eq!(p1.fields.len(),16);
    assert_eq!(p1.fields[0].key,"field_000");
    assert_eq!(p1.fields[0].kind,IndexedKind::Object);
    assert_eq!(p1.fields[1].kind,IndexedKind::Array);
    assert_eq!(p1.fields[2].kind,IndexedKind::String);
    assert_eq!(p1.fields[3].kind,IndexedKind::Number);
    assert_eq!(p1.fields[4].kind,IndexedKind::Boolean);
    assert_eq!(p1.fields[5].kind,IndexedKind::Null);
    assert!(p1.fields.iter().all(|f|f.value_bytes>0));
    assert!(!p1.product_read_accepted && !p1.writer_authorized);
    let next=p1.next_cursor.unwrap();
    assert_ne!(first.cursor,next);
    assert!(s.read_indexed_page(e,first.cursor).is_err()); // one-use replay
    let p2=s.read_indexed_page(e,next).unwrap();
    assert_eq!(p2.fields.len(),16);
    let p3=s.read_indexed_page(e,p2.next_cursor.unwrap()).unwrap();
    assert_eq!(p3.fields.len(),1);
    assert_eq!(p3.fields[0].key,"field_032");
    assert!(p3.next_cursor.is_none());
    assert!(s.read_indexed_page(e,next).is_err());
    assert_eq!(s.receipt().unwrap(),r);
    let world=s.issue_indexed_cursor(e,IndexedDomain::World).unwrap();
    let page=s.read_indexed_page(e,world.cursor).unwrap();
    assert_eq!(page.fields.iter().map(|f|f.key.as_str()).collect::<Vec<_>>(),vec!["WorldRoot","Clock"]);
    assert_eq!(page.fields[0].kind,IndexedKind::Object);
    assert_eq!(page.fields[1].kind,IndexedKind::Number);
    assert!(page.next_cursor.is_none());
}
#[test]
fn forged_session_sha_rev_generation_action_unknown_and_cursor_cross_session_fail(){
    let a=open(21);let b=open(21);let e=scope(&a);
    let first=a.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    assert_ne!(a.receipt().unwrap().session_id,b.receipt().unwrap().session_id);
    assert!(b.read_indexed_page(scope(&b),first.cursor).is_err());
    let mut wrong=e;wrong.session_id[0]^=1;
    assert!(a.read_indexed_page(wrong,first.cursor).is_err());
    let mut wrong=e;wrong.expected_revision=1;
    assert!(a.read_indexed_page(wrong,first.cursor).is_err());
    let mut wrong=e;wrong.expected_index_generation=2;
    assert!(a.read_indexed_page(wrong,first.cursor).is_err());
    let mut wrong=e;wrong.expected_decoded_sha256[0]^=1;
    assert!(a.read_indexed_page(wrong,first.cursor).is_err());
    let mut wrong=e;wrong.contract="ui.forgery";
    assert!(a.read_indexed_page(wrong,first.cursor).is_err());
    let mut wrong=e;wrong.action=WorkerAction::Stage;
    assert!(a.issue_indexed_cursor(wrong,IndexedDomain::Player).is_err());
    assert!(a.issue_indexed_cursor(e,IndexedDomain::Unsupported).is_err());
    assert!(a.read_indexed_page(e,[0;16]).is_err());
    assert!(a.read_indexed_page(e,first.cursor).is_ok()); // rejected scope never consumes
    assert!(a.dispatch(e).is_err()); // product Worker unsupported ReadDomain remains denied
    assert!(a.dispatch(WorkerEnvelope{action:WorkerAction::Stage,..e}).is_err());
}
#[test]
fn multiple_cursor_limit_lifecycle_close_drop_and_empty_domain(){
    let s=open(0);let e=scope(&s);
    let a=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    let b=s.issue_indexed_cursor(e,IndexedDomain::World).unwrap();
    assert!(s.issue_indexed_cursor(e,IndexedDomain::Player).is_err()); // active cap2
    assert!(s.read_indexed_page(e,a.cursor).unwrap().fields.is_empty());
    assert!(s.read_indexed_page(e,b.cursor).unwrap().fields.len()==2);
    let next=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    s.close().unwrap();
    assert!(s.read_indexed_page(e,next.cursor).is_err());
    assert!(s.issue_indexed_cursor(e,IndexedDomain::World).is_err());
    assert!(s.receipt().is_err());
}
#[test]
fn unknown_large_values_have_bounded_metadata_and_source_sha_is_immutable(){
    const N:usize=16*1024*1024;
    let body="x".repeat(N);
    let data=format!(r#"{{"GameInfo":{{"Version":626}},"Player":{{"UnknownOpaque":"{body}","RootArray":[{{"odd":3}}]}},"World":{{}},"UnmodeledExtension":{{"preserve":false}}}}"#).into_bytes();
    let sha: [u8;32]=Sha256::digest(&data).into();
    let s=ProductSession::open_decoded_readonly(data,build()).unwrap();
    let e=scope(&s);assert_eq!(e.expected_decoded_sha256,sha);
    let c=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    let page=s.read_indexed_page(e,c.cursor).unwrap();
    assert_eq!(page.fields.len(),2);
    assert_eq!(page.fields[0].key,"UnknownOpaque");
    assert_eq!(page.fields[0].kind,IndexedKind::String);
    assert!(page.fields[0].value_bytes>=N);
    assert_eq!(page.fields[1].kind,IndexedKind::Array);
    assert_eq!(page.decoded_sha256,sha);
    assert!(page.fields.iter().all(|f|f.key.len()<=128));
    assert!(!page.product_read_accepted);
    assert_eq!(s.receipt().unwrap().decoded_sha256,sha);
    assert!(s.dispatch(e).is_err());
}
#[test]
fn malformed_duplicate_overlong_root_or_field_key_rejected_without_leak(){
    let bad=[
        br#"{"GameInfo":{"Version":626},"Player":{"a":1,"a":2},"World":{}}"#.to_vec(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":{},"World":{}}"#.to_vec(),
        br#"{"GameInfo":{"Version":626},"Player":[],"World":{}}"#.to_vec(),
        br#"{"GameInfo":{"Version":624},"Player":{},"World":{}}"#.to_vec(),
        b"not json".to_vec()
    ];
    for data in bad {
        assert!(ProductSession::open_decoded_readonly(data,build()).is_err());
    }
    let overlong="x".repeat(150);
    let json=format!(r#"{{"GameInfo":{{"Version":626}},"Player":{{"{overlong}":1}},"World":{{}}}}"#);
    let s=ProductSession::open_decoded_readonly(json.into_bytes(),build()).unwrap();
    let c=s.issue_indexed_cursor(scope(&s),IndexedDomain::Player).unwrap();
    assert!(s.read_indexed_page(scope(&s),c.cursor).is_err());
    assert!(s.receipt().is_ok());
}
#[test]
fn feature_joint_stage_b_ledger_disables_all_new_typed_cursor_grants(){
    #[cfg(feature="synthetic-stage-b")] {
        use ddv_save_core::SyntheticChangeSet;
        let fixture=serde_json::to_vec(&serde_json::json!({
            "__WandSyntheticStageBOnly":"WAND_SYNTHETIC_ONLY_NOT_A_REAL_SAVE",
            "GameInfo":{"Version":626},"Player":{"__wandPlayerCounter":11},
            "World":{"__wandWorldCounter":22}
        })).unwrap();
        let s=ProductSession::open_decoded_readonly(fixture,build()).unwrap();
        let e=scope(&s);
        let index=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
        let stage=SyntheticChangeSet { scope:WorkerEnvelope{action:WorkerAction::Stage,..e},
            expected_player:11,new_player:12,expected_world:22,new_world:23 };
        assert!(s.synthetic_stage(stage).is_ok());
        assert!(s.read_indexed_page(e,index.cursor).is_err());
        assert!(s.issue_indexed_cursor(scope(&s),IndexedDomain::Player).is_err());
    }
}
