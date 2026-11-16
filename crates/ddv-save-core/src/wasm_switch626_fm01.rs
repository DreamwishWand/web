use super::*;
const CONTRACT:&str="wand.worker.switch626.scoped-fm01-layout@1";
const OUTPUT:&str="wand.worker.switch626.scoped-fm01-layout-output@1";
fn ids5(ids:&[u32])->Result<[u32;5],JsValue>{ids.try_into().map_err(|_|err("FM01_IDS_LENGTH"))}
fn rows5(s:&str)->Result<[[u8;32];5],JsValue>{
 if s.len()!=320||!s.is_ascii(){return Err(err("FM01_ROWS_SHA_LENGTH"));}
 let mut rows=[[0;32];5];for i in 0..5{rows[i]=from_hex(&s[i*64..(i+1)*64])?;}Ok(rows)
}
#[wasm_bindgen]
impl WorkerWasmSource {
 pub fn preview_switch626_fm01(&self,grid:u32,ids:&[u32],session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
  let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
  Ok(g.preview_switch626_fm01(e,grid,ids5(ids)?).map_err(|e|err(e.0))?.to_string())
 }
 pub fn stage_switch626_fm01(&self,grid:u32,ids:&[u32],next:u32,stock:u32,root:&str,grid_sha:&str,counter:&str,entry:&str,houses:&str,rows:&str,projected:&str,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
  let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
  let r=g.stage_switch626_fm01(e,grid,ids5(ids)?,next,stock,from_hex(root)?,from_hex(grid_sha)?,from_hex(counter)?,from_hex(entry)?,from_hex(houses)?,rows5(rows)?,from_hex(projected)?).map_err(|e|err(e.0))?;
  self.scoped_domain.set(Some(ScopedEditDomain::SwitchFm01));Ok(scoped_edit_receipt(r,CONTRACT))
 }
 pub fn toggle_switch626_fm01(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  self.require_fm01_domain()?;self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,CONTRACT)
 }
 pub fn begin_switch626_fm01_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
  self.require_fm01_domain()?;self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,OUTPUT)
 }
 pub fn next_switch626_fm01_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{self.require_fm01_domain()?;self.next_scoped_edit_output_chunk_inner()}
}
impl WorkerWasmSource{
 fn require_fm01_domain(&self)->Result<(),JsValue>{
  if self.scoped_domain.get()!=Some(ScopedEditDomain::SwitchFm01){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}Ok(())
 }
}
