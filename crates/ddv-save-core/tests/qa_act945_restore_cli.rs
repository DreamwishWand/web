#![cfg(all(unix, feature="private-native-v2", feature="semantic-writer-dev"))]
use serde_json::{json,Value};
use sha2::{Sha256,Digest};
use std::{io::Write, process::{Command,Stdio,Output},ffi::OsString,os::unix::ffi::OsStringExt};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn enc(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
fn sha(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
fn run(mode:&str,input:&[u8],vars:&[(&str,String)],mixed:Option<OsString>)->Output{
 let mut c=Command::new(env!("CARGO_BIN_EXE_wand-local-rust-v2-noop"));
 c.env_remove("WAND_LOCAL_INSTALLED_SWITCH_BID").env("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION",STEAM)
 .env("WAND_LOCAL_ORIGINAL_SHA256","11".repeat(32)).env("WAND_LOCAL_ORIGINAL_SIZE_BYTES","50")
 .env("WAND_LOCAL_DECODED_SHA256",sha(input)).args([mode]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
 for(k,v) in vars{c.env(k,v);}if let Some(v)=mixed{c.env("WAND_LOCAL_INSTALLED_SWITCH_BID",v);}
 let mut child=c.spawn().unwrap();let _=child.stdin.take().unwrap().write_all(input);child.wait_with_output().unwrap()
}
fn deny(o:Output){assert_eq!(o.status.code(),Some(12),"{:?}",o);assert!(o.stdout.is_empty());}

fn doc(n:u32)->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000048":{"Amount":n,"Marker":"Keep","Unknown":7}}}}},"Unknown":{"keep":true}})}
fn entry(d:&Value)->&Value{&d["Player"]["ListInventories"]["0"]["Inventory"]["40000048"]}
fn backup(d:&Value)->Vec<u8>{let o=run("--inventory-amount-backup-only",&enc(d),&[("WAND_LOCAL_INVENTORY_ID","0".into()),("WAND_LOCAL_CANONICAL_ITEM_ID","40000048".into())],None);assert!(o.status.success(),"{:?}",o);o.stdout}
fn plan(d:&Value,a:&Value,b:&[u8])->Value{json!({"contract":"wand.private.catalog0-exact-lineage-restore-one@1","build":STEAM,"inventoryId":0,"itemId":40000048,"currentAmount":entry(d)["Amount"],"restoreAmount":entry(a)["Amount"],"currentDecodedSha256":sha(&enc(d)),"ancestorDecodedSha256":sha(&enc(a)),"currentEntrySha256":sha(&enc(entry(d))),"ancestorEntrySha256":sha(&enc(entry(a))),"portableBackupSha256":sha(b),"currentPackagedSha256":"11".repeat(32),"currentPackagedSize":50,"currentBackupSha256":"11".repeat(32),"currentBackupSize":50,"ancestorPackagedSha256":"22".repeat(32),"ancestorPackagedSize":51})}
fn call(dir:&std::path::Path,d:&Value,a:&Value,b:&[u8],p:&[u8],mixed:Option<OsString>,extra:&[(&str,String)])->Output{
 let a=enc(a);let mut vars=vec![("WAND_LOCAL_BACKUP_SHA256","11".repeat(32)),("WAND_LOCAL_BACKUP_SIZE_BYTES","50".into()),("WAND_LOCAL_RESTORE_ANCESTOR_PACKAGED_SHA256","22".repeat(32)),("WAND_LOCAL_RESTORE_ANCESTOR_PACKAGED_SIZE_BYTES","51".into())];
 for (name,pathkey,shakey,bytes) in [("ancestor","WAND_LOCAL_RESTORE_ANCESTOR_DECODED_PATH","WAND_LOCAL_RESTORE_ANCESTOR_DECODED_SHA256",a.as_slice()),("backup","WAND_LOCAL_RESTORE_BACKUP_PATH","WAND_LOCAL_RESTORE_BACKUP_SHA256",b),("plan","WAND_LOCAL_RESTORE_PLAN_PATH","WAND_LOCAL_RESTORE_PLAN_SHA256",p)]{let path=dir.join(name);std::fs::write(&path,bytes).unwrap();vars.push((pathkey,path.to_string_lossy().into_owned()));vars.push((shakey,sha(bytes)));}
 vars.extend_from_slice(extra);run("--private-steam626-catalog0-exact-lineage-restore-one-only",&enc(d),&vars,mixed)
}
#[test]fn qa_act945_restore_cli_rebound_lineage_and_build(){
 let dir=std::env::temp_dir().join(format!("wand-qa-act945-{}",std::process::id()));std::fs::create_dir_all(&dir).unwrap();
 let d=doc(99);let a=doc(100);let b=backup(&a);let p=plan(&d,&a,&b);
 let o=call(&dir,&d,&a,&b,&enc(&p),None,&[]);assert!(o.status.success(),"{:?}",o);assert_eq!(o.stdout,enc(&a));
 let mut a2=a.clone();a2["Unknown"]["keep"]=json!(false);let b2=backup(&a2);deny(call(&dir,&d,&a2,&b2,&enc(&plan(&d,&a2,&b2)),None,&[]));
 let a2=doc(101);let b2=backup(&a2);deny(call(&dir,&d,&a2,&b2,&enc(&plan(&d,&a2,&b2)),None,&[]));
 let mut q=p.clone();q["ancestorEntrySha256"]=json!("00".repeat(32));deny(call(&dir,&d,&a,&b,&enc(&q),None,&[]));
 let mut noncanonical=enc(&p);noncanonical.push(b' ');deny(call(&dir,&d,&a,&b,&noncanonical,None,&[]));
 for mixed in [OsString::from("9A239D3DB569756D"),OsString::from_vec(vec![255])]{deny(call(&dir,&d,&a,&b,&enc(&p),Some(mixed),&[]));}
 deny(call(&dir,&d,&a,&b,&enc(&p),None,&[("WAND_LOCAL_BACKUP_SIZE_BYTES","51".into())]));
 let mut bad=b.clone();bad[0]=b'[';deny(call(&dir,&d,&a,&bad,&enc(&p),None,&[]));
 std::fs::remove_dir_all(dir).unwrap();
}
