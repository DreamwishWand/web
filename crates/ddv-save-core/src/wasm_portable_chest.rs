//! Dedicated Chest portable Restore surface, no grant or new engine.
use super::*;
const CONTRACT:&str="wand.worker.steam626.chest-portable-restore@1";
const OUTPUT:&str="wand.worker.steam626.chest-portable-restore-output@1";
#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn capture_chest_portable_backup(&self,container:u32,slot:u32,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<Vec<u8>,JsValue>{
        let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        g.capture_chest_portable(e,container,slot).map_err(|e|err(e.0))
    }
    pub fn preview_chest_portable_restore(&self,container:u32,slot:u32,backup:&[u8],session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        Ok(g.preview_chest_portable(e,container,slot,backup).map_err(|e|err(e.0))?.to_string())
    }
    pub fn stage_chest_portable_restore(&self,container:u32,slot:u32,backup:&[u8],old:u32,new:u32,entry_sha:&str,backup_sha:&str,projected_sha:&str,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let g=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=g.stage_chest_portable(e,container,slot,backup,old,new,from_hex(entry_sha)?,from_hex(backup_sha)?,from_hex(projected_sha)?).map_err(|e|err(e.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::PortableRestore));
        Ok(scoped_edit_receipt(r,CONTRACT))
    }
    pub fn toggle_chest_portable_restore(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.require_chest_portable_domain()?;
        self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,CONTRACT)
    }
    pub fn begin_chest_portable_restore_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.require_chest_portable_domain()?;
        self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,OUTPUT)
    }
    pub fn next_chest_portable_restore_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        self.require_chest_portable_domain()?;
        self.next_scoped_edit_output_chunk_inner()
    }
}
impl WorkerWasmSource {
    fn require_chest_portable_domain(&self)->Result<(),JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::PortableRestore){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}
        Ok(())
    }
}
