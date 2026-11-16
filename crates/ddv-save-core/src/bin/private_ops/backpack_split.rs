//! Existing private V2 executor dispatch; no public Worker route or key handling.
use super::*;
const SWITCH_BID:&str="9A239D3DB569756D";
pub(super) fn run(){run_mode(false)}
pub(super) fn run_switch(){run_mode(true)}
fn run_mode(switch:bool){
 if env::args_os().count()!=2{deny("BACKPACK_SPLIT_BUILD")}
 if switch {
   if required("WAND_LOCAL_INSTALLED_SWITCH_BID")!=SWITCH_BID||
      env::var_os("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION").is_some_and(|v|!v.is_empty()){deny("BACKPACK_SPLIT_BUILD")}
 }else if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=STEAM||
    env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|v|!v.is_empty()){deny("BACKPACK_SPLIT_BUILD")}
 let original=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));let backup=hex32(&required("WAND_LOCAL_BACKUP_SHA256"));
 let size=|k|required(k).parse::<u64>().unwrap_or_else(|_|deny("BACKPACK_SPLIT_SIZE"));
 let n=size("WAND_LOCAL_ORIGINAL_SIZE_BYTES");
 if original==[0;32]||original!=backup||n==0||n>128*1024*1024||n!=size("WAND_LOCAL_BACKUP_SIZE_BYTES"){deny("BACKPACK_SPLIT_BACKUP")}
 let expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
 let plan=required("WAND_LOCAL_BACKPACK_SPLIT_PLAN");let ph=hex32(&required("WAND_LOCAL_BACKPACK_SPLIT_PLAN_SHA256"));
 if plan.len()>8192||<[u8;32]>::from(Sha256::digest(plan.as_bytes()))!=ph{deny("BACKPACK_SPLIT_PLAN")}
 let mut bytes=Vec::new();if io::stdin().take(256*1024*1024+1).read_to_end(&mut bytes).is_err()||
     bytes.len()>256*1024*1024||<[u8;32]>::from(Sha256::digest(&bytes))!=expected{deny("BACKPACK_SPLIT_SOURCE")}
 let s=ProductSession::open_decoded_readonly(bytes,BuildIdentity{platform:if switch{Platform::Switch}else{Platform::SteamWindows},
     build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
     build_id:(if switch{SWITCH_BID}else{STEAM}).into(),schema:626,externally_attested:true}).unwrap_or_else(|_|deny("BACKPACK_SPLIT_OPEN"));
 let scope=|action|{let r=s.receipt().unwrap_or_else(|_|deny("BACKPACK_SPLIT_RECEIPT"));WorkerEnvelope{
     contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
     expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}};
 let e=scope(WorkerAction::Stage);
 let stage=|e|if switch{s.stage_private_switch626_backpack_fruit_split_exact3(e,plan.as_bytes())}
     else{s.stage_private_steam626_backpack_fruit_split_exact3(e,plan.as_bytes())};
 let r=stage(e).unwrap_or_else(|_|deny("BACKPACK_SPLIT_STAGE"));
 let count=3;
 if r.operation_count!=count||r.exact_field_changed_count!=count||r.product_writer_authorized||r.original_overwrite_authorized||
     r.revision!=1||r.index_generation!=2||stage(e).is_ok(){deny("BACKPACK_SPLIT_STAGE_RECEIPT")}
 if s.undo_typed_semantic_batch(scope(WorkerAction::Stage)).is_err()||
     s.take_typed_semantic_decoded_once(scope(WorkerAction::ExportEditedCopy)).is_ok(){deny("BACKPACK_SPLIT_UNDO")}
 if s.redo_typed_semantic_batch(scope(WorkerAction::Stage)).is_err(){deny("BACKPACK_SPLIT_REDO")}
 let ex=scope(WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap_or_else(|_|deny("BACKPACK_SPLIT_EXPORT"));
 if <[u8;32]>::from(Sha256::digest(&out))!=r.staged_decoded_sha256||s.take_typed_semantic_decoded_once(ex).is_ok(){deny("BACKPACK_SPLIT_EXPORT_RECEIPT")}
 io::stdout().write_all(&out).unwrap_or_else(|_|deny("BACKPACK_SPLIT_OUTPUT"));
}
