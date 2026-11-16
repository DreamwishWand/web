//! ACT1143: shared typed Backpack pair and product fruit split.
//! Existing lexical scanner, existing ProductSession and atomic ledger.
//! No private plan authority, no event replay, no new slot, no total change.
use super::*;
use serde_json::Value;
struct Pair{source:Span,destination:Span,old:u32,witness:Value}
impl ProductSession{
    fn observe_backpack_pair(&self,e:WorkerEnvelope,source_slot:usize,destination_slot:usize)->CoreResult<Pair>{
        let st=self.lock()?;
        indexed_read::validate_scope(self,&st,&e)?;
        if source_slot==destination_slot||source_slot>=MAX_CONTAINER_SLOTS||destination_slot>=MAX_CONTAINER_SLOTS{
            return Err(denied("BACKPACK_PAIR_DISTINCT_BOUNDED_SLOTS"));
        }
        let bytes=&self.decoded;
        let player=indexed_read::roots(bytes)?.player;
        let containers=object_field(bytes,player,"ContainerInventories")?;
        // Exact canonical map key 0 and matching physical ID 0. No ListInventory
        // lookup or caller-supplied container role, no noncanonical key alias.
        let mut pos=containers.begin+1;let mut selected=None;let mut n=0usize;
        while let Some((key,record))=next_object_member(bytes,containers,&mut pos)?{
            n+=1;if n>4096{return Err(denied("BACKPACK_CONTAINER_MAP_BOUND"));}
            let id=key.parse::<u32>().map_err(|_|denied("BACKPACK_CONTAINER_KEY"))?;
            if key!=id.to_string()||number(bytes,object_field(bytes,record,"ID")?)?!=id as u64{
                return Err(denied("BACKPACK_CONTAINER_ID_OR_KEY"));
            }
            if id==0{if selected.replace(record).is_some(){return Err(denied("BACKPACK_CONTAINER_DUPLICATE"));}}
        }
        let record=selected.ok_or(denied("BACKPACK_CONTAINER_ABSENT"))?;
        raw_boolean_true(bytes,object_field(bytes,record,"BelongsToPlayer")?)?;
        let parent=object_field(bytes,record,"ParentItemID")?;
        if bytes.get(parent.begin..parent.end)!=Some(&b"null"[..]){
            return Err(denied("BACKPACK_PARENT_NULL_REQUIRED"));
        }
        let block=object_field(bytes,record,"BlockMoveTo")?;
        if bytes.get(block.begin..block.end)!=Some(&b"false"[..]){
            return Err(denied("BACKPACK_BLOCK_MOVE_UNRESOLVED"));
        }
        let size=number(bytes,object_field(bytes,record,"Size")?)?;
        let extra=number(bytes,object_field(bytes,record,"ExtraSize")?)?;
        if size==0||size>MAX_CONTAINER_SLOTS as u64||extra>size{
            return Err(denied("BACKPACK_CAPACITY_INVALID"));
        }
        let slots=object_field(bytes,record,"Inventory")?;
        let count=physical_slots(bytes,slots)?;
        if count!=size as usize||source_slot>=(size-extra) as usize||destination_slot>=(size-extra) as usize{
            return Err(denied("BACKPACK_PHYSICAL_OR_USABLE_SLOT_MISMATCH"));
        }
        let source=array_element(bytes,slots,source_slot)?;
        let destination=array_element(bytes,slots,destination_slot)?;
        let item=saved_item_id(bytes,object_field(bytes,source,"ItemID")?)?;
        if native_amount_type(item)?!=ExistingAmountItemType::ActivityItem||
           !matches!((item%10_000_000)/100_000,2|11|16){
            return Err(denied("BACKPACK_ACTIVITY_SUBTYPE_SCREEN"));
        }
        let old=saved_positive_amount(bytes,object_field(bytes,source,"Amount")?)?;
        let bound=packaged_activity_bound(item)?;
        if old>bound{return Err(denied("BACKPACK_PACKAGED_STACK_BOUND"));}
        if number(bytes,object_field(bytes,destination,"ItemID")?)?!=0||
           number(bytes,object_field(bytes,destination,"Amount")?)?!=0{
            return Err(denied("BACKPACK_DESTINATION_INVALID_ZERO_REQUIRED"));
        }
        let ss=object_field(bytes,source,"State")?;
        let ds=object_field(bytes,destination,"State")?;
        for x in [ss,ds]{
            if bytes.get(x.begin..x.end)!=Some(&b"null"[..]){
                return Err(denied("BACKPACK_EXPLICIT_NULL_STATE_REQUIRED"));
            }
        }
        let hex=|b:&[u8]|b.iter().map(|v|format!("{v:02x}")).collect::<String>();
        let digest=|s:Span|hex(&sha(&bytes[s.begin..s.end]));
        let witness=serde_json::json!({
            "contract":"wand.native.private.backpack-slot-pair-read@1",
            "platform":"SteamWindows","fullVersion":EXACT_STEAM,"schema":626,
            "sessionId":hex(&e.session_id),"revision":e.expected_revision,
            "indexGeneration":e.expected_index_generation,"decodedSha256":hex(&self.sha),
            "container":{"namespace":"ContainerInventories","containerId":0,"physicalKey":"0",
                "recordSha256":digest(record),"mapSha256":digest(containers),"slotsSha256":digest(slots),
                "belongsToPlayer":true,"blockMoveTo":false,"parentItemId":null,"parentPresent":true,
                "parentSha256":digest(parent),"size":size,"extraSize":extra,"physicalSlotCount":count,
                "usableSlotCount":size-extra},
            "source":{"slotIndex":source_slot,"itemId":item,"oldAmount":old,
                "stateExplicitNull":true,"stateSha256":digest(ss),"entrySha256":digest(source)},
            "destination":{"slotIndex":destination_slot,"itemId":0,"oldAmount":0,
                "stateExplicitNull":true,"stateSha256":digest(ds),"entrySha256":digest(destination)},
            "proposedQuantityDiagnosticOnly":1,"packagedStackBound":bound,
            "effectiveStackBound":null,"effectiveStackBoundVerified":false,
            "canonicalItemDbVerified":false,"rightsVerified":false,"variationVerified":false,
            "nativeReferenceClosureVerified":false,"subscriberClosureVerified":false,
            "fullDocumentRustValidated":true,"productReadAccepted":false,"writerAuthorized":false,
            "editedCopyAuthorized":false,"applyAuthorized":false,"nativeV3Verified":false
        });
        Ok(Pair{source,destination,old,witness})
    }
    #[cfg(not(target_arch="wasm32"))]
    pub fn read_private_backpack_slot_pair(&self,e:WorkerEnvelope,source_slot:usize,destination_slot:usize)->CoreResult<Value>{
        build_check(self)?;
        Ok(self.observe_backpack_pair(e,source_slot,destination_slot)?.witness)
    }
}
#[cfg(feature="product-amount-scoped")]
mod product{
use super::*;
use serde_json::json;
const ITEM:u32=30200001;
const DEFINITION:&str="9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc";
const SWITCH_BID:&str="9A239D3DB569756D";
fn need(v:bool,e:&'static str)->CoreResult<()>{if v{Ok(())}else{Err(denied(e))}}
fn build(s:&ProductSession,switch:bool)->CoreResult<()>{
    let b=&s.native_source_build;
    need(s.worker_bound&&b.schema==626&&b.externally_attested&&if switch{
        b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&b.build_id==SWITCH_BID
    }else{b.platform==Platform::SteamWindows&&b.build_kind==BuildKind::SteamFullVersion&&b.build_id==EXACT_STEAM},"BACKPACK_PRODUCT_BUILD")
}
// E1935/E2203/E2322: fixed ordinary Fruit definition, cap 50, no
// variation/entitlement, no event replay. All existing same-container
// quantities conserved. Refuse current slot-address references: unknown
// positional aliases do not inherit the offline proof.
// ACT1159: exact typed saved Pet capacity count, not a slot address.
// No generic field-name exception and no skipped descendants.
#[derive(PartialEq,Eq)]enum RefSegment{Key(String),Element(usize)}
fn pet_owner(path:&[RefSegment])->bool{
    matches!(path,[RefSegment::Key(a),RefSegment::Key(b),RefSegment::Element(i)] if a=="Player"&&b=="Pets"&&*i<224)
}
fn pet_grant_zero(b:&[u8],record:Span,grant:Span)->CoreResult<()>{
    need(b.get(grant.begin..grant.end)==Some(&b"0"[..]),"BACKPACK_PRODUCT_PET_GRANT_ZERO")?;
    let keys=["PetItemID","FriendshipLevel","FriendshipXp","LastSelfieDate","LastPettedDate","GrantedInventorySlots","CustomName","PendingHangoutRewards","CritterInteractions"];
    let mut seen=std::collections::BTreeSet::new();let mut p=record.begin+1;
    while let Some((k,v))=next_object_member(b,record,&mut p)?{
        need(keys.contains(&k.as_str())&&seen.insert(k.clone()),"BACKPACK_PRODUCT_PET_SHAPE")?;
        // E2511 proves the exact record key set and grant scalar only.
        // All other fields retain the ordinary recursive ref scan.
        if k=="GrantedInventorySlots"{need(b.get(v.begin..v.end)==Some(&b"0"[..]),"BACKPACK_PRODUCT_PET_GRANT_ZERO")?;}
    }
    need(seen.len()==keys.len(),"BACKPACK_PRODUCT_PET_SHAPE")
}
fn refs(b:&[u8],s:Span,budget:&mut usize,depth:usize)->CoreResult<()>{refs_walk(b,s,budget,depth,&mut Vec::new())}
fn refs_walk(b:&[u8],s:Span,budget:&mut usize,depth:usize,path:&mut Vec<RefSegment>)->CoreResult<()>{
    *budget+=1;need(*budget<=1_000_000&&depth<=64,"BACKPACK_PRODUCT_REF_BOUND")?;
    match b.get(s.begin){
        Some(b'{')=>{
            let mut p=s.begin+1;
            while let Some((k,v))=next_object_member(b,s,&mut p)?{
                let norm=k.to_ascii_lowercase();
                if matches!(norm.as_str(),"containerinventoryid"|"containerid"|"backpackid"){
                    need(number(b,v)?!=0,"BACKPACK_PRODUCT_CONTAINER_REF")?;
                }
                let address=norm.contains("slot")&&(norm.contains("index")||norm.contains("position")||norm.contains("inventory")||norm.contains("backpack")||norm.contains("container"))
                    ||(norm.contains("inventory")||norm.contains("backpack")||norm.contains("container"))&&(norm.contains("index")||norm.contains("position"));
                if address{
                    need(k=="GrantedInventorySlots"&&pet_owner(path),"BACKPACK_PRODUCT_POSITION_REF")?;
                    pet_grant_zero(b,s,v)?;
                }
                path.push(RefSegment::Key(k));refs_walk(b,v,budget,depth+1,path)?;path.pop();
            }
        },
        Some(b'[')=>{
            let mut p=indexed_read::skip_ws(b,s.begin+1);let mut i=0usize;
            while p<s.end-1{
                let end=indexed_read::value_end(b,p)?;need(end<s.end,"BACKPACK_PRODUCT_REF_ARRAY")?;
                path.push(RefSegment::Element(i));refs_walk(b,Span{begin:p,end},budget,depth+1,path)?;path.pop();i+=1;
                p=indexed_read::skip_ws(b,end);
                if p==s.end-1{break}
                need(b.get(p)==Some(&b','),"BACKPACK_PRODUCT_REF_ARRAY")?;
                p=indexed_read::skip_ws(b,p+1);
            }
        },
        Some(_)=>{},None=>return Err(denied("BACKPACK_PRODUCT_REF_SPAN"))
    }Ok(())
}
fn edits(b:&[u8],p:&Pair)->CoreResult<Vec<Replacement>>{
    let zero=|field:&str,new:u32|->CoreResult<Replacement>{
        let span=object_field(b,p.destination,field)?;
        need(number(b,span)?==0,"BACKPACK_PRODUCT_DEST_CAS")?;
        Ok(Replacement{span,old:b[span.begin..span.end].to_vec(),new:new.to_string().into_bytes()})
    };
    Ok(vec![validate_old_amount(b,object_field(b,p.source,"Amount")?,p.old,p.old-1)?,
        zero("ItemID",ITEM)?,zero("Amount",1)?])
}
fn hex32(x:&[u8;32])->String{x.iter().map(|b|format!("{b:02x}")).collect()}
fn projected(b:&[u8],edits:&[Replacement])->CoreResult<[u8;32]>{
    let mut order=edits.iter().collect::<Vec<_>>();order.sort_by_key(|r|r.span.begin);
    let mut hash=Sha256::new();let mut pos=0;
    for r in order{
        need(r.span.begin>=pos&&b.get(r.span.begin..r.span.end)==Some(r.old.as_slice()),"BACKPACK_PRODUCT_RAW_CAS")?;
        hash.update(&b[pos..r.span.begin]);hash.update(&r.new);pos=r.span.end;
    }
    hash.update(&b[pos..]);Ok(hash.finalize().into())
}
struct Bound{pair:Pair,edits:Vec<Replacement>,projected:[u8;32],witness_sha:[u8;32]}
impl ProductSession{
    fn bind_product_backpack(&self,e:WorkerEnvelope,src:usize,dst:usize,switch:bool)->CoreResult<Bound>{
        build(self,switch)?;
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.revision==0&&st.generation==1&&st.semantic.is_none(),"BACKPACK_PRODUCT_FRESH_EPOCH")?;}
        let pair=self.observe_backpack_pair(e,src,dst)?;
        need(pair.witness["source"]["itemId"]==ITEM&&pair.witness["packagedStackBound"]==50&&
             (2..=50).contains(&pair.old),"BACKPACK_PRODUCT_FRUIT_SCOPE")?;
        let b=&self.decoded;let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        refs(b,top,&mut 0,0)?;
        // Bind both raw entries/states, all container identity/capacity
        // witnesses, source SHA and epoch in a Core-computed digest.
        let raw=serde_json::to_vec(&pair.witness).map_err(|_|denied("BACKPACK_PRODUCT_WITNESS"))?;
        let mut h=Sha256::new();h.update(if switch{b"switch626.backpack".as_slice()}else{b"steam626.backpack".as_slice()});h.update(&raw);
        let witness_sha=h.finalize().into();let edits=edits(b,&pair)?;let projected=projected(b,&edits)?;
        Ok(Bound{pair,edits,projected,witness_sha})
    }
    pub(crate) fn preview_product_backpack(&self,e:WorkerEnvelope,src:usize,dst:usize,switch:bool)->CoreResult<Value>{
        let t=self.bind_product_backpack(e,src,dst,switch)?;
        Ok(json!({"contract":if switch{"wand.worker.switch626.backpack-fruit-split@1"}else{"wand.worker.steam626.backpack-fruit-split@1"},
            "containerId":0,"sourceSlot":src,"destinationSlot":dst,"itemId":ITEM,"oldAmount":t.pair.old,"quantity":1,
            "definitionSha256":DEFINITION,"effectiveStackBound":50,"witnessSha256":hex32(&t.witness_sha),
            "projectedDecodedSha256":hex32(&t.projected),"sessionId":hex_session(&e.session_id),
            "revision":e.expected_revision,"indexGeneration":e.expected_index_generation,"decodedSha256":hex32(&e.expected_decoded_sha256),
            "writerAuthorized":false,"editedCopyAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    pub(crate) fn stage_product_backpack(&self,e:WorkerEnvelope,src:usize,dst:usize,old:u32,witness:[u8;32],out:[u8;32],switch:bool)->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"BACKPACK_PRODUCT_STAGE_ACTION")?;
        let t=self.bind_product_backpack(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},src,dst,switch)?;
        need(t.pair.old==old&&t.witness_sha==witness&&t.projected==out,"BACKPACK_PRODUCT_TARGET_CAS")?;
        self.commit_semantic_replacements(e,t.edits,3,Some(out))
    }
}
fn hex_session(x:&[u8;16])->String{x.iter().map(|b|format!("{b:02x}")).collect()}
#[cfg(test)]
mod tests{
use super::*;use crate::BuildIdentity;
fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{"Unknown":{"keep":1}},"Player":{"ContainerInventories":{"0":{"ID":0,"Size":3,"ExtraSize":1,"BelongsToPlayer":true,"BlockMoveTo":false,"ParentItemID":null,"Inventory":[{"ItemID":ITEM,"Amount":4,"State":null,"Unknown":"keep"},{"ItemID":0,"Amount":0,"State":null},{"ItemID":0,"Amount":0,"State":null}]}}}})}
fn open(d:&Value,switch:bool)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),BuildIdentity{
 platform:if switch{Platform::Switch}else{Platform::SteamWindows},build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
 build_id:(if switch{SWITCH_BID}else{EXACT_STEAM}).into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
#[test]fn pet_capacity_zero_exact_owner(){
    let pet=json!({"PetItemID":120000001,"FriendshipLevel":1,"FriendshipXp":0,"LastSelfieDate":"2000-01-01T00:00:00Z","LastPettedDate":"2000-01-01T00:00:00Z","GrantedInventorySlots":0,"CustomName":"","PendingHangoutRewards":[],"CritterInteractions":[]});
    let scan=|x:&Value|{let b=serde_json::to_vec(x).unwrap();refs(&b,Span{begin:0,end:b.len()},&mut 0,0)};
    let d=json!({"Player":{"Pets":[pet.clone()]}});assert!(scan(&d).is_ok());
    for value in [json!(1),json!(-1),json!("0"),json!(false),json!(0.0),json!(null)]{let mut x=d.clone();x["Player"]["Pets"][0]["GrantedInventorySlots"]=value;assert!(scan(&x).is_err());}
    for field in ["CustomName","PetItemID","CritterInteractions"]{let mut x=d.clone();x["Player"]["Pets"][0].as_object_mut().unwrap().remove(field);assert!(scan(&x).is_err());}
    let mut x=d.clone();x["Player"]["Pets"][0]["Unknown"]=json!(0);assert!(scan(&x).is_err());
    assert!(scan(&json!({"World":{"Pets":[pet.clone()]}})).is_err());
    assert!(scan(&json!({"Player":{"Pets":{"0":pet.clone()}}})).is_err());
    let mut x=d.clone();x["Player"]["Pets"][0]["PendingHangoutRewards"]=json!([{"InventorySlotIndex":0}]);assert!(scan(&x).is_err());
    assert!(scan(&json!({"Player":{"Pets":vec![pet.clone();224]}})).is_ok());
    assert!(scan(&json!({"Player":{"Pets":vec![pet.clone();225]}})).is_err());
    for raw in [r#"{"Player":{"Pets":[{"GrantedInventorySlots":-0}]}}"#,r#"{"World":{"GrantedInventorySlots":0}}"#]{let b=raw.as_bytes();assert!(refs(b,Span{begin:0,end:b.len()},&mut 0,0).is_err());}
    for sw in [false,true]{let mut x=doc();x["Player"]["Pets"]=json!([pet.clone()]);let session=open(&x,sw);assert!(session.preview_product_backpack(env(&session,WorkerAction::ReadDomain),0,1,sw).is_ok());}
}
#[test]fn product_backpack_exact3_both_builds_and_refs(){
 for switch in [false,true]{
 let d=doc();let s=open(&d,switch);let e=env(&s,WorkerAction::ReadDomain);let t=s.bind_product_backpack(e,0,1,switch).unwrap();
 assert!(s.preview_product_backpack(e,0,1,!switch).is_err());assert!(s.preview_product_backpack(e,0,2,switch).is_err());
 let st=env(&s,WorkerAction::Stage);assert!(s.stage_product_backpack(st,0,1,3,t.witness_sha,t.projected,switch).is_err());
 assert!(s.stage_product_backpack(st,0,1,4,[0;32],t.projected,switch).is_err());
 assert!(open(&d,switch).stage_product_backpack(st,0,1,4,t.witness_sha,t.projected,switch).is_err());
 let r=s.stage_product_backpack(st,0,1,4,t.witness_sha,t.projected,switch).unwrap();assert_eq!(r.exact_field_changed_count,3);
 assert!(s.stage_product_backpack(st,0,1,4,t.witness_sha,t.projected,switch).is_err());
 s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
 s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();let ex=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();
 let mut want=d.clone();let a=&mut want["Player"]["ContainerInventories"]["0"]["Inventory"];a[0]["Amount"]=json!(3);a[1]["ItemID"]=json!(ITEM);a[1]["Amount"]=json!(1);
 assert_eq!(out,serde_json::to_vec(&want).unwrap());assert!(s.take_typed_semantic_decoded_once(ex).is_err());
 for (k,v) in [("ContainerInventoryID",json!(0)),("InventorySlotIndex",json!(1)),("SlotIndex",json!(1))]{let mut x=d.clone();x["World"]["Unknown"][k]=v;let a=open(&x,switch);assert!(a.preview_product_backpack(env(&a,WorkerAction::ReadDomain),0,1,switch).is_err());}
 }
}
}
}
