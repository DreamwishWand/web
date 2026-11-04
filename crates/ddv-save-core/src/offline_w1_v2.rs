//! Native-only, private offline W1 V2 proof. Never expose to product Worker.
//! Original remains read-only; outputs are create_new files. No Native V3.
#![cfg(not(target_arch="wasm32"))]
use crate::{sha256,index_selected_tokens,TokenChange};
use crate::p1g::{decode_p1g_research,create_p1g_copy_research};
use crate::trusted_read::{TrustedReadCore,W1CommandIntent,ReadRoots,W1CoreNativeReadSet};
use std::collections::HashSet;
use crate::w1_evidence::W1Kind;
use crate::session::{SaveSession,Domain,CommandKind,LogicalIdentity,
  ReferenceIndex,SemanticCommand,TransactionPlan,ReadWitness};
use std::{fs::{self,File,OpenOptions},io::{Read,Write},path::{Path,PathBuf}};
const BID:&str="9A239D3DB569756D";
const PATH:&str="/World/RecurringEvents/155/ItemSpawning/NextOccurrence";
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
 /// Exact Arc::ptr_eq between TrustedReadCore source and atomic stage source.
 /// Reuses immutable backing only; NOT a unified Product SaveSession authority.
 pub core_and_stage_share_immutable_decoded_source:bool,
 /// Ciphertext is also the Core-owned immutable Arc; not OS backup proof.
 pub original_ciphertext_borrowed_from_trusted_core:bool,
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
 let mut opts=OpenOptions::new();
 opts.write(true).create_new(true);
 #[cfg(unix)] {
   use std::os::unix::fs::OpenOptionsExt;
   opts.mode(0o600);
 }
 let mut file=opts.open(path).map_err(|_|"OFFLINE_OUTPUT_NOT_NEW")?;
 let result=(||{
   file.write_all(bytes).map_err(|_|"OFFLINE_WRITE_FAILED")?;
   file.sync_all().map_err(|_|"OFFLINE_FSYNC_FAILED")?;
   drop(file);
   #[cfg(unix)] {
     let parent=path.parent().unwrap_or(Path::new("."));
     File::open(parent).and_then(|dir|dir.sync_all())
       .map_err(|_|"OFFLINE_PARENT_DIR_FSYNC_FAILED")?;
   }
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
/// Native-only research bridge from a fixed Core-derived W1 snapshot readset
/// into one atomic SaveSession ChangeSet. No UI can select a smaller readset.
/// This verifies *source* token CAS, not Native Wetland/Clock semantics.
pub fn private_core_bound_w1_atomic_readset(
 decoded:&[u8],expected_decoded_sha:[u8;32],required:&W1CoreNativeReadSet
)->Result<Vec<ReadWitness>,&'static str>{
 const PATHS:[&str;8]=[
  "/GameInfo/Version",
  "/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID",
  "/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
  "/World/RecurringEvents/155/ItemSpawning/LastOccurrence",
  "/World/RecurringEvents/155/ItemSpawning/EndDate",
  "/World/GridCollection/Grids",
  "/World/GridCollection/DiffGrids",
  "/World/Villages"
 ];
 if sha256(decoded)!=expected_decoded_sha {
   return Err("OFFLINE_STAGE_SOURCE_SHA_CAS_FAILED");
 }
 if required.event_id!=2010000021||required.saved_index!=155||
    required.required_source_paths_count!=8||
    !required.core_derived_not_caller_selected||
    !required.all_known_source_refs_observed||
    !required.missing_or_unbounded_refs.is_empty()||
    required.observed_core_refs.len()!=8||
    required.product_writer_authorized||
    required.complete_native_dependency_closure_verified{
   return Err("OFFLINE_STAGE_CORE_READSET_INCOMPLETE");
 }
 let mut unique=HashSet::new();
 for ref_ in &required.observed_core_refs {
   if !PATHS.contains(&ref_.pointer.as_str())||
      !unique.insert(ref_.pointer.as_str()) {
     return Err("OFFLINE_STAGE_CORE_READSET_INCOMPLETE");
   }
 }
 if unique.len()!=PATHS.len(){return Err("OFFLINE_STAGE_CORE_READSET_INCOMPLETE");}
 // Same immutable source, exact byte tokens, not a UI-supplied summary.
 let paths=PATHS.iter().map(|s|s.to_string()).collect::<Vec<_>>();
 let hits=index_selected_tokens(decoded,&paths)?;
 if hits.len()!=8{return Err("OFFLINE_STAGE_CORE_SOURCE_REF_MISSING");}
 let mut read_set=Vec::with_capacity(8);
 for path in PATHS {
   let ref_=required.observed_core_refs.iter()
     .find(|x|x.pointer==path).ok_or("OFFLINE_STAGE_CORE_READSET_INCOMPLETE")?;
   let hit=hits.iter().find(|x|x.pointer==path)
     .ok_or("OFFLINE_STAGE_CORE_SOURCE_REF_MISSING")?;
   if hit.value.len()>2*1024*1024||
      sha256(hit.value.as_bytes())!=ref_.expected_raw_token_sha256 {
      return Err("OFFLINE_STAGE_CORE_SOURCE_REF_CAS_FAILED");
   }
   read_set.push(ReadWitness{
     pointer:path.to_owned(),expected_raw_json:hit.value.clone()
   });
 }
 Ok(read_set)
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
 // Transfer the bounded encrypted original to the TrustedReadCore ONCE.
 // Borrow the same immutable Arc for backup and research encode; never create
 // a second original ciphertext or decoded JSON clone during preflight.
 let core=TrustedReadCore::open_p1g_readonly(
   original,input.key,input.source_sha,input.decoded_sha,
   input.registry,input.registry_sha,BID,626,MAX_JSON)
   .map_err(|e|if e=="READ_DECODED_SHA_CAS_FAILED"{
     "OFFLINE_DECODED_SHA_CAS_FAILED"
   }else{e})?;
 let original=core.borrow_original_snapshot_research()?;
 let shared_original=core.shares_original_ciphertext_research(&original);
 if !shared_original||sha256(&original)!=input.source_sha{
   return Err("OFFLINE_RESEARCH_ORIGINAL_BACKING_MISMATCH");
 }
 let decoded=core.borrow_decoded_snapshot_research()?;
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
 let atomic_reads=private_core_bound_w1_atomic_readset(
   &decoded,input.decoded_sha,&required)?;
 let identity=LogicalIdentity{domain:Domain::RecurringEvent,key:"W1:155:2010000021".into()};
 let mut references=ReferenceIndex::default();
 references.nodes.insert(identity.clone());
 // Separate research SaveSession: this reference graph does NOT prove native
 // event/World/Clock semantics, and cannot be used as product authorization.
 let sid=session_id()?;
 let mut tx=SaveSession::open_decoded_shared_research(
    sid,decoded.clone(),626,references.clone())?;
 let shared_backing=tx.shares_immutable_source_research(&decoded);
 if !shared_backing||tx.source_sha256()!=input.decoded_sha{
   return Err("OFFLINE_RESEARCH_CORE_BACKING_MISMATCH");
 }
 // Native research-only: staging lifetime is subordinate to this Core owner.
 // No independent retained Arc may become an editable session after Close/Drop.
 tx.bind_trusted_core_research(&core)?;
 let next_raw=format!("\"{}\"",input.proposed_utc);
 let staged=tx.stage_command(TransactionPlan{
  session_id:sid,expected_revision:0,
  expected_source_sha256:input.decoded_sha,
  commands:vec![SemanticCommand{
   domain:Domain::RecurringEvent,identity,kind:CommandKind::ReplaceStringToken,
   pointer:PATH.into(),expected_old_json:old_raw,
   new_json:next_raw.clone(),
   read_set:atomic_reads
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
  core_and_stage_share_immutable_decoded_source:shared_backing,
  original_ciphertext_borrowed_from_trusted_core:shared_original,
  product_writer_authorized:false
 })
}


#[cfg(test)]
mod core_owner_lifetime_tests {
 use super::*;
 use crate::p1g::encode_synthetic_fixture;

 const JSON:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{},"DiffGrids":{}},"Villages":[]}}"#;
 const KEY:[u8;32]=[7u8;32];
 const REGISTRY:&[u8]=b"synthetic-private-core-lifecycle";

 fn owner()->TrustedReadCore {
   let cipher=encode_synthetic_fixture(JSON.as_bytes(),&KEY,8).unwrap();
   TrustedReadCore::open_p1g_readonly(
     cipher.clone(),&KEY,sha256(&cipher),sha256(JSON.as_bytes()),
     REGISTRY,sha256(REGISTRY),BID,626,1024*1024
   ).unwrap()
 }
 fn stage(core:&TrustedReadCore)->SaveSession {
   let decoded=core.borrow_decoded_snapshot_research().unwrap();
   let mut tx=SaveSession::open_decoded_shared_research(
     97,decoded,626,ReferenceIndex::default()
   ).unwrap();
   tx.bind_trusted_core_research(core).unwrap();
   tx
 }
 fn empty_plan()->TransactionPlan {
   TransactionPlan{
     session_id:97,expected_revision:0,
     expected_source_sha256:sha256(JSON.as_bytes()),
     commands:vec![],postconditions:vec![],
     post_references:ReferenceIndex::default()
   }
 }
 #[test]
 fn stage_undo_redo_and_read_fail_after_explicit_core_close(){
   let mut core=owner();
   let mut tx=stage(&core);
   assert_eq!(tx.revision(),0);
   assert!(tx.validate_transaction().is_ok());
   core.close();
   assert_eq!(tx.validate_transaction().err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.stage_command(empty_plan()).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.undo(0).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.redo(0).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.query_paged(&[],0,1).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.revision(),0);
   assert_eq!(tx.index_generation(),0);
   assert_eq!(tx.source_sha256(),sha256(JSON.as_bytes()));
   assert_eq!(core.borrow_decoded_snapshot_research().err(),
     Some("READ_SESSION_CLOSED"));
   assert_eq!(tx.export_verified_copy().err(),
     Some("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED"));
 }
 #[test]
 fn core_drop_invalidates_retained_decoded_arc_and_research_stage(){
   let mut tx={
      let core=owner();
      let tx=stage(&core);
      assert!(tx.validate_transaction().is_ok());
      tx
   };
   assert_eq!(tx.validate_transaction().err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.stage_command(empty_plan()).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
   assert_eq!(tx.undo(0).err(),Some("CORE_STAGE_SOURCE_REVOKED"));
 }
 #[test]
 fn another_core_same_json_cannot_rebind_or_authorize_stage(){
   let core_a=owner();
   let core_b=owner();
   let mut tx=stage(&core_a);
   assert_eq!(tx.bind_trusted_core_research(&core_b).err(),
       Some("CORE_STAGE_BINDING_STATE_INVALID"));
   // Same JSON/SHA is not the same immutable owning Arc and session.
   let decoded_a=core_a.borrow_decoded_snapshot_research().unwrap();
   let mut foreign=SaveSession::open_decoded_shared_research(
      98,decoded_a,626,ReferenceIndex::default()
   ).unwrap();
   assert_eq!(foreign.bind_trusted_core_research(&core_b).err(),
       Some("CORE_STAGE_SOURCE_IDENTITY_MISMATCH"));
   assert!(tx.validate_transaction().is_ok());
   // The legacy unbound research Vec API remains usable for SOURCE-only reads.
   let unbound=SaveSession::open_decoded_research(
     99,JSON.as_bytes().to_vec(),626,ReferenceIndex::default()).unwrap();
   assert!(unbound.validate_transaction().is_ok());
   assert_eq!(unbound.export_verified_copy().err(),
      Some("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED"));
 }
}
