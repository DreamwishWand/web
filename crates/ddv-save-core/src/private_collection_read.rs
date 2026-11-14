//! ACT378 / E1337/E1348: private typed Collection readset on ONE ProductSession.
//! Physical saved facts only. No catalogue eligibility, entitlement, writer,
//! completion, reward, or Native V3 authority. Not linked into public WASM.
use super::{ProductSession,WorkerEnvelope,Platform,BuildKind};
use super::indexed_read::{roots,validate_scope,Span};
use super::native_reference_slice::{object,array,field,required};
use crate::{CoreError,CoreResult};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::collections::BTreeSet;

const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH_EXACT:&str="9A239D3DB569756D";
const SWITCH_CONTRACT:&str="wand.native.private.switch626.furniture-collection-group-readset@1";
const MAX_SETS:usize=10000;
const MAX_GROUPS_PER_SET:usize=257;
const MAX_GROUPS:usize=4096;
const MAX_MAP:usize=16384;
const MAX_TOTAL_ENTRIES:usize=250000;
fn deny(s:&'static str)->CoreError{CoreError(s)}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn hash(b:&[u8],s:Span)->String{hex(&Sha256::digest(&b[s.begin..s.end]))}
fn integer(b:&[u8],s:Span)->CoreResult<i32>{
    let t=&b[s.begin..s.end];
    if t.len()>11{return Err(deny("COLLECTION_INT_BOUND"))}
    let n:i32=serde_json::from_slice(t).map_err(|_|deny("COLLECTION_INT_REQUIRED"))?;
    if n.to_string().as_bytes()!=t{return Err(deny("COLLECTION_INT_CANONICAL"))}
    Ok(n)
}
fn key(k:&str)->CoreResult<i32>{
    let n:i32=k.parse().map_err(|_|deny("COLLECTION_KEY_INVALID"))?;
    if n<=0||n.to_string()!=k{return Err(deny("COLLECTION_KEY_CANONICAL"))}
    Ok(n)
}
fn route_key(k:&str)->CoreResult<u32>{
    let n:u32=k.parse().map_err(|_|deny("COLLECTION_ROUTE_KEY_INVALID"))?;
    if n.to_string()!=k{return Err(deny("COLLECTION_ROUTE_KEY_CANONICAL"))}
    Ok(n)
}
fn count(n:&mut usize,max:usize)->CoreResult<()>{
    *n=n.checked_add(1).ok_or(deny("COLLECTION_SCAN_BOUND"))?;
    if *n>max{return Err(deny("COLLECTION_SCAN_BOUND"))}
    Ok(())
}
fn bool_token(b:&[u8],s:Span)->CoreResult<bool>{
    match &b[s.begin..s.end]{b"true"=>Ok(true),b"false"=>Ok(false),_=>Err(deny("COLLECTION_BOOL_REQUIRED"))}
}
fn state(b:&[u8],s:Option<Span>)->CoreResult<Value>{
    let Some(s)=s else{return Ok(json!({"present":false,"token":null,"sha256":null,"numericCode":null}))};
    let t=&b[s.begin..s.end];
    if t.len()>128{return Err(deny("COLLECTION_STATE_BOUND"))}
    // Keep the physical token. E1337 attests enum numeric meanings; the
    // exact serialized name spelling is NOT inferred from an enum descriptor.
    let numeric=if t.first()==Some(&b'"'){
        let _:String=serde_json::from_slice(t).map_err(|_|deny("COLLECTION_STATE_STRING"))?;
        None
    }else{let n=integer(b,s)?;if !(0..=2).contains(&n){return Err(deny("COLLECTION_STATE_ENUM"))}Some(n)};
    let token=std::str::from_utf8(t).map_err(|_|deny("COLLECTION_STATE_UTF8"))?;
    Ok(json!({"present":true,"token":token,"sha256":hash(b,s),"numericCode":numeric}))
}
fn stored_stock(b:&[u8],player:Span,target:i32,switch_furniture:bool)->CoreResult<Value>{
    let Some(lists)=field(b,player,"ListInventories")? else{
        return Ok(json!({"listPresent":false,"routePresent":false,"entryPresent":false,"ownershipVerified":false}))};
    let mut routes=0;let mut selected=None;
    object(b,lists,|k,record|{
        count(&mut routes,128)?;
        let id=route_key(&k)?;
        let id_span=required(b,record,"ID")?;
        let raw=&b[id_span.begin..id_span.end];
        let saved:u32=serde_json::from_slice(raw).map_err(|_|deny("COLLECTION_ROUTE_ID"))?;
        if saved!=id||saved.to_string().as_bytes()!=raw{return Err(deny("COLLECTION_ROUTE_ID"))}
        let ty=required(b,record,"CompatibleItemType")?;
        if ty.end-ty.begin>128{return Err(deny("COLLECTION_ROUTE_TYPE_BOUND"))}
        let token:String=serde_json::from_slice(&b[ty.begin..ty.end]).map_err(|_|deny("COLLECTION_ROUTE_TYPE"))?;
        if switch_furniture {
            if id==0||token=="ItemType_Furniture"{
                if id!=0||token!="ItemType_Furniture"||selected.replace((id,record)).is_some(){
                    return Err(deny("COLLECTION_FURNITURE_ROUTE_AMBIGUOUS"))
                }
            }
        }else if token=="ItemType_ActivityItem"{
            if id==0||selected.replace((id,record)).is_some(){return Err(deny("COLLECTION_ACTIVITY_ROUTE_AMBIGUOUS"))}
        }
        Ok(())
    })?;
    let Some((id,record))=selected else{
        return Ok(json!({"listPresent":true,"listSha256":hash(b,lists),"routePresent":false,"entryPresent":false,"ownershipVerified":false}))};
    let items=required(b,record,"Inventory")?;
    let mut total=0;let mut found=None;
    object(b,items,|k,entry|{
        count(&mut total,MAX_MAP)?;
        let n=key(&k)?;
        if n==target{found=Some(entry)}
        Ok(())
    })?;
    let entry=match found{
        None=>json!({"present":false}),
        Some(s)=>{
            let amount=integer(b,required(b,s,"Amount")?)?;
            if amount<0{return Err(deny("COLLECTION_STOCK_AMOUNT"))}
            let marker=field(b,s,"Marker")?;
            json!({"present":true,"entrySha256":hash(b,s),"amount":amount,
                "markerPresent":marker.is_some(),"markerSha256":marker.map(|m|hash(b,m))})
        }
    };
    Ok(json!({"listPresent":true,"listSha256":hash(b,lists),"routePresent":true,
        "inventoryId":id,"routeSha256":hash(b,record),"inventorySha256":hash(b,items),
        "entryPresent":found.is_some(),"entry":entry,"ownershipVerified":false}))
}
pub struct PrivateCollectionGroupReceipt{value:Value,selected_span:Option<Span>}
impl PrivateCollectionGroupReceipt{
    pub fn to_private_receipt_json(&self)->Value{self.value.clone()}
}
impl ProductSession{
    pub fn read_private_collection_group(&self,e:WorkerEnvelope,definition:i32,group_index:usize,target:i32)
        ->CoreResult<PrivateCollectionGroupReceipt>{
        let build=&self.native_source_build;
        let steam=build.platform==Platform::SteamWindows&&build.build_kind==BuildKind::SteamFullVersion&&build.build_id==EXACT;
        let switch_furniture=build.platform==Platform::Switch&&build.build_kind==BuildKind::SwitchBid&&build.build_id==SWITCH_EXACT;
        if (!steam&&!switch_furniture)||build.schema!=626||!build.externally_attested||self.worker_bound{
            return Err(deny("COLLECTION_EXACT_PRIVATE_BUILD_REQUIRED"))
        }
        let major=if switch_furniture{4}else{3};
        if definition<=0||definition/10_000_000!=212||group_index>=MAX_GROUPS_PER_SET||
            target<=0||target/10_000_000!=major{return Err(deny("COLLECTION_SELECTOR"))}
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        let b=&self.decoded;
        let player=roots(b)?.player;
        let sets=required(b,player,"CollectionSets")?;
        let mut set_ids=BTreeSet::new();let mut set_count=0;
        let mut group_count=0;let mut total_entries=0;
        let mut chosen=None;let mut selected_span=None;let mut memberships=Vec::new();
        array(b,sets,|set|{
            let set_pos=set_count;count(&mut set_count,MAX_SETS)?;
            let id=integer(b,required(b,set,"CollectionDefinitionID")?)?;
            if id<=0||id/10_000_000!=212||!set_ids.insert(id){return Err(deny("COLLECTION_DEFINITION_ID"))}
            let groups=required(b,set,"GroupData")?;
            let mut pos=0;
            array(b,groups,|g|{
                let physical=pos;count(&mut pos,MAX_GROUPS_PER_SET)?;count(&mut group_count,MAX_GROUPS)?;
                let stored_index=field(b,g,"GroupIndex")?.map(|s|integer(b,s)).transpose()?;
                if stored_index.is_some_and(|n|n<0||n as usize!=physical){return Err(deny("COLLECTION_GROUP_INDEX_CONFLICT"))}
                let selected=id==definition&&physical==group_index;
                let map=required(b,g,"GroupsCollectionItems")?;
                let mut entries=Vec::new();let mut map_count=0;let mut false_count=0;let mut target_entry=None;
                object(b,map,|k,s|{
                    count(&mut map_count,MAX_MAP)?;count(&mut total_entries,MAX_TOTAL_ENTRIES)?;
                    let item=key(&k)?;let flag=bool_token(b,s)?;
                    if !flag{false_count+=1}
                    if item==target{target_entry=Some((flag,hash(b,s)));if selected{selected_span=Some(s)}}
                    if selected{entries.push(json!({"itemId":item,"collected":flag,"tokenSha256":hash(b,s)}))}
                    Ok(())
                })?;
                if selected||target_entry.is_some(){
                    let state=state(b,field(b,g,"State")?)?;
                    if let Some((flag,ref entry_sha))=target_entry{
                        memberships.push(json!({"definitionId":id,"setPosition":set_pos,"groupPosition":physical,
                            "storedGroupIndex":stored_index,"collected":flag,"entrySha256":entry_sha,
                            "groupSha256":hash(b,g),"mapSha256":hash(b,map),"state":state.clone()}));
                    }
                    if selected{
                        let target_fact=target_entry.as_ref().map(|(f,h)|json!({"collected":f,"tokenSha256":h}));
                        let eligible_shape=state["numericCode"].as_i64()==Some(0)&&false_count>=2&&
                            target_entry.as_ref().is_some_and(|(f,_)|!*f);
                        chosen=Some(json!({"definitionId":id,"setPosition":set_pos,"groupPosition":physical,
                            "storedGroupIndex":stored_index,"setSha256":hash(b,set),"groupSha256":hash(b,g),
                            "mapSha256":hash(b,map),"state":state,"entries":entries,"falseCount":false_count,
                            "targetEntry":target_fact,"numericNotCompleteMultiFalseShape":eligible_shape}));
                    }
                }
                Ok(())
            })?;
            Ok(())
        })?;
        let group=chosen.ok_or(deny("COLLECTION_SELECTED_GROUP_ABSENT"))?;
        let stock=stored_stock(b,player,target,switch_furniture)?;
        // Exact Switch626 non-completing candidate shape only. This verifies
        // physical saved facts, not effective membership/rights or rewards.
        if switch_furniture&&(
            group["state"]["token"]!="\"SetState_NotComplete\""||
            group["falseCount"].as_u64().unwrap_or(0)<2||
            group["targetEntry"]["collected"]!=false||
            memberships.len()!=1||
            stock["inventoryId"]!=0||stock["entry"]["amount"].as_i64().unwrap_or(0)<=0){
            return Err(deny("COLLECTION_SWITCH_NONCOMPLETING_SHAPE_REQUIRED"));
        }
        let mut value=json!({
            "contract":"wand.native.private.collection-group-readset@1","fullVersion":EXACT,"schema":626,
            "sessionId":hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":hex(&e.expected_decoded_sha256),"collectionSetsSha256":hash(b,sets),
            "setCount":set_count,"groupCount":group_count,"scannedEntryCount":total_entries,
            "targetItemId":target,"selectedGroup":group,"storedMemberships":memberships,"storedStock":stock,
            "fullDocumentRustValidated":true,"packagedMembershipVerified":false,"effectiveEligibilityVerified":false,
            "ownershipVerified":false,"rightsVerified":false,"subscriberClosureVerified":false,
            "nativeV3Verified":false,"productReadAccepted":false,"writerAuthorized":false,
            "editedCopyAuthorized":false,"applyAuthorized":false
        });
        if switch_furniture{
            // Distinct receipt: do not mislabel a BID as a Steam FullVersion,
            // nor infer numeric enum equivalence from the saved string.
            value["contract"]=json!(SWITCH_CONTRACT);
            value.as_object_mut().ok_or(deny("COLLECTION_RECEIPT_OBJECT"))?.remove("fullVersion");
            value["platform"]=json!("Switch");
            value["buildKind"]=json!("SwitchBid");
            value["buildId"]=json!(SWITCH_EXACT);
            value["selectedGroup"]["switchSavedNotCompleteMultiFalseShape"]=json!(true);
        }
        Ok(PrivateCollectionGroupReceipt{value,selected_span})
    }
}

#[cfg(feature="semantic-writer-dev")]
pub struct PrivateSwitchCollectionTarget{
    scope:WorkerEnvelope,
    span:Span,
}
#[cfg(feature="semantic-writer-dev")]
impl ProductSession{
    /// Native private source-only exact one-token candidate. The canonical
    /// plan binds the independently reviewed source and raw readset; it is
    /// NOT proof of effective rights, eligibility, or product authorization.
    pub fn mint_private_switch626_collection_target(&self,e:WorkerEnvelope,plan:&[u8])
        ->CoreResult<PrivateSwitchCollectionTarget>{
        let b=&self.native_source_build;
        if b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
           b.build_id!=SWITCH_EXACT||b.schema!=626||!b.externally_attested||self.worker_bound{
            return Err(deny("COLLECTION_STAGE_EXACT_PRIVATE_SWITCH626_REQUIRED"));
        }
        if plan.is_empty()||plan.len()>8192{return Err(deny("COLLECTION_PLAN_BOUNDS"))}
        let v:Value=serde_json::from_slice(plan).map_err(|_|deny("COLLECTION_PLAN_JSON"))?;
        if serde_json::to_vec(&v).map_err(|_|deny("COLLECTION_PLAN_JSON"))?.as_slice()!=plan{
            return Err(deny("COLLECTION_PLAN_CANONICAL"))
        }
        let keys=["contract","definitionId","groupIndex","itemId","sourceDecodedSha256",
            "collectionSetsSha256","groupSha256","mapSha256","entrySha256","stateSha256",
            "stockEntrySha256","stockRouteSha256"];
        let m=v.as_object().ok_or(deny("COLLECTION_PLAN_OBJECT"))?;
        if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
            v["contract"]!="wand.private.switch626.collection-existing-bool-exact1@1"{
            return Err(deny("COLLECTION_PLAN_FIELDS"))
        }
        let definition=v["definitionId"].as_i64().and_then(|n|i32::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        let group=v["groupIndex"].as_u64().and_then(|n|usize::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        let item=v["itemId"].as_i64().and_then(|n|i32::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        let r=self.read_private_collection_group(e,definition,group,item)?;
        let x=&r.value;let g=&x["selectedGroup"];let stock=&x["storedStock"];
        if x["contract"]!=SWITCH_CONTRACT||v["sourceDecodedSha256"]!=x["decodedSha256"]||
           v["collectionSetsSha256"]!=x["collectionSetsSha256"]||
           v["groupSha256"]!=g["groupSha256"]||v["mapSha256"]!=g["mapSha256"]||
           v["entrySha256"]!=g["targetEntry"]["tokenSha256"]||
           v["stateSha256"]!=g["state"]["sha256"]||
           v["stockEntrySha256"]!=stock["entry"]["entrySha256"]||
           v["stockRouteSha256"]!=stock["routeSha256"]||
           g["switchSavedNotCompleteMultiFalseShape"]!=true{
            return Err(deny("COLLECTION_PLAN_READSET_CAS"))
        }
        let span=r.selected_span.ok_or(deny("COLLECTION_TARGET_SPAN"))?;
        if self.decoded.get(span.begin..span.end)!=Some(b"false".as_slice()){
            return Err(deny("COLLECTION_TARGET_OLD_BOOL"))
        }
        Ok(PrivateSwitchCollectionTarget{scope:e,span})
    }
    pub fn stage_private_switch626_collection_bool(&self,e:WorkerEnvelope,target:&PrivateSwitchCollectionTarget)
        ->CoreResult<super::SemanticStageReceipt>{
        let old=&target.scope;
        if e.contract!=old.contract||e.session_id!=old.session_id||
           e.expected_revision!=old.expected_revision||e.expected_index_generation!=old.expected_index_generation||
           e.expected_decoded_sha256!=old.expected_decoded_sha256{
            return Err(deny("COLLECTION_TARGET_EPOCH_CAS"))
        }
        let b=&self.native_source_build;
        if b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
           b.build_id!=SWITCH_EXACT||b.schema!=626||!b.externally_attested||self.worker_bound{
            return Err(deny("COLLECTION_STAGE_EXACT_PRIVATE_SWITCH626_REQUIRED"))
        }
        self.commit_private_collection_bool(e,target.span)
    }
}

#[cfg(test)]
mod tests{
    use super::*;
    use crate::{BuildIdentity,SessionReceipt,WorkerAction,PRODUCT_WORKER_CONTRACT};
    const DEF:i32=2120000001;const ITEM:i32=30000001;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{
        "CollectionSets":[{"CollectionDefinitionID":DEF,"GroupData":[{"GroupIndex":0,"State":0,
            "GroupsCollectionItems":{"30000001":false,"30000002":false,"30000003":true},"Unknown":7}]},
            {"CollectionDefinitionID":2120000002,"GroupData":[{"State":"NotComplete","GroupsCollectionItems":{"30000001":true}}]}],
        "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},
            "4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":2,"Marker":"Keep"}}}}
    }})}
    fn open(v:Value)->ProductSession{
        ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT.into(),
            schema:626,externally_attested:true}).unwrap()
    }
    fn env(r:SessionReceipt)->WorkerEnvelope{WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,
        action:WorkerAction::ReadDomain}}
    fn read(s:&ProductSession)->CoreResult<Value>{Ok(s.read_private_collection_group(env(s.receipt()?),DEF,0,ITEM)?.to_private_receipt_json())}
    #[test]
    fn private_collection_group_full_map_cross_membership_stock(){
        let s=open(doc());let before=s.receipt().unwrap();let v=read(&s).unwrap();
        assert_eq!(v["selectedGroup"]["entries"].as_array().unwrap().len(),3);
        assert_eq!(v["selectedGroup"]["falseCount"],2);
        assert_eq!(v["selectedGroup"]["numericNotCompleteMultiFalseShape"],true);
        assert_eq!(v["selectedGroup"]["state"]["token"],"0");
        assert_eq!(v["storedMemberships"].as_array().unwrap().len(),2);
        assert_eq!(v["storedMemberships"][1]["state"]["token"],"\"NotComplete\"");
        assert!(v["storedMemberships"][1]["state"]["numericCode"].is_null());
        assert_eq!(v["storedStock"]["entry"]["amount"],2);
        assert_eq!(v["ownershipVerified"],false);assert_eq!(v["writerAuthorized"],false);
        assert_eq!(s.receipt().unwrap(),before);
    }
    #[test]
    fn private_collection_group_absence_and_state_are_not_authority(){
        let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0].as_object_mut().unwrap().remove("State");
        let x=read(&open(v)).unwrap();assert_eq!(x["selectedGroup"]["state"]["present"],false);
        assert_eq!(x["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
        for state in [json!(1),json!(2),json!("NotComplete")]{
            let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0]["State"]=state;
            assert_eq!(read(&open(v)).unwrap()["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
        }
        let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["30000002"]=json!(true);
        assert_eq!(read(&open(v)).unwrap()["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
        let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"].as_object_mut().unwrap().remove("30000001");
        let x=read(&open(v)).unwrap();assert!(x["selectedGroup"]["targetEntry"].is_null());
        assert_eq!(x["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
        let mut v=doc();v["Player"].as_object_mut().unwrap().remove("ListInventories");
        assert_eq!(read(&open(v)).unwrap()["storedStock"]["listPresent"],false);
    }
    #[test]
    fn private_collection_group_malformed_and_scope_deny(){
        for (name,bad) in [("State",json!(null)),("State",json!(3)),("State",json!({})),
            ("GroupIndex",json!(1)),("GroupIndex",json!("0")),("GroupsCollectionItems",json!(null)),
            ("GroupsCollectionItems",json!({"030000001":false})),("GroupsCollectionItems",json!({"30000001":0})),
            ("GroupsCollectionItems",json!({"0":false}))]{
            let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0][name]=bad;
            assert!(read(&open(v)).is_err(),"{name}");
        }
        let mut v=doc();v["Player"]["CollectionSets"][1]["CollectionDefinitionID"]=json!(DEF);
        assert!(read(&open(v)).is_err());
        let mut v=doc();v["Player"]["ListInventories"]["5"]=v["Player"]["ListInventories"]["4"].clone();
        v["Player"]["ListInventories"]["5"]["ID"]=json!(5);assert!(read(&open(v)).is_err());
        let mut v=doc();v["Player"]["ListInventories"]["4"]["Inventory"]["30000001"]["Amount"]=json!(-1);
        assert!(read(&open(v)).is_err());
        let s=open(doc());let r=s.receipt().unwrap();let e=env(r);
        assert!(s.read_private_collection_group(e,DEF,1,ITEM).is_err());
        assert!(s.read_private_collection_group(e,DEF,0,40000001).is_err());
        let mut stale=e;stale.expected_revision+=1;assert!(s.read_private_collection_group(stale,DEF,0,ITEM).is_err());
        assert!(open(doc()).read_private_collection_group(e,DEF,0,ITEM).is_err());
        s.close().unwrap();assert!(s.read_private_collection_group(e,DEF,0,ITEM).is_err());
    }
}

#[cfg(test)]
mod switch_furniture_tests{
    use super::*;
    use crate::{BuildIdentity,WorkerAction,PRODUCT_WORKER_CONTRACT};
    const DEF:i32=2120000001;const ITEM:i32=40000001;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{
        "CollectionSets":[{"CollectionDefinitionID":DEF,"GroupData":[{"GroupIndex":0,
            "State":"SetState_NotComplete","GroupsCollectionItems":{"40000001":false,"40000002":false,"40000003":false,"40000004":true},
            "Unknown":{"keep":7}}]}],
        "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40000001":{"Amount":2,"Marker":"Keep"}}},
            "4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":2}}}}
    }})}
    fn open(v:Value)->ProductSession{
        ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:SWITCH_EXACT.into(),
            schema:626,externally_attested:true}).unwrap()
    }
    fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{
        contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
        expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
    fn read(s:&ProductSession)->CoreResult<Value>{Ok(s.read_private_collection_group(env(s),DEF,0,ITEM)?.to_private_receipt_json())}
    #[cfg(feature="semantic-writer-dev")]
    fn plan(s:&ProductSession)->Value{
        let x=read(s).unwrap();let g=&x["selectedGroup"];let t=&x["storedStock"];
        json!({"contract":"wand.private.switch626.collection-existing-bool-exact1@1",
          "definitionId":DEF,"groupIndex":0,"itemId":ITEM,
          "sourceDecodedSha256":x["decodedSha256"],"collectionSetsSha256":x["collectionSetsSha256"],
          "groupSha256":g["groupSha256"],"mapSha256":g["mapSha256"],"entrySha256":g["targetEntry"]["tokenSha256"],
          "stateSha256":g["state"]["sha256"],"stockEntrySha256":t["entry"]["entrySha256"],"stockRouteSha256":t["routeSha256"]})
    }
    #[cfg(feature="semantic-writer-dev")]
    #[test]
    fn switch626_collection_exact1_typed_stage_and_epoch_denials(){
        let d=doc();let s=open(d.clone());let e=env(&s);let p=plan(&s);
        let bytes=serde_json::to_vec(&p).unwrap();
        for k in ["sourceDecodedSha256","collectionSetsSha256","groupSha256","mapSha256","entrySha256","stateSha256","stockEntrySha256","stockRouteSha256","contract"]{
            let mut q=p.clone();q[k]=json!("wrong");
            assert!(s.mint_private_switch626_collection_target(e,&serde_json::to_vec(&q).unwrap()).is_err(),"{k}");
        }
        let mut q=p.clone();q["rightsVerified"]=json!(true);
        assert!(s.mint_private_switch626_collection_target(e,&serde_json::to_vec(&q).unwrap()).is_err());
        let t=s.mint_private_switch626_collection_target(e,&bytes).unwrap();
        let mut stage=e;stage.action=WorkerAction::Stage;
        assert!(s.stage_private_switch626_collection_bool(e,&t).is_err());
        let other=open(d.clone());let mut foreign=env(&other);foreign.action=WorkerAction::Stage;
        assert!(other.stage_private_switch626_collection_bool(foreign,&t).is_err());
        let mut stale=stage;stale.expected_revision+=1;
        assert!(s.stage_private_switch626_collection_bool(stale,&t).is_err());
        let r=s.stage_private_switch626_collection_bool(stage,&t).unwrap();
        assert_eq!(r.operation_count,1);assert_eq!(r.exact_field_changed_count,1);
        assert!(!r.product_writer_authorized);assert!(s.stage_private_switch626_collection_bool(stage,&t).is_err());
        let mut now=env(&s);now.action=WorkerAction::Stage;s.undo_typed_semantic_batch(now).unwrap();
        let mut now=env(&s);now.action=WorkerAction::ExportEditedCopy;
        assert!(s.take_typed_semantic_decoded_once(now).is_err());
        now.action=WorkerAction::Stage;assert!(s.stage_private_switch626_collection_bool(now,&t).is_err());
        s.redo_typed_semantic_batch(now).unwrap();
        let mut now=env(&s);now.action=WorkerAction::ExportEditedCopy;
        let out=s.take_typed_semantic_decoded_once(now).unwrap();
        assert!(s.take_typed_semantic_decoded_once(now).is_err());
        let mut want=d;want["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["40000001"]=json!(true);
        assert_eq!(out,serde_json::to_vec(&want).unwrap());
    }
    #[test]
    fn switch626_furniture_exact_saved_shape_no_authority(){
        let s=open(doc());let before=s.receipt().unwrap();let v=read(&s).unwrap();
        assert_eq!(v["contract"],SWITCH_CONTRACT);assert_eq!(v["platform"],"Switch");
        assert_eq!(v["buildId"],SWITCH_EXACT);assert!(v.get("fullVersion").is_none());
        assert_eq!(v["selectedGroup"]["falseCount"],3);
        assert_eq!(v["selectedGroup"]["state"]["token"],"\"SetState_NotComplete\"");
        assert_eq!(v["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
        assert_eq!(v["selectedGroup"]["switchSavedNotCompleteMultiFalseShape"],true);
        assert_eq!(v["storedMemberships"].as_array().unwrap().len(),1);
        assert_eq!(v["storedStock"]["inventoryId"],0);assert_eq!(v["storedStock"]["entry"]["amount"],2);
        for k in ["writerAuthorized","ownershipVerified","effectiveEligibilityVerified","packagedMembershipVerified",
            "nativeV3Verified","rightsVerified","subscriberClosureVerified","productReadAccepted","editedCopyAuthorized","applyAuthorized"]{
            assert_eq!(v[k],false);
        }
        assert_eq!(s.receipt().unwrap(),before);
    }
    #[test]
    fn switch626_furniture_reject_wrong_scope_and_candidate_shape(){
        let s=open(doc());let e=env(&s);
        assert!(s.read_private_collection_group(e,DEF,0,30000001).is_err());
        assert!(s.read_private_collection_group(e,DEF,1,ITEM).is_err());
        assert!(s.read_private_collection_group(e,DEF,0,40000099).is_err());
        assert!(open(doc()).read_private_collection_group(e,DEF,0,ITEM).is_err());
        let mut stale=e;stale.expected_index_generation+=1;
        assert!(s.read_private_collection_group(stale,DEF,0,ITEM).is_err());
        for k in 0..10{
            let mut v=doc();
            match k{
                0=>v["Player"]["CollectionSets"][0]["GroupData"][0]["State"]=json!(0),
                1=>v["Player"]["CollectionSets"][0]["GroupData"][0]["State"]=json!("NotComplete"),
                2=>v["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["40000001"]=json!(true),
                3=>{let m=&mut v["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"];
                    m["40000002"]=json!(true);m["40000003"]=json!(true);},
                4=>v["Player"]["CollectionSets"].as_array_mut().unwrap().push(json!({
                    "CollectionDefinitionID":2120000002,"GroupData":[{"State":"SetState_NotComplete",
                    "GroupsCollectionItems":{"40000001":true}}]})),
                5=>v["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]["Amount"]=json!(0),
                6=>v["Player"]["ListInventories"]["0"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
                7=>v["Player"]["ListInventories"]["9"]=json!({"ID":9,"CompatibleItemType":"ItemType_Furniture","Inventory":{}}),
                8=>v["Player"]["ListInventories"]["0"]["Inventory"]=json!({}),
                _=>v["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["40000001"]=json!(0),
            }
            assert!(read(&open(v)).is_err(),"case {k}");
        }
        assert_eq!(s.receipt().unwrap().revision,0);
    }
}
