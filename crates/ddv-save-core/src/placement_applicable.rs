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
const DATA_SHA: &str = "16c8ee8f05ad5a89f73c5572c3a019f12f3054eccb142c1c3cb813ccd691611c";
const COMMON_SHA: &str = "78a1ba539b2e6f43182cea2c2ea35c9d10e51f27d4adbb8d4dbc6cce7f7dcd65";
type R<T> = Result<T, &'static str>;
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum PlacementScope { VaseAdd, Comp03LayoutOnly }
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
 need(bytes.len()==155615&&hex(&Sha256::digest(bytes))==DATA_SHA,"PLACEMENT_PACK_SHA")?;
 let d:Value=serde_json::from_slice(bytes).map_err(|_|"PLACEMENT_PACK_JSON")?;
 need(d["contract"]=="wand.core.steam626.placement-applicable-supplement@1"&&d["build"]==BUILD&&d["commonDependencySha256"]==COMMON_SHA,"PLACEMENT_PACK_CONTRACT")?;
 for (k,c) in [("missions",965),("achievements",509),("duties",509),("recurring",508)]{need(map(&d[k],c)?.len()==c,"PLACEMENT_PACK_COUNT")?;}
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
 let mut count=0;
 for g in map(&p["DutySlots"],4096)?.values(){for s in array(&g["Slots"],4096)?{
  count+=1;need(count<=4096,"PLACEMENT_DUTY_BOUND")?;
  let st=text(&s["State"])?;
  need(matches!(st,"DutySlotState_OnGoing"|"DutySlotState_Completed"|"DutySlotState_Invalid"),"PLACEMENT_DUTY_STATE")?;
  if st!="DutySlotState_OnGoing"{continue}
  let rows=array(def(d,"duties",n(&s["DutyId"])?)?,128)?;
  let row=array(rows.get(n(&s["DifficultyLayer"])? as usize).ok_or("PLACEMENT_DUTY_LAYER")?,2)?;
  need(row.len()==2,"PLACEMENT_DUTY_ROW")?;
  let k=n(&row[0])?;
  need(matches!(k,11|13|17|18|19|20|21|22|23|24|26|32|33|36|39|40|41|43),"PLACEMENT_DUTY_KIND")?;
  let f=&s["StepData"]["ItemFilter"]["Data"];
  if k==33 {
   // Exact normal-retail fixed root: Vase area 6; COMP03 Snow island, not a VillageArea.
   // These are the only explicit area branches established by E2135/E2156.
   need(matches!(scope,PlacementScope::VaseAdd|PlacementScope::Comp03LayoutOnly),"PLACEMENT_SCOPE")?;
   need(matches!(n(&row[1])?,4|12)&&f["Type"]=="ItemType_Furniture","PLACEMENT_DUTY_AREA")?;
  }else if !f.is_null(){need(f.as_object().is_some()&&f["Type"].as_str().is_some_and(|t|!t.is_empty()&&t!="ItemType_Furniture"),"PLACEMENT_DUTY_FILTER")?;}
 }} Ok(())
}
fn recurring(w:&Value,d:&Value,scope:PlacementScope)->R<()>{
 let mode=if scope==PlacementScope::Comp03LayoutOnly{1}else{2};
 for (k,v) in map(&w["RecurringEvents"],4096)?{
  canonical_key(k)?;let o=map(v,1)?;need(o.len()==1,"PLACEMENT_RECURRING_ONEOF")?;
  let (kind,body)=o.iter().next().ok_or("PLACEMENT_RECURRING_ONEOF")?;
  let row=array(def(d,"recurring",n(&body["RecurringEventItemID"])?)?,3)?;
  need(row.len()==3&&text(&row[0])?==kind,"PLACEMENT_RECURRING_KIND")?;
  let class=row[mode].as_str().ok_or("PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
  if scope==PlacementScope::Comp03LayoutOnly {
   need(matches!(class,"village"|"other-scene"|"disjoint"|"known-nonplacement"),"PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
  } else {need(class=="disjoint","PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;}
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
 let d=pack(supplement_bytes)?;check(scope,player,world,&d)
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
   json!({"MissionSlots":{},"RecurringEvents":{}}))
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
}
