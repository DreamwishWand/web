//! ACT378 / E1337/E1348: private typed Collection readset on ONE ProductSession.
//! Physical saved facts only. No catalogue eligibility, entitlement, writer,
//! completion, reward, or Native V3 authority. Not linked into public WASM.
use super::{ProductSession,WorkerEnvelope,Platform,BuildKind};
use super::indexed_read::{roots,validate_scope,Span};
use super::reference_span_walk::{object,array,field,required};
use crate::{CoreError,CoreResult};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::collections::BTreeSet;

const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH_EXACT:&str="9A239D3DB569756D";
const SWITCH_CONTRACT:&str="wand.native.private.switch626.furniture-collection-group-readset@1";
const STEAM_FURNITURE_CONTRACT:&str="wand.native.private.steam626.furniture-collection-group-readset@1";
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
fn stored_stock(b:&[u8],player:Span,target:i32,furniture:bool)->CoreResult<Value>{
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
        if furniture {
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
    #[cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
    pub fn to_private_receipt_json(&self)->Value{self.value.clone()}
}
impl ProductSession{
    #[cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
    pub fn read_private_collection_group(&self,e:WorkerEnvelope,definition:i32,group_index:usize,target:i32)
        ->CoreResult<PrivateCollectionGroupReceipt>{
        self.scan_collection_group(e,definition,group_index,target,false)
    }
    fn scan_collection_group(&self,e:WorkerEnvelope,definition:i32,group_index:usize,target:i32,product:bool)
        ->CoreResult<PrivateCollectionGroupReceipt>{
        let build=&self.native_source_build;
        let steam=build.platform==Platform::SteamWindows&&build.build_kind==BuildKind::SteamFullVersion&&build.build_id==EXACT;
        let switch_furniture=build.platform==Platform::Switch&&build.build_kind==BuildKind::SwitchBid&&build.build_id==SWITCH_EXACT;
        if (!steam&&!switch_furniture)||build.schema!=626||!build.externally_attested||self.worker_bound!=product{
            return Err(deny("COLLECTION_EXACT_PRIVATE_BUILD_REQUIRED"))
        }
        let steam_furniture=steam&&target/10_000_000==4;
        let furniture=switch_furniture||steam_furniture;
        let major=if furniture{4}else{3};
        if definition<=0||definition/10_000_000!=212||group_index>=MAX_GROUPS_PER_SET||
            target<=0||target/10_000_000!=major{return Err(deny("COLLECTION_SELECTOR"))}
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        if product && (e.expected_revision!=0 || e.expected_index_generation!=1 || target/10_000_000!=4){return Err(deny("COLLECTION_PRODUCT_FRESH_FURNITURE_REQUIRED"))}
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
        let stock=stored_stock(b,player,target,furniture)?;
        // Exact Furniture non-completing candidate shape only. This verifies
        // physical saved facts, not effective membership/rights or rewards.
        if furniture&&(
            group["state"]["token"]!="\"SetState_NotComplete\""||
            group["falseCount"].as_u64().unwrap_or(0)<2||
            group["targetEntry"]["collected"]!=false||
            memberships.len()!=1||
            stock["inventoryId"]!=0||stock["entry"]["amount"].as_i64().unwrap_or(0)<=0){
            return Err(deny(if switch_furniture{"COLLECTION_SWITCH_NONCOMPLETING_SHAPE_REQUIRED"}else{"COLLECTION_STEAM_FURNITURE_NONCOMPLETING_SHAPE_REQUIRED"}));
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
        }else if steam_furniture{
            value["contract"]=json!(STEAM_FURNITURE_CONTRACT);
            value["platform"]=json!("SteamWindows");
            value["buildKind"]=json!("SteamFullVersion");
            value["buildId"]=json!(EXACT);
            value["selectedGroup"]["steamSavedNotCompleteMultiFalseShape"]=json!(true);
        }
        Ok(PrivateCollectionGroupReceipt{value,selected_span})
    }
}

#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
#[derive(Clone,Copy,PartialEq,Eq)]
enum CollectionBoolMode{Switch,Steam}
#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
pub struct PrivateCollectionBoolTarget{
    scope:WorkerEnvelope,
    span:Span,
    mode:CollectionBoolMode,
}
#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
pub type PrivateSwitchCollectionTarget=PrivateCollectionBoolTarget;
#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
pub type PrivateSteamCollectionTarget=PrivateCollectionBoolTarget;
#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
impl CollectionBoolMode{
    fn plan_contract(self)->&'static str{match self{
        Self::Switch=>"wand.private.switch626.collection-existing-bool-exact1@1",
        Self::Steam=>"wand.private.steam626.collection-existing-bool-exact1@1",
    }}
    fn read_contract(self)->&'static str{match self{Self::Switch=>SWITCH_CONTRACT,Self::Steam=>STEAM_FURNITURE_CONTRACT}}
    fn shape(self)->&'static str{match self{
        Self::Switch=>"switchSavedNotCompleteMultiFalseShape",
        Self::Steam=>"steamSavedNotCompleteMultiFalseShape",
    }}
    fn check(self,s:&ProductSession)->CoreResult<()>{
        let b=&s.native_source_build;
        let exact=match self{
            Self::Switch=>b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&b.build_id==SWITCH_EXACT,
            Self::Steam=>b.platform==Platform::SteamWindows&&b.build_kind==BuildKind::SteamFullVersion&&b.build_id==EXACT,
        };
        if !exact||b.schema!=626||!b.externally_attested||s.worker_bound{
            return Err(deny("COLLECTION_STAGE_EXACT_PRIVATE_BUILD_REQUIRED"));
        }
        Ok(())
    }
}
#[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
impl ProductSession{
    /// Private source-only exact one-token candidate. Canonical plan binds
    /// the independently reviewed raw readset, never effective rights or
    /// authorization. Steam and Switch have distinct sealed mode contracts.
    fn mint_private_collection_bool_target(&self,e:WorkerEnvelope,plan:&[u8],mode:CollectionBoolMode)
        ->CoreResult<PrivateCollectionBoolTarget>{
        mode.check(self)?;
        if plan.is_empty()||plan.len()>8192{return Err(deny("COLLECTION_PLAN_BOUNDS"))}
        let v:Value=serde_json::from_slice(plan).map_err(|_|deny("COLLECTION_PLAN_JSON"))?;
        if serde_json::to_vec(&v).map_err(|_|deny("COLLECTION_PLAN_JSON"))?.as_slice()!=plan{
            return Err(deny("COLLECTION_PLAN_CANONICAL"))
        }
        let keys=["contract","definitionId","groupIndex","itemId","sourceDecodedSha256",
            "collectionSetsSha256","groupSha256","mapSha256","entrySha256","stateSha256",
            "stockEntrySha256","stockRouteSha256"];
        let m=v.as_object().ok_or(deny("COLLECTION_PLAN_OBJECT"))?;
        if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||v["contract"]!=mode.plan_contract(){
            return Err(deny("COLLECTION_PLAN_FIELDS"))
        }
        let definition=v["definitionId"].as_i64().and_then(|n|i32::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        let group=v["groupIndex"].as_u64().and_then(|n|usize::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        let item=v["itemId"].as_i64().and_then(|n|i32::try_from(n).ok()).ok_or(deny("COLLECTION_PLAN_SELECTOR"))?;
        if item<=0||item/10_000_000!=4{return Err(deny("COLLECTION_PLAN_FURNITURE_REQUIRED"));}
        let r=self.read_private_collection_group(e,definition,group,item)?;
        let x=&r.value;let g=&x["selectedGroup"];let stock=&x["storedStock"];
        if x["contract"]!=mode.read_contract()||v["sourceDecodedSha256"]!=x["decodedSha256"]||
           v["collectionSetsSha256"]!=x["collectionSetsSha256"]||
           v["groupSha256"]!=g["groupSha256"]||v["mapSha256"]!=g["mapSha256"]||
           v["entrySha256"]!=g["targetEntry"]["tokenSha256"]||
           v["stateSha256"]!=g["state"]["sha256"]||
           v["stockEntrySha256"]!=stock["entry"]["entrySha256"]||
           v["stockRouteSha256"]!=stock["routeSha256"]||g[mode.shape()]!=true||
           (mode==CollectionBoolMode::Steam&&g["falseCount"].as_u64()!=Some(3)){
            return Err(deny("COLLECTION_PLAN_READSET_CAS"))
        }
        let span=r.selected_span.ok_or(deny("COLLECTION_TARGET_SPAN"))?;
        if self.decoded.get(span.begin..span.end)!=Some(b"false".as_slice()){
            return Err(deny("COLLECTION_TARGET_OLD_BOOL"))
        }
        Ok(PrivateCollectionBoolTarget{scope:e,span,mode})
    }
    pub fn mint_private_switch626_collection_target(&self,e:WorkerEnvelope,plan:&[u8])
        ->CoreResult<PrivateSwitchCollectionTarget>{
        self.mint_private_collection_bool_target(e,plan,CollectionBoolMode::Switch)
    }
    pub fn mint_private_steam626_collection_target(&self,e:WorkerEnvelope,plan:&[u8])
        ->CoreResult<PrivateSteamCollectionTarget>{
        self.mint_private_collection_bool_target(e,plan,CollectionBoolMode::Steam)
    }
    fn stage_private_collection_bool(&self,e:WorkerEnvelope,target:&PrivateCollectionBoolTarget,mode:CollectionBoolMode)
        ->CoreResult<super::SemanticStageReceipt>{
        let old=&target.scope;
        if target.mode!=mode||e.contract!=old.contract||e.session_id!=old.session_id||
           e.expected_revision!=old.expected_revision||e.expected_index_generation!=old.expected_index_generation||
           e.expected_decoded_sha256!=old.expected_decoded_sha256{
            return Err(deny("COLLECTION_TARGET_EPOCH_CAS"))
        }
        mode.check(self)?;
        self.commit_private_collection_bool(e,target.span)
    }
    pub fn stage_private_switch626_collection_bool(&self,e:WorkerEnvelope,target:&PrivateSwitchCollectionTarget)
        ->CoreResult<super::SemanticStageReceipt>{
        self.stage_private_collection_bool(e,target,CollectionBoolMode::Switch)
    }
    pub fn stage_private_steam626_collection_bool(&self,e:WorkerEnvelope,target:&PrivateSteamCollectionTarget)
        ->CoreResult<super::SemanticStageReceipt>{
        self.stage_private_collection_bool(e,target,CollectionBoolMode::Steam)
    }
}

#[cfg(all(test,feature="private-native-v1",not(target_arch="wasm32")))]
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

#[cfg(all(test,feature="private-native-v1",not(target_arch="wasm32")))]
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
    #[test]
    fn steam626_furniture_exact_shape_and_no_authority(){
        let open_steam=|v:Value| ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT.into(),
            schema:626,externally_attested:true}).unwrap();
        let s=open_steam(doc());let before=s.receipt().unwrap();let v=read(&s).unwrap();
        assert_eq!(v["contract"],STEAM_FURNITURE_CONTRACT);
        assert_eq!(v["platform"],"SteamWindows");assert_eq!(v["fullVersion"],EXACT);
        assert_eq!(v["buildKind"],"SteamFullVersion");assert_eq!(v["buildId"],EXACT);
        assert_eq!(v["selectedGroup"]["steamSavedNotCompleteMultiFalseShape"],true);
        assert!(v["selectedGroup"].get("switchSavedNotCompleteMultiFalseShape").is_none());
        assert_eq!(v["selectedGroup"]["falseCount"],3);
        assert_eq!(v["storedStock"]["inventoryId"],0);assert_eq!(v["storedMemberships"].as_array().unwrap().len(),1);
        for k in ["writerAuthorized","ownershipVerified","effectiveEligibilityVerified","packagedMembershipVerified",
            "nativeV3Verified","rightsVerified","subscriberClosureVerified","productReadAccepted","editedCopyAuthorized","applyAuthorized"]{
            assert_eq!(v[k],false);
        }
        assert_eq!(s.receipt().unwrap(),before);
        for state in [json!(0),json!("NotComplete"),json!("SetState_Complete")]{
            let mut v=doc();v["Player"]["CollectionSets"][0]["GroupData"][0]["State"]=state;
            assert!(read(&open_steam(v)).is_err());
        }
        let mut v=doc();v["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]["Amount"]=json!(0);
        assert!(read(&open_steam(v)).is_err());
        assert!(open_steam(doc()).read_private_collection_group(env(&s),DEF,0,ITEM).is_err());
        let mut stale=env(&s);stale.expected_revision+=1;
        assert!(s.read_private_collection_group(stale,DEF,0,ITEM).is_err());
    }
    #[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
    fn plan(s:&ProductSession)->Value{
        let x=read(s).unwrap();let g=&x["selectedGroup"];let t=&x["storedStock"];
        json!({"contract":"wand.private.switch626.collection-existing-bool-exact1@1",
          "definitionId":DEF,"groupIndex":0,"itemId":ITEM,
          "sourceDecodedSha256":x["decodedSha256"],"collectionSetsSha256":x["collectionSetsSha256"],
          "groupSha256":g["groupSha256"],"mapSha256":g["mapSha256"],"entrySha256":g["targetEntry"]["tokenSha256"],
          "stateSha256":g["state"]["sha256"],"stockEntrySha256":t["entry"]["entrySha256"],"stockRouteSha256":t["routeSha256"]})
    }
    #[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
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

    #[cfg(all(feature="semantic-writer-dev",feature="private-native-v1",not(target_arch="wasm32")))]
    #[test]
    fn steam626_collection_exact1_typed_stage_and_cross_build_denials(){
        let open_steam=|v:Value| ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT.into(),
            schema:626,externally_attested:true}).unwrap();
        let d=doc();let s=open_steam(d.clone());let e=env(&s);let mut p=plan(&s);
        p["contract"]=json!("wand.private.steam626.collection-existing-bool-exact1@1");
        let bytes=serde_json::to_vec(&p).unwrap();
        let sw=open(d.clone());
        assert!(sw.mint_private_steam626_collection_target(env(&sw),&bytes).is_err());
        assert!(s.mint_private_switch626_collection_target(e,&bytes).is_err());
        for k in ["sourceDecodedSha256","collectionSetsSha256","groupSha256","mapSha256","entrySha256","stateSha256","stockEntrySha256","stockRouteSha256","contract"]{
            let mut q=p.clone();q[k]=json!("wrong");
            assert!(s.mint_private_steam626_collection_target(e,&serde_json::to_vec(&q).unwrap()).is_err(),"{k}");
        }
        let mut q=p.clone();q["rightsVerified"]=json!(true);
        assert!(s.mint_private_steam626_collection_target(e,&serde_json::to_vec(&q).unwrap()).is_err());
        let mut other_shape=d.clone();other_shape["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["40000002"]=json!(true);
        let other=open_steam(other_shape);let mut q=plan(&other);q["contract"]=p["contract"].clone();
        assert!(other.mint_private_steam626_collection_target(env(&other),&serde_json::to_vec(&q).unwrap()).is_err());
        let t=s.mint_private_steam626_collection_target(e,&bytes).unwrap();
        let mut stage=e;stage.action=WorkerAction::Stage;
        assert!(s.stage_private_switch626_collection_bool(stage,&t).is_err());
        assert!(s.stage_private_steam626_collection_bool(e,&t).is_err());
        let other=open_steam(d.clone());let mut foreign=env(&other);foreign.action=WorkerAction::Stage;
        assert!(other.stage_private_steam626_collection_bool(foreign,&t).is_err());
        let mut stale=stage;stale.expected_revision+=1;
        assert!(s.stage_private_steam626_collection_bool(stale,&t).is_err());
        let r=s.stage_private_steam626_collection_bool(stage,&t).unwrap();
        assert_eq!(r.operation_count,1);assert_eq!(r.exact_field_changed_count,1);
        assert!(!r.product_writer_authorized);assert!(s.stage_private_steam626_collection_bool(stage,&t).is_err());
        let mut now=env(&s);now.action=WorkerAction::Stage;s.undo_typed_semantic_batch(now).unwrap();
        let mut now=env(&s);now.action=WorkerAction::ExportEditedCopy;
        assert!(s.take_typed_semantic_decoded_once(now).is_err());
        now.action=WorkerAction::Stage;assert!(s.stage_private_steam626_collection_bool(now,&t).is_err());
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

#[cfg(feature="product-collection-scoped")]
const PRODUCT_PACK:&[u8]=include_bytes!("../data/collection-furniture-626.json");

#[cfg(feature="product-collection-scoped")]
impl ProductSession{
    /// A product-facing physical + packaged candidate, never a write grant.
    /// Effective installed definitions, visibility and rights are a separate
    /// fail-closed prerequisite. No raw JSON, private plan or caller pack.
    pub(crate) fn preview_product_collection_candidate(&self,e:WorkerEnvelope,definition:u32,group:usize,item:u32)->CoreResult<Value>{
        let candidate=crate::collection_packaged_eligibility::packaged_collection_candidate(PRODUCT_PACK,&self.native_source_build,item,definition,group)
            .ok_or(deny("COLLECTION_PACKAGED_CANDIDATE_REQUIRED"))?;
        let r=self.scan_collection_group(e,i32::try_from(definition).map_err(|_|deny("COLLECTION_SELECTOR"))?,group,
            i32::try_from(item).map_err(|_|deny("COLLECTION_SELECTOR"))?,true)?;
        let g=&r.value["selectedGroup"];
        let false_count=g["falseCount"].as_u64().ok_or(deny("COLLECTION_FALSE_COUNT"))?;
        if self.native_source_build.platform==Platform::SteamWindows && false_count!=3{
            return Err(deny("COLLECTION_STEAM_EXACT_THREE_FALSE_REQUIRED"))
        }
        if r.selected_span.is_none(){return Err(deny("COLLECTION_SELECTED_ENTRY_ABSENT"))}
        Ok(json!({"contract":"wand.worker.collection-scoped-candidate@1","platform":r.value["platform"],"buildKind":r.value["buildKind"],"buildId":r.value["buildId"],
            "sessionId":hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,"decodedSha256":hex(&e.expected_decoded_sha256),
            "definitionId":candidate.definition_id,"groupIndex":group,"itemId":candidate.item_id,"old":false,"new":true,"falseCount":false_count,
            "itemDefinitionSha256":candidate.item_definition_sha256,"collectionDefinitionSha256":candidate.collection_definition_sha256,"groupDefinitionSha256":candidate.group_definition_sha256,
            "entrySha256":g["targetEntry"]["tokenSha256"],"groupSha256":g["groupSha256"],"mapSha256":g["mapSha256"],
            "stockEntrySha256":r.value["storedStock"]["entry"]["entrySha256"],"positiveStock":r.value["storedStock"]["entry"]["amount"],
            "packagedCandidateVerified":true,"sourcePhysicalVerified":true,"effectiveEligibilityVerified":false,
            "writerAuthorized":false,"editedCopyAuthorized":false,"applyAuthorized":false}))
    }
}

#[cfg(all(test,feature="product-collection-scoped",not(target_arch="wasm32")))]
mod product_collection_source_tests{
    use super::*;
    use crate::{BuildIdentity,WorkerAction,PRODUCT_WORKER_CONTRACT};
    fn fixture(steam:bool,stock:i32,last_false:bool,duplicate:bool)->(ProductSession,u32,u32){
        let pack=crate::collection_packaged_eligibility::pinned(PRODUCT_PACK).unwrap();
        let row=&pack["items"][0]; let item=row[0].as_u64().unwrap() as u32;let def=row[1].as_u64().unwrap() as u32;
        let mut items=serde_json::Map::new();items.insert(item.to_string(),json!(false));
        items.insert("400000001".into(),json!(last_false));items.insert("400000002".into(),json!(false));
        let mut sets=vec![json!({"CollectionDefinitionID":def,"GroupData":[{"GroupIndex":0,"State":"SetState_NotComplete","GroupsCollectionItems":items}]})];
        if duplicate{sets.push(json!({"CollectionDefinitionID":2120000001,"GroupData":[{"GroupIndex":0,"State":"SetState_NotComplete","GroupsCollectionItems":{(item.to_string()):false}}]}))}
        let b=serde_json::to_vec(&json!({"GameInfo":{"Version":626},"World":{},"Player":{"CollectionSets":sets,"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{(item.to_string()):{"Amount":stock}}}}}})).unwrap();
        let mut s=ProductSession::open_decoded_readonly(b,BuildIdentity{platform:if steam{Platform::SteamWindows}else{Platform::Switch},build_kind:if steam{BuildKind::SteamFullVersion}else{BuildKind::SwitchBid},build_id:if steam{EXACT.into()}else{SWITCH_EXACT.into()},schema:626,externally_attested:true}).unwrap();
        s.worker_bound=true;(s,def,item)
    }
    fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
    #[test]
    fn dual_build_physical_candidate_never_grants_authority(){
        for steam in [false,true]{let (s,d,i)=fixture(steam,1,false,false);let e=env(&s);
            let r=s.preview_product_collection_candidate(e,d,0,i).unwrap();
            assert_eq!(r["falseCount"],3);assert_eq!(r["sourcePhysicalVerified"],true);
            assert_eq!(r["effectiveEligibilityVerified"],false);assert_eq!(r["writerAuthorized"],false);
            assert!(s.preview_product_collection_candidate(e,d,1,i).is_err());
            assert!(s.preview_product_collection_candidate(e,d,0,1).is_err());
            let mut stale=e;stale.expected_revision+=1;assert!(s.preview_product_collection_candidate(stale,d,0,i).is_err());
            let (other,_,_)=fixture(steam,1,false,false);assert!(other.preview_product_collection_candidate(e,d,0,i).is_err());
            s.close().unwrap();assert!(s.preview_product_collection_candidate(e,d,0,i).is_err());
            for (stock,dup) in [(0,false),(1,true)]{let (bad,d,i)=fixture(steam,stock,false,dup);assert!(bad.preview_product_collection_candidate(env(&bad),d,0,i).is_err());}
        }
        let (s,d,i)=fixture(true,1,true,false);assert!(s.preview_product_collection_candidate(env(&s),d,0,i).is_err());
        let (s,d,i)=fixture(false,1,true,false);assert_eq!(s.preview_product_collection_candidate(env(&s),d,0,i).unwrap()["falseCount"],2);
    }
}
