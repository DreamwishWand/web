//! Current same-session appearance applicability inputs. Reuse the exact
//! bounded Native observers; no second reader, caller readset or runtime grant.
//! E1895/E1906/E2900: static definitions + current saved structural inputs.
//! This is not complete producer/definition closure or a public Stage gate.
use super::*;
use super::appearance_observer::*;
use serde_json::{json,Value};

const APPEARANCE_DEFINITIONS:&[u8]=include_bytes!("../data/steam626-appearance-definition-join.json");
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
        self.prepare_hair_current_applicability_for(e,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_hair_current_applicability_for(&self,e:WorkerEnvelope,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let t=self.prepare_fixed_product_hair_candidate_for(e,new,scope)?;
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        need(st.revision==0&&st.generation==1,"HAIR_APPLICABLE_EPOCH")?;
        let b=&self.decoded;let root=roots(b)?;
        let player=members(b,root.player,1024)?;let world=members(b,root.world,1024)?;
        let f=branch(b,required(&player,"FemaleAvatar")?)?;let m=branch(b,required(&player,"MaleAvatar")?)?;
        hair_branch_guard(&f)?;hair_branch_guard(&m)?;
        let flags=skin_dialogue_flags(b,Some(required(&world,"DialogueFlags")?),FLAG)?;
        let readset=json!({"contract":match scope{AppearanceBuildScope::Steam626=>"wand.core.steam626.hair-current-applicability-inputs@1",AppearanceBuildScope::Switch626=>"wand.core.switch626.hair-current-applicability-inputs@1"},
            "female":branch_dependencies(b,required(&player,"FemaleAvatar")?)?,
            "male":branch_dependencies(b,required(&player,"MaleAvatar")?)?,
            "femaleReferences":branch_json(&f),"maleReferences":branch_json(&m),
            "ownership":t.ownership,"subscribers":current_subscribers(b,&player,&world)?,
            "dialogueFlags":flags,"activeMale":t.active_male,
            "staticPaletteBound":true,"referenceDefinitionJoinRequired":true,
            "runtimeProducerClosureVerified":false,"productWriterAuthorized":false});
        let readset_sha=digest(&readset)?;
        Ok(AppearanceCurrentWitness{scope:e,selected_token_sha:t.old_token_sha,readset_sha,readset})
    }
    pub(super) fn prepare_skin_current_applicability(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<AppearanceCurrentWitness>{
        self.prepare_skin_current_applicability_for(e,character,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_skin_current_applicability_for(&self,e:WorkerEnvelope,character:i32,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let t=self.prepare_fixed_product_skin_candidate_for(e,character,new,scope)?;
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
        let readset=json!({"contract":match scope{AppearanceBuildScope::Steam626=>"wand.core.steam626.skin-current-applicability-inputs@1",AppearanceBuildScope::Switch626=>"wand.core.switch626.skin-current-applicability-inputs@1"},
            "definition":definition,"selectedCharacterSha256":t.character_sha,
            "oldStock":t.old_stock,"newStock":t.new_stock,"dialogueFlags":t.flags,
            "allCharacterSelections":chars,"subscribers":current_subscribers(b,&player,&world)?,
            "scheduleDefinitionJoinRequired":true,"runtimeProducerClosureVerified":false,
            "productWriterAuthorized":false});
        let readset_sha=digest(&readset)?;
        Ok(AppearanceCurrentWitness{scope:e,selected_token_sha:t.old_token_sha,readset_sha,readset})
    }
}

const APPEARANCE_DEFINITIONS_SHA:&str="e2f53a1fef5a4fb59f47b60437d06000202a9db1ed2bd01dd718d15155c5562f";
const APPEARANCE_PROJECTION_SHA:&str="51e08d4ddab0964d0ad7b995101f2a45f7c2e86ea18fa00c41ef88e243eb1ba5";
static APPEARANCE_DEFINITION_CACHE:std::sync::OnceLock<CoreResult<Value>>=std::sync::OnceLock::new();
fn positive_id(v:&Value)->CoreResult<i64>{
    v.as_i64().filter(|x|*x>0&&*x<=i64::from(i32::MAX)).ok_or(denied("APPEARANCE_DEFINITION_ID"))
}
fn sorted_rows(v:&Value,count:usize,width:usize)->CoreResult<&Vec<Value>>{
    let rows=arr(v)?;need(rows.len()==count,"APPEARANCE_DEFINITION_COUNT")?;
    let mut previous=0;
    for row in rows{
        need(arr(row)?.len()==width,"APPEARANCE_DEFINITION_ROW")?;
        let id=positive_id(&row[0])?;
        need(id>previous,"APPEARANCE_DEFINITION_ORDER")?;previous=id;
    }
    Ok(rows)
}
fn definition_row(rows:&Value,id:i64)->CoreResult<&Value>{
    let rows=arr(rows)?;
    let ix=rows.binary_search_by_key(&id,|r|r[0].as_i64().unwrap_or(-1))
        .map_err(|_|denied("APPEARANCE_DEFINITION_UNKNOWN"))?;
    Ok(&rows[ix])
}
fn parse_appearance_definitions(bytes:&[u8])->CoreResult<Value>{
    need(bytes.len()==159599&&sha(bytes)==APPEARANCE_DEFINITIONS_SHA,"APPEARANCE_DEFINITION_DIGEST")?;
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("APPEARANCE_DEFINITION_JSON"))?;
    need(v["contract"]=="wand.core.steam626.appearance-definition-join@2"&&v["build"]==APPEARANCE_BUILD&&v["schema"]==626&&
        v["sourceProjectionSha256"]==APPEARANCE_PROJECTION_SHA&&v["previousProjectionSha256"]=="91aca6e14ffe5cf9311d05a951c20780381ba61d5b7cbe006f33e8bcc27f0f57","APPEARANCE_DEFINITION_BUILD")?;
    sorted_rows(&v["references"]["Clothing"],1900,5)?;
    sorted_rows(&v["references"]["Makeup"],67,3)?;
    sorted_rows(&v["references"]["AvatarFeature"],43,3)?;
    sorted_rows(&v["missionObjectiveKinds"],965,2)?;
    sorted_rows(&v["hairEventProducers"],2,5)?;
    sorted_rows(&v["skinWearSchedules"],2,4)?;
    sorted_rows(&v["producer"]["missionAffectedBits"],965,2)?;
    sorted_rows(&v["producer"]["achievementKinds"],349,2)?;
    sorted_rows(&v["producer"]["toolEvolveKinds"],3,2)?;
    Ok(v)
}
fn appearance_definitions()->CoreResult<&'static Value>{
    APPEARANCE_DEFINITION_CACHE.get_or_init(||parse_appearance_definitions(APPEARANCE_DEFINITIONS)).as_ref().map_err(|e|*e)
}
fn map_definition_rows<'a>(map:&Value,rows:&'a Value,branch_bit:i64)->CoreResult<Vec<&'a Value>>{
    need(map["present"]==true,"APPEARANCE_DEFINITION_MAP_ABSENT")?;
    let mut seen=std::collections::BTreeSet::new();
    let mut found=Vec::new();
    for entry in arr(&map["entries"])?{
        let key=entry["key"].as_i64().filter(|n|(0..32).contains(n)).ok_or(denied("APPEARANCE_DEFINITION_SLOT"))?;
        need(seen.insert(key),"APPEARANCE_DEFINITION_DUPLICATE_SLOT")?;
        let row=definition_row(rows,positive_id(&entry["savedValue"])?)?;
        need(row[1]==key&&row[2].as_i64().is_some_and(|bits|bits&branch_bit!=0),"APPEARANCE_DEFINITION_BRANCH_SLOT")?;
        found.push(row);
    }
    Ok(found)
}
fn hair_definition_branch(refs:&Value,detail:&Value,pack:&Value,bit:i64)->CoreResult<(usize,std::collections::BTreeSet<i64>)>{
    let rows=&pack["references"];
    let clothes=map_definition_rows(&refs["clothes"],&rows["Clothing"],bit)?;
    let incompatible=map_definition_rows(&refs["incompatibleClothes"],&rows["Clothing"],bit)?;
    let makeup=map_definition_rows(&refs["makeup"],&rows["Makeup"],bit)?;
    need(refs["clothingCustomization"]["present"]==true&&arr(&refs["clothingCustomization"]["entries"])?.is_empty(),"APPEARANCE_DEFINITION_CUSTOMIZATION")?;
    for x in &clothes{
        for y in &clothes{
            if x[0]!=y[0]{
                need(!arr(&x[3])?.contains(&y[1])&&!arr(&x[4])?.contains(&y[0]),"APPEARANCE_DEFINITION_CLOTHING_CONFLICT")?;
            }
        }
        need(incompatible.iter().all(|r|r[1]!=x[1]),"APPEARANCE_DEFINITION_INCOMPATIBLE_SLOT")?;
    }
    for (key,kind) in [(&detail["eyeballScalars"]["EyeballItemID"],0),(&detail["scalars"]["SprintEffectID"],1)]{
        need(key["present"]==true,"APPEARANCE_DEFINITION_FEATURE_ABSENT")?;
        let row=definition_row(&rows["AvatarFeature"],positive_id(&key["value"])?)?;
        need(row[1]==kind&&row[2]==1,"APPEARANCE_DEFINITION_FEATURE_TYPE")?;
    }
    let n=clothes.len()+incompatible.len()+makeup.len();
    let ids=clothes.into_iter().chain(incompatible).chain(makeup).map(|r|positive_id(&r[0])).collect::<CoreResult<std::collections::BTreeSet<_>>>()?;
    Ok((n,ids))
}
// Join physical step/substep/objective counts and indices. Objective kind is
// definition metadata, not a claim about the saved runtime-generated filter.
fn mission_definition_join(subscribers:&Value,pack:&Value)->CoreResult<(usize,usize,std::collections::BTreeSet<i64>)>{
    let mut slots=0usize;let mut objectives=0usize;let mut ids=std::collections::BTreeSet::new();
    for g in arr(&subscribers["missionSlots"]["groups"])?{
        for s in arr(&g["slots"])?{
            if s["state"]=="MissionSlotState_Invalid"{continue;}
            let id=positive_id(&s["missionId"])?;
            need(ids.insert(id),"APPEARANCE_DEFINITION_MISSION_ALIAS")?;
            let row=definition_row(&pack["missionObjectiveKinds"],id)?;
            let expected=arr(&row[1])?;let actual=arr(&s["steps"])?;
            need(expected.len()==actual.len(),"APPEARANCE_DEFINITION_MISSION_STEPS")?;
            slots+=1;
            for (i,(x,y)) in actual.iter().zip(expected).enumerate(){
                let sub=arr(&x["subSteps"])?;let ey=arr(y)?;
                need(x["physicalIndex"]==i&&x["subStepsPresent"]==true&&sub.len()==ey.len(),"APPEARANCE_DEFINITION_MISSION_SUBSTEPS")?;
                for (j,(u,v)) in sub.iter().zip(ey).enumerate(){
                    let obs=arr(&u["objectives"])?;let ev=arr(v)?;
                    need(u["physicalIndex"]==j&&u["objectivesPresent"]==true&&obs.len()==ev.len(),"APPEARANCE_DEFINITION_MISSION_OBJECTIVES")?;
                    for (k,(o,kind)) in obs.iter().zip(ev).enumerate(){
                        need(o["physicalIndex"]==k&&kind.as_u64().is_some_and(|n|n>=98&&n<999),"APPEARANCE_DEFINITION_OBJECTIVE_INDEX")?;
                    }
                    objectives+=ev.len();
                }
            }
        }
    }
    Ok((slots,objectives,ids))
}
fn hair_definition_join(readset:&Value,pack:&Value)->CoreResult<Value>{
    let (n,mut ids)=hair_definition_branch(&readset["femaleReferences"],&readset["female"],pack,1)?;
    let (m,other)=hair_definition_branch(&readset["maleReferences"],&readset["male"],pack,2)?;
    ids.extend(other);
    need(readset["ownership"]["allObservedReferencesHavePositiveSavedAmount"]==true&&
        readset["ownership"]["observedUniqueReferenceCount"]==ids.len(),"APPEARANCE_DEFINITION_STOCK_CLOSURE")?;
    let (slots,objectives,_)=mission_definition_join(&readset["subscribers"],pack)?;
    // The two catalog producers consume a clothing ID plus mission state,
    // not the hair palette scalar. No event/mission/stock field is edited.
    let mut wear=std::collections::BTreeSet::new();
    for row in arr(&pack["hairEventProducers"])?{
        let leaves=arr(&row[3])?;
        need(leaves.len()==2&&leaves[0][0]==480&&leaves[1][0]==295,"APPEARANCE_DEFINITION_HAIR_PRODUCER")?;
        let id=positive_id(&leaves[0][1][0][1])?;
        need(leaves[0][1][0][0]==1&&wear.insert(id),"APPEARANCE_DEFINITION_HAIR_PRODUCER_ITEM")?;
        definition_row(&pack["references"]["Clothing"],id)?;
    }
    Ok(json!({"projectionSha256":APPEARANCE_DEFINITIONS_SHA,"referenceEntries":n+m,"uniqueReferences":ids.len(),
        "featureDefinitions":4,"missionSlots":slots,"missionObjectives":objectives,"clothingProducerDefinitions":wear.len(),
        "clothingProducerInputsUnchangedByScalar":true,"effectiveRuntimeFiltersVerified":false,
        "runtimeProducerClosureVerified":false,"rightsVerified":false,"productWriterAuthorized":false}))
}
fn skin_definition_join(readset:&Value,pack:&Value)->CoreResult<Value>{
    let (slots,objectives,ids)=mission_definition_join(&readset["subscribers"],pack)?;
    let mut required=std::collections::BTreeSet::new();
    for row in arr(&pack["skinWearSchedules"])?{
        let leaves=arr(&row[3])?;
        let mut wear=false;
        for leaf in leaves{
            if leaf[0]==270{
                need(leaf[1][0][0]==1,"APPEARANCE_DEFINITION_SCHEDULE_MISSION")?;
                required.insert(positive_id(&leaf[1][0][1])?);
            }
            if leaf[0]==60{
                need(leaf[1][0][0]==1&&leaf[1][0][1]==SKIN_NEW,"APPEARANCE_DEFINITION_SCHEDULE_SKIN")?;wear=true;
            }
        }
        need(wear,"APPEARANCE_DEFINITION_SCHEDULE_WEAR")?;
    }
    need(required.len()==1&&required.is_disjoint(&ids),"APPEARANCE_DEFINITION_SCHEDULE_CURRENT_MISSION")?;
    // Absence from saved non-invalid slots is a narrower fact than effective
    // mission/schedule or override state; never promote it to a runtime grant.
    Ok(json!({"projectionSha256":APPEARANCE_DEFINITIONS_SHA,"missionSlots":slots,"missionObjectives":objectives,
        "wearScheduleDefinitions":2,"requiredMissionAbsentFromNonInvalidSlots":true,
        "effectiveScheduleVerified":false,"effectiveFlagVerified":false,
        "runtimeProducerClosureVerified":false,"rightsVerified":false,"productWriterAuthorized":false}))
}
impl ProductSession{
    pub(super) fn prepare_hair_definition_bound(&self,e:WorkerEnvelope,new:i32)->CoreResult<AppearanceCurrentWitness>{
        self.prepare_hair_definition_bound_for(e,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_hair_definition_bound_for(&self,e:WorkerEnvelope,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let mut t=self.prepare_hair_current_applicability_for(e,new,scope)?;
        let join=hair_definition_join(&t.readset,appearance_definitions()?)?;
        t.readset["definitionJoin"]=join;t.readset_sha=digest(&t.readset)?;Ok(t)
    }
    pub(super) fn prepare_skin_definition_bound(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<AppearanceCurrentWitness>{
        self.prepare_skin_definition_bound_for(e,character,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_skin_definition_bound_for(&self,e:WorkerEnvelope,character:i32,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let mut t=self.prepare_skin_current_applicability_for(e,character,new,scope)?;
        let join=skin_definition_join(&t.readset,appearance_definitions()?)?;
        t.readset["definitionJoin"]=join;t.readset_sha=digest(&t.readset)?;Ok(t)
    }
}


fn affected_subscriber_guard(readset:&Value,pack:&Value,hair:bool)->CoreResult<Value>{
    let sub=&readset["subscribers"];let producer=&pack["producer"];
    let (_,_,ids)=mission_definition_join(sub,pack)?;
    let mask=if hair{1|4|16}else{2|8|16};
    for id in &ids{
        let row=definition_row(&producer["missionAffectedBits"],*id)?;
        let bits=row[1].as_u64().filter(|n|*n<=31).ok_or(denied("APPEARANCE_PRODUCER_MISSION_BITS"))?;
        need(bits&mask==0,"APPEARANCE_PRODUCER_AFFECTED_MISSION")?;
    }
    let mut seen=std::collections::BTreeSet::new();let mut ongoing=0usize;
    for a in arr(&sub["achievementsData"]["entries"])?{
        let id=positive_id(&a["achievementId"])?;
        need(seen.insert(id),"APPEARANCE_PRODUCER_ACHIEVEMENT_ALIAS")?;
        let row=definition_row(&producer["achievementKinds"],id)?;
        let kind=row[1].as_u64().ok_or(denied("APPEARANCE_PRODUCER_ACHIEVEMENT_KIND"))?;
        if a["state"]=="AchievementState_OnGoing"{
            ongoing+=1;
            need(kind!=65&&kind!=if hair{37}else{35},"APPEARANCE_PRODUCER_AFFECTED_ACHIEVEMENT")?;
        }
    }
    let mut evolve=0usize;
    for r in arr(&sub["evolveStatesProfile"]["entries"])?{
        let row=definition_row(&producer["toolEvolveKinds"],positive_id(&r["itemId"])?)?;
        // E1404/E1454 exact affected model: only the Tool CatchFish chain.
        // Other evolve types need their own operation-specific closure.
        need(row[1]==json!([21,21])&&r["level"]["value"].as_i64().is_some_and(|n|(0..=2).contains(&n))&&
            r["objectivePresent"]==true&&r["objective"]["stepType"]["present"]==false&&
            r["objective"]["progressKeys"]["present"]==false,"APPEARANCE_PRODUCER_AFFECTED_EVOLVE")?;
        evolve+=1;
    }
    Ok(json!({"missionSlots":ids.len(),"achievementDefinitions":seen.len(),"ongoingAchievements":ongoing,
        "evolveDefinitions":evolve,"affectedClassExclusionVerified":true,
        "effectiveRuntimeRegistryVerified":false,"productWriterAuthorized":false}))
}
fn hair_wear_guard(readset:&Value,pack:&Value)->CoreResult<()>{
    // E1411: both definitions are DoOnce, non-inverted Wear + MissionObjectiveStatus,
    // SetDialogueFlag true without RemoveWhenDone. Require the known nonwear
    // branch for both saved avatars; no event history replay or guessed flag.
    for row in arr(&pack["hairEventProducers"])?{
        need(row[2]==1&&row[4][0][1]==json!([2,1])&&arr(&row[4][0])?.len()==2,
            "APPEARANCE_PRODUCER_WEAR_ACTION")?;
        let id=positive_id(&row[3][0][1][0][1])?;
        for branch in ["femaleReferences","maleReferences"]{
            for e in arr(&readset[branch]["clothes"]["entries"])?{
                need(positive_id(&e["savedValue"])?!=id,"APPEARANCE_PRODUCER_WEAR_PRESENT")?;
            }
        }
    }
    Ok(())
}
fn skin_schedule_guard(pack:&Value)->CoreResult<()>{
    // E1454 exact AND root: absent from non-invalid slots maps to None or
    // completed history, neither equals OnGoing4. This is not a generic
    // absent-mission -> incomplete inference. The SHA pins the original AND.
    for r in arr(&pack["skinWearSchedules"])?{
        need(r[2]=="7c66d4ff47c59a192f255d5a0ec0fe5577229bc39ed87c8cc34d10506e30a1d9",
            "APPEARANCE_PRODUCER_SCHEDULE_ROOT")?;
        let a=arr(&r[3])?;need(a.len()==5&&a[1][0]==270&&a[1][1]==json!([[1,2070001405],[3,4]])&&a[4][0]==60,
            "APPEARANCE_PRODUCER_SCHEDULE_STATUS")?;
    }
    Ok(())
}
impl ProductSession{
    pub(super) fn prepare_hair_producer_bound(&self,e:WorkerEnvelope,new:i32)->CoreResult<AppearanceCurrentWitness>{
        self.prepare_hair_producer_bound_for(e,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_hair_producer_bound_for(&self,e:WorkerEnvelope,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let mut t=self.prepare_hair_definition_bound_for(e,new,scope)?;
        let pack=appearance_definitions()?;
        let j=affected_subscriber_guard(&t.readset,pack,true)?;
        hair_wear_guard(&t.readset,pack)?;
        t.readset["affectedProducers"]=j;
        t.readset_sha=digest(&t.readset)?;Ok(t)
    }
    pub(super) fn prepare_skin_producer_bound(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<AppearanceCurrentWitness>{
        self.prepare_skin_producer_bound_for(e,character,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_skin_producer_bound_for(&self,e:WorkerEnvelope,character:i32,new:i32,scope:AppearanceBuildScope)->CoreResult<AppearanceCurrentWitness>{
        let mut t=self.prepare_skin_definition_bound_for(e,character,new,scope)?;
        let pack=appearance_definitions()?;
        let j=affected_subscriber_guard(&t.readset,pack,false)?;
        skin_schedule_guard(pack)?;
        t.readset["affectedProducers"]=j;
        t.readset_sha=digest(&t.readset)?;Ok(t)
    }
}
// Internal Stage bridge only. The caller supplies a CAS digest, never
// definition evidence or a permission bit. Re-resolve every input at Stage;
// the existing ledger performs the final epoch, lexical old token and output CAS.
#[cfg(feature="semantic-writer-dev")]
impl ProductSession{
    pub(super) fn stage_hair_producer_bound(&self,e:WorkerEnvelope,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"HAIR_BOUND_STAGE_ACTION")?;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};
        let w=self.prepare_hair_producer_bound(read,new)?;
        need(w.readset_sha==expected,"HAIR_BOUND_READSET_CAS")?;
        let t=self.prepare_fixed_product_hair_candidate(read,new)?;
        self.stage_fixed_hair_candidate(e,new,t.old,&t.old_token_sha,&t.female_sha,&t.male_sha,projected)
    }
    pub(super) fn stage_skin_producer_bound(&self,e:WorkerEnvelope,character:i32,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"SKIN_BOUND_STAGE_ACTION")?;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};
        let w=self.prepare_skin_producer_bound(read,character,new)?;
        need(w.readset_sha==expected,"SKIN_BOUND_READSET_CAS")?;
        let t=self.prepare_fixed_product_skin_candidate(read,character,new)?;
        self.stage_fixed_skin_candidate(e,character,new,t.old,&t.old_token_sha,&t.character_sha,&t.inventory_sha,projected)
    }
}

// Bounded Worker bridge; keep raw producer/readset and target methods private.
impl ProductSession{
    #[cfg(feature="product-steam626-hair-scoped")]
    pub(crate) fn preview_steam626_hair_bound_worker(&self,e:WorkerEnvelope,new:i32)->CoreResult<serde_json::Value>{
        let w=self.prepare_hair_producer_bound(e,new)?;
        let t=self.prepare_fixed_product_hair_candidate(e,new)?;
        let projected=self.project_fixed_hair_candidate(e,new)?;
        Ok(serde_json::json!({"contract":"wand.core.steam626.hair-exact1-preview@1","old":t.old,"new":t.new,
            "activeMale":t.active_male,"selectedTokenSha256":w.selected_token_sha,"readsetSha256":w.readset_sha,
            "projectedDecodedSha256":projected.iter().map(|x|format!("{:02x}",x)).collect::<Vec<_>>().join(""),
            "exactFieldChangedCount":1,"writerAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[cfg(feature="product-steam626-hair-scoped")]
    pub(crate) fn stage_steam626_hair_bound_worker(&self,e:WorkerEnvelope,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        self.stage_hair_producer_bound(e,new,expected,projected)
    }
    #[cfg(feature="product-steam626-skin-scoped")]
    pub(crate) fn preview_steam626_skin_bound_worker(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<serde_json::Value>{
        let w=self.prepare_skin_producer_bound(e,character,new)?;
        let t=self.prepare_fixed_product_skin_candidate(e,character,new)?;
        let projected=self.project_fixed_skin_candidate(e,character,new)?;
        Ok(serde_json::json!({"contract":"wand.core.steam626.skin-exact1-preview@1","old":t.old,"new":t.new,
            "characterId":t.character,"selectedTokenSha256":w.selected_token_sha,"readsetSha256":w.readset_sha,
            "projectedDecodedSha256":projected.iter().map(|x|format!("{:02x}",x)).collect::<Vec<_>>().join(""),
            "exactFieldChangedCount":1,"writerAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[cfg(feature="product-steam626-skin-scoped")]
    pub(crate) fn stage_steam626_skin_bound_worker(&self,e:WorkerEnvelope,character:i32,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        self.stage_skin_producer_bound(e,character,new,expected,projected)
    }
}

// Switch626 exact Build adapter: the Steam projection retains its original
// catalog provenance (01E ACT1313/1314 exact ten raw definition equivalence).
// The Switch receipt has its own contract; no caller-selected Build or rights.
#[cfg(feature="semantic-writer-dev")]
impl ProductSession{
    #[allow(dead_code)]
    pub(crate) fn preview_switch626_hair_bound_worker(&self,e:WorkerEnvelope,new:i32)->CoreResult<Value>{
        let scope=AppearanceBuildScope::Switch626;
        let w=self.prepare_hair_producer_bound_for(e,new,scope)?;
        let t=self.prepare_fixed_product_hair_candidate_for(e,new,scope)?;
        let p=self.project_appearance_scalar_candidate(t.span,t.old,t.new)?;
        Ok(json!({"contract":"wand.core.switch626.hair-exact1-preview@1","old":t.old,"new":t.new,
            "activeMale":t.active_male,"selectedTokenSha256":w.selected_token_sha,"readsetSha256":w.readset_sha,
            "projectedDecodedSha256":super::appearance_observer::hex(&p),"exactFieldChangedCount":1,"writerAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[allow(dead_code)]
    pub(crate) fn stage_switch626_hair_bound_worker(&self,e:WorkerEnvelope,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"HAIR_BOUND_STAGE_ACTION")?;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};let scope=AppearanceBuildScope::Switch626;
        let w=self.prepare_hair_producer_bound_for(read,new,scope)?;
        need(w.readset_sha==expected,"HAIR_BOUND_READSET_CAS")?;
        let t=self.prepare_fixed_product_hair_candidate_for(read,new,scope)?;
        self.commit_switch626_appearance_scalar_candidate(e,t.span,t.old,t.new,projected)
    }
    #[allow(dead_code)]
    pub(crate) fn preview_switch626_skin_bound_worker(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<Value>{
        let scope=AppearanceBuildScope::Switch626;
        let w=self.prepare_skin_producer_bound_for(e,character,new,scope)?;
        let t=self.prepare_fixed_product_skin_candidate_for(e,character,new,scope)?;
        let p=self.project_appearance_scalar_candidate(t.span,t.old,t.new)?;
        Ok(json!({"contract":"wand.core.switch626.skin-exact1-preview@1","old":t.old,"new":t.new,
            "characterId":t.character,"selectedTokenSha256":w.selected_token_sha,"readsetSha256":w.readset_sha,
            "projectedDecodedSha256":super::appearance_observer::hex(&p),"exactFieldChangedCount":1,"writerAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[allow(dead_code)]
    pub(crate) fn stage_switch626_skin_bound_worker(&self,e:WorkerEnvelope,character:i32,new:i32,expected:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"SKIN_BOUND_STAGE_ACTION")?;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};let scope=AppearanceBuildScope::Switch626;
        let w=self.prepare_skin_producer_bound_for(read,character,new,scope)?;
        need(w.readset_sha==expected,"SKIN_BOUND_READSET_CAS")?;
        let t=self.prepare_fixed_product_skin_candidate_for(read,character,new,scope)?;
        self.commit_switch626_appearance_scalar_candidate(e,t.span,t.old,t.new,projected)
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

 fn definition_doc()->Value{
    let mut d=doc();
    for k in ["FemaleAvatar","MaleAvatar"]{
        let a=&mut d["Player"][k];
        a["Clothes"]=json!({"0":50000094,"1":50100047});
        a["Eyeball"]=json!({"EyeballItemID":70000001});
        a["SprintEffectID"]=json!(70100002);
    }
    d["Player"]["ListInventories"]["1"]["Inventory"]=json!({"50000094":{"Amount":1,"Marker":"ItemMarker_None"},"50100047":{"Amount":1,"Marker":"ItemMarker_None"}});
    d
 }
 fn mission_doc(id:i64,steps:&Value)->Value{
    let mut d=definition_doc();
    let actual:Vec<Value>=steps.as_array().unwrap().iter().map(|s|json!({"SubSteps":s.as_array().unwrap().iter().map(|sub|json!({"Objectives":sub.as_array().unwrap().iter().map(|_|json!({})).collect::<Vec<_>>()})).collect::<Vec<_>>()})).collect();
    d["World"]["MissionSlots"]=json!({"1":{"Slots":[{"SlotId":1,"MissionId":id,"State":"MissionSlotState_OnGoing","CurrentStepIndex":0,"MissionSteps":actual}]}});
    d
 }

 #[test]fn appearance_producer_current_class_exclusions(){
    let p=appearance_definitions().unwrap();let pr=&p["producer"];
    let x=open(definition_doc());let e=env(&x);
    assert!(x.prepare_hair_producer_bound(e,20).is_ok());
    assert!(x.prepare_skin_producer_bound(e,SKIN_CHARACTER,SKIN_NEW).is_ok());
    for (hair,kind) in [(true,37),(false,35),(true,65),(false,65)]{
        let Some(r)=arr(&pr["achievementKinds"]).unwrap().iter().find(|r|r[1]==kind) else{continue};
        let mut d=definition_doc();d["Player"]["AchievementsData"]=json!([{"AchievementID":r[0],"State":"AchievementState_OnGoing"}]);
        let s=open(d);let e=env(&s);
        let result=if hair{s.prepare_hair_producer_bound(e,20)}else{s.prepare_skin_producer_bound(e,SKIN_CHARACTER,SKIN_NEW)};
        assert!(result.is_err());
    }
    for (hair,mask) in [(true,4),(false,8),(true,16),(false,16)]{
        let id=arr(&pr["missionAffectedBits"]).unwrap().iter().find(|r|r[1].as_u64().unwrap()&mask!=0).unwrap()[0].as_i64().unwrap();
        let m=definition_row(&p["missionObjectiveKinds"],id).unwrap();
        if arr(&m[1]).unwrap().is_empty(){continue;}
        let s=open(mission_doc(id,&m[1]));let e=env(&s);
        let result=if hair{s.prepare_hair_producer_bound(e,20)}else{s.prepare_skin_producer_bound(e,SKIN_CHARACTER,SKIN_NEW)};
        assert!(result.is_err());
    }
 }
 #[cfg(feature="semantic-writer-dev")]
 #[test]fn appearance_producer_bound_stage_recomputes_readset(){
    for hair in [true,false]{
        let mut d=definition_doc();let s=open(d.clone());let e=env(&s);
        let w=if hair{s.prepare_hair_producer_bound(e,20).unwrap()}else{s.prepare_skin_producer_bound(e,SKIN_CHARACTER,SKIN_NEW).unwrap()};
        let projected=if hair{s.project_fixed_hair_candidate(e,20).unwrap()}else{s.project_fixed_skin_candidate(e,SKIN_CHARACTER,SKIN_NEW).unwrap()};
        let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
        let call=|s:&ProductSession,e:WorkerEnvelope,sha:&str|if hair{s.stage_hair_producer_bound(e,20,sha,projected)}else{s.stage_skin_producer_bound(e,SKIN_CHARACTER,SKIN_NEW,sha,projected)};
        assert!(call(&s,e,&w.readset_sha).is_err());assert!(call(&s,stage,"forged").is_err());
        let other=open(d.clone());assert!(call(&other,stage,&w.readset_sha).is_err());
        let r=call(&s,stage,&w.readset_sha).unwrap();assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        assert!(call(&s,stage,&w.readset_sha).is_err());
        if hair{d["Player"]["MaleAvatar"]["HairColorIndex"]=json!(20);}else{d["World"]["Characters"][0]["SkinID"]=json!(SKIN_NEW);}
        let o=s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)}).unwrap();
        assert_eq!(o,serde_json::to_vec(&d).unwrap());
    }
 }
 #[cfg(feature="semantic-writer-dev")]
 #[test]fn switch626_appearance_exact1_build_scoped_core(){
    let mut d=definition_doc();d["Player"]["FemaleAvatar"]["HairColorIndex"]=json!(20);
    let make=|v:&Value|{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),
        BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:SWITCH_APPEARANCE_BID.into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
    for hair in [true,false]{
        let s=make(&d);let e=env(&s);
        let preview=|s:&ProductSession,e|if hair{s.preview_switch626_hair_bound_worker(e,20)}else{s.preview_switch626_skin_bound_worker(e,SKIN_CHARACTER,SKIN_NEW)};
        let p=preview(&s,e).unwrap();let sha=p["readsetSha256"].as_str().unwrap();
        let scope=AppearanceBuildScope::Switch626;
        let (span,old,new)=if hair{let t=s.prepare_fixed_product_hair_candidate_for(e,20,scope).unwrap();(t.span,t.old,t.new)}
            else{let t=s.prepare_fixed_product_skin_candidate_for(e,SKIN_CHARACTER,SKIN_NEW,scope).unwrap();(t.span,t.old,t.new)};
        let projected=s.project_appearance_scalar_candidate(span,old,new).unwrap();
        let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
        let call=|s:&ProductSession,e,sha:&str,p|if hair{s.stage_switch626_hair_bound_worker(e,20,sha,p)}else{s.stage_switch626_skin_bound_worker(e,SKIN_CHARACTER,SKIN_NEW,sha,p)};
        assert_eq!(p["exactFieldChangedCount"],1);assert_eq!(p["writerAuthorized"],false);assert!(p.get("readset").is_none());
        let steam=open(d.clone());assert!(preview(&steam,env(&steam)).is_err());
        let foreign=make(&d);assert!(call(&foreign,stage,sha,projected).is_err());
        assert!(call(&s,e,sha,projected).is_err());assert!(call(&s,stage,"bad",projected).is_err());assert!(call(&s,stage,sha,[0;32]).is_err());
        let mut bad=d.clone();if hair{bad["Player"]["AvatarIsMale"]=json!(false);}else{bad["World"]["DialogueFlags"]=json!([]);}
        let b=make(&bad);assert!(preview(&b,env(&b)).is_err());
        let r=call(&s,stage,sha,projected).unwrap();assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        assert!(call(&s,stage,sha,projected).is_err());
        let mut expected=d.clone();if hair{expected["Player"]["MaleAvatar"]["HairColorIndex"]=json!(20);}else{expected["World"]["Characters"][0]["SkinID"]=json!(SKIN_NEW);}
        let out_e=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};
        assert_eq!(s.take_typed_semantic_decoded_once(out_e).unwrap(),serde_json::to_vec(&expected).unwrap());assert!(s.take_typed_semantic_decoded_once(out_e).is_err());
    }
 }
 #[cfg(feature="product-steam626-hair-scoped")]
 #[test]fn appearance_dedicated_hair_worker_exact1(){
    let mut d=definition_doc();let s=open(d.clone());let e=env(&s);
    let projected=s.project_fixed_hair_candidate(e,20).unwrap();
    let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
    let p=g.preview_steam626_hair(e,20).unwrap();assert_eq!(p["old"],74);assert_eq!(p["new"],20);
    assert!(p.get("readset").is_none());assert_eq!(p["writerAuthorized"],false);
    let sha=p["readsetSha256"].as_str().unwrap();let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
    assert!(g.preview_steam626_hair(e,21).is_err());
    assert!(g.stage_steam626_hair(stage,20,"forged",projected).is_err());
    assert!(g.stage_steam626_hair(stage,20,sha,[0;32]).is_err());
    let r=g.stage_steam626_hair(stage,20,sha,projected).unwrap();assert_eq!(r.exact_field_changed_count,1);
    assert!(g.stage_steam626_hair(stage,20,sha,projected).is_err());
    let r=g.receipt().unwrap();let out=WorkerEnvelope{session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ExportEditedCopy,..e};
    d["Player"]["MaleAvatar"]["HairColorIndex"]=json!(20);assert_eq!(g.take_scoped_edit(out).unwrap(),serde_json::to_vec(&d).unwrap());
    assert!(g.take_scoped_edit(out).is_err());
 }
 #[cfg(feature="product-steam626-skin-scoped")]
 #[test]fn appearance_dedicated_skin_worker_exact1(){
    let mut d=definition_doc();let s=open(d.clone());let e=env(&s);
    let projected=s.project_fixed_skin_candidate(e,SKIN_CHARACTER,SKIN_NEW).unwrap();
    let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
    let p=g.preview_steam626_skin(e,SKIN_CHARACTER,SKIN_NEW).unwrap();assert_eq!(p["old"],SKIN_OLD);assert_eq!(p["new"],SKIN_NEW);
    assert!(p.get("readset").is_none());assert_eq!(p["writerAuthorized"],false);
    let sha=p["readsetSha256"].as_str().unwrap();let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
    assert!(g.preview_steam626_skin(e,SKIN_CHARACTER+1,SKIN_NEW).is_err());
    assert!(g.stage_steam626_skin(stage,SKIN_CHARACTER,SKIN_NEW,"forged",projected).is_err());
    assert!(g.stage_steam626_skin(stage,SKIN_CHARACTER,SKIN_NEW,sha,[0;32]).is_err());
    let r=g.stage_steam626_skin(stage,SKIN_CHARACTER,SKIN_NEW,sha,projected).unwrap();assert_eq!(r.exact_field_changed_count,1);
    assert!(g.stage_steam626_skin(stage,SKIN_CHARACTER,SKIN_NEW,sha,projected).is_err());
    let r=g.receipt().unwrap();let out=WorkerEnvelope{session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ExportEditedCopy,..e};
    d["World"]["Characters"][0]["SkinID"]=json!(SKIN_NEW);assert_eq!(g.take_scoped_edit(out).unwrap(),serde_json::to_vec(&d).unwrap());
    assert!(g.take_scoped_edit(out).is_err());
 }
 #[test]fn appearance_definition_bound_current_session(){
    let p=appearance_definitions().unwrap();let row=&p["missionObjectiveKinds"][0];
    let d=mission_doc(row[0].as_i64().unwrap(),&row[1]);let s=open(d.clone());let e=env(&s);let before=s.receipt().unwrap();
    let h=s.prepare_hair_definition_bound(e,20).unwrap();let k=s.prepare_skin_definition_bound(e,SKIN_CHARACTER,SKIN_NEW).unwrap();
    assert_eq!(h.readset["definitionJoin"]["referenceEntries"],4);assert_eq!(h.readset["definitionJoin"]["uniqueReferences"],2);
    assert_eq!(h.readset["definitionJoin"]["featureDefinitions"],4);assert_eq!(h.readset["definitionJoin"]["missionObjectives"],5);
    assert_eq!(k.readset["definitionJoin"]["wearScheduleDefinitions"],2);
    assert_eq!(k.readset["definitionJoin"]["effectiveScheduleVerified"],false);
    assert_eq!(h.readset["definitionJoin"]["productWriterAuthorized"],false);
    assert_eq!(s.receipt().unwrap(),before);assert_eq!(h.readset_sha,digest(&h.readset).unwrap());
    let mut d=d;d["World"]["MissionSlots"]["1"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"]=json!([]);
    let x=open(d);assert!(x.prepare_hair_definition_bound(env(&x),20).is_err());assert!(x.prepare_skin_definition_bound(env(&x),SKIN_CHARACTER,SKIN_NEW).is_err());
    let x=open(definition_doc());assert!(x.prepare_hair_definition_bound(e,20).is_err());
 }
 #[test]fn appearance_definition_bound_rejects_unknown_conflict_and_schedule(){
    let mut p=APPEARANCE_DEFINITIONS.to_vec();p[0]^=1;assert!(parse_appearance_definitions(&p).is_err());
    for mode in 0..4{
        let mut d=definition_doc();match mode{
            0=>{d["Player"]["MaleAvatar"]["Clothes"]["0"]=json!(50000001);d["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]=json!({"Amount":1,"Marker":"ItemMarker_None"});}
            1=>{d["Player"]["MaleAvatar"]["Clothes"]=json!({"0":50100047,"1":50000094});}
            2=>{d["Player"]["FemaleAvatar"]["Eyeball"]["EyeballItemID"]=json!(70100002);}
            _=>{d["Player"]["MaleAvatar"]["SprintEffectID"]=json!(79999999);}
        }
        let x=open(d);assert!(x.prepare_hair_definition_bound(env(&x),20).is_err(),"mode {mode}");
    }
    let p=appearance_definitions().unwrap();
    let row=definition_row(&p["missionObjectiveKinds"],2070001405).unwrap();
    let x=open(mission_doc(2070001405,&row[1]));
    assert!(x.prepare_skin_current_applicability(env(&x),SKIN_CHARACTER,SKIN_NEW).is_ok());
    assert!(x.prepare_skin_definition_bound(env(&x),SKIN_CHARACTER,SKIN_NEW).is_err());
 }
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
