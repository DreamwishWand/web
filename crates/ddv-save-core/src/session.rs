//! Unified Wand-owned SaveSession research V1.
//! Production meaning stays in Wand transaction-foundation / storage / ownership
//! adapters. This module grants neither P1G export nor persistent replacement.
use crate::{sha256,validate_json,index_selected_tokens,EngineResult,SpanHit,MAX_DECODED_JSON_BYTES};
use std::{collections::{BTreeMap,BTreeSet},sync::Arc};

pub const SESSION_CONTRACT:&str="dreamwish.ddv.unified-save-session.research@1";
const MAX_COMMANDS:usize=64;
const MAX_HISTORY:usize=128;
const MAX_PAGE:usize=64;
const MAX_PROJECTION_BYTES:usize=512;
#[derive(Clone,Copy,Debug,PartialEq,Eq,PartialOrd,Ord)]
pub enum Domain {
    Ownership, ListInventory, CollectionSet, ContainerInventory, Chest,
    Grid, DiffGrid, SubGrid, Quest, Progression, RecurringEvent,
}
#[derive(Clone,Debug,PartialEq,Eq,PartialOrd,Ord)]
pub struct LogicalIdentity {pub domain:Domain,pub key:String}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ReferenceEdge {pub from:LogicalIdentity,pub to:LogicalIdentity}
#[derive(Clone,Debug,Default,PartialEq,Eq)]
pub struct ReferenceIndex {
    /// This is an asserted *research* graph, not derived save semantics.
    /// The domain-owned Wand validator must establish its provenance.
    pub nodes:BTreeSet<LogicalIdentity>,
    pub edges:Vec<ReferenceEdge>,
}
impl ReferenceIndex {
    pub fn check(&self)->EngineResult<()> {
        if self.nodes.len()>1_000_000 || self.edges.len()>2_000_000 {
            return Err("REFERENCE_INDEX_TOO_LARGE");
        }
        let mut seen=BTreeSet::new();
        for edge in &self.edges {
            if !self.nodes.contains(&edge.from)||!self.nodes.contains(&edge.to) {
                return Err("REFERENCE_TARGET_MISSING");
            }
            if !seen.insert((edge.from.clone(),edge.to.clone())) {
                return Err("DUPLICATE_REFERENCE_EDGE");
            }
        }
        Ok(())
    }
    pub fn outbound(&self,from:&LogicalIdentity)->Vec<ReferenceEdge>{
        self.edges.iter().filter(|e|&e.from==from).cloned().collect()
    }
}
/// Core-scanned exact path evidence; explicitly NOT an exhaustive cross-domain graph.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SourcePathWitness {
 pub identity:LogicalIdentity,
 pub exact_pointer:String,
 pub lexical_token_sha256:[u8;32],
 pub observed_token_bytes:usize,
 pub source_revision:u64,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SourceDerivedReferenceAudit {
 pub original_decoded_sha256:[u8;32],
 pub inspected_snapshot_sha256:[u8;32],
 pub revision:u64,
 pub index_generation:u64,
 pub witnessed:Vec<SourcePathWitness>,
 pub all_requested_paths_observed:bool,
 pub cross_domain_reference_closure_complete:bool,
 pub domain_reference_semantics_verified:bool,
 pub usable_for_product_writer:bool,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum BackingKind {OwnedMemory}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum CommandKind {ReplaceStringToken,ReplaceKnownSubtree}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ReadWitness {pub pointer:String,pub expected_raw_json:String}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SemanticCommand {
    pub domain:Domain,
    pub identity:LogicalIdentity,
    pub kind:CommandKind,
    pub pointer:String,
    pub expected_old_json:String,
    pub new_json:String,
    pub read_set:Vec<ReadWitness>,
}
#[derive(Clone,Debug)]
pub struct TransactionPlan {
    pub session_id:u64,
    pub expected_revision:u64,
    pub expected_source_sha256:[u8;32],
    pub commands:Vec<SemanticCommand>,
    pub postconditions:Vec<ReadWitness>,
    /// Research-only graph supplied by the EXISTING Wand semantic owners;
    /// MUST NOT be received from untrusted UI or used for product authorization.
    pub post_references:ReferenceIndex,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ChangeSet {
    pub from_revision:u64,
    pub to_revision:u64,
    pub affected:Vec<LogicalIdentity>,
    pub changed_paths:Vec<String>,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct Projection {
    pub pointer:String,
    pub preview_json:String,
    pub byte_span:(usize,usize),
    pub revision:u64,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ValidationReceipt {
    pub session_id:u64,
    pub revision:u64,
    pub source_sha256:[u8;32],
    pub staged_sha256:[u8;32],
    pub staged_bytes:usize,
    pub transaction_count:usize,
    pub references_internally_consistent:bool,
    pub semantic_domain_guards_accepted:bool,
    pub encode_copy_authorized:bool,
    pub persistent_replace_authorized:bool,
}
#[derive(Clone)]
struct Committed {
    commands:Vec<SemanticCommand>,
    before:ReferenceIndex,
    after:ReferenceIndex,
    change:ChangeSet,
}
/// Original immutable bytes persist while only tiny plans and reference
/// snapshots are retained. Staged document bytes are TEMPORARY for validation,
/// not an always-resident whole parsed object graph.
pub struct SaveSession {
    session_id:u64,
    source:Arc<[u8]>,
    source_sha:[u8;32],
    schema:u64,
    backing:BackingKind,
    revision:u64,
    index_generation:u64,
    history:Vec<Committed>,
    redo:Vec<Committed>,
    references:ReferenceIndex,
    lazy_index:BTreeMap<String,SpanHit>,
    cached_generation:u64,
}
impl SaveSession {
    pub fn open_decoded_research(
        session_id:u64,decoded_json:Vec<u8>,schema:u64,refs:ReferenceIndex
    )->EngineResult<Self>{
        Self::open_decoded_shared_research(
            session_id,Arc::from(decoded_json),schema,refs
        )
    }
    /// Core-private native research path: validate an already immutable
    /// strict-decoded source owned by TrustedReadCore WITHOUT a full JSON clone.
    /// This remains a separate staging engine; it grants no product Writer.
    pub(crate) fn open_decoded_shared_research(
        session_id:u64,decoded_json:Arc<[u8]>,schema:u64,refs:ReferenceIndex
    )->EngineResult<Self>{
        if session_id==0{return Err("SESSION_ID_REQUIRED");}
        if decoded_json.len()>MAX_DECODED_JSON_BYTES{return Err("JSON_TOO_LARGE");}
        validate_json(&decoded_json)?;
        let schema_ptr="/GameInfo/Version".to_owned();
        let found=index_selected_tokens(&decoded_json,&[schema_ptr])?;
        if found.first().map(|x|x.value.parse::<u64>().ok())!=Some(Some(schema)) {
            return Err("SAVE_SCHEMA_MISMATCH");
        }
        refs.check()?;
        crate::semantic_safety::verify_observed_chest_edges(&decoded_json,&refs)?;
        let hash=sha256(&decoded_json);
        Ok(Self {
            session_id,source:decoded_json,source_sha:hash,schema,
            backing:BackingKind::OwnedMemory,revision:0,index_generation:0,
            history:Vec::new(),redo:Vec::new(),references:refs,
            lazy_index:BTreeMap::new(),cached_generation:0
        })
    }
    /// Evidence-only pointer identity check, never raw source disclosure.
    pub(crate) fn shares_immutable_source_research(&self,source:&Arc<[u8]>)->bool{
        Arc::ptr_eq(&self.source,source)
    }
    pub fn session_id(&self)->u64{self.session_id}
    pub fn revision(&self)->u64{self.revision}
    pub fn source_sha256(&self)->[u8;32]{self.source_sha}
    pub fn original_len(&self)->usize{self.source.len()}
    pub fn backing_kind(&self)->BackingKind{self.backing}
    pub fn index_generation(&self)->u64{self.index_generation}
    pub fn inspect_references(&self,identity:&LogicalIdentity)->EngineResult<Vec<ReferenceEdge>>{
        if !self.references.nodes.contains(identity){return Err("UNKNOWN_REFERENCE_IDENTITY");}
        self.references.check()?;
        Ok(self.references.outbound(identity))
    }
    /// Strictly derive the presence and raw hashes of specific current-source
    /// locations. Caller-provided edges do not imply complete semantic closure.
    /// Every call re-evaluates staged bytes for current Revision; no stale
    /// pre-transaction witness can become a positive Writer capability.
    pub fn inspect_source_reference_paths(
        &self,required:&[(LogicalIdentity,String)]
    )->EngineResult<SourceDerivedReferenceAudit>{
        if required.is_empty()||required.len()>256{return Err("SOURCE_REFERENCE_SCOPE_INVALID");}
        let mut seen=BTreeSet::new();
        let mut ptrs=Vec::with_capacity(required.len());
        for (_,path) in required {
            if !path.starts_with('/')||path.len()>1024||path.contains("//")||
               !seen.insert(path.clone()) {return Err("SOURCE_REFERENCE_POINTER_INVALID");}
            ptrs.push(path.clone());
        }
        let current=self.materialize()?;
        let tokens=index_selected_tokens(&current,&ptrs)?;
        if tokens.len()!=required.len(){return Err("SOURCE_REFERENCE_PATH_MISSING");}
        let map:BTreeMap<String,SpanHit>=tokens.into_iter().map(|x|(x.pointer.clone(),x)).collect();
        let mut witnessed=Vec::with_capacity(required.len());
        for (identity,path) in required {
            let token=map.get(path).ok_or("SOURCE_REFERENCE_PATH_MISSING")?;
            witnessed.push(SourcePathWitness {
                identity:identity.clone(),exact_pointer:path.clone(),
                lexical_token_sha256:sha256(token.value.as_bytes()),
                observed_token_bytes:token.value.len(),source_revision:self.revision
            });
        }
        Ok(SourceDerivedReferenceAudit {
            original_decoded_sha256:self.source_sha,
            inspected_snapshot_sha256:sha256(&current),
            revision:self.revision,index_generation:self.index_generation,witnessed,
            all_requested_paths_observed:true,
            cross_domain_reference_closure_complete:false,
            domain_reference_semantics_verified:false,usable_for_product_writer:false
        })
    }
    /// Read-focused index is rebuilt after each edit, not cached against an old revision.
    pub fn query_paged(&mut self,pointers:&[String],cursor:usize,limit:usize)
        ->EngineResult<Vec<Projection>>{
        if limit==0||limit>MAX_PAGE{return Err("QUERY_PAGE_LIMIT");}
        if pointers.len()>512{return Err("QUERY_WATCH_TOO_LARGE");}
        if self.cached_generation!=self.index_generation {
            self.lazy_index.clear();
            self.cached_generation=self.index_generation;
        }
        let missing:Vec<String>=pointers.iter()
            .filter(|p|!self.lazy_index.contains_key(*p)).cloned().collect();
        if !missing.is_empty() {
            let content=self.materialize()?;
            let hits=index_selected_tokens(&content,&missing)?;
            for hit in hits {
                self.lazy_index.insert(hit.pointer.clone(),hit);
            }
        }
        Ok(pointers.iter().skip(cursor).take(limit)
            .filter_map(|pointer|self.lazy_index.get(pointer).map(|hit|Projection {
                pointer:hit.pointer.clone(),
                preview_json: if hit.value.len()>MAX_PROJECTION_BYTES {
                    String::from("[OPAQUE_TOO_LARGE]")
                } else {hit.value.clone()},
                byte_span:(hit.span.start,hit.span.end),
                revision:self.revision
            })).collect())
    }
    pub fn stage_command(&mut self,plan:TransactionPlan)->EngineResult<ChangeSet>{
        if plan.session_id!=self.session_id{return Err("STALE_SESSION");}
        if plan.expected_revision!=self.revision{return Err("STALE_REVISION");}
        if plan.expected_source_sha256!=self.source_sha{return Err("SOURCE_SHA_CAS_FAILED");}
        if plan.commands.is_empty()||plan.commands.len()>MAX_COMMANDS{return Err("TX_COMMAND_COUNT");}
        if self.history.len()>=MAX_HISTORY{return Err("TX_HISTORY_LIMIT");}
        self.references.check()?;
        plan.post_references.check()?;
        let mut seen=BTreeSet::new();
        let mut touched=BTreeSet::new();
        for cmd in &plan.commands {
            if cmd.identity.domain!=cmd.domain{return Err("COMMAND_IDENTITY_DOMAIN");}
            if !self.references.nodes.contains(&cmd.identity) &&
               !plan.post_references.nodes.contains(&cmd.identity) {
                return Err("COMMAND_IDENTITY_NOT_INDEXED");
            }
            if !seen.insert(cmd.pointer.clone()) {return Err("DUPLICATE_WRITE_POINTER");}
            for witness in &cmd.read_set {
                if witness.pointer==cmd.pointer && witness.expected_raw_json!=cmd.expected_old_json {
                    return Err("READ_WRITE_CAS_DISAGREE");
                }
            }
            touched.insert(cmd.identity.clone());
        }
        let before=self.materialize()?;
        crate::semantic_safety::verify_observed_chest_edges(&before,&self.references)?;
        let after=apply_batch(&before,&plan.commands)?;
        crate::semantic_safety::verify_observed_chest_edges(&after,&plan.post_references)?;
        // Schema and all JSON fields are revalidated; no semantic domain rules
        // are fabricated here. Existing Wand validators own that missing gate.
        validate_json(&after)?;
        if plan.postconditions.len()>512{return Err("POSTCONDITION_LIMIT");}
        let post_paths:Vec<String>=plan.postconditions.iter().map(|p|p.pointer.clone()).collect();
        let post_hits=index_selected_tokens(&after,&post_paths)?;
        let post_map:BTreeMap<String,String>=post_hits.into_iter()
            .map(|x|(x.pointer,x.value)).collect();
        for witness in &plan.postconditions {
            if post_map.get(&witness.pointer)!=Some(&witness.expected_raw_json){
                return Err("POSTCONDITION_FAILED");
            }
        }
        let schema=index_selected_tokens(&after,&["/GameInfo/Version".into()])?;
        if schema.first().map(|s|s.value.parse::<u64>().ok())!=Some(Some(self.schema)){
            return Err("SAVE_SCHEMA_DRIFT");
        }
        if after==before{return Err("TX_NO_OP");}
        let next=self.revision.checked_add(1).ok_or("REVISION_OVERFLOW")?;
        let next_generation=self.index_generation.checked_add(1).ok_or("INDEX_GENERATION_OVERFLOW")?;
        let change=ChangeSet{
            from_revision:self.revision,to_revision:next,
            affected:touched.into_iter().collect(),
            changed_paths:seen.into_iter().collect()
        };
        // Atomic publication: everything above runs before touching history.
        let committed=Committed{
            commands:plan.commands,before:self.references.clone(),
            after:plan.post_references.clone(),change:change.clone()
        };
        self.history.push(committed);
        self.references=plan.post_references;
        self.redo.clear();
        self.revision=next;
        self.index_generation=next_generation;
        Ok(change)
    }
    pub fn undo(&mut self,expected_revision:u64)->EngineResult<ChangeSet>{
        if expected_revision!=self.revision{return Err("STALE_REVISION");}
        let next=self.revision.checked_add(1).ok_or("REVISION_OVERFLOW")?;
        let next_generation=self.index_generation.checked_add(1).ok_or("INDEX_GENERATION_OVERFLOW")?;
        let entry=self.history.pop().ok_or("UNDO_EMPTY")?;
        self.references=entry.before.clone();
        self.redo.push(entry.clone());
        self.revision=next;
        self.index_generation=next_generation;
        Ok(ChangeSet{from_revision:next-1,to_revision:next,
            affected:entry.change.affected,changed_paths:entry.change.changed_paths})
    }
    pub fn redo(&mut self,expected_revision:u64)->EngineResult<ChangeSet>{
        if expected_revision!=self.revision{return Err("STALE_REVISION");}
        let entry=self.redo.last().ok_or("REDO_EMPTY")?.clone();
        let before=self.materialize()?;
        let after=apply_batch(&before,&entry.commands)?;
        validate_json(&after)?;
        crate::semantic_safety::verify_observed_chest_edges(&after,&entry.after)?;
        if after==before{return Err("REDO_NO_OP");}
        let next=self.revision.checked_add(1).ok_or("REVISION_OVERFLOW")?;
        let next_generation=self.index_generation.checked_add(1).ok_or("INDEX_GENERATION_OVERFLOW")?;
        self.redo.pop();
        self.references=entry.after.clone();
        self.history.push(entry.clone());
        self.revision=next;
        self.index_generation=next_generation;
        Ok(ChangeSet{from_revision:next-1,to_revision:next,
            affected:entry.change.affected,changed_paths:entry.change.changed_paths})
    }
    pub fn validate_transaction(&self)->EngineResult<ValidationReceipt>{
        let current=self.materialize()?;
        validate_json(&current)?;
        self.references.check()?;
        crate::semantic_safety::verify_observed_chest_edges(&current,&self.references)?;
        if sha256(&self.source)!=self.source_sha{return Err("ORIGINAL_CHANGED");}
        Ok(ValidationReceipt{
            session_id:self.session_id,revision:self.revision,
            source_sha256:self.source_sha,staged_sha256:sha256(&current),
            staged_bytes:current.len(),transaction_count:self.history.len(),
            references_internally_consistent:true,
            semantic_domain_guards_accepted:false,
            encode_copy_authorized:false,persistent_replace_authorized:false
        })
    }
    pub fn export_verified_copy(&self)->EngineResult<Vec<u8>>{
        Err("PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED")
    }
    /// Rebuilds a temporary decoded JSON only for a validation or projection;
    /// the production streaming/OPFS backing store is intentionally NOT implemented.
    fn materialize(&self)->EngineResult<Vec<u8>>{
        if sha256(&self.source)!=self.source_sha{return Err("SOURCE_MUTATED");}
        let mut bytes=self.source.to_vec();
        for entry in &self.history {
            bytes=apply_batch(&bytes,&entry.commands)?;
        }
        Ok(bytes)
    }
}
fn apply_batch(before:&[u8],commands:&[SemanticCommand])->EngineResult<Vec<u8>>{
    if commands.is_empty()||commands.len()>MAX_COMMANDS{return Err("TX_COMMAND_COUNT");}
    let mut watched=BTreeSet::new();
    for cmd in commands {
        if !cmd.pointer.starts_with('/')||cmd.pointer.len()>1024||
           cmd.pointer.contains("//") {return Err("INVALID_WRITE_POINTER");}
        // Preserve the accepted Wand Transaction Foundation /GameInfo identity veto.
        // Schema equality by itself does not permit edits to owner/build metadata.
        if cmd.pointer=="/GameInfo"||cmd.pointer.starts_with("/GameInfo/") {
            return Err("IDENTITY_METADATA_WRITE_FORBIDDEN");
        }
        watched.insert(cmd.pointer.clone());
        for read in &cmd.read_set {
            if !read.pointer.starts_with('/')||read.pointer.len()>1024{
                return Err("INVALID_READ_POINTER");
            }
            watched.insert(read.pointer.clone());
        }
    }
    let watch:Vec<String>=watched.into_iter().collect();
    let found=index_selected_tokens(before,&watch)?;
    let map:BTreeMap<String,SpanHit>=found.into_iter().map(|x|(x.pointer.clone(),x)).collect();
    let mut replacements=Vec::with_capacity(commands.len());
    for cmd in commands {
        let hit=map.get(&cmd.pointer).ok_or("WRITE_POINTER_MISSING")?;
        if hit.value!=cmd.expected_old_json{return Err("OLD_VALUE_CAS_FAILED");}
        for read in &cmd.read_set {
            let value=map.get(&read.pointer).ok_or("READ_POINTER_MISSING")?;
            if value.value!=read.expected_raw_json{return Err("READ_SET_CAS_FAILED");}
        }
        validate_json(cmd.new_json.as_bytes())?;
        match cmd.kind {
            CommandKind::ReplaceStringToken=>{
                if !hit.value.starts_with('"')||!cmd.new_json.starts_with('"') {
                    return Err("STRING_TOKEN_REQUIRED");
                }
            }
            CommandKind::ReplaceKnownSubtree=>{
                // No broad rewrite without owner-supplied semantic validation.
                // This API remains research-only and does not attest that a
                // provided replacement preserves unknown fields INSIDE subtree.
                if cmd.new_json.len()>MAX_DECODED_JSON_BYTES/2{
                    return Err("STRUCTURAL_SUBTREE_TOO_LARGE");
                }
                crate::semantic_safety::reject_structural_loss(&hit.value,&cmd.new_json)?;
            }
        }
        if cmd.new_json==hit.value{return Err("NO_OP_DENIED");}
        replacements.push((hit.span.clone(),cmd.new_json.as_bytes()));
    }
    replacements.sort_by_key(|x|x.0.start);
    for x in replacements.windows(2){
        if x[0].0.end>x[1].0.start{return Err("OVERLAPPING_COMMANDS");}
    }
    let mut out=Vec::with_capacity(before.len());
    let mut pos=0;
    for (range,new) in replacements {
        out.extend_from_slice(&before[pos..range.start]);
        out.extend_from_slice(new);
        pos=range.end;
    }
    out.extend_from_slice(&before[pos..]);
    validate_json(&out)?;
    Ok(out)
}
