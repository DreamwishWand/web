//! R04 opt-in wasm-bindgen adapter. Only callable inside trusted Worker glue.
//! Max 1 MiB chunks: NEVER transport 100-200 MiB decoded JSON through UI.
use crate::{worker_session::WorkerSessionGuard,BuildIdentity,BuildKind,Platform,
            ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use wasm_bindgen::prelude::*;
const MAX_CHUNK:usize=1024*1024;
const MAX_WORKER_DOCUMENT:usize=128*1024*1024;
fn err(s:&'static str)->JsValue {JsValue::from_str(s)}
fn hex(bytes:&[u8])->String{
    const H:&[u8;16]=b"0123456789abcdef";
    let mut out=String::with_capacity(bytes.len()*2);
    for &byte in bytes {out.push(H[(byte>>4) as usize] as char);out.push(H[(byte&15) as usize] as char);}
    out
}
fn from_hex<const N:usize>(s:&str)->Result<[u8;N],JsValue>{
    if s.len()!=2*N || !s.is_ascii(){return Err(err("WORKER_SCOPE_HEX_INVALID"));}
    let mut out=[0_u8;N];
    for (i,chunk) in s.as_bytes().chunks_exact(2).enumerate(){
        let digit=|byte:u8|->Result<u8,JsValue>{match byte{b'0'..=b'9'=>Ok(byte-b'0'),b'a'..=b'f'=>Ok(byte-b'a'+10),_=>Err(err("WORKER_SCOPE_HEX_INVALID"))}};
        out[i]=(digit(chunk[0])?<<4)|digit(chunk[1])?;
    }
    Ok(out)
}
#[wasm_bindgen]
pub struct WorkerWasmSource {
    buffer:Vec<u8>,
    build:BuildIdentity,
    entropy:[u8;32],
    session:Option<WorkerSessionGuard>,
    closed:bool,
}
#[wasm_bindgen]
impl WorkerWasmSource {
    #[wasm_bindgen(constructor)]
    pub fn new(platform:&str,build_kind:&str,build_id:String,
               schema:u32,externally_attested:bool,entropy:&[u8])->Result<WorkerWasmSource,JsValue>{
        if entropy.len()!=32 || entropy.iter().all(|byte|*byte==0) {
            return Err(err("WORKER_ENTROPY_REQUIRED"));
        }
        let platform=match platform{
            "switch"=>Platform::Switch,
            "steam-windows"=>Platform::SteamWindows,
            _=>return Err(err("WORKER_PLATFORM_DENIED")),
        };
        let build_kind=match build_kind{
            "switch-bid"=>BuildKind::SwitchBid,
            "steam-full-version"=>BuildKind::SteamFullVersion,
            _=>return Err(err("WORKER_BUILD_KIND_DENIED")),
        };
        let mut seed=[0_u8;32];seed.copy_from_slice(entropy);
        Ok(Self{buffer:Vec::new(),
            build:BuildIdentity{platform,build_kind,build_id,schema:schema.into(),externally_attested},
            entropy:seed,session:None,closed:false})
    }
    /// No JS-owned second session, raw Save, UI readset, or unbounded transferable.
    pub fn append_chunk(&mut self,chunk:&[u8])->Result<(),JsValue>{
        if self.closed || self.session.is_some() {return Err(err("WORKER_ALREADY_FINALIZED"));}
        if chunk.is_empty() || chunk.len()>MAX_CHUNK ||
           self.buffer.len().checked_add(chunk.len()).ok_or(err("WORKER_DOCUMENT_BOUNDS"))?>MAX_WORKER_DOCUMENT {
            self.closed=true;self.buffer.clear();self.entropy.fill(0);
            return Err(err("WORKER_DOCUMENT_BOUNDS"));
        }
        self.buffer.extend_from_slice(chunk);
        Ok(())
    }
    pub fn finish(&mut self)->Result<String,JsValue>{
        if self.closed||self.session.is_some(){return Err(err("WORKER_ALREADY_FINALIZED"));}
        let bytes=std::mem::take(&mut self.buffer);
        let seed=self.entropy;
        self.entropy.fill(0);
        // Even an invalid source permanently revokes this builder instance.
        self.closed=true;
        let session=ProductSession::open_decoded_in_worker(bytes,self.build.clone(),seed)
            .map_err(|e|err(e.0))?;
        let guard=WorkerSessionGuard::attach(session);
        let receipt=guard.receipt().map_err(|e|err(e.0))?;
        self.session=Some(guard);
        Ok(serde_json::json!({
            "contract":receipt.contract,
            "sessionId":hex(&receipt.session_id),
            "revision":receipt.revision,
            "indexGeneration":receipt.index_generation,
            "decodedSha256":hex(&receipt.decoded_sha256),
            "schema":receipt.schema,
            "fullDocumentJsonValidated":receipt.full_document_json_validated,
            "allDomainReferencesVerified":false,
            "productWorkerBound":receipt.product_worker_bound,
            "productReadAccepted":false,
            "writerAuthorized":false,
            "editedCopyAuthorized":false,
            "applyAuthorized":false
        }).to_string())
    }
    pub fn read_core_version_witness(&self,session_id:&str,
                    revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let session=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let envelope=WorkerEnvelope {
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ReadCoreSchemaWitness,
        };
        let r=session.dispatch(envelope).map_err(|e|err(e.0))?;
        Ok(serde_json::json!({
            "sessionId":hex(&r.session_id),
            "revision":r.revision,"indexGeneration":r.index_generation,
            "decodedSha256":hex(&r.decoded_sha256),
            "coreOwnedReadset":r.core_owned_readset,
            "completeAllDomains":false,
            "writerAuthorized":false
        }).to_string())
    }
    /// StageD opt-in metadata only. JS may choose exactly two fixed domains,
    /// never a dynamic path, position or cursor seed. Same ProductSession.
    #[cfg(feature="indexed-read")]
    pub fn issue_typed_cursor(&self,domain:&str,session_id:&str,
          revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let domain=match domain {
            "player"=>crate::IndexedDomain::Player,
            "world"=>crate::IndexedDomain::World,
            _=>return Err(err("WORKER_DOMAIN_NOT_ALLOWLISTED")),
        };
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ReadDomain,
        };
        let receipt=guard.issue_indexed_cursor(scope,domain).map_err(|e|err(e.0))?;
        Ok(serde_json::json!({
            "cursor":hex(&receipt.cursor),
            "sessionId":hex(&receipt.session_id),
            "revision":receipt.revision,"indexGeneration":receipt.index_generation,
            "decodedSha256":hex(&receipt.decoded_sha256),
            "domain":domain.path(),"maxEntriesPerPage":receipt.max_entries_per_page,
            "completeAllDomains":false,"productReadAccepted":false,
            "writerAuthorized":false
        }).to_string())
    }
    /// Single-use Rust-issued cursor. Never return JSON field values.
    #[cfg(feature="indexed-read")]
    pub fn read_typed_page(&self,cursor:&str,session_id:&str,
          revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ReadDomain,
        };
        let page=guard.read_indexed_page(scope,from_hex(cursor)?)
            .map_err(|e|err(e.0))?;
        let fields:Vec<_>=page.fields.iter().map(|field|{
            let kind=match field.kind{
                crate::IndexedKind::Object=>"object",
                crate::IndexedKind::Array=>"array",
                crate::IndexedKind::String=>"string",
                crate::IndexedKind::Number=>"number",
                crate::IndexedKind::Boolean=>"boolean",
                crate::IndexedKind::Null=>"null",
            };
            serde_json::json!({"key":field.key,"kind":kind,"valueBytes":field.value_bytes})
        }).collect();
        Ok(serde_json::json!({
            "sessionId":hex(&page.session_id),
            "revision":page.revision,"indexGeneration":page.index_generation,
            "decodedSha256":hex(&page.decoded_sha256),
            "domain":page.domain.path(),"fields":fields,
            "nextCursor":page.next_cursor.map(|token|hex(&token)),
            "completeAllDomains":false,"productReadAccepted":false,
            "writerAuthorized":false
        }).to_string())
    }
    pub fn close(&mut self)->Result<(),JsValue>{
        self.closed=true;self.buffer.clear();self.entropy.fill(0);
        if let Some(mut session)=self.session.take(){
            session.close().map_err(|e|err(e.0))?;
        }
        Ok(())
    }
}

// wasm-bindgen's JS .free()/GC owner drop must revoke outstanding Rust
// session handles even when the Worker omits an explicit CLOSE message.
impl Drop for WorkerWasmSource {
    fn drop(&mut self) {
        self.closed=true;
        self.buffer.fill(0);
        self.buffer.clear();
        self.entropy.fill(0);
        if let Some(mut guard)=self.session.take() {
            let _=guard.close();
        }
    }
}
