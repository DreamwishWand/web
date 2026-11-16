//! Fixed Steam626 placement applicability supplement (ACT1063).
//! This is a dependency screen, NOT a target mint, writer, provider proof, or event replay.
//! Call from the existing same-session Core binder AFTER the shared Amount dependency
//! projection checks (condition/item/shape/reference checks), never on caller facts.
//! Geometry, installed provider, rights, explicit composite refs, CAS and transaction
//! semantics remain the respective existing Core checks. No new reader or registry.
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

const BUILD: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const DATA_SHA: &str = "90b2461f3a923b7a8680bdda60a78a13055c4f9d4befc0bca4b1b90da711a581";
const COMMON_SHA: &str = "78a1ba539b2e6f43182cea2c2ea35c9d10e51f27d4adbb8d4dbc6cce7f7dcd65";
const SWITCH_BID:&str="9A239D3DB569756D";
type R<T> = Result<T, &'static str>;
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum PlacementScope { VaseAdd, Comp03LayoutOnly, Sr03MixedRoad, Switch626Rm01MixedRoad }
#[derive(Debug, Eq, PartialEq)]
pub(crate) struct SupplementChecked(());
fn need(b:bool,e:&'static str)->R<()> {if b {Ok(())} else {Err(e)}}
fn hex(v:&[u8])->String {v.iter().map(|b|format!("{b:02x}")).collect()}
fn array(v:&Value,max:usize)->R<&Vec<Value>>{v.as_array().filter(|a|a.len()<=max).ok_or("PLACEMENT_ARRAY")}
fn map(v:&Value,max:usize)->R<&serde_json::Map<String,Value>>{v.as_object().filter(|a|a.len()<=max).ok_or("PLACEMENT_MAP")}
fn n(v:&Value)->R<u32>{v.as_u64().and_then(|x|u32::try_from(x).ok()).ok_or("PLACEMENT_UINT")}
fn text(v:&Value)->R<&str>{v.as_str().ok_or("PLACEMENT_TEXT")}
fn def<'a>(d:&'a Value,group:&str,id:u32)->R<&'a Value>{need(id>0,"PLACEMENT_ID")?;d[group].get(id.to_string()).ok_or("PLACEMENT_DEFINITION_UNKNOWN")}
fn canonical_key(k:&str)->R<u32>{let x=k.parse::<u32>().map_err(|_|"PLACEMENT_KEY")?;need(x.to_string()==k,"PLACEMENT_KEY")?;Ok(x)}
fn pack(bytes:&[u8])->R<Value>{
 need(bytes.len()==173864&&hex(&Sha256::digest(bytes))==DATA_SHA,"PLACEMENT_PACK_SHA")?;
 let d:Value=serde_json::from_slice(bytes).map_err(|_|"PLACEMENT_PACK_JSON")?;
 need(d["contract"]=="wand.core.steam626.placement-applicable-supplement@4"&&d["build"]==BUILD&&d["commonDependencySha256"]==COMMON_SHA,"PLACEMENT_PACK_CONTRACT")?;
 for (k,c) in [("missions",965),("achievements",509),("duties",509),("recurring",508)]{need(map(&d[k],c)?.len()==c,"PLACEMENT_PACK_COUNT")?;}
 need(d["vaseItemId"]==40000066&&d["vaseDefinitionSha256"]=="60f840fa471e3678b5f7a018466d150882ad7bddaece6ada9a86327fd1c0607a","PLACEMENT_VASE_FIXED_DEFINITION")?;
 need(array(&d["vaseSceneIds"],182)?.len()==182&&array(&d["vaseTimeBendingDataIds"],82)?.len()==82&&array(&d["vaseVillageAreaNames"],48)?.len()==48,"PLACEMENT_VASE_PACK_COUNT")?;
 need(d["roadItemId"]==40100068&&d["roadTargetArea"]==2&&d["roadDefinitionSha256"]=="38259bcaf241a068214204562fb0a540623c5bb34db86ca1f4ee4e3e7cc0dfe3"&&d["roadChoiceDefinitionSha256"]=="a77b86719d655f5660ecee2e8fdb9a3e86e3ef83e6d8af884f0b91b80b2512b9"&&array(&d["roadChoiceItemIds"],16)?.len()==16,"PLACEMENT_SR03_FIXED_DEFINITION")?;
 need(d["switch626Rm01Build"]==serde_json::json!({"platform":"Switch","kind":"SwitchBid","id":SWITCH_BID,"schema":626})&&map(&d["switch626Rm01SceneDefinitions"],3)?.len()==3&&map(&d["switch626Rm01CropDefinitions"],2)?.len()==2,"PLACEMENT_RM01_PACK")?;
 Ok(d)
}
fn missions(w:&Value,d:&Value)->R<()>{
 let mut slots=0;let mut objectives=0;
 for g in map(&w["MissionSlots"],4096)?.values(){for s in array(&g["Slots"],4096)?{
  slots+=1;need(slots<=4096,"PLACEMENT_MISSION_BOUND")?;
  let state=text(&s["State"])?;
  need(matches!(state,"MissionSlotState_Invalid"|"MissionSlotState_OnGoing"|"MissionSlotState_Available"|"MissionSlotState_Completed"),"PLACEMENT_MISSION_STATE")?;
  if state=="MissionSlotState_Invalid"{continue}
  let shape=array(def(d,"missions",n(&s["MissionId"])?)?,4096)?;
  let steps=array(&s["MissionSteps"],4096)?;
  need(steps.len()==shape.len(),"PLACEMENT_MISSION_SHAPE")?;
  if state=="MissionSlotState_OnGoing"||state=="MissionSlotState_Available"{
   need(array(&s["ItemsToGive"],4096)?.is_empty()&&array(&s["ItemsToGiveAmount"],4096)?.is_empty(),"PLACEMENT_MISSION_GIVE")?;
  }
  let ix=n(&s["CurrentStepIndex"])? as usize;
  need(state!="MissionSlotState_OnGoing"||ix<steps.len(),"PLACEMENT_MISSION_INDEX")?;
  for (i,step) in steps.iter().enumerate(){
   let subs=array(&step["SubSteps"],4096)?;let ds=array(&shape[i],4096)?;
   need(subs.len()==ds.len(),"PLACEMENT_MISSION_SHAPE")?;
   for (j,sub) in subs.iter().enumerate(){
    let os=array(&sub["Objectives"],4096)?;let dd=array(&ds[j],4096)?;
    need(os.len()==dd.len(),"PLACEMENT_MISSION_SHAPE")?;
    for (k,_) in os.iter().enumerate(){
     objectives+=1;need(objectives<=8192,"PLACEMENT_OBJECTIVE_BOUND")?;
     if state=="MissionSlotState_OnGoing"&&i==ix {
      need(matches!(n(&dd[k])?,115|130|231|265|290),"PLACEMENT_MISSION_KIND")?;
      // 115 condition, 231 literal possess: shared dependency projection must independently
      // resolve target item and the current saved filters/refs; never accepted by kind alone.
     }
    }
   }
  }
 }}
 Ok(())
}
fn achievements(p:&Value,d:&Value)->R<()>{
 let mut seen=BTreeSet::new();
 for a in array(&p["AchievementsData"],16384)?{
  let id=n(&a["AchievementID"])?;need(seen.insert(id),"PLACEMENT_ACH_DUPLICATE")?;
  let kind=def(d,"achievements",id)?;
  let st=text(&a["State"])?;
  need(matches!(st,"AchievementState_OnGoing"|"AchievementState_Completed"|"AchievementState_Invalid"),"PLACEMENT_ACH_STATE")?;
  if st=="AchievementState_OnGoing"{
   need(matches!(n(kind)?,21|23|28|29|31|32|33|43|45|46|48|49|51|52|53|54|56|59|60|62|66|69),"PLACEMENT_ACH_KIND")?;
   // 52 Decorate uses shared exact literal-definition refs; unknown/broad selector denied there.
  }
 } Ok(())
}
fn duties(p:&Value,d:&Value,scope:PlacementScope)->R<()>{
 let mut count=0;let mut road_decor=0;
 for g in map(&p["DutySlots"],4096)?.values(){for s in array(&g["Slots"],4096)?{
  count+=1;need(count<=4096,"PLACEMENT_DUTY_BOUND")?;
  let st=text(&s["State"])?;
  need(matches!(st,"DutySlotState_OnGoing"|"DutySlotState_Completed"|"DutySlotState_Invalid"),"PLACEMENT_DUTY_STATE")?;
  if st!="DutySlotState_OnGoing"{continue}
  let rows=array(def(d,"duties",n(&s["DutyId"])?)?,128)?;
  let row=array(rows.get(n(&s["DifficultyLayer"])? as usize).ok_or("PLACEMENT_DUTY_LAYER")?,2)?;
  need(row.len()==2,"PLACEMENT_DUTY_ROW")?;
  let k=n(&row[0])?;
  if k==16{
   let id=n(&s["DutyId"])?;
   need(scope==PlacementScope::Switch626Rm01MixedRoad&&matches!(id,2110000038|2110000161)&&n(&s["DifficultyLayer"])?==0&&row[1].is_null()&&d["switch626Rm01CropDefinitions"].get(id.to_string()).is_some(),"PLACEMENT_RM01_CROP_SCOPE")?;
   need(array(&s["ItemsUsed"],4096)?.is_empty(),"PLACEMENT_RM01_CROP_ITEMS_USED")?;
   super::super::switch626_crop_filter::crop_filter(&s["StepData"]["ItemFilter"],40100068,id,0).map_err(|e|e.0)?;
   continue
  }
  need(matches!(k,11|13|17|18|19|20|21|22|23|24|26|32|33|36|39|40|41|43),"PLACEMENT_DUTY_KIND")?;
  let f=&s["StepData"]["ItemFilter"]["Data"];
  if k==33 {
   // Exact normal-retail fixed root: Vase area 6; COMP03 Snow island, not a VillageArea.
   // These are the only explicit area branches established by E2135/E2156.
   need(matches!(scope,PlacementScope::VaseAdd|PlacementScope::Comp03LayoutOnly|PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad),"PLACEMENT_SCOPE")?;
   need(matches!(n(&row[1])?,4|12)&&f["Type"]=="ItemType_Furniture","PLACEMENT_DUTY_AREA")?;
   if matches!(scope,PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad){
    road_decor+=1;need(road_decor<=2&&f["Item"]==0&&array(&f["ItemList"],4096)?.is_empty()&&f["AnyActivityItem"]==false&&array(&f["Tags"],4096)?.is_empty()&&f["MinRarity"]==1&&f["MaxRarity"]==5&&array(&s["ItemsUsed"],4096)?.is_empty(),"PLACEMENT_SR03_DUTY_FILTER")?;
   }
  }else if !f.is_null(){need(f.as_object().is_some()&&f["Type"].as_str().is_some_and(|t|!t.is_empty()&&t!="ItemType_Furniture"),"PLACEMENT_DUTY_FILTER")?;}
 }} Ok(())
}
// VaseAdd is the fixed ordinary subtype0 Vase target 40000066, not a generic furniture
// capability. The existing same-session binder must bind that exact effective definition and
// provider, geometry/quota/occupied cells, stock and references before minting a target.
// The recurring classification describes offline preservation, NOT a promise that later
// random spawn positions or scheduling in the game are identical after adding furniture.
fn known_u32(v:&Value,ids:&Value)->R<bool>{
 let x=n(v)?;Ok(array(ids,4096)?.iter().any(|i|i.as_u64()==Some(u64::from(x))))
}
fn guid(v:&Value)->bool{
 let Some(s)=v.as_str() else{return false};
 s.len()==36&&s.bytes().enumerate().all(|(i,b)|if matches!(i,8|13|18|23){b==b'-'}else{b.is_ascii_hexdigit()})
}
fn date(v:&Value,nullable:bool)->bool{
 (nullable&&v.is_null())||v.as_str().is_some_and(|s|!s.is_empty()&&s.len()<=128)
}
fn vase_roots(w:&Value,d:&Value)->R<()>{
 let mut max_id=0;
 for(k,v)in map(&w["TimeLostTreasures"],4096)?{
  let id=canonical_key(k)?;
  let o=map(v,4)?;
  need(id>0&&n(&v["ID"])?==id&&o.len()==4&&["ID","ForcedTimeBendingDataItemID","Location","CustomLocation"].iter().all(|k|o.contains_key(*k)),"PLACEMENT_TREASURE_SHAPE")?;
  max_id=max_id.max(id);
  let forced=n(&v["ForcedTimeBendingDataItemID"])?;
  need(forced==0||known_u32(&v["ForcedTimeBendingDataItemID"],&d["vaseTimeBendingDataIds"])?,"PLACEMENT_TREASURE_FORCED")?;
  let loc=map(&v["Location"],1)?;
  need(loc.len()==1,"PLACEMENT_TREASURE_LOCATION")?;
  if let Some(a)=loc.get("VillageArea"){
   need(array(&d["vaseVillageAreaNames"],48)?.iter().any(|x|x==a),"PLACEMENT_TREASURE_LOCATION")?;
  }else if let Some(a)=loc.get("Scene"){
   need(known_u32(a,&d["vaseSceneIds"])?,"PLACEMENT_TREASURE_LOCATION")?;
  }else{return Err("PLACEMENT_TREASURE_LOCATION")}
  let c=&v["CustomLocation"];
  if !c.is_null(){need(map(c,1)?.len()==1&&guid(&c["GUID"]),"PLACEMENT_TREASURE_GUID")?;}
 }
 need(n(&w["NextTimeLostTreasureID"])? > max_id,"PLACEMENT_TREASURE_COUNTER")?;
 // Current supported scope has no live Snippet references. A different live state
 // requires its own affected proof, never an implicit general allow.
 need(map(&w["Snippets"],4096)?.is_empty(),"PLACEMENT_SNIPPET_LIVE")?;
 n(&w["NextSnippetID"])?;
 Ok(())
}
fn vase_event_shape(kind:&str,body:&Value)->R<()>{
 let keys:&[&str]=match kind{
  "ItemSpawning"=>&["RecurringEventItemID","NextOccurrence","EndDate","LastOccurrence"],
  "TimeLostTreasureSpawning"=>&["RecurringEventItemID","NextOccurrence","EndDate"],
  "SnippetSpawning"=>&["RecurringEventItemID","NextOccurrence","EndDate","Tokens","Snippets"],
  _=>return Ok(())
 };
 let o=map(body,keys.len())?;
 need(o.len()==keys.len()&&keys.iter().all(|k|o.contains_key(*k)),"PLACEMENT_RECURRING_SAVED_SHAPE")?;
 need(date(&body["NextOccurrence"],false)&&date(&body["EndDate"],true),"PLACEMENT_RECURRING_TIME")?;
 if kind=="ItemSpawning"{need(date(&body["LastOccurrence"],true),"PLACEMENT_RECURRING_TIME")?;}
 if kind=="SnippetSpawning"{
  need(n(&body["Tokens"])?<=i32::MAX as u32&&array(&body["Snippets"],4096)?.is_empty(),"PLACEMENT_SNIPPET_REFERENCE")?;
 }
 Ok(())
}
// S-R03 is the exact canonical Meadow Area 2 road transition, not a generic
// placement capability. Source definition classes are independently pinned;
// each current saved event still needs its exact typed state and selector.
fn road_event_shape(kind:&str,body:&Value,d:&Value,class:&str)->R<()>{
 let known=match class{
  "around-tree"|"weed-loot"|"literal-condition"|"direct-literal"=>kind=="ItemSpawning",
  "snippet-nontrap"=>kind=="SnippetSpawning",
  "treasure-location"=>kind=="TimeLostTreasureSpawning",
  "area-choice"=>kind=="ChooseVillageArea",
  "activity-choice"=>kind=="ChooseItem"&&body["RecurringEventItemID"]==2011100000,
  "typed-nonroad-producer"=>matches!(kind,"FlowerSpawningInVillage"|"FishSpawningInVillage"|"WildCropsSpawningInVillage"|"MiningRockTurningSpecial"|"PendingFishUpgrade"|"FlowerDryingInVillage"|"MakeCharacterEager"),
  _=>false
 };
 need(known,"PLACEMENT_SR03_RECURRING_CLASS")?;
 if matches!(kind,"ItemSpawning"|"TimeLostTreasureSpawning"|"SnippetSpawning"){return vase_event_shape(kind,body)}
 let keys:&[&str]=match kind{
  "ChooseVillageArea"=>&["RecurringEventItemID","NextOccurrence","EndDate","ChosenVillageArea"],
  "ChooseItem"=>&["RecurringEventItemID","NextOccurrence","EndDate","ChosenItemID"],
  _=>&["RecurringEventItemID","NextOccurrence","EndDate"]
 };
 let o=map(body,keys.len())?;
 need(o.len()==keys.len()&&keys.iter().all(|k|o.contains_key(*k)),"PLACEMENT_SR03_RECURRING_SHAPE")?;
 need(date(&body["NextOccurrence"],false)&&date(&body["EndDate"],true),"PLACEMENT_RECURRING_TIME")?;
 if kind=="ChooseVillageArea"{need(array(&d["vaseVillageAreaNames"],48)?.iter().any(|x|x==&body["ChosenVillageArea"]),"PLACEMENT_SR03_CHOSEN_AREA")?;}
 if kind=="ChooseItem"{need(known_u32(&body["ChosenItemID"],&d["roadChoiceItemIds"])?,"PLACEMENT_SR03_CHOSEN_ITEM")?;}
 Ok(())
}
fn recurring(w:&Value,d:&Value,scope:PlacementScope)->R<()>{
 if matches!(scope,PlacementScope::VaseAdd|PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad){vase_roots(w,d)?;}
 let mode=match scope{PlacementScope::Comp03LayoutOnly=>1,PlacementScope::VaseAdd=>2,PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad=>3};
 for (k,v) in map(&w["RecurringEvents"],4096)?{
  canonical_key(k)?;let o=map(v,1)?;need(o.len()==1,"PLACEMENT_RECURRING_ONEOF")?;
  let (kind,body)=o.iter().next().ok_or("PLACEMENT_RECURRING_ONEOF")?;
  let row=array(def(d,"recurring",n(&body["RecurringEventItemID"])?)?,4)?;
  need(row.len()==4&&text(&row[0])?==kind,"PLACEMENT_RECURRING_KIND")?;
  if scope==PlacementScope::Switch626Rm01MixedRoad&&row[mode].is_null(){
   let id=n(&body["RecurringEventItemID"])?;
   let scene=d["switch626Rm01SceneDefinitions"].get(id.to_string()).ok_or("PLACEMENT_RM01_SCENE_UNKNOWN")?;
   need(matches!(id,2010000176|2010000177|2010000178)&&kind=="ItemSpawning"&&n(&scene[1])?==1540000195,"PLACEMENT_RM01_SCENE_SCOPE")?;
   vase_event_shape(kind,body)?;continue
  }
  let class=row[mode].as_str().ok_or("PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
  if scope==PlacementScope::Comp03LayoutOnly {
   need(matches!(class,"village"|"other-scene"|"disjoint"|"known-nonplacement"),"PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
  } else if matches!(scope,PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad){
   road_event_shape(kind,body,d,class)?;
  } else {
   need(matches!(class,"disjoint"|"offline-preserve"),"PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
   if class=="offline-preserve"{need(matches!(kind.as_str(),"ItemSpawning"|"TimeLostTreasureSpawning"|"SnippetSpawning"),"PLACEMENT_RECURRING_OFFLINE_KIND")?;}
   vase_event_shape(kind,body)?;
  }
 } Ok(())
}
fn battlepass(p:&Value)->R<()>{
 let bp=&p["BattlePassStates"];let mut groups:Vec<&Value>=map(&bp["Progress"],512)?.values().collect();
 groups.push(&bp["FtueProgress"]);let mut count=0;
 for g in groups{
  let mut lists=vec![&g["TasksProgress"]];
  for w in array(&g["WeeklyTasksProgress"],128)?{lists.push(&w["TasksProgress"]);}
  for a in lists{for t in array(a,4096)?{
   count+=1;need(count<=16384,"PLACEMENT_BATTLEPASS_BOUND")?;
   need(matches!(text(&t["TaskState"])?,"BattlePassTaskState_None"|"BattlePassTaskState_NotStarted"|"BattlePassTaskState_Completed"|"BattlePassTaskState_CurrencyClaimed"),"PLACEMENT_BATTLEPASS_ACTIVE_OR_UNKNOWN")?;
   let o=map(&t["Objective"],4)?;
   need(o.len()==4&&["CurAmount","TargetAmount","ItemFilter","ItemIdsCollected"].iter().all(|k|o.contains_key(*k)),"PLACEMENT_BATTLEPASS_SHAPE")?;
   n(&t["Objective"]["CurAmount"])?;n(&t["Objective"]["TargetAmount"])?;
   array(&t["Objective"]["ItemIdsCollected"],16384)?;
  }}
 } Ok(())
}
/// Supplemental verdict only. Bind fixed Build and exact existing common pack before using.
/// Input must be the current strict Core-owned Player/World slices (never a UI projection).
/// Caller must additionally run existing common subscriber, explicit refs and provider/target checks.
/// This helper never creates a target, changes a document, invokes a game event or grants authority.
pub(crate) fn check_supplement(build:&str,common_bytes:&[u8],supplement_bytes:&[u8],scope:PlacementScope,player:&Value,world:&Value)->R<SupplementChecked>{
 need(build==BUILD&&hex(&Sha256::digest(common_bytes))==COMMON_SHA,"PLACEMENT_COMMON_BUILD_OR_PACK")?;
 need(!matches!(scope,PlacementScope::Sr03MixedRoad|PlacementScope::Switch626Rm01MixedRoad),"PLACEMENT_SR03_CORE_FILTER_REQUIRED")?;
 let d=pack(supplement_bytes)?;check(scope,player,world,&d)
}
// Call only from the actual Core-owned S-R03 binder, with the existing
// product_amount_scoped::filter_disjoint function, never a UI-supplied fact.
// Shared subscriber/ref/target/provider/rights/stock and epoch checks remain mandatory.
pub(crate) fn check_sr03_supplement(build:&str,common_bytes:&[u8],supplement_bytes:&[u8],player:&Value,world:&Value,filter_disjoint:fn(&Value,i32,bool)->bool)->R<SupplementChecked>{
 check_road_supplement(build,common_bytes,supplement_bytes,player,world,filter_disjoint,PlacementScope::Sr03MixedRoad)
}
pub(crate) fn check_switch626_rm01_supplement(build:&str,common_bytes:&[u8],supplement_bytes:&[u8],player:&Value,world:&Value,filter_disjoint:fn(&Value,i32,bool)->bool)->R<SupplementChecked>{
 check_road_supplement(build,common_bytes,supplement_bytes,player,world,filter_disjoint,PlacementScope::Switch626Rm01MixedRoad)
}
fn check_road_supplement(build:&str,common_bytes:&[u8],supplement_bytes:&[u8],player:&Value,world:&Value,filter_disjoint:fn(&Value,i32,bool)->bool,scope:PlacementScope)->R<SupplementChecked>{
 let expected=if scope==PlacementScope::Switch626Rm01MixedRoad{SWITCH_BID}else{BUILD};
 need(build==expected&&hex(&Sha256::digest(common_bytes))==COMMON_SHA,"PLACEMENT_COMMON_BUILD_OR_PACK")?;
 let d=pack(supplement_bytes)?;
 let checked=check(scope,player,world,&d)?;
 let bp=&player["BattlePassStates"];let mut groups:Vec<&Value>=map(&bp["Progress"],512)?.values().collect();groups.push(&bp["FtueProgress"]);
 let mut count=0;
 for g in groups{
  let mut lists=vec![&g["TasksProgress"]];
  for w in array(&g["WeeklyTasksProgress"],128)?{lists.push(&w["TasksProgress"]);}
  for a in lists{for t in array(a,4096)?{
   count+=1;need(count<=16384,"PLACEMENT_BATTLEPASS_BOUND")?;
   let st=text(&t["TaskState"])?;
   need(matches!(st,"BattlePassTaskState_CurrencyClaimed"|"BattlePassTaskState_NotStarted"),"PLACEMENT_SR03_BATTLEPASS_STATE")?;
   if st=="BattlePassTaskState_NotStarted"{
    let o=&t["Objective"];need(n(&o["CurAmount"])?==0&&array(&o["ItemIdsCollected"],16384)?.is_empty(),"PLACEMENT_SR03_BATTLEPASS_PROGRESS")?;
    let f=&o["ItemFilter"];let m=map(f,1)?;
    need(m.len()==1&&m.contains_key("Data")&&(f["Data"].is_null()||filter_disjoint(f,40100068,true)),"PLACEMENT_SR03_BATTLEPASS_FILTER")?;
   }
  }}
 }
 Ok(checked)
}
fn check(scope:PlacementScope,player:&Value,world:&Value,d:&Value)->R<SupplementChecked>{
 missions(world,d)?;achievements(player,d)?;duties(player,d,scope)?;recurring(world,d,scope)?;battlepass(player)?;
 Ok(SupplementChecked(()))
}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn fixture()->Vec<u8>{std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("data/steam626-placement-applicable-supplement.json")).unwrap()}
 fn test_pack()->Value{pack(&fixture()).unwrap()}
 fn sample()->(Value,Value){
  (json!({"AchievementsData":[],"DutySlots":{},"BattlePassStates":{"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}}}),
   json!({"MissionSlots":{},"RecurringEvents":{},"TimeLostTreasures":{},"NextTimeLostTreasureID":1,"Snippets":{},"NextSnippetID":0}))
 }
 #[test] fn sr03_choice_exact_definition_and_legacy_columns(){
  let d=test_pack();let(p,mut w)=sample();
  for id in d["roadChoiceItemIds"].as_array().unwrap(){
   let row=json!({"RecurringEventItemID":2011100000,"NextOccurrence":"2026-01-01T00:00:00Z","EndDate":null,"ChosenItemID":id});
   assert!(road_event_shape("ChooseItem",&row,&d,"activity-choice").is_ok());
   w["RecurringEvents"]=json!({"1":{"ChooseItem":row}});
   assert!(check(PlacementScope::Sr03MixedRoad,&p,&w,&d).is_ok());
  }
  let mut row=json!({"RecurringEventItemID":2011100000,"NextOccurrence":"2026-01-01T00:00:00Z","EndDate":null,"ChosenItemID":40100068});
  for bad in [json!(40100068),json!(31700066),json!(31700077),json!(true),json!(null),json!("31700067")]{row["ChosenItemID"]=bad;assert!(road_event_shape("ChooseItem",&row,&d,"activity-choice").is_err());}
  row["ChosenItemID"]=json!(31700067);row["RecurringEventItemID"]=json!(1);assert!(road_event_shape("ChooseItem",&row,&d,"activity-choice").is_err());
  let rows=d["recurring"].as_object().unwrap();assert_eq!(rows.len(),508);assert_eq!(rows.values().filter(|r|r[3].is_null()).count(),19);
  assert_eq!(rows.values().filter(|r|matches!(r[1].as_str(),Some("village"|"other-scene"|"disjoint"|"known-nonplacement"))).count(),500);
  assert_eq!(rows.values().filter(|r|matches!(r[2].as_str(),Some("disjoint"|"offline-preserve"))).count(),496);
 }
 #[test] fn pinned_definition_pack_and_two_scopes(){
  let data=test_pack();let d=&data;let(p,w)=sample();
  assert!(check(PlacementScope::VaseAdd,&p,&w,d).is_ok());
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_ok());
  assert!(check_supplement(BUILD,b"untrusted",&fixture(),PlacementScope::VaseAdd,&p,&w).is_err());
  assert!(check_supplement("wrong",b"",&fixture(),PlacementScope::Comp03LayoutOnly,&p,&w).is_err());
  let mut changed=fixture();changed[0]^=1;assert_eq!(pack(&changed),Err("PLACEMENT_PACK_SHA"));assert_eq!(pack(b""),Err("PLACEMENT_PACK_SHA"));
 }
 #[test] fn recurring_per_scope_and_unknown(){
  let data=test_pack();let d=&data;let(p,mut w)=sample();
  let (id,row)=d["recurring"].as_object().unwrap().iter().find(|(_,r)|r[1]=="village"&&r[2].is_null()).unwrap();
  let n=id.parse::<u32>().unwrap();let k=row[0].as_str().unwrap();
  w["RecurringEvents"]=json!({"1":{(k):{"RecurringEventItemID":n}}});
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_ok());
  assert_eq!(check(PlacementScope::VaseAdd,&p,&w,d),Err("PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN"));
  w["RecurringEvents"]=json!({"1":{"Unknown":{"RecurringEventItemID":n}}});
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_err());
  w["RecurringEvents"]=json!({"1":{(k):{"RecurringEventItemID":1}}});
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_err());
  w["RecurringEvents"]=json!({"01":{(k):{"RecurringEventItemID":n}}});
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_err());
 }
 #[test] fn duty_area_and_active_mission_achievement_guards(){
  let data=test_pack();let d=&data;let(mut p,mut w)=sample();
  let (id,layers)=d["duties"].as_object().unwrap().iter().find(|(_,x)|x.as_array().unwrap().iter().any(|r|r[0]==33&&r[1]==4)).unwrap();
  let layer=layers.as_array().unwrap().iter().position(|r|r[0]==33&&r[1]==4).unwrap();
  p["DutySlots"]=json!({"a":{"Slots":[{"State":"DutySlotState_OnGoing","DutyId":id.parse::<u32>().unwrap(),"DifficultyLayer":layer,"StepData":{"ItemFilter":{"Data":{"Type":"ItemType_Furniture"}}}}]}});
  for scope in [PlacementScope::VaseAdd,PlacementScope::Comp03LayoutOnly]{assert!(check(scope,&p,&w,d).is_ok());}
  p["DutySlots"]["a"]["Slots"][0]["DifficultyLayer"]=json!(99999);
  assert!(check(PlacementScope::VaseAdd,&p,&w,d).is_err());p["DutySlots"]=json!({});
  let id=d["achievements"].as_object().unwrap().iter().find(|(_,v)|**v==37).unwrap().0.parse::<u32>().unwrap();
  p["AchievementsData"]=json!([{"AchievementID":id,"State":"AchievementState_OnGoing"}]);
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_err());p["AchievementsData"]=json!([]);
  w["MissionSlots"]=json!({"a":{"Slots":[{"State":"MissionSlotState_OnGoing","MissionId":1,"CurrentStepIndex":0,"MissionSteps":[],"ItemsToGive":[],"ItemsToGiveAmount":[]}]}});
  assert!(check(PlacementScope::VaseAdd,&p,&w,d).is_err());w["MissionSlots"]=json!({});
  p["BattlePassStates"]["FtueProgress"]["TasksProgress"]=json!([{"TaskState":"BattlePassTaskState_OnGoing"}]);
  assert!(check(PlacementScope::Comp03LayoutOnly,&p,&w,d).is_err());
 }

 #[test] fn vase_offline_roots_and_producer_negative_controls(){
  let data=test_pack();let d=&data;let(p,mut w)=sample();
  let scene=d["vaseSceneIds"][0].as_u64().unwrap();
  w["TimeLostTreasures"]=json!({"1":{"ID":1,"ForcedTimeBendingDataItemID":0,"Location":{"Scene":scene},"CustomLocation":null}});
  w["NextTimeLostTreasureID"]=json!(2);
  let ts="2026-01-01T00:00:00Z";
  for kind in ["ItemSpawning","TimeLostTreasureSpawning","SnippetSpawning"]{
   let (id,_)=d["recurring"].as_object().unwrap().iter().find(|(_,r)|r[0]==kind&&r[2]=="offline-preserve").unwrap();
   let mut b=json!({"RecurringEventItemID":id.parse::<u32>().unwrap(),"NextOccurrence":ts,"EndDate":null});
   if kind=="ItemSpawning"{b["LastOccurrence"]=Value::Null;}
   if kind=="SnippetSpawning"{b["Tokens"]=json!(1);b["Snippets"]=json!([]);}
   w["RecurringEvents"]=json!({"1":{(kind):b}});
   assert!(check(PlacementScope::VaseAdd,&p,&w,d).is_ok());
   let mut bad=w.clone();bad["RecurringEvents"]["1"][kind]["GridID"]=json!(1);
   assert!(check(PlacementScope::VaseAdd,&p,&bad,d).is_err());
   if kind=="SnippetSpawning"{let mut bad=w.clone();bad["RecurringEvents"]["1"][kind]["Snippets"]=json!([1]);assert!(check(PlacementScope::VaseAdd,&p,&bad,d).is_err());}
  }
  for bad in [
    json!({"GridID":1}),json!({"Scene":1}),json!({"VillageArea":"UNKNOWN"}),json!({"Scene":scene,"VillageArea":"VillageAreaType_Beach"})
  ]{
   let mut q=w.clone();q["TimeLostTreasures"]["1"]["Location"]=bad;
   assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_err());
  }
  let mut q=w.clone();q["TimeLostTreasures"]["1"]["ForcedTimeBendingDataItemID"]=json!(40000066);
  assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_err());
  q=w.clone();q["NextTimeLostTreasureID"]=json!(1);assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_err());
  q=w.clone();q["Snippets"]=json!({"1":{}});assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_err());
  q=w.clone();q["TimeLostTreasures"]["1"]["CustomLocation"]=json!({"GUID":"bad"});assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_err());
  q=w.clone();q["TimeLostTreasures"]["1"]["CustomLocation"]=json!({"GUID":"01234567-89ab-cdef-0123-456789abcdef"});assert!(check(PlacementScope::VaseAdd,&p,&q,d).is_ok());
  // COMP03 remains independent of Vase-specific live roots; unknown recurring still denied.
  q=w.clone();q["Snippets"]=json!({"1":{}});assert!(check(PlacementScope::Comp03LayoutOnly,&p,&q,d).is_ok());
 }
}
