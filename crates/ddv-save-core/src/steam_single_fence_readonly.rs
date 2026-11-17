//! ACT1630: Steam626 SingleFence immutable exact-Target Reader support.
//! This is a narrow product-only linkage of existing source helpers, NOT a
//! replacement reader, generic semantic Writer, Stage or EditCopy engine.
//! The original accepted Target body is included by path without duplicating
//! any geometry/stock/reference decision; helpers retain old literal checks.
//! No external fixture, untrusted provider or selected ItemID is consumed.
use super::*;
use super::indexed_read::{self,Span};
use crate::{CoreError,CoreResult};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};

const EXACT_STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_GRID:usize=2*1024*1024;
const HOUSE_MAX:usize=4096;
#[path="comp03_installed_geometry.rs"]
mod installed_geometry;
use installed_geometry::InstalledGeometry;
#[path="sr03_installed_geometry.rs"]
mod meadow_geometry;
use meadow_geometry::{MeadowGeometry,Rect,GRID};

fn denied(s:&'static str)->CoreError {CoreError(s)}
fn sha(bytes:&[u8])->[u8;32]{Sha256::digest(bytes).into()}

fn next_object_member(bytes:&[u8],parent:Span,pos:&mut usize)
    ->CoreResult<Option<(String,Span)>>{
    if bytes.get(parent.begin)!=Some(&b'{')||
       bytes.get(parent.end.saturating_sub(1))!=Some(&b'}')||
       parent.begin>=parent.end||parent.end>bytes.len()||
       *pos<=parent.begin||*pos>=parent.end{
        return Err(denied("SEMANTIC_OBJECT_PARENT_REQUIRED"));
    }
    let i=indexed_read::skip_ws(bytes,*pos);
    if i>=parent.end{return Err(denied("SEMANTIC_MAP_OUT_OF_SPAN"));}
    if i==parent.end-1{return Ok(None);}
    let k_end=indexed_read::string_end(bytes,i)?;
    if k_end-i>128{return Err(denied("SEMANTIC_KEY_BOUNDS"));}
    let k:String=serde_json::from_slice(&bytes[i..k_end])
        .map_err(|_|denied("SEMANTIC_KEY_INVALID"))?;
    let colon=indexed_read::skip_ws(bytes,k_end);
    if bytes.get(colon)!=Some(&b':'){return Err(denied("SEMANTIC_KEY_COLON"));}
    let begin=indexed_read::skip_ws(bytes,colon+1);
    let end=indexed_read::value_end(bytes,begin)?;
    if end>=parent.end{return Err(denied("SEMANTIC_FIELD_OUT_OF_PARENT"));}
    let next=indexed_read::skip_ws(bytes,end);
    *pos=match bytes.get(next){
        Some(b',') if next<parent.end-1=>next+1,
        Some(b'}') if next==parent.end-1=>next,
        _=>return Err(denied("SEMANTIC_MAP_TERMINATOR")),
    };
    Ok(Some((k,Span{begin,end})))
}
fn object_field(bytes:&[u8], parent:Span, sought:&str)->CoreResult<Span>{
    let mut pos=parent.begin.checked_add(1).ok_or(denied("SEMANTIC_MAP_OUT_OF_SPAN"))?;
    while let Some((key,span))=next_object_member(bytes,parent,&mut pos)?{
        if key==sought{return Ok(span);}
    }
    Err(denied("SEMANTIC_TARGET_NOT_PRESENT"))
}

fn valid_id(id:u32)->CoreResult<()>{
    if id==0{return Err(denied("SEMANTIC_ITEM_OR_INVENTORY_ID_ZERO"));}
    Ok(())
}
fn positive_id_field(bytes:&[u8],parent:Span,name:&str,id:u32)->CoreResult<()>{
    valid_id(id)?;
    if number(bytes,object_field(bytes,parent,name)?)?!=id as u64{
        return Err(denied("SEMANTIC_CONTAINER_ID_MISMATCH"));
    }
    Ok(())
}
fn number(bytes:&[u8],span:Span)->CoreResult<u64>{
    let token=bytes.get(span.begin..span.end)
        .ok_or(denied("SEMANTIC_NUMBER_SPAN_INVALID"))?;
    if token.is_empty()||token.len()>12||
       !token.iter().all(u8::is_ascii_digit)||
       (token.len()>1&&token[0]==b'0'){
        return Err(denied("SEMANTIC_UNSIGNED_INTEGER_REQUIRED"));
    }
    serde_json::from_slice::<u64>(token)
        .map_err(|_|denied("SEMANTIC_INTEGER_INVALID"))
}

// Exact Catalog0 restriction parser and typed Furniture/subtype validation,
// copied unchanged from accepted bounded Native amount readset. Writer
// commands/ledger/exports are deliberately absent from this Reader module.
fn furniture_catalog_mask(bytes:&[u8],record:Span)->CoreResult<u16>{
    let mut pos=record.begin+1;
    let mut restriction=None;
    let mut fields=0usize;
    while let Some((key,v))=next_object_member(bytes,record,&mut pos)?{
        fields+=1;
        if fields>64{return Err(denied("AMOUNT_ZERO_ROUTE_RECORD_BOUND"));}
        if key=="CompatibleFurnitureTypes"{restriction=Some(v);}
        else if key.starts_with("Compatible")&&key!="CompatibleItemType"{
            return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_AMBIGUOUS"));
        }
    }
    let r=restriction.ok_or(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_ABSENT"))?;
    if r.end-r.begin>2048{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_BOUND"));}
    let mut pos=r.begin+1;
    let (key,list)=next_object_member(bytes,r,&mut pos)?
        .ok_or(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_ABSENT"))?;
    if key!="List"||next_object_member(bytes,r,&mut pos)?.is_some(){
        return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_AMBIGUOUS"));
    }
    let tokens:Vec<String>=serde_json::from_slice(&bytes[list.begin..list.end])
        .map_err(|_|denied("AMOUNT_ZERO_ROUTE_RESTRICTION_TYPE"))?;
    if tokens.is_empty()||tokens.len()>16{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_BOUND"));}
    let mut mask=0u16;
    for token in tokens{
        // Exact Steam626 enum tokens; persisted membership, not inferred
        // defaults. Unknown enum values or duplicate members fail closed.
        let n=match token.as_str(){
            "FurnitureItemType_Default"=>0,
            "FurnitureItemType_GroundAlteration"=>1,
            "FurnitureItemType_Door"=>3,
            "FurnitureItemType_Request"=>5,
            "FurnitureItemType_Blocker"=>6,
            "FurnitureItemType_Fence"=>7,
            "FurnitureItemType_AncientMachine"=>8,
            "FurnitureItemType_SnippetTrap"=>9,
            _=>return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_UNKNOWN")),
        };
        let bit=1u16<<n;
        if mask&bit!=0{return Err(denied("AMOUNT_ZERO_ROUTE_RESTRICTION_DUPLICATE"));}
        mask|=bit;
    }
    Ok(mask)
}
fn check_furniture_catalog_item(mask:u16,item:u32)->CoreResult<()>{
    if native_amount_type(item)?!=ExistingAmountItemType::Furniture{
        return Err(denied("AMOUNT_ZERO_ROUTE_FURNITURE_REQUIRED"));
    }
    let subtype=(item%10_000_000)/100_000;
    if subtype>=16||mask&(1u16<<subtype)==0{
        return Err(denied("AMOUNT_ZERO_ROUTE_SUBTYPE_DENIED"));
    }
    Ok(())
}
fn inventory_route(bytes:&[u8],record:Span,id:u32,item:u32,expected:&str)->CoreResult<()>{
    if id!=0{
        positive_id_field(bytes,record,"ID",id)?;
        return compatible_type(bytes,object_field(bytes,record,"CompatibleItemType")?,expected);
    }
    if expected!="ItemType_Furniture"||number(bytes,object_field(bytes,record,"ID")?)?!=0{
        return Err(denied("AMOUNT_ZERO_ROUTE_ID_OR_TYPE"));
    }
    compatible_type(bytes,object_field(bytes,record,"CompatibleItemType")?,"ItemType_Furniture")?;
    check_furniture_catalog_item(furniture_catalog_mask(bytes,record)?,item)
}

fn compatible_type(bytes:&[u8],span:Span,expected:&str)->CoreResult<()>{
    if expected.len()>64||!expected.starts_with("ItemType_")||
       !expected.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_')||
       ["Premium","DLC","Entitlement","Receipt","Auth","Currency","Moonstone","Quest"]
        .iter().any(|v|expected.contains(v)){
        return Err(denied("SEMANTIC_PROTECTED_ITEM_TYPE"));
    }
    let actual:String=serde_json::from_slice(
        bytes.get(span.begin..span.end).ok_or(denied("SEMANTIC_TYPE_SPAN"))?)
        .map_err(|_|denied("SEMANTIC_COMPATIBLE_TYPE_REQUIRED"))?;
    if actual!=expected{return Err(denied("SEMANTIC_COMPATIBLE_TYPE_CAS"));}
    Ok(())
}

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
enum ExistingAmountItemType { ActivityItem=3,Furniture=4 }
fn native_amount_type(id:u32)->CoreResult<ExistingAmountItemType>{
    if id==0||id>i32::MAX as u32 {
        return Err(denied("AMOUNT_NATIVE_SIGNED_ID_REQUIRED"));
    }
    match id/10_000_000 {
        3=>Ok(ExistingAmountItemType::ActivityItem),
        4=>Ok(ExistingAmountItemType::Furniture),
        _=>Err(denied("AMOUNT_NATIVE_TYPE_NOT_ALLOWED")),
    }
}

fn build_check(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    if b.platform!=Platform::SteamWindows||b.build_kind!=BuildKind::SteamFullVersion||
       b.build_id!=EXACT_STEAM||b.schema!=626||!b.externally_attested {
        return Err(denied("SEMANTIC_EXACT_STEAM626_REQUIRED"));
    }
    Ok(())
}
fn check(s:&ProductSession,st:&State,e:&WorkerEnvelope,action:WorkerAction)
    ->CoreResult<()>{
    if st.closed{return Err(denied("SESSION_CLOSED"));}
    if e.contract!=PRODUCT_WORKER_CONTRACT||e.session_id!=st.id||
       e.expected_decoded_sha256!=s.sha{
        return Err(denied("SESSION_SOURCE_SCOPE_MISMATCH"));
    }
    if e.expected_revision!=st.revision||e.expected_index_generation!=st.generation{
        return Err(denied("SESSION_REVISION_GENERATION_CAS"));
    }
    if e.action!=action{return Err(denied("SEMANTIC_ACTION_DENIED"));}
    Ok(())
}

fn reject<T>(code:&'static str)->CoreResult<T>{Err(denied(code))}
fn need(ok:bool,code:&'static str)->CoreResult<()> {if ok{Ok(())}else{reject(code)}}
fn members(b:&[u8],s:Span,max:usize)->CoreResult<Vec<(String,Span)>>{
    let mut p=s.begin+1;let mut out=Vec::new();
    while let Some((k,v))=next_object_member(b,s,&mut p)?{
        if out.len()>=max{return reject("PRODUCT_AMOUNT_MAP_BOUND");}
        out.push((k,v));
    }
    Ok(out)
}
fn array(b:&[u8],s:Span,max:usize)->CoreResult<Vec<Span>>{
    need(b.get(s.begin)==Some(&b'[')&&b.get(s.end.saturating_sub(1))==Some(&b']'),"PRODUCT_AMOUNT_ARRAY")?;
    let mut p=indexed_read::skip_ws(b,s.begin+1);let mut out=Vec::new();
    while p<s.end-1{
        if out.len()>=max{return reject("PRODUCT_AMOUNT_ARRAY_BOUND");}
        let end=indexed_read::value_end(b,p)?;
        need(end<s.end,"PRODUCT_AMOUNT_ARRAY_SPAN")?;
        out.push(Span{begin:p,end});
        p=indexed_read::skip_ws(b,end);
        if p==s.end-1{break}
        need(b.get(p)==Some(&b','),"PRODUCT_AMOUNT_ARRAY_SEPARATOR")?;
        p=indexed_read::skip_ws(b,p+1);
    }
    Ok(out)
}
fn f(b:&[u8],s:Span,k:&str)->CoreResult<Span>{object_field(b,s,k)}
fn opt(b:&[u8],s:Span,k:&str)->CoreResult<Option<Span>>{
    let mut p=s.begin+1;while let Some((key,v))=next_object_member(b,s,&mut p)?{if key==k{return Ok(Some(v));}}Ok(None)
}
fn leaf(b:&[u8],s:Span)->CoreResult<Value>{
    need(s.end-s.begin<=1024*1024,"PRODUCT_AMOUNT_LEAF_BOUND")?;
    serde_json::from_slice(&b[s.begin..s.end]).map_err(|_|denied("PRODUCT_AMOUNT_LEAF"))
}
fn strv(b:&[u8],s:Span,k:&str)->CoreResult<String>{
    let x=f(b,s,k)?;need(x.end-x.begin<=4096,"PRODUCT_AMOUNT_TOKEN_BOUND")?;
    serde_json::from_slice(&b[x.begin..x.end]).map_err(|_|denied("PRODUCT_AMOUNT_STRING"))
}
fn n(b:&[u8],s:Span,k:&str)->CoreResult<u32>{
    u32::try_from(number(b,f(b,s,k)?)?).map_err(|_|denied("PRODUCT_AMOUNT_UINT"))
}
fn boolean(b:&[u8],s:Span,k:&str)->CoreResult<bool>{
    match &b[f(b,s,k)?.begin..f(b,s,k)?.end]{b"true"=>Ok(true),b"false"=>Ok(false),_=>reject("PRODUCT_AMOUNT_BOOL")}
}
fn key(k:&str)->CoreResult<u32>{let v=k.parse::<u32>().map_err(|_|denied("PRODUCT_AMOUNT_KEY"))?;
    need(v.to_string()==k,"PRODUCT_AMOUNT_KEY")?;Ok(v)}

// E1999: known saved GridState oneof shapes. This checks stored direct
// dependencies only; it does not prove initialized base/generator closure.
fn state_fields(v:&Value,keys:&[&str])->CoreResult<()>{
    need(v.as_object().is_some_and(|m|m.len()==keys.len()&&keys.iter().all(|k|m.contains_key(*k))),"PRODUCT_AMOUNT_STATE_FIELDS")
}
fn state_uint(v:&Value)->CoreResult<u32>{
    v.as_u64().and_then(|x|u32::try_from(x).ok()).ok_or(denied("PRODUCT_AMOUNT_STATE_UINT"))
}
fn state_item(v:&Value,item:i32)->CoreResult<()>{
    need(state_uint(v)?!=item as u32,"PRODUCT_AMOUNT_STATE_ITEM_REFERENCE")
}
fn state_array(v:&Value)->CoreResult<&Vec<Value>>{
    v.as_array().filter(|a|a.len()<=4096).ok_or(denied("PRODUCT_AMOUNT_STATE_ARRAY"))
}
fn state_literals(v:&Value,item:i32,budget:&mut usize,depth:usize)->CoreResult<()>{
    *budget+=1;need(*budget<=1_000_000&&depth<=32,"PRODUCT_AMOUNT_STATE_BOUND")?;
    match v{
        Value::Object(m)=>{need(m.len()<=4096,"PRODUCT_AMOUNT_STATE_MAP")?;for(k,x)in m{
            need(k!=&item.to_string(),"PRODUCT_AMOUNT_STATE_LITERAL_REFERENCE")?;
            state_literals(x,item,budget,depth+1)?;
        }},
        Value::Array(a)=>{need(a.len()<=4096,"PRODUCT_AMOUNT_STATE_ARRAY")?;for x in a{state_literals(x,item,budget,depth+1)?;}},
        Value::Number(n)=>need(n.as_i64()!=Some(item as i64)&&n.as_f64()!=Some(item as f64),"PRODUCT_AMOUNT_STATE_LITERAL_REFERENCE")?,
        Value::String(x)=>need(x!=&item.to_string(),"PRODUCT_AMOUNT_STATE_LITERAL_REFERENCE")?,
        _=>{}
    }Ok(())
}
fn saved_grid_state(b:&[u8],s:Span,item:i32,budget:&mut usize)->CoreResult<()>{
    if &b[s.begin..s.end]==b"null"{return Ok(())}
    let v=leaf(b,s)?;
    let m=v.as_object().filter(|m|m.len()==1).ok_or(denied("PRODUCT_AMOUNT_STATE_ONEOF"))?;
    let (k,p)=m.iter().next().ok_or(denied("PRODUCT_AMOUNT_STATE_ONEOF"))?;
    let fields:&[&str]=match k.as_str(){
        "BuildingWithSkinData"=>&["CurrentSkinItemID","UpgradeState"],
        "HouseData"=>&["Built","PlayerHouseIndex","UpgradeState"],
        "Keyhole"=>&["KeyholeConfigDataGUID"],
        "StallData"=>&["CurrentSkinItemID","ShopData","UpgradeState"],
        "Toggle"=>&["DesignID","Value"],"FenceMode"=>&["Diagonal"],
        "SubGrid"=>&["DesignID","GridID"],"GardenData"=>&["Slots"],
        "ItemList"=>&["Items"],"FishingStallData"=>&["LastCollect","PendingFishes","UpgradeState"],
        "Storage"=>&["ContainerInventoryID","DefaultContainerInventoryData","DesignID","UnlockKeyItemID","UnlockLocId"],
        "FlowerData"=>&["BelongingAreasCount","DriedInBeeHouse","Dry","GlowEnd","PollinationEnd","PollinationStart","Resource"],
        "Mannequin"=>&["BodyType","Clothes","ClothingCustomization","HairColorIndex","HairHighlightColor","IsMale"],
        "BlockerData"=>&["Stage","Treasure"],"ItemAmountState"=>&["Amount","AssignedPlayer","State"],
        "Index"=>&["CurrentIndex"],"ObstacleCourseStartLine"=>&["DurationOverride","InteractionConditions","Rewards"],
        _=>return reject("PRODUCT_AMOUNT_STATE_UNKNOWN")
    };
    state_fields(p,fields)?;
    match k.as_str(){
        "BuildingWithSkinData"=>state_item(&p["CurrentSkinItemID"],item)?,
        "StallData"=>{
            state_item(&p["CurrentSkinItemID"],item)?;
            for q in state_array(&p["ShopData"]["Slots"])?{
                let i=q.get("Item").ok_or(denied("PRODUCT_AMOUNT_STATE_SHOP_SLOT"))?;
                if !i.is_null(){state_item(&i["id"],item)?;}
            }
        },
        "GardenData"=>for q in state_array(&p["Slots"])?{state_item(&q["PlantedSeedItemID"],item)?;},
        "ItemList"=>for q in state_array(&p["Items"])?{state_item(q,item)?;},
        "Storage"=>{state_uint(&p["ContainerInventoryID"])?;state_item(&p["UnlockKeyItemID"],item)?;
            need(p["DefaultContainerInventoryData"].is_string()&&p["UnlockLocId"].is_string(),"PRODUCT_AMOUNT_STATE_STORAGE_TYPE")?;},
        "SubGrid"=>{state_uint(&p["GridID"])?;},
        "Mannequin"=>{
            let clothes=p["Clothes"].as_object().ok_or(denied("PRODUCT_AMOUNT_STATE_CLOTHES"))?;
            for q in clothes.values(){state_item(q,item)?;}
            for q in state_array(&p["ClothingCustomization"])?{
                let x=q.as_str().and_then(|x|x.parse::<u32>().ok()).ok_or(denied("PRODUCT_AMOUNT_STATE_CUSTOMIZATION"))?;
                need(x!=item as u32,"PRODUCT_AMOUNT_STATE_ITEM_REFERENCE")?;
            }
        },
        "BlockerData"=>{
            let t=&p["Treasure"];state_fields(t,&["ItemID","State"])?;state_item(&t["ItemID"],item)?;
            let st=&t["State"];if !st.is_null(){
                state_fields(st,&["LootPresentData"])?;let l=&st["LootPresentData"];state_fields(l,&["Items"])?;
                need(state_array(&l["Items"])?.is_empty(),"PRODUCT_AMOUNT_STATE_LOOT_UNPROVEN")?;
            }
        },
        "ItemAmountState"=>need(p["State"].is_null(),"PRODUCT_AMOUNT_STATE_NESTED_UNPROVEN")?,
        "FishingStallData"=>need(state_array(&p["PendingFishes"])?.is_empty(),"PRODUCT_AMOUNT_STATE_FISH_UNPROVEN")?,
        "ObstacleCourseStartLine"=>need(p["Rewards"].is_null()&&p["InteractionConditions"].is_null(),"PRODUCT_AMOUNT_STATE_REWARD_UNPROVEN")?,
        _=>{}
    }
    // A literal equal to the target is a conservative rejection, not a
    // semantic claim about its namespace. Container vs Grid IDs stay separate.
    state_literals(&v,item,budget,0)
}

fn physical_totals(b:&[u8],player:Span,item:i32,chest:Option<(u32,usize)>,old:u32)->CoreResult<u64>{
    let mut scanned=0usize;let mut found=false;let mut total=0u64;let mut base=0usize;
    for(k,c)in members(b,f(b,player,"ContainerInventories")?,4096)?{
        let id=key(&k)?;need(n(b,c,"ID")?==id,"PRODUCT_AMOUNT_CONTAINER_ID")?;
        let owner=boolean(b,c,"BelongsToPlayer")?;let size=n(b,c,"Size")? as usize;let extra=n(b,c,"ExtraSize")? as usize;
        need(size<=16384&&extra<=size,"PRODUCT_AMOUNT_CONTAINER_CAPACITY")?;
        if id<=1{base+=1;}
        for(i,s)in array(b,f(b,c,"Inventory")?,size)?.into_iter().enumerate(){
            scanned+=1;need(scanned<=250000,"PRODUCT_AMOUNT_PHYSICAL_BOUND")?;
            let id_item=n(b,s,"ItemID")?;let a=n(b,s,"Amount")?;
            need(id_item<=i32::MAX as u32&&a<=i32::MAX as u32&&(id_item==0)==(a==0),"PRODUCT_AMOUNT_SLOT_SHAPE")?;
            if id_item!=item as u32{continue}
            need(chest.is_some(),"PRODUCT_AMOUNT_PHYSICAL_ROUTE")?;
            let state=f(b,s,"State")?;if &b[state.begin..state.end]!=b"null"{members(b,state,128)?;}
            if chest==Some((id,i)){need(owner&&a==old&&&b[state.begin..state.end]==b"null","PRODUCT_AMOUNT_CHEST_OLD")?;found=true;}
            if owner||id<=1{total=total.checked_add(a as u64).ok_or(denied("PRODUCT_AMOUNT_TOTAL"))?;}
        }
    }
    if chest.is_some(){need(base==2&&found,"PRODUCT_AMOUNT_CHEST_BASE_OR_SELECTED")?;}
    Ok(total)
}

#[path="placement_saved_refs.rs"]
mod placement_saved_refs;
use placement_saved_refs::Incoming;

// Same Steam-only Build predicate as the accepted one-fence Target.
#[derive(Clone,Copy,PartialEq,Eq)]
enum RoadBuild{Steam626}
fn road_build(s:&ProductSession,_scope:RoadBuild)->CoreResult<()>{
    build_check(s)
}

fn raw(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("SR03_TARGET_SPAN"))}
fn digest(b:&[u8],s:Span)->CoreResult<[u8;32]>{Ok(sha(raw(b,s)?))}
fn value(b:&[u8],s:Span,max:usize)->CoreResult<Value>{
    let p=raw(b,s)?;need(p.len()<=max,"SR03_TARGET_VALUE_BOUND")?;
    serde_json::from_slice(p).map_err(|_|denied("SR03_TARGET_VALUE"))
}
fn uint(v:&Value)->Option<u32>{v.as_u64()?.try_into().ok()}
fn fields(v:&Value,ks:&[&str])->bool{v.as_object().is_some_and(|m|m.len()==ks.len()&&ks.iter().all(|k|m.contains_key(*k)))}
fn level(v:&Value,l:u32)->bool{fields(v,&["Level"])&&uint(&v["Level"])==Some(l)}
fn selected(b:&[u8],w:Span,gid:u32)->CoreResult<(Span,Span,Span,Span)>{
    let mut root=None;let mut hits=0usize;
    for(vi,v)in array(b,f(b,w,"Villages")?,256)?.into_iter().enumerate(){
        for(k,a)in members(b,f(b,v,"Areas")?,4096)?{
            let aid=key(&k)?;let ids=array(b,f(b,a,"GridIDs")?,4096)?;
            for i in &ids{
                let id=u32::try_from(number(b,*i)?).map_err(|_|denied("SR03_TARGET_ROOT_ID"))?;
                if id==gid{hits+=1;need(vi==0&&aid==2&&ids.len()==1&&boolean(b,a,"Unlocked")?,"SR03_TARGET_ROOT")?;root=Some(a);}
            }
        }
    }
    need(hits==1,"SR03_TARGET_ROOT_ALIAS")?;
    let gc=f(b,w,"GridCollection")?;let gs=f(b,gc,"Grids")?;let ds=f(b,gc,"DiffGrids")?;
    let mut picked=None;let mut seen=std::collections::BTreeSet::new();
    for(k,g)in members(b,gs,50000)?{
        let id=key(&k)?;need(n(b,g,"ID")?==id&&seen.insert(id),"SR03_TARGET_GRID_ID")?;
        if id==gid{picked=Some(g)}
    }
    for(k,g)in members(b,ds,50000)?{
        let id=key(&k)?;need(n(b,g,"ID")?==id&&!seen.contains(&id),"SR03_TARGET_OVERLAY_ID")?;
    }
    let g=picked.ok_or(denied("SR03_TARGET_GRID"))?;
    need(strv(b,g,"GridDataPath")?==GRID&&strv(b,g,"GridDefaultLayoutPath")?.is_empty()&&n(b,g,"TessellationFactor")?==2,"SR03_TARGET_GRID_DEFINITION")?;
    Ok((root.ok_or(denied("SR03_TARGET_ROOT"))?,g,gs,ds))
}

fn house_items(b:&[u8],w:Span)->CoreResult<(Value,Span)>{
    let s=f(b,w,"PlayerHouses")?;let mut rows=Vec::new();
    for h in array(b,s,HOUSE_MAX)?{rows.push(json!({"HouseItemID":n(b,h,"HouseItemID")?}));}
    Ok((Value::Array(rows),s))
}
fn orient(v:&Value)->Option<(bool,bool)>{
    let s=v.as_str()?;
    match s{
        "GridOrientation_Up"|"GridOrientation_Down"=>Some((true,false)),
        "GridOrientation_Left"|"GridOrientation_Right"=>Some((true,true)),
        "GridOrientation_UpRight"|"GridOrientation_UpLeft"|"GridOrientation_DownRight"|"GridOrientation_DownLeft"|
        "GridOrientation_UpUpRight"|"GridOrientation_UpUpLeft"|"GridOrientation_DownDownRight"|"GridOrientation_DownDownLeft"|
        "GridOrientation_UpRightRight"|"GridOrientation_UpLeftLeft"|"GridOrientation_DownRightRight"|"GridOrientation_DownLeftLeft"=>Some((false,false)),
        _=>None
    }
}
fn wide(x:i64,y:i64,r:i64)->Option<Rect>{
    Some(Rect(x.checked_sub(r)?,y.checked_sub(r)?,x.checked_add(r)?.checked_add(1)?,y.checked_add(r)?.checked_add(1)?))
}
fn child_extra(b:&[u8],gs:Span,ds:Span,refs:&Incoming,parent:u32,p:&Value)->Option<i64>{
    if !fields(p,&["DesignID","GridID"])||!p["DesignID"].is_null(){return None}
    let id=uint(&p["GridID"])?;if id==0||refs.root(id)!=0||refs.parent(id)!=1{return None}
    if opt(b,ds,&id.to_string()).ok()?.is_some(){return None}
    let g=value(b,f(b,gs,&id.to_string()).ok()?,MAX_GRID).ok()?;
    let path=match parent{
      40004191=>"GridData/Furniture/NonIP_Update17/CoffeeShopTable-GridData.json",
      40003564=>"GridData/Furniture/NonIP_Update14/CastleKit_Wall_Small_Window01-GridData.json",
      40005226=>"GridData/Furniture/NonIP_Update21/FlowerStoreFront-GridData.json",
      _=>return None,
    };
    if uint(&g["ID"])?!=id||uint(&g["TessellationFactor"])?!=2||g["GridDataPath"]!=path||g["GridDefaultLayoutPath"]!=""{return None}
    let m=g["Objects"].as_object()?;if m.len()>1{return None}
    let next=uint(&g["NextGridObjectID"])?;if next==0&&!m.is_empty(){return None}
    for(k,o)in m{
       // E1184 exact child definition, installed Furniture frame SHA
       // cd868c0a30a68f84961df793a23c14c9cb53c90add182481e1d95561e78c3060,
       // 1x1/tess1 -> 2x2 raw; no nested child/override.
       let oid=uint(&o["ID"])?;if parent!=40004191||k!=&oid.to_string()||oid>=next
        ||!fields(o,&["ID","ItemID","X","Y","Orientation","State"])||uint(&o["ItemID"])?!=40004104||!o["State"].is_null(){return None}
       orient(&o["Orientation"])?;
       let x=i64::from(uint(&o["X"])?);let y=i64::from(uint(&o["Y"])?);
       if x>64||y>64{return None}
       return Some(x+y+8)
    }
    Some(0)
}
fn ambient(b:&[u8],world:Span,gs:Span,ds:Span,refs:&Incoming,houses:&Value,o:&Value,dims:(u32,u32))->Option<Rect>{
    let id=uint(&o["ItemID"])?;let x=i64::from(uint(&o["X"])?);let y=i64::from(uint(&o["Y"])?);
    let (card,swap)=orient(&o["Orientation"])?;let(w,h)=(i64::from(dims.0),i64::from(dims.1));
    let mut r=2*(w+h);let s=&o["State"];
    if s.is_null(){
        // Normal-retail furniture/activity; no state-less building fallback.
        if !matches!(id/10_000_000,3|4){return None}
        if matches!(id,40000394|40002410|40003564|40004191|40005226|40001071){return None}
        if card{let(a,b)=if swap{(h,w)}else{(w,h)};return Some(Rect(x,y,x+a,y+b))}
        return wide(x,y,r)
    }
    let m=s.as_object()?;if m.len()!=1{return None}let(k,p)=m.iter().next()?;
    match k.as_str(){
      "FenceMode"=>{
        if !matches!(id,40100035|40100068|40700081|40700176|40700177|40700178|40700246|40700254|40700256)
            ||!fields(p,&["Diagonal"])||p["Diagonal"]!=true||!card{return None}
        let(a,b)=if swap{(h,w)}else{(w,h)};return Some(Rect(x,y,x+a,y+b))
      },
      "HouseData"=>{
        if !matches!(id,20000091|20500024|20500040|20500060|20500086|20500096)
            ||!fields(p,&["Built","PlayerHouseIndex","UpgradeState"])||p["Built"]!=true||!level(&p["UpgradeState"],1){return None}
        let ix=uint(&p["PlayerHouseIndex"])? as usize;let linked=uint(&houses.as_array()?.get(ix)?["HouseItemID"])?;
        // Exact base house link: the original shell and current house
        // definition differ; take the larger conservative envelope, never
        // treat a generic mismatched house as eligible.
        if id==20000091{if ix!=0||linked!=20500005{return None}r=r.max(96);}
        else if linked!=id{return None}
      },
      "BuildingWithSkinData"=>{
        if id!=20300002||!fields(p,&["CurrentSkinItemID","UpgradeState"])||uint(&p["CurrentSkinItemID"])?!=170200013||!level(&p["UpgradeState"],1){return None}
      },
      "StallData"=>{
        if !matches!(id,20100000|20100004|20100005|20100006|20100007|20100008|20100009)
          ||!fields(p,&["CurrentSkinItemID","ShopData","UpgradeState"])||!level(&p["UpgradeState"],3)
          ||uint(&p["CurrentSkinItemID"])?!=if id==20100000{170100012}else{170100010}||!p["ShopData"].is_object(){return None}
      },
      "Toggle"=>{if !matches!(id,40000394|40002410)||!fields(p,&["DesignID","Value"])||!p["DesignID"].is_null()||!p["Value"].is_null(){return None}},
      "SubGrid"=>{r=r.checked_add(child_extra(b,gs,ds,refs,id,p)?)?;},
      "Keyhole"=>{
        if id!=40001071||!fields(p,&["KeyholeConfigDataGUID"]){return None}
        let guid=p["KeyholeConfigDataGUID"].as_str()?;if guid.is_empty()||guid.len()>128{return None}
        let kh=f(b,world,"Keyholes").ok()?;let row=f(b,kh,guid).ok()?;
        if strv(b,row,"GUID").ok()?.as_str()!=guid{return None}
      },
      _=>return None
    }
    wide(x,y,r)
}

// Do not shadow the original accepted target with a grid-only surrogate.
// This original file owns the complete target + positive/negative fixtures.
#[path="steam_single_fence_product_target.rs"]
mod steam_single_fence_product_target;
