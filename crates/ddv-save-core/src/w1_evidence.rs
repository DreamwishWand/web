//! Wand-owned source-verified W1 STRUCTURAL witnesses only.
//! W1 Native/event/area semantics belong to 02 TIME. No write capability.
use crate::{EngineResult,sha256,index_selected_tokens,strict_decode_json_string_token};
use crate::p1g::{decode_p1g_research,DecodedP1g};

pub const W1_EVIDENCE_CONTRACT:&str="dreamwish.ddv.w1-source-witness.research@1";
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct P1gSourceIdentity {
 pub encrypted_p1g_sha256:[u8;32],
 pub decoded_json_sha256:[u8;32],
 pub registry_sha256:[u8;32],
 pub platform:String,
 pub build_identity_kind:String,
 pub build_id:String,
 pub schema:u64,
 /// The BID and platform are externally selected, not extracted from P1G.
 pub external_build_selection_only:bool,
 pub build_cryptographically_bound_to_save:bool,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum W1Kind {ItemSpawning,WildCropsSpawningInVillage,FlowerSpawningInVillage,FishSpawningInVillage}
impl W1Kind {
 pub fn as_str(self)->&'static str {
  match self {
   Self::ItemSpawning=>"ItemSpawning",
   Self::WildCropsSpawningInVillage=>"WildCropsSpawningInVillage",
   Self::FlowerSpawningInVillage=>"FlowerSpawningInVillage",
   Self::FishSpawningInVillage=>"FishSpawningInVillage"
  }
 }
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1Identity {
 pub event_id:u64,
 pub saved_index:usize,
 pub variant:W1Kind,
}
#[derive(Clone,Debug)]
pub struct W1StructuralWitness {
 pub roots:P1gSourceIdentity,
 pub identity:W1Identity,
 pub row_pointer:String,
 pub next_occurrence_pointer:String,
 pub event_id_pointer:String,
 pub raw_old_timestamp_json:String,
 pub decoded_old_timestamp_utc:String,
 pub decoded_new_timestamp_utc:String,
 pub raw_saved_event_id_json:String,
 pub registry_digest_matched:bool,
 pub registry_event_semantics_verified:bool,
 pub native_semantics_verified:bool,
 pub required_reference_closure_complete:bool,
 pub encode_copy_authorized:bool,
}
fn valid_utc(s:&str)->bool {
 let b=s.as_bytes();
 if b.len()<20||b[4]!=b'-'||b[7]!=b'-'||b[10]!=b'T'||
    b[13]!=b':'||b[16]!=b':'||*b.last().unwrap_or(&0)!=b'Z'{return false;}
 let digits=|r:std::ops::Range<usize>|->Option<u32>{
  let bytes=b.get(r)?;
  if !bytes.iter().all(|x|x.is_ascii_digit()){return None;}
  std::str::from_utf8(bytes).ok()?.parse::<u32>().ok()
 };
 let year=digits(0..4).unwrap_or(0);
 let mon=digits(5..7).unwrap_or(0);
 let day=digits(8..10).unwrap_or(0);
 let h=digits(11..13).unwrap_or(99);
 let m=digits(14..16).unwrap_or(99);
 let sec=digits(17..19).unwrap_or(99);
 if year==0||mon==0||mon>12||h>23||m>59||sec>59{return false;}
 let days=match mon {
  4|6|9|11=>30,
  2=>if year%4==0&&(year%100!=0||year%400==0){29}else{28},
  _=>31
 };
 if day==0||day>days{return false;}
 if b.len()==20{return true;}
 if b.len()<22||b[19]!=b'.'||b.len()>30{return false;}
 b[20..b.len()-1].iter().all(|x|x.is_ascii_digit())
}
fn object_member_count(raw:&str)->Result<usize,&'static str>{
 let b=raw.as_bytes();
 if b.first()!=Some(&b'{')||b.last()!=Some(&b'}'){return Err("W1_SAVED_ROW_NOT_OBJECT");}
 let mut depth=0usize;let mut in_string=false;let mut escaped=false;let mut count=0usize;
 for byte in b {
  if in_string {
   if escaped {escaped=false;}else if *byte==b'\\'{escaped=true;}
   else if *byte==b'"'{in_string=false;}
   continue;
  }
  match byte {
   b'"'=>in_string=true,
   b'{'|b'['=>depth+=1,
   b'}'|b']'=>depth=depth.checked_sub(1).ok_or("W1_BAD_ROW_DEPTH")?,
   b':' if depth==1=>count+=1,
   _=>{}
  }
 }
 Ok(count)
}
pub fn inspect_w1_source_research(
 original_encrypted:&[u8],key:&[u8;32],registry_bytes:&[u8],
 expected_encrypted_sha:[u8;32],expected_registry_sha:[u8;32],
 externally_selected_build_id:&str,
 identity:W1Identity,expected_old_utc:&str,new_utc:&str
)->EngineResult<W1StructuralWitness>{
 // This early contract is deliberately specific; schema alone never gives BID.
 if externally_selected_build_id!="9A239D3DB569756D"{
  return Err("W1_EXPLICIT_BUILD_MISMATCH");
 }
 if expected_registry_sha==[0;32]||sha256(registry_bytes)!=expected_registry_sha{
  return Err("W1_REGISTRY_SHA_MISMATCH");
 }
 if sha256(original_encrypted)!=expected_encrypted_sha{
  return Err("W1_ENCRYPTED_SOURCE_SHA_MISMATCH");
 }
 if !valid_utc(expected_old_utc)||!valid_utc(new_utc)||expected_old_utc==new_utc{
  return Err("W1_UTC_CAS_INVALID");
 }
 let DecodedP1g{json,encrypted_source_sha256,decoded_json_sha256,..}=
  decode_p1g_research(original_encrypted,key,crate::MAX_DECODED_JSON_BYTES)?;
 let row=format!("/World/RecurringEvents/{}",identity.saved_index);
 let variant=format!("{row}/{}",identity.variant.as_str());
 let id_path=format!("{variant}/RecurringEventItemID");
 let date_path=format!("{variant}/NextOccurrence");
 let paths=vec!["/GameInfo/Version".to_owned(),row.clone(),variant,id_path.clone(),date_path.clone()];
 let values=index_selected_tokens(&json,&paths)?;
 let get=|path:&str|->Result<&crate::SpanHit,&'static str>{
  values.iter().find(|h|h.pointer==path).ok_or("W1_POINTER_MISSING")
 };
 if get("/GameInfo/Version")?.value!="626"{return Err("W1_SCHEMA_MISMATCH");}
 if object_member_count(&get(&row)?.value)?!=1 {
  return Err("W1_NOT_SINGLE_SAVED_ONEOF");
 }
 let id_token=get(&id_path)?.value.clone();
 let canonical=identity.event_id.to_string();
 if id_token!=canonical && id_token!=format!("\"{canonical}\""){
  return Err("W1_SAVED_EVENT_ID_CAS_FAILED");
 }
 let raw_old=get(&date_path)?.value.clone();
 let decoded=strict_decode_json_string_token(&raw_old)?;
 if decoded!=expected_old_utc{return Err("W1_DECODED_TIMESTAMP_CAS_FAILED");}
 // No time meaning or source registry EventID->variant relationship is inferred
 // from matching a registry digest. 02 TIME supplies that trusted contract.
 Ok(W1StructuralWitness {
  roots:P1gSourceIdentity {
   encrypted_p1g_sha256:encrypted_source_sha256,decoded_json_sha256,registry_sha256:sha256(registry_bytes),
   platform:"Nintendo Switch".to_owned(),build_identity_kind:"SwitchBid".to_owned(),
   build_id:externally_selected_build_id.to_owned(),schema:626,
   external_build_selection_only:true,build_cryptographically_bound_to_save:false
  },
  identity,row_pointer:row,next_occurrence_pointer:date_path,event_id_pointer:id_path,
  raw_old_timestamp_json:raw_old,decoded_old_timestamp_utc:decoded,
  decoded_new_timestamp_utc:new_utc.to_owned(),raw_saved_event_id_json:id_token,
  registry_digest_matched:true,
  registry_event_semantics_verified:false,native_semantics_verified:false,
  required_reference_closure_complete:false,encode_copy_authorized:false
 })
}
