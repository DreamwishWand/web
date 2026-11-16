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
    #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
    scoped_output:Option<(Vec<u8>,usize)>,
    #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
    scoped_domain:std::cell::Cell<Option<ScopedEditDomain>>,
}
#[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
#[derive(Clone,Copy,PartialEq,Eq)]
enum ScopedEditDomain { Amount, Collection, SwitchChest, SwitchCatalog0, PortableRestore }
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
            #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
            scoped_output:None,
            #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
            scoped_domain:std::cell::Cell::new(None)})
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
    #[cfg(all(feature="product-collection-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn preview_scoped_collection_candidate(&self,definition:u32,group:u32,item:u32,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,expected_revision:revision,expected_index_generation:index_generation,expected_decoded_sha256:from_hex(decoded_sha256)?,action:WorkerAction::ReadDomain};
        Ok(guard.preview_collection_candidate(e,definition,group as usize,item).map_err(|e|err(e.0))?.to_string())
    }
    // Exact fixed Collection command; old=false/new=true is intrinsic,
    // never a JS-coerced boolean or a generic path/value mutation.
    #[cfg(all(all(feature="product-collection-scoped",feature="semantic-writer-dev"),not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn preview_fixed_collection(&self,definition:u32,group:u32,item:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        Ok(guard.preview_fixed_collection(e,definition,group as usize,item).map_err(|e|err(e.0))?.to_string())
    }
    #[cfg(all(all(feature="product-collection-scoped",feature="semantic-writer-dev"),not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn stage_fixed_collection(&self,definition:u32,group:u32,item:u32,entry_sha256:&str,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_fixed_collection(e,definition,group as usize,item,from_hex(entry_sha256)?).map_err(|e|err(e.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::Collection));
        Ok(scoped_edit_receipt(r,"wand.worker.scoped-edit@1"))
    }
    /// ACT916 opt-in bounded same-session discovery. No caller eligibility.
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn discover_scoped_amount(&self,profile:&str,offset:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let (targets,next,scanned)=guard.discover_scoped_amount(e,profile,offset).map_err(|e|err(e.0))?;
        let mut rows=Vec::new();
        for t in targets{
            let v=t.view();let (id,selector)=match v.selection{
                crate::ExistingAmountSelection::Inventory{inventory_id,item_id}=>(inventory_id,item_id),
                crate::ExistingAmountSelection::Chest{container_id,slot_index}=>(container_id,slot_index as u32),
            };
            rows.push(serde_json::json!({"profile":profile,"id":id,"selector":selector,"itemId":v.item_id,"oldAmount":v.old_amount}));
        }
        Ok(serde_json::json!({"contract":"wand.worker.steam626.scoped-amount-discovery@1","profile":profile,
            "sessionId":session_id,"revision":revision,"indexGeneration":index_generation,"decodedSha256":decoded_sha256,
            "offset":offset,"nextOffset":next,"scanned":scanned,"rows":rows,"writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    /// ACT916 opt-in ABI, absent from the existing Pages feature set.
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn preview_scoped_amount(&self,profile:&str,id:u32,selector:u32,new:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection(profile,id,selector)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let t=guard.preview_scoped_amount(e,selection,new).map_err(|e|err(e.0))?;
        let v=t.view();
        Ok(serde_json::json!({"contract":"wand.worker.steam626.scoped-amount@1","profile":profile,
            "id":id,"selector":selector,"itemId":v.item_id,"oldAmount":v.old_amount,"newAmount":new,
            "entrySha256":hex(&v.entry_sha256),"sessionId":hex(&v.session_id),"revision":v.revision,
            "indexGeneration":v.index_generation,"decodedSha256":hex(&v.decoded_sha256),
            "scopedCandidate":true,"writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn stage_scoped_amount(&self,profile:&str,id:u32,selector:u32,old:u32,new:u32,entry_sha256:&str,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection(profile,id,selector)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_scoped_amount(e,selection,old,new,from_hex(entry_sha256)?).map_err(|e|err(e.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::Amount));
        Ok(scoped_edit_receipt(r,"wand.worker.steam626.scoped-amount@1"))
    }
    /// Switch626 explicit ABI; the Steam aliases retain their original scope.
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn discover_switch626_chest(&self,offset:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let (targets,next,scanned)=guard.discover_switch626_chest(e,offset).map_err(|e|err(e.0))?;
        let mut rows=Vec::new();
        for t in targets{
            let v=t.view();
            let crate::ExistingAmountSelection::Chest{container_id,slot_index}=v.selection else{return Err(err("WORKER_SCOPED_PROFILE"));};
            rows.push(serde_json::json!({"profile":"linked-crop-chest48","id":container_id,
                "selector":slot_index,"itemId":v.item_id,"oldAmount":v.old_amount}));
        }
        Ok(serde_json::json!({"contract":"wand.worker.switch626.scoped-chest-discovery@1",
            "profile":"linked-crop-chest48","sessionId":session_id,"revision":revision,
            "indexGeneration":index_generation,"decodedSha256":decoded_sha256,
            "offset":offset,"nextOffset":next,"scanned":scanned,"rows":rows,
            "writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn preview_switch626_chest(&self,id:u32,slot:u32,new:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection("linked-crop-chest48",id,slot)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let t=guard.preview_switch626_chest(e,selection,new).map_err(|e|err(e.0))?;
        let v=t.view();
        Ok(serde_json::json!({"contract":"wand.worker.switch626.scoped-chest@1",
            "profile":"linked-crop-chest48","id":id,"selector":slot,"itemId":v.item_id,
            "oldAmount":v.old_amount,"newAmount":new,"entrySha256":hex(&v.entry_sha256),
            "sessionId":hex(&v.session_id),"revision":v.revision,"indexGeneration":v.index_generation,
            "decodedSha256":hex(&v.decoded_sha256),"scopedCandidate":true,
            "writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn stage_switch626_chest(&self,id:u32,slot:u32,old:u32,new:u32,entry_sha256:&str,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection("linked-crop-chest48",id,slot)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_switch626_chest(e,selection,old,new,from_hex(entry_sha256)?).map_err(|e|err(e.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::SwitchChest));
        Ok(scoped_edit_receipt(r,"wand.worker.switch626.scoped-chest@1"))
    }
    #[cfg(feature="product-amount-scoped")]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn discover_switch626_catalog0(&self,offset:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let (targets,next,scanned)=guard.discover_switch626_catalog0(e,offset).map_err(|e|err(e.0))?;
        let mut rows=Vec::new();
        for t in targets{
            let v=t.view();
            let crate::ExistingAmountSelection::Inventory{inventory_id,item_id}=v.selection else{return Err(err("WORKER_SCOPED_PROFILE"));};
            rows.push(serde_json::json!({"profile":"catalog0-furniture","id":inventory_id,"selector":item_id,"itemId":v.item_id,"oldAmount":v.old_amount}));
        }
        Ok(serde_json::json!({"contract":"wand.worker.switch626.scoped-catalog0-discovery@1",
            "profile":"catalog0-furniture","sessionId":session_id,"revision":revision,
            "indexGeneration":index_generation,"decodedSha256":decoded_sha256,
            "offset":offset,"nextOffset":next,"scanned":scanned,"rows":rows,
            "writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(feature="product-amount-scoped")]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn preview_switch626_catalog0(&self,id:u32,item:u32,new:u32,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection("catalog0-furniture",id,item)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain)?;
        let t=guard.preview_switch626_catalog0(e,selection,new).map_err(|e|err(e.0))?;
        let v=t.view();
        Ok(serde_json::json!({"contract":"wand.worker.switch626.scoped-catalog0@1",
            "profile":"catalog0-furniture","id":id,"selector":item,"itemId":v.item_id,
            "oldAmount":v.old_amount,"newAmount":new,"entrySha256":hex(&v.entry_sha256),
            "sessionId":hex(&v.session_id),"revision":v.revision,"indexGeneration":v.index_generation,
            "decodedSha256":hex(&v.decoded_sha256),"scopedCandidate":true,
            "writerAuthorized":false,"editedCopyAuthorized":false}).to_string())
    }
    #[cfg(feature="product-amount-scoped")]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn stage_switch626_catalog0(&self,id:u32,item:u32,old:u32,new:u32,entry_sha256:&str,session_id:&str,
            revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let selection=scoped_selection("catalog0-furniture",id,item)?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        let r=guard.stage_switch626_catalog0(e,selection,old,new,from_hex(entry_sha256)?).map_err(|e|err(e.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::SwitchCatalog0));
        Ok(scoped_edit_receipt(r,"wand.worker.switch626.scoped-catalog0@1"))
    }
    // One internal ledger and one output buffer, with legacy Amount
    // contract aliases. The tag labels the successful Stage; it cannot
    // authorize any command or mint a new session.
    #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn toggle_scoped_edit(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,"wand.worker.scoped-edit@1")
    }
    #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn begin_scoped_edit_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,"wand.worker.scoped-edit-output@1")
    }
    #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn next_scoped_edit_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        self.next_scoped_edit_output_chunk_inner()
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn toggle_scoped_amount(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.require_amount_domain()?;
        self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,"wand.worker.steam626.scoped-amount@1")
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn begin_scoped_amount_output(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        self.require_amount_domain()?;
        self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,"wand.worker.steam626.scoped-amount-output@1")
    }
    #[cfg(all(feature="product-amount-scoped",not(feature="product-switch626-catalog0-scoped")))]
    #[cfg(not(feature="product-portable-restore-scoped"))]
    pub fn next_scoped_amount_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        self.require_amount_domain()?;
        self.next_scoped_edit_output_chunk_inner()
    }
    pub fn close(&mut self)->Result<(),JsValue>{
        self.closed=true;self.buffer.clear();self.entropy.fill(0);
        #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
        {if let Some((mut out,_))=self.scoped_output.take(){out.fill(0);} self.scoped_domain.set(None);}
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
        #[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
        {if let Some((mut out,_))=self.scoped_output.take(){out.fill(0);} self.scoped_domain.set(None);}
        if let Some(mut guard)=self.session.take() {
            let _=guard.close();
        }
    }
}

#[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
fn scoped_edit_envelope(id:&str,revision:u64,generation:u64,sha:&str,action:WorkerAction)->Result<WorkerEnvelope,JsValue>{
    Ok(WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(id)?,expected_revision:revision,
        expected_index_generation:generation,expected_decoded_sha256:from_hex(sha)?,action})
}
#[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
fn scoped_edit_receipt(r:crate::SemanticStageReceipt,contract:&str)->String{
    serde_json::json!({"contract":contract,"sessionId":hex(&r.session_id),
        "revision":r.revision,"indexGeneration":r.index_generation,"decodedSha256":hex(&r.original_decoded_sha256),
        "stagedDecodedSha256":hex(&r.staged_decoded_sha256),"operationCount":r.operation_count,
        "exactFieldChangedCount":r.exact_field_changed_count,"applied":r.applied,"writerAuthorized":false,
        "originalOverwriteAuthorized":false}).to_string()
}

#[cfg(feature="product-amount-scoped")]
fn scoped_selection(profile:&str,id:u32,selector:u32)->Result<crate::ExistingAmountSelection,JsValue>{
    match profile{
        "catalog0-furniture" if id==0=>Ok(crate::ExistingAmountSelection::Inventory{inventory_id:0,item_id:selector}),
        "linked-crop-chest48" if id>1&&selector<48=>Ok(crate::ExistingAmountSelection::Chest{container_id:id,slot_index:selector as usize}),
        _=>Err(err("WORKER_SCOPED_PROFILE")),
    }
}

#[cfg(any(feature="product-amount-scoped",all(feature="product-collection-scoped",feature="semantic-writer-dev")))]
impl WorkerWasmSource {
    #[cfg(feature="product-amount-scoped")]
    fn require_amount_domain(&self)->Result<(),JsValue>{
        if matches!(self.scoped_domain.get(),Some(ScopedEditDomain::Collection|ScopedEditDomain::SwitchChest|ScopedEditDomain::SwitchCatalog0)){return Err(err("WORKER_SCOPED_DOMAIN_MISMATCH"));}
        Ok(())
    }
    fn toggle_scoped_edit_inner(&self,redo:bool,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str,contract:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage)?;
        Ok(scoped_edit_receipt(guard.toggle_scoped_edit(e,redo).map_err(|e|err(e.0))?,contract))
    }
    fn begin_scoped_edit_output_inner(&mut self,session_id:&str,revision:u64,index_generation:u64,decoded_sha256:&str,contract:&str)->Result<String,JsValue>{
        if self.scoped_output.is_some(){return Err(err("WORKER_SCOPED_OUTPUT_EXISTS"));}
        let guard=self.session.as_mut().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,WorkerAction::ExportEditedCopy)?;
        let out=guard.take_scoped_edit(e).map_err(|e|err(e.0))?;
        use sha2::{Digest,Sha256};let size=out.len();let sha=hex(&Sha256::digest(&out));
        self.session=None;
        self.scoped_output=Some((out,0));
        Ok(serde_json::json!({"contract":contract,"decodedBytes":size,"decodedSha256":sha,
            "writerAuthorized":false,"originalOverwriteAuthorized":false}).to_string())
    }
    fn next_scoped_edit_output_chunk_inner(&mut self)->Result<Vec<u8>,JsValue>{
        let (out,pos)=self.scoped_output.as_mut().ok_or(err("WORKER_SCOPED_OUTPUT_CONSUMED"))?;
        let end=pos.saturating_add(MAX_CHUNK).min(out.len());
        let chunk=out[*pos..end].to_vec();out[*pos..end].fill(0);*pos=end;
        if end==out.len(){self.scoped_output=None;}
        Ok(chunk)
    }
}

#[cfg(all(feature="product-switch626-catalog0-portable-restore",not(any(feature="product-collection-scoped",feature="product-switch626-catalog0-scoped",feature="product-steam626-catalog0-portable-restore",feature="product-steam626-chest-portable-restore",feature="product-switch626-chest-portable-restore"))))]
#[path="wasm_portable_switch626_catalog0.rs"]
mod portable_switch626_catalog0;
