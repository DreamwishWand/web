//! ACT493 Steam626 ordinary Vase ADD physical target and exact3 collector.
//! This is a Core-owned *candidate*, not an eligibility or Stage capability.
//! Installed geometry/limits, applicable typed subscribers/rights and
//! explicit-reference closure must be bound before an exposed Stage.
use super::*;
use serde_json::json;
#[path="grid_append.rs"]
mod grid_append;
#[path="product_vase_effective.rs"]
mod product_vase_effective;
const ITEM:u32=40000066;
const SWITCH626_BID:&str="9A239D3DB569756D";
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
enum VaseBuild{Steam626,Switch626}
impl VaseBuild{
    fn verify(self,s:&ProductSession)->CoreResult<()>{
        match self{
            Self::Steam626=>build_check(s),
            Self::Switch626=>{let b=&s.native_source_build;need(b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&b.build_id==SWITCH626_BID&&b.schema==626&&b.externally_attested,"VASE_PRODUCT_SWITCH626_BUILD")}
        }
    }
    fn contract(self)->&'static str{match self{Self::Steam626=>"wand.worker.steam626.scoped-vase-add@1",Self::Switch626=>"wand.worker.switch626.scoped-vase-add@1"}}
}
const DEF:&str="60f840fa471e3678b5f7a018466d150882ad7bddaece6ada9a86327fd1c0607a";
const GRID_DATA:&str="GridData/Villages/Village04-DarkLevel-GridData.json";
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct VasePhysicalTarget{
    scope:WorkerEnvelope, build:VaseBuild, stock:CoreExistingAmountTarget,
    grid:u32,x:u32,y:u32,next:u32,count:usize,
    area_sha:[u8;32],grid_sha:[u8;32],objects_sha:[u8;32],counter_sha:[u8;32],
}
fn digest(b:&[u8],s:Span)->CoreResult<[u8;32]>{
    Ok(sha(b.get(s.begin..s.end).ok_or(denied("VASE_PRODUCT_SPAN"))?))
}
fn selected_grid(b:&[u8],world:Span,gid:u32)->CoreResult<(Span,Span)>{
    let villages=array(b,f(b,world,"Villages")?,256)?;
    let mut area=None;let mut hits=0usize;
    for (vi,v) in villages.into_iter().enumerate(){
        for(k,a)in members(b,f(b,v,"Areas")?,4096)?{
            let aid=key(&k)?;
            let ids=array(b,f(b,a,"GridIDs")?,4096)?;
            for i in &ids{
                let g=number(b,*i)?;need(g<=u32::MAX as u64,"VASE_PRODUCT_ROOT_ID")?;
                if g==gid as u64{
                    hits+=1;
                    need(vi==0&&aid==6&&ids.len()==1&&boolean(b,a,"Unlocked")?,"VASE_PRODUCT_ROOT")?;
                    area=Some(a);
                }
            }
        }
    }
    need(hits==1,"VASE_PRODUCT_ROOT_ALIAS")?;
    // FloatingIsland namespaces cannot grant a Village root. The full
    // effective parent/reference closure is a distinct later predicate.
    for(k,a)in members(b,f(b,world,"FloatingIslands")?,4096)?{
        need(key(&k)?==n(b,a,"SceneItemId")?,"VASE_PRODUCT_ISLAND_ID")?;
        for i in array(b,f(b,a,"GridIDs")?,4096)?{
            let g=number(b,i)?;need(g<=u32::MAX as u64&&g!=gid as u64,"VASE_PRODUCT_ROOT_ALIAS")?;
        }
    }
    let gc=f(b,world,"GridCollection")?;
    let mut selected=None;
    for(k,g)in members(b,f(b,gc,"Grids")?,50000)?{
        let id=key(&k)?;need(id==n(b,g,"ID")?,"VASE_PRODUCT_GRID_ID")?;
        if id==gid{selected=Some(g);}
    }
    for(k,g)in members(b,f(b,gc,"DiffGrids")?,50000)?{
        let id=key(&k)?;need(id==n(b,g,"ID")?&&id!=gid,"VASE_PRODUCT_OVERLAY")?;
    }
    let g=selected.ok_or(denied("VASE_PRODUCT_GRID"))?;
    need(strv(b,g,"GridDataPath")?==GRID_DATA&&strv(b,g,"GridDefaultLayoutPath")?.is_empty()
        &&n(b,g,"TessellationFactor")?==2,"VASE_PRODUCT_GRID_DEFINITION")?;
    Ok((area.ok_or(denied("VASE_PRODUCT_ROOT"))?,g))
}
impl ProductSession{
    /// Same-session physical observation, using the existing amount target
    /// and installed catalog pack. No caller-supplied definition/receipt,
    /// raw offsets, expected-output hash or authority accepted.
    #[allow(dead_code)]
    pub(crate) fn mint_vase_physical_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)
        ->CoreResult<VasePhysicalTarget>{
        self.mint_vase_physical_for(VaseBuild::Steam626,e,gid,x,y)
    }
    fn mint_vase_physical_for(&self,build:VaseBuild,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<VasePhysicalTarget>{
        build.verify(self)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1,"VASE_PRODUCT_FRESH_WORKER")?;
        need(gid>0&&x%2==0&&y%2==0&&x.checked_add(2).is_some_and(|z|z<=500)
            &&y.checked_add(2).is_some_and(|z|z<=350),"VASE_PRODUCT_POSE_BOUNDS")?;
        let (a,_)=pack()?;
        let entries=a["profiles"]["catalog0Furniture"]["entries"].as_array().ok_or(denied("VASE_PRODUCT_PACK"))?;
        let mut rows=entries.iter().filter(|r|r[0].as_u64()==Some(ITEM as u64));
        need(rows.next().is_some_and(|r|r[1]==DEF)&&rows.next().is_none(),"VASE_PRODUCT_DEFINITION")?;
        let stock=observe_existing_amount(self,&e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:ITEM})?;
        let v=stock.view();need(v.item_id==ITEM as i32&&v.compatible_item_type==ExistingAmountItemType::Furniture
            &&v.old_amount>=2,"VASE_PRODUCT_STOCK")?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;
        let lists=f(b,roots.player,"ListInventories")?;
        let mut matched=0usize;
        for(k,r)in members(b,lists,4096)?{
            let id=key(&k)?;need(id==n(b,r,"ID")?,"VASE_PRODUCT_ROUTE_ID")?;
            if let Some(s)=opt(b,f(b,r,"Inventory")?,&ITEM.to_string())?{
                matched+=1;need(id==0&&strv(b,s,"Marker")?=="ItemMarker_None"&&
                    digest(b,s)?==v.entry_sha256,"VASE_PRODUCT_ROUTE_OR_MARKER")?;
            }
        }
        need(matched==1,"VASE_PRODUCT_ROUTE")?;
        physical_totals(b,roots.player,ITEM as i32,None,v.old_amount)?;
        let (area,g)=selected_grid(b,roots.world,gid)?;
        let counter=f(b,g,"NextGridObjectID")?;
        let next=n(b,g,"NextGridObjectID")?;
        need(next>0&&next.checked_add(1).is_some_and(|z|z<=i32::MAX as u32),"VASE_PRODUCT_COUNTER")?;
        let objs=f(b,g,"Objects")?;
        let records=members(b,objs,16384)?;need(!records.is_empty(),"VASE_PRODUCT_EMPTY_MAP")?;
        for(k,o)in &records{
            let id=key(k)?;need(id<next&&id==n(b,*o,"ID")?,"VASE_PRODUCT_OBJECT_ID")?;
            need(n(b,*o,"ItemID")?>0,"VASE_PRODUCT_OBJECT_ITEM")?;
            let ox=leaf(b,f(b,*o,"X")?)?.as_f64().ok_or(denied("VASE_PRODUCT_OBJECT_POSE"))?;
            let oy=leaf(b,f(b,*o,"Y")?)?.as_f64().ok_or(denied("VASE_PRODUCT_OBJECT_POSE"))?;
            need(ox.is_finite()&&oy.is_finite()&&(ox!=x as f64||oy!=y as f64),"VASE_PRODUCT_OCCUPIED_ANCHOR")?;
            f(b,*o,"State")?;
        }
        // Reuse existing typed event-state parser and composite address
        // walker for known saved Spawn paths. Other affected/current roots,
        // effective geometry and active definition scope are not implied.
        let begin=indexed_read::skip_ws(b,0);let top=Span{begin,end:indexed_read::value_end(b,begin)?};
        let hist=f(b,top,"ConditionalEventHistory")?;
        saved_event_states(b,f(b,hist,"ActiveEvents")?)?;
        let mut budget=0;
        address_refs(b,hist,gid,next,&mut budget,0)?;
        Ok(VasePhysicalTarget{scope:e,build,stock,grid:gid,x,y,next,count:records.len(),
            area_sha:digest(b,area)?,grid_sha:digest(b,g)?,objects_sha:digest(b,objs)?,counter_sha:digest(b,counter)?})
    }
    /// Build the exact three raw replacements but never commit them here.
    /// The eventual authorized Stage must bind effective predicates and
    /// repeat this observation under the current session epoch.
    #[allow(dead_code)]
    fn collect_vase_exact3_candidate(&self,t:&VasePhysicalTarget)->CoreResult<Vec<Replacement>>{
        need(self.mint_vase_physical_for(t.build,t.scope,t.grid,t.x,t.y)?==*t,"VASE_PRODUCT_TARGET_CAS")?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;
        let (_,g)=selected_grid(b,roots.world,t.grid)?;
        let objs=f(b,g,"Objects")?;let counter=f(b,g,"NextGridObjectID")?;
        let record=json!({"ID":t.next,"ItemID":ITEM,"X":t.x,"Y":t.y,"Orientation":"GridOrientation_Up","State":null});
        let append=Replacement{span:Span{begin:objs.end-1,end:objs.end},old:b"}".to_vec(),new:grid_append::payload(&[record])?};
        let bump=Replacement{span:counter,old:b[counter.begin..counter.end].to_vec(),
            new:t.next.checked_add(1).ok_or(denied("VASE_PRODUCT_COUNTER"))?.to_string().into_bytes()};
        let (_,entry)=inventory_amount_entry(b,roots.player,0,ITEM)?;
        let old=t.stock.view().old_amount;
        let debit=validate_old_amount(b,f(b,entry,"Amount")?,old,old-1)?;
        Ok(vec![append,bump,debit])
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{
        "Villages":[{"Areas":{"6":{"Unlocked":true,"GridIDs":[7]}}}],"FloatingIslands":{},
        "GridCollection":{"Grids":{"7":{"ID":7,"GridDataPath":GRID_DATA,"GridDefaultLayoutPath":"",
            "TessellationFactor":2,"NextGridObjectID":9,"Objects":{"4":{"ID":4,"ItemID":40000001,
                "X":2,"Y":2,"Orientation":"GridOrientation_Up","State":null}}}},"DiffGrids":{}}},
        "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},
            "Inventory":{"40000066":{"Amount":3,"Marker":"ItemMarker_None"}}}},"ContainerInventories":{}},
        "ConditionalEventHistory":{"ActiveEvents":{}},"Unknown":{"preserve":true}})}
    fn open(d:&Value)->ProductSession{
        let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap();
        s.worker_bound=true;s
    }
    fn env(s:&ProductSession)->WorkerEnvelope{
        let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
    }
    #[test]
    fn vase_current_candidate_exact3_no_authority(){
        let d=doc();let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();
        let t=s.mint_vase_physical_target(e,7,8,8).unwrap();
        let mut edits=s.collect_vase_exact3_candidate(&t).unwrap();assert_eq!(edits.len(),3);
        let mut out=s.decoded.to_vec();edits.sort_by_key(|x|x.span.begin);
        for r in edits.iter().rev(){assert_eq!(&out[r.span.begin..r.span.end],r.old.as_slice());out.splice(r.span.begin..r.span.end,r.new.iter().copied());}
        validate_entire_document(&out,626).unwrap();
        let mut expected=d.clone();expected["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]=json!({
            "ID":9,"ItemID":ITEM,"X":8,"Y":8,"Orientation":"GridOrientation_Up","State":null});
        expected["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(10);
        expected["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(2);
        assert_eq!(out,serde_json::to_vec(&expected).unwrap());
        assert_eq!(s.receipt().unwrap(),before);
        assert!(open(&d).collect_vase_exact3_candidate(&t).is_err());
        assert!(s.mint_vase_physical_target(WorkerEnvelope{expected_revision:1,..e},7,8,8).is_err());
        assert!(s.mint_vase_physical_target(WorkerEnvelope{action:WorkerAction::Stage,..e},7,8,8).is_err());
        assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..e}).is_err());
        s.close().unwrap();assert!(s.collect_vase_exact3_candidate(&t).is_err());
    }
    #[test]
    fn vase_current_candidate_physical_denials(){
        let d=doc();
        for i in 0..15{
            let mut q=d.clone();
            match i{
                0=>q["World"]["Villages"][0]["Areas"]["6"]["Unlocked"]=json!(false),
                1=>q["World"]["Villages"][0]["Areas"]["5"]=json!({"Unlocked":true,"GridIDs":[7]}),
                2=>q["World"]["FloatingIslands"]["15"]=json!({"SceneItemId":15,"GridIDs":[7]}),
                3=>q["World"]["GridCollection"]["Grids"]["8"]=json!({"ID":7}),
                4=>q["World"]["GridCollection"]["DiffGrids"]["8"]=json!({"ID":7}),
                5=>q["World"]["GridCollection"]["Grids"]["7"]["GridDefaultLayoutPath"]=json!("unknown"),
                6=>q["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(4),
                7=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["X"]=json!(8),
                8=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(1),
                9=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Marker"]=json!("unknown"),
                10=>q["Player"]["ListInventories"]["1"]=json!({"ID":1,"Inventory":{"40000066":{"Amount":1}}}),
                11=>q["ConditionalEventHistory"]["ActiveEvents"]["1"]=json!({"SpawnState":{"SpawnedObjects":[{"GridID":7,"GridObjectID":9}]}}),
                12=>q["ConditionalEventHistory"]["ActiveEvents"]["1"]=json!({"Unknown":{}}),
                13=>q["World"]["GridCollection"]["Grids"]["7"]["GridDataPath"]=json!("other"),
                _=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["ID"]=json!(5),
            }
            if i==7{q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["Y"]=json!(8);}
            let s=open(&q);let before=s.receipt().unwrap();
            assert!(s.mint_vase_physical_target(env(&s),7,8,8).is_err(),"{i}");
            assert_eq!(s.receipt().unwrap(),before);
        }
        let s=open(&d);
        for (g,x,y)in [(8,8,8),(7,7,8),(7,8,351),(7,500,8)]{assert!(s.mint_vase_physical_target(env(&s),g,x,y).is_err());}
        let mut q=d.clone();q["ConditionalEventHistory"]["ActiveEvents"]["1"]=json!({"SpawnState":{"SpawnedObjects":[{"GridID":8,"GridObjectID":9}]}});
        let s=open(&q);assert!(s.mint_vase_physical_target(env(&s),7,8,8).is_ok());
    }
}
