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
const DATA_SHA: &str = "cee30ee6462856d369289351f8ee0d3f50b9da99f8a0a1c8257ac0e651d9866c";
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
 need(bytes.len()==162406&&hex(&Sha256::digest(bytes))==DATA_SHA,"PLACEMENT_PACK_SHA")?;
 let d:Value=serde_json::from_slice(bytes).map_err(|_|"PLACEMENT_PACK_JSON")?;
 need(d["contract"]=="wand.core.steam626.placement-applicable-supplement@2"&&d["build"]==BUILD&&d["commonDependencySha256"]==COMMON_SHA,"PLACEMENT_PACK_CONTRACT")?;
 for (k,c) in [("missions",965),("achievements",509),("duties",509),("recurring",508)]{need(map(&d[k],c)?.len()==c,"PLACEMENT_PACK_COUNT")?;}
 need(d["vaseItemId"]==40000066&&d["vaseDefinitionSha256"]=="60f840fa471e3678b5f7a018466d150882ad7bddaece6ada9a86327fd1c0607a","PLACEMENT_VASE_FIXED_DEFINITION")?;
 need(array(&d["vaseSceneIds"],182)?.len()==182&&array(&d["vaseTimeBendingDataIds"],82)?.len()==82&&array(&d["vaseVillageAreaNames"],48)?.len()==48,"PLACEMENT_VASE_PACK_COUNT")?;
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
fn recurring(w:&Value,d:&Value,scope:PlacementScope)->R<()>{
 if scope==PlacementScope::VaseAdd{vase_roots(w,d)?;}
 let mode=if scope==PlacementScope::Comp03LayoutOnly{1}else{2};
 for (k,v) in map(&w["RecurringEvents"],4096)?{
  canonical_key(k)?;let o=map(v,1)?;need(o.len()==1,"PLACEMENT_RECURRING_ONEOF")?;
  let (kind,body)=o.iter().next().ok_or("PLACEMENT_RECURRING_ONEOF")?;
  let row=array(def(d,"recurring",n(&body["RecurringEventItemID"])?)?,3)?;
  need(row.len()==3&&text(&row[0])?==kind,"PLACEMENT_RECURRING_KIND")?;
  let class=row[mode].as_str().ok_or("PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
  if scope==PlacementScope::Comp03LayoutOnly {
   need(matches!(class,"village"|"other-scene"|"disjoint"|"known-nonplacement"),"PLACEMENT_RECURRING_APPLICABILITY_UNKNOWN")?;
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
   json!({"MissionSlots":{},"RecurringEvents":{},"TimeLostTreasures":{},"NextTimeLostTreasureID":1,"Snippets":{},"NextSnippetID":0}))
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

 #[test]
 fn qa_vase_recurring_delta_exact124_and_current_root_guards(){
  let d=test_pack();let(p,w)=sample();
  let raw=std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/qa-act1091-pr1416-parent.json")).unwrap();
  assert_eq!(hex(&Sha256::digest(&raw)),"16c8ee8f05ad5a89f73c5572c3a019f12f3054eccb142c1c3cb813ccd691611c");
  assert!(pack(&raw).is_err());
  let prior:Value=serde_json::from_slice(&raw).unwrap();
  for k in ["missions","achievements","duties","build","commonDependencySha256"]{assert_eq!(d[k],prior[k]);}
  let oldpins=prior["pins"].as_object().unwrap();
  for (k,v) in oldpins{assert_eq!(&d["pins"][k],v);}
  let mut delta=(0,0,0);let mut pos=0;let mut neg=1;
  let date="2026-11-16T00:00:00Z";
  let mut events=serde_json::Map::new();
  for (id,row) in d["recurring"].as_object().unwrap(){
   let prev=&prior["recurring"][id];assert_eq!(&row[0],&prev[0]);assert_eq!(&row[1],&prev[1]);
   let kind=row[0].as_str().unwrap();let n=id.parse::<u32>().unwrap();
   let mut body=json!({"RecurringEventItemID":n,"NextOccurrence":date,"EndDate":null});
   if kind=="ItemSpawning"{body["LastOccurrence"]=json!(date);}
   if kind=="SnippetSpawning"{body["Tokens"]=json!(0);body["Snippets"]=json!([]);}
   let mut x=w.clone();x["RecurringEvents"]=json!({"9":{(kind):body.clone()}});
   let comp=matches!(prev[1].as_str(),Some("village"|"other-scene"|"disjoint"|"known-nonplacement"));
   assert_eq!(recurring(&x,&d,PlacementScope::Comp03LayoutOnly).is_ok(),comp,"parent COMP03 {id}");
   if comp{pos+=1}else{neg+=1}
   if row[2]!=prev[2]{
    assert!(prev[2].is_null());assert_eq!(row[2],"offline-preserve");
    match kind{"ItemSpawning"=>delta.0+=1,"TimeLostTreasureSpawning"=>delta.1+=1,"SnippetSpawning"=>delta.2+=1,_=>panic!("unexpected kind")}
    assert!(check(PlacementScope::VaseAdd,&p,&x,&d).is_ok(),"{id}");pos+=1;
    events.insert(id.clone(),json!({(kind):body.clone()}));
    let mut z=x.clone();z["RecurringEvents"]["9"][kind]["NextOccurrence"]=Value::Null;
    assert!(check(PlacementScope::VaseAdd,&p,&z,&d).is_err(),"{id} null time");neg+=1;
    z=x.clone();z["RecurringEvents"]["9"][kind]["TargetObjectID"]=json!(123);
    assert!(check(PlacementScope::VaseAdd,&p,&z,&d).is_err(),"{id} unknown field");neg+=1;
   }else if row[2].is_null(){
    assert!(check(PlacementScope::VaseAdd,&p,&x,&d).is_err(),"{id} unresolved");neg+=1;
   }
  }
  assert_eq!(delta,(63,30,31));
  let mut w=w;w["RecurringEvents"]=Value::Object(events);
  assert!(check(PlacementScope::VaseAdd,&p,&w,&d).is_ok());pos+=1;
  // Exact membership and fresh current roots, including allocator namespace.
  let sid=d["vaseSceneIds"].as_array().unwrap().last().unwrap().clone();
  let tid=d["vaseTimeBendingDataIds"].as_array().unwrap().last().unwrap().clone();
  let area=d["vaseVillageAreaNames"].as_array().unwrap().last().unwrap().clone();
  w["TimeLostTreasures"]=json!({"5":{"ID":5,"ForcedTimeBendingDataItemID":tid,"Location":{"Scene":sid},"CustomLocation":{"GUID":"12345678-ABCD-1234-abcd-123456789abc"}},"11":{"ID":11,"ForcedTimeBendingDataItemID":0,"Location":{"VillageArea":area},"CustomLocation":null}});
  w["NextTimeLostTreasureID"]=json!(12);
  assert!(check(PlacementScope::VaseAdd,&p,&w,&d).is_ok());pos+=1;
  for k in 0..16{
   let mut z=w.clone();
   match k{
    0=>{z["TimeLostTreasures"]["05"]=z["TimeLostTreasures"]["5"].clone();},
    1=>z["TimeLostTreasures"]["5"]["ID"]=json!(6),
    2=>z["TimeLostTreasures"]["5"]["ID"]=json!("5"),
    3=>z["TimeLostTreasures"]["5"]["ForcedTimeBendingDataItemID"]=json!(u32::MAX),
    4=>z["TimeLostTreasures"]["5"]["Location"]=json!({"Scene":u32::MAX}),
    5=>z["TimeLostTreasures"]["5"]["Location"]=json!({"VillageArea":"Unknown"}),
    6=>z["TimeLostTreasures"]["5"]["Location"]=json!({"Scene":sid,"GridID":7}),
    7=>z["TimeLostTreasures"]["5"]["CustomLocation"]=json!({"GUID":"12345678-ABCD-1234-abcd-123456789abZ"}),
    8=>z["TimeLostTreasures"]["5"]["CustomLocation"]=json!({"GUID":"12345678-ABCD-1234-abcd-123456789abc","GridID":7}),
    9=>z["TimeLostTreasures"]["5"]["ItemID"]=json!(40000066),
    10=>z["NextTimeLostTreasureID"]=json!(11),
    11=>z["NextTimeLostTreasureID"]=json!("12"),
    12=>z["Snippets"]=json!({"1":{"ID":1}}),
    13=>z["NextSnippetID"]=json!(-1),
    14=>{z.as_object_mut().unwrap().remove("TimeLostTreasures");},
    _=>{z.as_object_mut().unwrap().remove("Snippets");}
   }
   assert!(check(PlacementScope::VaseAdd,&p,&z,&d).is_err(),"roots {k}");neg+=1;
  }
  let (id,_)=d["recurring"].as_object().unwrap().iter().find(|(_,r)|r[0]=="SnippetSpawning"&&r[2]=="offline-preserve").unwrap();
  for v in [json!(-1),json!(2147483648u64),json!("1"),json!(false)]{
   let mut z=w.clone();z["RecurringEvents"][id]["SnippetSpawning"]["Tokens"]=v;
   assert!(check(PlacementScope::VaseAdd,&p,&z,&d).is_err());neg+=1;
  }
  let mut z=w.clone();z["RecurringEvents"][id]["SnippetSpawning"]["Snippets"]=json!([1]);
  assert!(check(PlacementScope::VaseAdd,&p,&z,&d).is_err());neg+=1;
  assert_eq!((pos,neg),(626,290));
 }

}
