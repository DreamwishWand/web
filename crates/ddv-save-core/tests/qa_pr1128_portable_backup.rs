use ddv_save_core::portable_backup::{encode_inventory_amount_backup as encode,decode_inventory_amount_backup as decode,WAND_BACKUP_MAX_BYTES};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const SHA:&str="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
fn bytes(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
fn hash(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
fn seal(mut v:Value)->Vec<u8>{v.as_object_mut().unwrap().remove("sha256");let h=hash(&bytes(&v));v["sha256"]=json!(h);bytes(&v)}
fn body()->Value{json!({"format":"dreamwish-wand-backup","schemaVersion":1,"type":"inventory.existing-amount","sourceBuild":{"platform":"SteamWindows","buildKind":"SteamFullVersion","buildId":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","gameVersion":"1.25.3","schema":626},"target":{"inventoryId":4294967295u32,"itemId":1},"payload":{"amount":9999,"opaque":{"name":"雪🌙","nested":[null,false,18446744073709551615u64,-9223372036854775808i64]}},"provenance":{"decodedSha256":SHA}})}
#[test]
fn independently_sealed_exact_bytes_and_unknowns(){
 let v=body();let raw=seal(v.clone());let d=decode(&raw).unwrap();
 assert_eq!((d.inventory_id,d.item_id,d.amount),(u32::MAX,1,9999));
 assert_eq!(d.payload,v["payload"]);assert_eq!(d.source_decoded_sha256,SHA);
 assert_eq!(encode(d.inventory_id,d.item_id,SHA,&bytes(&v["payload"])).unwrap(),raw);
 let mut e=v.clone();e["payload"]["amount"]=json!(1);
 let low=seal(e);assert_eq!(decode(&low).unwrap().amount,1);
 println!("QA1128_INDEPENDENT_HASH_AND_UNKNOWN_EXACT {} bytes",raw.len());
}
#[test]
fn exact_byte_limit_and_depth(){
 let mut v=body();v["payload"]["padding"]=json!("");
 let n=WAND_BACKUP_MAX_BYTES-seal(v.clone()).len();
 v["payload"]["padding"]=json!("x".repeat(n));
 let raw=seal(v.clone());assert_eq!(raw.len(),WAND_BACKUP_MAX_BYTES);
 assert_eq!(decode(&raw).unwrap().payload,v["payload"]);
 assert_eq!(encode(u32::MAX,1,SHA,&bytes(&v["payload"])).unwrap(),raw);
 v["payload"]["padding"]=json!("x".repeat(n+1));
 assert_eq!(decode(&seal(v.clone())).unwrap_err().0,"WAND_BACKUP_SIZE");
 assert!(encode(u32::MAX,1,SHA,&bytes(&v["payload"])).is_err());
 let deep=format!("{{\"amount\":1,\"x\":{}0{}}}","[".repeat(200),"]".repeat(200));
 assert!(encode(1,1,SHA,deep.as_bytes()).is_err());
 println!("QA1128_EXACT_LIMIT_1048576_PLUS_ONE_DENIAL");
}
#[test]
fn recomputed_hash_is_not_authority_or_compatibility(){
 let good=body();let mut cases=vec![];
 for (k,v) in [
 ("schemaVersion",json!(1.0)),("format",json!("dreamwish-wand-backup ")),("type",json!("inventory.existing-amount ")),
 ("target",json!({"inventoryId":4294967296u64,"itemId":1})),("target",json!({"inventoryId":1,"itemId":-1})),
 ("target",json!({"inventoryId":1,"itemId":1,"writerAuthorized":true})),
 ("provenance",json!({"decodedSha256":SHA,"verified":true})),("provenance",json!({"decodedSha256":SHA.to_uppercase()})),
 ("payload",json!({"amount":true})),("payload",json!({"amount":-1})),("payload",json!({"amount":1.0})),("payload",json!({"amount":10000})),
 ("payload",json!([{"amount":1}])),("payload",json!({"Amount":1})),
 ]{let mut x=good.clone();x[k]=v;cases.push(x);}
 for (k,v) in [("platform",json!("Switch")),("buildKind",json!("SwitchBID")),("buildId",json!("releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-21")),("schema",json!(624)),("gameVersion",json!("1.25.4")),("schema",json!("626"))]{let mut x=good.clone();x["sourceBuild"][k]=v;cases.push(x);}
 let mut x=good.clone();x["restoreAuthorized"]=json!(true);cases.push(x);
 for (i,x) in cases.iter().enumerate(){assert!(decode(&seal(x.clone())).is_err(),"false accept {i}");}
 println!("QA1128_RESEALED_{}NEG",cases.len());
}
#[test]
fn canonical_wire_negatives(){
 let v=body();let raw=seal(v.clone());let s=String::from_utf8(raw.clone()).unwrap();
 let mut bad=vec![format!(" {s}").into_bytes(),format!("{s}\n").into_bytes(),format!("\u{feff}{s}").into_bytes(),s.replace("\"amount\":9999","\"amount\":9999,\"amount\":9999").into_bytes(),s.replace("\"amount\":9999","\"amount\":9.999e3").into_bytes(),s.replace("雪","\\u96ea").into_bytes()];
 let mut invalid=raw.clone();invalid[0]=0xff;bad.push(invalid);
 bad.push(raw[..raw.len()-1].to_vec());
 let mut tampered:Value=serde_json::from_slice(&raw).unwrap();tampered["payload"]["amount"]=json!(9998);bad.push(bytes(&tampered));
 for (i,x) in bad.iter().enumerate(){assert!(decode(x).is_err(),"wire false accept {i}");}
 // Unknown data remains opaque, but cannot create a command or top-level grant.
 let mut u=v.clone();u["payload"]["opaque"]["writerAuthorized"]=json!(true);
 let x=decode(&seal(u.clone())).unwrap();assert_eq!(x.payload,u["payload"]);
 assert_eq!(encode(x.inventory_id,x.item_id,SHA,&bytes(&x.payload)).unwrap(),seal(u));
 println!("QA1128_WIRE_{}NEG_OPAQUE_ROUNDTRIP",bad.len());
}
