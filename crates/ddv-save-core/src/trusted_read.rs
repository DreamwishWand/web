//! Core-owned lease/revocation wrapper for W1 scoped READ ONLY.
//! RESEARCH ONLY: host must provide cryptographically private entropy and
//! externally verified Switch BID; not a production WASM/Worker binding.
//! Do NOT use UI-supplied session ids, cursors, hashes, reference graphs,
//! complete flags, or capability grants as authority.
use crate::{sha256,EngineResult,read_only_index::{ReadRequest,W1Page,W1ReadIndex}};
pub const TRUSTED_READ_CONTRACT:&str="dreamwish.ddv.trusted-read.research@1";
const SWITCH_BID:&str="9A239D3DB569756D";

#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ReadTicket {
 pub session_id:u64,
 pub source_epoch:u64,
 pub revision:u64,
 pub index_generation:u64,
 pub decoded_sha256:[u8;32],
 /// Not an authorization token or claim that product Worker is installed.
 pub product_read_worker_accepted:bool,
 pub product_writer_authorized:bool,
}
pub struct TrustedReadBoundary {
 // Private to a trusted local Core host, never serialized to UI.
 host_entropy:[u8;32],
 epoch:u64,
 active:Option<(ReadTicket,W1ReadIndex)>,
}
fn derive(host_entropy:&[u8;32],epoch:u64,tag:&[u8])->[u8;32]{
 let mut data=Vec::with_capacity(100);
 data.extend_from_slice(TRUSTED_READ_CONTRACT.as_bytes());
 data.extend_from_slice(host_entropy);
 data.extend_from_slice(&epoch.to_le_bytes());
 data.extend_from_slice(tag);
 sha256(&data)
}
impl TrustedReadBoundary {
 /// The host must authenticate/extract platform and BID *outside* the save
 /// and mint fresh entropy via secure worker-local cryptography. As an offline
 /// research ctor this CANNOT prove either host fact; never export to UI.
 pub fn new_for_trusted_host_research(host_entropy:[u8;32])->EngineResult<Self>{
  if host_entropy==[0;32]{return Err("READ_CORE_ENTROPY_REQUIRED");}
  Ok(Self{host_entropy,epoch:0,active:None})
 }
 fn revoke(&mut self)->EngineResult<()>{
  if let Some((_,mut index))=self.active.take(){index.close();}
  self.epoch=self.epoch.checked_add(1).ok_or("READ_EPOCH_EXHAUSTED")?;
  Ok(())
 }
 fn next_identity(&self)->(u64,[u8;32]){
  let raw=derive(&self.host_entropy,self.epoch,b"SESSION");
  let mut num=[0u8;8];num.copy_from_slice(&raw[..8]);
  let id=u64::from_le_bytes(num);
  (if id==0{1}else{id},derive(&self.host_entropy,self.epoch,b"CURSOR"))
 }
 fn publish(&mut self,mut index:W1ReadIndex,id:u64)->EngineResult<ReadTicket>{
  index.bind_trusted_epoch(self.epoch)?;
  let ticket=ReadTicket{
   session_id:id,source_epoch:self.epoch,revision:0,
   index_generation:self.epoch,
   decoded_sha256:index.decoded_source_sha256(),
   product_read_worker_accepted:false,product_writer_authorized:false
  };
  self.active=Some((ticket.clone(),index));
  Ok(ticket)
 }
 pub fn open_decoded_research(&mut self,bytes:Vec<u8>)->EngineResult<ReadTicket>{
  // Revocation happens BEFORE inspecting B. A is gone even when B is corrupt.
  self.revoke()?;
  let (id,cursor_key)=self.next_identity();
  let expected_sha=sha256(&bytes);
  let index=W1ReadIndex::open_decoded_research(
   id,bytes,expected_sha,SWITCH_BID,cursor_key
  )?;
  self.publish(index,id)
 }
 /// Supports only the strict single-profile research P1G structure.
 /// Expected SHA witnesses must originate in trusted offline evidence, not UI.
 pub fn open_p1g_research(&mut self,cipher:&[u8],key:&[u8;32],
                          source_sha:[u8;32],json_sha:[u8;32])->EngineResult<ReadTicket>{
  self.revoke()?;
  let (id,cursor_key)=self.next_identity();
  let index=W1ReadIndex::open_p1g_research(
   id,cipher,key,source_sha,json_sha,SWITCH_BID,cursor_key
  )?;
  self.publish(index,id)
 }
 pub fn query_page(&mut self,ticket:&ReadTicket,cursor:Option<&str>,
                   limit:usize)->EngineResult<W1Page>{
  let (owned,index)=self.active.as_mut().ok_or("READ_NO_ACTIVE_SESSION")?;
  // Ticket is a stale-response fence, NOT authorization/identity proof.
  if ticket!=owned||ticket.source_epoch!=self.epoch||
     ticket.product_read_worker_accepted||ticket.product_writer_authorized{
   return Err("READ_UNTRUSTED_OR_STALE_TICKET");
  }
  index.query_page(ReadRequest{
   expected_session_id:owned.session_id,
   expected_revision:owned.revision,
   expected_index_generation:owned.index_generation,
   expected_decoded_sha256:owned.decoded_sha256,
   cursor,limit
  })
 }
 pub fn close(&mut self,ticket:&ReadTicket)->EngineResult<()>{
  match &self.active{
   Some((active,_)) if active==ticket=>self.revoke(),
   _=>Err("READ_UNTRUSTED_OR_STALE_TICKET")
  }
 }
 /// Host-owned A→B navigation revokes every previous Cursor and lease.
 pub fn revoke_on_navigation(&mut self)->EngineResult<()>{self.revoke()}
 pub fn retained_index_bytes(&self)->usize{
  self.active.as_ref().map(|(_,idx)|idx.retained_w1_bytes()).unwrap_or(0)
 }
 pub fn total_validated_source_bytes(&self)->usize{
  self.active.as_ref().map(|(_,idx)|idx.validated_source_bytes()).unwrap_or(0)
 }
 pub fn current_ticket(&self)->Option<ReadTicket>{
  self.active.as_ref().map(|(ticket,_)|ticket.clone())
 }
 pub fn deny_writer_or_unknown_operation(&self)->EngineResult<()>{
  Err("PRODUCT_SAVE_WRITE_NOT_AUTHORIZED")
 }
}
impl Drop for TrustedReadBoundary {
 fn drop(&mut self){
  if let Some((_,mut index))=self.active.take(){index.close();}
  self.host_entropy=[0u8;32];
 }
}
