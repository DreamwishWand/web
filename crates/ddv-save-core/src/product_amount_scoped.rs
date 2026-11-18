//! ACT916: opt-in product amount provider, fixed Steam626 catalog and
//! compiled definition projection. No fixture, caller-supplied pack, raw
//! command, general Writer, Apply or original overwrite authority.
//! Uses the existing ProductSession/lexical indexed scanner and ledger.
use super::*;
use serde_json::Value;
use std::sync::OnceLock;
#[path="placement_saved_refs.rs"]
mod placement_saved_refs;
#[path="comp03_product_target.rs"]
mod comp03_product_target;
#[path="sr03_product_target.rs"]
mod sr03_product_target;
#[path="switch626_crop_filter.rs"]
mod switch626_crop_filter;
const ELIG:&str=include_str!("../data/steam626-amount-packaged-candidates.json");
const DEP:&str=include_str!("../data/steam626-amount-dependency-projection.json");
const ELIG_SHA:&str="05a6bea5582232b27569dbb71f8666d7d60c11a35515d844d2f21b2ae557b23d";
const DEP_SHA:&str="78a1ba539b2e6f43182cea2c2ea35c9d10e51f27d4adbb8d4dbc6cce7f7dcd65";
static PACK:OnceLock<CoreResult<(Value,Value)>>=OnceLock::new();

const LAYOUT:&str=include_str!("../data/steam626-amount-layout-reference.jsonl");
const LAYOUT_SHA:&str="501ba50d0a6f02ff09080357424f3ae5b3f17644ed64d7830566586baf6fce6f";
const LAYOUT_PARENT_SHA:&str="e2f392465ebfd9a8516f4ddee7b2bce77340115e9d660006eae459ae50366269";
type LayoutIndex=std::collections::BTreeMap<String,LayoutAsset>;
struct LayoutAsset{kind:String,grids:std::collections::BTreeMap<u32,LayoutGrid>}
struct LayoutGrid{items:Vec<i32>,storage:Vec<(i32,u32,bool)>}
static LAYOUT_INDEX:OnceLock<CoreResult<LayoutIndex>>=OnceLock::new();
fn safe_layout_path(path:&str)->bool{
    path.starts_with("SceneLayouts/")&&path.len()<=1024&&!path.contains('\\')&&
        !path.chars().any(char::is_control)&&path.split('/').all(|p|!p.is_empty()&&p!="."&&p!="..")
}
fn ref_u32(v:&Value)->CoreResult<u32>{
    v.as_u64().and_then(|x|u32::try_from(x).ok()).ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))
}
fn ref_item(v:&Value)->CoreResult<i32>{
    v.as_i64().and_then(|x|i32::try_from(x).ok()).filter(|x|*x>0).ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))
}
fn ref_row(v:&Value,n:usize)->CoreResult<&Vec<Value>>{
    v.as_array().filter(|a|a.len()==n).ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))
}
fn ref_str(v:&Value)->CoreResult<&str>{
    v.as_str().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))
}
fn layout_index()->CoreResult<&'static LayoutIndex>{
    LAYOUT_INDEX.get_or_init(||{
        need(hex(&sha(LAYOUT.as_bytes()))==LAYOUT_SHA,"PRODUCT_AMOUNT_LAYOUT_REFERENCE_DIGEST")?;
        let mut lines=LAYOUT.lines();
        let h:Value=serde_json::from_str(lines.next().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?)
            .map_err(|_|denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?;
        need(h["contract"]=="wand.core.steam626.amount-layout-reference@1"&&h["build"]==EXACT_STEAM&&h["schema"]==626&&
            h["authority"]=="REFERENCE_ONLY_NO_NATIVE_HASH_PARITY"&&h["assets"]==154&&h["localGrids"]==1048&&
            h["sourceProjectionSha256"]==LAYOUT_PARENT_SHA&&h["catalogPackSha256"]==ELIG_SHA,
            "PRODUCT_AMOUNT_LAYOUT_REFERENCE_CONTRACT")?;
        let (catalog,_)=pack()?;
        let mut index=LayoutIndex::new();let mut count=0usize;let mut storage_count=0usize;let mut item_count=0usize;
        for line in lines{
            let v:Value=serde_json::from_str(line).map_err(|_|denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?;
            let a=ref_row(&v,5)?;let path=ref_str(&a[0])?;let kind=ref_str(&a[1])?;
            let raw_sha=ref_str(&a[2])?;
            need(safe_layout_path(path)&&kind.starts_with("Meta.")&&kind.ends_with(", Meta")&&
                raw_sha.len()==64&&raw_sha.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b))&&ref_u32(&a[3])?>0,
                "PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE")?;
            let mut grids=std::collections::BTreeMap::new();
            let ga=a[4].as_array().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?;
            need(!ga.is_empty()&&ga.len()<=1048,"PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE")?;
            for g in ga{
                count+=1;need(count<=1048,"PRODUCT_AMOUNT_LAYOUT_REFERENCE_BOUND")?;
                let g=ref_row(g,3)?;let id=ref_u32(&g[0])?;
                let mut items=Vec::new();let mut storage=Vec::new();
                for i in g[1].as_array().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?{
                    let i=ref_item(i)?;need(in_rows(&catalog["profiles"]["catalog0Furniture"]["entries"],i)&&
                        items.last().is_none_or(|last|*last<i),"PRODUCT_AMOUNT_LAYOUT_REFERENCE_ITEM")?;
                    items.push(i);item_count+=1;
                }
                for st in g[2].as_array().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?{
                    let st=ref_row(st,3)?;storage.push((ref_item(&st[0])?,ref_u32(&st[1])?,
                        st[2].as_bool().ok_or(denied("PRODUCT_AMOUNT_LAYOUT_REFERENCE_SHAPE"))?));storage_count+=1;
                }
                need(grids.insert(id,LayoutGrid{items,storage}).is_none(),"PRODUCT_AMOUNT_LAYOUT_REFERENCE_DUPLICATE")?;
            }
            need(index.insert(path.to_owned(),LayoutAsset{kind:kind.to_owned(),grids}).is_none(),
                "PRODUCT_AMOUNT_LAYOUT_REFERENCE_DUPLICATE")?;
        }
        need(index.len()==154&&count==1048&&storage_count==58&&item_count==80,"PRODUCT_AMOUNT_LAYOUT_REFERENCE_COUNT")?;
        Ok(index)
    }).as_ref().map_err(|e|*e)
}
fn signed_hash(b:&[u8],g:Span,k:&str)->CoreResult<i32>{
    let s=f(b,g,k)?;need(s.end-s.begin<=11,"PRODUCT_AMOUNT_LAYOUT_HASH_TYPE")?;
    let v:i32=serde_json::from_slice(&b[s.begin..s.end]).map_err(|_|denied("PRODUCT_AMOUNT_LAYOUT_HASH_TYPE"))?;
    need(v.to_string().as_bytes()==&b[s.begin..s.end],"PRODUCT_AMOUNT_LAYOUT_HASH_TYPE")?;Ok(v)
}
fn layout_asset(b:&[u8],g:Span)->CoreResult<(&'static str,&'static LayoutAsset)>{
    // Only the bounded exact asset path/type/local ID can select a reference
    // row. Saved hash codes are typed observations, never trusted evidence
    // that the installed Native loaded layout or override matches this row.
    need(opt(b,g,"GridDefaultLayoutPath")?.is_some(),"PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED")?;
    let path=strv(b,g,"GridDefaultLayoutPath")?.replace('\\',"/");
    need(safe_layout_path(&path),"PRODUCT_AMOUNT_LAYOUT_PATH")?;
    let (canonical,a)=layout_index()?.get_key_value(&path).ok_or(denied("PRODUCT_AMOUNT_LAYOUT_PATH_UNKNOWN"))?;
    need(strv(b,g,"GridDefaultLayoutType")?==a.kind,"PRODUCT_AMOUNT_LAYOUT_TYPE")?;
    a.grids.get(&n(b,g,"DefaultLayoutGridID")?).ok_or(denied("PRODUCT_AMOUNT_LAYOUT_LOCAL_ID"))?;
    signed_hash(b,g,"DefaultGridHashCode")?;signed_hash(b,g,"DefaultGridDataHashCode")?;
    let mut removed=std::collections::BTreeSet::new();
    for x in array(b,f(b,g,"RemovedObjects")?,16384)?{
        let id=u32::try_from(number(b,x)?).map_err(|_|denied("PRODUCT_AMOUNT_LAYOUT_REMOVED_ID"))?;
        need(removed.insert(id),"PRODUCT_AMOUNT_LAYOUT_REMOVED_DUPLICATE")?;
    }
    Ok((canonical.as_str(),a))
}
fn layout_reference_excludes(q:&LayoutGrid,item:i32,chest:Option<(u32,i32)>)->CoreResult<()>{
    // Conservative base + saved modified union. Removed/replaced base entries
    // never provide a permission to subtract a placement or alias.
    if let Some((cid,parent))=chest{
        need(q.storage.iter().all(|(p,id,template)|*id!=cid&&(!*template||*p!=parent)),
            "PRODUCT_AMOUNT_LAYOUT_BASE_CHEST_ALIAS")?;
    }else{
        need(!q.items.contains(&item),"PRODUCT_AMOUNT_LAYOUT_BASE_PLACEMENT")?;
    }
    Ok(())
}

// ACT946/E1983: a loaded parent may instantiate any local child row. The
// packaged all-local upper bound is conservative; it is NOT a loaded/cache
// or generator proof. Deduplicate by exact canonical asset per operation.
fn layout_asset_excludes(a:&LayoutAsset,item:i32,chest:Option<(u32,i32)>)->CoreResult<()>{
    for q in a.grids.values(){layout_reference_excludes(q,item,chest)?;}
    Ok(())
}

fn hex(v:&[u8])->String{v.iter().map(|x|format!("{x:02x}")).collect()}
fn pack()->CoreResult<&'static (Value,Value)>{
    PACK.get_or_init(||{
        if hex(&sha(ELIG.as_bytes()))!=ELIG_SHA||hex(&sha(DEP.as_bytes()))!=DEP_SHA{
            return Err(denied("PRODUCT_AMOUNT_PACK_DIGEST"));
        }
        let a:Value=serde_json::from_str(ELIG).map_err(|_|denied("PRODUCT_AMOUNT_PACK"))?;
        let d:Value=serde_json::from_str(DEP).map_err(|_|denied("PRODUCT_AMOUNT_PACK"))?;
        if a["contract"]!="wand.catalog.steam626.amount-packaged-candidates@1"||
           a["build"]["id"]!=EXACT_STEAM||a["build"]["schema"]!=626||
           d["contract"]!="wand.core.steam626.amount-dependency-projection@1"||d["build"]!=EXACT_STEAM||
           a["profiles"]["catalog0Furniture"]["entries"].as_array().map(Vec::len)!=Some(234)||
           a["profiles"]["linkedCropChest48"]["items"].as_array().map(Vec::len)!=Some(32)||
           a["profiles"]["linkedCropChest48"]["parents"].as_array().map(Vec::len)!=Some(7){
            return Err(denied("PRODUCT_AMOUNT_PACK_CONTRACT"));
        }
        Ok((a,d))
    }).as_ref().map_err(|e|*e)
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
fn in_rows(v:&Value,item:i32)->bool{
    v.as_array().is_some_and(|a|a.iter().any(|r|r[0].as_i64()==Some(item as i64)&&r[1].as_str().is_some_and(|s|s.len()==64)))
}
fn excludes(v:&Value,item:i32)->CoreResult<()>{
    let a=v.as_array().ok_or(denied("PRODUCT_AMOUNT_DEFINITION_UNRESOLVED"))?;
    need(a.iter().all(|x|x.as_i64().is_some_and(|id|id>0&&id<=i32::MAX as i64&&id!=item as i64)),"PRODUCT_AMOUNT_DEFINITION_TARGET")
}
fn item_refs(b:&[u8],s:Span,item:i32,budget:&mut usize)->CoreResult<()>{
    for x in array(b,s,16384)?{
        *budget+=1;need(*budget<=65536,"PRODUCT_AMOUNT_REFERENCE_BOUND")?;
        let i=number(b,x)?;need(i<=i32::MAX as u64&&i!=item as u64,"PRODUCT_AMOUNT_REFERENCE_TARGET")?;
    }Ok(())
}
fn filter_disjoint(v:&Value,item:i32,furniture:bool)->bool{
    let d=&v["Data"];if !d.is_object(){return false}
    let Some(i)=d["Item"].as_u64() else{return false};
    let Some(ls)=d["ItemList"].as_array() else{return false};
    let Some(any)=d["AnyActivityItem"].as_bool() else{return false};
    if ls.len()>16384||!ls.iter().all(|x|x.as_u64().is_some_and(|i|i>0&&i<=i32::MAX as u64)){return false}
    if i>0{return i<=i32::MAX as u64&&ls.is_empty()&&!any&&i!=item as u64}
    if !ls.is_empty(){return !any&&ls.iter().all(|x|x.as_i64()!=Some(item as i64))}
    let Some(ty)=d["Type"].as_str() else{return false};
    if !["ItemType_Furniture","ItemType_ActivityItem","ItemType_Character","ItemType_Clothing","ItemType_Building"].contains(&ty){return false}
    if furniture{return ty!="ItemType_Furniture"}
    if ty!="ItemType_ActivityItem"{return true}
    !any&&matches!(d["ActivityItemType"].as_str(),Some("ActivityItemType_Fish"|"ActivityItemType_Mineral"|"ActivityItemType_Meal"|"ActivityItemType_Ephemeral"|"ActivityItemType_Flower"|"ActivityItemType_Seed"))
}
fn saved_objective(b:&[u8],s:Span,item:i32,furniture:bool,refs:&mut usize)->CoreResult<()>{
    item_refs(b,f(b,s,"ItemIdsCollected")?,item,refs)?;
    for (k,v) in members(b,f(b,s,"ProgressKeys")?,128)?{
        let value=leaf(b,v)?;need(k=="CurrentAmount"&&value.as_str().is_some_and(|v|!v.is_empty()&&v.len()<=32&&v.bytes().all(|x|x.is_ascii_digit())),"PRODUCT_AMOUNT_PROGRESS_KEY")?;
    }
    if let Some(x)=opt(b,s,"ItemFilter")?{let v=leaf(b,x)?;need(v.is_null()||filter_disjoint(&v,item,furniture),"PRODUCT_AMOUNT_FILTER")?;}
    Ok(())
}
// History IDs alone do not prove current registration. Only the typed saved
// state variants of this scoped build are understood; never ignore new state.
fn saved_event_states(b:&[u8],active:Span)->CoreResult<()>{
    need(b.get(active.begin)==Some(&b'{'),"PRODUCT_AMOUNT_EVENT_STATE")?;
    let mut refs=0usize;
    for(k,event)in members(b,active,4096)?{
        need(key(&k)?>0,"PRODUCT_AMOUNT_EVENT_ID")?;
        need(b.get(event.begin)==Some(&b'{'),"PRODUCT_AMOUNT_EVENT_STATE")?;
        let fields=members(b,event,1)?;
        if fields.is_empty(){continue}
        let (kind,state)=&fields[0];
        need(b.get(state.begin)==Some(&b'{'),"PRODUCT_AMOUNT_EVENT_STATE")?;
        let field=match kind.as_str(){
            "SpawnState"=>"SpawnedObjects",
            "RecurringEventsState"=>"RecurringEventIDs",
            "RecurringEventState"=>"RecurringEventID",
            "SendMailboxState"=>"MailID",
            "AddTimeLostTreasureState"=>"TimeLostTreasureID",
            "SpawnSnippetState"=>"SnippetIDs",
            _=>return reject("PRODUCT_AMOUNT_EVENT_STATE"),
        };
        let payload=members(b,*state,1)?;
        need(payload.len()==1&&payload[0].0==field,"PRODUCT_AMOUNT_EVENT_STATE")?;
        let v=payload[0].1;
        match kind.as_str(){
            "SpawnState"=>for a in array(b,v,16384)?{
                refs+=1;need(refs<=65536,"PRODUCT_AMOUNT_EVENT_BOUND")?;
                need(b.get(a.begin)==Some(&b'{'),"PRODUCT_AMOUNT_EVENT_STATE")?;
                let fs=members(b,a,2)?;
                need(fs.len()==2&&fs.iter().any(|(k,_)|k=="GridID")&&fs.iter().any(|(k,_)|k=="GridObjectID"),"PRODUCT_AMOUNT_EVENT_STATE")?;
                n(b,a,"GridID")?;n(b,a,"GridObjectID")?;
            },
            "RecurringEventsState"|"SpawnSnippetState"=>for a in array(b,v,16384)?{
                refs+=1;need(refs<=65536,"PRODUCT_AMOUNT_EVENT_BOUND")?;
                need(number(b,a)?<=u32::MAX as u64,"PRODUCT_AMOUNT_EVENT_STATE")?;
            },
            "SendMailboxState"=>{strv(b,*state,field)?;},
            _=>{n(b,*state,field)?;},
        }
    }
    Ok(())
}
fn subscribers(b:&[u8],player:Span,world:Span,top:Span,d:&Value,item:i32,furniture:bool)->CoreResult<()>{
    subscribers_bound(b,player,world,top,d,item,furniture,false)
}
fn subscribers_bound(b:&[u8],player:Span,world:Span,top:Span,d:&Value,item:i32,furniture:bool,switch_rm01:bool)->CoreResult<()>{
    if switch_rm01{need(item==40100068&&furniture,"RM01_SUBSCRIBER_SCOPE")?;}
    let mut refs=0usize;let mut nodes=0usize;let mut slots=0usize;
    excludes(&d["events"],item)?;
    let hist=f(b,top,"ConditionalEventHistory")?;
    saved_event_states(b,f(b,hist,"ActiveEvents")?)?;
    for(_,g)in members(b,f(b,world,"MissionSlots")?,4096)?{
        for s in array(b,f(b,g,"Slots")?,4096)?{
            slots+=1;need(slots<=4096,"PRODUCT_AMOUNT_MISSION_BOUND")?;
            let st=strv(b,s,"State")?;need(["MissionSlotState_Invalid","MissionSlotState_OnGoing","MissionSlotState_Available","MissionSlotState_Completed"].contains(&st.as_str()),"PRODUCT_AMOUNT_MISSION_STATE")?;
            let id=n(b,s,"MissionId")?;if id==0{need(st=="MissionSlotState_Invalid","PRODUCT_AMOUNT_MISSION_ID")?;continue}
            let def=&d["missions"][id.to_string()];let shape=def[1].as_array().ok_or(denied("PRODUCT_AMOUNT_MISSION_DEFINITION"))?;
            let steps=array(b,f(b,s,"MissionSteps")?,4096)?;need(steps.len()==shape.len(),"PRODUCT_AMOUNT_MISSION_SHAPE")?;
            let ix=n(b,s,"CurrentStepIndex")? as usize;let active=st=="MissionSlotState_OnGoing";
            need(!active||ix<steps.len(),"PRODUCT_AMOUNT_MISSION_INDEX")?;
            if active||st=="MissionSlotState_Available"{
                excludes(&def[0],item)?;
                need(array(b,f(b,s,"ItemsToGive")?,4096)?.is_empty()&&array(b,f(b,s,"ItemsToGiveAmount")?,4096)?.is_empty(),"PRODUCT_AMOUNT_MISSION_GIVE")?;
            }
            for (i,step) in steps.iter().enumerate(){
                let ds=shape[i].as_array().ok_or(denied("PRODUCT_AMOUNT_MISSION_SHAPE"))?;
                let subs=array(b,f(b,*step,"SubSteps")?,4096)?;need(subs.len()==ds.len(),"PRODUCT_AMOUNT_MISSION_SHAPE")?;
                for (j,sub) in subs.iter().enumerate(){
                    let dd=ds[j].as_array().ok_or(denied("PRODUCT_AMOUNT_MISSION_SHAPE"))?;
                    let obs=array(b,f(b,*sub,"Objectives")?,4096)?;need(obs.len()==dd.len(),"PRODUCT_AMOUNT_MISSION_SHAPE")?;
                    for(k,o)in obs.iter().enumerate(){
                        nodes+=1;need(nodes<=8192,"PRODUCT_AMOUNT_OBJECTIVE_BOUND")?;
                        if active&&i==ix{excludes(&dd[k],item)?;saved_objective(b,*o,item,furniture,&mut refs)?;}
                    }
                }
            }
        }
    }
    let mut seen=std::collections::BTreeSet::new();
    for a in array(b,f(b,player,"AchievementsData")?,16384)?{
        let id=n(b,a,"AchievementID")?;need(seen.insert(id)&&d["achievements"].get(id.to_string()).is_some(),"PRODUCT_AMOUNT_ACHIEVEMENT_ID")?;
        let st=strv(b,a,"State")?;need(["AchievementState_OnGoing","AchievementState_Completed","AchievementState_Invalid"].contains(&st.as_str()),"PRODUCT_AMOUNT_ACHIEVEMENT_STATE")?;
        if st=="AchievementState_OnGoing"{excludes(&d["achievements"][id.to_string()],item)?;}
    }
    let ev=f(b,f(b,player,"EvolveStatesProfile")?,"EvolveProgressState")?;
    for(k,s)in members(b,ev,4096)?{
        let id=key(&k)?;need(n(b,s,"ItemID")?==id&&id!=item as u32,"PRODUCT_AMOUNT_EVOLVE_TARGET")?;
        let o=f(b,s,"Objective")?;need(filter_disjoint(&leaf(b,f(b,o,"ItemFilter")?)?,item,furniture),"PRODUCT_AMOUNT_EVOLVE_FILTER")?;
        item_refs(b,f(b,o,"ItemIdsCollected")?,item,&mut refs)?;
    }
    let mut duties=0usize;
    for(_,g)in members(b,f(b,player,"DutySlots")?,4096)?{
        for s in array(b,f(b,g,"Slots")?,4096)?{
            duties+=1;need(duties<=4096,"PRODUCT_AMOUNT_DUTY_BOUND")?;
            let st=strv(b,s,"State")?;need(["DutySlotState_OnGoing","DutySlotState_Completed","DutySlotState_Invalid"].contains(&st.as_str()),"PRODUCT_AMOUNT_DUTY_STATE")?;
            if st=="DutySlotState_OnGoing"{
                let id=n(b,s,"DutyId")?;let ix=n(b,s,"DifficultyLayer")? as usize;
                let layers=d["duties"][id.to_string()].as_array().ok_or(denied("PRODUCT_AMOUNT_DUTY_DEFINITION"))?;
                let layer=layers.get(ix).ok_or(denied("PRODUCT_AMOUNT_DUTY_LAYER"))?;
                if switch_rm01&&ix==0&&matches!(id,2110000038|2110000161){
                    let v=leaf(b,f(b,f(b,s,"StepData")?,"ItemFilter")?)?;
                    switch626_crop_filter::crop_filter(&v,item,id,ix)?;
                    need(array(b,f(b,s,"ItemsUsed")?,4096)?.is_empty(),"RM01_CROP_ITEMS_USED")?;
                }else{excludes(layer,item)?;}
            }
        }
    }
    let bp=f(b,player,"BattlePassStates")?;let mut groups:Vec<Span>=members(b,f(b,bp,"Progress")?,512)?.into_iter().map(|(_,s)|s).collect();groups.push(f(b,bp,"FtueProgress")?);
    let mut tasks=0usize;
    for g in groups{
        let mut arrays=vec![f(b,g,"TasksProgress")?];
        for w in array(b,f(b,g,"WeeklyTasksProgress")?,128)?{arrays.push(f(b,w,"TasksProgress")?);}
        for a in arrays{for t in array(b,a,4096)?{
            tasks+=1;need(tasks<=16384,"PRODUCT_AMOUNT_BATTLEPASS_BOUND")?;
            let st=strv(b,t,"TaskState")?;need(["BattlePassTaskState_None","BattlePassTaskState_NotStarted","BattlePassTaskState_OnGoing","BattlePassTaskState_Completed","BattlePassTaskState_CurrencyClaimed"].contains(&st.as_str()),"PRODUCT_AMOUNT_BATTLEPASS_STATE")?;
            let o=f(b,t,"Objective")?;let fields=members(b,o,4)?;
            need(fields.len()==4&&["CurAmount","ItemFilter","ItemIdsCollected","TargetAmount"].iter().all(|k|fields.iter().any(|(x,_)|x==k)),"PRODUCT_AMOUNT_BATTLEPASS_OBJECTIVE")?;
            need(n(b,o,"CurAmount")?<=i32::MAX as u32&&n(b,o,"TargetAmount")?<=i32::MAX as u32,"PRODUCT_AMOUNT_BATTLEPASS_OBJECTIVE")?;
            // An ongoing Battle Pass objective is a live item subscriber.
            // Never treat its historical ItemIdsCollected or broad/unknown
            // ItemFilter as proof of independence from this amount target.
            if st=="BattlePassTaskState_OnGoing"{
                let filter=leaf(b,f(b,o,"ItemFilter")?)?;
                need(filter_disjoint(&filter,item,furniture),"PRODUCT_AMOUNT_BATTLEPASS_FILTER")?;
                item_refs(b,f(b,o,"ItemIdsCollected")?,item,&mut refs)?;
            }else{
                // Inactive history is not replayed by a local amount edit.
                item_refs(b,f(b,o,"ItemIdsCollected")?,0,&mut refs)?;
            }
        }}
    }
    Ok(())
}

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

#[derive(Clone,Copy)]struct Link{grid:u32,object:u32,record:Span,grid_span:Span}

#[derive(Clone,Copy,PartialEq,Eq)]
enum LayoutBinding { SteamReferenceOnly, Steam626ChestStatic, Switch626ChestStatic }
fn scan_grids(b:&[u8],world:Span,item:i32,chest:Option<(u32,i32)>)->CoreResult<Option<Link>>{
    scan_grids_bound(b,world,item,chest,LayoutBinding::SteamReferenceOnly)
}
fn scan_grids_bound(b:&[u8],world:Span,item:i32,chest:Option<(u32,i32)>,binding:LayoutBinding)->CoreResult<Option<Link>>{
    if binding==LayoutBinding::Switch626ChestStatic{
        need(chest.is_some(),"PRODUCT_SWITCH626_CHEST_ONLY")?;
    }else if binding==LayoutBinding::Steam626ChestStatic{
        need(chest.is_some(),"PRODUCT_AMOUNT_STATIC_CHEST_ONLY")?;
    }
    let gc=f(b,world,"GridCollection")?;let mut count=0usize;let mut total=0usize;let mut link=None;
    let mut subgrid=std::collections::BTreeSet::new();let mut grids=std::collections::BTreeSet::new();
    let mut native_unresolved=false;let mut state_budget=0usize;
    let mut checked_assets=std::collections::BTreeSet::new();
    for (map,objects,diff) in [("Grids","Objects",false),("DiffGrids","ModifiedObjects",true)]{
        for(k,g)in members(b,f(b,gc,map)?,50000)?{
            count+=1;need(count<=50000,"PRODUCT_AMOUNT_GRID_BOUND")?;let gid=key(&k)?;
            need(n(b,g,"ID")?==gid&&grids.insert(gid),"PRODUCT_AMOUNT_GRID_ID")?;
            if diff{
                let (path,a)=layout_asset(b,g)?;
                if checked_assets.insert(path){layout_asset_excludes(a,item,chest)?;}
                // ACT946 static reference is not a Native hash/loaded override
                // proof. Retain a separate fail-closed gate until the applicable
                // source-bound Native/static closure is accepted. No caller
                // argument, saved hash alone, or source SHA can satisfy it.
                if binding==LayoutBinding::Switch626ChestStatic{
                    // E2223: 153 exact Switch normal-retail assets; the
                    // remaining Steam reference has no Switch proof.
                    need(path!="SceneLayouts/Houses/OogieBoogieHouse/OogieBoogieHouse.json",
                        "PRODUCT_SWITCH626_LAYOUT_NOT_PROVEN")?;
                }else if binding==LayoutBinding::SteamReferenceOnly{native_unresolved=true;}
                // Steam626ChestStatic: ACT946 normal-retail static closure,
                // exact compiled 154-asset/1048-local reference pack and
                // current path/type/local ID + conservative all-local union.
                // Never infer Native loaded parity from saved hashes.
            }else{
                need(strv(b,g,"GridDefaultLayoutPath")?.is_empty(),"PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED")?;
            }
            for(k,o)in members(b,f(b,g,objects)?,16384)?{
                total+=1;need(total<=250000,"PRODUCT_AMOUNT_GRID_OBJECT_BOUND")?;let oid=key(&k)?;
                need(n(b,o,"ID")?==oid,"PRODUCT_AMOUNT_OBJECT_ID")?;
                let id=n(b,o,"ItemID")?;need(id<=i32::MAX as u32,"PRODUCT_AMOUNT_OBJECT_ITEM")?;
                if chest.is_none(){need(id!=item as u32,"PRODUCT_AMOUNT_PLACEMENT_TARGET")?;}
                let s=f(b,o,"State")?;if &b[s.begin..s.end]==b"null"{continue}
                saved_grid_state(b,s,item,&mut state_budget)?;
                let fs=members(b,s,128)?;
                for(k,v)in fs{
                    if k=="Storage"{
                        let cid=n(b,v,"ContainerInventoryID")?;
                        if let Some((selected,parent))=chest{
                            if id==parent as u32{
                                need(strv(b,v,"DefaultContainerInventoryData")?.is_empty(),"PRODUCT_AMOUNT_CHEST_TEMPLATE_ALIAS")?;
                            }
                            if cid==selected{
                                need(!diff&&link.is_none(),"PRODUCT_AMOUNT_CHEST_DUPLICATE_LINK")?;
                                link=Some(Link{grid:gid,object:oid,record:o,grid_span:g});
                            }
                        }
                    }else if k=="SubGrid"{subgrid.insert(n(b,v,"GridID")?);}
                }
            }
        }
    }
    if let Some(l)=link{need(!subgrid.contains(&l.grid),"PRODUCT_AMOUNT_CHEST_SUBGRID")?;}
    need(!native_unresolved,"PRODUCT_AMOUNT_EFFECTIVE_NATIVE_BINDING_UNPROVEN")?;
    Ok(link)
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
fn check_parent(b:&[u8],world:Span,link:Link,parent:i32,cid:u32)->CoreResult<()>{
    let _=link.grid_span;need(n(b,link.record,"ItemID")?==parent as u32,"PRODUCT_AMOUNT_CHEST_PARENT")?;
    let st=f(b,link.record,"State")?;let fs=members(b,st,1)?;
    need(fs.len()==1&&fs[0].0=="Storage","PRODUCT_AMOUNT_CHEST_PARENT_STATE")?;
    let ss=fs[0].1;need(n(b,ss,"ContainerInventoryID")?==cid&&strv(b,ss,"DefaultContainerInventoryData")?.is_empty()&&
        n(b,ss,"UnlockKeyItemID")?==0&&strv(b,ss,"UnlockLocId")?.is_empty()&&leaf(b,f(b,ss,"DesignID")?)?.is_null(),"PRODUCT_AMOUNT_CHEST_PARENT_LOCK")?;
    let mut roots=0usize;
    for v in array(b,f(b,world,"Villages")?,4096)?{
        for(_,a)in members(b,f(b,v,"Areas")?,4096)?{
            for g in array(b,f(b,a,"GridIDs")?,4096)?{
                if number(b,g)?==link.grid as u64{roots+=1;need(boolean(b,a,"Unlocked")?,"PRODUCT_AMOUNT_CHEST_ROOT_LOCK")?;}
            }
        }
    }
    need(roots==1,"PRODUCT_AMOUNT_CHEST_ROOT")?;
    // Address-specific saved references: inspect existing indexed subtrees
    // only, not a second full-document parser. Bound nodes across domains.
    let _=link.object;Ok(())
}
fn address_refs(b:&[u8],s:Span,gid:u32,oid:u32,budget:&mut usize,depth:usize)->CoreResult<()>{
    *budget+=1;need(*budget<=250000&&depth<=64,"PRODUCT_AMOUNT_ADDRESS_BOUND")?;
    match b[s.begin]{
        b'{'=>{let fs=members(b,s,4096)?;for (gk,ok) in [("GridID","GridObjectID"),("GridId","GridObjectId")]{
            let g=fs.iter().find(|(k,_)|k==gk);let o=fs.iter().find(|(k,_)|k==ok);
            if let (Some((_,g)),Some((_,o)))=(g,o){
                let a=number(b,*g)?;let c=number(b,*o)?;
                need(a!=gid as u64||c!=oid as u64,"PRODUCT_AMOUNT_CHEST_ADDRESS_REFERENCE")?;
            }
        }for(_,x)in fs{address_refs(b,x,gid,oid,budget,depth+1)?;}}
        b'['=>for x in array(b,s,16384)?{address_refs(b,x,gid,oid,budget,depth+1)?;},
        _=>{}
    }Ok(())
}
fn eligible(s:&ProductSession,t:&CoreExistingAmountTarget,new:u32)->CoreResult<()>{
    // ACT916: only the existing linked Crop Chest48 profile can use the
    // accepted Steam626 normal-retail static source bound. Keep Catalog0
    // reference-only until its own candidate/provider closure is accepted.
    build_check(s)?;
    let binding=if matches!(t.view().selection,ExistingAmountSelection::Chest{..}){
        LayoutBinding::Steam626ChestStatic
    }else{LayoutBinding::SteamReferenceOnly};
    eligible_bound(s,t,new,binding)
}
fn eligible_bound(s:&ProductSession,t:&CoreExistingAmountTarget,new:u32,binding:LayoutBinding)->CoreResult<()>{
    if binding==LayoutBinding::Switch626ChestStatic{
        need(matches!(t.view().selection,ExistingAmountSelection::Chest{..}),"PRODUCT_SWITCH626_CHEST_ONLY")?;
    }else if binding==LayoutBinding::Steam626ChestStatic{
        build_check(s)?;
        need(matches!(t.view().selection,ExistingAmountSelection::Chest{..}),"PRODUCT_AMOUNT_STATIC_CHEST_ONLY")?;
    }
    let (a,d)=pack()?;let v=t.view();let item=v.item_id;
    need(v.old_amount.checked_sub(1)==Some(new)&&new>0,"PRODUCT_AMOUNT_DECREASE_ONE")?;
    let b=&s.decoded;let r=indexed_read::roots(b)?;let top_start=indexed_read::skip_ws(b,0);let top=Span{begin:top_start,end:indexed_read::value_end(b,top_start)?};
    let lists=f(b,r.player,"ListInventories")?;let furniture=match v.selection{
        ExistingAmountSelection::Inventory{inventory_id:0,item_id}=>{
            need(item_id==item as u32&&v.compatible_item_type==ExistingAmountItemType::Furniture&&in_rows(&a["profiles"]["catalog0Furniture"]["entries"],item),"PRODUCT_AMOUNT_CATALOG_ELIGIBILITY")?;
            let mut matches=0usize;for(k,route)in members(b,lists,4096)?{
                let id=key(&k)?;need(n(b,route,"ID")?==id,"PRODUCT_AMOUNT_ROUTE_ID")?;
                if opt(b,f(b,route,"Inventory")?,&item.to_string())?.is_some(){matches+=1;need(id==0,"PRODUCT_AMOUNT_CATALOG_ROUTE")?;}
            }need(matches==1,"PRODUCT_AMOUNT_CATALOG_ROUTE")?;
            physical_totals(b,r.player,item,None,v.old_amount)?;scan_grids(b,r.world,item,None)?;
            true
        }
        ExistingAmountSelection::Chest{container_id,slot_index}=>{
            let facts=v.chest.ok_or(denied("PRODUCT_AMOUNT_CHEST_FACTS"))?;
            let p=&a["profiles"]["linkedCropChest48"];
            need(container_id>1&&v.old_amount==50&&new==49&&facts.size==48&&facts.extra_size==0&&facts.physical_slot_count==48&&facts.packaged_stack_bound==50&&facts.state_sha256==sha(b"null")&&facts.belongs_to_player&&!facts.block_move_to&&
                in_rows(&p["items"],item)&&in_rows(&p["parents"],facts.parent_item_id),"PRODUCT_AMOUNT_CHEST_ELIGIBILITY")?;
            let mut total=physical_totals(b,r.player,item,Some((container_id,slot_index)),v.old_amount)?;
            let pantry=f(b,lists,"2")?;need(n(b,pantry,"ID")?==2&&strv(b,pantry,"CompatibleItemType")?=="ItemType_ActivityItem","PRODUCT_AMOUNT_PANTRY")?;
            if let Some(x)=opt(b,f(b,pantry,"Inventory")?,&item.to_string())?{total=total.checked_add(n(b,x,"Amount")? as u64).ok_or(denied("PRODUCT_AMOUNT_TOTAL"))?;}
            for x in array(b,f(b,f(b,r.player,"BackpackOverflow")?,"Items")?,16384)?{need(n(b,x,"ItemID")?!=item as u32,"PRODUCT_AMOUNT_OVERFLOW")?;}
            need(total>=v.old_amount as u64&&total<=i32::MAX as u64,"PRODUCT_AMOUNT_TOTAL")?;
            let link=scan_grids_bound(b,r.world,item,Some((container_id,facts.parent_item_id)),binding)?.ok_or(denied("PRODUCT_AMOUNT_CHEST_LINK"))?;
            check_parent(b,r.world,link,facts.parent_item_id,container_id)?;
            let mut budget=0;for x in [f(b,top,"ConditionalEventHistory")?,f(b,r.world,"MissionSlots")?,f(b,r.player,"AchievementsData")?]{address_refs(b,x,link.grid,link.object,&mut budget,0)?;}
            false
        }
        _=>return reject("PRODUCT_AMOUNT_PROFILE"),
    };
    subscribers(b,r.player,r.world,top,d,item,furniture)
}

#[path="product_switch626_chest.rs"]
mod product_switch626_chest;

const DISCOVERY_SCAN_PAGE:usize=16;
const DISCOVERY_MAX_CANDIDATES:usize=4096;
fn discovery_selections(b:&[u8],player:Span,profile:&str)->CoreResult<Vec<ExistingAmountSelection>>{
    let (catalog,_)=pack()?;let mut out=Vec::new();
    match profile{
        "catalog0-furniture"=>{
            let lists=f(b,player,"ListInventories")?;
            let route=f(b,lists,"0")?;
            need(n(b,route,"ID")?==0&&strv(b,route,"CompatibleItemType")?=="ItemType_Furniture","PRODUCT_AMOUNT_DISCOVERY_CATALOG_ROUTE")?;
            for(k,e)in members(b,f(b,route,"Inventory")?,16384)?{
                let id=key(&k)?;
                if id<=i32::MAX as u32&&in_rows(&catalog["profiles"]["catalog0Furniture"]["entries"],id as i32){
                    let old=n(b,e,"Amount")?;
                    if (2..=9999).contains(&old){out.push(ExistingAmountSelection::Inventory{inventory_id:0,item_id:id});}
                }
            }
        }
        "linked-crop-chest48"=>{
            let p=&catalog["profiles"]["linkedCropChest48"];
            for(k,c)in members(b,f(b,player,"ContainerInventories")?,4096)?{
                let id=key(&k)?;if id<=1{continue;}
                need(n(b,c,"ID")?==id,"PRODUCT_AMOUNT_DISCOVERY_CONTAINER_ID")?;
                let parent=n(b,c,"ParentItemID")?;
                if parent>i32::MAX as u32||!in_rows(&p["parents"],parent as i32)||
                   n(b,c,"Size")?!=48||n(b,c,"ExtraSize")?!=0||
                   !boolean(b,c,"BelongsToPlayer")?||boolean(b,c,"BlockMoveTo")?{continue;}
                let slots=array(b,f(b,c,"Inventory")?,48)?;
                if slots.len()!=48{continue;}
                for (slot,s) in slots.into_iter().enumerate(){
                    let item=n(b,s,"ItemID")?;
                    if item<=i32::MAX as u32&&in_rows(&p["items"],item as i32)&&n(b,s,"Amount")?==50{
                        let state=f(b,s,"State")?;
                        if &b[state.begin..state.end]==b"null"{
                            out.push(ExistingAmountSelection::Chest{container_id:id,slot_index:slot});
                            need(out.len()<=DISCOVERY_MAX_CANDIDATES,"PRODUCT_AMOUNT_DISCOVERY_BOUND")?;
                        }
                    }
                }
            }
        }
        _=>return reject("PRODUCT_AMOUNT_DISCOVERY_PROFILE"),
    }
    need(out.len()<=DISCOVERY_MAX_CANDIDATES,"PRODUCT_AMOUNT_DISCOVERY_BOUND")?;
    Ok(out)
}
impl ProductSession{
    /// Bounded same-session discovery, never a mutation grant. Candidate
    /// enumeration is just a lookup; every returned row passes the SAME
    /// observation and eligible predicate as preview/stage. Denied rows are
    /// omitted and nextOffset is a scan offset, not a capability.
    pub(crate) fn discover_scoped_product_amount(&self,e:WorkerEnvelope,profile:&str,offset:u32)
        ->CoreResult<(Vec<CoreExistingAmountTarget>,Option<u32>,u32)>{
        build_check(self)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;
        let all=discovery_selections(b,roots.player,profile)?;
        let start=offset as usize;need(start<=all.len(),"PRODUCT_AMOUNT_DISCOVERY_OFFSET")?;
        let end=start.saturating_add(DISCOVERY_SCAN_PAGE).min(all.len());
        let mut accepted=Vec::new();
        for &sel in &all[start..end]{
            if let Ok(t)=observe_existing_amount(self,&e,sel){
                let old=t.view().old_amount;
                if let Some(new)=old.checked_sub(1){
                    if eligible(self,&t,new).is_ok(){accepted.push(t);}
                }
            }
        }
        Ok((accepted,(end<all.len()).then_some(end as u32),(end-start) as u32))
    }
}

impl ProductSession{
    /// Source candidate only; separate opt-in Worker feature. The sealed grant
    /// never leaves Rust. The caller supplies selectors/old/new only, not
    /// eligibility, definition packs or authority.
    pub(crate) fn preview_scoped_product_amount(&self,e:WorkerEnvelope,selection:ExistingAmountSelection,new:u32)->CoreResult<CoreExistingAmountTarget>{
        build_check(self)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        let t=observe_existing_amount(self,&e,selection)?;eligible(self,&t,new)?;Ok(t)
    }
    pub(crate) fn stage_scoped_product_amount(&self,e:WorkerEnvelope,selection:ExistingAmountSelection,old:u32,new:u32,entry:[u8;32])->CoreResult<SemanticStageReceipt>{
        let mut read=e;read.action=WorkerAction::ReadDomain;
        need(e.action==WorkerAction::Stage,"PRODUCT_AMOUNT_STAGE_ACTION")?;
        let t=self.preview_scoped_product_amount(read,selection,new)?;
        need(t.view().old_amount==old&&t.view().entry_sha256==entry,"PRODUCT_AMOUNT_ENTRY_CAS")?;
        let grant=AuthorizedExistingAmountTarget{target:t,new_amount:new};
        self.stage_core_minted_amount_batch(e,&[grant])
    }
}
#[cfg(test)]
mod tests{
    use super::*;use serde_json::json;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"ConditionalEventHistory":{"ActiveEvents":{}},
        "World":{"GridCollection":{"Grids":{},"DiffGrids":{}},"MissionSlots":{},"Villages":[]},
        "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000048":{"Amount":3,"Marker":"ItemMarker_None"}}}},
        "ContainerInventories":{},"AchievementsData":[],"EvolveStatesProfile":{"EvolveProgressState":{}},"DutySlots":{},
        "BattlePassStates":{"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}}},"Unknown":{"x":1}})}
    fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap()}
    fn scope(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
    #[test]fn fixed_pack_and_catalog_exact1_no_product_flag(){
        pack().unwrap();let d=doc();let s=open(&d);let e=scope(&s,WorkerAction::ReadDomain);
        let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048};
        let t=s.preview_scoped_product_amount(e,sel,2).unwrap();assert_eq!(t.view().old_amount,3);
        assert!(s.preview_scoped_product_amount(e,sel,1).is_err());
        assert!(s.authorize_existing_amount_target(e,&t,2).is_err());
        let st=scope(&s,WorkerAction::Stage);
        assert!(s.stage_scoped_product_amount(st,sel,3,2,[0;32]).is_err());
        assert!(open(&d).stage_scoped_product_amount(st,sel,3,2,t.view().entry_sha256).is_err());
        let r=s.stage_scoped_product_amount(st,sel,3,2,t.view().entry_sha256).unwrap();
        assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        assert!(s.stage_scoped_product_amount(st,sel,3,2,t.view().entry_sha256).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d;wanted["Player"]["ListInventories"]["0"]["Inventory"]["40000048"]["Amount"]=json!(2);assert_eq!(out,serde_json::to_vec(&wanted).unwrap());
    }
    fn chest_doc()->Value{
        let mut d=doc();let p=&mut d["Player"];
        p["ListInventories"]["2"]=json!({"ID":2,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30200000":{"Amount":2}}});
        let empty=json!({"ItemID":0,"Amount":0,"State":null});
        let mut slots=vec![empty.clone();48];slots[0]=json!({"ItemID":30200000,"Amount":50,"State":null,"Unknown":7});
        p["ContainerInventories"]=json!({"0":{"ID":0,"BelongsToPlayer":true,"Size":1,"ExtraSize":0,"Inventory":[{"ItemID":30200000,"Amount":5,"State":{}}]},
            "1":{"ID":1,"BelongsToPlayer":true,"Size":1,"ExtraSize":0,"Inventory":[empty]},
            "12":{"ID":12,"ParentItemID":40001680,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":48,"ExtraSize":0,"Inventory":slots}});
        p["BackpackOverflow"]=json!({"Items":[]});
        d["World"]["GridCollection"]["Grids"]["7"]=json!({"ID":7,"GridDefaultLayoutPath":"","Objects":{"4":{"ID":4,"ItemID":40001680,
            "State":{"Storage":{"ContainerInventoryID":12,"DefaultContainerInventoryData":"","UnlockKeyItemID":0,"UnlockLocId":"","DesignID":null}}}}});
        d["World"]["Villages"]=json!([{"Areas":{"2":{"GridIDs":[7],"Unlocked":true}}}]);d
    }
    #[test]fn linked_crop_exact1_and_references_fail_closed(){
        let d=chest_doc();let sel=ExistingAmountSelection::Chest{container_id:12,slot_index:0};let s=open(&d);
        let t=s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,49).unwrap();assert_eq!(t.view().old_amount,50);
        let r=s.stage_scoped_product_amount(scope(&s,WorkerAction::Stage),sel,50,49,t.view().entry_sha256).unwrap();assert_eq!(r.exact_field_changed_count,1);
        let out=s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).unwrap();
        let mut want=d.clone();want["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(49);assert_eq!(out,serde_json::to_vec(&want).unwrap());
        for(k,v)in [("BelongsToPlayer",json!(false)),("BlockMoveTo",json!(true)),("ExtraSize",json!(1)),("ParentItemID",json!(40000048))]{
            let mut q=d.clone();q["Player"]["ContainerInventories"]["12"][k]=v;let x=open(&q);
            assert!(x.preview_scoped_product_amount(scope(&x,WorkerAction::ReadDomain),sel,49).is_err());
        }
        for case in 0..4{
            let mut q=d.clone();match case{
                0=>q["Player"]["ContainerInventories"]["12"]["Inventory"][0]["State"]=json!({}),
                1=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["State"]["Storage"]["UnlockKeyItemID"]=json!(1),
                2=>q["Player"]["BackpackOverflow"]["Items"]=json!([{"ItemID":30200000,"Amount":1}]),
                _=>q["ConditionalEventHistory"]["ActiveEvents"]["15299998"]=json!({"GridID":7,"GridObjectID":4})
            }let x=open(&q);assert!(x.preview_scoped_product_amount(scope(&x,WorkerAction::ReadDomain),sel,49).is_err());
        }
    }
    #[test]
    fn switch626_chest_exact_build_static_layout_and_atomic_ledger(){
        let ix=layout_index().unwrap();
        let (path,asset,local)=ix.iter().find_map(|(p,a)|{
            if p.contains("OogieBoogieHouse")||a.grids.values().any(|g|!g.storage.is_empty()){return None}
            a.grids.keys().next().map(|id|(p,a,*id))
        }).unwrap();
        let mut d=chest_doc();
        let overlay=|p:&str,k:&str,id:u32|json!({"ID":19,"GridDefaultLayoutPath":p,
            "GridDefaultLayoutType":k,"DefaultLayoutGridID":id,"DefaultGridHashCode":-4,
            "DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
        d["World"]["GridCollection"]["DiffGrids"]["19"]=overlay(path,&asset.kind,local);
        let open_sw=|v:&Value|ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),crate::BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
            build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
        let sel=ExistingAmountSelection::Chest{container_id:12,slot_index:0};
        let s=open_sw(&d);let e=scope(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
        let (rows,next,scanned)=s.discover_switch626_scoped_chest(e,0).unwrap();
        assert_eq!(rows.len(),1);assert!(next.is_none());assert_eq!(scanned,1);
        let t=s.preview_switch626_scoped_chest(e,sel,49).unwrap();assert_eq!(t,rows[0]);
        assert_eq!(s.receipt().unwrap(),before);
        let steam=open(&d);
        assert!(steam.preview_switch626_scoped_chest(scope(&steam,WorkerAction::ReadDomain),sel,49).is_err());
        // ACT916 adds this independent Steam profile; Switch entry points
        // remain denied on Steam, and Steam entry points denied on Switch.
        assert!(steam.preview_scoped_product_amount(scope(&steam,WorkerAction::ReadDomain),sel,49).is_ok());
        assert!(s.preview_scoped_product_amount(e,sel,49).is_err());
        assert!(s.preview_switch626_scoped_chest(e,sel,48).is_err());
        assert!(s.preview_switch626_scoped_chest(e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},49).is_err());
        let excluded="SceneLayouts/Houses/OogieBoogieHouse/OogieBoogieHouse.json";
        let ex=ix.get(excluded).unwrap();
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]=overlay(excluded,&ex.kind,*ex.grids.keys().next().unwrap());
        let x=open_sw(&q);assert_eq!(x.preview_switch626_scoped_chest(scope(&x,WorkerAction::ReadDomain),sel,49).unwrap_err().0,"PRODUCT_SWITCH626_LAYOUT_NOT_PROVEN");
        for (key,bad) in [("GridDefaultLayoutPath",json!("SceneLayouts/Unknown.json")),("GridDefaultLayoutType",json!("Meta.Unknown, Meta")),("DefaultLayoutGridID",json!(4294967295u32)),("RemovedObjects",json!([1,1]))]{
            let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"][key]=bad;
            let x=open_sw(&q);assert!(x.preview_switch626_scoped_chest(scope(&x,WorkerAction::ReadDomain),sel,49).is_err());
        }
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]["ModifiedObjects"]["9"]=json!({
            "ID":9,"ItemID":40001680,"State":{"Storage":{"ContainerInventoryID":12,"DefaultContainerInventoryData":"","DesignID":null,"UnlockKeyItemID":0,"UnlockLocId":""}}});
        let x=open_sw(&q);assert!(x.preview_switch626_scoped_chest(scope(&x,WorkerAction::ReadDomain),sel,49).is_err());
        let st=scope(&s,WorkerAction::Stage);
        assert!(s.stage_switch626_scoped_chest(st,sel,50,49,[0;32]).is_err());
        assert!(open_sw(&d).stage_switch626_scoped_chest(st,sel,50,49,t.view().entry_sha256).is_err());
        let r=s.stage_switch626_scoped_chest(st,sel,50,49,t.view().entry_sha256).unwrap();
        assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        assert!(s.stage_switch626_scoped_chest(st,sel,50,49,t.view().entry_sha256).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let export=scope(&s,WorkerAction::ExportEditedCopy);
        let out=s.take_typed_semantic_decoded_once(export).unwrap();
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
        d["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(49);
        assert_eq!(out,serde_json::to_vec(&d).unwrap());
    }
    #[test]fn saved_event_state_typed_history_and_unknown_denial(){
        for chest in [false,true]{
            let mut d=if chest{chest_doc()}else{doc()};
            let (sel,new)=if chest{(ExistingAmountSelection::Chest{container_id:12,slot_index:0},49)}else{(ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},2)};
            d["ConditionalEventHistory"]["ActiveEvents"]=json!({
                "1":{},"2":{"SpawnState":{"SpawnedObjects":[{"GridID":1,"GridObjectID":2}]}},
                "3":{"RecurringEventsState":{"RecurringEventIDs":[1,2]}},"4":{"RecurringEventState":{"RecurringEventID":1}},
                "5":{"SendMailboxState":{"MailID":"synthetic"}},"6":{"AddTimeLostTreasureState":{"TimeLostTreasureID":1}},
                "7":{"SpawnSnippetState":{"SnippetIDs":[1]}}});
            let s=open(&d);assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,new).is_ok());
            for bad in [json!({"UnrecognizedEventState":{"ItemID":40000048}}),
                json!({"SpawnState":{"SpawnedObjects":[{"GridID":1,"GridObjectID":2,"ItemID":40000048}]}}),
                json!({"SpawnState":{"SpawnedObjects":[],"Other":1}}),
                json!({"RecurringEventState":{"RecurringEventID":"1"}}),
                json!({"SendMailboxState":{"MailID":1}}),json!({"SpawnSnippetState":{"SnippetIDs":[-1]}}),
                json!({"RecurringEventsState":{"RecurringEventIDs":[{}]}}),json!([]),json!(null)]{
                let mut q=d.clone();q["ConditionalEventHistory"]["ActiveEvents"]["8"]=bad;
                let s=open(&q);assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,new).is_err());
            }
        }
    }
    #[test]fn unknown_active_subscriber_denied(){
        let mut d=doc();d["Player"]["DutySlots"]["0"]=json!({"Slots":[{"State":"DutySlotState_OnGoing","DutyId":2119999999,"DifficultyLayer":0}]});
        let s=open(&d);let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048};
        assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,2).is_err());
    }

    #[test]fn ongoing_battlepass_target_filter_and_collected_id_fail_closed(){
        for chest in [false,true]{
            let mut d=if chest{chest_doc()}else{doc()};
            let (sel,new,item,foreign)=if chest{
                (ExistingAmountSelection::Chest{container_id:12,slot_index:0},49,30200000,30200001)
            }else{
                (ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},2,40000048,40000049)
            };
            let tasks=&mut d["Player"]["BattlePassStates"]["FtueProgress"]["TasksProgress"];
            *tasks=json!([{"TaskState":"BattlePassTaskState_OnGoing","Objective":{
                "CurAmount":0,"TargetAmount":1,"ItemIdsCollected":[],
                "ItemFilter":{"Data":{"Item":foreign,"ItemList":[],"AnyActivityItem":false}}
            }}]);
            let check=|v:&Value|->CoreResult<CoreExistingAmountTarget>{
                let s=open(v);s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,new)
            };
            assert!(check(&d).is_ok(),"known disjoint ongoing item filter must remain eligible");

            let mut q=d.clone();
            q["Player"]["BattlePassStates"]["FtueProgress"]["TasksProgress"][0]["Objective"]["ItemFilter"]["Data"]["Item"]=json!(item);
            assert_eq!(check(&q).unwrap_err().0,"PRODUCT_AMOUNT_BATTLEPASS_FILTER");

            let mut q=d.clone();
            q["Player"]["BattlePassStates"]["FtueProgress"]["TasksProgress"][0]["Objective"]["ItemIdsCollected"]=json!([item]);
            assert_eq!(check(&q).unwrap_err().0,"PRODUCT_AMOUNT_REFERENCE_TARGET");

            let mut q=d.clone();
            q["Player"]["BattlePassStates"]["FtueProgress"]["TasksProgress"][0]["Objective"]["ItemFilter"]=Value::Null;
            assert_eq!(check(&q).unwrap_err().0,"PRODUCT_AMOUNT_BATTLEPASS_FILTER");
        }
    }

    #[test]fn static_layout_reference_bound_no_native_authority(){
        let ix=layout_index().unwrap();assert_eq!(ix.len(),154);
        let (path,asset,local)=ix.iter().filter(|(_,a)|layout_asset_excludes(a,30200000,Some((12,40001680))).is_ok()).find_map(|(p,a)|a.grids.iter().find(|(_,g)|g.items.is_empty()&&g.storage.is_empty()).map(|(id,_)|(p,a,*id))).unwrap();
        let overlay=|path:&str,kind:&str,local:u32|json!({"ID":19,"GridDefaultLayoutPath":path,
            "GridDefaultLayoutType":kind,"DefaultLayoutGridID":local,"DefaultGridHashCode":-4,
            "DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
        let mut d=chest_doc();
        d["World"]["GridCollection"]["DiffGrids"]["19"]=overlay(path,&asset.kind,local);
        let sel=ExistingAmountSelection::Chest{container_id:12,slot_index:0};
        let verify=|d:&Value,expected:&str|{
            let s=open(d);let before=s.receipt().unwrap();
            assert_eq!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,49).unwrap_err().0,expected);
            assert_eq!(s.receipt().unwrap(),before);
        };
        // The old unbound scanner remains fail-closed; only the exact
        // Steam-linked Chest profile can use the normal-retail static bound.
        let raw=serde_json::to_vec(&d).unwrap();let roots=indexed_read::roots(&raw).unwrap();
        assert_eq!(scan_grids(&raw,roots.world,30200000,Some((12,40001680))).err().unwrap().0,"PRODUCT_AMOUNT_EFFECTIVE_NATIVE_BINDING_UNPROVEN");
        let s=open(&d);let before=s.receipt().unwrap();
        let t=s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,49).unwrap();
        assert_eq!(s.receipt().unwrap(),before);
        assert_eq!(s.discover_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),"linked-crop-chest48",0).unwrap().0.len(),1);
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]["GridDefaultLayoutPath"]=json!(path.replace('/',"\\"));
        let x=open(&q);assert!(x.preview_scoped_product_amount(scope(&x,WorkerAction::ReadDomain),sel,49).is_ok());
        let v=t.view();let r=s.stage_scoped_product_amount(scope(&s,WorkerAction::Stage),v.selection,v.old_amount,49,v.entry_sha256).unwrap();
        assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        let out=s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).unwrap();
        let mut expected=d.clone();expected["Player"]["ContainerInventories"]["12"]["Inventory"][0]["Amount"]=json!(49);
        assert_eq!(out,serde_json::to_vec(&expected).unwrap());
        for(k,v,error)in [("GridDefaultLayoutPath",json!("SceneLayouts/Unknown.json"),"PRODUCT_AMOUNT_LAYOUT_PATH_UNKNOWN"),
            ("GridDefaultLayoutPath",json!("SceneLayouts/../Unknown.json"),"PRODUCT_AMOUNT_LAYOUT_PATH"),
            ("GridDefaultLayoutType",json!("Meta.Other, Meta"),"PRODUCT_AMOUNT_LAYOUT_TYPE"),
            ("DefaultLayoutGridID",json!(4294967295u32),"PRODUCT_AMOUNT_LAYOUT_LOCAL_ID"),
            ("DefaultGridHashCode",json!("-4"),"PRODUCT_AMOUNT_LAYOUT_HASH_TYPE"),
            ("RemovedObjects",json!([1,1]),"PRODUCT_AMOUNT_LAYOUT_REMOVED_DUPLICATE")]{
            let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"][k]=v;verify(&q,error);
        }
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]["ModifiedObjects"]["9"]=json!({
            "ID":9,"ItemID":40001680,"State":{"Storage":{"ContainerInventoryID":12,"DefaultContainerInventoryData":"","DesignID":null,"UnlockKeyItemID":0,"UnlockLocId":""}}});
        verify(&q,"PRODUCT_AMOUNT_CHEST_DUPLICATE_LINK");
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]["ModifiedObjects"]["9"]=json!({
            "ID":9,"ItemID":40001680,"State":{"Storage":{"ContainerInventoryID":0,"DefaultContainerInventoryData":"template","DesignID":null,"UnlockKeyItemID":0,"UnlockLocId":""}}});
        verify(&q,"PRODUCT_AMOUNT_CHEST_TEMPLATE_ALIAS");
        let (p,a,id,item)=ix.iter().find_map(|(p,a)|a.grids.iter().find_map(|(id,g)|g.items.first().map(|i|(p,a,*id,*i)))).unwrap();
        let mut q=doc();q["Player"]["ListInventories"]["0"]["Inventory"]=json!({(item.to_string()):{"Amount":3,"Marker":"ItemMarker_None"}});
        q["World"]["GridCollection"]["DiffGrids"]["19"]=overlay(p,&a.kind,id);
        q["World"]["GridCollection"]["DiffGrids"]["19"]["RemovedObjects"]=json!([0]);
        let raw=serde_json::to_vec(&q).unwrap();let r=indexed_read::roots(&raw).unwrap();
        assert_eq!(scan_grids(&raw,r.world,item,None).err().unwrap().0,"PRODUCT_AMOUNT_LAYOUT_BASE_PLACEMENT");
        let g=ix.values().flat_map(|a|a.grids.values()).find(|g|!g.storage.is_empty()).unwrap();
        let (parent,cid,_)=g.storage[0];
        assert_eq!(layout_reference_excludes(g,30200000,Some((cid,parent))).unwrap_err().0,"PRODUCT_AMOUNT_LAYOUT_BASE_CHEST_ALIAS");
    }

    #[test]fn all_local_rows_include_indirect_child_placement_and_storage(){
        let ix=layout_index().unwrap();
        // Real packaged rows: absent in selected local row, present elsewhere
        // in same asset. Old single-row predicate would return Ok.
        let (path,asset,local,item)=ix.iter().find_map(|(p,a)|a.grids.iter().find_map(|(id,q)|
            a.grids.values().flat_map(|v|v.items.iter()).find(|i|!q.items.contains(i)).map(|i|(p,a,*id,*i)))).unwrap();
        assert!(layout_reference_excludes(asset.grids.get(&local).unwrap(),item,None).is_ok());
        assert_eq!(layout_asset_excludes(asset,item,None).unwrap_err().0,"PRODUCT_AMOUNT_LAYOUT_BASE_PLACEMENT");
        let mut d=doc();d["World"]["GridCollection"]["DiffGrids"]["19"]=json!({"ID":19,"GridDefaultLayoutPath":path,
            "GridDefaultLayoutType":asset.kind,"DefaultLayoutGridID":local,"DefaultGridHashCode":-4,
            "DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
        let raw=serde_json::to_vec(&d).unwrap();let r=indexed_read::roots(&raw).unwrap();
        assert_eq!(scan_grids(&raw,r.world,item,None).err().unwrap().0,"PRODUCT_AMOUNT_LAYOUT_BASE_PLACEMENT");
        let (path,asset,local,parent,cid)=ix.iter().find_map(|(p,a)|a.grids.iter().find_map(|(id,q)|
            a.grids.values().flat_map(|v|v.storage.iter()).find(|(parent,cid,_)|
                layout_reference_excludes(q,30200000,Some((*cid,*parent))).is_ok()).map(|(parent,cid,_)|(p,a,*id,*parent,*cid)))).unwrap();
        assert!(layout_reference_excludes(asset.grids.get(&local).unwrap(),30200000,Some((cid,parent))).is_ok());
        assert_eq!(layout_asset_excludes(asset,30200000,Some((cid,parent))).unwrap_err().0,"PRODUCT_AMOUNT_LAYOUT_BASE_CHEST_ALIAS");
        d["World"]["GridCollection"]["DiffGrids"]["19"]=json!({"ID":19,"GridDefaultLayoutPath":path,
            "GridDefaultLayoutType":asset.kind,"DefaultLayoutGridID":local,"DefaultGridHashCode":-4,
            "DefaultGridDataHashCode":6,"ModifiedObjects":{},"RemovedObjects":[]});
        let raw=serde_json::to_vec(&d).unwrap();let r=indexed_read::roots(&raw).unwrap();
        assert_eq!(scan_grids(&raw,r.world,30200000,Some((cid,parent))).err().unwrap().0,"PRODUCT_AMOUNT_LAYOUT_BASE_CHEST_ALIAS");
    }

    #[test]fn bounded_discovery_reuses_exact_eligible_and_epoch(){
        let d=chest_doc();let s=open(&d);let e=scope(&s,WorkerAction::ReadDomain);
        let (f,next,n)=s.discover_scoped_product_amount(e,"catalog0-furniture",0).unwrap();
        assert_eq!((f.len(),next,n),(1,None,1));assert_eq!(f[0].view().item_id,40000048);
        let (c,next,n)=s.discover_scoped_product_amount(e,"linked-crop-chest48",0).unwrap();
        assert_eq!((c.len(),next,n),(1,None,1));assert_eq!(c[0].view().old_amount,50);
        assert!(s.discover_scoped_product_amount(e,"linked-crop-chest48",2).is_err());
        assert!(s.discover_scoped_product_amount(e,"unknown",0).is_err());
        let mut q=d.clone();q["Player"]["ContainerInventories"]["12"]["Inventory"][0]["State"]=json!({});
        let t=open(&q);assert!(t.discover_scoped_product_amount(scope(&t,WorkerAction::ReadDomain),"linked-crop-chest48",0).unwrap().0.is_empty());
        let mut q=d.clone();q["World"]["GridCollection"]["DiffGrids"]["19"]=json!({"ID":19});
        let t=open(&q);assert!(t.discover_scoped_product_amount(scope(&t,WorkerAction::ReadDomain),"catalog0-furniture",0).unwrap().0.is_empty());
        let mut q=doc();let mut inventory=serde_json::Map::new();
        for row in pack().unwrap().0["profiles"]["catalog0Furniture"]["entries"].as_array().unwrap().iter().take(17){
            inventory.insert(row[0].as_i64().unwrap().to_string(),json!({"Amount":3,"Marker":"ItemMarker_None"}));
        }
        q["Player"]["ListInventories"]["0"]["Inventory"]=Value::Object(inventory);
        let t=open(&q);let x=scope(&t,WorkerAction::ReadDomain);
        let (rows,next,scanned)=t.discover_scoped_product_amount(x,"catalog0-furniture",0).unwrap();
        assert_eq!((rows.len(),next,scanned),(16,Some(16),16));
        let (rows,next,scanned)=t.discover_scoped_product_amount(x,"catalog0-furniture",16).unwrap();
        assert_eq!((rows.len(),next,scanned),(1,None,1));
        let v=c[0].view();s.stage_scoped_product_amount(scope(&s,WorkerAction::Stage),v.selection,v.old_amount,49,v.entry_sha256).unwrap();
        assert!(s.discover_scoped_product_amount(e,"linked-crop-chest48",0).is_err());
        assert!(s.discover_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),"linked-crop-chest48",0).is_err());
    }

    #[test]fn saved_grid_state_known_literal_and_typed_dependencies(){
        let check=|v:Value,item:i32|{let b=serde_json::to_vec(&v).unwrap();saved_grid_state(&b,Span{begin:0,end:b.len()},item,&mut 0)};
        for item in [40000048,30200000]{
            assert!(check(json!({"ItemList":{"Items":[1,2]}}),item).is_ok());
            assert!(check(json!({"SubGrid":{"DesignID":null,"GridID":12}}),item).is_ok());
            for v in [
                json!({"ItemList":{"Items":[item]}}),
                json!({"BlockerData":{"Stage":0,"Treasure":{"ItemID":item,"State":null}}}),
                json!({"StallData":{"CurrentSkinItemID":0,"UpgradeState":{},"ShopData":{"Slots":[{"Item":{"id":item,"amount":1}}]}}}),
                json!({"ItemAmountState":{"Amount":1,"AssignedPlayer":0,"State":{"LootPresentData":{"Items":[{"ItemID":item}]}}}}),
                json!({"BlockerData":{"Stage":0,"Treasure":{"ItemID":1,"State":{"LootPresentData":{"Items":[{"ItemID":item}]}}}}}),
                json!({"SubGrid":{"DesignID":null,"GridID":"12"}}),
                json!({"SubGrid":{"DesignID":null,"GridID":12,"Unknown":0}}),
                json!({"SubGrid":{"DesignID":null,"GridID":12},"Index":{"CurrentIndex":0}}),
                json!({"UnknownState":{}}),
                json!({"Index":{"CurrentIndex":item}}),
            ]{assert!(check(v,item).is_err());}
            let mut d=doc();d["World"]["GridCollection"]["Grids"]["7"]=json!({"ID":7,"GridDefaultLayoutPath":"","Objects":{"1":{"ID":1,"ItemID":1,"State":{"ItemList":{"Items":[item]}}}}});
            let b=serde_json::to_vec(&d).unwrap();let r=indexed_read::roots(&b).unwrap();
            assert_eq!(scan_grids(&b,r.world,item,None).err().unwrap().0,"PRODUCT_AMOUNT_STATE_ITEM_REFERENCE");
        }
    }
    #[test]fn unresolved_default_and_unlisted_item_fail_closed(){
        let mut d=doc();d["World"]["GridCollection"]["DiffGrids"]["1"]=json!({"ID":1});let s=open(&d);
        let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048};
        assert_eq!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,2).unwrap_err().0,"PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED");
        let mut d=doc();d["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]=json!({"Amount":3});let s=open(&d);
        assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000001},2).is_err());
    }
}
