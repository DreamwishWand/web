//! ACT916: opt-in product amount provider, fixed Steam626 catalog and
//! compiled definition projection. No fixture, caller-supplied pack, raw
//! command, general Writer, Apply or original overwrite authority.
//! Uses the existing ProductSession/lexical indexed scanner and ledger.
use super::*;
use serde_json::Value;
use std::sync::OnceLock;
const ELIG:&str=include_str!("../data/steam626-amount-packaged-candidates.json");
const DEP:&str=include_str!("../data/steam626-amount-dependency-projection.json");
const ELIG_SHA:&str="05a6bea5582232b27569dbb71f8666d7d60c11a35515d844d2f21b2ae557b23d";
const DEP_SHA:&str="78a1ba539b2e6f43182cea2c2ea35c9d10e51f27d4adbb8d4dbc6cce7f7dcd65";
static PACK:OnceLock<CoreResult<(Value,Value)>>=OnceLock::new();
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
fn subscribers(b:&[u8],player:Span,world:Span,top:Span,d:&Value,item:i32,furniture:bool)->CoreResult<()>{
    let mut refs=0usize;let mut nodes=0usize;let mut slots=0usize;
    excludes(&d["events"],item)?;
    let hist=f(b,top,"ConditionalEventHistory")?;
    for(k,_)in members(b,f(b,hist,"ActiveEvents")?,4096)?{need(key(&k)?>0,"PRODUCT_AMOUNT_EVENT_ID")?;}
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
                excludes(layers.get(ix).ok_or(denied("PRODUCT_AMOUNT_DUTY_LAYER"))?,item)?;
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
            // Event-only task progress is not replayed by this local edit.
            item_refs(b,f(b,o,"ItemIdsCollected")?,0,&mut refs)?;
        }}
    }
    Ok(())
}
#[derive(Clone,Copy)]struct Link{grid:u32,object:u32,record:Span,grid_span:Span}
fn scan_grids(b:&[u8],world:Span,item:i32,chest:Option<u32>)->CoreResult<Option<Link>>{
    let gc=f(b,world,"GridCollection")?;let mut count=0usize;let mut total=0usize;let mut link=None;let mut subgrid=std::collections::BTreeSet::new();
    let mut overlays=std::collections::BTreeSet::new();
    for (map,objects,diff) in [("Grids","Objects",false),("DiffGrids","ModifiedObjects",true)]{
        for(k,g)in members(b,f(b,gc,map)?,50000)?{
            count+=1;need(count<=50000,"PRODUCT_AMOUNT_GRID_BOUND")?;let gid=key(&k)?;need(n(b,g,"ID")?==gid,"PRODUCT_AMOUNT_GRID_ID")?;
            // Initial supported subset: no unresolved external layout which
            // could supply an effective placement or container alias.
            if diff{overlays.insert(gid);return reject("PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED");}
            need(strv(b,g,"GridDefaultLayoutPath")?.is_empty(),"PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED")?;
            for(k,o)in members(b,f(b,g,objects)?,16384)?{
                total+=1;need(total<=250000,"PRODUCT_AMOUNT_GRID_OBJECT_BOUND")?;let oid=key(&k)?;
                need(n(b,o,"ID")?==oid,"PRODUCT_AMOUNT_OBJECT_ID")?;
                let id=n(b,o,"ItemID")?;need(id<=i32::MAX as u32,"PRODUCT_AMOUNT_OBJECT_ITEM")?;
                if chest.is_none(){need(id!=item as u32,"PRODUCT_AMOUNT_PLACEMENT_TARGET")?;}
                let s=f(b,o,"State")?;if &b[s.begin..s.end]==b"null"{continue}
                let fs=members(b,s,128)?;
                for(k,v)in fs{
                    if k=="Storage"{
                        let cid=n(b,v,"ContainerInventoryID")?;
                        if Some(cid)==chest{
                            need(link.is_none(),"PRODUCT_AMOUNT_CHEST_DUPLICATE_LINK")?;
                            link=Some(Link{grid:gid,object:oid,record:o,grid_span:g});
                        }
                    }else if k=="SubGrid"{subgrid.insert(n(b,v,"GridID")?);}
                }
            }
        }
    }
    if let Some(l)=link{
        need(!subgrid.contains(&l.grid)&&!overlays.contains(&l.grid),"PRODUCT_AMOUNT_CHEST_SUBGRID")?;
    }
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
            let link=scan_grids(b,r.world,item,Some(container_id))?.ok_or(denied("PRODUCT_AMOUNT_CHEST_LINK"))?;
            check_parent(b,r.world,link,facts.parent_item_id,container_id)?;
            let mut budget=0;for x in [f(b,top,"ConditionalEventHistory")?,f(b,r.world,"MissionSlots")?,f(b,r.player,"AchievementsData")?]{address_refs(b,x,link.grid,link.object,&mut budget,0)?;}
            false
        }
        _=>return reject("PRODUCT_AMOUNT_PROFILE"),
    };
    subscribers(b,r.player,r.world,top,d,item,furniture)
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
    #[test]fn unknown_active_subscriber_denied(){
        let mut d=doc();d["Player"]["DutySlots"]["0"]=json!({"Slots":[{"State":"DutySlotState_OnGoing","DutyId":2119999999,"DifficultyLayer":0}]});
        let s=open(&d);let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048};
        assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,2).is_err());
    }
    #[test]fn unresolved_default_and_unlisted_item_fail_closed(){
        let mut d=doc();d["World"]["GridCollection"]["DiffGrids"]["1"]=json!({"ID":1});let s=open(&d);
        let sel=ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048};
        assert_eq!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,2).unwrap_err().0,"PRODUCT_AMOUNT_EFFECTIVE_DEFAULT_UNRESOLVED");
        let mut d=doc();d["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]=json!({"Amount":3});let s=open(&d);
        assert!(s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000001},2).is_err());
    }
}
