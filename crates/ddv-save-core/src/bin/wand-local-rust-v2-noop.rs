//! Native only. Private semantic-NOOP exact one-byte JSON probe.
//! All real content comes from trusted local existing P1G envelope codec via
//! stdin; stdout contains ONLY the modified decoded JSON in a private pipe.
//! No user data is used in CI. No product Writer, Apply or runtime authorizations.
use ddv_save_core::{
 BuildIdentity,BuildKind,Platform,ProductSession,
 WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT
};
use sha2::{Digest,Sha256};
use std::{env,io::{self,Read,Write}};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn deny(c:&str)->!{
 eprintln!("PRIVATE_V2_DENIED:{c}");std::process::exit(12)
}
fn hex32(s:&str)->[u8;32]{
 if s.len()!=64||!s.bytes().all(|c|matches!(c,b'0'..=b'9'|b'a'..=b'f')){
  deny("INVALID_SHA_ATTESTATION")
 }
 let mut out=[0u8;32];
 for (i,part) in s.as_bytes().chunks_exact(2).enumerate(){
  let v=|b|match b {b'0'..=b'9'=>b-b'0',b'a'..=b'f'=>b-b'a'+10,_=>0};
  out[i]=(v(part[0])<<4)|v(part[1]);
 }
 out
}
fn required(k:&str)->String{
 env::var(k).ok().filter(|v|!v.is_empty())
   .unwrap_or_else(||deny("MISSING_EXTERNAL_ATTESTATION"))
}
fn main(){
 #[cfg(feature="semantic-writer-dev")]
 if matches!(env::args().nth(1).as_deref(),Some("--switch624-road-rm01-archive-only"|"--switch624-fence-fe01-archive-only"|"--switch624-fence-frp01-archive-only"|"--switch624-fence-fm01-archive-only")){
   run_switch624_archive_operation();
   return;
 }
 #[cfg(feature="semantic-writer-dev")]
 if env::args().nth(1).as_deref()==Some("--inventory-amount-backup-only") {
   run_inventory_amount_backup();
   return;
 }
 #[cfg(feature="semantic-writer-dev")]
 if matches!(env::args().nth(1).as_deref(),
     Some("--semantic-inventory-existing-decrease-only"|
          "--semantic-chest-existing-decrease-only"|
          "--semantic-inventory-and-chest-decrease-only")) {
   run_semantic_existing_decrease();
   return;
 }
 if env::args().collect::<Vec<_>>().len()!=2||
    env::args().nth(1).as_deref()!=Some("--semantic-noop-proof-only"){
   deny("EXPLICIT_PRIVATE_NOOP_OPERATION_REQUIRED")
 }
 if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM{
   deny("UNKNOWN_EXTERNAL_STEAM_BUILD")
 }
 let original_sha=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 if original_sha==[0;32]{deny("ORIGINAL_SHA_ZERO")}
 let original_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
    .unwrap_or_else(|_|deny("ORIGINAL_SIZE_REQUIRED"));
 if original_size==0||original_size>128*1024*1024{
   deny("ORIGINAL_BOUNDS")
 }
 let decoded_expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let mut decoded=Vec::new();
 io::stdin().take(32*1024*1024+1).read_to_end(&mut decoded)
   .unwrap_or_else(|_|deny("DECODED_READ_FAILURE"));
 if decoded.is_empty()||decoded.len()>32*1024*1024{
   deny("PRIVATE_NOOP_MAX_DOCUMENT")
 }
 if Sha256::digest(&decoded).as_slice()!=decoded_expected{
   deny("DECODED_SHA_CAS_MISMATCH")
 }
 let build=BuildIdentity{
   platform:Platform::SteamWindows,
   build_kind:BuildKind::SteamFullVersion,
   build_id:STEAM.to_owned(),schema:626,externally_attested:true
 };
 let s=ProductSession::open_decoded_readonly(decoded,build)
   .unwrap_or_else(|_|deny("RUST_V1_DOCUMENT_INVALID"));
 let v0=s.receipt().unwrap_or_else(|_|deny("RUST_V1_RECEIPT"));
 if v0.writer_authorized||v0.product_read_accepted||
    v0.all_domain_references_verified||v0.revision!=0||
    v0.index_generation!=1{deny("UNEXPECTED_PRODUCT_AUTHORIZATION")}
 let envelope=|rev:u64,gen:u64,action|WorkerEnvelope{
   contract:PRODUCT_WORKER_CONTRACT,
   session_id:v0.session_id,expected_revision:rev,
   expected_index_generation:gen,expected_decoded_sha256:v0.decoded_sha256,
   action
 };
 if s.dispatch(envelope(0,1,WorkerAction::Stage)).is_ok(){
   deny("PRODUCT_WRITER_BYPASS")
 }
 if s.private_stage_semantic_noop(envelope(1,1,WorkerAction::Stage)).is_ok(){
   deny("STALE_REVISION_ACCEPTED")
 }
 let staged=s.private_stage_semantic_noop(envelope(0,1,WorkerAction::Stage))
   .unwrap_or_else(|_|deny("EXACT_OLD_VALUE_OR_STAGE_DENIED"));
 if staged.revision!=1||staged.index_generation!=2||!staged.applied||
    !staged.old_value_cas_verified||!staged.semantic_tokens_unchanged||
    staged.product_writer_authorized||staged.exact_diff_bytes!=1{
   deny("STAGE_RECEIPT_INVARIANT")
 }
 if s.private_undo_semantic_noop(envelope(0,1,WorkerAction::Stage)).is_ok(){
   deny("STALE_UNDO_ACCEPTED")
 }
 let undone=s.private_undo_semantic_noop(envelope(1,2,WorkerAction::Stage))
    .unwrap_or_else(|_|deny("UNDO_FAILED"));
 if undone.applied||undone.revision!=2||undone.index_generation!=3{
    deny("UNDO_REVISION_INVARIANT")
 }
 if s.private_take_semantic_noop_bytes(envelope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){
    deny("UNDO_EXPORT_ACCEPTED")
 }
 let redone=s.private_redo_semantic_noop(envelope(2,3,WorkerAction::Stage))
    .unwrap_or_else(|_|deny("REDO_FAILED"));
 if !redone.applied||redone.revision!=3||redone.index_generation!=4{
    deny("REDO_REVISION_INVARIANT")
 }
 if s.private_take_semantic_noop_bytes(envelope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){
   deny("STALE_EXPORT_ACCEPTED")
 }
 let modified=s.private_take_semantic_noop_bytes(
      envelope(3,4,WorkerAction::ExportEditedCopy))
    .unwrap_or_else(|_|deny("ONE_TIME_PRIVATE_EXPORT_DENIED"));
 if s.private_take_semantic_noop_bytes(
      envelope(3,4,WorkerAction::ExportEditedCopy)).is_ok(){
   deny("EXPORT_REPLAY_ACCEPTED")
 }
 // Stdout is consumed ONLY by the local Codec wrapper. Never public logs.
 io::stdout().write_all(&modified).unwrap_or_else(|_|deny("PRIVATE_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("PRIVATE_PIPE_FLUSH"));
 eprintln!("PRIVATE_V2_RUST_NOOP_CAS_UNDO_REDO_ONE_TIME_PIPE_PASS");
}


// Same already-existing V2 PRIVATE stdin/stdout executor; no second reader.
// Source original P1G bytes and private key remain exclusively in the local
// existing Codec/backup wrapper and are never passed to public CI.
#[cfg(feature="semantic-writer-dev")]
fn run_semantic_existing_decrease(){
 use ddv_save_core::TypedSemanticCommand;
 const MAX_DECODED:u64=256*1024*1024;
 let args=env::args().collect::<Vec<_>>();
 if args.len()!=2{deny("SEMANTIC_ONE_EXPLICIT_OPERATION_REQUIRED");}
 let inventory=matches!(args[1].as_str(),
     "--semantic-inventory-existing-decrease-only"|
     "--semantic-inventory-and-chest-decrease-only");
 let chest=matches!(args[1].as_str(),
     "--semantic-chest-existing-decrease-only"|
     "--semantic-inventory-and-chest-decrease-only");
 if !inventory&&!chest{deny("SEMANTIC_COMMAND_NOT_ALLOWLISTED");}
 if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM{
   deny("SEMANTIC_EXACT_EXTERNAL_STEAM_BUILD_REQUIRED");
 }
 let original_sha=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let source_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
   .unwrap_or_else(|_|deny("SEMANTIC_ORIGINAL_SIZE_MISSING"));
 if original_sha==[0;32]||source_size==0||source_size>128*1024*1024{
    deny("SEMANTIC_ORIGINAL_PACKAGED_SHA_OR_SIZE");
 }
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 if expected==[0;32]{deny("SEMANTIC_DECODED_SHA_REQUIRED");}
 let mut input=Vec::new();
 io::stdin().take(MAX_DECODED+1).read_to_end(&mut input)
    .unwrap_or_else(|_|deny("SEMANTIC_PRIVATE_PIPE_READ"));
 if input.is_empty()||input.len() as u64>MAX_DECODED||
   Sha256::digest(&input).as_slice()!=expected{
    deny("SEMANTIC_SOURCE_SHA_CAS");
 }
 let build=BuildIdentity{platform:Platform::SteamWindows,
   build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),
   schema:626,externally_attested:true};
 let session=ProductSession::open_decoded_readonly(input,build)
   .unwrap_or_else(|_|deny("SEMANTIC_FULL_DOCUMENT_OR_VERSION"));
 let before=session.receipt().unwrap_or_else(|_|deny("SEMANTIC_RECEIPT"));
 if before.decoded_sha256!=expected||before.writer_authorized||
   before.revision!=0||before.index_generation!=1{
    deny("SEMANTIC_SOURCE_RECEIPT_SCOPE");
 }
 let int=|name:&str|->u32{
    required(name).parse::<u32>().ok().filter(|v|*v>0)
      .unwrap_or_else(||deny("SEMANTIC_EXPECTED_DECIMAL_ID"))
 };
 let amount=|name:&str|->u32{
    required(name).parse::<u32>()
      .unwrap_or_else(|_|deny("SEMANTIC_EXPECTED_DECIMAL_AMOUNT"))
 };
 let mut cmds=Vec::with_capacity(2);
 if inventory{
   cmds.push(TypedSemanticCommand::InventoryExistingAmountDecrease{
     inventory_id:int("WAND_LOCAL_INVENTORY_ID"),
     canonical_item_id:int("WAND_LOCAL_CANONICAL_ITEM_ID"),
     expected_compatible_item_type:required("WAND_LOCAL_COMPATIBLE_ITEM_TYPE"),
     expected_old_amount:amount("WAND_LOCAL_EXPECTED_OLD_AMOUNT"),
     new_amount:amount("WAND_LOCAL_NEW_AMOUNT"),
   });
 }
 if chest{
   cmds.push(TypedSemanticCommand::ChestExistingSlotAmountDecrease{
     container_id:int("WAND_LOCAL_CONTAINER_ID"),
     slot_index:required("WAND_LOCAL_SLOT_INDEX").parse::<usize>()
      .unwrap_or_else(|_|deny("SEMANTIC_CHEST_SLOT_INDEX")),
     expected_item_id:int("WAND_LOCAL_SLOT_ITEM_ID"),
     expected_old_amount:amount("WAND_LOCAL_CHEST_EXPECTED_OLD_AMOUNT"),
     new_amount:amount("WAND_LOCAL_CHEST_NEW_AMOUNT"),
   });
 }
 let scope=|revision:u64,generation:u64,action|WorkerEnvelope{
   contract:PRODUCT_WORKER_CONTRACT,session_id:before.session_id,
   expected_revision:revision,expected_index_generation:generation,
   expected_decoded_sha256:expected,action,
 };
 if session.dispatch(scope(0,1,WorkerAction::Stage)).is_ok(){
   deny("SEMANTIC_PRODUCT_WRITER_BYPASS");
 }
 let staged=session.stage_typed_semantic_batch(scope(0,1,WorkerAction::Stage),&cmds)
   .unwrap_or_else(|_|deny("SEMANTIC_TYPED_STAGE_DENIED"));
 if staged.revision!=1||staged.index_generation!=2||
   !staged.applied||!staged.semantic_changed||
   staged.operation_count!=cmds.len()||staged.product_writer_authorized||
   staged.native_v3_verified||staged.staged_decoded_sha256==expected{
     deny("SEMANTIC_ATOMIC_DIFF_INVARIANT");
 }
 if session.stage_typed_semantic_batch(scope(0,1,WorkerAction::Stage),&cmds).is_ok(){
   deny("SEMANTIC_STAGE_REPLAY_ACCEPTED");
 }
 let undo=session.undo_typed_semantic_batch(scope(1,2,WorkerAction::Stage))
   .unwrap_or_else(|_|deny("SEMANTIC_UNDO_DENIED"));
 if undo.applied||undo.revision!=2||undo.index_generation!=3{
   deny("SEMANTIC_UNDO_INVARIANT");
 }
 if session.take_typed_semantic_decoded_once(
   scope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){
   deny("SEMANTIC_UNDONE_EXPORT_ACCEPTED");
 }
 let redo=session.redo_typed_semantic_batch(scope(2,3,WorkerAction::Stage))
   .unwrap_or_else(|_|deny("SEMANTIC_REDO_DENIED"));
 if !redo.applied||redo.revision!=3||redo.index_generation!=4{
   deny("SEMANTIC_REDO_INVARIANT");
 }
 let edited=session.take_typed_semantic_decoded_once(
   scope(3,4,WorkerAction::ExportEditedCopy))
    .unwrap_or_else(|_|deny("SEMANTIC_ONE_TIME_EXPORT_DENIED"));
 if Sha256::digest(&edited).as_slice()!=staged.staged_decoded_sha256||
   session.take_typed_semantic_decoded_once(
     scope(3,4,WorkerAction::ExportEditedCopy)).is_ok(){
    deny("SEMANTIC_PRIVATE_EDITED_BYTES_REPLAY_OR_SHA");
 }
 // Private pipe ONLY. No plaintext, key, IDs, SHA or path in CI/logs.
 io::stdout().write_all(&edited).unwrap_or_else(|_|deny("SEMANTIC_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("SEMANTIC_PIPE_FLUSH"));
 eprintln!("PRIVATE_V2_RUST_REAL_AMOUNT_SEMANTIC_CHANGE_CAS_ATOMIC_UNDO_REDO_ONE_TIME_PIPE_PASS");
}

// Existing private executor, new read-only bounded file-format operation.
// A caller must capture stdout into its local exclusive output file, NOT a
// console/log. Original encrypted backup/codec verification remain external.
#[cfg(feature="semantic-writer-dev")]
fn run_inventory_amount_backup(){
 use ddv_save_core::portable_backup::{decode_inventory_amount_backup,WAND_BACKUP_MAX_BYTES};
 const MAX_DECODED:u64=256*1024*1024;
 if env::args().len()!=2{deny("BACKUP_EXPLICIT_OPERATION_REQUIRED");}
 if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM{
   deny("BACKUP_EXACT_EXTERNAL_STEAM_BUILD_REQUIRED");
 }
 let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let original_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
   .unwrap_or_else(|_|deny("BACKUP_ORIGINAL_SIZE_REQUIRED"));
 if original==[0;32]||original_size==0||original_size>128*1024*1024{
   deny("BACKUP_ORIGINAL_SHA_OR_SIZE");
 }
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 if expected==[0;32]{deny("BACKUP_DECODED_SHA_REQUIRED");}
 let selector=|name:&str|->u32{
   let text=required(name);
   let id=text.parse::<u32>().ok().filter(|v|*v>0)
     .unwrap_or_else(||deny("BACKUP_SELECTOR_ID"));
   if id.to_string()!=text{deny("BACKUP_SELECTOR_ID");}
   id
 };
 let inventory_id=selector("WAND_LOCAL_INVENTORY_ID");
 let item_id=selector("WAND_LOCAL_CANONICAL_ITEM_ID");
 let mut input=Vec::new();
 io::stdin().take(MAX_DECODED+1).read_to_end(&mut input)
   .unwrap_or_else(|_|deny("BACKUP_PRIVATE_PIPE_READ"));
 if input.is_empty()||input.len() as u64>MAX_DECODED||
    Sha256::digest(&input).as_slice()!=expected{
   deny("BACKUP_SOURCE_SHA_CAS");
 }
 let session=ProductSession::open_decoded_readonly(input,BuildIdentity{
   platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
   build_id:STEAM.into(),schema:626,externally_attested:true,
 }).unwrap_or_else(|_|deny("BACKUP_FULL_DOCUMENT_OR_BUILD"));
 let before=session.receipt().unwrap_or_else(|_|deny("BACKUP_SESSION_RECEIPT"));
 if before.decoded_sha256!=expected||before.revision!=0||before.index_generation!=1||
    !before.full_document_json_validated||before.product_worker_bound||
    before.product_read_accepted||before.writer_authorized||before.edited_copy_authorized||
    before.apply_authorized||before.all_domain_references_verified{
   deny("BACKUP_READ_ONLY_SCOPE");
 }
 let e=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:before.session_id,
    expected_revision:before.revision,expected_index_generation:before.index_generation,
    expected_decoded_sha256:expected,action:WorkerAction::ReadDomain};
 let bytes=session.capture_inventory_amount_backup(e,inventory_id,item_id)
   .unwrap_or_else(|_|deny("BACKUP_TARGET_DENIED"));
 if bytes.is_empty()||bytes.len()>WAND_BACKUP_MAX_BYTES{
   deny("BACKUP_OUTPUT_BOUNDS");
 }
 let verified=decode_inventory_amount_backup(&bytes)
   .unwrap_or_else(|_|deny("BACKUP_OUTPUT_VERIFY"));
 if verified.inventory_id!=inventory_id||verified.item_id!=item_id||
    verified.source_decoded_sha256!=required("WAND_LOCAL_DECODED_SHA256")||
    session.receipt().ok()!=Some(before){
   deny("BACKUP_OUTPUT_SCOPE");
 }
 session.close().unwrap_or_else(|_|deny("BACKUP_SESSION_CLOSE"));
 // No output until complete verification and close. Existing private pipe
 // transport only; wrapper handles exclusive file creation and readback.
 io::stdout().write_all(&bytes).unwrap_or_else(|_|deny("BACKUP_PRIVATE_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("BACKUP_PRIVATE_PIPE_FLUSH"));
 eprintln!("PRIVATE_V2_INVENTORY_AMOUNT_BACKUP_READONLY_PIPE_PASS");
}

// Same private executor and atomic ledger. External trusted operator verifies
// archive/original/Backup and independently approved 01B/01C/01E plan.
#[cfg(feature="semantic-writer-dev")]
fn run_switch624_archive_operation(){
 let mode=env::args().nth(1).unwrap_or_default();
 let fence=mode=="--switch624-fence-fe01-archive-only";
 let frp=mode=="--switch624-fence-frp01-archive-only";
 let fm=mode=="--switch624-fence-fm01-archive-only";
 if env::args().len()!=2||required("WAND_LOCAL_INSTALLED_SWITCH_BID")!="52BD625D9B4E0053"{
   deny("RM01_EXACT_SWITCH624_REQUIRED");
 }
 let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
    .unwrap_or_else(|_|deny("RM01_ORIGINAL_SIZE"));
 if original==[0;32]||size==0||size>128*1024*1024{deny("RM01_ORIGINAL_ATTESTATION");}
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let plan=required(if frp{"WAND_LOCAL_FRP01_CANONICAL_PLAN"}else if fm{"WAND_LOCAL_FM01_CANONICAL_PLAN"}
    else if fence{"WAND_LOCAL_FE01_CANONICAL_PLAN"}else{"WAND_LOCAL_RM01_CANONICAL_PLAN"});
 if plan.len()>16384{deny("RM01_PLAN_BOUNDS");}
 let plan_sha=hex32(&required(if frp{"WAND_LOCAL_FRP01_PLAN_SHA256"}else if fm{"WAND_LOCAL_FM01_PLAN_SHA256"}
    else if fence{"WAND_LOCAL_FE01_PLAN_SHA256"}else{"WAND_LOCAL_RM01_PLAN_SHA256"}));
 if plan_sha==[0;32]||Sha256::digest(plan.as_bytes()).as_slice()!=plan_sha{deny("RM01_PLAN_SHA_CAS");}
 let mut input=Vec::new();
 io::stdin().take(256*1024*1024+1).read_to_end(&mut input)
   .unwrap_or_else(|_|deny("RM01_PRIVATE_PIPE_READ"));
 let build=BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
    build_id:"52BD625D9B4E0053".into(),schema:624,externally_attested:true};
 let session=if fence||frp||fm{ProductSession::open_switch624_fe01_private(input,build,expected)}
   else{ProductSession::open_switch624_rm01_private(input,build,expected)}
   .unwrap_or_else(|_|deny("RM01_FULL_DOCUMENT_OR_ARCHIVE"));
 let before=session.receipt().unwrap_or_else(|_|deny("RM01_RECEIPT"));
 if before.schema!=624||before.decoded_sha256!=expected||before.writer_authorized||
    before.product_worker_bound||before.product_read_accepted||before.revision!=0||before.index_generation!=1{
   deny("RM01_SOURCE_SCOPE");
 }
 let scope=|rev,gen,action|WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
    session_id:before.session_id,expected_revision:rev,expected_index_generation:gen,
    expected_decoded_sha256:expected,action};
 let stage=|e|if frp{session.stage_switch624_fence_frp01_archive(e,plan.as_bytes())}
     else if fm{session.stage_switch624_fence_fm01_archive(e,plan.as_bytes())}
     else if fence{session.stage_switch624_fence_fe01_archive(e,plan.as_bytes())}
     else{session.stage_switch624_road_rm01_archive(e,plan.as_bytes())};
 let staged=stage(scope(0,1,WorkerAction::Stage)).unwrap_or_else(|_|deny("RM01_STAGE"));
 let count=if fence||frp{7}else{8};
 if staged.operation_count!=count||staged.exact_field_changed_count!=count||!staged.applied||
    staged.product_writer_authorized||staged.original_overwrite_authorized||!staged.semantic_changed{
   deny("RM01_EXACT_STAGE");
 }
 if stage(scope(0,1,WorkerAction::Stage)).is_ok(){deny("RM01_REPLAY");}
 let undo=session.undo_typed_semantic_batch(scope(1,2,WorkerAction::Stage)).unwrap_or_else(|_|deny("RM01_UNDO"));
 if undo.applied||session.take_typed_semantic_decoded_once(scope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){deny("RM01_UNDO_EXPORT");}
 let redo=session.redo_typed_semantic_batch(scope(2,3,WorkerAction::Stage)).unwrap_or_else(|_|deny("RM01_REDO"));
 if !redo.applied||redo.staged_decoded_sha256!=staged.staged_decoded_sha256{deny("RM01_REDO_SHA");}
 let out=session.take_typed_semantic_decoded_once(scope(3,4,WorkerAction::ExportEditedCopy)).unwrap_or_else(|_|deny("RM01_ONE_TIME_EXPORT"));
 if Sha256::digest(&out).as_slice()!=staged.staged_decoded_sha256||
    session.take_typed_semantic_decoded_once(scope(3,4,WorkerAction::ExportEditedCopy)).is_ok(){deny("RM01_EXPORT_REPLAY_OR_SHA");}
 io::stdout().write_all(&out).unwrap_or_else(|_|deny("RM01_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("RM01_PIPE_FLUSH"));
 if frp{eprintln!("PRIVATE_V2_SWITCH624_FRP01_ARCHIVE_EXACT7_PIPE_PASS");}
 else if fm{eprintln!("PRIVATE_V2_SWITCH624_FM01_ARCHIVE_PRESERVE8_PIPE_PASS");}
 else if fence{eprintln!("PRIVATE_V2_SWITCH624_FE01_ARCHIVE_PRESERVE7_PIPE_PASS");}
 else{eprintln!("PRIVATE_V2_SWITCH624_RM01_ARCHIVE_EXACT8_PIPE_PASS");}
}
