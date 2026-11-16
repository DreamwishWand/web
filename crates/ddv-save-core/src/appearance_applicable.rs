//! Current same-session appearance applicability inputs. Reuse the exact
//! bounded Native observers; no second reader, caller readset or runtime grant.
//! E1895/E1906/E2900: static definitions + current saved structural inputs.
//! This is not complete producer/definition closure or a public Stage gate.
use super::*;
use super::appearance_observer::*;
use serde_json::{json,Value};

const SKIN_PACK:&[u8]=include_bytes!("../data/steam626-fixed-skin-catalog-projection.json");
const SKIN_PACK_SHA:&str="440e120ed4555240de2dce30c40544ceba8bcfc21c151ce9106626d28fc2ffc5";
const PACK_SOURCE_SHA:&str="11a9512f27c0394bff4224c1fac12a9fc622c8be2e5cc8e716f6fbe61dff47d6";
const SKIN_CHARACTER:i32=10000053;
const SKIN_OLD:i32=170000054;
const SKIN_NEW:i32=170000000;
const FLAG:i32=2030500265;
fn need(b:bool,e:&'static str)->CoreResult<()>{if b{Ok(())}else{Err(denied(e))}}
fn arr(v:&Value)->CoreResult<&Vec<Value>>{v.as_array().ok_or(denied("APPEARANCE_APPLICABLE_ARRAY"))}
fn digest(v:&Value)->CoreResult<String>{
    let b=serde_json::to_vec(v).map_err(|_|denied("APPEARANCE_APPLICABLE_JSON"))?;
    need(b.len()<=8*1024*1024,"APPEARANCE_APPLICABLE_BOUND")?;Ok(sha(&b))
}
// Projection is generated from all four static rows for this Character,
// not from a private Save/plan. The other three rows cannot grant Stage.
// Fixed source digest, definition/condition joins, unique conditional producer.
fn skin_definition(bytes:&[u8],character:i32,old:i32,new:i32)->CoreResult<Value>{
    need(bytes.len()==2028&&sha(bytes)==SKIN_PACK_SHA,"SKIN_APPLICABLE_PACK_SHA")?;
    let p:Value=serde_json::from_slice(bytes).map_err(|_|denied("SKIN_APPLICABLE_PACK_JSON"))?;
    need(p["contract"]=="wand.core.steam626.fixed-skin-catalog-projection@1"&&p["sourcePackSha256"]==PACK_SOURCE_SHA&&
        p["build"]==json!({"platform":"SteamWindows","kind":"SteamFullVersion","id":APPEARANCE_BUILD,"schema":626}),"SKIN_APPLICABLE_PACK_SCOPE")?;
    need((character,old,new)==(SKIN_CHARACTER,SKIN_OLD,SKIN_NEW),"SKIN_APPLICABLE_FIXED_PAIR")?;
    let rows=arr(&p["rows"])?;need(rows.len()==4,"SKIN_APPLICABLE_PACK_COUNT")?;
    let mut ids=std::collections::BTreeSet::new();
    let mut previous=None;let mut requested=None;let mut producers=0;
    for r in rows{
        let a=arr(r)?;need(a.len()==13&&r[2]==character&&r[4]==1&&r[7]==1&&r[12].is_null(),"SKIN_APPLICABLE_ROW")?;
        let id=r[0].as_i64().ok_or(denied("SKIN_APPLICABLE_ID"))?;
        need(ids.insert(id),"SKIN_APPLICABLE_DUPLICATE")?;
        if r[9][0]!="empty"{producers+=1;need(id==i64::from(new)&&r[9][0]=="dialogueFlag"&&r[9][2]==FLAG,"SKIN_APPLICABLE_PRODUCER")?;}
        if id==i64::from(old){previous=Some(r)}
        if id==i64::from(new){requested=Some(r)}
    }
    let a=previous.ok_or(denied("SKIN_APPLICABLE_OLD"))?;let b=requested.ok_or(denied("SKIN_APPLICABLE_NEW"))?;
    need(producers==1&&a[3]==b[3]&&a[5]==1&&a[6]==0&&b[5]==0&&b[6]==1&&
        a[10]==b[8]&&a[11]==b[9]&&a[11][0]=="dialogueFlag"&&a[11][2]==FLAG&&b[11][0]=="empty","SKIN_APPLICABLE_CONDITION_JOIN")?;
    Ok(json!({"sourcePackSha256":PACK_SOURCE_SHA,"projectionSha256":SKIN_PACK_SHA,
        "oldDefinitionSha256":a[1],"newDefinitionSha256":b[1],"characterDefinitionSha256":a[3],
        "conditionDefinitionSha256":b[9][3],"conditionalCandidateCount":producers,
        "manualOrdinaryCandidate":true,"effectiveHasItemVerified":false,"effectiveFlagVerified":false,
        "runtimeProducerClosureVerified":false,"productWriterAuthorized":false}))
}
fn current_subscribers(b:&[u8],player:&[(String,Span)],world:&[(String,Span)])->CoreResult<Value>{
    let mut budget=DependencyBudget::default();
    let ach=achievements_dependencies_mode(b,Some(required(player,"AchievementsData")?),true,&mut budget)?;
    let mission=mission_dependencies_mode(b,Some(required(world,"MissionSlots")?),&mut budget,true)?;
    let evolve=evolve_dependencies_mode(b,Some(required(player,"EvolveStatesProfile")?),&mut budget,true)?;
    let quest=required(world,"QuestInfo")?;
    let start=skip_ws(b,0);let top=Span{begin:start,end:value_end(b,start)?};
    let history=required(&members(b,top,1024)?,"ConditionalEventHistory")?;
    let events=conditional_event_dependencies(b,Some(history))?;
    need(events["activeEvents"]["present"]==true,"APPEARANCE_APPLICABLE_EVENT_MAP")?;
    for a in arr(&ach["entries"])?{
        need(matches!(a["state"].as_str(),Some("AchievementState_OnGoing"|"AchievementState_Completed"|"AchievementState_Invalid")),"APPEARANCE_APPLICABLE_ACH_STATE")?;
    }
    for g in arr(&mission["groups"])?{for s in arr(&g["slots"])?{
        let state=s["state"].as_str();
        need(matches!(state,Some("MissionSlotState_Invalid"|"MissionSlotState_OnGoing"|"MissionSlotState_Available"|"MissionSlotState_Completed")),"APPEARANCE_APPLICABLE_MISSION_STATE")?;
        if state!=Some("MissionSlotState_Invalid"){
            need(s["missionId"].as_i64().is_some_and(|i|i>0)&&s["currentStepIndex"].as_i64().is_some_and(|i|i>=0)&&s["missionSteps"]["present"]==true,"APPEARANCE_APPLICABLE_MISSION_SHAPE")?;
            let steps=arr(&s["steps"])?;
            if state==Some("MissionSlotState_OnGoing"){
                need(s["currentStepIndex"].as_u64().is_some_and(|i|i<steps.len() as u64),"APPEARANCE_APPLICABLE_MISSION_STEP")?;
            }
            for st in steps{need(st["subStepsPresent"]==true,"APPEARANCE_APPLICABLE_MISSION_SUBSTEP")?;
                for sub in arr(&st["subSteps"])?{need(sub["objectivesPresent"]==true,"APPEARANCE_APPLICABLE_MISSION_OBJECTIVE")?;}}
        }
    }}
    need(evolve["map"]["present"]==true,"APPEARANCE_APPLICABLE_EVOLVE_MAP")?;
    for r in arr(&evolve["entries"])?{
        need(r["objectivePresent"]==true&&r["level"]["value"].as_i64().is_some_and(|v|v>=0),"APPEARANCE_APPLICABLE_EVOLVE_RECORD")?;
    }
    let result=json!({"achievementsData":ach,"missionSlots":mission,"evolveStatesProfile":evolve,
        "questInfo":dependency_hash(b,Some(quest)),"conditionalEventHistory":events,
        "definitionJoinRequired":true,"runtimeProducerClosureVerified":false,"rightsVerified":false});
    digest(&result)?;Ok(result)
}
fn hair_branch_guard(b:&Branch)->CoreResult<()>{
    need(palette(b.hair)&&palette(b.highlight)&&b.customization.present&&b.customization.entries.is_empty(),"HAIR_APPLICABLE_PALETTE_CUSTOMIZATION")?;
    let slots:std::collections::BTreeSet<u32>=b.clothes.entries.iter().map(|e|e.key).collect();
    // E1328/E1402 base adequate-dress predicate; additional full definition
    // compatibility/rights still require source-derived join, not slot alone.
    need(if slots.contains(&9){![0,1,7,15].iter().any(|k|slots.contains(k))}else{slots.contains(&0)&&slots.contains(&1)},"HAIR_APPLICABLE_DRESS")?;
    need(b.incompatible.entries.iter().all(|r|!slots.contains(&r.key)),"HAIR_APPLICABLE_INCOMPATIBLE_SLOT")?;
    Ok(())
}
pub(super) struct AppearanceCurrentWitness{
    pub(super) scope:WorkerEnvelope,
    pub(super) selected_token_sha:String,
    pub(super) readset_sha:String,
    pub(super) readset:Value,
}
// No export to Worker/UI. Static/source and saved-structure predicates only;
// complete affected producer and reference-definition joins remain distinct.
impl ProductSession{
    pub(super) fn prepare_hair_current_applicability(&self,e:WorkerEnvelope,new:i32)->CoreResult<AppearanceCurrentWitness>{
        let t=self.prepare_fixed_product_hair_candidate(e,new)?;
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        need(st.revision==0&&st.generation==1,"HAIR_APPLICABLE_EPOCH")?;
        let b=&self.decoded;let root=roots(b)?;
        let player=members(b,root.player,1024)?;let world=members(b,root.world,1024)?;
        let f=branch(b,required(&player,"FemaleAvatar")?)?;let m=branch(b,required(&player,"MaleAvatar")?)?;
        hair_branch_guard(&f)?;hair_branch_guard(&m)?;
        let flags=skin_dialogue_flags(b,Some(required(&world,"DialogueFlags")?),FLAG)?;
        let readset=json!({"contract":"wand.core.steam626.hair-current-applicability-inputs@1",
            "female":branch_dependencies(b,required(&player,"FemaleAvatar")?)?,
            "male":branch_dependencies(b,required(&player,"MaleAvatar")?)?,
            "ownership":t.ownership,"subscribers":current_subscribers(b,&player,&world)?,
            "dialogueFlags":flags,"activeMale":t.active_male,
            "staticPaletteBound":true,"referenceDefinitionJoinRequired":true,
            "runtimeProducerClosureVerified":false,"productWriterAuthorized":false});
        let readset_sha=digest(&readset)?;
        Ok(AppearanceCurrentWitness{scope:e,selected_token_sha:t.old_token_sha,readset_sha,readset})
    }
    pub(super) fn prepare_skin_current_applicability(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<AppearanceCurrentWitness>{
        let t=self.prepare_fixed_product_skin_candidate(e,character,new)?;
        let definition=skin_definition(SKIN_PACK,character,t.old,new)?;
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        need(st.revision==0&&st.generation==1,"SKIN_APPLICABLE_EPOCH")?;
        let b=&self.decoded;let root=roots(b)?;
        let player=members(b,root.player,1024)?;let world=members(b,root.world,1024)?;
        let chars=skin_selection_dependencies(b,required(&world,"Characters")?)?;
        let mut selected=0;
        for v in &chars{
            let id=v["characterId"].as_i64().ok_or(denied("SKIN_APPLICABLE_SELECTION_ID"))?;
            let skin=v["skinId"]["value"].as_i64();
            if id==i64::from(character){selected+=1;need(skin==Some(i64::from(t.old)),"SKIN_APPLICABLE_CURRENT_SELECTION")?;}
            else{need(skin!=Some(i64::from(t.old))&&skin!=Some(i64::from(new)),"SKIN_APPLICABLE_FOREIGN_SELECTION")?;}
        }
        need(selected==1,"SKIN_APPLICABLE_CHARACTER_ALIAS")?;
        let readset=json!({"contract":"wand.core.steam626.skin-current-applicability-inputs@1",
            "definition":definition,"selectedCharacterSha256":t.character_sha,
            "oldStock":t.old_stock,"newStock":t.new_stock,"dialogueFlags":t.flags,
            "allCharacterSelections":chars,"subscribers":current_subscribers(b,&player,&world)?,
            "scheduleDefinitionJoinRequired":true,"runtimeProducerClosureVerified":false,
            "productWriterAuthorized":false});
        let readset_sha=digest(&readset)?;
        Ok(AppearanceCurrentWitness{scope:e,selected_token_sha:t.old_token_sha,readset_sha,readset})
    }
}
#[cfg(test)]
mod tests{
 use super::*;use crate::{BuildIdentity,BuildKind,Platform};
 fn doc()->Value{
  let a=json!({"HairColorIndex":74,"HairHighlightColor":0,"Clothes":{"0":50000001,"1":50000002},"IncompatibleClothes":{},"Makeup":{},"ClothingCustomization":{}});
  json!({"GameInfo":{"Version":626},"Player":{"AvatarIsMale":true,"MaleAvatar":a,"FemaleAvatar":a,
   "ListInventories":{"1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{"50000001":{"Amount":1,"Marker":"ItemMarker_None"},"50000002":{"Amount":1,"Marker":"ItemMarker_None"}}},"3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{}},"7":{"ID":7,"CompatibleItemType":"ItemType_Skin","Inventory":{"170000054":{"Amount":1,"Marker":"ItemMarker_None"},"170000000":{"Amount":1,"Marker":"ItemMarker_None"}}}},
   "AchievementsData":[],"EvolveStatesProfile":{"EvolveProgressState":{}}},
   "World":{"MissionSlots":{},"QuestInfo":{},"DialogueFlags":[FLAG],"Characters":[{"Base":{"id":SKIN_CHARACTER},"SkinID":SKIN_OLD}]},
   "ConditionalEventHistory":{"ActiveEvents":{}}})
 }
 fn open(v:Value)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[test]fn appearance_applicability_current_readsets_no_authority(){
  let s=open(doc());let e=env(&s);let before=s.receipt().unwrap();
  let h=s.prepare_hair_current_applicability(e,20).unwrap();let k=s.prepare_skin_current_applicability(e,SKIN_CHARACTER,SKIN_NEW).unwrap();
  assert_eq!(h.scope,e);assert_eq!(k.scope,e);assert_eq!(h.selected_token_sha,sha(b"74"));assert_eq!(k.selected_token_sha,sha(b"170000054"));
  assert_eq!(h.readset_sha,digest(&h.readset).unwrap());assert_eq!(k.readset_sha,digest(&k.readset).unwrap());
  assert_eq!(k.readset["definition"]["conditionalCandidateCount"],1);assert_eq!(k.readset["definition"]["effectiveFlagVerified"],false);
  for r in [&h.readset,&k.readset]{assert_eq!(r["runtimeProducerClosureVerified"],false);assert_eq!(r["productWriterAuthorized"],false);}
  assert_eq!(s.receipt().unwrap(),before);
  let mut d=doc();d["World"]["QuestInfo"]=json!({"Unknown":1});let x=open(d);let t=x.prepare_hair_current_applicability(env(&x),20).unwrap();
  assert_ne!(t.readset_sha,h.readset_sha);assert!(x.prepare_hair_current_applicability(e,20).is_err());
 }
 #[test]fn appearance_applicability_static_and_current_denials(){
  assert!(skin_definition(SKIN_PACK,SKIN_CHARACTER,SKIN_OLD,SKIN_NEW).is_ok());
  for old in [170000027,170000108,SKIN_NEW]{assert!(skin_definition(SKIN_PACK,SKIN_CHARACTER,old,SKIN_NEW).is_err());}
  let mut pack=SKIN_PACK.to_vec();pack[0]^=1;assert!(skin_definition(&pack,SKIN_CHARACTER,SKIN_OLD,SKIN_NEW).is_err());
  for mode in 0..7{let mut d=doc();match mode{
   0=>d["Player"]["MaleAvatar"]["ClothingCustomization"]=json!({"0":"400000000"}),
   1=>d["Player"]["MaleAvatar"]["Clothes"]=json!({"0":50000001}),
   2=>d["World"].as_object_mut().unwrap().remove("QuestInfo").map(|_|()).unwrap(),
   3=>d["ConditionalEventHistory"]=json!({}),
   4=>d["Player"]["AchievementsData"]=json!([{"AchievementID":2110000001u32,"State":"AchievementState_Unknown"}]),
   5=>d["World"]["MissionSlots"]=json!({"1":{"Slots":[{"SlotId":1,"MissionId":2070000001u32,"State":"MissionSlotState_OnGoing","CurrentStepIndex":0,"MissionSteps":[]}]}}),
   _=>d["Player"]["EvolveStatesProfile"]=json!({})
  };let s=open(d);assert!(s.prepare_hair_current_applicability(env(&s),20).is_err(),"mode {mode}");}
  let mut d=doc();d["World"]["Characters"].as_array_mut().unwrap().push(json!({"Base":{"id":10000001},"SkinID":SKIN_NEW}));
  let s=open(d);assert!(s.prepare_skin_current_applicability(env(&s),SKIN_CHARACTER,SKIN_NEW).is_err());
 }
}
