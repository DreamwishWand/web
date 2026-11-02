//! Test adapter for exact Wand JS Codec vs Rust P1G cross-reopen.
//! Trusted in-process test harness supplies existing JS Codec's key in env;
//! never print or embed that key, and never use real user saves.
use std::io::{self,Read,Write};
use ddv_save_core::sha256;
use ddv_save_core::p1g::{decode_p1g_research,encode_synthetic_fixture,create_p1g_copy_research};
use ddv_save_core::TokenChange;
const JSON:&[u8]=br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"opaque":"\u00e9","decimal":1.00}}"#;
fn key_from_env()->Result<[u8;32],&'static str>{
 let text=std::env::var("DDV_TEST_CODEC_KEY_HEX").map_err(|_|"TEST_KEY_NOT_SUPPLIED")?;
 if text.len()!=64 || !text.bytes().all(|x|x.is_ascii_hexdigit()){
  return Err("INVALID_TEST_KEY_SHAPE");
 }
 let mut out=[0u8;32];
 for i in 0..32{
  out[i]=u8::from_str_radix(&text[i*2..i*2+2],16).map_err(|_|"INVALID_TEST_KEY_SHAPE")?;
 }
 Ok(out)
}
fn main(){if let Err(e)=run(){eprintln!("{e}");std::process::exit(1);}}
fn run()->Result<(),&'static str>{
 let key=key_from_env()?;
 let mode=std::env::args().nth(1).ok_or("MODE_REQUIRED")?;
 let mut stdout=io::stdout();
 match mode.as_str(){
  "fixture"=>{
   let cipher=encode_synthetic_fixture(JSON,&key,8)?;
   stdout.write_all(&cipher).map_err(|_|"OUTPUT_FAILED")?;
  }
  "inspect"|"edit"=>{
   let mut input=Vec::new();
   io::stdin().take(2_000_000).read_to_end(&mut input).map_err(|_|"INPUT_FAILED")?;
   if mode=="inspect" {
    let decoded=decode_p1g_research(&input,&key,1_000_000)?;
    stdout.write_all(&decoded.json).map_err(|_|"OUTPUT_FAILED")?;
   }else{
    let e=TokenChange {
     pointer:"/World/RecurringEvents/0/ItemSpawning/NextOccurrence".into(),
     expected_old_string:"2126-08-20T00:00:00Z".into(),
     replacement_string:"2022-09-06T00:00:00Z".into()
    };
    let out=create_p1g_copy_research(&input,sha256(&input),&key,626,&[e],1_000_000)?;
    if out.product_encode_copy_authorized{return Err("WRITER_PERMISSION_INVALID");}
    stdout.write_all(&out.edited_ciphertext).map_err(|_|"OUTPUT_FAILED")?;
   }
  }
  _=>return Err("MODE_UNSUPPORTED")
 }
 Ok(())
}
