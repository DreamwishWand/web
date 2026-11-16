//! Switch626 fixed ordinary Catalog0 product candidate. ACT1072/1073/1074/1075/1089.
//! Native-private V2 is not product authority; exact compiled definitions and
//! current same-session saved predicates still gate the scoped opt-in ABI.
use super::*;
const BID:&str="9A239D3DB569756D";
const ITEM:u32=40000076;
const DEF:&str="75bc40f5676329d00fb836cae6402d812f386d2f2ce0389c0fca65bb54989ff0";
// Exact public definition IDs derived from the same 508-row RecurringEvent
// projection (raw source SHA256 028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea).
// Ranges compress membership only, never infer new IDs or private saved IDs.
const RECURRING_RANGES:&[(u32,u32)]=&[
    (2010000003,2010000003),
    (2010000007,2010000009),
    (2010000011,2010000017),
    (2010000021,2010000022),
    (2010000024,2010000033),
    (2010000037,2010000037),
    (2010000040,2010000040),
    (2010000043,2010000043),
    (2010000046,2010000046),
    (2010000049,2010000049),
    (2010000053,2010000053),
    (2010000055,2010000055),
    (2010000058,2010000079),
    (2010000081,2010000090),
    (2010000092,2010000093),
    (2010000095,2010000130),
    (2010000132,2010000132),
    (2010000135,2010000138),
    (2010000140,2010000143),
    (2010000145,2010000156),
    (2010000159,2010000164),
    (2010000168,2010000168),
    (2010000171,2010000174),
    (2010000176,2010000180),
    (2010000182,2010000183),
    (2010000185,2010000192),
    (2010000196,2010000208),
    (2010000210,2010000214),
    (2010000236,2010000253),
    (2010200014,2010200029),
    (2010200031,2010200031),
    (2010200034,2010200042),
    (2010200045,2010200045),
    (2010200047,2010200061),
    (2010200063,2010200066),
    (2010400001,2010400015),
    (2010400017,2010400017),
    (2010400019,2010400019),
    (2010400021,2010400022),
    (2010400024,2010400038),
    (2010400060,2010400063),
    (2010500008,2010500009),
    (2010500011,2010500081),
    (2010500086,2010500145),
    (2010500163,2010500186),
    (2010600000,2010600000),
    (2010700000,2010700006),
    (2010700008,2010700009),
    (2010800000,2010800005),
    (2010900000,2010900003),
    (2010900005,2010900005),
    (2011000000,2011000029),
    (2011100000,2011100000),
    (2011200000,2011200000),
    (2011300000,2011300009),
    (2011300012,2011300022),
    (2011300025,2011300025),
    (2011300027,2011300035),
];
fn exact_build(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    need(b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&
        b.build_id==BID&&b.schema==626&&b.externally_attested,"PRODUCT_SWITCH626_CATALOG0_BUILD")?;
    let (a,_)=pack()?;layout_index()?;
    need(a["profiles"]["catalog0Furniture"]["entries"].as_array().is_some_and(|rows|
        rows.iter().any(|r|r[0]==ITEM&&r[1]==DEF)),"PRODUCT_SWITCH626_CATALOG0_DEFINITION")
}
fn selection()->ExistingAmountSelection{ExistingAmountSelection::Inventory{inventory_id:0,item_id:ITEM}}
pub(super) fn validate(s:&ProductSession,t:&CoreExistingAmountTarget,new:u32)->CoreResult<()>{
    exact_build(s)?;
    let v=t.view();
    need(v.selection==selection()&&v.item_id==ITEM as i32&&v.compatible_item_type==ExistingAmountItemType::Furniture&&
        v.chest.is_none()&&v.old_amount.checked_sub(1)==Some(new)&&new>0,"PRODUCT_SWITCH626_CATALOG0_SCOPE")?;
    let b=&s.decoded;let player=indexed_read::roots(b)?.player;
    let (_,entry)=inventory_amount_entry(b,player,0,ITEM)?;
    need(strv(b,entry,"Marker")?=="ItemMarker_None","PRODUCT_SWITCH626_CATALOG0_MARKER")?;
    // Current saved route/restriction is verified by the existing typed
    // inventory_amount_entry; the source pack proves this exact definition.
    Ok(())
}
pub(super) fn harvest(b:&[u8],s:Span,id:u32,ix:usize,item:i32)->CoreResult<()>{
    // E2260 original DutyAch SHA f5675e1c...; exact layer0 definitions:
    // 2110000038 e05f3a180b54bd455ed1bd3f110395d49908fb743490f0e61975330b47b96517
    // 2110000161 cd553390dee2e769cc4897877c4d9b9285ecda905e5a4bee65597b8393526732
    // Both kind16 payload fields [1,5,11,12], no skip-if-possess; conditions disjoint.
    need(item==ITEM as i32&&ix==0&&matches!(id,2110000038|2110000161),"PRODUCT_SWITCH626_CATALOG0_HARVEST_DEF")?;
    let data=leaf(b,f(b,f(b,s,"StepData")?,"ItemFilter")?)?;
    need(data["Data"]["Type"]=="ItemType_ActivityItem"&&data["Data"]["ActivityItemType"]=="ActivityItemType_Crop"&&
        filter_disjoint(&data,item,true)&&array(b,f(b,s,"ItemsUsed")?,16384)?.is_empty(),
        "PRODUCT_SWITCH626_CATALOG0_HARVEST_FILTER")
}
fn recurring_kind(id:u32)->Option<&'static str>{
    if !RECURRING_RANGES.iter().any(|&(lo,hi)|(lo..=hi).contains(&id)){return None}
    Some(match id/10000%1000{
        0=>"ItemSpawning",20=>"FishSpawningInVillage",40=>"WildCropsSpawningInVillage",
        50=>"FlowerSpawningInVillage",60=>"FlowerDryingInVillage",70=>"ChooseVillageArea",
        80=>"MiningRockTurningSpecial",90=>"PendingFishUpgrade",100=>"TimeLostTreasureSpawning",
        110=>"ChooseItem",120=>"MakeCharacterEager",130=>"SnippetSpawning",_=>return None,
    })
}
pub(super) fn recurring(b:&[u8],world:Span,item:i32)->CoreResult<()>{
    need(item==ITEM as i32,"PRODUCT_SWITCH626_CATALOG0_ONLY")?;
    let mut budget=0;
    for(k,s)in members(b,f(b,world,"RecurringEvents")?,4096)?{
        // Save keys may span u64; canonical decimal only, no inferred definition.
        let key=k.parse::<u64>().map_err(|_|denied("PRODUCT_SWITCH626_RECURRING_KEY"))?;
        need(key.to_string()==k,"PRODUCT_SWITCH626_RECURRING_KEY")?;
        let one=members(b,s,1)?;need(one.len()==1,"PRODUCT_SWITCH626_RECURRING_ONEOF")?;
        let (kind,body)=&one[0];let id=n(b,*body,"RecurringEventItemID")?;
        need(recurring_kind(id)==Some(kind.as_str()),"PRODUCT_SWITCH626_RECURRING_DEF")?;
        // Known fixed definitions/conditions in E2260; no event replay and
        // no current saved direct item token may enter this bounded scope.
        state_literals(&leaf(b,*body)?,item,&mut budget,0)?;
    }Ok(())
}
impl ProductSession{
    pub(crate) fn discover_switch626_scoped_catalog0(&self,e:WorkerEnvelope,offset:u32)
        ->CoreResult<(Vec<CoreExistingAmountTarget>,Option<u32>,u32)>{
        exact_build(self)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1&&offset<=1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        if offset==1{return Ok((vec![],None,0))}
        let mut rows=Vec::new();
        if let Ok(t)=observe_existing_amount(self,&e,selection()){
            if let Some(new)=t.view().old_amount.checked_sub(1){
                if eligible_bound(self,&t,new,LayoutBinding::Switch626Catalog0Static).is_ok(){rows.push(t);}
            }
        }
        Ok((rows,None,1))
    }
    pub(crate) fn preview_switch626_scoped_catalog0(&self,e:WorkerEnvelope,sel:ExistingAmountSelection,new:u32)
        ->CoreResult<CoreExistingAmountTarget>{
        exact_build(self)?;need(sel==selection(),"PRODUCT_SWITCH626_CATALOG0_ONLY")?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        let t=observe_existing_amount(self,&e,sel)?;
        eligible_bound(self,&t,new,LayoutBinding::Switch626Catalog0Static)?;Ok(t)
    }
    pub(crate) fn stage_switch626_scoped_catalog0(&self,e:WorkerEnvelope,sel:ExistingAmountSelection,
        old:u32,new:u32,entry:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"PRODUCT_AMOUNT_STAGE_ACTION")?;
        let mut read=e;read.action=WorkerAction::ReadDomain;
        let t=self.preview_switch626_scoped_catalog0(read,sel,new)?;
        need(t.view().old_amount==old&&t.view().entry_sha256==entry,"PRODUCT_AMOUNT_ENTRY_CAS")?;
        let cmd=command_from_target(&t,new)?;
        let player=indexed_read::roots(&self.decoded)?.player;
        let edit=target(&self.decoded,player,&cmd)?;
        self.commit_semantic_replacements(e,vec![edit],1,None)
    }
}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn doc()->Value{json!({"GameInfo":{"Version":626},"ConditionalEventHistory":{"ActiveEvents":{}},
 "World":{"GridCollection":{"Grids":{},"DiffGrids":{}},"MissionSlots":{},"RecurringEvents":{},"Villages":[]},
 "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
 "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000076":{"Amount":999,"Marker":"ItemMarker_None"}}}},
 "ContainerInventories":{},"AchievementsData":[],"EvolveStatesProfile":{"EvolveProgressState":{}},"DutySlots":{},
 "BattlePassStates":{"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}}},"Unknown":{"keep":[1,2]}})}
 fn open(d:&Value,sw:bool)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
 platform:if sw{Platform::Switch}else{Platform::SteamWindows},build_kind:if sw{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
 build_id:if sw{BID.into()}else{EXACT_STEAM.into()},schema:626,externally_attested:true}).unwrap()}
 fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
 session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
 #[test]fn fixed_switch_catalog0_current_harvest_and_recurring_exact1(){
  assert_eq!(RECURRING_RANGES.iter().map(|(a,b)|b-a+1).sum::<u32>(),508);
  let mut d=doc();let ix=layout_index().unwrap();
  let (path,asset,local)=ix.iter().find_map(|(p,a)|if layout_asset_excludes(a,ITEM as i32,None).is_ok(){a.grids.keys().next().map(|i|(p,a,*i))}else{None}).unwrap();
  d["World"]["GridCollection"]["DiffGrids"]["19"]=json!({"ID":19,"GridDefaultLayoutPath":path,"GridDefaultLayoutType":asset.kind,
    "DefaultLayoutGridID":local,"DefaultGridHashCode":-4,"DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
  d["World"]["RecurringEvents"]["1"]=json!({"ItemSpawning":{"RecurringEventItemID":2010000003}});
  d["Player"]["DutySlots"]["0"]=json!({"Slots":[{"State":"DutySlotState_OnGoing","DutyId":2110000038,"DifficultyLayer":0,
    "ItemsUsed":[],"StepData":{"ItemFilter":{"Data":{"Type":"ItemType_ActivityItem","ActivityItemType":"ActivityItemType_Crop",
    "Item":0,"ItemList":[],"AnyActivityItem":false}}}}]});
  let s=open(&d,true);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
  let t=s.preview_switch626_scoped_catalog0(e,selection(),998).unwrap();
  assert_eq!(s.discover_switch626_scoped_catalog0(e,0).unwrap().0,vec![t.clone()]);
  assert_eq!(s.receipt().unwrap(),before);
  let other=open(&d,false);assert!(other.preview_switch626_scoped_catalog0(env(&other,WorkerAction::ReadDomain),selection(),998).is_err());
  assert!(s.preview_scoped_product_amount(e,selection(),998).is_err());
  assert!(s.preview_switch626_scoped_chest(e,selection(),998).is_err());
  assert!(s.preview_switch626_scoped_catalog0(e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},998).is_err());
  for mode in 0..8{let mut q=d.clone();match mode{
   0=>q["Player"]["DutySlots"]["0"]["Slots"][0]["DutyId"]=json!(2110000033),
   1=>q["Player"]["DutySlots"]["0"]["Slots"][0]["StepData"]["ItemFilter"]["Data"]["Type"]=json!("ItemType_Furniture"),
   2=>q["Player"]["DutySlots"]["0"]["Slots"][0]["ItemsUsed"]=json!([40000076]),
   3=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["RecurringEventItemID"]=json!(2010000004),
   4=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["Other"]=json!(40000076),
   5=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000076"]["Marker"]=json!("ItemMarker_Favorite"),
   6=>q["World"]["GridCollection"]["DiffGrids"]["19"]["GridDefaultLayoutPath"]=json!("SceneLayouts/Unknown.json"),
   _=>q["World"]["GridCollection"]["DiffGrids"]["19"]["ModifiedObjects"]["1"]=json!({"ID":1,"ItemID":40000076,"State":null})
  }let o=open(&q,true);assert!(o.preview_switch626_scoped_catalog0(env(&o,WorkerAction::ReadDomain),selection(),998).is_err(),"mode {mode}");}
  let st=env(&s,WorkerAction::Stage);assert!(s.stage_switch626_scoped_catalog0(st,selection(),999,998,[0;32]).is_err());
  let r=s.stage_switch626_scoped_catalog0(st,selection(),999,998,t.view().entry_sha256).unwrap();
  assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
  assert!(s.stage_switch626_scoped_catalog0(st,selection(),999,998,t.view().entry_sha256).is_err());
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  let ex=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();
  assert!(s.take_typed_semantic_decoded_once(ex).is_err());
  d["Player"]["ListInventories"]["0"]["Inventory"]["40000076"]["Amount"]=json!(998);assert_eq!(out,serde_json::to_vec(&d).unwrap());
 }
}
