#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use std::{sync::{Arc,Barrier},thread};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const RAW:&[u8]=br#"{"GameInfo":{"Version":626},"Player":{"NextContainerInventoryID":50,"ContainerInventories":{"41":{"ID":41,"ParentItemID":40000053,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":16,"ExtraSize":0,"Inventory":[{"ItemID":30200009,"Amount":11,"State":{"Unknown": 7},"Opaque":false}]},"42":{"ID":42,"ParentItemID":40000053}},"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{"40000053":{"Amount":0,"Marker":null}}}}},"World":{"GridCollection":{"Grids":{"23":{"ID":23,"Objects":{"81":{"ID":81,"ItemID":40000053,"X":-2147483648,"Y":2147483647,"Orientation":"GridOrientation_UpUpLeft","State":{"Storage":{"ContainerInventoryID":41,"DefaultContainerInventoryData":""},"Other":null}}}}},"DiffGrids":{"25":{"ID":25,"DefaultLayoutGridID":0,"ModifiedObjects":{},"RemovedObjects":[]}}}}}"#;
fn open()->ProductSession{ProductSession::open_decoded_readonly(RAW.to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true}).unwrap()}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession,e:WorkerEnvelope)->Result<Value,ddv_save_core::CoreError>{s.read_private_storage_stored_candidate(e,Some((23,81)))}
#[test]
fn independent_exact_scope_forged_contract_sha_generation_and_actions(){
 let s=open();let before=s.receipt().unwrap();let e=env(&s);
 let v=read(&s,e).unwrap();assert_eq!(v["target"]["containerId"],41);assert_eq!(v["container"]["physicalSlotCount"],1);assert_eq!(v["catalog"]["marker"]["present"],true);
 assert_eq!(v["storedReferences"]["allEffectiveReferencesVerified"],false);
 let mut x=e;x.contract="foreign";assert_eq!(read(&s,x).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 let mut x=e;x.expected_decoded_sha256[0]^=1;assert_eq!(read(&s,x).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 let mut x=e;x.expected_index_generation+=1;assert_eq!(read(&s,x).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
 let mut x=e;x.expected_revision+=1;assert_eq!(read(&s,x).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
 for action in [WorkerAction::ReadCoreSchemaWitness,WorkerAction::Stage,WorkerAction::ExportEditedCopy,WorkerAction::Apply,WorkerAction::OriginalOverwrite]{assert_eq!(read(&s,WorkerEnvelope{action,..e}).unwrap_err().0,"INDEX_OPERATION_DENIED");}
 let other=open();assert_eq!(read(&other,e).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
 assert_eq!(s.receipt().unwrap(),before);assert_eq!(read(&s,e).unwrap(),v);assert_eq!(other.receipt().unwrap().revision,0);
}
#[test]
fn independent_close_linearizes_storage_read_and_rejects_old_epoch(){
 let s=Arc::new(open());let e=env(&s);let gate=Arc::new(Barrier::new(3));
 let r=Arc::clone(&s);let g=Arc::clone(&gate);let reader=thread::spawn(move||{g.wait();for _ in 0..64{match read(&r,e){Ok(v)=>{assert_eq!(v["revision"],0);assert_eq!(v["indexGeneration"],1);assert_eq!(v["writerAuthorized"],false);},Err(x)=>assert_eq!(x.0,"SESSION_CLOSED")}}});
 let c=Arc::clone(&s);let g=Arc::clone(&gate);let closer=thread::spawn(move||{g.wait();c.close().unwrap();});
 gate.wait();reader.join().unwrap();closer.join().unwrap();assert_eq!(read(&s,e).unwrap_err().0,"SESSION_CLOSED");assert!(s.receipt().is_err());
 let fresh=open();assert_ne!(fresh.receipt().unwrap().session_id,e.session_id);assert_eq!(read(&fresh,e).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");assert_eq!(read(&fresh,env(&fresh)).unwrap()["target"]["objectId"],81);
}
#[test]
fn independent_source_raw_state_and_non_effective_fields(){
 use sha2::{Digest,Sha256};
 let s=open();let v=read(&s,env(&s)).unwrap();let hash=|x:&[u8]|format!("{:x}",Sha256::digest(x));
 assert_eq!(v["container"]["slots"][0]["stateSha256"],hash(br#"{"Unknown": 7}"#));
 assert_eq!(v["catalog"]["marker"]["sha256"],hash(b"null"));
 assert_eq!(v["storedReferences"]["sameParentStoredUnmatchedContainers"][0]["containerId"],42);
 for k in ["rightsVerified","variationVerified","initializedGeometryVerified","nativeSubscriberClosureVerified","nativeV3Verified","productReadAccepted","writerAuthorized","editedCopyAuthorized","applyAuthorized"]{assert_eq!(v[k],json!(false),"{k}");}
 for k in ["runtimeOrphanOrderVerified","effectiveDefaultGridVerified","effectiveSubgridParentClosureVerified","allEffectiveReferencesVerified"]{assert_eq!(v["storedReferences"][k],json!(false),"{k}");}
}
