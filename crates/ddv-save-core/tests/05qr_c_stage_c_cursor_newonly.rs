//! 05 QR-C / StageC PR732 independent changed-risk Rust tests. Synthetic only.
#![cfg(feature="indexed-read")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,
    IndexedDomain,IndexedKind,PRODUCT_WORKER_CONTRACT,INDEX_PAGE_ENTRIES_MAX,
};
use serde_json::{json,Map,Value};
use std::sync::{Arc,Barrier};
use std::thread;
use sha2::{Digest,Sha256};

fn identity()->BuildIdentity {
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn open(raw:Vec<u8>)->ProductSession{ProductSession::open_decoded_readonly(raw,identity()).unwrap()}
fn scope(s:&ProductSession)->WorkerEnvelope{
    let r=s.receipt().unwrap();
    WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
}
fn sample(n:usize)->Vec<u8>{
    let mut player=Map::new();
    for i in 0..n{
        let v=match i%6{
            0=>json!({"inside":"escaped \",[]{} and 🌿","opaque":{"keep":null}}),
            1=>json!([0,{"nested":[true,null]},false]),
            2=>Value::String("a \\ escaped quote \" and braces {}[]".into()),
            3=>json!(-172),4=>json!(true),_=>Value::Null,
        };
        player.insert(format!("f_{i:03}"),v);
    }
    serde_json::to_vec(&json!({"GameInfo":{"Version":626},
        "Player":Value::Object(player),
        "World":{"WorldOpaque":{"nested":{"unchanged":0}},"Clock":null},
        "UnknownRoot":{"preserve":"do_not_mutate"}})).unwrap()
}

#[test]
fn q01_exact_page_edges_with_escaped_values_and_no_raw_body(){
    for (count,want_pages) in [(0,vec![0usize]),(16,vec![16]),(17,vec![16,1]),(32,vec![16,16])] {
        let s=open(sample(count));let before=s.receipt().unwrap();let e=scope(&s);
        let start=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
        assert_ne!(start.cursor,[0;16]);
        assert_eq!(start.max_entries_per_page,INDEX_PAGE_ENTRIES_MAX);
        assert!(!start.product_read_accepted && !start.writer_authorized);
        let mut cursor=Some(start.cursor);let mut sizes=vec![];let mut keys=vec![];
        while let Some(id)=cursor{
            let page=s.read_indexed_page(e,id).unwrap();
            sizes.push(page.fields.len());
            for f in &page.fields{assert!(f.value_bytes>0);keys.push(f.key.clone());}
            assert_eq!(page.decoded_sha256,before.decoded_sha256);
            assert!(!page.product_read_accepted && !page.complete_all_domains && !page.writer_authorized);
            cursor=page.next_cursor;
            if let Some(next)=cursor{assert_ne!(next,id);}
            assert!(s.read_indexed_page(e,id).is_err(),"used token cannot replay");
        }
        assert_eq!(sizes,want_pages);
        assert_eq!(keys,(0..count).map(|i|format!("f_{i:03}")).collect::<Vec<_>>());
        assert_eq!(s.receipt().unwrap(),before);
    }
}

#[test]
fn q02_parallel_same_cursor_one_page_and_one_rejection(){
    let s=Arc::new(open(sample(17)));let e=scope(&s);
    let token=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap().cursor;
    let before=s.receipt().unwrap();
    let barrier=Arc::new(Barrier::new(3));let mut threads=vec![];
    for _ in 0..2{
        let owned=Arc::clone(&s);let b=Arc::clone(&barrier);
        threads.push(thread::spawn(move||{b.wait();owned.read_indexed_page(e,token)}));
    }
    barrier.wait();
    let results:Vec<_>=threads.into_iter().map(|j|j.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|x|x.is_ok()).count(),1);
    assert_eq!(results.iter().filter(|x|x.is_err()).count(),1);
    let ok=results.iter().find_map(|x|x.as_ref().ok()).unwrap();
    assert_eq!(ok.fields.len(),16);assert!(ok.next_cursor.is_some());
    assert_eq!(s.receipt().unwrap(),before);
    let eof=s.read_indexed_page(e,ok.next_cursor.unwrap()).unwrap();
    assert_eq!(eof.fields.len(),1);assert_eq!(eof.next_cursor,None);
    assert!(s.read_indexed_page(e,token).is_err());
}

#[test]
fn q03_fake_scope_or_foreign_session_does_not_consume_good_token(){
    let a=open(sample(17));let b=open(sample(17));let good=scope(&a);
    let token=a.issue_indexed_cursor(good,IndexedDomain::Player).unwrap().cursor;
    let original=a.receipt().unwrap();
    assert_ne!(original.session_id,b.receipt().unwrap().session_id);
    assert!(b.read_indexed_page(scope(&b),token).is_err());
    for bad in [
        WorkerEnvelope{session_id:b.receipt().unwrap().session_id,..good},
        WorkerEnvelope{expected_revision:u64::MAX,..good},
        WorkerEnvelope{expected_index_generation:0,..good},
        WorkerEnvelope{expected_decoded_sha256:[0u8;32],..good},
        WorkerEnvelope{contract:"forged-worker",..good},
        WorkerEnvelope{action:WorkerAction::Stage,..good},
        WorkerEnvelope{action:WorkerAction::Apply,..good},
    ]{
        assert!(a.read_indexed_page(bad,token).is_err());
        assert_eq!(a.receipt().unwrap(),original);
    }
    assert!(a.read_indexed_page(good,[0;16]).is_err());
    assert!(a.issue_indexed_cursor(good,IndexedDomain::Unsupported).is_err());
    let page=a.read_indexed_page(good,token).unwrap();
    assert_eq!(page.fields.len(),16);
    assert!(!page.product_read_accepted && !page.writer_authorized);
    assert!(a.dispatch(good).is_err(),"product Worker still denies ReadDomain");
}

#[test]
fn q04_active_cap_rotation_and_close_revoke_tokens(){
    let s=open(sample(17));let e=scope(&s);
    let a=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    let b=s.issue_indexed_cursor(e,IndexedDomain::World).unwrap();
    assert!(s.issue_indexed_cursor(e,IndexedDomain::World).is_err());
    let one=s.read_indexed_page(e,a.cursor).unwrap();
    assert!(one.next_cursor.is_some());
    assert!(s.issue_indexed_cursor(e,IndexedDomain::Player).is_err());
    assert!(s.read_indexed_page(e,b.cursor).unwrap().next_cursor.is_none());
    let c=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    s.close().unwrap();
    assert!(s.read_indexed_page(e,c.cursor).is_err());
    assert!(s.read_indexed_page(e,one.next_cursor.unwrap()).is_err());
    assert!(s.issue_indexed_cursor(e,IndexedDomain::Player).is_err());
    assert!(s.receipt().is_err());
}

#[test]
fn q05_escaped_player_root_and_exact_encoded_key_boundaries(){
    let raw=br#"{"GameInfo":{"Version":626},"\u0050layer":{"path/../World":"{}[]","x~y":true},"World":{"Clock":0}}"#.to_vec();
    let s=open(raw);let e=scope(&s);
    let c=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    let p=s.read_indexed_page(e,c.cursor).unwrap();
    assert_eq!(p.fields.iter().map(|f|f.key.as_str()).collect::<Vec<_>>(),
        vec!["path/../World","x~y"]);
    assert_eq!(p.fields[0].kind,IndexedKind::String);
    assert_eq!(p.fields[1].kind,IndexedKind::Boolean);
    assert!(p.next_cursor.is_none());
    assert!(!p.product_read_accepted);
    for (chars,valid) in [(126usize,true),(127usize,false)]{
        let key="k".repeat(chars);
        let mut fields=Map::new();
        fields.insert(key.clone(),json!(0));
        let doc=serde_json::to_vec(&json!({
            "GameInfo":{"Version":626},"Player":Value::Object(fields),"World":{}
        })).unwrap();
        let session=open(doc);let query=scope(&session);
        let cursor=session.issue_indexed_cursor(query,IndexedDomain::Player).unwrap();
        let result=session.read_indexed_page(query,cursor.cursor);
        if valid{
            let p=result.unwrap();assert_eq!(p.fields.len(),1);
            assert_eq!(p.fields[0].key.len(),chars);
        }else{
            assert!(result.is_err(),"encoded key >128 bytes must fail closed");
            assert_eq!(session.receipt().unwrap().revision,0);
        }
    }
}

#[test]
fn q06_16mib_opaque_value_only_metadata_escapes_the_core(){
    const N:usize=16*1024*1024;
    let body="D".repeat(N);
    let data=serde_json::to_vec(&json!({"GameInfo":{"Version":626},
        "Player":{"opaqueHuge":body,"small":false},
        "World":{},"Unmodeled":{"preserve":"native_unknown"}})).unwrap();
    let digest:[u8;32]=Sha256::digest(&data).into();
    let s=open(data);let e=scope(&s);
    let c=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    let p=s.read_indexed_page(e,c.cursor).unwrap();
    assert_eq!(p.fields.len(),2);
    assert_eq!(p.fields[0].key,"opaqueHuge");
    assert_eq!(p.fields[0].kind,IndexedKind::String);
    assert_eq!(p.fields[0].value_bytes,N+2);
    assert_eq!(p.fields[1].key,"small");
    assert_eq!(p.fields[1].kind,IndexedKind::Boolean);
    assert_eq!(p.decoded_sha256,digest);
    assert!(format!("{p:?}").len()<2048);
    assert_eq!(s.receipt().unwrap().decoded_sha256,digest);
    assert!(s.dispatch(e).is_err());
}

#[cfg(feature="synthetic-stage-b")]
#[test]
fn q07_staged_atomic_mutation_invalidates_cursor_and_future_grants(){
    use ddv_save_core::SyntheticChangeSet;
    let original=serde_json::to_vec(&json!({
        "__WandSyntheticStageBOnly":"WAND_SYNTHETIC_ONLY_NOT_A_REAL_SAVE",
        "GameInfo":{"Version":626},
        "Player":{"__wandPlayerCounter":11,"untouched":{"keep":0}},
        "World":{"__wandWorldCounter":22}
    })).unwrap();
    let s=open(original);let e=scope(&s);
    let c=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap();
    s.synthetic_stage(SyntheticChangeSet{
        scope:WorkerEnvelope{action:WorkerAction::Stage,..e},
        expected_player:11,new_player:13,expected_world:22,new_world:24
    }).unwrap();
    assert_eq!(s.receipt().unwrap().revision,1);
    assert_eq!(s.receipt().unwrap().index_generation,2);
    assert!(s.read_indexed_page(e,c.cursor).is_err());
    assert!(s.issue_indexed_cursor(scope(&s),IndexedDomain::Player).is_err());
    assert!(s.dispatch(scope(&s)).is_err());
    assert!(!s.receipt().unwrap().product_read_accepted);
    assert!(!s.receipt().unwrap().writer_authorized);
}

#[test]
fn q08_nested_duplicate_and_escaped_equivalent_root_fail_before_index(){
    for raw in [
        br#"{"GameInfo":{"Version":626},"Player":{},"\u0050layer":{},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{"y":1,"\u0079":2},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":[]}"#.as_slice()
    ]{
        assert!(ProductSession::open_decoded_readonly(raw.to_vec(),identity()).is_err());
    }
}
