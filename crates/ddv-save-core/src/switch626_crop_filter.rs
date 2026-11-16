//! Exact E2260 shared typed crop predicate extracted from accepted Catalog0.
//! No build/target/Stage authority; caller binds the operation scope.
use super::*;
fn known_fields(v:&Value,required:&[&str],optional:&[&str])->CoreResult<()>{
    let m=v.as_object().ok_or(denied("CATALOG0_TYPED_OBJECT"))?;
    need(required.iter().all(|k|m.contains_key(*k))&&m.keys().all(|k|
        required.contains(&k.as_str())||optional.contains(&k.as_str())),"CATALOG0_TYPED_FIELDS")
}
pub(super) fn crop_filter(v:&Value,item:i32,id:u32,ix:usize)->CoreResult<()>{
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
