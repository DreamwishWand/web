//! Opt-in private local operator. Never run with actual saves in GitHub CI.
use ddv_save_core::offline_w1_v2::{PrivateW1V2Input,execute_private_w1_v2_research};
use std::{env,fs,path::Path};
fn required(k:&str)->Result<String,&'static str>{env::var(k).map_err(|_|"PRIVATE_ENV_MISSING")}
fn hash(k:&str)->Result<[u8;32],&'static str>{
 let s=required(k)?;
 if s.len()!=64||!s.bytes().all(|b|b.is_ascii_hexdigit()){return Err("PRIVATE_HASH_INVALID");}
 let mut out=[0u8;32];
 for i in 0..32{out[i]=u8::from_str_radix(&s[i*2..2*i+2],16).map_err(|_|"PRIVATE_HASH_INVALID")?;}
 Ok(out)
}
fn run()->Result<(),&'static str>{
 let a:Vec<_>=env::args().collect();
 if a.len()!=5{return Err("ARGS_SOURCE_BACKUP_EDITED_REGISTRY_REQUIRED");}
 let key=hash("DDV_PRIVATE_CODEC_KEY_HEX")?;
 let source_sha=hash("DDV_EXPECTED_P1G_SHA256")?;
 let decoded_sha=hash("DDV_EXPECTED_JSON_SHA256")?;
 let registry_sha=hash("DDV_EXPECTED_REGISTRY_SHA256")?;
 let platform=required("DDV_EXTERNAL_PLATFORM")?;
 let full_version=required("DDV_EXTERNAL_FULL_VERSION")?;
 let bid=required("DDV_EXTERNAL_SWITCH_BID")?;
 let old=required("DDV_W1_EXPECTED_OLD_UTC")?;
 let proposed=required("DDV_W1_PROPOSED_UTC")?;
 let registry=fs::read(&a[4]).map_err(|_|"PRIVATE_REGISTRY_READ_FAILED")?;
 let x=execute_private_w1_v2_research(PrivateW1V2Input{
  source_path:Path::new(&a[1]),backup_path:Path::new(&a[2]),
  edited_path:Path::new(&a[3]),key:&key,registry:&registry,
  source_sha,decoded_sha,registry_sha,
  platform:&platform,full_version:&full_version,bid:&bid,
  schema:626,expected_revision:0,old_utc:&old,proposed_utc:&proposed
 })?;
 if !x.atomic_diff_pass||!x.original_first_backup_reopened||
    !x.edited_file_reopened||x.independent_process_reopen||
    x.native_v3_verified||x.product_writer_authorized{
    return Err("PRIVATE_V2_RESEARCH_FLAGS_INVALID");
 }
 // No hashes, keys, profile, paths, or timestamps printed.
 println!("PRIVATE_W1_RUST_LOCAL_DISK_REOPEN=PASS");
 println!("INDEPENDENT_PROCESS_REOPEN=NOT_RUN");
 println!("NATIVE_V3=NOT_ACCEPTED");
 println!("PRODUCT_WRITER=OFF");
 Ok(())
}
fn main(){if let Err(code)=run(){eprintln!("{code}");std::process::exit(1);}}
