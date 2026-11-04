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
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SourceReadCondition {
 pub pointer:String,pub expected_raw_token_sha256:[u8;32],
}
pub struct W1CommandIntent<'a>{
 pub session_id:&'a str,pub expected_revision:u64,pub expected_generation:u64,
 pub expected_encrypted_sha256:[u8;32],pub expected_decoded_sha256:[u8;32],
 pub expected_registry_sha256:[u8;32],pub expected_external_bid:&'a str,
 pub schema:u64,pub event_id:u64,pub saved_index:usize,pub oneof:W1Kind,
 pub pointer:&'a str,pub expected_old_raw_json:&'a str,
 pub expected_old_utc:&'a str,pub proposed_utc:&'a str,
 /// Caller-specified witnesses are re-read by Core. Existence does NOT
 /// establish Native semantics or exhaustive reference dependency closure.
 pub source_read_set:Vec<SourceReadCondition>,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1PreflightReceipt {
 pub exact_source_and_revision_cas:bool,
 pub event_identity_and_old_raw_cas:bool,
 pub source_read_set_cas_matched:bool,
 pub required_registry_semantics_verified:bool,
 pub complete_operation_references_verified:bool,
 pub native_consumer_semantics_verified:bool,
 pub transaction_stage_authorized:bool,
 pub encode_copy_authorized:bool,
}
/// Proof-producing, read-only PREVIEW. Not a staged transaction,
/// verified backup artifact or authorized edited-copy.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1ExactDiffPreview {
 pub source_cipher_sha256:[u8;32],
 pub source_decoded_sha256:[u8;32],
 pub registry_sha256:[u8;32],
 pub source_revision:u64,
 pub index_generation:u64,
 pub proposed_revision:u64,
 pub pointer:String,
 pub event_id:u64,
 pub saved_index:usize,
 pub old_utc:String,
 pub new_utc:String,
 pub old_decoded_bytes:usize,
 pub proposed_decoded_bytes:usize,
 pub proposed_decoded_sha256:[u8;32],
 pub exact_changed_pointers:Vec<String>,
 pub source_and_reference_cas_matched:bool,
 pub full_operation_reference_closure_verified:bool,
 pub original_first_backup_written:bool,
 pub atomic_changeset_committed:bool,
 pub encode_copy_authorized:bool,
 pub persistent_replace_authorized:bool,
}
/// Core-derived *source* reference diagnostic for the single known W1
/// ItemSpawning operation. This is NOT Native V3 or Writer acceptance.
/// The caller's source_read_set is never used to define mandatory native refs.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct W1CoreNativeReadSet {
 pub event_id:u64,pub saved_index:usize,
 pub source_cipher_sha256:[u8;32],pub registry_sha256:[u8;32],
 pub observed_core_refs:Vec<SourceReadCondition>,
 pub missing_or_unbounded_refs:Vec<String>,
 pub required_source_paths_count:usize,
 pub core_derived_not_caller_selected:bool,
 pub all_known_source_refs_observed:bool,
 pub same_build_native_registry_manifest_accepted:bool,
 pub effective_area_grid_diffgrid_quota_verified:bool,
 pub clock_actualize_last_to_next_verified:bool,
 pub complete_native_dependency_closure_verified:bool,
 pub product_writer_authorized:bool,
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
#[cfg(not(target_arch="wasm32"))]
fn random_hex(bytes:usize)->EngineResult<String>{
 let mut input=vec![0u8;bytes];
 getrandom::getrandom(&mut input).map_err(|_|"CORE_CSPRNG_UNAVAILABLE")?;
 let mut out=String::with_capacity(bytes*2);
 for b in input{use std::fmt::Write;write!(&mut out,"{b:02x}").map_err(|_|"CORE_TOKEN_FORMAT")?;}
 Ok(out)
}
#[cfg(target_arch="wasm32")]
fn random_hex(_bytes:usize)->EngineResult<String>{
 // The existing v0.1 raw WASM ABI has no WebCrypto import/bindings.
 // Native getrandom(js) would introduce __wbindgen_externref imports and
 // break the accepted raw Chromium module. Product Worker must provide an
 // independently accepted authenticated WebCrypto bridge BEFORE issuing
 // sessions or cursors. Until then reject rather than mint weak tokens.
 Err("CORE_WASM_CSPRNG_BRIDGE_NOT_ACCEPTED")
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
 /// Lend the encrypted original immutable source to the same private
 /// research operation that opened it. Never clone a full P1G ciphertext
 /// buffer or return it to JS/UI; this is NOT original backup persistence.
 pub(crate) fn borrow_original_snapshot_research(&self)->EngineResult<Arc<[u8]>>{
   if self.closed{return Err("READ_SESSION_CLOSED");}
   self.original_unchanged()?;
   Ok(Arc::clone(&self.original))
 }
 /// Only a local pointer-identity witness, never a user-visible raw source.
 pub(crate) fn shares_original_ciphertext_research(&self,
   borrowed:&Arc<[u8]>)->bool{
   !self.closed && Arc::ptr_eq(&self.original,borrowed) &&
   sha256(&self.original)==self.roots.encrypted_source_sha256
 }
 /// Native PRIVATE operation research: lend the already strict-decoded
 /// immutable Core source by Arc, never return its bytes to UI/Worker messages.
 /// This is a source snapshot, NOT a product Writer capability or independent
 /// semantic/native acceptance. Refuse closed or mutated source snapshots.
 pub(crate) fn borrow_decoded_snapshot_research(&self)->EngineResult<Arc<[u8]>>{
   if self.closed{return Err("READ_SESSION_CLOSED");}
   self.original_unchanged()?;
   Ok(Arc::clone(&self.decoded))
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
  if q.source_read_set.len()>128{return Err("W1_READ_SET_TOO_LARGE");}
  let mut unique=HashSet::new();
  let mut pointers=Vec::with_capacity(q.source_read_set.len());
  for condition in &q.source_read_set {
    if !condition.pointer.starts_with('/')||condition.pointer.len()>1024||
       condition.pointer.contains("//")||!unique.insert(condition.pointer.clone()){
       return Err("W1_READ_SET_POINTER_INVALID");
    }
    pointers.push(condition.pointer.clone());
  }
  if !pointers.is_empty(){
    let observed=index_selected_tokens(&self.decoded,&pointers)?;
    if observed.len()!=pointers.len(){return Err("W1_REQUIRED_SOURCE_REFERENCE_MISSING");}
    for condition in &q.source_read_set {
      let hit=observed.iter().find(|r|r.pointer==condition.pointer)
        .ok_or("W1_REQUIRED_SOURCE_REFERENCE_MISSING")?;
      if sha256(hit.value.as_bytes())!=condition.expected_raw_token_sha256{
        return Err("W1_READ_SET_CAS_FAILED");
      }
    }
  }
  self.original_unchanged()?;
  Ok(W1PreflightReceipt{
    exact_source_and_revision_cas:true,event_identity_and_old_raw_cas:true,
    source_read_set_cas_matched:true,
    required_registry_semantics_verified:false,
    complete_operation_references_verified:false,
    native_consumer_semantics_verified:false,
    transaction_stage_authorized:false,encode_copy_authorized:false
  })
 }
 /// Derive a bounded SAME-SOURCE required reference set from Core,
 /// rather than accepting an empty or attacker-chosen caller read-set.
 /// Version-specific Native/Area/Clock semantics require separate 01B/01E
 /// proof and remain OFF even when every referenced source token exists.
 pub fn diagnose_w1_core_native_read_set(
   &self,q:W1CommandIntent<'_>
 )->EngineResult<W1CoreNativeReadSet>{
   let event=q.event_id;
   let saved=q.saved_index;
   let oneof=q.oneof.as_str();
   // Only the specifically observed Switch1253 ItemSpawning row is modelled.
   if event!=2010000021||saved!=155||oneof!="ItemSpawning"{
      return Err("W1_NATIVE_OPERATION_NOT_MODELLED");
   }
   // Existing strict source, revision, registry, old value and oneof CAS
   // still apply; the caller's read-set does NOT define what is mandatory.
   let _=self.preflight_w1(q)?;
   // EndDate may genuinely be absent; record missing/unknown explicitly.
   // A raw Game Registry proof is not stored in this Save, and proving the
   // existence of a Grid token cannot prove the effective Native Grid.
   const REQUIRED:&[&str]=&[
    "/GameInfo/Version",
    "/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID",
    "/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
    "/World/RecurringEvents/155/ItemSpawning/LastOccurrence",
    "/World/RecurringEvents/155/ItemSpawning/EndDate",
    "/World/GridCollection/Grids",
    "/World/GridCollection/DiffGrids",
    "/World/Villages"
   ];
   if self.decoded.len()>128*1024*1024{
      return Err("W1_NATIVE_READSET_RESEARCH_MEMORY_LIMIT");
   }
   let mut observed=Vec::new();
   let mut missing=Vec::new();
   for path in REQUIRED {
      let selected=index_selected_tokens(&self.decoded,&[(*path).to_owned()]);
      match selected {
        Ok(hits) if hits.len()==1 && hits[0].pointer==*path
          && hits[0].value.len()<=2*1024*1024 =>{
           observed.push(SourceReadCondition{
             pointer:(*path).to_owned(),
             expected_raw_token_sha256:sha256(hits[0].value.as_bytes())
           });
        }
        _=>missing.push((*path).to_owned())
      }
   }
   self.original_unchanged()?;
   Ok(W1CoreNativeReadSet{
      event_id:event,saved_index:saved,
      source_cipher_sha256:self.roots.encrypted_source_sha256,
      registry_sha256:self.roots.registry_sha256,
      all_known_source_refs_observed:missing.is_empty(),
      observed_core_refs:observed,missing_or_unbounded_refs:missing,
      required_source_paths_count:REQUIRED.len(),
      core_derived_not_caller_selected:true,
      // These are independent Native/Registry/Context evidence gates.
      same_build_native_registry_manifest_accepted:false,
      effective_area_grid_diffgrid_quota_verified:false,
      clock_actualize_last_to_next_verified:false,
      complete_native_dependency_closure_verified:false,
      product_writer_authorized:false
   })
 }
 /// Stronger W1 *source* preflight for a future operation-owned
 /// transaction: the Core requires every modelled dependency irrespective of
 /// the caller's (possibly empty) `source_read_set`. An incomplete snapshot
 /// is a hard error, not a false "reference CAS passed" authority bit.
 ///
 /// This remains a SOURCE-only witness. It does not grant Native V3, edited
 /// P1G copy export, stage, Apply, or original overwrite.
 pub fn require_w1_core_operation_source_read_set(
   &self,q:W1CommandIntent<'_>
 )->EngineResult<W1CoreNativeReadSet>{
   let witness=self.diagnose_w1_core_native_read_set(q)?;
   // Entirely Core-derived: caller cannot make missing dependencies look
   // present by submitting [] or a hand-picked subset with valid hashes.
   if !witness.core_derived_not_caller_selected||
      witness.required_source_paths_count!=8||
      !witness.all_known_source_refs_observed||
      !witness.missing_or_unbounded_refs.is_empty()||
      witness.observed_core_refs.len()!=witness.required_source_paths_count{
      return Err("W1_CORE_MANDATORY_SOURCE_READSET_INCOMPLETE");
   }
   // Validate the eight Core-found raw token hashes against the same session
   // snapshot, rather than trusting the returned witness or caller metadata.
   let requested:Vec<String>=witness.observed_core_refs.iter()
      .map(|x|x.pointer.clone()).collect();
   let actual=index_selected_tokens(&self.decoded,&requested)?;
   if actual.len()!=requested.len(){
     return Err("W1_CORE_SOURCE_READSET_RECHECK_FAILED");
   }
   for required in &witness.observed_core_refs {
     let hit=actual.iter().find(|x|x.pointer==required.pointer)
       .ok_or("W1_CORE_SOURCE_READSET_RECHECK_FAILED")?;
     if sha256(hit.value.as_bytes())!=required.expected_raw_token_sha256{
       return Err("W1_CORE_SOURCE_READSET_RECHECK_FAILED");
     }
   }
   // The eight raw tokens alone are not even a typed Save structural
   // authority. PR401 independently shows v1.25.3 Villages is ARRAY with
   // per-Village Areas map and GridIDs array; old synthetic OBJECT village
   // layouts MUST NOT be accepted as current target structure.
   let raw_at=|pointer:&str|->EngineResult<Value>{
     let token=actual.iter().find(|x|x.pointer==pointer)
       .ok_or("W1_CORE_REQUIRED_TYPED_SOURCE_MISSING")?;
     serde_json::from_str::<Value>(&token.value)
       .map_err(|_|"W1_CORE_REQUIRED_TYPED_SOURCE_INVALID")
   };
   let version=raw_at("/GameInfo/Version")?;
   if version.as_u64()!=Some(626){return Err("W1_CORE_SCHEMA_SOURCE_MISMATCH");}
   let id=raw_at("/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID")?;
   if id.as_u64()!=Some(2010000021){return Err("W1_CORE_EVENT_SOURCE_MISMATCH");}
   let next=raw_at("/World/RecurringEvents/155/ItemSpawning/NextOccurrence")?;
   let last=raw_at("/World/RecurringEvents/155/ItemSpawning/LastOccurrence")?;
   if !next.as_str().is_some_and(valid_utc_exact)||
      !last.as_str().is_some_and(valid_utc_exact){
     return Err("W1_CORE_DATE_FIELD_SOURCE_INVALID");
   }
   let end=raw_at("/World/RecurringEvents/155/ItemSpawning/EndDate")?;
   if !end.is_null() && !end.as_str().is_some_and(valid_utc_exact){
     return Err("W1_CORE_ENDDATE_TYPE_INVALID");
   }
   let grids=raw_at("/World/GridCollection/Grids")?;
   let diff=raw_at("/World/GridCollection/DiffGrids")?;
   if !grids.is_object()||!diff.is_object(){
     return Err("W1_CORE_GRID_MAP_TYPE_INVALID");
   }
   let villages=raw_at("/World/Villages")?;
   let array=villages.as_array().ok_or("W1_CORE_VILLAGES_ARRAY_REQUIRED")?;
   let mut found_area_grids=false;
   for village in array {
     let Some(areas)=village.get("Areas") else {continue;};
     let map=areas.as_object().ok_or("W1_CORE_AREAS_MAP_INVALID")?;
     for area in map.values() {
       let ids=area.get("GridIDs").and_then(Value::as_array)
         .ok_or("W1_CORE_AREA_GRIDIDS_INVALID")?;
       if ids.iter().any(|id|id.as_u64().is_none()){
         return Err("W1_CORE_AREA_GRIDIDS_INVALID");
       }
       found_area_grids=true;
     }
   }
   if !found_area_grids{
     return Err("W1_CORE_VILLAGE_AREA_GRIDS_MISSING");
   }
   // Valid shapes cannot prove exact Wetland ownership, real Tree anchors,
   // default+DiffGrid overlay, quota, or Clock/Actualize Native behavior.
   // The returned witness keeps ALL Native and Writer flags false.
   self.original_unchanged()?;
   Ok(witness) // Native/Writer booleans are still universally false.
 }
 /// Strict preflight and full-document token-only exact-diff proof
 /// without mutating a SaveSession or issuing any product Writer capability.
 /// A bounded full-document copy is necessary in this research implementation.
 pub fn preview_w1_exact_diff(&self,q:W1CommandIntent<'_>)->EngineResult<W1ExactDiffPreview>{
   let pointer=q.pointer.to_owned();
   let old_utc=q.expected_old_utc.to_owned();
   let new_utc=q.proposed_utc.to_owned();
   let event_id=q.event_id;
   let saved_index=q.saved_index;
   let expected_revision=q.expected_revision;
   let expected_generation=q.expected_generation;
   let checked=self.preflight_w1(q)?;
   if !checked.exact_source_and_revision_cas||
      !checked.event_identity_and_old_raw_cas||
      !checked.source_read_set_cas_matched{
      return Err("W1_PREVIEW_CAS_INCOMPLETE");
   }
   if self.decoded.len()>128*1024*1024{
      return Err("W1_PREVIEW_COPY_BUDGET_EXCEEDED");
   }
   let change=crate::TokenChange{
      pointer:pointer.clone(),expected_old_string:old_utc.clone(),
      replacement_string:new_utc.clone()
   };
   let patched=crate::patch_json_string_tokens(
      &self.decoded,self.roots.decoded_json_sha256,self.roots.schema,&[change]
   )?;
   if patched.changed.len()!=1||patched.changed[0].pointer!=pointer{
      return Err("W1_PREVIEW_UNEXPECTED_DIFF");
   }
   self.original_unchanged()?;
   Ok(W1ExactDiffPreview{
      source_cipher_sha256:self.roots.encrypted_source_sha256,
      source_decoded_sha256:self.roots.decoded_json_sha256,
      registry_sha256:self.roots.registry_sha256,
      source_revision:expected_revision,index_generation:expected_generation,
      proposed_revision:expected_revision.checked_add(1)
         .ok_or("W1_REVISION_OVERFLOW")?,
      pointer,event_id,saved_index,old_utc,new_utc,
      old_decoded_bytes:self.decoded.len(),
      proposed_decoded_bytes:patched.bytes.len(),
      proposed_decoded_sha256:patched.edited_sha256,
      exact_changed_pointers:patched.changed.into_iter().map(|x|x.pointer).collect(),
      source_and_reference_cas_matched:true,
      full_operation_reference_closure_verified:false,
      original_first_backup_written:false,
      atomic_changeset_committed:false,
      encode_copy_authorized:false,persistent_replace_authorized:false
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
