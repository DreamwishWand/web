//! Native-only, private offline W1 V2 proof. Never expose to product Worker.
//! Original remains read-only; outputs are create_new files. No Native V3.
#![cfg(not(target_arch="wasm32"))]
use crate::{sha256,index_selected_tokens,TokenChange};
use crate::p1g::{decode_p1g_research,create_p1g_copy_research};
use crate::trusted_read::{TrustedReadCore,W1CommandIntent,ReadRoots};
use crate::w1_evidence::W1Kind;
use crate::session::{SaveSession,Domain,CommandKind,LogicalIdentity,
  ReferenceIndex,SemanticCommand,TransactionPlan,ReadWitness};
use std::{fs::{self,File,OpenOptions},io::{Read,Write},path::{Path,PathBuf}};
const BID:&str="9A239D3DB569756D";
const PATH:&str="/World/RecurringEvents/155/ItemSpawning/NextOccurrence";
const ID_PATH:&str="/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID";
const MAX_JSON:usize=128*1024*1024;
const MAX_P1G:u64=128*1024*1024;

pub struct PrivateW1V2Input<'a> {
 pub source_path:&'a Path,pub backup_path:&'a Path,pub edited_path:&'a Path,
 pub key:&'a [u8;32],pub registry:&'a [u8],
 pub source_sha:[u8;32],pub decoded_sha:[u8;32],pub registry_sha:[u8;32],
 pub platform:&'a str,pub full_version:&'a str,pub bid:&'a str,
 pub schema:u64,pub expected_revision:u64,
 pub old_utc:&'a str,pub proposed_utc:&'a str,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct PrivateW1V2Receipt {
 pub original_sha:[u8;32],pub backup_sha:[u8;32],
 pub edited_sha:[u8;32],pub edited_decoded_sha:[u8;32],
 pub revision_after_stage:u64,pub revision_after_undo_redo:u64,
 pub mandatory_readset_pass:bool,pub atomic_diff_pass:bool,
 pub original_first_backup_reopened:bool,pub edited_file_reopened:bool,
 pub independent_process_reopen:bool,pub native_v3_verified:bool,
 pub product_writer_authorized:bool,
}
fn output_canonical(path:&Path)->Result<PathBuf,&'static str>{
 let name=path.file_name().ok_or("OFFLINE_OUTPUT_NAME_INVALID")?;
 let parent=path.parent().filter(|x|!x.as_os_str().is_empty())
   .unwrap_or(Path::new("."));
 Ok(fs::canonicalize(parent).map_err(|_|"OFFLINE_OUTPUT_PARENT_INVALID")?.join(name))
}
fn write_new_verified(path:&Path,bytes:&[u8],sha:[u8;32])
 ->Result<(),&'static str>{
 let mut file=OpenOptions::new().write(true).create_new(true).open(path)
   .map_err(|_|"OFFLINE_OUTPUT_NOT_NEW")?;
 let result=(||{
   file.write_all(bytes).map_err(|_|"OFFLINE_WRITE_FAILED")?;
   file.sync_all().map_err(|_|"OFFLINE_FSYNC_FAILED")?;
   drop(file);
   let observed=fs::read(path).map_err(|_|"OFFLINE_REOPEN_FAILED")?;
   if observed!=bytes||sha256(&observed)!=sha{
     return Err("OFFLINE_WRITTEN_SHA_MISMATCH");
   }
   Ok(())
 })();
 if result.is_err(){let _=fs::remove_file(path);}
 result
}
fn session_id()->Result<u64,&'static str>{
 let mut bytes=[0u8;8];
 getrandom::getrandom(&mut bytes).map_err(|_|"OFFLINE_CSPRNG_FAILED")?;
 let id=u64::from_le_bytes(bytes);
 if id==0{return Err("OFFLINE_CSPRNG_FAILED");}
 Ok(id)
}
fn intent<'a>(sid:&'a str,r:&'a ReadRoots,old_raw:&'a str,
 old:&'a str,new:&'a str)->W1CommandIntent<'a>{
 W1CommandIntent {
  session_id:sid,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:r.encrypted_source_sha256,
  expected_decoded_sha256:r.decoded_json_sha256,
  expected_registry_sha256:r.registry_sha256,
  expected_external_bid:BID,schema:626,event_id:2010000021,
  saved_index:155,oneof:W1Kind::ItemSpawning,pointer:PATH,
  expected_old_raw_json:old_raw,expected_old_utc:old,proposed_utc:new,
  source_read_set:vec![]
 }
}
pub fn execute_private_w1_v2_research(
 input:PrivateW1V2Input<'_>
)->Result<PrivateW1V2Receipt,&'static str>{
 if input.platform!="switch"||input.full_version!="1.25.3"||
    input.bid!=BID||input.schema!=626{return Err("OFFLINE_EXTERNAL_BUILD_DENIED");}
 if input.expected_revision!=0{return Err("OFFLINE_STALE_REVISION");}
 if input.registry.is_empty()||input.registry.len()>512*1024||
    sha256(input.registry)!=input.registry_sha{
    return Err("OFFLINE_REGISTRY_SHA_DENIED");
 }
 let metadata=fs::symlink_metadata(input.source_path)
   .map_err(|_|"OFFLINE_SOURCE_UNAVAILABLE")?;
 if !metadata.file_type().is_file()||metadata.len()==0||metadata.len()>MAX_P1G{
    return Err("OFFLINE_SOURCE_NOT_BOUNDED_REGULAR_FILE");
 }
 let origin=fs::canonicalize(input.source_path).map_err(|_|"OFFLINE_SOURCE_UNAVAILABLE")?;
 let backup=output_canonical(input.backup_path)?;
 let edited=output_canonical(input.edited_path)?;
 if origin==backup||origin==edited||backup==edited{
    return Err("OFFLINE_SOURCE_REPLACEMENT_FORBIDDEN");
 }
 if backup.exists()||edited.exists(){return Err("OFFLINE_OUTPUT_ALREADY_EXISTS");}
 let mut original=Vec::with_capacity(metadata.len() as usize);
 File::open(&origin).map_err(|_|"OFFLINE_SOURCE_OPEN_FAILED")?
   .take(MAX_P1G+1).read_to_end(&mut original)
   .map_err(|_|"OFFLINE_SOURCE_READ_FAILED")?;
 if original.len() as u64>MAX_P1G||sha256(&original)!=input.source_sha{
    return Err("OFFLINE_SOURCE_SHA_CAS_FAILED");
 }
 let decoded=decode_p1g_research(&original,input.key,MAX_JSON)?;
 if decoded.decoded_json_sha256!=input.decoded_sha{
    return Err("OFFLINE_DECODED_SHA_CAS_FAILED");
 }
 // One immutable Rust Core source; no UI-provided readset or Native flag.
 let core=TrustedReadCore::open_p1g_readonly(
   original.clone(),input.key,input.source_sha,input.decoded_sha,
   input.registry,input.registry_sha,BID,626,MAX_JSON)?;
 let owner=core.receipt()?;
 let old_raw=format!("\"{}\"",input.old_utc);
 let required=core.require_w1_core_operation_source_read_set(
   intent(&owner.session_id,&owner.roots,&old_raw,input.old_utc,input.proposed_utc))?;
 if !required.all_known_source_refs_observed||
    required.product_writer_authorized||required.complete_native_dependency_closure_verified{
    return Err("OFFLINE_CORE_READSET_NOT_ACCEPTED");
 }
 let diff=core.preview_w1_exact_diff(
   intent(&owner.session_id,&owner.roots,&old_raw,input.old_utc,input.proposed_utc))?;
 if diff.exact_changed_pointers!=[PATH]||diff.proposed_revision!=1||
    !diff.source_and_reference_cas_matched||diff.encode_copy_authorized{
    return Err("OFFLINE_EXACT_DIFF_UNEXPECTED");
 }
 let hits=index_selected_tokens(&decoded.json,&[ID_PATH.into()])?;
 let id_raw=hits.first().ok_or("OFFLINE_EVENT_ID_MISSING")?.value.clone();
 let identity=LogicalIdentity{domain:Domain::RecurringEvent,key:"W1:155:2010000021".into()};
 let mut references=ReferenceIndex::default();
 references.nodes.insert(identity.clone());
 // Separate research SaveSession: this reference graph does NOT prove native
 // event/World/Clock semantics, and cannot be used as product authorization.
 let sid=session_id()?;
 let mut tx=SaveSession::open_decoded_research(sid,decoded.json.clone(),626,references.clone())?;
 let next_raw=format!("\"{}\"",input.proposed_utc);
 let staged=tx.stage_command(TransactionPlan{
  session_id:sid,expected_revision:0,
  expected_source_sha256:input.decoded_sha,
  commands:vec![SemanticCommand{
   domain:Domain::RecurringEvent,identity,kind:CommandKind::ReplaceStringToken,
   pointer:PATH.into(),expected_old_json:old_raw,
   new_json:next_raw.clone(),
   read_set:vec![ReadWitness{pointer:ID_PATH.into(),expected_raw_json:id_raw}]
  }],
  postconditions:vec![ReadWitness{pointer:PATH.into(),expected_raw_json:next_raw}],
  post_references:references
 })?;
 if staged.from_revision!=0||staged.to_revision!=1||staged.changed_paths!=[PATH]{
    return Err("OFFLINE_CHANGESET_UNEXPECTED");
 }
 let current=tx.validate_transaction()?;
 if current.staged_sha256!=diff.proposed_decoded_sha256||
    current.semantic_domain_guards_accepted||current.encode_copy_authorized{
    return Err("OFFLINE_ATOMIC_STAGED_DIFF_MISMATCH");
 }
 if tx.undo(1)?.to_revision!=2||
    tx.validate_transaction()?.staged_sha256!=input.decoded_sha{
    return Err("OFFLINE_UNDO_MISMATCH");
 }
 if tx.redo(2)?.to_revision!=3||
    tx.validate_transaction()?.staged_sha256!=diff.proposed_decoded_sha256{
    return Err("OFFLINE_REDO_MISMATCH");
 }
 if tx.export_verified_copy().err()!=Some("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED")||
    core.export_p1g_copy().err()!=Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"){
    return Err("OFFLINE_PRODUCT_WRITER_FAIL_OPEN");
 }
 // Persist + fsync + reopen ORIGINAL before edited-copy encoding.
 write_new_verified(&backup,&original,input.source_sha)?;
 let copied=create_p1g_copy_research(&original,input.source_sha,input.key,626,
   &[TokenChange{pointer:PATH.into(),
     expected_old_string:input.old_utc.into(),
     replacement_string:input.proposed_utc.into()}],MAX_JSON)?;
 if copied.verified_changed_pointers!=[PATH]||
    copied.decoded_after_sha256!=diff.proposed_decoded_sha256||
    copied.product_encode_copy_authorized||copied.persistent_replace_authorized{
    return Err("OFFLINE_ENCODE_COPY_DIFF_MISMATCH");
 }
 write_new_verified(&edited,&copied.edited_ciphertext,copied.edited_cipher_sha256)?;
 let copy_disk=fs::read(&edited).map_err(|_|"OFFLINE_EDITED_REREAD_FAILED")?;
 let reopened=decode_p1g_research(&copy_disk,input.key,MAX_JSON)?;
 if reopened.decoded_json_sha256!=diff.proposed_decoded_sha256||
    sha256(&copy_disk)!=copied.edited_cipher_sha256||
    sha256(&fs::read(&backup).map_err(|_|"OFFLINE_BACKUP_REREAD_FAILED")?)!=input.source_sha||
    sha256(&fs::read(&origin).map_err(|_|"OFFLINE_ORIGINAL_REREAD_FAILED")?)!=input.source_sha{
    return Err("OFFLINE_DISK_REOPEN_OR_ORIGINAL_SHA_FAILED");
 }
 core.original_unchanged()?;
 Ok(PrivateW1V2Receipt{
  original_sha:input.source_sha,backup_sha:input.source_sha,
  edited_sha:copied.edited_cipher_sha256,
  edited_decoded_sha:copied.decoded_after_sha256,
  revision_after_stage:1,revision_after_undo_redo:3,
  mandatory_readset_pass:true,atomic_diff_pass:true,
  original_first_backup_reopened:true,edited_file_reopened:true,
  independent_process_reopen:false,native_v3_verified:false,
  product_writer_authorized:false
 })
}
