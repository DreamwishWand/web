//! Private native-only semantic-NOOP V2 probe; NOT a product Writer.
//! Same ProductSession + mutex, no alternate Reader/Executor; no P1G keys.
use super::{ProductSession,State,WorkerEnvelope,WorkerAction,PRODUCT_WORKER_CONTRACT};
use crate::{strict_document::validate_entire_document,CoreError,CoreResult};
use sha2::{Digest,Sha256};
const OLD:&[u8]=b"\"Version\": 626";
const MAX_PROOF:usize=32*1024*1024;
fn fail(code:&'static str)->CoreError{CoreError(code)}
fn sha(b:&[u8])->[u8;32]{Sha256::digest(b).into()}
fn token_hash(bytes:&[u8])->CoreResult<[u8;32]> {
 let mut h=Sha256::new();let mut in_string=false;let mut escape=false;
 for &c in bytes {
   if in_string {
     h.update([c]);
     if escape{escape=false}else if c==b'\\'{escape=true}
     else if c==b'"'{in_string=false}
   }else if c==b'"'{in_string=true;h.update([c]);}
   else if !matches!(c,b' '|b'\n'|b'\r'|b'\t'){h.update([c]);}
 }
 if in_string||escape{return Err(fail("V2_TOKEN_STREAM_DENIED"));}
 Ok(h.finalize().into())
}
fn render_noop(bytes:&[u8])->CoreResult<Vec<u8>> {
 if bytes.is_empty()||bytes.len()>MAX_PROOF{return Err(fail("V2_PROOF_BOUNDS"));}
 validate_entire_document(bytes,626)?;
 let mut found=None;
 for (i,part) in bytes.windows(OLD.len()).enumerate() {
   if part==OLD{
     if found.replace(i).is_some(){return Err(fail("V2_OLD_LITERAL_NOT_UNIQUE"));}
   }
 }
 let at=found.ok_or(fail("V2_EXPECTED_OLD_VALUE_CAS"))?+OLD.len();
 if !matches!(bytes.get(at),Some(b','|b'}'|b' '|b'\n'|b'\r'|b'\t')){
   return Err(fail("V2_NUMERIC_TOKEN_BOUNDS"));
 }
 let mut out=Vec::with_capacity(bytes.len()+1);
 out.extend_from_slice(&bytes[..at]);out.push(b' ');
 out.extend_from_slice(&bytes[at..]);
 validate_entire_document(&out,626)?;
 if out.len()!=bytes.len()+1||sha(&out)==sha(bytes)||
    token_hash(&out)?!=token_hash(bytes)?{
    return Err(fail("V2_NOT_EXACT_SEMANTIC_NOOP"));
 }
 Ok(out)
}
pub(super) struct PrivateOfflineLedger{
 pub(super) edited:Vec<u8>,pub(super) applied:bool,pub(super) consumed:bool
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct PrivateOfflineReceipt{
 pub session_id:[u8;16],pub revision:u64,pub index_generation:u64,
 pub original_sha256:[u8;32],pub applied:bool,
 pub old_value_cas_verified:bool,pub exact_diff_bytes:usize,
 pub semantic_tokens_unchanged:bool,pub product_writer_authorized:bool
}
fn check(s:&ProductSession,st:&State,e:&WorkerEnvelope,action:WorkerAction)->CoreResult<()>{
 if st.closed{return Err(fail("SESSION_CLOSED"));}
 if e.contract!=PRODUCT_WORKER_CONTRACT||e.session_id!=st.id||
   e.expected_decoded_sha256!=s.sha{return Err(fail("SESSION_SOURCE_SCOPE_MISMATCH"));}
 if e.expected_revision!=st.revision||e.expected_index_generation!=st.generation{
   return Err(fail("SESSION_REVISION_GENERATION_CAS"));
 }
 if e.action!=action{return Err(fail("V2_OPERATION_DENIED"));}
 Ok(())
}
fn receipt(s:&ProductSession,st:&State,applied:bool)->PrivateOfflineReceipt{
 PrivateOfflineReceipt{session_id:st.id,revision:st.revision,
 index_generation:st.generation,original_sha256:s.sha,applied,
 old_value_cas_verified:true,exact_diff_bytes:1,
 semantic_tokens_unchanged:true,product_writer_authorized:false}
}
impl ProductSession {
 pub fn private_stage_semantic_noop(&self,e:WorkerEnvelope)->CoreResult<PrivateOfflineReceipt>{
   let edited=render_noop(&self.decoded)?;
   let mut st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
   if st.private_offline.is_some(){return Err(fail("V2_ALREADY_STAGED"));}
   let rev=st.revision.checked_add(1).ok_or(fail("REVISION_OVERFLOW"))?;
   let gen=st.generation.checked_add(1).ok_or(fail("GENERATION_OVERFLOW"))?;
   st.private_offline=Some(PrivateOfflineLedger{edited,applied:true,consumed:false});
   #[cfg(feature="indexed-read")] {st.indexed=None;}
   st.revision=rev;st.generation=gen;Ok(receipt(self,&st,true))
 }
 fn private_toggle(&self,e:WorkerEnvelope,applied:bool)->CoreResult<PrivateOfflineReceipt>{
   let mut st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
   let old=st.private_offline.as_ref().ok_or(fail("V2_STAGE_REQUIRED"))?;
   if old.consumed||old.applied==applied{
      return Err(fail("V2_UNDO_REDO_INVALID"));
   }
   let rev=st.revision.checked_add(1).ok_or(fail("REVISION_OVERFLOW"))?;
   let gen=st.generation.checked_add(1).ok_or(fail("GENERATION_OVERFLOW"))?;
   st.private_offline.as_mut().ok_or(fail("V2_STAGE_REQUIRED"))?.applied=applied;
   #[cfg(feature="indexed-read")] {st.indexed=None;}
   st.revision=rev;st.generation=gen;Ok(receipt(self,&st,applied))
 }
 pub fn private_undo_semantic_noop(&self,e:WorkerEnvelope)->CoreResult<PrivateOfflineReceipt>{
   self.private_toggle(e,false)
 }
 pub fn private_redo_semantic_noop(&self,e:WorkerEnvelope)->CoreResult<PrivateOfflineReceipt>{
   self.private_toggle(e,true)
 }
 /// One-time private IPC only. Never writes a file or changes product flags.
 pub fn private_take_semantic_noop_bytes(&self,e:WorkerEnvelope)->CoreResult<Vec<u8>>{
   let mut st=self.lock()?;check(self,&st,&e,WorkerAction::ExportEditedCopy)?;
   let l=st.private_offline.as_ref().ok_or(fail("V2_STAGE_REQUIRED"))?;
   if !l.applied||l.consumed{return Err(fail("V2_NOT_READY_OR_CONSUMED"));}
   if token_hash(&self.decoded)?!=token_hash(&l.edited)?{
      return Err(fail("V2_SEMANTIC_CHANGE_DENIED"));
   }
   let gen=st.generation.checked_add(1).ok_or(fail("GENERATION_OVERFLOW"))?;
   let out=l.edited.clone();
   st.private_offline.as_mut().ok_or(fail("V2_STAGE_REQUIRED"))?.consumed=true;
   st.closed=true;st.generation=gen;
   #[cfg(feature="indexed-read")] {st.indexed=None;}
   Ok(out)
 }
}
