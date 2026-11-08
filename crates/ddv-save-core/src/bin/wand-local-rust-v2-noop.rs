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
