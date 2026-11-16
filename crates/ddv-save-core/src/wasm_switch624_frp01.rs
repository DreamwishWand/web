//! ACT1534: fixed Switch624 FRP01 exact7 generated ABI, opt-in OFF.
use super::*;
const CONTRACT:&str="wand.worker.switch624.scoped-frp01-exact7@1";
const OUTPUT:&str="wand.worker.switch624.scoped-frp01-exact7-output@1";

#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn preview_switch624_frp01(&self,grid:u32,old0:u32,old1:u32,old2:u32,
        session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.frp01_session.as_ref().ok_or(err("FRP01_WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        Ok(guard.preview_frp01_product(e,grid,[old0,old1,old2]).map_err(|x|err(x.0))?.to_string())
    }
    #[allow(clippy::too_many_arguments)]
    pub fn stage_switch624_frp01(&self,grid:u32,old0:u32,old1:u32,old2:u32,next:u32,
        old_stock:u32,new_stock:u32,root:&str,grid_sha:&str,counter_sha:&str,houses_sha:&str,
        old_stock_sha:&str,new_stock_sha:&str,old_rows_sha:&str,projected_sha:&str,
        session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get().is_some(){return Err(err("FRP01_ABI_ALREADY_STAGED"));}
        let guard=self.frp01_session.as_ref().ok_or(err("FRP01_WORKER_SESSION_NOT_READY"))?;
        let hashes=from_hex::<96>(old_rows_sha)?;
        let mut old_rows=[[0u8;32];3];
        for (i,row) in old_rows.iter_mut().enumerate(){row.copy_from_slice(&hashes[i*32..(i+1)*32]);}
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_frp01_product(e,grid,[old0,old1,old2],next,old_stock,new_stock,
            from_hex(root)?,from_hex(grid_sha)?,from_hex(counter_sha)?,from_hex(houses_sha)?,
            from_hex(old_stock_sha)?,from_hex(new_stock_sha)?,old_rows,from_hex(projected_sha)?)
            .map_err(|x|err(x.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::SwitchFrp01));
        Ok(scoped_edit_receipt(r,CONTRACT))
    }
    pub fn toggle_switch624_frp01(&self,redo:bool,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::SwitchFrp01){
            return Err(err("FRP01_ABI_DOMAIN_MISMATCH"));
        }
        let guard=self.frp01_session.as_ref().ok_or(err("FRP01_WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        Ok(scoped_edit_receipt(guard.toggle_scoped_edit(e,redo).map_err(|x|err(x.0))?,CONTRACT))
    }
    pub fn begin_switch624_frp01_output(&mut self,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::SwitchFrp01){
            return Err(err("FRP01_ABI_DOMAIN_MISMATCH"));
        }
        if self.scoped_output.is_some(){return Err(err("FRP01_ABI_OUTPUT_EXISTS"));}
        let guard=self.frp01_session.as_mut().ok_or(err("FRP01_WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ExportEditedCopy)?;
        let out=guard.take_scoped_edit(e).map_err(|x|err(x.0))?;
        use sha2::{Digest,Sha256};
        let bytes=out.len();let digest=hex(&Sha256::digest(&out));
        self.frp01_session=None;
        self.scoped_output=Some((out,0));
        Ok(serde_json::json!({"contract":OUTPUT,"decodedBytes":bytes,"decodedSha256":digest,
            "writerAuthorized":false,"originalOverwriteAuthorized":false}).to_string())
    }
    pub fn next_switch624_frp01_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::SwitchFrp01){
            return Err(err("FRP01_ABI_DOMAIN_MISMATCH"));
        }
        self.next_scoped_edit_output_chunk_inner()
    }
}
