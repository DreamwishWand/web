//! Test-only adapter for independent Node oracle. Decoded JSON only, no P1G.
use std::io::{self,Read,Write};
use ddv_save_core::{patch_json_string_tokens,sha256,TokenChange,MAX_DECODED_JSON_BYTES};
fn main(){
    if let Err(code)=run(){eprintln!("{code}");std::process::exit(1);}
}
fn run()->Result<(),&'static str>{
    let args:Vec<String>=std::env::args().collect();
    if args.len()!=5 {return Err("USAGE_POINTER_OLD_NEW_SCHEMA");}
    let schema=args[4].parse::<u64>().map_err(|_|"INVALID_SCHEMA")?;
    let mut source=Vec::new();
    io::stdin().take((MAX_DECODED_JSON_BYTES as u64)+1)
        .read_to_end(&mut source).map_err(|_|"READ_FAILED")?;
    let edit=TokenChange {pointer:args[1].clone(),expected_old_string:args[2].clone(),
        replacement_string:args[3].clone()};
    let updated=patch_json_string_tokens(&source,sha256(&source),schema,&[edit])?;
    io::stdout().write_all(&updated.bytes).map_err(|_|"OUTPUT_FAILED")?;
    Ok(())
}
