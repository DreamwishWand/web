//! Wand-owned trusted READ research boundary (W-CORE-004). NO product Writer.
//! Reuses 01A strict full-document parser, P1G codec and source-bound W1
//! witnesses. A row index is complete only for /World/RecurringEvents;
//! no claim of 11-domain Native reference or gameplay semantic completeness.
//! The module is not yet compiled into a browser Worker/WASM product ABI.
use crate::{sha256,index_direct_children,index_selected_tokens,strict_decode_json_string_token,
   DirectChildSpan,DirectIndexKind,EngineResult};
use crate::p1g::decode_p1g_research;
use crate::w1_evidence::W1Kind;
use std::collections::{HashMap,HashSet};
use std::sync::Arc;
use std::time::{Duration,Instant};
use serde_json::Value;

pub const TRUSTED_READ_CONTRACT:&str="dreamwish.ddv.core-trusted-read.research@1";
const CURSOR_TTL:Duration=Duration::from_secs(300);
const MAX_OUTSTANDING_CURSORS:usize=128;
const MAX_READ_ROWS:usize=200;
const MAX_RECORD_BYTES:usize=65_536;
const MAX_PAGE_BYTES:usize=2*1024*1024;
const TARGET:&str="/World/RecurringEvents";

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct ReadCapabilities {
 pub read:bool,pub encode_copy:bool,pub apply:bool,
 pub persistent_replace:bool,pub original_overwrite:bool,
}
pub const READ_ONLY:ReadCapabilities=ReadCapabilities{
 read:true,encode_copy:false,apply:false,persistent_replace:false,
 original_overwrite:false
};
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ReadRoots {
 pub encrypted_source_sha256:[u8;32],
 pub decoded_json_sha256:[u8;32],
 pub registry_sha256:[u8;32],
 pub external_platform:String,
 pub external_bid:String,
 pub schema:u64,
 /// A matching external selection is NOT cryptographically bound by P1G.
 pub external_bid_cryptographically_bound:bool,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct OpenReadReceipt {
 pub session_id:String,
 pub revision:u64,
 pub generation:u64,
 pub roots:ReadRoots,
 pub indexed_domain:&'static str,
 pub indexed_count:usize,
 pub complete_structural_scan:bool,
 pub complete_all_domains:bool,
 pub semantic_reference_closure_verified:bool,
 pub capabilities:ReadCapabilities,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1Row {
 pub saved_index:usize,
 pub oneof:String,
 pub event_id:Option<u64>,
 pub next_occurrence_utc:Option<String>,
 pub original_byte_span:(usize,usize),
 pub raw_row_sha256:[u8;32],
 pub semantic_eligibility_verified:bool,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ReadPage {
 pub session_id:String,pub revision:u64,pub generation:u64,
 pub domain:&'static str,
 pub rows:Vec<W1Row>,
 pub indexed_total:usize,
 pub next_cursor:Option<String>,
 /// Exhaustive ONLY over direct RecurringEvents children on this Revision.
 pub complete:bool,
 pub complete_all_domains:bool,
 pub source_reference_semantics_verified:bool,
}
pub struct PageQuery<'a>{
 pub session_id:&'a str,
 pub revision:u64,pub generation:u64,
 pub domain:&'a str,
 pub sort:&'a str,pub filter:&'a str,
 pub limit:usize,pub cursor:Option<&'a str>,
}
struct CursorGrant {
 offset:usize,query_sha:[u8;32],
 revision:u64,generation:u64,expires:Instant,
}
pub struct W1CommandIntent<'a>{
 pub session_id:&'a str,pub expected_revision:u64,pub expected_generation:u64,
 pub expected_encrypted_sha256:[u8;32],pub expected_decoded_sha256:[u8;32],
 pub expected_registry_sha256:[u8;32],pub expected_external_bid:&'a str,
 pub schema:u64,pub event_id:u64,pub saved_index:usize,pub oneof:W1Kind,
 pub pointer:&'a str,pub expected_old_raw_json:&'a str,
 pub expected_old_utc:&'a str,pub proposed_utc:&'a str,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1PreflightReceipt {
 pub exact_source_and_revision_cas:bool,
 pub event_identity_and_old_raw_cas:bool,
 pub required_registry_semantics_verified:bool,
 pub complete_operation_references_verified:bool,
 pub native_consumer_semantics_verified:bool,
 pub transaction_stage_authorized:bool,
 pub encode_copy_authorized:bool,
}
/// Owns immutable backing; no user-provided cursor or capability can grant
/// access without matching Core-internal state and one random token.
pub struct TrustedReadCore {
 session_id:String,roots:ReadRoots,
 original:Arc<[u8]>,decoded:Arc<[u8]>,
 revision:u64,generation:u64,
 rows:Vec<DirectChildSpan>,cursors:HashMap<String,CursorGrant>,
 closed:bool,
}
fn random_hex(bytes:usize)->EngineResult<String>{
 let mut input=vec![0u8;bytes];
 getrandom::getrandom(&mut input).map_err(|_|"CORE_CSPRNG_UNAVAILABLE")?;
 let mut out=String::with_capacity(bytes*2);
 for b in input{use std::fmt::Write;write!(&mut out,"{b:02x}").map_err(|_|"CORE_TOKEN_FORMAT")?;}
 Ok(out)
}
fn query_scope(session_id:&str,roots:&ReadRoots,revision:u64,generation:u64,
               domain:&str,sort:&str,filter:&str,limit:usize)->[u8;32]{
 // Domain-separated, length-prefixed transcript; no ambiguous separators.
 let mut bytes=b"wand-ddv-core-read-cursor-scope-v1".to_vec();
 for part in [session_id.as_bytes(),roots.encrypted_source_sha256.as_slice(),
   roots.decoded_json_sha256.as_slice(),roots.registry_sha256.as_slice(),
   &revision.to_le_bytes(),&generation.to_le_bytes(),
   domain.as_bytes(),sort.as_bytes(),filter.as_bytes(),&limit.to_le_bytes()] {
    bytes.extend_from_slice(&(part.len() as u64).to_le_bytes());
    bytes.extend_from_slice(part);
 }
 sha256(&bytes)
}
impl TrustedReadCore {
 /// Only the private Worker/Core owner may call this method with original
 /// encrypted source and its trusted expected external evidence.
 pub fn open_p1g_readonly(original:Vec<u8>,key:&[u8;32],
    expected_encrypted_sha:[u8;32],expected_decoded_sha:[u8;32],
    registry:&[u8],expected_registry_sha:[u8;32],
    external_bid:&str,schema:u64,max_decoded_bytes:usize)->EngineResult<Self>{
  if original.is_empty()||sha256(&original)!=expected_encrypted_sha{
    return Err("READ_SOURCE_SHA_CAS_FAILED");
  }
  if registry.is_empty()||expected_registry_sha==[0;32]||
     sha256(registry)!=expected_registry_sha{return Err("READ_REGISTRY_SHA_CAS_FAILED");}
  if external_bid!="9A239D3DB569756D"||schema!=626{
    return Err("READ_EXTERNAL_BUILD_OR_SCHEMA_UNSUPPORTED");
  }
  let decoded=decode_p1g_research(&original,key,max_decoded_bytes)?;
  if decoded.decoded_json_sha256!=expected_decoded_sha{
    return Err("READ_DECODED_SHA_CAS_FAILED");
  }
  // This scan traverses/validates the entire JSON and captures only direct
  // recurring-event row ranges. No whole-document Value/JSON clone retained.
  let schema_row=index_selected_tokens(&decoded.json,&["/GameInfo/Version".to_owned()])?;
  if schema_row.first().map(|x|x.value.as_str())!=Some("626"){
    return Err("READ_SCHEMA_MISMATCH");
  }
  let index=index_direct_children(&decoded.json,TARGET)?;
  if !index.complete_from_strict_full_scan{return Err("READ_INDEX_NOT_COMPLETE");}
  let mut used=HashSet::new();
  for item in &index.items {
    let i=item.key.parse::<usize>().map_err(|_|"READ_SAVED_INDEX_INVALID")?;
    if item.key!=i.to_string()||!used.insert(i) {
      return Err("READ_INDEX_ALIAS_OR_DUPLICATE");
    }
  }
  if index.kind==DirectIndexKind::Array {
    for (i,item) in index.items.iter().enumerate() {
      if item.key!=i.to_string(){return Err("READ_ARRAY_INDEX_GAP");}
    }
  }
  let roots=ReadRoots{
    encrypted_source_sha256:expected_encrypted_sha,
    decoded_json_sha256:expected_decoded_sha,
    registry_sha256:expected_registry_sha,
    external_platform:"Nintendo Switch".to_owned(),
    external_bid:external_bid.to_owned(),schema,
    external_bid_cryptographically_bound:false,
  };
  let mut rows=index.items;
  rows.sort_unstable_by_key(|r|r.key.parse::<usize>().unwrap_or(usize::MAX));
  Ok(Self{
    session_id:random_hex(16)?,roots,original:Arc::from(original),
    decoded:Arc::from(decoded.json),revision:0,generation:0,
    rows,cursors:HashMap::new(),closed:false
  })
 }
 pub fn receipt(&self)->EngineResult<OpenReadReceipt>{
  if self.closed{return Err("READ_SESSION_CLOSED");}
  Ok(OpenReadReceipt{
    session_id:self.session_id.clone(),revision:self.revision,generation:self.generation,
    roots:self.roots.clone(),indexed_domain:"RecurringEvents",
    indexed_count:self.rows.len(),complete_structural_scan:true,
    complete_all_domains:false,semantic_reference_closure_verified:false,
    capabilities:READ_ONLY
  })
 }
 pub fn original_unchanged(&self)->EngineResult<()>{
  if sha256(&self.original)!=self.roots.encrypted_source_sha256 {
    return Err("READ_ORIGINAL_CHANGED");
  }
  if sha256(&self.decoded)!=self.roots.decoded_json_sha256{
    return Err("READ_DECODED_CHANGED");
  }
  Ok(())
 }
 fn require_session(&self,session:&str,revision:u64,generation:u64)->EngineResult<()>{
  if self.closed{return Err("READ_SESSION_CLOSED");}
  if session!=self.session_id{return Err("READ_SESSION_MISMATCH");}
  if revision!=self.revision{return Err("READ_STALE_REVISION");}
  if generation!=self.generation{return Err("READ_STALE_GENERATION");}
  Ok(())
 }
 fn project(&self,item:&DirectChildSpan)->EngineResult<W1Row>{
  let raw=self.decoded.get(item.span.clone()).ok_or("READ_RECORD_BOUNDS")?;
  if raw.len()>MAX_RECORD_BYTES{return Err("READ_RECORD_TOO_LARGE");}
  let root:Value=serde_json::from_slice(raw).map_err(|_|"READ_ROW_PARSE_FAILED")?;
  let obj=root.as_object().ok_or("READ_ROW_NOT_OBJECT")?;
  if obj.len()!=1{return Err("READ_ONEOF_AMBIGUOUS");}
  let (oneof,fields)=obj.iter().next().ok_or("READ_ONEOF_MISSING")?;
  if oneof.len()>128{return Err("READ_ONEOF_TOO_LARGE");}
  let child=fields.as_object().ok_or("READ_ONEOF_NOT_OBJECT")?;
  let event_id=child.get("RecurringEventItemID").and_then(|v|
     v.as_u64().or_else(||v.as_str().and_then(|s|s.parse::<u64>().ok())));
  let next_occurrence_utc=child.get("NextOccurrence")
     .and_then(|v|v.as_str()).map(str::to_owned);
  if next_occurrence_utc.as_ref().is_some_and(|v|v.len()>128){
    return Err("READ_TIMESTAMP_TOO_LARGE");
  }
  Ok(W1Row{
    saved_index:item.key.parse::<usize>().map_err(|_|"READ_SAVED_INDEX_INVALID")?,
    oneof:oneof.clone(),event_id,next_occurrence_utc,
    original_byte_span:(item.span.start,item.span.end),
    raw_row_sha256:sha256(raw),semantic_eligibility_verified:false
  })
 }
 pub fn query_indexed_page(&mut self,q:PageQuery<'_>)->EngineResult<ReadPage>{
  self.require_session(q.session_id,q.revision,q.generation)?;
  if q.domain!="RecurringEvents"||q.sort!="savedIndex"||!q.filter.is_empty(){
    return Err("READ_QUERY_NOT_INDEXED");
  }
  if q.limit==0||q.limit>MAX_READ_ROWS{return Err("READ_PAGE_LIMIT");}
  // Never trust client assertions of count, Complete, offset or cursor content.
  let digest=query_scope(&self.session_id,&self.roots,self.revision,self.generation,
                         q.domain,q.sort,q.filter,q.limit);
  let start=if let Some(token)=q.cursor {
    // Consumption precedes checking scope/expiry: replay or tamper cannot retry.
    let grant=self.cursors.remove(token).ok_or("READ_CURSOR_UNKNOWN_OR_REPLAY")?;
    if grant.revision!=self.revision||grant.generation!=self.generation {
      return Err("READ_CURSOR_STALE");
    }
    if grant.expires<=Instant::now(){return Err("READ_CURSOR_EXPIRED");}
    if grant.query_sha!=digest{return Err("READ_CURSOR_SCOPE_MISMATCH");}
    grant.offset
  }else{0};
  let end=start.checked_add(q.limit).ok_or("READ_PAGE_OVERFLOW")?
    .min(self.rows.len());
  if start>=self.rows.len() && start!=0{return Err("READ_CURSOR_OUT_OF_RANGE");}
  let mut records=Vec::with_capacity(end-start);
  let mut response_bytes=0usize;
  for row in &self.rows[start..end]{
    let projected=self.project(row)?;
    response_bytes=response_bytes.checked_add(
      projected.oneof.len()+projected.next_occurrence_utc.as_ref().map_or(0,String::len)+256
    ).ok_or("READ_PAGE_TOO_LARGE")?;
    if response_bytes>MAX_PAGE_BYTES{return Err("READ_PAGE_TOO_LARGE");}
    records.push(projected);
  }
  let complete=end==self.rows.len();
  let next_cursor=if complete{None}else{
    if self.cursors.len()>=MAX_OUTSTANDING_CURSORS{
      return Err("READ_TOO_MANY_ACTIVE_CURSORS");
    }
    let token=random_hex(32)?;
    if self.cursors.contains_key(&token){return Err("READ_CURSOR_COLLISION");}
    self.cursors.insert(token.clone(),CursorGrant{offset:end,query_sha:digest,
       revision:self.revision,generation:self.generation,expires:Instant::now()+CURSOR_TTL});
    Some(token)
  };
  Ok(ReadPage{
    session_id:self.session_id.clone(),revision:self.revision,generation:self.generation,
    domain:"RecurringEvents",rows:records,indexed_total:self.rows.len(),
    next_cursor,complete,complete_all_domains:false,
    source_reference_semantics_verified:false
  })
 }
 pub fn preflight_w1(&self,q:W1CommandIntent<'_>)->EngineResult<W1PreflightReceipt>{
  self.require_session(q.session_id,q.expected_revision,q.expected_generation)?;
  if q.expected_encrypted_sha256!=self.roots.encrypted_source_sha256||
     q.expected_decoded_sha256!=self.roots.decoded_json_sha256{
    return Err("W1_SOURCE_CAS_FAILED");
  }
  if q.expected_registry_sha256!=self.roots.registry_sha256 {
    return Err("W1_REGISTRY_CAS_FAILED");
  }
  if q.expected_external_bid!=self.roots.external_bid||q.schema!=self.roots.schema{
    return Err("W1_BUILD_CAS_FAILED");
  }
  let path=format!("/World/RecurringEvents/{}/{}/NextOccurrence",
        q.saved_index,q.oneof.as_str());
  if q.pointer!=path{return Err("W1_INTENT_POINTER_MISMATCH");}
  let row=self.rows.iter().find(|r|r.key==q.saved_index.to_string())
     .ok_or("W1_SOURCE_ROW_MISSING")?;
  let raw=self.decoded.get(row.span.clone()).ok_or("W1_ROW_BOUNDS")?;
  if raw.len()>MAX_RECORD_BYTES{return Err("W1_ROW_TOO_LARGE");}
  let obj:Value=serde_json::from_slice(raw).map_err(|_|"W1_ROW_INVALID")?;
  let member=obj.as_object().ok_or("W1_ROW_INVALID")?;
  if member.len()!=1||!member.contains_key(q.oneof.as_str()){
    return Err("W1_ONEOF_CAS_FAILED");
  }
  let inner=member.get(q.oneof.as_str()).and_then(Value::as_object)
     .ok_or("W1_ONEOF_INVALID")?;
  let actual_id=inner.get("RecurringEventItemID")
     .and_then(|v|v.as_u64().or_else(||v.as_str().and_then(|s|s.parse().ok())))
     .ok_or("W1_EVENT_ID_UNRECOGNIZED")?;
  if actual_id!=q.event_id{return Err("W1_EVENT_ID_CAS_FAILED");}
  let paths=[format!("/{}/NextOccurrence",q.oneof.as_str())];
  let found=index_selected_tokens(raw,&paths)?;
  let token=found.first().ok_or("W1_OLD_TOKEN_NOT_FOUND")?;
  if token.value!=q.expected_old_raw_json{return Err("W1_RAW_OLD_VALUE_CAS_FAILED");}
  let decoded=strict_decode_json_string_token(&token.value)?;
  if decoded!=q.expected_old_utc{return Err("W1_OLD_UTC_CAS_FAILED");}
  if q.proposed_utc==decoded{return Err("W1_NO_OP_DENIED");}
  if !valid_utc_exact(q.proposed_utc){return Err("W1_NEW_UTC_INVALID");}
  self.original_unchanged()?;
  Ok(W1PreflightReceipt{
    exact_source_and_revision_cas:true,event_identity_and_old_raw_cas:true,
    required_registry_semantics_verified:false,
    complete_operation_references_verified:false,
    native_consumer_semantics_verified:false,
    transaction_stage_authorized:false,encode_copy_authorized:false
  })
 }
 pub fn stage_w1_transaction(&mut self,_receipt:&W1PreflightReceipt)->EngineResult<()>{
   Err("W1_OPERATION_REFERENCE_AND_NATIVE_CAPABILITY_NOT_ACCEPTED")
 }
 pub fn export_p1g_copy(&self)->EngineResult<Vec<u8>>{
   Err("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED")
 }
 pub fn close(&mut self){
   self.closed=true;self.cursors.clear();
 }
}
fn valid_utc_exact(s:&str)->bool{
 let b=s.as_bytes();if b.len()!=20||b[4]!=b'-'||b[7]!=b'-'||
   b[10]!=b'T'||b[13]!=b':'||b[16]!=b':'||b[19]!=b'Z'{return false;}
 let d=|start:usize|->Option<u32>{
   let slice=b.get(start..start+2)?;
   if !slice.iter().all(u8::is_ascii_digit){return None;}
   std::str::from_utf8(slice).ok()?.parse::<u32>().ok()
 };
 let year=std::str::from_utf8(&b[..4]).ok().and_then(|x|
   if x.bytes().all(|t|t.is_ascii_digit()){x.parse::<u32>().ok()}else{None}).unwrap_or(0);
 let m=d(5).unwrap_or(0);let day=d(8).unwrap_or(0);
 let h=d(11).unwrap_or(99);let min=d(14).unwrap_or(99);let sec=d(17).unwrap_or(99);
 if year==0||m==0||m>12||h>23||min>59||sec>59{return false;}
 let mdays=match m {4|6|9|11=>30,2=>if year%4==0&&(year%100!=0||year%400==0){29}else{28},_=>31};
 day>=1&&day<=mdays
}

#[cfg(test)]
mod core_owned_cursor_tests {
 use super::*;
 use crate::p1g::encode_synthetic_fixture;
 fn session()->TrustedReadCore{
  let json=b"{\"GameInfo\":{\"Version\":626},\"World\":{\"RecurringEvents\":[{\"ItemSpawning\":{\"RecurringEventItemID\":123,\"NextOccurrence\":\"2126-08-20T00:00:00Z\"}},{\"ItemSpawning\":{\"RecurringEventItemID\":124,\"NextOccurrence\":\"2126-08-20T00:00:00Z\"}}]}}";
  let p=encode_synthetic_fixture(json,&[6u8;32],8).unwrap();
  TrustedReadCore::open_p1g_readonly(p.clone(),&[6u8;32],sha256(&p),sha256(json),
      b"synthetic-registry",sha256(b"synthetic-registry"),
      "9A239D3DB569756D",626,1024*1024).unwrap()
 }
 fn q<'a>(s:&'a str,cursor:Option<&'a str>)->PageQuery<'a>{
   PageQuery{session_id:s,revision:0,generation:0,domain:"RecurringEvents",
      sort:"savedIndex",filter:"",limit:1,cursor}
 }
 #[test]
 fn expired_cursor_is_consumed_and_cannot_be_replayed(){
   let mut core=session();let s=core.session_id.clone();
   let token=core.query_indexed_page(q(&s,None)).unwrap().next_cursor.unwrap();
   core.cursors.get_mut(&token).unwrap().expires=Instant::now()-Duration::from_secs(1);
   assert_eq!(core.query_indexed_page(q(&s,Some(&token))).unwrap_err(),"READ_CURSOR_EXPIRED");
   assert_eq!(core.query_indexed_page(q(&s,Some(&token))).unwrap_err(),"READ_CURSOR_UNKNOWN_OR_REPLAY");
 }
 #[test]
 fn foreign_session_token_and_revision_generation_change_are_denied(){
   let mut left=session();let mut right=session();
   assert_ne!(left.session_id,right.session_id);
   let sid=left.session_id.clone();let rhs=right.session_id.clone();
   let token=left.query_indexed_page(q(&sid,None)).unwrap().next_cursor.unwrap();
   assert_eq!(right.query_indexed_page(q(&rhs,Some(&token))).unwrap_err(),
      "READ_CURSOR_UNKNOWN_OR_REPLAY");
   left.revision=1;left.generation=1;
   let mut v=q(&sid,Some(&token));v.revision=1;v.generation=1;
   assert_eq!(left.query_indexed_page(v).unwrap_err(),"READ_CURSOR_STALE");
 }
 #[test]
 fn cursor_supply_is_core_random_and_not_ui_selected(){
   let mut core=session();let sid=core.session_id.clone();
   assert_eq!(core.query_indexed_page(q(&sid,Some("00"))).unwrap_err(),
      "READ_CURSOR_UNKNOWN_OR_REPLAY");
   let one=core.query_indexed_page(q(&sid,None)).unwrap().next_cursor.unwrap();
   let two=core.query_indexed_page(q(&sid,None)).unwrap().next_cursor.unwrap();
   assert_ne!(one,two);
   assert_eq!(one.len(),64);
 }
}
