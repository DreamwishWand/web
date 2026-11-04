//! Opt-in private local operator. Never run with actual saves in GitHub CI.
use ddv_save_core::offline_w1_v2::{PrivateW1V2Input,execute_private_w1_v2_research};
use std::{env,fs,path::{Path,PathBuf},process::{Command,Stdio}};
fn as_hex32(value:[u8;32])->String{
 value.iter().map(|x|format!("{x:02x}")).collect::<Vec<_>>().join("")
}
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
    !x.edited_file_reopened||!x.core_and_stage_share_immutable_decoded_source||
    !x.original_ciphertext_borrowed_from_trusted_core||
    x.independent_process_reopen||
    x.native_v3_verified||x.product_writer_authorized{
    return Err("PRIVATE_V2_RESEARCH_FLAGS_INVALID");
 }
 // Require a fresh independent Node process using its own crypto/ZIP/CRC.
 // Reusing Rust's self-reopen result is not enough for a V2 evidence chain.
 let script=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("scripts/w1-independent-fresh-reopen.mjs");
 let status=Command::new("node").arg(script)
   .arg(&a[1]).arg(&a[2]).arg(&a[3])
   .env("DDV_EXPECTED_EDITED_P1G_SHA256",as_hex32(x.edited_sha))
   .env("DDV_EXPECTED_EDITED_JSON_SHA256",as_hex32(x.edited_decoded_sha))
   .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
   .status().map_err(|_|"PRIVATE_NODE_PROCESS_UNAVAILABLE")?;
 if !status.success(){return Err("PRIVATE_INDEPENDENT_NODE_REOPEN_DENIED");}
 // Redacted status only; no hashes, keys, raw JSON, paths or UTC.
 println!("PRIVATE_W1_RUST_LOCAL_DISK_REOPEN=PASS");
 println!("INDEPENDENT_NODE_FRESH_PROCESS_REOPEN=PASS");
 println!("NATIVE_V3=NOT_ACCEPTED");
 println!("PRODUCT_WRITER=OFF");
 Ok(())
}
fn main(){if let Err(code)=run(){eprintln!("{code}");std::process::exit(1);}}
