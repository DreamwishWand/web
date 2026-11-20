//! ACT1486 fixed Steam626 Makeup Color1 exact1 opt-in generated Worker ABI.
//! Existing ProductSession and accepted semantic ledger; OFF for public Pages.
use super::*;
const CONTRACT:&str="wand.worker.steam626.makeup-color1-exact1@1";
const OUTPUT:&str="wand.worker.steam626.makeup-color1-exact1-output@1";

#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn preview_steam626_makeup_color1(&self,session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get().is_some(){return Err(err("MAKEUP_ABI_ALREADY_STAGED"));}
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        Ok(guard.preview_makeup_color1(e).map_err(|x|err(x.0))?.to_string())
    }
    pub fn stage_steam626_makeup_color1(&self,token_sha:&str,entry_sha:&str,female_sha:&str,male_sha:&str,
        routes_sha:&str,projected_sha:&str,session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get().is_some(){return Err(err("MAKEUP_ABI_ALREADY_STAGED"));}
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let p=from_hex(projected_sha)?;
        for hash in [token_sha,entry_sha,female_sha,male_sha,routes_sha]{
            let _=from_hex::<32>(hash)?;
        }
        let r=guard.stage_makeup_color1(e,token_sha,entry_sha,female_sha,male_sha,routes_sha,p)
            .map_err(|x|err(x.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::MakeupColor1));
        Ok(scoped_edit_receipt(r,CONTRACT))
    }
    pub fn toggle_steam626_makeup_color1(&self,redo:bool,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::MakeupColor1){
            return Err(err("MAKEUP_ABI_DOMAIN_MISMATCH"));
        }
        self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,CONTRACT)
    }
    pub fn begin_steam626_makeup_color1_output(&mut self,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::MakeupColor1){
            return Err(err("MAKEUP_ABI_DOMAIN_MISMATCH"));
        }
        self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,OUTPUT)
    }
    pub fn next_steam626_makeup_color1_output_chunk(&mut self)->Result<JsValue,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::MakeupColor1){
            return Err(err("MAKEUP_ABI_DOMAIN_MISMATCH"));
        }
        self.next_scoped_edit_output_chunk_inner()
    }
}
