//! Local-only V2 P1G research probe. NEVER commit original/edited bytes.
 //! Supply encrypted source through stdin, key and source SHA through environment.
 //! Binary outputs from noop/edit must be written only to isolated private storage.
 //! No product Writer, native semantics, or device authority is inferred.
use std::io::{self,Read,Write};
use ddv_save_core::{sha256,index_selected_tokens,strict_decode_json_string_token,TokenChange};
use ddv_save_core::p1g::{decode_p1g_research,create_p1g_noop_rebuild_research,create_p1g_copy_research};
const MAX_JSON:usize=128*1024*1024;
fn parse_hash(raw:&str)->Result<[u8;32],&'static str>{
 if raw.len()!=64||!raw.bytes().all(|b|b.is_ascii_hexdigit()){return Err("HEX_INPUT_INVALID");}
 let mut out=[0u8;32];
 for i in 0..32{out[i]=u8::from_str_radix(&raw[i*2..i*2+2],16).map_err(|_|"HEX_INPUT_INVALID")?;}
 Ok(out)
}
fn required(name:&str)->Result<String,&'static str>{
 std::env::var(name).map_err(|_|"REQUIRED_ENV_MISSING")
}
fn verify_w1(raw:&[u8],index:usize,event_id:u64,variant:&str,old_utc:&str)
 ->Result<String,&'static str>{
 let row_ptr=format!("/World/RecurringEvents/{index}");
 let path=format!("{row_ptr}/{variant}/NextOccurrence");
 let id_ptr=format!("{row_ptr}/{variant}/RecurringEventItemID");
 let paths=vec![row_ptr.clone(),path.clone(),id_ptr.clone()];
 let hits=index_selected_tokens(raw,&paths)?;
 let get=|ptr:&str|->Result<&str,&'static str>{
  hits.iter().find(|h|h.pointer==ptr).map(|h|h.value.as_str()).ok_or("W1_SOURCE_PATH_MISSING")
 };
 let row:serde_json::Value=serde_json::from_str(get(&row_ptr)?).map_err(|_|"W1_ROW_INVALID")?;
 let members=row.as_object().ok_or("W1_ROW_INVALID")?;
 if members.len()!=1||!members.contains_key(variant){return Err("W1_ONEOF_MISMATCH");}
 let id:serde_json::Value=serde_json::from_str(get(&id_ptr)?).map_err(|_|"W1_ID_INVALID")?;
 if !(id.as_u64()==Some(event_id)||id.as_str()==Some(event_id.to_string().as_str())){
  return Err("W1_EVENT_ID_CAS_FAILED");
 }
 let utc=strict_decode_json_string_token(get(&path)?)?;
 if utc!=old_utc{return Err("W1_OLD_UTC_CAS_FAILED");}
 Ok(path)
}
fn run()->Result<(),&'static str>{
 let key=parse_hash(&required("DDV_PRIVATE_CODEC_KEY_HEX")?)?;
 let expected_sha=parse_hash(&required("DDV_EXPECTED_P1G_SHA256")?)?;
 let bid=required("DDV_EXTERNAL_SWITCH_BID")?;
 if bid!="9A239D3DB569756D"{return Err("EXTERNAL_BUILD_NOT_VERIFIED");}
 let args:Vec<String>=std::env::args().collect();
 let mode=args.get(1).map(|x|x.as_str()).ok_or("MODE_REQUIRED")?;
 if !matches!(mode,"inspect"|"noop"|"edit"){return Err("MODE_UNSUPPORTED");}
 let mut source=Vec::new();
 io::stdin().take(256*1024*1024+1).read_to_end(&mut source).map_err(|_|"INPUT_FAILED")?;
 if source.len()>256*1024*1024||sha256(&source)!=expected_sha{
  return Err("ENCRYPTED_SOURCE_CAS_OR_SIZE_FAILED");
 }
 let decoded=decode_p1g_research(&source,&key,MAX_JSON)?;
 let schema=index_selected_tokens(&decoded.json,&["/GameInfo/Version".into()])?;
 if schema.first().map(|s|s.value.as_str())!=Some("626"){return Err("SAVE_SCHEMA_MISMATCH");}
 let mut stdout=io::stdout();
 match mode {
  "inspect"=> {
   writeln!(&mut stdout,"schema626=1,encrypted_sha_verified=1,decoded_bytes={},zip_method={},writer=0",
    decoded.json.len(),decoded.metadata.method).map_err(|_|"OUTPUT_FAILED")?;
  },
  "noop"=> {
   let out=create_p1g_noop_rebuild_research(&source,expected_sha,&key,MAX_JSON)?;
   if out.product_encode_copy_authorized||out.persistent_replace_authorized ||
      out.decoded_before_sha256!=out.decoded_after_sha256 || !out.verified_changed_pointers.is_empty() {
     return Err("UNAUTHORIZED_OR_LOSSY_NOOP");
   }
   stdout.write_all(&out.edited_ciphertext).map_err(|_|"OUTPUT_FAILED")?;
  },
  "edit"=> {
   let index:usize=required("DDV_W1_SAVED_INDEX")?.parse().map_err(|_|"INDEX_INVALID")?;
   let event_id:u64=required("DDV_W1_EVENT_ID")?.parse().map_err(|_|"EVENT_ID_INVALID")?;
   let variant=required("DDV_W1_ONEOF")?;
   if !matches!(variant.as_str(),"ItemSpawning"|"WildCropsSpawningInVillage"|
       "FlowerSpawningInVillage"|"FishSpawningInVillage"){
      return Err("W1_KIND_NOT_IN_RESEARCH_SCOPE");
   }
   let old=required("DDV_W1_OLD_UTC")?;
   let new=required("DDV_W1_NEW_UTC")?;
   if old==new{return Err("W1_NOOP_DENIED");}
   let ptr=verify_w1(&decoded.json,index,event_id,&variant,&old)?;
   let change=TokenChange{pointer:ptr.clone(),expected_old_string:old,
      replacement_string:new};
   let out=create_p1g_copy_research(&source,expected_sha,&key,626,&[change],MAX_JSON)?;
   if out.product_encode_copy_authorized||out.persistent_replace_authorized||
      out.verified_changed_pointers!=vec![ptr]{return Err("RESEARCH_PERMISSION_OR_PATH_INVALID");}
   stdout.write_all(&out.edited_ciphertext).map_err(|_|"OUTPUT_FAILED")?;
  },
  _=>return Err("MODE_UNSUPPORTED"),
 }
 Ok(())
}
fn main(){if let Err(code)=run(){eprintln!("{code}");std::process::exit(1);}}
