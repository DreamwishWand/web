use super::*;
use crate::WorkerAction;
fn hex32<const N:usize>(a:&[u8;N])->String{a.iter().map(|b|format!("{b:02x}")).collect()}
macro_rules! fixed_guard{
 ($preview:ident,$stage:ident,$core_preview:ident,$core_stage:ident,$contract:literal)=>{
 impl WorkerSessionGuard{
  pub(crate) fn $preview(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<serde_json::Value>{
   if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
   let p=self.session.$core_preview(e,grid,x,y)?;let t=&p.target;
   Ok(serde_json::json!({"contract":$contract,"layout":"PRESERVE_EXISTING","gridId":t.grid,"x":t.x,"y":t.y,"expectedNextId":t.next,"oldAmount":t.stock,"newAmount":t.stock,"inventoryDelta":0,"rootSha256":hex32(&t.root_sha),"gridSha256":hex32(&t.grid_sha),"counterSha256":hex32(&t.counter_sha),"inventoryEntrySha256":hex32(&t.stock_sha),"housesSha256":hex32(&t.houses_sha),"projectedDecodedSha256":hex32(&p.projected),"exactFieldChangedCount":p.exact,"sessionId":hex32(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,"decodedSha256":hex32(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
  }
  pub(crate) fn $stage(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32,next:u32,root:[u8;32],grid_sha:[u8;32],counter:[u8;32],houses:[u8;32],stock:u32,entry:[u8;32],projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
   if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
   if e.action!=WorkerAction::Stage{return Err(CoreError("FIXED_FENCE_ABI_STAGE_ACTION"));}
   let p=self.session.$core_preview(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,x,y)?;let t=&p.target;
   if (t.next,t.root_sha,t.grid_sha,t.counter_sha,t.houses_sha,t.stock,t.stock_sha,p.projected)!=(next,root,grid_sha,counter,houses,stock,entry,projected){return Err(CoreError("FIXED_FENCE_ABI_STAGE_CAS"));}
   self.session.$core_stage(e,&p)
  }
 }
 }
}
fixed_guard!(preview_switch626_fd02,stage_switch626_fd02,preview_switch626_fd02_product,stage_switch626_fd02_product,"wand.worker.switch626.scoped-fd02-layout@1");
fixed_guard!(preview_switch626_fd03,stage_switch626_fd03,preview_switch626_fd03_product,stage_switch626_fd03_product,"wand.worker.switch626.scoped-fd03-layout@1");
fixed_guard!(preview_switch626_ortho_l,stage_switch626_ortho_l,preview_switch626_ortho_l_product,stage_switch626_ortho_l_product,"wand.worker.switch626.scoped-ortho-l-layout@1");
fixed_guard!(preview_switch626_diagonal90,stage_switch626_diagonal90,preview_switch626_diagonal90_product,stage_switch626_diagonal90_product,"wand.worker.switch626.scoped-diagonal90-layout@1");
fixed_guard!(preview_switch626_ortho_t,stage_switch626_ortho_t,preview_switch626_ortho_t_product,stage_switch626_ortho_t_product,"wand.worker.switch626.scoped-ortho-t-layout@1");
