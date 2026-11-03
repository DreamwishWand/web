//! Synthetic-only P1G cross-codec command. Fixed TEST KEY, never real save.
use std::io::{self,Read,Write};
use ddv_save_core::{sha256,TokenChange};
use ddv_save_core::p1g::{encode_synthetic_fixture,create_p1g_copy_research,decode_p1g_research};
const KEY:[u8;32]=[0x42;32];
const JSON:&[u8]=br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"opaque":"\u00e9","decimal":1.00}}"#;
fn main(){
 if let Err(e)=run(){eprintln!("{e}");std::process::exit(1);}
}
fn run()->Result<(),&'static str>{
 let arg=std::env::args().nth(1).ok_or("MODE_REQUIRED")?;
 let mut stdout=io::stdout();
 match arg.as_str(){
  "fixture"=>{
   let data=encode_synthetic_fixture(JSON,&KEY,8)?;
   stdout.write_all(&data).map_err(|_|"OUTPUT_FAILED")?;
  }
  "inspect"|"edit"=>{
   let mut encrypted=Vec::new();
   io::stdin().take(2_000_000).read_to_end(&mut encrypted).map_err(|_|"INPUT_FAILED")?;
   if arg=="inspect" {
    let opened=decode_p1g_research(&encrypted,&KEY,1_000_000)?;
    stdout.write_all(&opened.json).map_err(|_|"OUTPUT_FAILED")?;
   }else{
    let change=TokenChange{
     pointer:"/World/RecurringEvents/0/ItemSpawning/NextOccurrence".into(),
     expected_old_string:"2126-08-20T00:00:00Z".into(),
     replacement_string:"2022-09-06T00:00:00Z".into()
    };
    let result=create_p1g_copy_research(&encrypted,sha256(&encrypted),&KEY,626,&[change],1_000_000)?;
    if result.product_encode_copy_authorized||result.persistent_replace_authorized{
     return Err("UNEXPECTED_PRODUCT_PERMISSION");
    }
    stdout.write_all(&result.edited_ciphertext).map_err(|_|"OUTPUT_FAILED")?;
   }
  }
  _=>return Err("INVALID_MODE")
 }
 Ok(())
}
