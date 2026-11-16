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
// Typed saved payloads. A definition ID is not authentication of a Save body.
fn known_fields(v:&Value,required:&[&str],optional:&[&str])->CoreResult<()>{
    let m=v.as_object().ok_or(denied("CATALOG0_TYPED_OBJECT"))?;
    need(required.iter().all(|k|m.contains_key(*k))&&m.keys().all(|k|
        required.contains(&k.as_str())||optional.contains(&k.as_str())),"CATALOG0_TYPED_FIELDS")
}
fn crop_filter(v:&Value,item:i32,id:u32,ix:usize)->CoreResult<()>{
    known_fields(v,&["Data"],&[])?;
    let d=&v["Data"];
    known_fields(d,&["Item","ItemList","Type","ActivityItemType","AnyActivityItem"],
        &["SubType","Set","Complexity","Mood","Sturdiness","Normality","MinRarity","MaxRarity",
        "FishLocation","FishRarity","Constraint","FishIncludeTrash","FishWeather","TagCondition","Tags",
        "CropType","SeedType","FlowerRarity","IngredientsType","MinMealStarRating","MinUnlockLevel",
        "MaxUnlockLevel","MineralRoughness","EphemeralType","Profession","OnlySeedCrop"])?;
    need(d["Type"]=="ItemType_ActivityItem"&&d["ActivityItemType"]=="ActivityItemType_Crop"&&
        d["AnyActivityItem"].is_boolean(),"CATALOG0_CROP_TYPE")?;
    let literal=state_uint(&d["Item"])?;
    let ls=state_array(&d["ItemList"])?;
    need(literal==0||ls.is_empty(),"CATALOG0_CROP_AMBIGUOUS")?;
    let crop=|n:u32|n/10_000_000==3&&(n%10_000_000)/100_000==2;
    need(literal==0||crop(literal),"CATALOG0_CROP_LITERAL")?;
    for v in ls{need(crop(state_uint(v)?),"CATALOG0_CROP_LIST")?;}
    need((literal==0&&ls.is_empty())||d["AnyActivityItem"]==false,"CATALOG0_CROP_AMBIGUOUS")?;
    // Known full serialized selectors: allow only typed inert defaults or
    // crop-specific scalar/enum restrictions, never a new selector object.
    for k in ["SubType","Constraint","FishWeather"]{if let Some(v)=d.get(k){need(v=="","CATALOG0_CROP_INACTIVE")?;}}
    // E2260: only the reviewed layer-0 crop Duty 2110000038 has the
    // additional serialized Fruit/100 pair. Both fields must agree; neither
    // an arbitrary unlock bound nor a different crop selector is admitted.
    let fruit_pair=id==2110000038&&ix==0&&d.get("MaxUnlockLevel").is_some_and(|v|matches!(state_uint(v),Ok(100)))&&d["CropType"]=="CropTypeCondition_Fruit";
    if !fruit_pair{
        if let Some(v)=d.get("MaxUnlockLevel"){need(state_uint(v)?==0,"CATALOG0_CROP_INACTIVE")?;}
        if let Some(v)=d.get("CropType"){need(v=="CropTypeCondition_Any","CATALOG0_CROP_INACTIVE")?;}
    }
    for k in ["Set","MinRarity","MaxRarity","MinMealStarRating","MinUnlockLevel","Profession"]{
        if let Some(v)=d.get(k){need(state_uint(v)?==0,"CATALOG0_CROP_INACTIVE")?;}}
    for k in ["FishIncludeTrash","OnlySeedCrop"]{if let Some(v)=d.get(k){need(v.is_boolean(),"CATALOG0_CROP_BOOL")?;if k=="FishIncludeTrash"{need(v==false,"CATALOG0_CROP_INACTIVE")?;}}}
    for k in ["Tags","IngredientsType"]{if let Some(v)=d.get(k){need(state_array(v)?.is_empty(),"CATALOG0_CROP_INACTIVE")?;}}
    for (k,w) in [("TagCondition","TagFilterCondition_AllTags"),
        ("SeedType","SeedTypeCondition_Any"),("FlowerRarity","FlowerRarityCondition_Any"),
        ("MineralRoughness","MineralRoughness_Any"),("EphemeralType","EphemeralTypeCondition_Any")]{
        if let Some(v)=d.get(k){need(v==w,"CATALOG0_CROP_INACTIVE")?;}}
    for (k,w) in [("Complexity","Complexity_Lavish"),("Mood","Mood_Calm"),("Sturdiness","Sturdiness_Strong"),("Normality","Normality_Wondrous")]{
        if let Some(v)=d.get(k){known_fields(v,&["UseField","Random","ShowRandomCheckbox",k],&[])?;
            need(v["UseField"]==false&&v["Random"]==false&&v["ShowRandomCheckbox"].is_boolean()&&v[k]==w,"CATALOG0_CROP_INACTIVE")?;}}
    for (k,sub,key) in [("FishLocation","VillageAreas","AreaList"),("FishRarity","FishRarities","FishRarities")]{
        if let Some(v)=d.get(k){known_fields(v,&["UseField","Random","ShowRandomCheckbox",sub],&[])?;
            known_fields(&v[sub],&[key],&[])?;
            need(v["UseField"]==false&&v["Random"]==false&&v["ShowRandomCheckbox"].is_boolean()&&state_array(&v[sub][key])?.is_empty(),"CATALOG0_CROP_INACTIVE")?;}}
    need(filter_disjoint(v,item,true),"CATALOG0_CROP_DISJOINT")
}
fn date(v:&Value,nullable:bool)->bool{
    if nullable&&v.is_null(){return true}
    let Some(s)=v.as_str()else{return false};let b=s.as_bytes();
    if !(20..=30).contains(&b.len())||b[4]!=b'-'||b[7]!=b'-'||b[10]!=b'T'||b[13]!=b':'||b[16]!=b':'||b.last()!=Some(&b'Z'){return false}
    let num=|a:usize,z:usize|->Option<u32>{let t=b.get(a..z)?;if !t.iter().all(u8::is_ascii_digit){return None}std::str::from_utf8(t).ok()?.parse().ok()};
    let (Some(y),Some(m),Some(d),Some(h),Some(mi),Some(se))=(num(0,4),num(5,7),num(8,10),num(11,13),num(14,16),num(17,19))else{return false};
    let days=match m{1|3|5|7|8|10|12=>31,4|6|9|11=>30,2=>if y%4==0&&(y%100!=0||y%400==0){29}else{28},_=>0};
    y>0&&d>0&&d<=days&&h<24&&mi<60&&se<60&&(b.len()==20||(b.len()>=22&&b[19]==b'.'&&b[20..b.len()-1].iter().all(u8::is_ascii_digit)))
}
fn recurring_body(kind:&str,v:&Value,item:i32)->CoreResult<()>{
    let common=["RecurringEventItemID","NextOccurrence","EndDate"];
    let extra:&[&str]=match kind{"ItemSpawning"=>&["LastOccurrence"],"ChooseVillageArea"=>&["ChosenVillageArea"],
        "ChooseItem"=>&["ChosenItemID"],"SnippetSpawning"=>&["Tokens","Snippets"],_=>&[]};
    let mut keys=common.to_vec();keys.extend_from_slice(extra);
    known_fields(v,&keys,&[])?;
    need(date(&v["NextOccurrence"],false)&&date(&v["EndDate"],true),"CATALOG0_RECURRING_TIME")?;
    match kind{
        "ItemSpawning"=>need(date(&v["LastOccurrence"],true),"CATALOG0_RECURRING_TIME")?,
        "ChooseVillageArea"=>{let s=v["ChosenVillageArea"].as_str().ok_or(denied("CATALOG0_RECURRING_AREA"))?;
            need(["VillageAreaType_AtlanteanOutpost01","VillageAreaType_AtlanteanOutpost02","VillageAreaType_AtlanteanOutpost03","VillageAreaType_AtlanteanOutpost04","VillageAreaType_Beach","VillageAreaType_Cliff","VillageAreaType_DarkMountains","VillageAreaType_Desert01","VillageAreaType_Desert02","VillageAreaType_Desert03","VillageAreaType_Desert04","VillageAreaType_FairyTales01","VillageAreaType_FairyTales02","VillageAreaType_FairyTales03","VillageAreaType_FairyTales04","VillageAreaType_Fashion01","VillageAreaType_Fashion02","VillageAreaType_Fashion03","VillageAreaType_Fashion04","VillageAreaType_Forest","VillageAreaType_Honeywood01","VillageAreaType_Honeywood02","VillageAreaType_Honeywood03","VillageAreaType_Honeywood04","VillageAreaType_Jungle01","VillageAreaType_Jungle02","VillageAreaType_Jungle03","VillageAreaType_Jungle04","VillageAreaType_Library01","VillageAreaType_Library02","VillageAreaType_Library03","VillageAreaType_Meadow","VillageAreaType_Mythology01","VillageAreaType_Mythology02","VillageAreaType_Mythology03","VillageAreaType_Mythology04","VillageAreaType_Rockies01","VillageAreaType_Rockies02","VillageAreaType_Rockies03","VillageAreaType_Rockies04","VillageAreaType_Rockies05","VillageAreaType_Savannah","VillageAreaType_Urban","VillageAreaType_Wetland","VillageAreaType_Wishland01","VillageAreaType_Wishland02","VillageAreaType_Wishland03","VillageAreaType_Wishland04"].contains(&s),"CATALOG0_RECURRING_AREA")?;},
        "ChooseItem"=>{let n=state_uint(&v["ChosenItemID"])?;need(n!=item as u32,"CATALOG0_RECURRING_ITEM")?;},
        "SnippetSpawning"=>need(state_uint(&v["Tokens"])?<=i32::MAX as u32&&state_array(&v["Snippets"])?.is_empty(),"CATALOG0_RECURRING_SNIPPET")?,
        _=>{}
    }Ok(())
}
pub(super) fn harvest(b:&[u8],s:Span,id:u32,ix:usize,item:i32)->CoreResult<()>{
    // E2260 original DutyAch SHA f5675e1c...; exact layer0 definitions:
    // 2110000038 e05f3a180b54bd455ed1bd3f110395d49908fb743490f0e61975330b47b96517
    // 2110000161 cd553390dee2e769cc4897877c4d9b9285ecda905e5a4bee65597b8393526732
    // Both kind16 payload fields [1,5,11,12], no skip-if-possess; conditions disjoint.
    need(item==ITEM as i32&&ix==0&&matches!(id,2110000038|2110000161),"PRODUCT_SWITCH626_CATALOG0_HARVEST_DEF")?;
    let data=leaf(b,f(b,f(b,s,"StepData")?,"ItemFilter")?)?;
    crop_filter(&data,item,id,ix)?;
    need(array(b,f(b,s,"ItemsUsed")?,16384)?.is_empty(),
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
        let v=leaf(b,*body)?;recurring_body(kind,&v,item)?;
        state_literals(&v,item,&mut budget,0)?;
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
// Switch626 portable Restore: separate explicit Build, fixed ordinary target.
// The existing scoped provider re-mints eligibility; file digest is not a grant.
#[path="switch626_catalog0_portable_restore.rs"]
mod portable_restore;

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

 #[test]fn qa1782_switch_portable_build_delta(){
  let mut d=doc();d["Unknown"]["escape"]=json!("keep");
  let raw=serde_json::to_string(&d).unwrap().replace("\"escape\":\"keep\"","\"escape\":\"\\u006beep\"");
  let entry=&d["Player"]["ListInventories"]["0"]["Inventory"]["40000076"];
  let block=serde_json::to_string(entry).unwrap();assert_eq!(raw.matches(&block).count(),1);
  let expected=raw.replacen(&block,&block.replacen("\"Amount\":999","\"Amount\":998",1),1);
  let build=crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true};
  let make=|raw:&str,b:crate::BuildIdentity|ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),b).unwrap();
  let prior=make(&expected,build.clone());let ae=env(&prior,WorkerAction::ReadDomain);
  let backup=prior.capture_switch626_catalog0_portable_backup(ae,ITEM).unwrap();
  let v:Value=serde_json::from_slice(&backup).unwrap();assert_eq!(v["sourceBuild"],json!({"platform":"Switch","buildKind":"SwitchBid","buildId":"9A239D3DB569756D","gameVersion":"1.25.3","schema":626}));
  assert_eq!(v["payload"]["amount"],998);assert_eq!(v["provenance"]["decodedSha256"],hex(&sha(expected.as_bytes())));
  let reseal=|mut v:Value|{v.as_object_mut().unwrap().remove("sha256");let h=hex(&sha(&serde_json::to_vec(&v).unwrap()));v["sha256"]=json!(h);serde_json::to_vec(&v).unwrap()};
  assert_eq!(reseal(v.clone()),backup);
  let s=make(&raw,build.clone());let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
  let p=s.preview_switch626_catalog0_portable_restore(e,ITEM,&backup).unwrap();assert_eq!(p.projected_sha,sha(expected.as_bytes()));
  let mut neg=0;
  for (field,bad) in [("platform",json!("SteamWindows")),("buildKind",json!("SteamFullVersion")),("buildId",json!("releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22")),("schema",json!(624)),("gameVersion",json!("1.25.2"))]{
   let mut q=v.clone();q["sourceBuild"][field]=bad;assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&reseal(q)).is_err(),"{field}");neg+=1;
  }
  let mut q=v.clone();q["sourceBuild"]["extra"]=json!(true);assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&reseal(q)).is_err());neg+=1;
  let mut q=v.clone();q["provenance"]["decodedSha256"]=json!("0".repeat(64));assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&reseal(q)).is_err());neg+=1;
  let mut q=v.clone();q["target"]["itemId"]=json!(40000077);assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&reseal(q)).is_err());neg+=1;
  assert_eq!(s.receipt().unwrap(),before);
  let st=env(&s,WorkerAction::Stage);let r=s.stage_switch626_catalog0_portable_restore(st,ITEM,&backup,999,998,p.entry_sha,p.backup_sha,p.projected_sha).unwrap();assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);
  let out=s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).unwrap();assert_eq!(out,expected.as_bytes());assert_eq!(s.decoded.as_ref(),raw.as_bytes());
  let reopened=ProductSession::open_decoded_readonly(out,build).unwrap();assert_eq!(reopened.receipt().unwrap().decoded_sha256,prior.sha);
  assert_eq!(neg,8);println!("QRC1782_SWITCH_PORTABLE_BUILD_ACTUAL 1POS {neg}NEG EXACT1 bytes={}",backup.len());
 }
 #[test]fn switch626_catalog0_portable_restore_exact1_build_lineage(){
  use crate::portable_backup::{PortableBackupBuild,decode_inventory_amount_backup_for_build,encode_inventory_amount_backup_for_build,decode_inventory_amount_backup};
  let mut prior=doc();prior["Player"]["ListInventories"]["0"]["Inventory"]["40000076"]["Amount"]=json!(998);
  let a=open(&prior,true);let ae=env(&a,WorkerAction::ReadDomain);let backup=a.capture_switch626_catalog0_portable_backup(ae,ITEM).unwrap();
  let snap=decode_inventory_amount_backup_for_build(PortableBackupBuild::Switch626,&backup).unwrap();
  assert_eq!(snap.amount,998);assert!(decode_inventory_amount_backup(&backup).is_err());
  let d=doc();let s=open(&d,true);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
  let p=s.preview_switch626_catalog0_portable_restore(e,ITEM,&backup).unwrap();assert_eq!(p.projected_sha,a.sha);
  let steam=encode_inventory_amount_backup_for_build(PortableBackupBuild::Steam626,0,ITEM,&snap.source_decoded_sha256,&serde_json::to_vec(&snap.payload).unwrap()).unwrap();
  assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&steam).is_err());
  let st=env(&s,WorkerAction::Stage);let run=|s:&ProductSession,e,b:&[u8],old,new,entry,bs,out|s.stage_switch626_catalog0_portable_restore(e,ITEM,b,old,new,entry,bs,out);
  assert!(run(&s,e,&backup,999,998,p.entry_sha,p.backup_sha,p.projected_sha).is_err());
  assert!(run(&s,st,&backup,998,998,p.entry_sha,p.backup_sha,p.projected_sha).is_err());
  assert!(run(&s,st,&backup,999,997,p.entry_sha,p.backup_sha,p.projected_sha).is_err());
  assert!(run(&s,st,&backup,999,998,[0;32],p.backup_sha,p.projected_sha).is_err());
  assert!(run(&s,st,&backup,999,998,p.entry_sha,[0;32],p.projected_sha).is_err());
  assert!(run(&s,st,&backup,999,998,p.entry_sha,p.backup_sha,[0;32]).is_err());
  assert!(run(&open(&d,true),st,&backup,999,998,p.entry_sha,p.backup_sha,p.projected_sha).is_err());
  let steam_session=open(&d,false);assert!(steam_session.preview_switch626_catalog0_portable_restore(env(&steam_session,WorkerAction::ReadDomain),ITEM,&backup).is_err());
  assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM+1,&backup).is_err());
  let mut foreign=prior.clone();foreign["Unknown"]["keep"]=json!([3,4]);let foreign=open(&foreign,true);
  let fb=foreign.capture_switch626_catalog0_portable_backup(env(&foreign,WorkerAction::ReadDomain),ITEM).unwrap();
  assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&fb).is_err());
  let mut bad=snap.payload.clone();bad["entrySha256"]=json!("0".repeat(64));
  let bad=encode_inventory_amount_backup_for_build(PortableBackupBuild::Switch626,0,ITEM,&snap.source_decoded_sha256,&serde_json::to_vec(&bad).unwrap()).unwrap();
  assert!(s.preview_switch626_catalog0_portable_restore(e,ITEM,&bad).is_err());
  assert_eq!(s.receipt().unwrap(),before);
  let r=run(&s,st,&backup,999,998,p.entry_sha,p.backup_sha,p.projected_sha).unwrap();
  assert_eq!(r.exact_field_changed_count,1);assert_eq!(r.staged_decoded_sha256,a.sha);assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);
  assert!(run(&s,st,&backup,999,998,p.entry_sha,p.backup_sha,p.projected_sha).is_err());
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();let out_e=env(&s,WorkerAction::ExportEditedCopy);
  let out=s.take_typed_semantic_decoded_once(out_e).unwrap();assert!(s.take_typed_semantic_decoded_once(out_e).is_err());
  assert_eq!(out,serde_json::to_vec(&prior).unwrap());assert_eq!(sha(&s.decoded),before.decoded_sha256);
 }
 #[test]fn fixed_switch_catalog0_harvest_pair_is_duty_layer_and_type_exact(){
  let base=json!({"Data":{"Type":"ItemType_ActivityItem","ActivityItemType":"ActivityItemType_Crop","Item":0,"ItemList":[],"AnyActivityItem":false,"MaxUnlockLevel":100,"CropType":"CropTypeCondition_Fruit","MinUnlockLevel":0}});
  assert!(crop_filter(&base,ITEM as i32,2110000038,0).is_ok());
  for (id,ix) in [(2110000161,0),(2110000038,1),(2110000033,0)]{assert!(crop_filter(&base,ITEM as i32,id,ix).is_err());}
  for x in [json!(0),json!(1),json!(99),json!(101),json!(4294967295u64),json!("100"),json!(-100),json!(100.0)]{let mut d=base.clone();d["Data"]["MaxUnlockLevel"]=x;assert!(crop_filter(&d,ITEM as i32,2110000038,0).is_err());}
  for x in [json!("CropTypeCondition_Any"),json!("CropTypeCondition_Vegetable"),json!(100)]{let mut d=base.clone();d["Data"]["CropType"]=x;assert!(crop_filter(&d,ITEM as i32,2110000038,0).is_err());}
  for k in ["MaxUnlockLevel","CropType"]{let mut d=base.clone();d["Data"].as_object_mut().unwrap().remove(k);assert!(crop_filter(&d,ITEM as i32,2110000038,0).is_err());}
  let mut d=base.clone();d["Data"]["MinUnlockLevel"]=json!(100);assert!(crop_filter(&d,ITEM as i32,2110000038,0).is_err());
  let mut d=base.clone();d["Data"]["Item"]=json!(ITEM);assert!(crop_filter(&d,ITEM as i32,2110000038,0).is_err());
 }
 #[test]fn fixed_switch_catalog0_current_harvest_and_recurring_exact1(){
  assert_eq!(RECURRING_RANGES.iter().map(|(a,b)|b-a+1).sum::<u32>(),508);
  let mut d=doc();let ix=layout_index().unwrap();
  let (path,asset,local)=ix.iter().find_map(|(p,a)|if layout_asset_excludes(a,ITEM as i32,None).is_ok(){a.grids.keys().next().map(|i|(p,a,*i))}else{None}).unwrap();
  d["World"]["GridCollection"]["DiffGrids"]["19"]=json!({"ID":19,"GridDefaultLayoutPath":path,"GridDefaultLayoutType":asset.kind,
    "DefaultLayoutGridID":local,"DefaultGridHashCode":-4,"DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
  d["World"]["RecurringEvents"]["1"]=json!({"ItemSpawning":{"RecurringEventItemID":2010000003,"NextOccurrence":"2026-11-16T00:00:00Z","EndDate":null,"LastOccurrence":null}});
  d["Player"]["DutySlots"]["0"]=json!({"Slots":[{"State":"DutySlotState_OnGoing","DutyId":2110000038,"DifficultyLayer":0,
    "ItemsUsed":[],"StepData":{"ItemFilter":{"Data":{"Type":"ItemType_ActivityItem","ActivityItemType":"ActivityItemType_Crop",
    "Item":0,"ItemList":[],"AnyActivityItem":false,"MaxUnlockLevel":100,"CropType":"CropTypeCondition_Fruit"}}}}]});
  let s=open(&d,true);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
  let t=s.preview_switch626_scoped_catalog0(e,selection(),998).unwrap();
  assert_eq!(s.discover_switch626_scoped_catalog0(e,0).unwrap().0,vec![t.clone()]);
  assert_eq!(s.receipt().unwrap(),before);
  let other=open(&d,false);assert!(other.preview_switch626_scoped_catalog0(env(&other,WorkerAction::ReadDomain),selection(),998).is_err());
  assert!(s.preview_scoped_product_amount(e,selection(),998).is_err());
  assert!(s.preview_switch626_scoped_chest(e,selection(),998).is_err());
  assert!(s.preview_switch626_scoped_catalog0(e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},998).is_err());
  for mode in 0..11{let mut q=d.clone();match mode{
   0=>q["Player"]["DutySlots"]["0"]["Slots"][0]["DutyId"]=json!(2110000033),
   1=>q["Player"]["DutySlots"]["0"]["Slots"][0]["StepData"]["ItemFilter"]["Data"]["Type"]=json!("ItemType_Furniture"),
   2=>q["Player"]["DutySlots"]["0"]["Slots"][0]["ItemsUsed"]=json!([40000076]),
   3=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["RecurringEventItemID"]=json!(2010000004),
   4=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["Other"]=json!(40000076),
   5=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000076"]["Marker"]=json!("ItemMarker_Favorite"),
   6=>q["World"]["GridCollection"]["DiffGrids"]["19"]["GridDefaultLayoutPath"]=json!("SceneLayouts/Unknown.json"),
   7=>q["World"]["GridCollection"]["DiffGrids"]["19"]["ModifiedObjects"]["1"]=json!({"ID":1,"ItemID":40000076,"State":null}),
   8=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["ItemFilter"]=json!({"Data":{"Type":"ItemType_Furniture"}}),
   9=>q["World"]["RecurringEvents"]["1"]["ItemSpawning"]["NextOccurrence"]=json!({"Unknown":1}),
   _=>q["Player"]["DutySlots"]["0"]["Slots"][0]["StepData"]["ItemFilter"]["Data"]["UnknownSelector"]=json!({"Type":"ItemType_Furniture"})
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
