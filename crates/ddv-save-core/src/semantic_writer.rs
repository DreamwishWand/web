//! 01A CORE: one *existing* Rust ProductSession owns semantic mutations.
//! DEV-only feature "semantic-writer-dev"; not linked by Pages worker-wasm.
//! Real changes to existing saved Amount tokens, NEVER schema Version NOOP.
//! This source does not authorize game Native V3, Product Writer, cloud,
//! owned/premium entitlement, or the original P1G replacement.
use super::{ProductSession,State,WorkerAction,WorkerEnvelope,Platform,BuildKind,
    PRODUCT_WORKER_CONTRACT};
use super::indexed_read::{self,Span};
use crate::{CoreError,CoreResult,strict_document::validate_entire_document};
use sha2::{Digest,Sha256};

const EXACT_STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_TX_COMMANDS:usize=16;
const MAX_MAP_ID:u64=u32::MAX as u64;
const MAX_CONSERVATIVE_AMOUNT:u64=9999;
const MAX_CONTAINER_SLOTS:usize=256;

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum TypedOperationKind{
    InventoryExistingAmountDecrease,
    ChestExistingSlotAmountDecrease,
    AppearanceSelection,
    WardrobeSelection,
    IndependentTime,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct TypedOperationRegistryEntry{
    pub kind:TypedOperationKind,
    pub name:&'static str,
    pub schema:u64,
    pub dev_implementation:bool,
    pub native_v3_verified:bool,
    pub product_enabled:bool,
}
/// Product enablement is *always* FALSE. 01D/01E native validation may
/// independently open a single operation later, never a general Writer flag.
pub const TYPED_OPERATION_REGISTRY:[TypedOperationRegistryEntry;5]=[
    TypedOperationRegistryEntry{kind:TypedOperationKind::InventoryExistingAmountDecrease,
        name:"inventory.existing.amount.decrease@1",schema:626,
        dev_implementation:true,native_v3_verified:false,product_enabled:false},
    TypedOperationRegistryEntry{kind:TypedOperationKind::ChestExistingSlotAmountDecrease,
        name:"chest.existing.slot.amount.decrease@1",schema:626,
        dev_implementation:true,native_v3_verified:false,product_enabled:false},
    TypedOperationRegistryEntry{kind:TypedOperationKind::AppearanceSelection,
        name:"appearance.selection@1",schema:626,
        dev_implementation:false,native_v3_verified:false,product_enabled:false},
    TypedOperationRegistryEntry{kind:TypedOperationKind::WardrobeSelection,
        name:"wardrobe.selection@1",schema:626,
        dev_implementation:false,native_v3_verified:false,product_enabled:false},
    TypedOperationRegistryEntry{kind:TypedOperationKind::IndependentTime,
        name:"time.independent@1",schema:626,
        dev_implementation:false,native_v3_verified:false,product_enabled:false},
];

#[derive(Clone,Debug)]
pub enum TypedSemanticCommand{
    InventoryExistingAmountDecrease {
        inventory_id:u32,canonical_item_id:u32,
        expected_compatible_item_type:String,
        expected_old_amount:u32,new_amount:u32,
    },
    ChestExistingSlotAmountDecrease {
        container_id:u32,slot_index:usize,expected_item_id:u32,
        expected_old_amount:u32,new_amount:u32,
    },
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SemanticStageReceipt{
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub original_decoded_sha256:[u8;32],
    pub staged_decoded_sha256:[u8;32],
    pub operation_count:usize,
    pub exact_field_changed_count:usize,
    pub semantic_changed:bool,
    pub applied:bool,
    pub native_v3_verified:bool,
    pub product_writer_authorized:bool,
    pub original_overwrite_authorized:bool,
}
pub(super) struct SemanticLedger{
    pub(super) edited:Vec<u8>,
    pub(super) edited_sha:[u8;32],
    pub(super) operation_count:usize,
    pub(super) applied:bool,
    pub(super) consumed:bool,
}
#[derive(Clone,Debug)]
struct Replacement {
    span:Span,
    old:Vec<u8>,
    new:Vec<u8>,
}

fn denied(s:&'static str)->CoreError {CoreError(s)}
fn sha(bytes:&[u8])->[u8;32]{Sha256::digest(bytes).into()}
fn valid_id(id:u32)->CoreResult<()>{
    if id==0{return Err(denied("SEMANTIC_ITEM_OR_INVENTORY_ID_ZERO"));}
    Ok(())
}
fn valid_amount_decrease(old:u32,new:u32)->CoreResult<()>{
    if old==0||old as u64>MAX_CONSERVATIVE_AMOUNT||
       new==0||new>=old {
        return Err(denied("SEMANTIC_EXISTING_POSITIVE_DECREASE_ONLY"));
    }
    Ok(())
}
fn object_field(bytes:&[u8], parent:Span, sought:&str)->CoreResult<Span>{
    if bytes.get(parent.begin)!=Some(&b'{')||
       bytes.get(parent.end.saturating_sub(1))!=Some(&b'}')||
       parent.begin>=parent.end||parent.end>bytes.len(){
       return Err(denied("SEMANTIC_OBJECT_PARENT_REQUIRED"));
    }
    let mut i=parent.begin+1;
    loop {
        i=indexed_read::skip_ws(bytes,i);
        if i>=parent.end{return Err(denied("SEMANTIC_MAP_OUT_OF_SPAN"));}
        if i==parent.end-1{return Err(denied("SEMANTIC_TARGET_NOT_PRESENT"));}
        let k_end=indexed_read::string_end(bytes,i)?;
        if k_end-i>128{return Err(denied("SEMANTIC_KEY_BOUNDS"));}
        let k:String=serde_json::from_slice(&bytes[i..k_end])
            .map_err(|_|denied("SEMANTIC_KEY_INVALID"))?;
        i=indexed_read::skip_ws(bytes,k_end);
        if bytes.get(i)!=Some(&b':'){return Err(denied("SEMANTIC_KEY_COLON"));}
        let begin=indexed_read::skip_ws(bytes,i+1);
        let end=indexed_read::value_end(bytes,begin)?;
        if end>=parent.end{return Err(denied("SEMANTIC_FIELD_OUT_OF_PARENT"));}
        if k==sought{return Ok(Span{begin,end});}
        i=indexed_read::skip_ws(bytes,end);
        match bytes.get(i){
            Some(b',')=>i+=1,
            Some(b'}') if i==parent.end-1=>
                return Err(denied("SEMANTIC_TARGET_NOT_PRESENT")),
            _=>return Err(denied("SEMANTIC_MAP_TERMINATOR")),
        }
    }
}
fn array_element(bytes:&[u8],parent:Span,at:usize)->CoreResult<Span>{
    if at>=MAX_CONTAINER_SLOTS{return Err(denied("SEMANTIC_SLOT_INDEX_BOUNDS"));}
    if bytes.get(parent.begin)!=Some(&b'[')||
       bytes.get(parent.end.saturating_sub(1))!=Some(&b']')||
       parent.end>bytes.len(){return Err(denied("SEMANTIC_ARRAY_REQUIRED"));}
    let mut i=parent.begin+1;
    for index in 0..=at{
        i=indexed_read::skip_ws(bytes,i);
        if i>=parent.end-1{return Err(denied("SEMANTIC_SLOT_NOT_PRESENT"));}
        let begin=i;
        let end=indexed_read::value_end(bytes,begin)?;
        if end>=parent.end{return Err(denied("SEMANTIC_SLOT_SPAN_BOUNDS"));}
        if index==at{return Ok(Span{begin,end});}
        i=indexed_read::skip_ws(bytes,end);
        if bytes.get(i)!=Some(&b','){return Err(denied("SEMANTIC_SLOT_NOT_PRESENT"));}
        i+=1;
    }
    Err(denied("SEMANTIC_SLOT_NOT_PRESENT"))
}
fn number(bytes:&[u8],span:Span)->CoreResult<u64>{
    let token=bytes.get(span.begin..span.end)
        .ok_or(denied("SEMANTIC_NUMBER_SPAN_INVALID"))?;
    if token.is_empty()||token.len()>12||
       !token.iter().all(u8::is_ascii_digit)||
       (token.len()>1&&token[0]==b'0'){
        return Err(denied("SEMANTIC_UNSIGNED_INTEGER_REQUIRED"));
    }
    serde_json::from_slice::<u64>(token)
        .map_err(|_|denied("SEMANTIC_INTEGER_INVALID"))
}
fn positive_id_field(bytes:&[u8],parent:Span,name:&str,id:u32)->CoreResult<()>{
    valid_id(id)?;
    if number(bytes,object_field(bytes,parent,name)?)?!=id as u64{
        return Err(denied("SEMANTIC_CONTAINER_ID_MISMATCH"));
    }
    Ok(())
}
fn raw_boolean_true(bytes:&[u8],span:Span)->CoreResult<()>{
    if bytes.get(span.begin..span.end)!=Some(&b"true"[..]){
        return Err(denied("SEMANTIC_PLAYER_OWNED_CONTAINER_REQUIRED"));
    }
    Ok(())
}
fn compatible_type(bytes:&[u8],span:Span,expected:&str)->CoreResult<()>{
    if expected.len()>64||!expected.starts_with("ItemType_")||
       !expected.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_')||
       ["Premium","DLC","Entitlement","Receipt","Auth","Currency","Moonstone","Quest"]
        .iter().any(|v|expected.contains(v)){
        return Err(denied("SEMANTIC_PROTECTED_ITEM_TYPE"));
    }
    let actual:String=serde_json::from_slice(
        bytes.get(span.begin..span.end).ok_or(denied("SEMANTIC_TYPE_SPAN"))?)
        .map_err(|_|denied("SEMANTIC_COMPATIBLE_TYPE_REQUIRED"))?;
    if actual!=expected{return Err(denied("SEMANTIC_COMPATIBLE_TYPE_CAS"));}
    Ok(())
}
fn validate_old_amount(bytes:&[u8],span:Span,old:u32,new:u32)
    ->CoreResult<Replacement>{
    valid_amount_decrease(old,new)?;
    if number(bytes,span)?!=old as u64{
        return Err(denied("SEMANTIC_OLD_VALUE_CAS"));
    }
    let replacement=new.to_string().into_bytes();
    let original=bytes[span.begin..span.end].to_vec();
    if original==replacement{return Err(denied("SEMANTIC_NO_CHANGE"));}
    Ok(Replacement{span,old:original,new:replacement})
}
fn target(bytes:&[u8],player:Span,cmd:&TypedSemanticCommand)
    ->CoreResult<Replacement>{
    match cmd{
        TypedSemanticCommand::InventoryExistingAmountDecrease{
            inventory_id,canonical_item_id,expected_compatible_item_type,
            expected_old_amount,new_amount
        }=>{
            valid_id(*inventory_id)?;
            valid_id(*canonical_item_id)?;
            let lists=object_field(bytes,player,"ListInventories")?;
            let record=object_field(bytes,lists,&inventory_id.to_string())?;
            positive_id_field(bytes,record,"ID",*inventory_id)?;
            compatible_type(bytes,object_field(bytes,record,"CompatibleItemType")?,
                            expected_compatible_item_type)?;
            let items=object_field(bytes,record,"Inventory")?;
            let entry=object_field(bytes,items,&canonical_item_id.to_string())?;
            validate_old_amount(bytes,object_field(bytes,entry,"Amount")?,
                                *expected_old_amount,*new_amount)
        }
        TypedSemanticCommand::ChestExistingSlotAmountDecrease {
            container_id,slot_index,expected_item_id,
            expected_old_amount,new_amount
        }=>{
            valid_id(*container_id)?;
            valid_id(*expected_item_id)?;
            let containers=object_field(bytes,player,"ContainerInventories")?;
            let record=object_field(bytes,containers,&container_id.to_string())?;
            positive_id_field(bytes,record,"ID",*container_id)?;
            raw_boolean_true(bytes,object_field(bytes,record,"BelongsToPlayer")?)?;
            let parent=object_field(bytes,record,"ParentItemID")?;
            if number(bytes,parent)?==0||number(bytes,parent)?>MAX_MAP_ID{
                return Err(denied("SEMANTIC_PARENT_ITEM_INVALID"));
            }
            let slots=object_field(bytes,record,"Inventory")?;
            // Count total before mutation; Size and physical slots must agree
            // in *this* saved structure, without inventing a new slot.
            let declared=number(bytes,object_field(bytes,record,"Size")?)?;
            if declared==0||declared>MAX_CONTAINER_SLOTS as u64{
                return Err(denied("SEMANTIC_CONTAINER_SIZE_INVALID"));
            }
            let mut index=0usize;
            while array_element(bytes,slots,index).is_ok() {
                index+=1;
                if index>MAX_CONTAINER_SLOTS {break;}
            }
            if index!=declared as usize{
                return Err(denied("SEMANTIC_CONTAINER_SLOTS_SIZE_MISMATCH"));
            }
            let slot=array_element(bytes,slots,*slot_index)?;
            positive_id_field(bytes,slot,"ItemID",*expected_item_id)?;
            validate_old_amount(bytes,object_field(bytes,slot,"Amount")?,
                                *expected_old_amount,*new_amount)
        }
    }
}
fn build_check(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    if b.platform!=Platform::SteamWindows||b.build_kind!=BuildKind::SteamFullVersion||
       b.build_id!=EXACT_STEAM||b.schema!=626||!b.externally_attested {
        return Err(denied("SEMANTIC_EXACT_STEAM626_REQUIRED"));
    }
    Ok(())
}
fn check(s:&ProductSession,st:&State,e:&WorkerEnvelope,action:WorkerAction)
    ->CoreResult<()>{
    if st.closed{return Err(denied("SESSION_CLOSED"));}
    if e.contract!=PRODUCT_WORKER_CONTRACT||e.session_id!=st.id||
       e.expected_decoded_sha256!=s.sha{
        return Err(denied("SESSION_SOURCE_SCOPE_MISMATCH"));
    }
    if e.expected_revision!=st.revision||e.expected_index_generation!=st.generation{
        return Err(denied("SESSION_REVISION_GENERATION_CAS"));
    }
    if e.action!=action{return Err(denied("SEMANTIC_ACTION_DENIED"));}
    Ok(())
}
fn receipt(s:&ProductSession,st:&State)->CoreResult<SemanticStageReceipt>{
    let ledger=st.semantic.as_ref().ok_or(denied("SEMANTIC_NOT_STAGED"))?;
    Ok(SemanticStageReceipt{
        session_id:st.id,revision:st.revision,index_generation:st.generation,
        original_decoded_sha256:s.sha,staged_decoded_sha256:ledger.edited_sha,
        operation_count:ledger.operation_count,
        exact_field_changed_count:ledger.operation_count,
        semantic_changed:ledger.edited_sha!=s.sha,
        applied:ledger.applied,native_v3_verified:false,
        product_writer_authorized:false,original_overwrite_authorized:false
    })
}
impl ProductSession{
    /// DEV source, Owner-private only. One atomic batch with true old-value
    /// CAS, same Rust Source SHA+SessionID+Revision+IndexGeneration envelope.
    /// No product Worker/Writer ABI and no private P1G bytes passed to GitHub.
    pub fn stage_typed_semantic_batch(
        &self,e:WorkerEnvelope,commands:&[TypedSemanticCommand]
    )->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        if commands.is_empty()||commands.len()>MAX_TX_COMMANDS{
            return Err(denied("SEMANTIC_BATCH_BOUNDS"));
        }
        // Existing strict ProductSession full JSON validator already ran at
        // open. Reuse its indexed lexer and immutable byte slices, no second
        // Reader or 200-300MiB serde_json::Value materialization.
        let roots=indexed_read::roots(&self.decoded)?;
        let mut edits=Vec::with_capacity(commands.len());
        for cmd in commands{edits.push(target(&self.decoded,roots.player,cmd)?);}
        edits.sort_by_key(|r|r.span.begin);
        for pair in edits.windows(2){
            if pair[0].span.end>pair[1].span.begin {
                return Err(denied("SEMANTIC_TARGET_OVERLAP_OR_DUPLICATE"));
            }
        }
        let mut edited=self.decoded.to_vec();
        for change in edits.iter().rev(){
            if edited.get(change.span.begin..change.span.end)!=Some(change.old.as_slice()){
                return Err(denied("SEMANTIC_EXACT_OLD_RAW_TOKEN_CAS"));
            }
            edited.splice(change.span.begin..change.span.end,change.new.iter().copied());
        }
        validate_entire_document(&edited,self.schema)?;
        let edited_sha=sha(&edited);
        if edited_sha==self.sha{return Err(denied("SEMANTIC_BATCH_NO_MEANING_CHANGE"));}
        // Commit is all-or-nothing on the SAME mutex and SAME Source ledger.
        let mut st=self.lock()?;
        check(self,&st,&e,WorkerAction::Stage)?;
        if st.semantic.is_some(){return Err(denied("SEMANTIC_STAGE_ALREADY_EXISTS"));}
        #[cfg(feature="private-native-v2")]
        if st.private_offline.is_some(){return Err(denied("SEMANTIC_PRIVATE_NOOP_CONFLICT"));}
        #[cfg(feature="synthetic-stage-b")]
        if st.lab.is_some(){return Err(denied("SEMANTIC_SYNTHETIC_LAB_CONFLICT"));}
        let rev=st.revision.checked_add(1).ok_or(denied("REVISION_OVERFLOW"))?;
        let gen=st.generation.checked_add(1).ok_or(denied("GENERATION_OVERFLOW"))?;
        st.semantic=Some(SemanticLedger{edited,edited_sha,operation_count:edits.len(),
                                      applied:true,consumed:false});
        st.indexed=None; // Existing Indexed Cursor grant table revoked.
        st.revision=rev;
        st.generation=gen;
        receipt(self,&st)
    }
    fn semantic_toggle(&self,e:WorkerEnvelope,apply:bool)
        ->CoreResult<SemanticStageReceipt>{
        let mut st=self.lock()?;
        check(self,&st,&e,WorkerAction::Stage)?;
        let ledger=st.semantic.as_ref().ok_or(denied("SEMANTIC_NOT_STAGED"))?;
        if ledger.consumed||ledger.applied==apply{
            return Err(denied("SEMANTIC_UNDO_REDO_REPLAY"));
        }
        let rev=st.revision.checked_add(1).ok_or(denied("REVISION_OVERFLOW"))?;
        let gen=st.generation.checked_add(1).ok_or(denied("GENERATION_OVERFLOW"))?;
        st.semantic.as_mut().ok_or(denied("SEMANTIC_NOT_STAGED"))?.applied=apply;
        st.revision=rev;st.generation=gen;
        st.indexed=None;
        receipt(self,&st)
    }
    pub fn undo_typed_semantic_batch(&self,e:WorkerEnvelope)->CoreResult<SemanticStageReceipt>{
        self.semantic_toggle(e,false)
    }
    pub fn redo_typed_semantic_batch(&self,e:WorkerEnvelope)->CoreResult<SemanticStageReceipt>{
        self.semantic_toggle(e,true)
    }
    /// Private V2 decode pipe. Original P1G remains immutable and its SHA
    /// must be verified by the existing local Codec/Backup/Export wrapper
    /// before naming the output "Edited-copy". One-time bytes, no game Apply.
    pub fn take_typed_semantic_decoded_once(&self,e:WorkerEnvelope)
        ->CoreResult<Vec<u8>>{
        let mut st=self.lock()?;
        check(self,&st,&e,WorkerAction::ExportEditedCopy)?;
        let ledger=st.semantic.as_ref().ok_or(denied("SEMANTIC_NOT_STAGED"))?;
        if !ledger.applied||ledger.consumed{
            return Err(denied("SEMANTIC_EXPORT_NOT_STAGED_OR_REPLAY"));
        }
        if sha(&ledger.edited)!=ledger.edited_sha||ledger.edited_sha==self.sha{
            return Err(denied("SEMANTIC_EXPORT_INTEGRITY"));
        }
        validate_entire_document(&ledger.edited,self.schema)?;
        let next=st.generation.checked_add(1).ok_or(denied("GENERATION_OVERFLOW"))?;
        let output=ledger.edited.clone();
        st.semantic.as_mut().ok_or(denied("SEMANTIC_NOT_STAGED"))?.consumed=true;
        st.closed=true;st.generation=next;st.indexed=None;
        Ok(output)
    }
}
