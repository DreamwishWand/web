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

fn obj(id:u32,x:u32,y:u32,diag:bool)->Value{json!({"ID":id,"ItemID":40100068,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":if diag{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})}
fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{"GridCollection":{"DiffGrids":{},"Grids":{"9":{"ID":9,"TessellationFactor":2,"GridDefaultLayoutPath":"","NextGridObjectID":50,"Objects":{"10":obj(10,40,20,false),"11":obj(11,44,20,false),"12":{"ID":12,"ItemID":40000001,"X":80,"Y":90,"Unknown":{"keep":7}}}}}}},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100068":{"Amount":7025,"Marker":"Keep","Opaque":9}}}}},"Unknown":7})}
fn plan(d:&Value)->Value{json!({"contract":"wand.private.steam626.road-sr03-native-mixed-q5@1","sourceDecodedSha256":sha(&enc(d)),"gridId":9,"retainedId":10,"movedId":11,"expectedNextId":50,"expectedAmount":7025,"gridSha256":sha(&enc(&d["World"]["GridCollection"]["Grids"]["9"])),"inventoryEntrySha256":sha(&enc(&d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"])),"objects":[obj(10,40,20,false),obj(11,48,24,true),obj(50,44,20,true),obj(51,44,24,true),obj(52,48,20,true)]})}
fn call(d:&Value,p:&Value,mixed:Option<OsString>,extra:&[(&str,String)])->Output{let b=enc(p);let mut vars=vec![("WAND_LOCAL_SR03_CANONICAL_PLAN",String::from_utf8(b.clone()).unwrap()),("WAND_LOCAL_SR03_PLAN_SHA256",sha(&b))];vars.extend_from_slice(extra);run("--steam626-road-sr03-native-mixed-q5-only",&enc(d),&vars,mixed)}
#[test]fn qa_act943_sr03_cli_exact_and_cross_build(){
 let d=doc();let p=plan(&d);let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(53);
 for o in p["objects"].as_array().unwrap().iter().skip(1){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
 expected["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(7022);
 for mixed in [None,Some(OsString::new())]{let o=call(&d,&p,mixed,&[]);assert!(o.status.success(),"{:?}",o);assert_eq!(serde_json::from_slice::<Value>(&o.stdout).unwrap(),expected);}
 for mixed in [OsString::from("9A239D3DB569756D"),OsString::from(" "),OsString::from_vec(vec![255])]{deny(call(&d,&p,Some(mixed),&[]));}
 deny(call(&d,&p,None,&[("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION","wrong".into())]));
 for(k,v)in [("contract",json!("wand.private.switch626.road-rm01-native-mixed-q5@1")),("expectedAmount",json!(7024)),("gridSha256",json!("bad")),("expectedNextId",json!(51))]{let mut q=p.clone();q[k]=v;deny(call(&d,&q,None,&[]));}
 let mut q=p.clone();q["objects"][1]["ID"]=json!(50);deny(call(&d,&q,None,&[]));
 let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(48);q["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(24);deny(call(&q,&plan(&q),None,&[]));
}
