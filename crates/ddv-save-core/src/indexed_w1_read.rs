//! Strict one-snapshot lazy W1 event source index, native research-only.
//! No product WASM Worker, no P1G cloud, no Writer.
use crate::{sha256,index_direct_children_with_sparse_witness,DirectIndexKind,EngineResult};
use std::{collections::BTreeMap,ops::Range,sync::Arc};
const BID:&str="9A239D3DB569756D";
const ROOT:&str="/World/RecurringEvents";
const MAX_EVENT:usize=2*1024*1024;
const MAX_EVENTS:usize=100_000;
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1LazyLease{
 pub session_id:u64,pub decoded_source_sha256:[u8;32],
 pub source_revision:u64,pub index_generation:u64,
 pub native_v3_verified:bool,pub product_writer_authorized:bool,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1LazyEvent{
 pub saved_map_key:u64,pub event_id:u64,pub oneof:&'static str,
 pub next_occurrence_utc:String,pub end_date_is_null:bool,
 pub lexical_event_sha256:[u8;32],pub source_sha256:[u8;32],
 pub revision:u64,pub index_generation:u64,
 pub native_v3_verified:bool,pub product_writer_authorized:bool,
}
pub struct W1LazySource{
 bytes:Arc<[u8]>,lease:W1LazyLease,
 event_spans:BTreeMap<u64,Range<usize>>,
}
impl W1LazySource{
 /// Caller supplies independent externally verified build identity and
 /// decoded SHA from trusted P1G reader, NOT self-derived BID.
 pub fn open_decoded_research(bytes:Vec<u8>,expected_sha:[u8;32],
   platform:&str,version:&str,bid:&str,schema:u64)->EngineResult<Self>{
   if platform!="switch"||version!="1.25.3"||bid!=BID||schema!=626{
     return Err("W1_LAZY_BUILD_IDENTITY_UNSUPPORTED");
   }
   if sha256(&bytes)!=expected_sha{return Err("W1_LAZY_SOURCE_SHA_MISMATCH");}
   let (direct,hashes)=index_direct_children_with_sparse_witness(
     &bytes,ROOT,&["/GameInfo/Version".to_owned()],32)?;
   if direct.kind!=DirectIndexKind::Object{
     return Err("W1_LAZY_RECURRING_EVENTS_OBJECT_REQUIRED");
   }
   if hashes.len()!=1||hashes[0].lexical_kind!="number"||
      hashes[0].raw_sha256!=sha256(b"626"){
     return Err("W1_LAZY_GAME_SCHEMA_MISMATCH");
   }
   if direct.items.len()>MAX_EVENTS{return Err("W1_LAZY_EVENT_COUNT_BUDGET");}
   let mut spans=BTreeMap::new();
   for child in direct.items{
     let n=child.key.parse::<u64>().map_err(|_|"W1_LAZY_SAVED_KEY_INVALID")?;
     if child.key!=n.to_string(){return Err("W1_LAZY_SAVED_KEY_NONCANONICAL");}
     if spans.insert(n,child.span).is_some(){
       return Err("W1_LAZY_SAVED_KEY_ALIAS");
     }
   }
   let mut random=[0u8;8];
   getrandom::getrandom(&mut random).map_err(|_|"W1_LAZY_SESSION_RANDOM_FAILED")?;
   let session_id=u64::from_le_bytes(random);
   if session_id==0{return Err("W1_LAZY_SESSION_RANDOM_FAILED");}
   Ok(Self{bytes:Arc::from(bytes),
     lease:W1LazyLease{session_id,decoded_source_sha256:expected_sha,
       source_revision:0,index_generation:1,
       native_v3_verified:false,product_writer_authorized:false},
     event_spans:spans
   })
 }
 pub fn lease(&self)->W1LazyLease{self.lease.clone()}
 pub fn indexed_event_count(&self)->usize{self.event_spans.len()}
 pub fn stored_source_bytes(&self)->usize{self.bytes.len()}
 /// Only a bounded W1 known event is parsed lazily; others remain opaque.
 pub fn read_supported_w1(&self,scope:&W1LazyLease,saved_key:u64,
   event_id:u64)->EngineResult<W1LazyEvent>{
   if scope!=&self.lease{return Err("W1_LAZY_STALE_OR_FORGED_SCOPE");}
   if saved_key!=155||event_id!=2010000021{
     return Err("W1_LAZY_NATIVE_OPERATION_NOT_MODELLED");
   }
   let span=self.event_spans.get(&saved_key).ok_or("W1_LAZY_EVENT_NOT_FOUND")?;
   if span.end<span.start||span.end>self.bytes.len()||
      span.end-span.start>MAX_EVENT{
     return Err("W1_LAZY_EVENT_UNBOUNDED");
   }
   let raw=&self.bytes[span.clone()];
   let row:serde_json::Value=serde_json::from_slice(raw)
     .map_err(|_|"W1_LAZY_EVENT_JSON_INVALID")?;
   let map=row.as_object().ok_or("W1_LAZY_EVENT_ROW_NOT_OBJECT")?;
   if map.len()!=1||!map.contains_key("ItemSpawning"){
     return Err("W1_LAZY_EVENT_ONEOF_INVALID");
   }
   let item=map.get("ItemSpawning").and_then(serde_json::Value::as_object)
     .ok_or("W1_LAZY_EVENT_PAYLOAD_INVALID")?;
   if item.get("RecurringEventItemID").and_then(serde_json::Value::as_u64)
      !=Some(event_id){
     return Err("W1_LAZY_EVENT_ID_CAS_FAILED");
   }
   let utc=item.get("NextOccurrence").and_then(serde_json::Value::as_str)
     .ok_or("W1_LAZY_NEXT_UTC_INVALID")?;
   if utc.len()<20||utc.len()>64||!utc.is_ascii(){
     return Err("W1_LAZY_NEXT_UTC_INVALID");
   }
   if item.get("LastOccurrence").and_then(serde_json::Value::as_str)
      .is_none(){return Err("W1_LAZY_LAST_UTC_INVALID");}
   let end=item.get("EndDate").ok_or("W1_LAZY_ENDDATE_MISSING")?;
   if !end.is_null()&&!end.is_string(){
     return Err("W1_LAZY_ENDDATE_INVALID");
   }
   Ok(W1LazyEvent{
     saved_map_key:saved_key,event_id,oneof:"ItemSpawning",
     next_occurrence_utc:utc.to_owned(),end_date_is_null:end.is_null(),
     lexical_event_sha256:sha256(raw),source_sha256:self.lease.decoded_source_sha256,
     revision:self.lease.source_revision,index_generation:self.lease.index_generation,
     native_v3_verified:false,product_writer_authorized:false
   })
 }
 pub fn original_unchanged(&self,expected_sha:[u8;32])->EngineResult<()>{
   if expected_sha!=self.lease.decoded_source_sha256||
      sha256(&self.bytes)!=expected_sha{return Err("W1_LAZY_SOURCE_MUTATED");}
   Ok(())
 }
 pub fn export_edited_copy(&self)->EngineResult<Vec<u8>>{
   Err("PRODUCT_W1_LAZY_EDITED_COPY_NOT_AUTHORIZED")
 }
}
