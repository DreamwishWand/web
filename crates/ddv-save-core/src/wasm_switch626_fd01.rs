use super::*;
const CONTRACT:&str="wand.worker.switch626.scoped-fd01-layout@1";
const OUTPUT:&str="wand.worker.switch626.scoped-fd01-layout-output@1";
#[wasm_bindgen]
impl WorkerWasmSource{
 pub fn preview_switch626_fd01(&self,grid:u32,x:u32,y:u32,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
  Ok(g.preview_switch626_fd01(e,grid,x,y).map_err(|e|err(e.0))?.to_string())
 }
 pub fn stage_switch626_fd01(&self,grid:u32,x:u32,y:u32,next:u32,root:&str,grid_sha:&str,counter:&str,houses:&str,stock:u32,entry:&str,projected:&str,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
  let r=g.stage_switch626_fd01(e,grid,x,y,next,from_hex(root)?,from_hex(grid_sha)?,from_hex(counter)?,from_hex(houses)?,stock,from_hex(entry)?,from_hex(projected)?).map_err(|e|err(e.0))?;
  self.scoped_domain.set(Some(ScopedEditDomain::SwitchFd01));Ok(scoped_edit_receipt(r,CONTRACT))
 }
 pub fn toggle_switch626_fd01(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{self.require_fd01_domain()?;self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,CONTRACT)}
 pub fn begin_switch626_fd01_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{self.require_fd01_domain()?;self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,OUTPUT)}
 pub fn next_switch626_fd01_output_chunk(&mut self)->Result<JsValue,JsValue>{self.require_fd01_domain()?;self.next_scoped_edit_output_chunk_inner()}
}
impl WorkerWasmSource{fn require_fd01_domain(&self)->Result<(),JsValue>{if self.scoped_domain.get()!=Some(ScopedEditDomain::SwitchFd01){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}Ok(())}}
