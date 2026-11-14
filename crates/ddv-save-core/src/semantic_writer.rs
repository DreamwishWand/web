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
#[cfg(not(target_arch="wasm32"))]
#[path="switch624_road_rm01.rs"]
mod switch624_road_rm01;

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
// Shared existing object span scanner; selection and exact lookup use the
// same grammar/validated bytes, not a second JSON reader.
fn next_object_member(bytes:&[u8],parent:Span,pos:&mut usize)
    ->CoreResult<Option<(String,Span)>>{
    if bytes.get(parent.begin)!=Some(&b'{')||
       bytes.get(parent.end.saturating_sub(1))!=Some(&b'}')||
       parent.begin>=parent.end||parent.end>bytes.len()||
       *pos<=parent.begin||*pos>=parent.end{
        return Err(denied("SEMANTIC_OBJECT_PARENT_REQUIRED"));
    }
    let i=indexed_read::skip_ws(bytes,*pos);
    if i>=parent.end{return Err(denied("SEMANTIC_MAP_OUT_OF_SPAN"));}
    if i==parent.end-1{return Ok(None);}
    let k_end=indexed_read::string_end(bytes,i)?;
    if k_end-i>128{return Err(denied("SEMANTIC_KEY_BOUNDS"));}
    let k:String=serde_json::from_slice(&bytes[i..k_end])
        .map_err(|_|denied("SEMANTIC_KEY_INVALID"))?;
    let colon=indexed_read::skip_ws(bytes,k_end);
    if bytes.get(colon)!=Some(&b':'){return Err(denied("SEMANTIC_KEY_COLON"));}
    let begin=indexed_read::skip_ws(bytes,colon+1);
    let end=indexed_read::value_end(bytes,begin)?;
    if end>=parent.end{return Err(denied("SEMANTIC_FIELD_OUT_OF_PARENT"));}
    let next=indexed_read::skip_ws(bytes,end);
    *pos=match bytes.get(next){
        Some(b',') if next<parent.end-1=>next+1,
        Some(b'}') if next==parent.end-1=>next,
        _=>return Err(denied("SEMANTIC_MAP_TERMINATOR")),
    };
    Ok(Some((k,Span{begin,end})))
}
fn object_field(bytes:&[u8], parent:Span, sought:&str)->CoreResult<Span>{
    let mut pos=parent.begin.checked_add(1).ok_or(denied("SEMANTIC_MAP_OUT_OF_SPAN"))?;
    while let Some((key,span))=next_object_member(bytes,parent,&mut pos)?{
        if key==sought{return Ok(span);}
    }
    Err(denied("SEMANTIC_TARGET_NOT_PRESENT"))
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
// E1335: only the native Catalog Furniture route has a valid zero
// selector. Check the *saved* restriction, not the constructor defaults.
fn furniture_catalog_mask(bytes:&[u8],record:Span)->CoreResult<u16>{
    let mut pos=record.begin+1;
    let mut restriction=None;
    let mut fields=0usize;
    while let Some((key,v))=next_object_member(bytes,record,&mut pos)?{
        fields+=1;
        if fields>64{return Err(denied("AMOUNT_ZERO_ROUTE_RECORD_BOUND"));}
        if key=="CompatibleFurnitureTypes"{restriction=Some(v);}
        else if key.starts_with("Compatible")&&key!="CompatibleItemType"{
            return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_AMBIGUOUS"));
        }
    }
    let r=restriction.ok_or(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_ABSENT"))?;
    if r.end-r.begin>2048{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_BOUND"));}
    let mut pos=r.begin+1;
    let (key,list)=next_object_member(bytes,r,&mut pos)?
        .ok_or(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_ABSENT"))?;
    if key!="List"||next_object_member(bytes,r,&mut pos)?.is_some(){
        return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_AMBIGUOUS"));
    }
    let tokens:Vec<String>=serde_json::from_slice(&bytes[list.begin..list.end])
        .map_err(|_|denied("AMOUNT_ZERO_ROUTE_RESTRICTION_TYPE"))?;
    if tokens.is_empty()||tokens.len()>16{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_BOUND"));}
    let mut mask=0u16;
    for token in tokens{
        // Exact Steam626 enum tokens; persisted membership, not inferred
        // defaults. Unknown enum values or duplicate members fail closed.
        let n=match token.as_str(){
            "FurnitureItemType_Default"=>0,
            "FurnitureItemType_GroundAlteration"=>1,
            "FurnitureItemType_Door"=>3,
            "FurnitureItemType_Request"=>5,
            "FurnitureItemType_Blocker"=>6,
            "FurnitureItemType_Fence"=>7,
            "FurnitureItemType_AncientMachine"=>8,
            "FurnitureItemType_SnippetTrap"=>9,
            _=>return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_UNKNOWN")),
        };
        let bit=1u16<<n;
        if mask&bit!=0{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_DUPLICATE"));}
        mask|=bit;
    }
    Ok(mask)
}
fn check_furniture_catalog_item(mask:u16,item:u32)->CoreResult<()>{
    if native_amount_type(item)?!=ExistingAmountItemType::Furniture{
        return Err(denied("AMOUNT_ZERO_ROUTE_FURNITURE_REQUIRED"));
    }
    let subtype=(item%10_000_000)/100_000;
    if subtype>=16||mask&(1u16<<subtype)==0{
        return Err(denied("AMOUNT_ZERO_ROUTE_SUBTYPE_DENIED"));
    }
    Ok(())
}
fn inventory_route(bytes:&[u8],record:Span,id:u32,item:u32,expected:&str)->CoreResult<()>{
    if id!=0{
        positive_id_field(bytes,record,"ID",id)?;
        return compatible_type(bytes,object_field(bytes,record,"CompatibleItemType")?,expected);
    }
    if expected!="ItemType_Furniture"||number(bytes,object_field(bytes,record,"ID")?)?!=0{
        return Err(denied("AMOUNT_ZERO_ROUTE_ID_OR_TYPE"));
    }
    compatible_type(bytes,object_field(bytes,record,"CompatibleItemType")?,"ItemType_Furniture")?;
    check_furniture_catalog_item(furniture_catalog_mask(bytes,record)?,item)
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
            valid_id(*canonical_item_id)?;
            let lists=object_field(bytes,player,"ListInventories")?;
            let record=object_field(bytes,lists,&inventory_id.to_string())?;
            inventory_route(bytes,record,*inventory_id,*canonical_item_id,expected_compatible_item_type)?;
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
        let count=edits.len();
        self.commit_semantic_replacements(e,edits,count)
    }
    // One atomic ledger for Core-resolved replacements. Logical path count
    // can differ from lexical splice count for an inserted object map.
    fn commit_semantic_replacements(&self,e:WorkerEnvelope,mut edits:Vec<Replacement>,
        logical_count:usize)->CoreResult<SemanticStageReceipt>{
        if edits.is_empty()||edits.len()>MAX_TX_COMMANDS||
           logical_count==0||logical_count>MAX_TX_COMMANDS{
            return Err(denied("SEMANTIC_BATCH_BOUNDS"));
        }
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
        st.semantic=Some(SemanticLedger{edited,edited_sha,operation_count:logical_count,
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


// R03/R08: Core-owned existing amount target witnesses. Selection is not
// authority. The legacy private research Writer remains unchanged; this new
// boundary must be used by a future product Worker only after its own QA.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum ExistingAmountSelection {
    Inventory { inventory_id:u32, item_id:u32 },
    Chest { container_id:u32, slot_index:usize },
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum ExistingAmountItemType { ActivityItem=3, Furniture=4 }
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct ExistingChestFacts {
    pub parent_item_id:i32,
    pub belongs_to_player:bool,
    pub size:u32,
    pub extra_size:u32,
    pub block_move_to:bool,
    pub physical_slot_count:usize,
    pub state_sha256:[u8;32],
    /// Source-only packaged bound, not the live ItemDB/ContainerStackData.
    pub packaged_stack_bound:u32,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct ExistingAmountTargetView {
    pub selection:ExistingAmountSelection,
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub item_id:i32,
    pub old_amount:u32,
    pub compatible_item_type:ExistingAmountItemType,
    pub entry_sha256:[u8;32],
    pub chest:Option<ExistingChestFacts>,
}
/// Opaque source witness: no public constructor, Deserialize, mutable view,
/// caller-supplied catalog evidence, or capability to authorize a mutation.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct CoreExistingAmountTarget { view:ExistingAmountTargetView }
impl CoreExistingAmountTarget {
    pub fn view(&self)->&ExistingAmountTargetView { &self.view }
}
/// Separate Rust-only capability. No production mint exists until a trusted
/// same-build catalog/rights/variation/reference provider is integrated.
/// A source witness alone must never become this capability. The requested
/// new amount is sealed together with the source snapshot.
///
/// ```compile_fail
/// use ddv_save_core::{AuthorizedExistingAmountTarget,CoreExistingAmountTarget};
/// fn forge(target:CoreExistingAmountTarget)->AuthorizedExistingAmountTarget {
///     AuthorizedExistingAmountTarget{target,new_amount:1}
/// }
/// ```
#[derive(Debug)]
pub struct AuthorizedExistingAmountTarget {
    target:CoreExistingAmountTarget,
    new_amount:u32,
}

fn native_amount_type(id:u32)->CoreResult<ExistingAmountItemType>{
    if id==0||id>i32::MAX as u32 {
        return Err(denied("AMOUNT_NATIVE_SIGNED_ID_REQUIRED"));
    }
    match id/10_000_000 {
        3=>Ok(ExistingAmountItemType::ActivityItem),
        4=>Ok(ExistingAmountItemType::Furniture),
        _=>Err(denied("AMOUNT_NATIVE_TYPE_NOT_ALLOWED")),
    }
}
fn native_type_token(t:ExistingAmountItemType)->&'static str {
    match t {
        ExistingAmountItemType::ActivityItem=>"ItemType_ActivityItem",
        ExistingAmountItemType::Furniture=>"ItemType_Furniture",
    }
}
fn saved_item_id(bytes:&[u8],span:Span)->CoreResult<u32>{
    let value=number(bytes,span)?;
    if value==0||value>i32::MAX as u64 {
        return Err(denied("AMOUNT_NATIVE_SIGNED_ID_REQUIRED"));
    }
    Ok(value as u32)
}
fn saved_positive_amount(bytes:&[u8],span:Span)->CoreResult<u32>{
    let amount=number(bytes,span)?;
    // Need at least one permitted positive decrease. This is a conservative
    // DEV limit, not a Native stack maximum.
    if amount<2||amount>MAX_CONSERVATIVE_AMOUNT{
        return Err(denied("AMOUNT_NO_POSITIVE_DECREASE"));
    }
    Ok(amount as u32)
}
fn physical_slots(bytes:&[u8],span:Span)->CoreResult<usize>{
    if bytes.get(span.begin)!=Some(&b'[')||
       bytes.get(span.end.saturating_sub(1))!=Some(&b']'){
        return Err(denied("AMOUNT_SLOT_ARRAY_REQUIRED"));
    }
    let mut pos=indexed_read::skip_ws(bytes,span.begin+1);
    if pos==span.end-1{return Ok(0);}
    let mut count=0;
    loop {
        if count==MAX_CONTAINER_SLOTS||pos>=span.end-1{
            return Err(denied("AMOUNT_SLOT_COUNT_BOUNDS"));
        }
        let end=indexed_read::value_end(bytes,pos)?;
        if end>=span.end{return Err(denied("AMOUNT_SLOT_SPAN_BOUNDS"));}
        count+=1;
        pos=indexed_read::skip_ws(bytes,end);
        match bytes.get(pos){
            Some(b']') if pos==span.end-1=>return Ok(count),
            Some(b',')=>pos=indexed_read::skip_ws(bytes,pos+1),
            _=>return Err(denied("AMOUNT_SLOT_ARRAY_INVALID")),
        }
    }
}
fn packaged_activity_bound(id:u32)->CoreResult<u32>{
    // E1202 SOURCE_ONLY: ActivityItem subtype is local-id / 10^5,
    // never a top-level ItemType. No cap for absent subtype 13.
    match (id%10_000_000)/100_000 {
        0|2|3|4|8|10|11|15|16|18|19=>Ok(50),
        12|17=>Ok(99),
        14=>Ok(1),
        _=>Err(denied("AMOUNT_CHEST_PACKAGED_SUBTYPE_UNKNOWN")),
    }
}
fn observe_existing_amount(s:&ProductSession,e:&WorkerEnvelope,selection:ExistingAmountSelection)
    ->CoreResult<CoreExistingAmountTarget>{
    let bytes=&s.decoded;
    let player=indexed_read::roots(bytes)?.player;
    let (item_id,item_type,entry,old_amount,chest)=match selection {
        ExistingAmountSelection::Inventory{inventory_id,item_id}=>{
            let item_type=native_amount_type(item_id)?;
            let lists=object_field(bytes,player,"ListInventories")?;
            let record=object_field(bytes,lists,&inventory_id.to_string())?;
            inventory_route(bytes,record,inventory_id,item_id,native_type_token(item_type))?;
            let items=object_field(bytes,record,"Inventory")?;
            let entry=object_field(bytes,items,&item_id.to_string())?;
            let old=saved_positive_amount(bytes,object_field(bytes,entry,"Amount")?)?;
            (item_id,item_type,entry,old,None)
        }
        ExistingAmountSelection::Chest{container_id,slot_index}=>{
            valid_id(container_id)?;
            let containers=object_field(bytes,player,"ContainerInventories")?;
            let record=object_field(bytes,containers,&container_id.to_string())?;
            positive_id_field(bytes,record,"ID",container_id)?;
            raw_boolean_true(bytes,object_field(bytes,record,"BelongsToPlayer")?)?;
            let block=object_field(bytes,record,"BlockMoveTo")?;
            // Conservative existing unmoved container subset: unknown/true
            // is not a claim of Native illegality, but is not eligible here.
            if bytes.get(block.begin..block.end)!=Some(&b"false"[..]){
                return Err(denied("AMOUNT_CHEST_BLOCK_MOVE_UNVERIFIED"));
            }
            let parent=saved_item_id(bytes,object_field(bytes,record,"ParentItemID")?)?;
            if native_amount_type(parent)?!=ExistingAmountItemType::Furniture{
                return Err(denied("AMOUNT_CHEST_FURNITURE_PARENT_REQUIRED"));
            }
            let size=number(bytes,object_field(bytes,record,"Size")?)?;
            let extra=number(bytes,object_field(bytes,record,"ExtraSize")?)?;
            if size==0||size>MAX_CONTAINER_SLOTS as u64||extra>size{
                return Err(denied("AMOUNT_CHEST_CAPACITY_INVALID"));
            }
            let slots=object_field(bytes,record,"Inventory")?;
            let count=physical_slots(bytes,slots)?;
            if count!=size as usize||slot_index>=(size-extra) as usize{
                return Err(denied("AMOUNT_CHEST_SLOT_OR_CAPACITY_MISMATCH"));
            }
            let entry=array_element(bytes,slots,slot_index)?;
            let item_id=saved_item_id(bytes,object_field(bytes,entry,"ItemID")?)?;
            let item_type=native_amount_type(item_id)?;
            if item_type!=ExistingAmountItemType::ActivityItem{
                return Err(denied("AMOUNT_CHEST_ACTIVITY_ITEM_REQUIRED"));
            }
            let state=object_field(bytes,entry,"State")?;
            // Steam626 native Slot State field3 can be explicitly null.
            // Preserve its exact token; null and an empty object are distinct
            // saved witnesses, never aliases or proof of Native authority.
            // Missing State, unknown/nonempty oneof and other types fail closed.
            let explicit_null=bytes.get(state.begin..state.end)==Some(&b"null"[..]);
            let empty_object=bytes.get(state.begin)==Some(&b'{')&&
                indexed_read::skip_ws(bytes,state.begin+1)==state.end-1&&
                bytes.get(state.end-1)==Some(&b'}');
            if !explicit_null&&!empty_object{
                return Err(denied("AMOUNT_CHEST_STATE_UNRESOLVED"));
            }
            let old=saved_positive_amount(bytes,object_field(bytes,entry,"Amount")?)?;
            let bound=packaged_activity_bound(item_id)?;
            if old>bound{return Err(denied("AMOUNT_CHEST_PACKAGED_BOUND_EXCEEDED"));}
            (item_id,item_type,entry,old,Some(ExistingChestFacts{
                parent_item_id:parent as i32,belongs_to_player:true,size:size as u32,
                extra_size:extra as u32,block_move_to:false,physical_slot_count:count,
                state_sha256:sha(&bytes[state.begin..state.end]),packaged_stack_bound:bound,
            }))
        }
    };
    Ok(CoreExistingAmountTarget{view:ExistingAmountTargetView{
        selection,session_id:e.session_id,revision:e.expected_revision,
        index_generation:e.expected_index_generation,decoded_sha256:s.sha,
        item_id:item_id as i32,old_amount,compatible_item_type:item_type,
        entry_sha256:sha(&bytes[entry.begin..entry.end]),chest,
    }})
}
fn validate_target_snapshot(s:&ProductSession,e:&WorkerEnvelope,target:&CoreExistingAmountTarget)
    ->CoreResult<()>{
    let current=observe_existing_amount(s,e,target.view.selection)?;
    if current!=*target{return Err(denied("AMOUNT_TARGET_SCOPE_OR_WITNESS_CAS"));}
    Ok(())
}
fn command_from_target(target:&CoreExistingAmountTarget,new_amount:u32)
    ->CoreResult<TypedSemanticCommand>{
    let v=&target.view;
    valid_amount_decrease(v.old_amount,new_amount)?;
    Ok(match v.selection {
        ExistingAmountSelection::Inventory{inventory_id,item_id}=>
            TypedSemanticCommand::InventoryExistingAmountDecrease{
                inventory_id,canonical_item_id:item_id,
                expected_compatible_item_type:native_type_token(v.compatible_item_type).into(),
                expected_old_amount:v.old_amount,new_amount,
            },
        ExistingAmountSelection::Chest{container_id,slot_index}=>
            TypedSemanticCommand::ChestExistingSlotAmountDecrease{
                container_id,slot_index,expected_item_id:v.item_id as u32,
                expected_old_amount:v.old_amount,new_amount,
            },
    })
}
impl ProductSession {
    /// Read an actual existing target under the same Session mutex. Selectors
    /// are merely lookups, never trusted proof. No raw document/state export.
    pub fn read_existing_amount_target(&self,e:WorkerEnvelope,selection:ExistingAmountSelection)
        ->CoreResult<CoreExistingAmountTarget>{
        build_check(self)?;
        let st=self.lock()?;
        indexed_read::validate_scope(self,&st,&e)?;
        observe_existing_amount(self,&e,selection)
    }
    /// Native-local-only bounded selection of ONE fresh Inventory witness.
    /// This is a selector, not authorization or proof of E1172 target identity.
    /// Scan existing spans once; no whole-document Value, no extra session.
    #[cfg(not(target_arch="wasm32"))]
    pub fn find_one_existing_inventory_amount_target(&self,e:WorkerEnvelope)
        ->CoreResult<CoreExistingAmountTarget>{
        build_check(self)?;
        let st=self.lock()?;
        indexed_read::validate_scope(self,&st,&e)?;
        let bytes=&self.decoded;
        let player=indexed_read::roots(bytes)?.player;
        let lists=object_field(bytes,player,"ListInventories")?;
        let mut pos=lists.begin+1;
        let mut records=0usize;
        let mut entries=0usize;
        const MAX_RECORDS:usize=128;
        const MAX_ENTRIES:usize=16384;
        fn canonical_id(key:&str)->Option<u32>{
            let id=key.parse::<u32>().ok()?;
            if id.to_string()!=key{return None;}
            Some(id)
        }
        while let Some((key,record))=next_object_member(bytes,lists,&mut pos)?{
            records+=1;
            if records>MAX_RECORDS{return Err(denied("AMOUNT_DISCOVERY_RECORD_BOUND"));}
            let id=canonical_id(&key).ok_or(denied("AMOUNT_DISCOVERY_INVENTORY_KEY"))?;
            if number(bytes,object_field(bytes,record,"ID")?)?!=id as u64{
                return Err(denied("SEMANTIC_CONTAINER_ID_MISMATCH"));
            }
            let ty=object_field(bytes,record,"CompatibleItemType")?;
            let kind=if compatible_type(bytes,ty,"ItemType_ActivityItem").is_ok(){
                ExistingAmountItemType::ActivityItem
            }else if compatible_type(bytes,ty,"ItemType_Furniture").is_ok(){
                ExistingAmountItemType::Furniture
            }else{continue};
            // Unrelated zero routes never become amount targets.
            if id==0&&kind!=ExistingAmountItemType::Furniture{continue;}
            // Parse the persisted restriction once, even for a large Catalog.
            let zero_mask=if id==0{Some(furniture_catalog_mask(bytes,record)?)}else{None};
            let items=object_field(bytes,record,"Inventory")?;
            let mut item_pos=items.begin+1;
            while let Some((item_key,entry))=next_object_member(bytes,items,&mut item_pos)?{
                entries+=1;
                if entries>MAX_ENTRIES{return Err(denied("AMOUNT_DISCOVERY_ENTRY_BOUND"));}
                let Some(item_id)=canonical_id(&item_key)else{continue};
                if native_amount_type(item_id).ok()!=Some(kind){continue;}
                let Ok(amount)=object_field(bytes,entry,"Amount")else{continue};
                if saved_positive_amount(bytes,amount).is_err(){continue;}
                // For zero Catalog, apply saved restriction before selecting.
                // Disallowed subtype is skipped; malformed/unknown restriction
                // is an error rather than an invented default.
                if let Some(mask)=zero_mask{
                    match check_furniture_catalog_item(mask,item_id){
                        Ok(())=>{},
                        Err(e) if e.0=="AMOUNT_ZERO_ROUTE_SUBTYPE_DENIED"=>continue,
                        Err(e)=>return Err(e),
                    }
                }
                // Exact existing target path reuses PR948 authority witness.
                // Same mutex and immutable source; only ONE final exact lookup.
                return observe_existing_amount(self,&e,ExistingAmountSelection::Inventory{
                    inventory_id:id,item_id,
                });
            }
        }
        Err(denied("AMOUNT_DISCOVERY_NO_ELIGIBLE_EXISTING_TARGET"))
    }

    /// Native source evidence is not an authentic per-target catalog, rights,
    /// canonical variation, active reference or subscriber closure. No caller
    /// can supply a boolean, hash, registry, or callback as authority here.
    pub fn authorize_existing_amount_target(&self,e:WorkerEnvelope,target:&CoreExistingAmountTarget,
        new_amount:u32)->CoreResult<AuthorizedExistingAmountTarget>{
        build_check(self)?;
        let st=self.lock()?;
        indexed_read::validate_scope(self,&st,&e)?;
        validate_target_snapshot(self,&e,target)?;
        // Validate the exact requested next amount before any future authority
        // lookup. The sealed capability binds this amount, never a range.
        let _=command_from_target(target,new_amount)?;
        Err(denied("AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE"))
    }
    /// Future DEV-only trusted capability route. No public mint yet. Verify
    /// each snapshot again, then reuse the existing atomic Writer/CAS ledger.
    /// No new Session, executor, JSON rebuild, or Worker/Codec ABI.
    pub fn stage_core_minted_amount_batch(&self,e:WorkerEnvelope,
        requests:&[AuthorizedExistingAmountTarget])
        ->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        if requests.is_empty()||requests.len()>MAX_TX_COMMANDS{
            return Err(denied("SEMANTIC_BATCH_BOUNDS"));
        }
        let commands={
            let st=self.lock()?;
            check(self,&st,&e,WorkerAction::Stage)?;
            if st.semantic.is_some(){return Err(denied("SEMANTIC_STAGE_ALREADY_EXISTS"));}
            let mut commands=Vec::with_capacity(requests.len());
            for grant in requests{
                validate_target_snapshot(self,&e,&grant.target)?;
                commands.push(command_from_target(&grant.target,grant.new_amount)?);
            }
            commands
        };
        // The existing Writer performs duplicate/overlap checks, exact
        // old-token CAS, full document validation and final locked epoch CAS.
        self.stage_typed_semantic_batch(e,&commands)
    }
}

#[cfg(test)]
mod minted_amount_target_tests {
    use super::*;
    use crate::{BuildIdentity,SessionReceipt};
    use serde_json::{json,Value};
    fn doc()->Value{
        json!({"GameInfo":{"Version":626},"World":{},"Player":{
            "ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem",
                "Inventory":{"30000001":{"Amount":50,"Marker":"Keep"},"30000002":{"Amount":2}}}},
            "ContainerInventories":{"12":{"ID":12,"ParentItemID":40000047,
                "BelongsToPlayer":true,"BlockMoveTo":false,"Size":2,"ExtraSize":0,
                "Inventory":[{"ItemID":30000002,"Amount":12,"State":{},"Unknown":7},
                             {"ItemID":0,"Amount":0}]}}
        },"Unknown":{"Preserve":true}})
    }
    fn open(v:&Value)->ProductSession{
        ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:EXACT_STEAM.into(),schema:626,externally_attested:true,
        }).unwrap()
    }
    fn scope(r:SessionReceipt,action:WorkerAction)->WorkerEnvelope{
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action}
    }
    fn inv()->ExistingAmountSelection{
        ExistingAmountSelection::Inventory{inventory_id:4,item_id:30000001}
    }
    fn chest()->ExistingAmountSelection{
        ExistingAmountSelection::Chest{container_id:12,slot_index:0}
    }
    fn read(s:&ProductSession,sel:ExistingAmountSelection)->CoreResult<CoreExistingAmountTarget>{
        s.read_existing_amount_target(scope(s.receipt().unwrap(),WorkerAction::ReadDomain),sel)
    }
    #[test]
    fn minted_real_saved_values_not_caller_authority(){
        let s=open(&doc());
        let i=read(&s,inv()).unwrap();
        let c=read(&s,chest()).unwrap();
        assert_eq!(i.view().item_id,30000001);
        assert_eq!(i.view().old_amount,50);
        assert_eq!(i.view().compatible_item_type as u32,3);
        assert_eq!(c.view().old_amount,12);
        let facts=c.view().chest.unwrap();
        assert_eq!(facts.parent_item_id,40000047);
        assert_eq!(facts.physical_slot_count,2);
        assert_eq!(facts.state_sha256,sha(b"{}"));
        let e=scope(s.receipt().unwrap(),WorkerAction::ReadDomain);
        assert_eq!(s.authorize_existing_amount_target(e,&i,49).unwrap_err().0,
            "AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
        assert!(s.authorize_existing_amount_target(e,&c,11).is_err());
        for amount in [0,50,51]{
            assert_eq!(s.authorize_existing_amount_target(e,&i,amount).unwrap_err().0,
                "SEMANTIC_EXISTING_POSITIVE_DECREASE_ONLY");
        }
        let mut forged=doc();
        forged["Player"]["CatalogAuthority"]=json!({"verified":true,"rights":true,"itemId":30000001});
        let forged_session=open(&forged);
        let forged_target=read(&forged_session,inv()).unwrap();
        assert_eq!(forged_session.authorize_existing_amount_target(
            scope(forged_session.receipt().unwrap(),WorkerAction::ReadDomain),&forged_target,49)
            .unwrap_err().0,"AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
        assert_eq!(s.receipt().unwrap().revision,0);
    }
    #[test]
    fn exact_native_enum_signed_id_and_type_rejections(){
        for token in ["ItemType_Ingredient","ActivityItemType_Ingredient","ItemType_Furniture",
                      "ItemType_Entitlement","ItemType_Currency","ItemType_ActivityItemFake"]{
            let mut v=doc();v["Player"]["ListInventories"]["4"]["CompatibleItemType"]=json!(token);
            assert!(read(&open(&v),inv()).is_err(),"{token}");
        }
        for id in [0,1,40000047,80000001,2147483648,u32::MAX]{
            let mut v=doc();
            v["Player"]["ListInventories"]["4"]["Inventory"][id.to_string()]=json!({"Amount":50});
            assert!(read(&open(&v),ExistingAmountSelection::Inventory{
                inventory_id:4,item_id:id}).is_err(),"{id}");
        }
        let mut v=doc();
        v["Player"]["ListInventories"]["4"]["CompatibleItemType"]=json!("ItemType_Furniture");
        v["Player"]["ListInventories"]["4"]["Inventory"]["40000047"]=json!({"Amount":5});
        let s=open(&v);
        assert_eq!(read(&s,ExistingAmountSelection::Inventory{inventory_id:4,item_id:40000047})
            .unwrap().view().compatible_item_type as u32,4);
        for amount in [json!(0),json!(1),json!(-1),json!(10000),json!("50"),json!(2.5)]{
            let mut v=doc();v["Player"]["ListInventories"]["4"]["Inventory"]["30000001"]["Amount"]=amount;
            assert!(read(&open(&v),inv()).is_err());
        }
    }
    #[test]
    fn chest_actual_structure_fail_closed(){
        for (key,value) in [("ParentItemID",json!(30000001)),("ParentItemID",json!(2147483648u64)),
            ("ParentItemID",Value::Null),("BelongsToPlayer",json!(false)),
            ("BlockMoveTo",json!(true)),("BlockMoveTo",json!("false")),("Size",json!(3)),
            ("Size",json!(257)),("ExtraSize",json!(3)),("ExtraSize",json!(2)),("ExtraSize",json!(-1)),
            ("ID",json!(13))] {
            let mut v=doc();v["Player"]["ContainerInventories"]["12"][key]=value;
            assert!(read(&open(&v),chest()).is_err(),"{key}");
        }
        for key in ["State","ItemID","Amount"]{
            let mut v=doc();
            v["Player"]["ContainerInventories"]["12"]["Inventory"][0].as_object_mut().unwrap().remove(key);
            assert!(read(&open(&v),chest()).is_err(),"{key}");
        }
        for (key,value) in [("State",json!({"Unknown":1})),("State",json!("null")),
            ("State",json!([])),("State",json!(false)),("State",json!(0)),
            ("ItemID",json!(40000047)),("ItemID",json!(-1)),
            ("ItemID",json!(31300001)),("Amount",json!(51)),("Amount",json!(0))]{
            let mut v=doc();v["Player"]["ContainerInventories"]["12"]["Inventory"][0][key]=value;
            assert!(read(&open(&v),chest()).is_err(),"{key}");
        }
        // A physical 257th slot must not be hidden by a 256-slot accessor.
        let mut v=doc();
        v["Player"]["ContainerInventories"]["12"]["Size"]=json!(256);
        v["Player"]["ContainerInventories"]["12"]["Inventory"]=json!(vec![json!({"ItemID":30000002,"Amount":12,"State":{}});257]);
        assert!(read(&open(&v),chest()).is_err());
        assert!(read(&open(&doc()),ExistingAmountSelection::Chest{container_id:12,slot_index:2}).is_err());
    }
    #[test]
    fn chest_explicit_null_distinct_witness_and_positive_cas(){
        let mut v=doc();
        v["Player"]["ContainerInventories"]["12"]["Inventory"][0]["State"]=Value::Null;
        let s=open(&v);
        let before=s.receipt().unwrap();
        let e=scope(before,WorkerAction::ReadDomain);
        let target=read(&s,chest()).unwrap();
        let facts=target.view().chest.unwrap();
        assert_eq!(facts.state_sha256,sha(b"null"));
        let empty=open(&doc());
        let empty_target=read(&empty,chest()).unwrap();
        assert_eq!(empty_target.view().chest.unwrap().state_sha256,sha(b"{}"));
        assert_ne!(facts.state_sha256,empty_target.view().chest.unwrap().state_sha256);
        assert_eq!(s.authorize_existing_amount_target(e,&target,11).unwrap_err().0,
            "AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
        for amount in [0,12,13]{
            assert_eq!(s.authorize_existing_amount_target(e,&target,amount).unwrap_err().0,
                "SEMANTIC_EXISTING_POSITIVE_DECREASE_ONLY");
        }
        let mut wrong=target.clone();
        wrong.view.chest.as_mut().unwrap().state_sha256=sha(b"{}");
        assert_eq!(s.authorize_existing_amount_target(e,&wrong,11).unwrap_err().0,
            "AMOUNT_TARGET_SCOPE_OR_WITNESS_CAS");
        let mut wrong=target.clone();
        wrong.view.entry_sha256[0]^=1;
        assert!(s.authorize_existing_amount_target(e,&wrong,11).is_err());
        assert!(empty.authorize_existing_amount_target(
            scope(empty.receipt().unwrap(),WorkerAction::ReadDomain),&target,11).is_err());
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.read_existing_amount_target(stale,chest()).is_err());
        assert_eq!(s.receipt().unwrap(),before);
        // Only test-local synthetic authority can exercise the amount ledger.
        // Production mint remains unavailable. State and all unknown bytes stay.
        let grant=synthetic_grant(&s,chest(),11);
        let stage=scope(before,WorkerAction::Stage);
        let receipt=s.stage_core_minted_amount_batch(stage,&[grant]).unwrap();
        assert_eq!(receipt.exact_field_changed_count,1);
        assert!(!receipt.product_writer_authorized);
        assert!(!receipt.original_overwrite_authorized);
        assert!(!receipt.native_v3_verified);
        s.undo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        s.redo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let export=scope(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        let out=s.take_typed_semantic_decoded_once(export).unwrap();
        v["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(11);
        assert_eq!(out,serde_json::to_vec(&v).unwrap());
        // Export closes the Session; replay the original envelope rather
        // than attempting to obtain a new receipt from the closed Session.
        assert_eq!(s.receipt().unwrap_err().0,"SESSION_CLOSED");
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
    }
    #[test]
    fn session_epoch_and_snapshot_cas_no_caller_catalog(){
        let s=open(&doc());let t=read(&s,inv()).unwrap();
        let r=s.receipt().unwrap();let e=scope(r,WorkerAction::ReadDomain);
        let other=open(&doc());
        assert!(other.authorize_existing_amount_target(scope(other.receipt().unwrap(),WorkerAction::ReadDomain),&t,49).is_err());
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.read_existing_amount_target(stale,inv()).is_err());
        stale=e;stale.expected_index_generation+=1;
        assert!(s.authorize_existing_amount_target(stale,&t,49).is_err());
        stale=e;stale.expected_decoded_sha256[0]^=1;
        assert!(s.read_existing_amount_target(stale,inv()).is_err());
        stale=e;stale.action=WorkerAction::Stage;
        assert!(s.read_existing_amount_target(stale,inv()).is_err());
        let mut fake=t.clone();fake.view.old_amount=49;
        assert!(s.authorize_existing_amount_target(e,&fake,49).is_err());
        let mut fake=t.clone();fake.view.entry_sha256[0]^=1;
        assert!(s.authorize_existing_amount_target(e,&fake,49).is_err());
        s.close().unwrap();
        assert!(s.read_existing_amount_target(e,inv()).is_err());
        let sw=ProductSession::open_decoded_readonly(serde_json::to_vec(&doc()).unwrap(),BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
            build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true,
        }).unwrap();
        assert!(read(&sw,inv()).is_err());
    }
    #[cfg(not(target_arch="wasm32"))]
    #[test]
    fn furniture_zero_route_exact_saved_restriction_and_atomic_cas(){
        let mut v=doc();
        v["Player"]["ListInventories"]["0"]=json!({"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default","FurnitureItemType_SnippetTrap"]},
            "Inventory":{"40000001":{"Amount":7,"Marker":"Keep","Unknown":{"a":1}},
                         "40900001":{"Amount":3},"40700001":{"Amount":5}}});
        let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000001};
        let s=open(&v);let before=s.receipt().unwrap();
        let w=read(&s,sel).unwrap();
        assert_eq!(w.view().old_amount,7);
        assert_eq!(s.find_one_existing_inventory_amount_target(scope(before,WorkerAction::ReadDomain)).unwrap(),w);
        assert!(read(&s,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40900001}).is_ok());
        assert!(read(&s,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40700001}).is_err());
        let mut d=v.clone();
        d["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]=json!({"List":["FurnitureItemType_SnippetTrap"]});
        let x=open(&d);
        let selected=x.find_one_existing_inventory_amount_target(scope(x.receipt().unwrap(),WorkerAction::ReadDomain)).unwrap();
        assert_eq!(selected.view().selection,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40900001});
        assert_eq!(s.authorize_existing_amount_target(scope(before,WorkerAction::ReadDomain),&w,6)
            .unwrap_err().0,"AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
        for (key,bad) in [
            ("ID",json!(1)),("ID",json!("0")),("CompatibleItemType",json!("ItemType_ActivityItem")),
            ("CompatibleFurnitureTypes",Value::Null),("CompatibleFurnitureTypes",json!({"List":[]})),
            ("CompatibleFurnitureTypes",json!({"List":["FurnitureItemType_Fence"]})),
            ("CompatibleFurnitureTypes",json!({"List":["FurnitureItemType_Default","Unknown"]})),
            ("CompatibleFurnitureTypes",json!({"List":["FurnitureItemType_Default","FurnitureItemType_Default"]})),
            ("CompatibleFurnitureTypes",json!({"List":["FurnitureItemType_Default"],"Other":{}})),
            ("CompatibleActivityItemTypes",json!({"List":[]})),
        ]{
            let mut d=v.clone();d["Player"]["ListInventories"]["0"][key]=bad;
            let x=open(&d);assert!(read(&x,sel).is_err(),"{key}");
            let cmd=TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:0,canonical_item_id:40000001,
                expected_compatible_item_type:"ItemType_Furniture".into(),expected_old_amount:7,new_amount:6};
            assert!(x.stage_typed_semantic_batch(scope(x.receipt().unwrap(),WorkerAction::Stage),&[cmd]).is_err());
            assert_eq!(x.receipt().unwrap().revision,0);
        }
        let mut d=v.clone();d["Player"]["ListInventories"]["0"].as_object_mut().unwrap().remove("CompatibleFurnitureTypes");
        assert!(read(&open(&d),sel).is_err());
        let mut d=v.clone();d["Player"]["ListInventories"]["0"]["Inventory"]["30000001"]=json!({"Amount":7});
        assert!(read(&open(&d),ExistingAmountSelection::Inventory{inventory_id:0,item_id:30000001}).is_err());
        let e=scope(before,WorkerAction::Stage);
        let cmd=TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:0,canonical_item_id:40000001,
            expected_compatible_item_type:"ItemType_Furniture".into(),expected_old_amount:8,new_amount:6};
        assert!(s.stage_typed_semantic_batch(e,&[cmd]).is_err());
        assert_eq!(s.receipt().unwrap(),before);
        let grant=synthetic_grant(&s,sel,6);
        assert_eq!(s.stage_core_minted_amount_batch(e,&[grant]).unwrap().exact_field_changed_count,1);
        s.undo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        s.redo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let out=s.take_typed_semantic_decoded_once(scope(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).unwrap();
        v["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]["Amount"]=json!(6);
        assert_eq!(out,serde_json::to_vec(&v).unwrap());
    }
    // Synthetic capability construction ONLY inside this unit test module.
    // Production authorize_existing_amount_target cannot mint one.
    fn synthetic_grant(s:&ProductSession,sel:ExistingAmountSelection,new_amount:u32)->AuthorizedExistingAmountTarget{
        AuthorizedExistingAmountTarget{target:read(s,sel).unwrap(),new_amount}
    }
    #[test]
    fn synthetic_sealed_capability_reuses_atomic_writer_undo_redo_export(){
        let v=doc();let s=open(&v);let r=s.receipt().unwrap();
        let e=scope(r,WorkerAction::Stage);
        let dup=[synthetic_grant(&s,inv(),49),synthetic_grant(&s,inv(),48)];
        assert!(s.stage_core_minted_amount_batch(e,&dup).is_err());
        for amount in [0,50,51]{
            assert!(s.stage_core_minted_amount_batch(e,&[synthetic_grant(&s,inv(),amount)]).is_err());
        }
        let other=open(&v);
        assert!(s.stage_core_minted_amount_batch(e,&[synthetic_grant(&other,inv(),49)]).is_err());
        let requests=[synthetic_grant(&s,inv(),49),synthetic_grant(&s,chest(),11)];
        let receipt=s.stage_core_minted_amount_batch(e,&requests).unwrap();
        assert_eq!(receipt.exact_field_changed_count,2);
        assert!(!receipt.product_writer_authorized);
        assert_eq!(receipt.revision,1);
        assert!(s.stage_core_minted_amount_batch(e,&requests).is_err());
        assert!(read(&s,inv()).is_err());
        let undo=s.undo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(!undo.applied);
        let redo=s.redo_typed_semantic_batch(scope(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(redo.applied);
        assert!(s.stage_core_minted_amount_batch(scope(s.receipt().unwrap(),WorkerAction::Stage),&requests).is_err());
        let export=scope(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        let out=s.take_typed_semantic_decoded_once(export).unwrap();
        let mut expected=v;
        expected["Player"]["ListInventories"]["4"]["Inventory"]["30000001"]["Amount"]=json!(49);
        expected["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(11);
        assert_eq!(out,serde_json::to_vec(&expected).unwrap());
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
    }
}


#[cfg(all(test,not(target_arch="wasm32")))]
mod private_inventory_discovery_tests {
    use super::*;
    use crate::{BuildIdentity,SessionReceipt};
    use serde_json::json;
    fn open(v:serde_json::Value)->ProductSession{
        ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:EXACT_STEAM.into(),schema:626,externally_attested:true,
        }).unwrap()
    }
    fn envelope(r:SessionReceipt)->WorkerEnvelope{
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
    }
    fn doc()->serde_json::Value{
        json!({"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{
            "1":{"ID":1,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50}}},
            "2":{"ID":2,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{
                "030000001":{"Amount":50},"30000001":{"Amount":1},"30000002":{"Amount":0},
                "30000003":{"Amount":2},"40000001":{"Amount":50},"2147483648":{"Amount":50}
            }}
        }}})
    }
    #[test]
    fn discovers_only_exact_existing_target_and_same_epoch(){
        let s=open(doc());let r=s.receipt().unwrap();let e=envelope(r);
        let v=s.find_one_existing_inventory_amount_target(e).unwrap();
        assert_eq!(v.view().selection,ExistingAmountSelection::Inventory{inventory_id:2,item_id:30000003});
        assert_eq!(v.view().old_amount,2);
        assert_eq!(v,s.read_existing_amount_target(e,v.view().selection).unwrap());
        assert_eq!(s.receipt().unwrap(),r);
        assert!(s.authorize_existing_amount_target(e,&v,1).is_err());
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.find_one_existing_inventory_amount_target(stale).is_err());
        let mut wrong=e;wrong.action=WorkerAction::Stage;
        assert!(s.find_one_existing_inventory_amount_target(wrong).is_err());
        let other=open(doc());
        assert!(other.find_one_existing_inventory_amount_target(e).is_err());
        s.close().unwrap();
        assert!(s.find_one_existing_inventory_amount_target(e).is_err());
    }
    #[test]
    fn no_eligible_target_invalid_map_and_bounds_fail_closed(){
        let mut v=doc();v["Player"]["ListInventories"]["2"]["Inventory"]["30000003"]["Amount"]=json!(1);
        let s=open(v.clone());assert!(s.find_one_existing_inventory_amount_target(envelope(s.receipt().unwrap())).is_err());
        v["Player"]["ListInventories"]["2"]["ID"]=json!(1);
        let s=open(v);assert!(s.find_one_existing_inventory_amount_target(envelope(s.receipt().unwrap())).is_err());
        let mut v=doc();
        v["Player"]["ListInventories"]=json!((1..=129).map(|i|
           (i.to_string(),json!({"ID":i,"CompatibleItemType":"ItemType_Currency","Inventory":{}})))
           .collect::<serde_json::Map<String,serde_json::Value>>());
        let s=open(v);assert_eq!(s.find_one_existing_inventory_amount_target(envelope(s.receipt().unwrap())).unwrap_err().0,"AMOUNT_DISCOVERY_RECORD_BOUND");
        let mut v=doc();
        v["Player"]["ListInventories"]["2"]["Inventory"]=json!((30000000..30016385).map(|i|
           (i.to_string(),json!({"Amount":1}))).collect::<serde_json::Map<String,serde_json::Value>>());
        let s=open(v);assert_eq!(s.find_one_existing_inventory_amount_target(envelope(s.receipt().unwrap())).unwrap_err().0,"AMOUNT_DISCOVERY_ENTRY_BOUND");
    }
}
