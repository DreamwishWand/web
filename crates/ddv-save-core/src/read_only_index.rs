//! W-CORE-004: Core-owned, source-indexed W1 read-only research slice.
//! Full strict JSON validation occurs before index creation and on every page.
//! A bounded W1 subtree is parsed only AFTER the full-source strict scanner.
//! NO product Worker ABI, Native reference closure, editing or export authority.
use crate::{sha256,index_selected_tokens,strict_decode_json_string_token,EngineResult,MAX_DECODED_JSON_BYTES};
use crate::p1g::decode_p1g_research;
use crate::w1_evidence::W1Kind;
use sha2::{Digest,Sha256};
use std::{collections::{BTreeMap,BTreeSet},sync::Arc};

pub const READ_INDEX_CONTRACT:&str="dreamwish.ddv.w1-indexed-read.research@1";
const MAX_INDEX_SUBTREE:usize=2*1024*1024;
const MAX_INDEX_ROWS:usize=4096;
const MAX_PAGE_ROWS:usize=64;
const MAX_TIMESTAMP_TOKEN:usize=128;
const BID:&str="9A239D3DB569756D";

#[derive(Clone,Debug,PartialEq,Eq)]
struct RowMeta {
 saved_index:usize,
 event_id:u64,
 variant:W1Kind,
 expected_utc:String,
}

#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1ReadRow {
 pub saved_index:usize,
 pub event_id:u64,
 pub variant:W1Kind,
 pub next_occurrence_pointer:String,
 pub raw_timestamp_json:String,
 pub decoded_timestamp_utc:String,
}

#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1Page {
 pub session_id:u64,
 pub revision:u64,
 pub index_generation:u64,
 pub decoded_json_sha256:[u8;32],
 pub encrypted_p1g_sha256:Option<[u8;32]>,
 pub external_build_id:String,
 pub total_w1_rows:usize,
 pub rows:Vec<W1ReadRow>,
 pub complete:bool,
 pub next_cursor:Option<String>,
 /// Only this recognized W1 shape was enumerated, never the 11-domain graph.
 pub w1_source_index_complete:bool,
 pub full_domain_reference_closure_complete:bool,
 pub product_read_worker_accepted:bool,
 pub product_writer_authorized:bool,
}
pub struct ReadRequest<'a> {
 pub expected_session_id:u64,
 pub expected_revision:u64,
 pub expected_index_generation:u64,
 pub expected_decoded_sha256:[u8;32],
 pub cursor:Option<&'a str>,
 pub limit:usize,
}
/// Trusted core must provide a fresh private 32-byte cursor key. Nothing from
/// the UI may select the key, source, session identity, index count or scope.
/// This type is NOT a product-bound constructor or a stable WASM/Worker ABI.
pub struct W1ReadIndex {
 session_id:u64,
 w1_snapshot:Arc<[u8]>,
 validated_source_bytes:usize,
 decoded_sha:[u8;32],
 encrypted_sha:Option<[u8;32]>,
 revision:u64,
 index_generation:u64,
 cursor_key:[u8;32],
 rows:Vec<RowMeta>,
 started:bool,
 next_index:usize,
 pending_cursor:Option<String>,
 finished:bool,
 closed:bool,
}
fn known_kind(value:&str)->EngineResult<W1Kind>{
 match value {
  "ItemSpawning"=>Ok(W1Kind::ItemSpawning),
  "WildCropsSpawningInVillage"=>Ok(W1Kind::WildCropsSpawningInVillage),
  "FlowerSpawningInVillage"=>Ok(W1Kind::FlowerSpawningInVillage),
  "FishSpawningInVillage"=>Ok(W1Kind::FishSpawningInVillage),
  _=>Err("READ_W1_KIND_NOT_PROVEN")
 }
}
fn event_id(v:&serde_json::Value)->EngineResult<u64>{
 let id=if let Some(n)=v.as_u64(){n}else{
  v.as_str().ok_or("READ_W1_ID_INVALID")?.parse::<u64>()
   .map_err(|_|"READ_W1_ID_INVALID")?
 };
 if id==0||id>9_007_199_254_740_991{return Err("READ_W1_ID_INVALID");}
 Ok(id)
}
fn parse_rows(source:&[u8])->EngineResult<(Vec<RowMeta>,Vec<u8>)>{
 let paths=vec!["/GameInfo/Version".to_string(),"/World/RecurringEvents".to_string()];
 // index_selected_tokens scans ALL source, rejecting unrelated malformed JSON,
 // duplicate keys, unsafe numbers and invalid UTF8 before any row is exposed.
 let hits=index_selected_tokens(source,&paths)?;
 let schema=hits.iter().find(|h|h.pointer==paths[0])
  .ok_or("READ_SCHEMA_MISSING")?;
 if schema.value!="626"{return Err("READ_SCHEMA_UNSUPPORTED");}
 let subtree=hits.iter().find(|h|h.pointer==paths[1])
  .ok_or("READ_W1_SOURCE_MISSING")?;
 if subtree.value.len()>MAX_INDEX_SUBTREE{return Err("READ_W1_SUBTREE_TOO_LARGE");}
 let doc:serde_json::Value=serde_json::from_str(&subtree.value)
  .map_err(|_|"READ_W1_SUBTREE_INVALID")?;
 let mut entries:Vec<(usize,&serde_json::Value)>=Vec::new();
 if let Some(arr)=doc.as_array(){
  if arr.len()>MAX_INDEX_ROWS{return Err("READ_W1_INDEX_TOO_LARGE");}
  for (i,v) in arr.iter().enumerate(){entries.push((i,v));}
 }else if let Some(map)=doc.as_object(){
  if map.len()>MAX_INDEX_ROWS{return Err("READ_W1_INDEX_TOO_LARGE");}
  let mut seen=BTreeSet::new();
  for (key,value) in map {
   let idx=key.parse::<usize>().map_err(|_|"READ_W1_ROW_KEY_INVALID")?;
   if idx.to_string()!=*key||!seen.insert(idx){return Err("READ_W1_ROW_KEY_INVALID");}
   entries.push((idx,value));
  }
  entries.sort_by_key(|x|x.0);
 }else{return Err("READ_W1_NOT_INDEXABLE");}
 let mut result=Vec::with_capacity(entries.len());
 for (idx,row) in entries {
  let row=row.as_object().ok_or("READ_W1_ROW_NOT_OBJECT")?;
  if row.len()!=1{return Err("READ_W1_ONEOF_NOT_SINGLE");}
  let (name,inner)=row.iter().next().ok_or("READ_W1_ONEOF_MISSING")?;
  let variant=known_kind(name)?;
  let fields=inner.as_object().ok_or("READ_W1_EVENT_NOT_OBJECT")?;
  let id=event_id(fields.get("RecurringEventItemID").ok_or("READ_W1_ID_MISSING")?)?;
  let utc=fields.get("NextOccurrence").and_then(|v|v.as_str())
   .ok_or("READ_W1_TIMESTAMP_MISSING")?;
  if utc.len()>MAX_TIMESTAMP_TOKEN{return Err("READ_W1_TIMESTAMP_TOO_LARGE");}
  result.push(RowMeta {
   saved_index:idx,event_id:id,variant,expected_utc:utc.to_owned()
  });
 }
 Ok((result,subtree.value.as_bytes().to_vec()))
}
impl W1ReadIndex {
 fn open_decoded_inner(session_id:u64,source:Vec<u8>,
                      expected_sha:[u8;32],cursor_key:[u8;32],
                      encrypted_sha:Option<[u8;32]>,build_id:&str)
                      ->EngineResult<Self>{
  if session_id==0{return Err("READ_SESSION_ID_REQUIRED");}
  if cursor_key==[0;32]{return Err("READ_CURSOR_SECRET_REQUIRED");}
  if build_id!=BID{return Err("READ_EXTERNAL_BID_UNSUPPORTED");}
  if source.is_empty()||source.len()>MAX_DECODED_JSON_BYTES{
   return Err("READ_SOURCE_SIZE_UNSUPPORTED");
  }
  if sha256(&source)!=expected_sha{return Err("READ_DECODED_SOURCE_SHA_CAS_FAILED");}
  let validated_source_bytes=source.len();
  let (rows,w1_source)=parse_rows(&source)?;
  // Retain only a bounded source-derived subtree; the 100–200 MiB
  // decoded input is dropped once FULL strict validation/indexing succeeds.
  Ok(Self {
   session_id,w1_snapshot:Arc::from(w1_source),validated_source_bytes,decoded_sha:expected_sha,
   encrypted_sha,revision:0,index_generation:0,cursor_key,rows,
   started:false,next_index:0,pending_cursor:None,finished:false,closed:false
  })
 }
 /// Synthetic decoded-only entry; no encrypted source identity or product-read grant.
 pub fn open_decoded_research(session_id:u64,decoded:Vec<u8>,
                             expected_decoded_sha:[u8;32],
                             external_bid:&str,private_cursor_key:[u8;32])
                             ->EngineResult<Self>{
  Self::open_decoded_inner(session_id,decoded,expected_decoded_sha,
   private_cursor_key,None,external_bid)
 }
 /// Strict single-profile P1G research entry; source/decoded SHA are
 /// independently checked. The build identifier is externally supplied.
 pub fn open_p1g_research(session_id:u64,p1g:&[u8],key:&[u8;32],
                          expected_p1g_sha:[u8;32],expected_json_sha:[u8;32],
                          external_bid:&str,private_cursor_key:[u8;32])
                          ->EngineResult<Self>{
  if sha256(p1g)!=expected_p1g_sha{return Err("READ_ENCRYPTED_SOURCE_SHA_CAS_FAILED");}
  let decoded=decode_p1g_research(p1g,key,MAX_DECODED_JSON_BYTES)?;
  if decoded.encrypted_source_sha256!=expected_p1g_sha||
     decoded.decoded_json_sha256!=expected_json_sha{
   return Err("READ_P1G_DECODED_SHA_CAS_FAILED");
  }
  Self::open_decoded_inner(session_id,decoded.json,expected_json_sha,
   private_cursor_key,Some(expected_p1g_sha),external_bid)
 }
 /// Internal-only epoch binding; no public UI or caller can choose it.
 /// READ research has no mutations, so revision remains zero.
 pub(crate) fn bind_trusted_epoch(&mut self,epoch:u64)->EngineResult<()>{
  if self.closed||self.started||epoch==0{return Err("READ_INVALID_EPOCH_BIND");}
  self.index_generation=epoch;
  Ok(())
 }
 pub fn row_count(&self)->usize{self.rows.len()}
 /// Core-retained bytes exclude the decoded full document after OPEN.
 pub fn retained_w1_bytes(&self)->usize{self.w1_snapshot.len()}
 pub fn validated_source_bytes(&self)->usize{self.validated_source_bytes}
 pub fn decoded_source_sha256(&self)->[u8;32]{self.decoded_sha}
 pub fn close(&mut self){
  self.closed=true;
  self.cursor_key=[0;32];
  self.pending_cursor=None;
  self.rows.clear();
  self.w1_snapshot=Arc::from(Vec::<u8>::new());
 }
 /// HMAC-SHA256 over a fixed read scope; the key never appears in a page.
 /// Cursor uniqueness also depends on a new privately generated per-session key.
 fn issue_cursor(&self,position:usize)->String{
  let mut payload=Vec::with_capacity(160);
  payload.extend_from_slice(READ_INDEX_CONTRACT.as_bytes());
  payload.extend_from_slice(&self.session_id.to_le_bytes());
  payload.extend_from_slice(&self.revision.to_le_bytes());
  payload.extend_from_slice(&self.index_generation.to_le_bytes());
  payload.extend_from_slice(&self.decoded_sha);
  if let Some(hash)=self.encrypted_sha{payload.extend_from_slice(&hash);}
  payload.extend_from_slice(BID.as_bytes());
  payload.extend_from_slice(&(position as u64).to_le_bytes());
  let mut inner_pad=[0x36_u8;64];
  let mut outer_pad=[0x5c_u8;64];
  for i in 0..32 {
   inner_pad[i]^=self.cursor_key[i];outer_pad[i]^=self.cursor_key[i];
  }
  let mut inner=Sha256::new();inner.update(inner_pad);inner.update(&payload);
  let digest=inner.finalize();
  let mut outer=Sha256::new();outer.update(outer_pad);outer.update(digest);
  let mac=outer.finalize();
  let mut token=format!("w1r1.{:016x}.",position);
  for b in mac {token.push_str(&format!("{:02x}",b));}
  token
 }
 pub fn query_page(&mut self,req:ReadRequest<'_>)->EngineResult<W1Page>{
  if self.closed{return Err("READ_SESSION_CLOSED");}
  if self.finished{return Err("READ_CURSOR_EXHAUSTED");}
  if req.expected_session_id!=self.session_id{return Err("READ_SESSION_MISMATCH");}
  if req.expected_revision!=self.revision{return Err("READ_REVISION_STALE");}
  if req.expected_index_generation!=self.index_generation{
   return Err("READ_INDEX_GENERATION_STALE");
  }
  if req.expected_decoded_sha256!=self.decoded_sha{return Err("READ_SOURCE_SHA_STALE");}
  if req.limit==0||req.limit>MAX_PAGE_ROWS{return Err("READ_PAGE_LIMIT");}
  if !self.started {
   if req.cursor.is_some(){return Err("READ_FIRST_CURSOR_NOT_ALLOWED");}
  }else if self.pending_cursor.as_deref()!=req.cursor {
   return Err("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH");
  }
  let end=self.next_index.saturating_add(req.limit).min(self.rows.len());
  let selected=&self.rows[self.next_index..end];
  let mut paths=Vec::with_capacity(selected.len()*2);
  for row in selected {
   let root=format!("/{}/{}",row.saved_index,row.variant.as_str());
   paths.push(format!("{root}/RecurringEventItemID"));
   paths.push(format!("{root}/NextOccurrence"));
  }
  // Parse at most the bounded <=2 MiB W1 subtree, not the full document
  // on every lazy page. This subtree was validated during OPEN.
  let hits=index_selected_tokens(&self.w1_snapshot,&paths)?;
  if hits.len()!=paths.len(){return Err("READ_INDEX_SOURCE_DRIFT");}
  let map:BTreeMap<String,String>=hits.into_iter()
   .map(|hit|(hit.pointer,hit.value)).collect();
  let mut rows=Vec::with_capacity(selected.len());
  for row in selected {
   let root=format!("/{}/{}",row.saved_index,row.variant.as_str());
   let id_path=format!("{root}/RecurringEventItemID");
   let ts_path=format!("{root}/NextOccurrence");
   let id=map.get(&id_path).ok_or("READ_ID_SOURCE_MISSING")?;
   let parsed:serde_json::Value=serde_json::from_str(id)
    .map_err(|_|"READ_ID_SOURCE_INVALID")?;
   if event_id(&parsed)?!=row.event_id{return Err("READ_ID_SOURCE_DRIFT");}
   let raw=map.get(&ts_path).ok_or("READ_TIMESTAMP_SOURCE_MISSING")?;
   let decoded=strict_decode_json_string_token(raw)?;
   if decoded!=row.expected_utc{return Err("READ_TIMESTAMP_SOURCE_DRIFT");}
   rows.push(W1ReadRow {
    saved_index:row.saved_index,event_id:row.event_id,
    variant:row.variant,next_occurrence_pointer:format!("/World/RecurringEvents{ts_path}"),
    raw_timestamp_json:raw.clone(),decoded_timestamp_utc:decoded
   });
  }
  // Successful page scan is the ONLY point where cursor state advances.
  let complete=end==self.rows.len();
  let next=if complete{None}else{Some(self.issue_cursor(end))};
  self.started=true;self.next_index=end;
  self.pending_cursor=next.clone();self.finished=complete;
  Ok(W1Page {
   session_id:self.session_id,revision:self.revision,
   index_generation:self.index_generation,decoded_json_sha256:self.decoded_sha,
   encrypted_p1g_sha256:self.encrypted_sha,external_build_id:BID.to_owned(),
   total_w1_rows:self.rows.len(),rows,complete,next_cursor:next,
   w1_source_index_complete:true,full_domain_reference_closure_complete:false,
   product_read_worker_accepted:false,product_writer_authorized:false
  })
 }
}
