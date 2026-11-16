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
 if matches!(env::args().nth(1).as_deref(),Some("--switch624-road-rm01-archive-only"|"--switch624-fence-fe01-archive-only"|"--switch624-fence-frp01-archive-only"|"--switch624-fence-fm01-archive-only"|"--switch624-road-r02-native-q4-archive-only"|"--switch624-fence-ortho-l-archive-only"|"--switch624-fence-diagonal90-archive-only"|"--switch624-fence-ortho-t-archive-only"|"--switch624-fence-diagonal-n3-positive-archive-only"|"--switch624-fence-diagonal-n3-mirrored-archive-only"|"--switch624-fence-diagonal-n6-positive-archive-only"|"--switch626-fence-fd01-layout-only"|"--switch626-fence-fd02-layout-only"|"--switch626-fence-fd03-layout-only"|"--switch626-fence-ortho-l-layout-only"|"--switch626-fence-diagonal90-layout-only"|"--switch626-fence-ortho-t-layout-only"|"--switch626-road-r02-native-q4-only"|"--switch626-fence-fm01-layout-only"|"--switch626-road-rm01-native-mixed-q5-only"|"--switch626-fence-fe01-layout-only"|"--switch626-road-r01-orthogonal-q3-layout-only"|"--steam626-road-sr03-native-mixed-q5-only"|"--steam626-road-comp03-seed-merge-q9-only")){
   run_switch624_archive_operation();
   return;
 }

 #[cfg(all(feature="private-native-v1",feature="semantic-writer-dev",not(target_arch="wasm32")))]
 if env::args().nth(1).as_deref()==Some("--private-steam626-backpack-fruit-split-exact3-only"){backpack_split::run();return;}
 #[cfg(all(feature="private-native-v1",feature="semantic-writer-dev",not(target_arch="wasm32")))]
 if env::args().nth(1).as_deref()==Some("--private-switch626-backpack-fruit-split-exact3-only"){backpack_split::run_switch();return;}
 #[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
 if matches!(env::args().nth(1).as_deref(),Some("--switch626-collection-existing-bool-exact1-only"|"--steam626-collection-existing-bool-exact1-only")){
   run_collection_bool(env::args().nth(1).as_deref()==Some("--steam626-collection-existing-bool-exact1-only"));return;
 }
 #[cfg(feature="semantic-writer-dev")]
 if env::args().nth(1).as_deref()==Some("--private-steam626-catalog0-exact-lineage-restore-one-only") {
   run_catalog0_exact_lineage_restore();return;
 }
 #[cfg(feature="semantic-writer-dev")]
 if matches!(env::args().nth(1).as_deref(),Some("--inventory-amount-backup-only"|"--inventory-amount-restore-review-only")) {
   run_inventory_amount_backup(env::args().nth(1).as_deref()==Some("--inventory-amount-restore-review-only"));
   return;
 }
 #[cfg(feature="semantic-writer-dev")]
 if matches!(env::args().nth(1).as_deref(),
     Some("--semantic-inventory-existing-decrease-only"|
          "--semantic-chest-existing-decrease-only"|
          "--semantic-inventory-and-chest-decrease-only"|
          "--private-steam626-bound-chest-decrease-only"|
          "--private-switch626-bound-chest-decrease-only"|
          "--private-steam626-bound-catalog0-decrease-only")) {
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
 let bound_chest=args[1]=="--private-steam626-bound-chest-decrease-only";
 let bound_furniture=args[1]=="--private-steam626-bound-catalog0-decrease-only";
 let switch_chest=args[1]=="--private-switch626-bound-chest-decrease-only";
 let bound=bound_chest||bound_furniture||switch_chest;
 let inventory=matches!(args[1].as_str(),
     "--semantic-inventory-existing-decrease-only"|
     "--semantic-inventory-and-chest-decrease-only");
 let chest=matches!(args[1].as_str(),
     "--semantic-chest-existing-decrease-only"|
     "--semantic-inventory-and-chest-decrease-only");
 if !inventory&&!chest&&!bound{deny("SEMANTIC_COMMAND_NOT_ALLOWLISTED");}
 if switch_chest{
   if required("WAND_LOCAL_INSTALLED_SWITCH_BID")!="9A239D3DB569756D"||
      env::var_os("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION").is_some_and(|v|!v.is_empty()){
      deny("SEMANTIC_EXACT_EXTERNAL_SWITCH_BUILD_REQUIRED");
   }
 }else if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||
    (bound&&env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty())){
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
 let build=if switch_chest{BuildIdentity{platform:Platform::Switch,
   build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}}
   else{BuildIdentity{platform:Platform::SteamWindows,
   build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}};
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
 let candidate=if bound{
   let backup=hex32(&required("WAND_LOCAL_BACKUP_SHA256"));
   let backup_size=required("WAND_LOCAL_BACKUP_SIZE_BYTES").parse::<u64>()
      .unwrap_or_else(|_|deny("PRIVATE_AMOUNT_BACKUP_SIZE"));
   let plan=required("WAND_LOCAL_PRIVATE_AMOUNT_PLAN");
   let plan_sha=hex32(&required("WAND_LOCAL_PRIVATE_AMOUNT_PLAN_SHA256"));
   if plan.len()>8192||plan_sha==[0;32]||Sha256::digest(plan.as_bytes()).as_slice()!=plan_sha{
       deny("PRIVATE_AMOUNT_PLAN_SHA");
   }
   let e=scope(0,1,WorkerAction::ReadDomain);
   Some((if switch_chest{session.mint_private_switch626_bound_chest_candidate(e,plan.as_bytes(),
       original_sha,source_size,backup,backup_size)}else{session.mint_private_bound_amount_candidate(e,plan.as_bytes(),
       original_sha,source_size,backup,backup_size,bound_chest)}).unwrap_or_else(|_|deny("PRIVATE_AMOUNT_WITNESS_DENIED")))
 }else{None};
 let stage=|e|if let Some(c)=&candidate{if switch_chest{session.stage_private_switch626_bound_chest_candidate(e,c)}
      else{session.stage_private_bound_amount_candidate(e,c)}}
      else{session.stage_typed_semantic_batch(e,&cmds)};
 let staged=stage(scope(0,1,WorkerAction::Stage)).unwrap_or_else(|_|deny("SEMANTIC_TYPED_STAGE_DENIED"));
 let expected_count=if bound{1}else{cmds.len()};
 if staged.revision!=1||staged.index_generation!=2||
   !staged.applied||!staged.semantic_changed||
   staged.operation_count!=expected_count||staged.exact_field_changed_count!=expected_count||staged.product_writer_authorized||
   staged.native_v3_verified||staged.staged_decoded_sha256==expected{
     deny("SEMANTIC_ATOMIC_DIFF_INVARIANT");
 }
 if stage(scope(0,1,WorkerAction::Stage)).is_ok(){
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
 if switch_chest{eprintln!("PRIVATE_SWITCH626_CORE_BOUND_CHEST_EXACT1_PIPE_PASS");}
 else if bound{eprintln!("PRIVATE_STEAM626_CORE_BOUND_AMOUNT_EXACT1_PIPE_PASS");}
 else{eprintln!("PRIVATE_V2_RUST_REAL_AMOUNT_SEMANTIC_CHANGE_CAS_ATOMIC_UNDO_REDO_ONE_TIME_PIPE_PASS");}
}

// Existing private executor, new read-only bounded file-format operation.
// A caller must capture stdout into its local exclusive output file, NOT a
// console/log. Original encrypted backup/codec verification remain external.
#[cfg(feature="semantic-writer-dev")]
fn run_inventory_amount_backup(review_only:bool){
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
 let selector=|name:&str,allow_zero:bool|->u32{
   let text=required(name);
   let id=text.parse::<u32>().ok().filter(|v|allow_zero||*v>0)
     .unwrap_or_else(||deny("BACKUP_SELECTOR_ID"));
   if id.to_string()!=text{deny("BACKUP_SELECTOR_ID");}
   id
 };
 let inventory_id=selector("WAND_LOCAL_INVENTORY_ID",true);
 let item_id=selector("WAND_LOCAL_CANONICAL_ITEM_ID",false);
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
 if review_only{
   // The same typed Restore review is advisory, never a stage command.
   // External operator binds original target/lineage, not a caller hash as authority.
   let bytes=read_restore_backup(WAND_BACKUP_MAX_BYTES);
   let backup=decode_inventory_amount_backup(&bytes).unwrap_or_else(|_|deny("RESTORE_BACKUP_INVALID"));
   let backup_source=hex32(&required("WAND_LOCAL_RESTORE_BACKUP_SOURCE_SHA256"));
   let backup_entry=hex32(&required("WAND_LOCAL_RESTORE_BACKUP_ENTRY_SHA256"));
   let current_entry=hex32(&required("WAND_LOCAL_RESTORE_CURRENT_ENTRY_SHA256"));
   let old_text=required("WAND_LOCAL_RESTORE_EXPECTED_CURRENT_AMOUNT");
   let old=old_text.parse::<u32>().ok().filter(|n|*n>0&&*n<=9999&&n.to_string()==old_text)
      .unwrap_or_else(||deny("RESTORE_CURRENT_AMOUNT"));
   let hex=|b:&[u8]|b.iter().map(|v|format!("{v:02x}")).collect::<String>();
   if backup_source==[0;32]||backup_entry==[0;32]||current_entry==[0;32]||
      backup.source_decoded_sha256!=hex(&backup_source)||backup.payload["entrySha256"]!=hex(&backup_entry){
     deny("RESTORE_BACKUP_ORIGINAL_BINDING");
   }
   let v=session.review_inventory_amount_restore(e,&bytes,inventory_id,item_id)
      .unwrap_or_else(|_|deny("RESTORE_TARGET_DENIED"));
   if v.inventory_id!=inventory_id||v.item_id!=item_id||v.current_amount!=old||
      v.current_entry_sha256!=current_entry||v.current_decoded_sha256!=expected||
      v.session_id!=before.session_id||v.revision!=before.revision||v.index_generation!=before.index_generation||
      v.backup_amount!=backup.amount||v.backup_decoded_sha256!=hex(&backup_source)||
      v.backup_entry_sha256!=hex(&backup_entry)||session.receipt().ok()!=Some(before){
     deny("RESTORE_CURRENT_TARGET_CAS");
   }
   let same_source=expected==backup_source;
   if same_source&&(current_entry!=backup_entry||old!=backup.amount){deny("RESTORE_SAME_SOURCE_CONTRADICTION");}
   let disposition=match v.disposition{
     ddv_save_core::portable_backup::InventoryRestoreDisposition::AlreadyMatches=>"AlreadyMatches",
     ddv_save_core::portable_backup::InventoryRestoreDisposition::PositiveDecreaseCandidate=>"PositiveDecreaseCandidate",
     ddv_save_core::portable_backup::InventoryRestoreDisposition::IncreaseUnsupported=>"IncreaseUnsupported",
   };
   let out=serde_json::to_vec(&serde_json::json!({
      "contract":"wand.native.private.inventory-restore-review@1","platform":"SteamWindows",
      "fullVersion":STEAM,"schema":626,"target":{"inventoryId":inventory_id,"itemId":item_id},
      "backupSha256":hex(&Sha256::digest(&bytes)),"backupDecodedSha256":v.backup_decoded_sha256,
      "backupEntrySha256":v.backup_entry_sha256,"backupAmount":v.backup_amount,
      "currentDecodedSha256":hex(&v.current_decoded_sha256),"currentEntrySha256":hex(&v.current_entry_sha256),
      "currentAmount":v.current_amount,"sessionId":hex(&v.session_id),"revision":v.revision,
      "indexGeneration":v.index_generation,"sameSourceDecoded":same_source,"disposition":disposition,
      "originalSha256SuppliedExternally":hex(&original),"originalSizeBytesSuppliedExternally":original_size,
      "originalTargetLineageVerified":false,"rightsVerified":false,"writerAuthorized":false,
      "applyAuthorized":false,"editedCopyAuthorized":false,"nativeV3Verified":false
   })).unwrap_or_else(|_|deny("RESTORE_REVIEW_ENCODE"));
   session.close().unwrap_or_else(|_|deny("RESTORE_SESSION_CLOSE"));
   io::stdout().write_all(&out).unwrap_or_else(|_|deny("RESTORE_PRIVATE_PIPE_WRITE"));
   io::stdout().flush().unwrap_or_else(|_|deny("RESTORE_PRIVATE_PIPE_FLUSH"));
   eprintln!("PRIVATE_V2_INVENTORY_RESTORE_REVIEW_READONLY_PIPE_PASS");
   return;
 }
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

// Explicit local read only, pinned expected bytes; no alternate target Apply.
#[cfg(feature="semantic-writer-dev")]
fn read_restore_backup(max:usize)->Vec<u8>{
 read_restore_pinned("WAND_LOCAL_RESTORE_BACKUP_PATH","WAND_LOCAL_RESTORE_BACKUP_SHA256",max)
}
#[cfg(feature="semantic-writer-dev")]
fn read_restore_pinned(path_key:&str,sha_key:&str,max:usize)->Vec<u8>{
 let path=required(path_key);
 let p=std::path::Path::new(&path);
 if !p.is_absolute(){deny("RESTORE_BACKUP_ABSOLUTE_REQUIRED");}
 let expected=hex32(&required(sha_key));
 if expected==[0;32]{deny("RESTORE_BACKUP_SHA");}
 let mut options=std::fs::OpenOptions::new();options.read(true);
 // Precheck regular file and reject final symlinks. Linux nonblocking +
 // nofollow prevents a race into a FIFO from hanging the private runner.
 let pre=std::fs::symlink_metadata(p).unwrap_or_else(|_|deny("RESTORE_BACKUP_METADATA"));
 if !pre.is_file()||pre.len()==0||pre.len()>max as u64{deny("RESTORE_BACKUP_SIZE");}
 #[cfg(target_os="linux")]{
   use std::os::unix::fs::OpenOptionsExt;
   options.custom_flags(0x20000|0x800);
 }
 let file=options.open(p).unwrap_or_else(|_|deny("RESTORE_BACKUP_OPEN"));
 let meta=file.metadata().unwrap_or_else(|_|deny("RESTORE_BACKUP_METADATA"));
 if !meta.is_file()||meta.len()==0||meta.len()>max as u64{deny("RESTORE_BACKUP_SIZE");}
 let mut bytes=Vec::new();
 file.take(max as u64+1).read_to_end(&mut bytes).unwrap_or_else(|_|deny("RESTORE_BACKUP_READ"));
 if bytes.len() as u64!=meta.len()||Sha256::digest(&bytes).as_slice()!=expected{
   deny("RESTORE_BACKUP_SHA_CAS");
 }
 bytes
}

#[cfg(feature="semantic-writer-dev")]
fn run_catalog0_exact_lineage_restore(){
 const MAX:usize=256*1024*1024;
 if env::args_os().count()!=2||required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||
    env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty()){
   deny("RESTORE_EXACT_EXTERNAL_STEAM_BUILD_REQUIRED");
 }
 let current=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let backup=hex32(&required("WAND_LOCAL_BACKUP_SHA256"));
 let ancestor=hex32(&required("WAND_LOCAL_RESTORE_ANCESTOR_PACKAGED_SHA256"));
 let size=|k:&str|required(k).parse::<u64>().unwrap_or_else(|_|deny("RESTORE_PACKAGED_SIZE"));
 let current_size=size("WAND_LOCAL_ORIGINAL_SIZE_BYTES");
 let backup_size=size("WAND_LOCAL_BACKUP_SIZE_BYTES");
 let ancestor_size=size("WAND_LOCAL_RESTORE_ANCESTOR_PACKAGED_SIZE_BYTES");
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let plan=read_restore_pinned("WAND_LOCAL_RESTORE_PLAN_PATH","WAND_LOCAL_RESTORE_PLAN_SHA256",8192);
 let original=read_restore_pinned("WAND_LOCAL_RESTORE_ANCESTOR_DECODED_PATH","WAND_LOCAL_RESTORE_ANCESTOR_DECODED_SHA256",MAX);
 let portable=read_restore_backup(ddv_save_core::portable_backup::WAND_BACKUP_MAX_BYTES);
 let mut input=Vec::new();
 io::stdin().take(MAX as u64+1).read_to_end(&mut input).unwrap_or_else(|_|deny("RESTORE_PRIVATE_PIPE_READ"));
 if input.is_empty()||input.len()>MAX||Sha256::digest(&input).as_slice()!=expected{deny("RESTORE_SOURCE_SHA_CAS");}
 let session=ProductSession::open_decoded_readonly(input,BuildIdentity{
   platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
   build_id:STEAM.into(),schema:626,externally_attested:true}).unwrap_or_else(|_|deny("RESTORE_FULL_DOCUMENT"));
 let before=session.receipt().unwrap_or_else(|_|deny("RESTORE_RECEIPT"));
 if before.decoded_sha256!=expected||before.revision!=0||before.index_generation!=1||
    before.product_worker_bound||before.writer_authorized||before.apply_authorized||before.edited_copy_authorized{
    deny("RESTORE_SOURCE_SCOPE");
 }
 let e=|rev,gen,action|WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:before.session_id,
   expected_revision:rev,expected_index_generation:gen,expected_decoded_sha256:expected,action};
 let staged=session.stage_private_catalog0_exact_lineage_restore(e(0,1,WorkerAction::Stage),&portable,&original,&plan,
     current,current_size,backup,backup_size,ancestor,ancestor_size).unwrap_or_else(|_|deny("RESTORE_STAGE_DENIED"));
 if staged.operation_count!=1||staged.exact_field_changed_count!=1||!staged.applied||
    staged.product_writer_authorized||staged.original_overwrite_authorized||
    staged.staged_decoded_sha256.as_slice()!=Sha256::digest(&original).as_slice(){
   deny("RESTORE_STAGE_RECEIPT");
 }
 if session.undo_typed_semantic_batch(e(0,1,WorkerAction::Stage)).is_ok(){deny("RESTORE_STALE_UNDO");}
 let undone=session.undo_typed_semantic_batch(e(1,2,WorkerAction::Stage)).unwrap_or_else(|_|deny("RESTORE_UNDO"));
 if undone.applied||session.take_typed_semantic_decoded_once(e(2,3,WorkerAction::ExportEditedCopy)).is_ok(){deny("RESTORE_UNDO_EXPORT");}
 let redone=session.redo_typed_semantic_batch(e(2,3,WorkerAction::Stage)).unwrap_or_else(|_|deny("RESTORE_REDO"));
 if !redone.applied{deny("RESTORE_REDO_RECEIPT");}
 let out=session.take_typed_semantic_decoded_once(e(3,4,WorkerAction::ExportEditedCopy)).unwrap_or_else(|_|deny("RESTORE_EXPORT"));
 if out!=original||session.take_typed_semantic_decoded_once(e(3,4,WorkerAction::ExportEditedCopy)).is_ok(){deny("RESTORE_OUTPUT_OR_REPLAY");}
 io::stdout().write_all(&out).unwrap_or_else(|_|deny("RESTORE_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("RESTORE_PIPE_FLUSH"));
 eprintln!("PRIVATE_CATALOG0_EXACT_LINEAGE_RESTORE_ONE_PIPE_PASS");
}

#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
fn run_collection_bool(steam:bool){
 if env::args_os().count()!=2{deny("COLLECTION_EXPLICIT_MODE_REQUIRED")}
 if steam{
   if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||
      env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty()){
      deny("COLLECTION_EXACT_STEAM626_REQUIRED")
   }
 }else if required("WAND_LOCAL_INSTALLED_SWITCH_BID")!="9A239D3DB569756D"||
    env::var_os("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION").is_some_and(|v|!v.is_empty()){
    deny("COLLECTION_EXACT_SWITCH626_REQUIRED")
 }
 let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|deny("ORIGINAL_SIZE_REQUIRED"));
 if original==[0;32]||size==0||size>128*1024*1024{deny("ORIGINAL_BOUNDS")}
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let plan=required("WAND_LOCAL_COLLECTION_EXACT_PLAN");
 if steam{
   let backup=hex32(&required("WAND_LOCAL_BACKUP_SHA256"));
   let backup_size=required("WAND_LOCAL_BACKUP_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|deny("COLLECTION_BACKUP_SIZE"));
   let plan_sha=hex32(&required("WAND_LOCAL_COLLECTION_EXACT_PLAN_SHA256"));
   if backup!=original||backup_size!=size||plan.len()>8192||plan_sha==[0;32]||Sha256::digest(plan.as_bytes()).as_slice()!=plan_sha{
      deny("COLLECTION_BACKUP_OR_PLAN_BINDING")
   }
 }
 let mut input=Vec::new();
 io::stdin().take(256*1024*1024+1).read_to_end(&mut input).unwrap_or_else(|_|deny("COLLECTION_PIPE_READ"));
 if input.is_empty()||input.len()>256*1024*1024||Sha256::digest(&input).as_slice()!=expected{
    deny("COLLECTION_DECODED_CAS")
 }
 let build=if steam{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
    build_id:STEAM.into(),schema:626,externally_attested:true}}else{BuildIdentity{platform:Platform::Switch,
    build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}};
 let s=ProductSession::open_decoded_readonly(input,build)
    .unwrap_or_else(|_|deny("COLLECTION_FULL_DOCUMENT"));
 let r=s.receipt().unwrap_or_else(|_|deny("COLLECTION_SESSION"));
 if r.writer_authorized||r.product_worker_bound||r.product_read_accepted||r.revision!=0||r.index_generation!=1||r.decoded_sha256!=expected{
    deny("COLLECTION_SESSION_SCOPE")
 }
 let scope=|rev,gen,action|WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
    expected_revision:rev,expected_index_generation:gen,expected_decoded_sha256:expected,action};
 let read=scope(0,1,WorkerAction::ReadDomain);
 let target=(if steam{s.mint_private_steam626_collection_target(read,plan.as_bytes())}
    else{s.mint_private_switch626_collection_target(read,plan.as_bytes())})
    .unwrap_or_else(|_|deny("COLLECTION_TARGET_PLAN"));
 let stage_once=|e|if steam{s.stage_private_steam626_collection_bool(e,&target)}
    else{s.stage_private_switch626_collection_bool(e,&target)};
 let stage=stage_once(scope(0,1,WorkerAction::Stage)).unwrap_or_else(|_|deny("COLLECTION_STAGE"));
 if stage.operation_count!=1||stage.exact_field_changed_count!=1||!stage.applied||
    stage.product_writer_authorized||stage.original_overwrite_authorized||!stage.semantic_changed{
    deny("COLLECTION_EXACT1_RECEIPT")
 }
 if stage_once(scope(0,1,WorkerAction::Stage)).is_ok(){deny("COLLECTION_REPLAY")}
 s.undo_typed_semantic_batch(scope(1,2,WorkerAction::Stage)).unwrap_or_else(|_|deny("COLLECTION_UNDO"));
 if s.take_typed_semantic_decoded_once(scope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){deny("COLLECTION_UNDONE_EXPORT")}
 s.redo_typed_semantic_batch(scope(2,3,WorkerAction::Stage)).unwrap_or_else(|_|deny("COLLECTION_REDO"));
 let out=s.take_typed_semantic_decoded_once(scope(3,4,WorkerAction::ExportEditedCopy)).unwrap_or_else(|_|deny("COLLECTION_EXPORT"));
 if Sha256::digest(&out).as_slice()!=stage.staged_decoded_sha256||
    s.take_typed_semantic_decoded_once(scope(3,4,WorkerAction::ExportEditedCopy)).is_ok(){deny("COLLECTION_EXPORT_REPLAY_OR_SHA")}
 io::stdout().write_all(&out).unwrap_or_else(|_|deny("COLLECTION_PIPE_WRITE"));
 io::stdout().flush().unwrap_or_else(|_|deny("COLLECTION_PIPE_FLUSH"));
 if steam{eprintln!("PRIVATE_STEAM626_COLLECTION_EXISTING_BOOL_EXACT1_PIPE_PASS");}
 else{eprintln!("PRIVATE_SWITCH626_COLLECTION_EXISTING_BOOL_EXACT1_PIPE_PASS");}
}

// Same private executor and atomic ledger. External trusted operator verifies
// archive/original/Backup and independently approved 01B/01C/01E plan.
#[cfg(feature="semantic-writer-dev")]
fn run_switch624_archive_operation(){
 let mode=env::args().nth(1).unwrap_or_default();
 let fence=mode=="--switch624-fence-fe01-archive-only";
 let frp=mode=="--switch624-fence-frp01-archive-only";
 let fm=mode=="--switch624-fence-fm01-archive-only";
 let r02=mode=="--switch624-road-r02-native-q4-archive-only";
 let add_l=mode=="--switch624-fence-ortho-l-archive-only";
 let add_d90=mode=="--switch624-fence-diagonal90-archive-only";
 let add_t=mode=="--switch624-fence-ortho-t-archive-only";
 let add_n3p=mode=="--switch624-fence-diagonal-n3-positive-archive-only";
 let add_n3m=mode=="--switch624-fence-diagonal-n3-mirrored-archive-only";
 let add_n6p=mode=="--switch624-fence-diagonal-n6-positive-archive-only";
 let add_diag_a=add_n3p||add_n3m||add_n6p;
 let fd01=mode=="--switch626-fence-fd01-layout-only";
 let fd02=mode=="--switch626-fence-fd02-layout-only";
 let fd03=mode=="--switch626-fence-fd03-layout-only";
 let l626=mode=="--switch626-fence-ortho-l-layout-only";
 let d90626=mode=="--switch626-fence-diagonal90-layout-only";
 let t626=mode=="--switch626-fence-ortho-t-layout-only";
 let nonstraight626=l626||d90626||t626;
 let r02626=mode=="--switch626-road-r02-native-q4-only";
 let fm626=mode=="--switch626-fence-fm01-layout-only";
 let rm626=mode=="--switch626-road-rm01-native-mixed-q5-only";
 let fe626=mode=="--switch626-fence-fe01-layout-only";
 let r01626=mode=="--switch626-road-r01-orthogonal-q3-layout-only";
 let sr03=mode=="--steam626-road-sr03-native-mixed-q5-only";
 let comp03=mode=="--steam626-road-comp03-seed-merge-q9-only";
 let current=fd01||fd02||fd03||nonstraight626||r02626||fm626||rm626||fe626||r01626||sr03||comp03;
 let add_fence=add_l||add_d90||add_t||add_diag_a||fd01||fd02||fd03||nonstraight626;
 let (bid,schema)=if current{("9A239D3DB569756D",626)}else{("52BD625D9B4E0053",624)};
 if sr03||comp03{
    if env::args().len()!=2||required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty()){deny("SR03_EXACT_STEAM626_REQUIRED");}
 }else if env::args().len()!=2||required("WAND_LOCAL_INSTALLED_SWITCH_BID")!=bid||
    (current&&env::var_os("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION").is_some_and(|v|!v.is_empty())){
   deny(if r01626{"R01_EXACT_SWITCH626_REQUIRED"}else if fd01{"FD01_EXACT_SWITCH626_REQUIRED"}else if fd02{"FD02_EXACT_SWITCH626_REQUIRED"}else if fd03{"FD03_EXACT_SWITCH626_REQUIRED"}else if nonstraight626{"FENCE_NONSTRAIGHT_EXACT_SWITCH626_REQUIRED"}else if r02626{"R02_EXACT_SWITCH626_REQUIRED"}else if fm626{"FM01_EXACT_SWITCH626_REQUIRED"}else if rm626{"RM01_EXACT_SWITCH626_REQUIRED"}else if fe626{"FE01_EXACT_SWITCH626_REQUIRED"}else{"RM01_EXACT_SWITCH624_REQUIRED"});
 }
 let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
 let size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
    .unwrap_or_else(|_|deny("RM01_ORIGINAL_SIZE"));
 if original==[0;32]||size==0||size>128*1024*1024{deny("RM01_ORIGINAL_ATTESTATION");}
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let plan=required(if comp03{"WAND_LOCAL_COMP03_CANONICAL_PLAN"}else if sr03{"WAND_LOCAL_SR03_CANONICAL_PLAN"}else if r01626{"WAND_LOCAL_R01_CANONICAL_PLAN"}else if add_fence{"WAND_LOCAL_FENCE_ADD_CANONICAL_PLAN"}else if r02||r02626{"WAND_LOCAL_R02_CANONICAL_PLAN"}else if frp{"WAND_LOCAL_FRP01_CANONICAL_PLAN"}else if fm||fm626{"WAND_LOCAL_FM01_CANONICAL_PLAN"}
    else if fence||fe626{"WAND_LOCAL_FE01_CANONICAL_PLAN"}else{"WAND_LOCAL_RM01_CANONICAL_PLAN"});
 if plan.len()>16384{deny("RM01_PLAN_BOUNDS");}
 let plan_sha=hex32(&required(if comp03{"WAND_LOCAL_COMP03_PLAN_SHA256"}else if sr03{"WAND_LOCAL_SR03_PLAN_SHA256"}else if r01626{"WAND_LOCAL_R01_PLAN_SHA256"}else if add_fence{"WAND_LOCAL_FENCE_ADD_PLAN_SHA256"}else if r02||r02626{"WAND_LOCAL_R02_PLAN_SHA256"}else if frp{"WAND_LOCAL_FRP01_PLAN_SHA256"}else if fm||fm626{"WAND_LOCAL_FM01_PLAN_SHA256"}
    else if fence||fe626{"WAND_LOCAL_FE01_PLAN_SHA256"}else{"WAND_LOCAL_RM01_PLAN_SHA256"}));
 if plan_sha==[0;32]||Sha256::digest(plan.as_bytes()).as_slice()!=plan_sha{deny("RM01_PLAN_SHA_CAS");}
 let mut input=Vec::new();
 io::stdin().take(256*1024*1024+1).read_to_end(&mut input)
   .unwrap_or_else(|_|deny("RM01_PRIVATE_PIPE_READ"));
 let build=if sr03||comp03{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}}else{BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
    build_id:bid.into(),schema,externally_attested:true}};
 let session=if current{ProductSession::open_decoded_readonly(input,build)}
   else if fence||frp||fm||add_fence{ProductSession::open_switch624_fe01_private(input,build,expected)}
   else{ProductSession::open_switch624_rm01_private(input,build,expected)}
   .unwrap_or_else(|_|deny("RM01_FULL_DOCUMENT_OR_ARCHIVE"));
 let before=session.receipt().unwrap_or_else(|_|deny("RM01_RECEIPT"));
 if before.schema!=schema||before.decoded_sha256!=expected||before.writer_authorized||
    before.product_worker_bound||before.product_read_accepted||before.revision!=0||before.index_generation!=1{
   deny("RM01_SOURCE_SCOPE");
 }
 let scope=|rev,gen,action|WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
    session_id:before.session_id,expected_revision:rev,expected_index_generation:gen,
    expected_decoded_sha256:expected,action};
 let stage=|e|if comp03{session.stage_steam626_road_comp03_seed_merge_q9(e,plan.as_bytes())}else if sr03{session.stage_steam626_road_sr03_native_mixed_q5(e,plan.as_bytes())}else if r01626{session.stage_switch626_road_r01_orthogonal_q3(e,plan.as_bytes())}else if rm626{session.stage_switch626_road_rm01_native_mixed_q5(e,plan.as_bytes())}else if fe626{session.stage_switch626_fence_fe01_layout(e,plan.as_bytes())}else if r02626{session.stage_switch626_road_r02_native_q4(e,plan.as_bytes())}else if fm626{session.stage_switch626_fence_fm01_layout(e,plan.as_bytes())}else if l626{session.stage_switch626_fence_ortho_l_layout(e,plan.as_bytes())}else if d90626{session.stage_switch626_fence_diagonal90_layout(e,plan.as_bytes())}else if t626{session.stage_switch626_fence_ortho_t_layout(e,plan.as_bytes())}else if fd02{session.stage_switch626_fence_fd02_layout(e,plan.as_bytes())}else if fd03{session.stage_switch626_fence_fd03_layout(e,plan.as_bytes())}else if fd01{session.stage_switch626_fence_fd01_layout(e,plan.as_bytes())}
     else if add_n3p{session.stage_switch624_fence_diagonal_n3_positive_archive(e,plan.as_bytes())}
     else if add_n3m{session.stage_switch624_fence_diagonal_n3_mirrored_archive(e,plan.as_bytes())}
     else if add_n6p{session.stage_switch624_fence_diagonal_n6_positive_archive(e,plan.as_bytes())}
     else if add_l{session.stage_switch624_fence_ortho_l_archive(e,plan.as_bytes())}
     else if add_d90{session.stage_switch624_fence_diagonal90_archive(e,plan.as_bytes())}
     else if add_t{session.stage_switch624_fence_ortho_t_archive(e,plan.as_bytes())}
     else if r02{session.stage_switch624_road_r02_native_q4_archive(e,plan.as_bytes())}
     else if frp{session.stage_switch624_fence_frp01_archive(e,plan.as_bytes())}
     else if fm{session.stage_switch624_fence_fm01_archive(e,plan.as_bytes())}
     else if fence{session.stage_switch624_fence_fe01_archive(e,plan.as_bytes())}
     else{session.stage_switch624_road_rm01_archive(e,plan.as_bytes())};
 let staged=stage(scope(0,1,WorkerAction::Stage)).unwrap_or_else(|_|deny("RM01_STAGE"));
 let count=if comp03{9}else if r01626{4}else if l626||d90626||r02626{6}else if t626||fm626||rm626||sr03{8}else if fe626{7}else if current||add_diag_a{4}else if r02||add_l||add_d90{6}else if fence||frp{7}else{8};
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
 if comp03{eprintln!("PRIVATE_V2_STEAM626_COMP03_SEED_MERGE_Q9_EXACT9_PIPE_PASS");}else if sr03{eprintln!("PRIVATE_V2_STEAM626_SR03_NATIVE_MIXED_Q5_EXACT8_PIPE_PASS");}else if r01626{eprintln!("PRIVATE_V2_SWITCH626_R01_ORTHOGONAL_Q3_EXACT4_PIPE_PASS");}else if rm626{eprintln!("PRIVATE_V2_SWITCH626_RM01_NATIVE_MIXED_Q5_EXACT8_PIPE_PASS");}else if fe626{eprintln!("PRIVATE_V2_SWITCH626_FE01_PRESERVE7_PIPE_PASS");}else if r02626{eprintln!("PRIVATE_V2_SWITCH626_R02_NATIVE_Q4_EXACT6_PIPE_PASS");}else if fm626{eprintln!("PRIVATE_V2_SWITCH626_FM01_PRESERVE8_PIPE_PASS");}else if l626{eprintln!("PRIVATE_V2_SWITCH626_FENCE_ORTHO_L_EXACT6_PIPE_PASS");}else if d90626{eprintln!("PRIVATE_V2_SWITCH626_FENCE_DIAGONAL90_EXACT6_PIPE_PASS");}else if t626{eprintln!("PRIVATE_V2_SWITCH626_FENCE_ORTHO_T_EXACT8_PIPE_PASS");}else if fd02{eprintln!("PRIVATE_V2_SWITCH626_FENCE_FD02_EXACT4_PIPE_PASS");}else if fd03{eprintln!("PRIVATE_V2_SWITCH626_FENCE_FD03_EXACT4_PIPE_PASS");}else if fd01{eprintln!("PRIVATE_V2_SWITCH626_FENCE_FD01_EXACT4_PIPE_PASS");}
 else if add_n3p{eprintln!("PRIVATE_V2_SWITCH624_FENCE_DIAGONAL_N3_POSITIVE_EXACT4_PIPE_PASS");}
 else if add_n3m{eprintln!("PRIVATE_V2_SWITCH624_FENCE_DIAGONAL_N3_MIRRORED_EXACT4_PIPE_PASS");}
 else if add_n6p{eprintln!("PRIVATE_V2_SWITCH624_FENCE_DIAGONAL_N6_POSITIVE_EXACT4_PIPE_PASS");}
 else if add_l{eprintln!("PRIVATE_V2_SWITCH624_FENCE_ORTHO_L_EXACT6_PIPE_PASS");}
 else if add_d90{eprintln!("PRIVATE_V2_SWITCH624_FENCE_DIAGONAL90_EXACT6_PIPE_PASS");}
 else if add_t{eprintln!("PRIVATE_V2_SWITCH624_FENCE_ORTHO_T_EXACT8_PIPE_PASS");}
 else if r02{eprintln!("PRIVATE_V2_SWITCH624_R02_NATIVE_Q4_EXACT6_PIPE_PASS");}
 else if frp{eprintln!("PRIVATE_V2_SWITCH624_FRP01_ARCHIVE_EXACT7_PIPE_PASS");}
 else if fm{eprintln!("PRIVATE_V2_SWITCH624_FM01_ARCHIVE_PRESERVE8_PIPE_PASS");}
 else if fence{eprintln!("PRIVATE_V2_SWITCH624_FE01_ARCHIVE_PRESERVE7_PIPE_PASS");}
 else{eprintln!("PRIVATE_V2_SWITCH624_RM01_ARCHIVE_EXACT8_PIPE_PASS");}
}

#[cfg(all(feature="private-native-v1",feature="semantic-writer-dev",not(target_arch="wasm32")))]
#[path="private_ops/backpack_split.rs"]
mod backpack_split;
