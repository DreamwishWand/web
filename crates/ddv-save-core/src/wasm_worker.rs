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
    #[cfg(feature="product-amount-scoped")]
    scoped_output:Option<(Vec<u8>,usize)>,
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
            entropy:seed,session:None,closed:false,
            #[cfg(feature="product-amount-scoped")]
            scoped_output:None})
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
    /// R22 opt-in DEV Worker ABI only: read stored DiffGrids *metadata*, not
    /// effective Native Grid or UI/Writer permission. The existing Worker
    /// guard delegates to its ONE Rust ProductSession and shared Core grants.
    /// Never add this to the public product Worker route without independent
    /// Product operation acceptance.
    #[cfg(feature="indexed-read")]
    pub fn issue_saved_diffgrids_typed_cursor(&self,session_id:&str,
          revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ReadDomain,
        };
        let receipt=guard.issue_saved_diffgrids_cursor(scope).map_err(|e|err(e.0))?;
        if receipt.max_records_per_page!=8 || receipt.all_native_references_verified ||
           receipt.product_read_accepted || receipt.writer_authorized {
            return Err(err("WORKER_SAVED_DIFFGRIDS_AUTHORITY_DENIED"));
        }
        Ok(serde_json::json!({
            "contract":"wand.worker.stored-diffgrids-typed-metadata-readonly@1",
            "cursor":hex(&receipt.cursor),
            "sessionId":hex(&receipt.session_id),
            "revision":receipt.revision,
            "indexGeneration":receipt.index_generation,
            "decodedSha256":hex(&receipt.decoded_sha256),
            "indexedRecords":receipt.indexed_records,
            "maxRecordsPerPage":receipt.max_records_per_page,
            "externalLayoutStatus":"UNRESOLVED_EXTERNAL_LAYOUT",
            "allNativeReferencesVerified":false,
            "productReadAccepted":false,
            "writerAuthorized":false
        }).to_string())
    }
    /// One-use Rust-issued cursor; 8 stored DiffGrids/page maximum.
    /// Type/count/ID/hash are saved values ONLY, not a native legal reference.
    /// Bounds are capped BEFORE serialized metadata crosses the Worker ABI.
    #[cfg(feature="indexed-read")]
    pub fn read_saved_diffgrids_typed_page(&self,cursor:&str,session_id:&str,
          revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        const MAX_OBJECT_IDS_PER_GRID:usize=2048;
        const MAX_TYPED_PAGE_JSON_BYTES:usize=512*1024;
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ReadDomain,
        };
        let page=guard.read_saved_diffgrids_page(scope,from_hex(cursor)?)
            .map_err(|e|err(e.0))?;
        if page.records.len()>8 || page.all_native_references_verified ||
           page.product_read_accepted || page.writer_authorized {
            return Err(err("WORKER_SAVED_DIFFGRIDS_AUTHORITY_DENIED"));
        }
        let mut records=Vec::with_capacity(page.records.len());
        for grid in &page.records {
            if grid.external_layout!=crate::ExternalLayoutStatus::UnresolvedExternalLayout ||
               grid.native_effective_grid_verified {
                return Err(err("WORKER_NATIVE_EXTERNAL_LAYOUT_UNVERIFIED"));
            }
            if grid.modified_object_ids.len()>MAX_OBJECT_IDS_PER_GRID ||
               grid.removed_object_ids.len()>MAX_OBJECT_IDS_PER_GRID {
                return Err(err("WORKER_TYPED_OBJECT_ID_COUNT_BOUNDS"));
            }
            let removed_shape=match grid.removed_shape {
                crate::StoredRemovedShape::Absent=>"absent",
                crate::StoredRemovedShape::Array=>"array",
                crate::StoredRemovedShape::ObjectMap=>"object-map"
            };
            records.push(serde_json::json!({
                "gridId":grid.grid_id,
                "defaultLayoutGridId":grid.default_layout_grid_id,
                "gridDefaultLayoutPath":grid.grid_default_layout_path,
                "gridDefaultLayoutType":grid.grid_default_layout_type,
                "defaultGridHashCode":grid.default_grid_hash_code,
                "defaultGridDataHashCode":grid.default_grid_data_hash_code,
                "modifiedObjectIds":grid.modified_object_ids,
                "removedObjectIds":grid.removed_object_ids,
                "modifiedObjectCount":grid.modified_object_ids.len(),
                "removedObjectCount":grid.removed_object_ids.len(),
                "removedShape":removed_shape,
                "modifiedRemovedSameIdPairs":grid.modified_removed_id_pairs,
                "externalLayoutStatus":"UNRESOLVED_EXTERNAL_LAYOUT",
                "nativeEffectiveGridVerified":false
            }));
        }
        let value=serde_json::json!({
            "contract":"wand.worker.stored-diffgrids-typed-metadata-readonly@1",
            "sessionId":hex(&page.session_id),
            "revision":page.revision,
            "indexGeneration":page.index_generation,
            "decodedSha256":hex(&page.decoded_sha256),
            "records":records,
            "nextCursor":page.next_cursor.map(|token|hex(&token)),
            "maxRecordsPerPage":8,
            "externalLayoutStatus":"UNRESOLVED_EXTERNAL_LAYOUT",
            "nativeEffectiveGridVerified":false,
            "allNativeReferencesVerified":false,
            "productReadAccepted":false,
            "writerAuthorized":false
        });
        let out=value.to_string();
        if out.len()>MAX_TYPED_PAGE_JSON_BYTES {
            return Err(err("WORKER_TYPED_PAGE_BYTE_BOUNDS"));
        }
        Ok(out)
    }
    /// ACT916 opt-in ABI, absent from the existing Pages feature set.
    #[cfg(feature="product-amount-scoped")]
    pub fn preview_scoped_amount(&self,profile:&str,id:u32,selector:u32,new:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection(profile,id,selector)?;
        let e=scoped_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let t=guard.preview_scoped_amount(e,selection,new).map_err(|e|err(e.0))?;
        let v=t.view();
        Ok(serde_json::json!({"contract":"wand.worker.steam626.scoped-amount@1","profile":profile,
            "id":id,"selector":selector,"itemId":v.item_id,"oldAmount":v.old_amount,"newAmount":new,
            "entrySha256":hex(&v.entry_sha256),"sessionId":hex(&v.session_id),"revision":v.revision,
            "indexGeneration":v.index_generation,"decodedSha256":hex(&v.decoded_sha256),
            "scopedCandidate":true,"writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(feature="product-amount-scoped")]
    pub fn stage_scoped_amount(&self,profile:&str,id:u32,selector:u32,old:u32,new:u32,entry_sha256:&str,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection(profile,id,selector)?;
        let e=scoped_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_scoped_amount(e,selection,old,new,from_hex(entry_sha256)?).map_err(|e|err(e.0))?;
        Ok(scoped_receipt(r))
    }
    #[cfg(feature="product-amount-scoped")]
    pub fn toggle_scoped_amount(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        Ok(scoped_receipt(guard.toggle_scoped_amount(e,redo).map_err(|e|err(e.0))?))
    }
    /// Consume the staged Rust ledger once. Output stays in the trusted
    /// Worker for Codec, not UI; use the existing bounded chunk size.
    #[cfg(feature="product-amount-scoped")]
    pub fn begin_scoped_amount_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_output.is_some(){return Err(err("WORKER_SCOPED_OUTPUT_EXISTS"));}
        let guard=self.session.as_mut().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ExportEditedCopy)?;
        let out=guard.take_scoped_amount(e).map_err(|e|err(e.0))?;
        use sha2::{Digest,Sha256};let size=out.len();let sha=hex(&Sha256::digest(&out));
        self.session=None;
        self.scoped_output=Some((out,0));
        Ok(serde_json::json!({"contract":"wand.worker.steam626.scoped-amount-output@1",
            "decodedBytes":size,"decodedSha256":sha,"writerAuthorized":false,"originalOverwriteAuthorized":false}).to_string())
    }
    #[cfg(feature="product-amount-scoped")]
    pub fn next_scoped_amount_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        let (out,pos)=self.scoped_output.as_mut().ok_or(err("WORKER_SCOPED_OUTPUT_CONSUMED"))?;
        let end=pos.saturating_add(MAX_CHUNK).min(out.len());
        let chunk=out[*pos..end].to_vec();out[*pos..end].fill(0);*pos=end;
        if end==out.len(){self.scoped_output=None;}
        Ok(chunk)
    }
    pub fn close(&mut self)->Result<(),JsValue>{
        self.closed=true;self.buffer.clear();self.entropy.fill(0);
        #[cfg(feature="product-amount-scoped")]
        if let Some((mut out,_))=self.scoped_output.take(){out.fill(0);}
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
        #[cfg(feature="product-amount-scoped")]
        if let Some((mut out,_))=self.scoped_output.take(){out.fill(0);}
        if let Some(mut guard)=self.session.take() {
            let _=guard.close();
        }
    }
}

#[cfg(feature="product-amount-scoped")]
fn scoped_selection(profile:&str,id:u32,selector:u32)->Result<crate::ExistingAmountSelection,JsValue>{
    match profile{
        "catalog0-furniture" if id==0=>Ok(crate::ExistingAmountSelection::Inventory{inventory_id:0,item_id:selector}),
        "linked-crop-chest48" if id>1&&selector<48=>Ok(crate::ExistingAmountSelection::Chest{container_id:id,slot_index:selector as usize}),
        _=>Err(err("WORKER_SCOPED_PROFILE")),
    }
}
#[cfg(feature="product-amount-scoped")]
fn scoped_envelope(id:&str,revision:u64,generation:u64,sha:&str,action:WorkerAction)->Result<WorkerEnvelope,JsValue>{
    Ok(WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(id)?,expected_revision:revision,
        expected_index_generation:generation,expected_decoded_sha256:from_hex(sha)?,action})
}
#[cfg(feature="product-amount-scoped")]
fn scoped_receipt(r:crate::SemanticStageReceipt)->String{
    serde_json::json!({"contract":"wand.worker.steam626.scoped-amount@1","sessionId":hex(&r.session_id),
        "revision":r.revision,"indexGeneration":r.index_generation,"decodedSha256":hex(&r.original_decoded_sha256),
        "stagedDecodedSha256":hex(&r.staged_decoded_sha256),"operationCount":r.operation_count,
        "exactFieldChangedCount":r.exact_field_changed_count,"applied":r.applied,"writerAuthorized":false,
        "originalOverwriteAuthorized":false}).to_string()
}
