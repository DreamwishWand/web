// Independent QA-only, included in semantic_writer.rs in ephemeral CI checkout.
#[cfg(test)]
mod qa948_independent {
    use super::*;
    use crate::{BuildIdentity, SessionReceipt};
    use serde_json::{json,Value};
    fn fixture()->Value {json!({"GameInfo":{"Version":626},"World":{},"Player":{
      "ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"31100001":{"Amount":50,"Unknown":"keep"}}}},
      "ContainerInventories":{"12":{"ID":12,"ParentItemID":40000047,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":2,"ExtraSize":0,
      "Inventory":[{"ItemID":31200001,"Amount":12,"State":{},"Unknown":[1,2]},{"ItemID":0,"Amount":0}]}}},
      "Unknown":{"preserve":true}})}
    fn build()->BuildIdentity {BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}}
    fn open(v:&Value)->ProductSession {ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),build()).unwrap()}
    fn env(r:SessionReceipt,a:WorkerAction)->WorkerEnvelope {WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    fn i()->ExistingAmountSelection {ExistingAmountSelection::Inventory{inventory_id:4,item_id:31100001}}
    fn c()->ExistingAmountSelection {ExistingAmountSelection::Chest{container_id:12,slot_index:0}}
    fn read(s:&ProductSession,sel:ExistingAmountSelection)->CoreResult<CoreExistingAmountTarget>{s.read_existing_amount_target(env(s.receipt().unwrap(),WorkerAction::ReadDomain),sel)}
    fn grant(s:&ProductSession,sel:ExistingAmountSelection,n:u32)->AuthorizedExistingAmountTarget{AuthorizedExistingAmountTarget{target:read(s,sel).unwrap(),new_amount:n}}
    #[test] fn source_witness_exact_raw_entry_and_scope() {
      let v=fixture();let s=open(&v);let r=s.receipt().unwrap();let a=read(&s,i()).unwrap();let b=read(&s,c()).unwrap();
      let iv=a.view();let cv=b.view();
      assert_eq!(iv.item_id,31100001);assert_eq!(iv.old_amount,50);assert_eq!(iv.compatible_item_type,ExistingAmountItemType::ActivityItem);
      assert_eq!(iv.entry_sha256,sha(&serde_json::to_vec(&v["Player"]["ListInventories"]["4"]["Inventory"]["31100001"]).unwrap()));
      assert_eq!(cv.entry_sha256,sha(&serde_json::to_vec(&v["Player"]["ContainerInventories"]["12"]["Inventory"][0]).unwrap()));
      for x in [iv,cv]{assert_eq!(x.session_id,r.session_id);assert_eq!(x.revision,r.revision);assert_eq!(x.index_generation,r.index_generation);assert_eq!(x.decoded_sha256,r.decoded_sha256);}
      let f=cv.chest.unwrap();assert_eq!(f.parent_item_id,40000047);assert!(f.belongs_to_player);assert!(!f.block_move_to);assert_eq!((f.size,f.extra_size,f.physical_slot_count,f.packaged_stack_bound),(2,0,2,99));assert_eq!(f.state_sha256,sha(b"{}"));
      let mut detached=iv.clone();detached.old_amount=1;assert_eq!(a.view().old_amount,50);
    }
    #[test] fn enum_id_and_selector_contract(){
      for token in [json!("ItemType_Ingredient"),json!("ActivityItemType_Ingredient"),json!("ItemType_ActivityItem "),json!("ItemType_Currency"),json!("ItemType_Entitlement"),json!("ItemType_Furniture"),json!(3),Value::Null]{
        let mut v=fixture();v["Player"]["ListInventories"]["4"]["CompatibleItemType"]=token;assert!(read(&open(&v),i()).is_err());
      }
      for id in [0,29_999_999,50_000_000,2_147_483_648,u32::MAX]{
        let mut v=fixture();v["Player"]["ListInventories"]["4"]["Inventory"][id.to_string()]=json!({"Amount":50});
        assert!(read(&open(&v),ExistingAmountSelection::Inventory{inventory_id:4,item_id:id}).is_err());
      }
      let mut v=fixture();v["Player"]["ListInventories"]["4"]["CompatibleItemType"]=json!("ItemType_Furniture");v["Player"]["ListInventories"]["4"]["Inventory"]["49999999"]=json!({"Amount":2});
      assert_eq!(read(&open(&v),ExistingAmountSelection::Inventory{inventory_id:4,item_id:49999999}).unwrap().view().compatible_item_type,ExistingAmountItemType::Furniture);
      let mut v=fixture();v["Player"]["ListInventories"]["4"]["ID"]=json!(5);assert!(read(&open(&v),i()).is_err());
    }
    #[test] fn chest_capacity_state_and_subtypes(){
      for (key,val) in [("ID",json!(13)),("ParentItemID",json!(31100001)),("ParentItemID",json!(2147483648u64)),("BelongsToPlayer",json!("true")),("BelongsToPlayer",json!(false)),("BlockMoveTo",json!(true)),("Size",json!(1)),("ExtraSize",json!(3)),("ExtraSize",json!(2))]{
        let mut v=fixture();v["Player"]["ContainerInventories"]["12"][key]=val;assert!(read(&open(&v),c()).is_err(),"{key}");
      }
      for val in [json!({"Other":0}),json!(null),json!("{}"),json!([])]{
        let mut v=fixture();v["Player"]["ContainerInventories"]["12"]["Inventory"][0]["State"]=val;assert!(read(&open(&v),c()).is_err());
      }
      for (id,amount,ok) in [(31100001,50,true),(31100001,51,false),(31200001,99,true),(31200001,100,false),(31300001,2,false),(31400001,2,false),(31700001,99,true),(31700001,100,false),(40000001,2,false)] {
        let mut v=fixture();let x=&mut v["Player"]["ContainerInventories"]["12"]["Inventory"][0];x["ItemID"]=json!(id);x["Amount"]=json!(amount);assert_eq!(read(&open(&v),c()).is_ok(),ok,"{id}/{amount}");
      }
      let mut v=fixture();v["Player"]["ContainerInventories"]["12"]["Size"]=json!(256);
      v["Player"]["ContainerInventories"]["12"]["Inventory"]=json!(vec![json!({"ItemID":31200001,"Amount":12,"State":{}});256]);assert!(read(&open(&v),ExistingAmountSelection::Chest{container_id:12,slot_index:255}).is_ok());
      v["Player"]["ContainerInventories"]["12"]["Inventory"].as_array_mut().unwrap().push(json!({"ItemID":0,"Amount":0}));assert!(read(&open(&v),c()).is_err());
      let mut v=fixture();v["Player"]["ContainerInventories"]["12"]["ExtraSize"]=json!(1);let s=open(&v);assert!(read(&s,c()).is_ok());assert!(read(&s,ExistingAmountSelection::Chest{container_id:12,slot_index:1}).is_err());
    }
    #[test] fn no_production_mint_even_with_forged_save_and_epoch(){
      let mut v=fixture();v["Player"]["NativeAuthority"]=json!({"catalog":true,"rights":true,"variation":true,"activeRefs":true,"subscriberClosure":true,"hash":"fake"});
      let s=open(&v);let r=s.receipt().unwrap();let e=env(r,WorkerAction::ReadDomain);let t=read(&s,i()).unwrap();
      assert_eq!(s.authorize_existing_amount_target(e,&t,49).unwrap_err().0,"AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
      let other=open(&v);assert!(other.authorize_existing_amount_target(env(other.receipt().unwrap(),WorkerAction::ReadDomain),&t,49).is_err());
      for mut x in [e,e,e,e,e] { // individual mutations below
        x.expected_decoded_sha256[0]^=1;assert!(s.authorize_existing_amount_target(x,&t,49).is_err());
      }
      let mut x=e;x.expected_revision+=1;assert!(s.read_existing_amount_target(x,i()).is_err());
      let mut x=e;x.expected_index_generation+=1;assert!(s.authorize_existing_amount_target(x,&t,49).is_err());
      let mut x=e;x.session_id[0]^=1;assert!(s.read_existing_amount_target(x,i()).is_err());
      let mut fake=t.clone();fake.view.old_amount=49;assert!(s.authorize_existing_amount_target(e,&fake,48).is_err());
      let mut fake=t.clone();fake.view.entry_sha256[0]^=1;assert!(s.authorize_existing_amount_target(e,&fake,49).is_err());
      for n in [0,50,51,u32::MAX]{assert!(s.authorize_existing_amount_target(e,&t,n).is_err());}
      assert_eq!(s.receipt().unwrap(),r);s.close().unwrap();assert!(s.authorize_existing_amount_target(e,&t,49).is_err());
    }
    #[test] fn synthetic_grant_atomicity_sealed_amount_replay_and_exact_bytes(){
      let v=fixture();let s=open(&v);let r=s.receipt().unwrap();let e=env(r,WorkerAction::Stage);
      let good=grant(&s,i(),49);let bad=grant(&s,c(),0);
      assert!(s.stage_core_minted_amount_batch(e,&[good,bad]).is_err());assert_eq!(s.receipt().unwrap(),r);
      let dup=[grant(&s,i(),49),grant(&s,i(),48)];assert!(s.stage_core_minted_amount_batch(e,&dup).is_err());assert_eq!(s.receipt().unwrap(),r);
      let other=open(&v);assert!(s.stage_core_minted_amount_batch(e,&[grant(&other,i(),49)]).is_err());
      let mut stale=e;stale.expected_index_generation+=1;assert!(s.stage_core_minted_amount_batch(stale,&[grant(&s,i(),49)]).is_err());
      let req=[grant(&s,i(),49),grant(&s,c(),11)];
      let out=s.stage_core_minted_amount_batch(e,&req).unwrap();assert_eq!(out.operation_count,2);assert_eq!(out.exact_field_changed_count,2);assert!(!out.product_writer_authorized&&!out.native_v3_verified&&!out.original_overwrite_authorized);
      assert_eq!(out.revision,r.revision+1);assert_eq!(out.index_generation,r.index_generation+1);
      assert!(s.stage_core_minted_amount_batch(e,&req).is_err());assert!(read(&s,i()).is_err());
      let now=env(s.receipt().unwrap(),WorkerAction::Stage);assert!(!s.undo_typed_semantic_batch(now).unwrap().applied);
      assert!(s.redo_typed_semantic_batch(now).is_err());assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
      assert!(s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap().applied);
      let export=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);let bytes=s.take_typed_semantic_decoded_once(export).unwrap();
      let mut expected=v;expected["Player"]["ListInventories"]["4"]["Inventory"]["31100001"]["Amount"]=json!(49);expected["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(11);
      assert_eq!(bytes,serde_json::to_vec(&expected).unwrap());assert_eq!(sha(&bytes),out.staged_decoded_sha256);
      assert!(s.take_typed_semantic_decoded_once(export).is_err());
    }
    #[test] fn duplicate_json_and_wrong_build_fail_closed(){
      let raw=serde_json::to_string(&fixture()).unwrap().replace("\"Amount\":50","\"Amount\":50,\"Amount\":49");
      assert!(ProductSession::open_decoded_readonly(raw.into_bytes(),build()).is_err());
      let mut b=build();b.platform=Platform::Switch;b.build_kind=BuildKind::SwitchBid;b.build_id="9A239D3DB569756D".into();
      let s=ProductSession::open_decoded_readonly(serde_json::to_vec(&fixture()).unwrap(),b).unwrap();assert!(read(&s,i()).is_err());
    }
}
