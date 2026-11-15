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
    // DEV feature is excluded from the signed public Pages Worker WASM.
    #[cfg(feature="semantic-writer-dev")]
    semantic_export:Option<Vec<u8>>,
    #[cfg(feature="semantic-writer-dev")]
    semantic_export_offset:usize,
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
            #[cfg(feature="semantic-writer-dev")]
            semantic_export:None,
            #[cfg(feature="semantic-writer-dev")]
            semantic_export_offset:0})
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

    /// DEV-only: no UI message route or product-Writer feature. JSON is a
    /// bounded *typed command envelope*, never arbitrary JSON patch/path.
    /// Existing Rust ProductSession resolves every target from saved bytes.
    #[cfg(feature="semantic-writer-dev")]
    pub fn dev_stage_typed_amounts(&mut self,commands_json:&str,
        session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.semantic_export.is_some()||commands_json.is_empty()||
           commands_json.len()>8192 {
            return Err(err("DEV_SEMANTIC_COMMAND_BOUNDS"));
        }
        // Reuse the accepted streaming duplicate-key validator, including
        // escaped-equivalent keys, BEFORE serde_json::Value can collapse keys.
        let framed=format!(
            "{{\"GameInfo\":{{\"Version\":626}},\"Player\":{{\"devCommands\":{}}},\"World\":{{}}}}",
            commands_json);
        crate::strict_document::validate_entire_document(framed.as_bytes(),626)
            .map_err(|_|err("DEV_SEMANTIC_COMMAND_JSON_DUPLICATE_OR_INVALID"))?;
        let raw:serde_json::Value=serde_json::from_str(commands_json)
            .map_err(|_|err("DEV_SEMANTIC_COMMAND_JSON_INVALID"))?;
        let arr=raw.as_array().ok_or(err("DEV_SEMANTIC_COMMAND_ARRAY_REQUIRED"))?;
        if arr.is_empty()||arr.len()>16{return Err(err("DEV_SEMANTIC_BATCH_BOUNDS"));}
        let mut commands=Vec::with_capacity(arr.len());
        for v in arr {
            let map=v.as_object().ok_or(err("DEV_SEMANTIC_COMMAND_OBJECT_REQUIRED"))?;
            let kind=map.get("kind").and_then(|v|v.as_str())
                .ok_or(err("DEV_SEMANTIC_KIND_REQUIRED"))?;
            let number=|name:&str|->Result<u32,JsValue>{
                let n=map.get(name).and_then(|v|v.as_u64())
                    .ok_or(err("DEV_SEMANTIC_UINT_REQUIRED"))?;
                u32::try_from(n).map_err(|_|err("DEV_SEMANTIC_UINT_BOUNDS"))
            };
            let old=number("expectedOldAmount")?;
            let new=number("newAmount")?;
            match kind {
                "InventoryExistingAmountDecrease"=>{
                    if map.len()!=6||
                       !["kind","inventoryId","canonicalItemId",
                         "compatibleItemType","expectedOldAmount","newAmount"]
                         .iter().all(|k|map.contains_key(*k)){
                        return Err(err("DEV_SEMANTIC_INVENTORY_KEYS_DENIED"));
                    }
                    let value=map.get("compatibleItemType").and_then(|v|v.as_str())
                        .ok_or(err("DEV_SEMANTIC_COMPATIBLE_TYPE_REQUIRED"))?;
                    if value.len()>64{return Err(err("DEV_SEMANTIC_COMPATIBLE_TYPE_BOUNDS"));}
                    commands.push(crate::TypedSemanticCommand::InventoryExistingAmountDecrease{
                        inventory_id:number("inventoryId")?,
                        canonical_item_id:number("canonicalItemId")?,
                        expected_compatible_item_type:value.to_owned(),
                        expected_old_amount:old,new_amount:new
                    });
                },
                "ChestExistingSlotAmountDecrease"=>{
                    if map.len()!=6||
                       !["kind","containerId","slotIndex","expectedItemId",
                         "expectedOldAmount","newAmount"]
                         .iter().all(|k|map.contains_key(*k)){
                        return Err(err("DEV_SEMANTIC_CHEST_KEYS_DENIED"));
                    }
                    commands.push(crate::TypedSemanticCommand::ChestExistingSlotAmountDecrease{
                        container_id:number("containerId")?,
                        slot_index:usize::try_from(number("slotIndex")?)
                            .map_err(|_|err("DEV_SEMANTIC_SLOT_BOUNDS"))?,
                        expected_item_id:number("expectedItemId")?,
                        expected_old_amount:old,new_amount:new
                    });
                },
                _=>return Err(err("DEV_SEMANTIC_OPERATION_NOT_ACCEPTED"))
            }
        }
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,
            session_id:from_hex(session_id)?,
            expected_revision:revision,
            expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::Stage
        };
        let r=guard.stage_dev_semantic(scope,&commands).map_err(|e|err(e.0))?;
        Ok(Self::dev_semantic_receipt(&r))
    }
    #[cfg(feature="semantic-writer-dev")]
    fn dev_semantic_receipt(r:&crate::SemanticStageReceipt)->String{
        serde_json::json!({
            "contract":"wand.worker.dev-semantic-amount@1",
            "sessionId":hex(&r.session_id),
            "revision":r.revision,
            "indexGeneration":r.index_generation,
            "originalDecodedSha256":hex(&r.original_decoded_sha256),
            "stagedDecodedSha256":hex(&r.staged_decoded_sha256),
            "operationCount":r.operation_count,
            "applied":r.applied,
            "semanticChanged":r.semantic_changed,
            "nativeV3Verified":false,
            "writerAuthorized":false,
            "originalOverwriteAuthorized":false
        }).to_string()
    }
    #[cfg(feature="semantic-writer-dev")]
    pub fn dev_undo_typed_amounts(&mut self,
        session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,
            session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::Stage
        };
        let r=guard.undo_dev_semantic(scope).map_err(|e|err(e.0))?;
        Ok(Self::dev_semantic_receipt(&r))
    }
    #[cfg(feature="semantic-writer-dev")]
    pub fn dev_redo_typed_amounts(&mut self,
        session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,
            session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::Stage
        };
        let r=guard.redo_dev_semantic(scope).map_err(|e|err(e.0))?;
        Ok(Self::dev_semantic_receipt(&r))
    }
    /// One-time DEV export from the existing Rust ledger. The returned
    /// plaintext never goes to the UI; the trusted Worker feeds the existing
    /// official P1G Codec. Only <=1MiB chunks cross the Rust Worker ABI.
    #[cfg(feature="semantic-writer-dev")]
    pub fn dev_begin_edited_copy(&mut self,
        session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.semantic_export.is_some(){return Err(err("DEV_SEMANTIC_EXPORT_ALREADY_STARTED"));}
        let guard=self.session.take().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let scope=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,
            session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,
            action:WorkerAction::ExportEditedCopy
        };
        let mut bytes=guard.take_dev_edited_once(scope).map_err(|e|err(e.0))?;
        drop(guard); // no second session; Rust original source now closed
        if bytes.is_empty()||bytes.len()>MAX_WORKER_DOCUMENT {
            bytes.fill(0);
            return Err(err("DEV_SEMANTIC_EXPORT_BOUNDS"));
        }
        use sha2::Digest;
        let digest:[u8;32]=sha2::Sha256::digest(&bytes).into();
        self.semantic_export_offset=0;
        let length=bytes.len();
        self.semantic_export=Some(bytes);
        Ok(serde_json::json!({
            "contract":"wand.worker.dev-semantic-export@1",
            "totalBytes":length,"stagedDecodedSha256":hex(&digest),
            "writerAuthorized":false,"originalOverwriteAuthorized":false
        }).to_string())
    }
    #[cfg(feature="semantic-writer-dev")]
    pub fn dev_take_edited_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        let bytes=self.semantic_export.as_mut()
            .ok_or(err("DEV_SEMANTIC_EXPORT_NOT_STARTED_OR_CONSUMED"))?;
        let start=self.semantic_export_offset;
        if start>=bytes.len(){return Err(err("DEV_SEMANTIC_EXPORT_CONSUMED"));}
        let end=start.saturating_add(MAX_CHUNK).min(bytes.len());
        let chunk=bytes[start..end].to_vec();
        bytes[start..end].fill(0);
        self.semantic_export_offset=end;
        if end==bytes.len(){
            if let Some(mut finished)=self.semantic_export.take(){finished.fill(0);}
            self.semantic_export_offset=0;
        }
        Ok(chunk)
    }
    pub fn close(&mut self)->Result<(),JsValue>{
        self.closed=true;self.buffer.clear();self.entropy.fill(0);
        #[cfg(feature="semantic-writer-dev")]
        {if let Some(mut exported)=self.semantic_export.take(){exported.fill(0);}
         self.semantic_export_offset=0;}
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
        #[cfg(feature="semantic-writer-dev")]
        {if let Some(mut exported)=self.semantic_export.take(){exported.fill(0);}
         self.semantic_export_offset=0;}
        if let Some(mut guard)=self.session.take() {
            let _=guard.close();
        }
    }
}
