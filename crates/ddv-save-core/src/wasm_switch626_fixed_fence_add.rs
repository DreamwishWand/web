use super::*;
macro_rules! fixed_abi{
 ($preview:ident,$stage:ident,$toggle:ident,$begin:ident,$chunk:ident,$domain:ident,$contract:literal,$output:literal)=>{
 #[wasm_bindgen]
 impl WorkerWasmSource{
  pub fn $preview(&self,grid:u32,x:u32,y:u32,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
   let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
   let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
   Ok(g.$preview(e,grid,x,y).map_err(|e|err(e.0))?.to_string())
  }
  pub fn $stage(&self,grid:u32,x:u32,y:u32,next:u32,root:&str,grid_sha:&str,counter:&str,houses:&str,stock:u32,entry:&str,projected:&str,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
   let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
   let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
   let r=g.$stage(e,grid,x,y,next,from_hex(root)?,from_hex(grid_sha)?,from_hex(counter)?,from_hex(houses)?,stock,from_hex(entry)?,from_hex(projected)?).map_err(|e|err(e.0))?;
   self.scoped_domain.set(Some(ScopedEditDomain::$domain));Ok(scoped_edit_receipt(r,$contract))
  }
  pub fn $toggle(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
   if self.scoped_domain.get()!=Some(ScopedEditDomain::$domain){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,$contract)
  }
  pub fn $begin(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
   if self.scoped_domain.get()!=Some(ScopedEditDomain::$domain){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,$output)
  }
  pub fn $chunk(&mut self)->Result<JsValue,JsValue>{
   if self.scoped_domain.get()!=Some(ScopedEditDomain::$domain){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}self.next_scoped_edit_output_chunk_inner()
  }
 }
 }
}
#[cfg(all(feature="product-switch626-fd02-scoped",not(any(feature="product-collection-scoped",feature="product-steam626-chest-scoped",feature="product-switch626-chest-scoped",feature="product-steam626-comp03-scoped",feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped",feature="product-steam626-hair-scoped",feature="product-steam626-skin-scoped",feature="product-switch626-fd01-scoped",feature="product-switch626-fe01-scoped",feature="product-switch626-fd03-scoped",feature="product-switch626-ortho-l-scoped",feature="product-switch626-diagonal90-scoped",feature="product-switch626-ortho-t-scoped"))))]
fixed_abi!(preview_switch626_fd02,stage_switch626_fd02,toggle_switch626_fd02,begin_switch626_fd02_output,next_switch626_fd02_output_chunk,SwitchFd02,"wand.worker.switch626.scoped-fd02-layout@1","wand.worker.switch626.scoped-fd02-layout-output@1");
#[cfg(all(feature="product-switch626-fd03-scoped",not(any(feature="product-collection-scoped",feature="product-steam626-chest-scoped",feature="product-switch626-chest-scoped",feature="product-steam626-comp03-scoped",feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped",feature="product-steam626-hair-scoped",feature="product-steam626-skin-scoped",feature="product-switch626-fd01-scoped",feature="product-switch626-fe01-scoped",feature="product-switch626-fd02-scoped",feature="product-switch626-ortho-l-scoped",feature="product-switch626-diagonal90-scoped",feature="product-switch626-ortho-t-scoped"))))]
fixed_abi!(preview_switch626_fd03,stage_switch626_fd03,toggle_switch626_fd03,begin_switch626_fd03_output,next_switch626_fd03_output_chunk,SwitchFd03,"wand.worker.switch626.scoped-fd03-layout@1","wand.worker.switch626.scoped-fd03-layout-output@1");
#[cfg(all(feature="product-switch626-ortho-l-scoped",not(any(feature="product-collection-scoped",feature="product-steam626-chest-scoped",feature="product-switch626-chest-scoped",feature="product-steam626-comp03-scoped",feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped",feature="product-steam626-hair-scoped",feature="product-steam626-skin-scoped",feature="product-switch626-fd01-scoped",feature="product-switch626-fe01-scoped",feature="product-switch626-fd02-scoped",feature="product-switch626-fd03-scoped",feature="product-switch626-diagonal90-scoped",feature="product-switch626-ortho-t-scoped"))))]
fixed_abi!(preview_switch626_ortho_l,stage_switch626_ortho_l,toggle_switch626_ortho_l,begin_switch626_ortho_l_output,next_switch626_ortho_l_output_chunk,SwitchOrthoL,"wand.worker.switch626.scoped-ortho-l-layout@1","wand.worker.switch626.scoped-ortho-l-layout-output@1");
#[cfg(all(feature="product-switch626-diagonal90-scoped",not(any(feature="product-collection-scoped",feature="product-steam626-chest-scoped",feature="product-switch626-chest-scoped",feature="product-steam626-comp03-scoped",feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped",feature="product-steam626-hair-scoped",feature="product-steam626-skin-scoped",feature="product-switch626-fd01-scoped",feature="product-switch626-fe01-scoped",feature="product-switch626-fd02-scoped",feature="product-switch626-fd03-scoped",feature="product-switch626-ortho-l-scoped",feature="product-switch626-ortho-t-scoped"))))]
fixed_abi!(preview_switch626_diagonal90,stage_switch626_diagonal90,toggle_switch626_diagonal90,begin_switch626_diagonal90_output,next_switch626_diagonal90_output_chunk,SwitchDiagonal90,"wand.worker.switch626.scoped-diagonal90-layout@1","wand.worker.switch626.scoped-diagonal90-layout-output@1");
#[cfg(all(feature="product-switch626-ortho-t-scoped",not(any(feature="product-collection-scoped",feature="product-steam626-chest-scoped",feature="product-switch626-chest-scoped",feature="product-steam626-comp03-scoped",feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped",feature="product-steam626-hair-scoped",feature="product-steam626-skin-scoped",feature="product-switch626-fd01-scoped",feature="product-switch626-fe01-scoped",feature="product-switch626-fd02-scoped",feature="product-switch626-fd03-scoped",feature="product-switch626-ortho-l-scoped",feature="product-switch626-diagonal90-scoped"))))]
fixed_abi!(preview_switch626_ortho_t,stage_switch626_ortho_t,toggle_switch626_ortho_t,begin_switch626_ortho_t_output,next_switch626_ortho_t_output_chunk,SwitchOrthoT,"wand.worker.switch626.scoped-ortho-t-layout@1","wand.worker.switch626.scoped-ortho-t-layout-output@1");
