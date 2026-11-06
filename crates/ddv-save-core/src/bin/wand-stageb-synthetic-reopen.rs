//! Test-only fresh PROCESS readback for synthetic StageB JSON.
//! The actual Steam P1G container, Native V3 and Product Writer are unsupported.
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession};
use std::{env,fs,path::Path};

fn main(){
    let args:Vec<String>=env::args().collect();
    if args.len()!=4 { std::process::exit(3); }
    let path=Path::new(&args[1]);
    if path.file_name().and_then(|n|n.to_str())!=Some("wand-stageb-edited-copy.json") {
        std::process::exit(4);
    }
    let expected_p=match args[2].parse::<i64>(){Ok(v)=>v,Err(_)=>std::process::exit(5)};
    let expected_w=match args[3].parse::<i64>(){Ok(v)=>v,Err(_)=>std::process::exit(6)};
    let bytes=match fs::read(path){Ok(v) if v.len()<=1024*1024=>v,_=>std::process::exit(7)};
    let build=BuildIdentity{
        platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".to_owned(),schema:626,externally_attested:true
    };
    let session=match ProductSession::open_decoded_readonly(bytes,build){
        Ok(s)=>s,Err(_)=>std::process::exit(8)
    };
    if session.synthetic_fixture_counters()!=Ok((expected_p,expected_w)){
        std::process::exit(9);
    }
    let receipt=match session.receipt(){Ok(r)=>r,Err(_)=>std::process::exit(10)};
    if receipt.product_read_accepted || receipt.writer_authorized ||
       receipt.all_domain_references_verified || receipt.edited_copy_authorized {
        std::process::exit(11);
    }
    println!("STAGEB_SYNTHETIC_FRESH_PROCESS_READ_ONLY_PASS");
}
