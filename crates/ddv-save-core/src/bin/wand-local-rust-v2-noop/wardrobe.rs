//! Native-private exact1 Wardrobe pipe. No file overwrite or public Writer.
use super::*;
pub(super) fn run(){
    if env::args().len()!=2||required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||
       env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty()){
        deny("WARDROBE_EXACT_STEAM626_REQUIRED");
    }
    let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
    let backup=hex32(&required("WAND_LOCAL_BACKUP_SHA256"));
    let size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|deny("WARDROBE_ORIGINAL_SIZE"));
    let backup_size=required("WAND_LOCAL_BACKUP_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|deny("WARDROBE_BACKUP_SIZE"));
    if original==[0;32]||original!=backup||size==0||size>128*1024*1024||size!=backup_size{
        deny("WARDROBE_ORIGINAL_BACKUP_CAS");
    }
    let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
    let plan=required("WAND_LOCAL_WARDROBE_CANONICAL_PLAN");
    let plan_sha=hex32(&required("WAND_LOCAL_WARDROBE_PLAN_SHA256"));
    if plan.len()>8192||plan_sha==[0;32]||Sha256::digest(plan.as_bytes()).as_slice()!=plan_sha{
        deny("WARDROBE_PLAN_SHA_CAS");
    }
    let mut input=Vec::new();
    io::stdin().take(256*1024*1024+1).read_to_end(&mut input).unwrap_or_else(|_|deny("WARDROBE_PIPE_READ"));
    if input.is_empty()||input.len()>256*1024*1024||Sha256::digest(&input).as_slice()!=expected{
        deny("WARDROBE_SOURCE_CAS");
    }
    let s=ProductSession::open_decoded_readonly(input,BuildIdentity{
        platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),
        schema:626,externally_attested:true}).unwrap_or_else(|_|deny("WARDROBE_FULL_DOCUMENT"));
    let r=s.receipt().unwrap_or_else(|_|deny("WARDROBE_RECEIPT"));
    if r.writer_authorized||r.product_worker_bound||r.product_read_accepted||
       r.revision!=0||r.index_generation!=1||r.decoded_sha256!=expected{deny("WARDROBE_SESSION_SCOPE");}
    let scope=|rev,gen,action|WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:rev,expected_index_generation:gen,expected_decoded_sha256:expected,action};
    let t=s.mint_private_wardrobe_same_slot_target(scope(0,1,WorkerAction::ReadDomain),plan.as_bytes(),plan_sha)
        .unwrap_or_else(|_|deny("WARDROBE_TARGET"));
    let stage=s.stage_private_wardrobe_same_slot(scope(0,1,WorkerAction::Stage),&t).unwrap_or_else(|_|deny("WARDROBE_STAGE"));
    if stage.operation_count!=1||stage.exact_field_changed_count!=1||!stage.applied||!stage.semantic_changed||
       stage.product_writer_authorized||stage.original_overwrite_authorized{deny("WARDROBE_EXACT1");}
    if s.stage_private_wardrobe_same_slot(scope(0,1,WorkerAction::Stage),&t).is_ok(){deny("WARDROBE_REPLAY");}
    let undo=s.undo_typed_semantic_batch(scope(1,2,WorkerAction::Stage)).unwrap_or_else(|_|deny("WARDROBE_UNDO"));
    if undo.applied||s.take_typed_semantic_decoded_once(scope(2,3,WorkerAction::ExportEditedCopy)).is_ok(){deny("WARDROBE_UNDONE_EXPORT");}
    let redo=s.redo_typed_semantic_batch(scope(2,3,WorkerAction::Stage)).unwrap_or_else(|_|deny("WARDROBE_REDO"));
    if !redo.applied||redo.staged_decoded_sha256!=stage.staged_decoded_sha256{deny("WARDROBE_REDO_SHA");}
    let export=scope(3,4,WorkerAction::ExportEditedCopy);
    let out=s.take_typed_semantic_decoded_once(export).unwrap_or_else(|_|deny("WARDROBE_EXPORT"));
    if Sha256::digest(&out).as_slice()!=stage.staged_decoded_sha256||s.take_typed_semantic_decoded_once(export).is_ok(){deny("WARDROBE_EXPORT_REPLAY_OR_SHA");}
    io::stdout().write_all(&out).unwrap_or_else(|_|deny("WARDROBE_PIPE_WRITE"));
    io::stdout().flush().unwrap_or_else(|_|deny("WARDROBE_PIPE_FLUSH"));
    eprintln!("PRIVATE_STEAM626_WARDROBE_SAME_SLOT_EXACT1_PIPE_PASS");
}
