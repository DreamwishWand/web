//! ACT493: fixed Steam626 ordinary Vase ADD effective binder.
//! Existing ProductSession / physical target / shared lexical parser / ledger.
//! Compiled, exact reviewed normal-retail definitions only; no caller facts,
//! general placement, entitlement grant, runtime event replay, or export route.
use super::*;
use std::collections::BTreeMap;
use std::sync::OnceLock;
#[path="steam626_vase_geometry.rs"]
mod geometry;
#[path="placement_applicable.rs"]
mod applicable;
const GEOMETRY:&str=include_str!("../data/steam626-vase-geometry-quota.jsonl");
const SUPPLEMENT:&[u8]=include_bytes!("../data/steam626-placement-applicable-supplement.json");
static GEOMETRY_PACK:OnceLock<CoreResult<geometry::GeometryPack>>=OnceLock::new();
const MAX_NODES:usize=1_000_000;
const MAX_SLICE:usize=2*1024*1024;
fn geometry_pack()->CoreResult<&'static geometry::GeometryPack>{
    GEOMETRY_PACK.get_or_init(||geometry::load(GEOMETRY).map_err(denied)).as_ref().map_err(|e|*e)
}
fn bounded_value(b:&[u8],s:Span)->CoreResult<Value>{
    need(s.end.checked_sub(s.begin).is_some_and(|n|n<=MAX_SLICE),"VASE_BINDER_SLICE_BOUND")?;
    serde_json::from_slice(b.get(s.begin..s.end).ok_or(denied("VASE_BINDER_SPAN"))?)
        .map_err(|_|denied("VASE_BINDER_VALUE"))
}
fn projection(b:&[u8],s:Span,keys:&[&str])->CoreResult<Value>{
    let mut m=serde_json::Map::new();
    for k in keys{m.insert((*k).into(),bounded_value(b,f(b,s,k)?)?);}
    Ok(Value::Object(m))
}
#[derive(Default)]
struct Incoming{
    roots:BTreeMap<u32,u32>,parents:BTreeMap<u32,u32>,nodes:usize,pairs:usize,
}
fn bump(m:&mut BTreeMap<u32,u32>,id:u32)->CoreResult<()>{
    need(m.len()<50_000||m.contains_key(&id),"VASE_BINDER_ALIAS_BOUND")?;
    let n=m.entry(id).or_insert(0);*n=n.checked_add(1).ok_or(denied("VASE_BINDER_ALIAS_COUNT"))?;Ok(())
}
// Same accepted lexical span grammar as COMP03 current alias/reference
// walk. Count all saved GridIDs/SubGrid incoming edges, and reject a
// prospective composite address even in an otherwise preserved subtree.
// No secondary decoded document, no guessed grid IDs, no string search.
fn walk(b:&[u8],s:Span,gid:u32,next:u32,a:&mut Incoming,depth:usize)->CoreResult<()>{
    a.nodes+=1;need(a.nodes<=MAX_NODES&&depth<=64,"VASE_BINDER_REFERENCE_BOUND")?;
    match b.get(s.begin){
        Some(b'{')=>{
            let mut pos=s.begin+1;let mut fields:[Option<Span>;6]=[None;6];
            while let Some((k,v))=next_object_member(b,s,&mut pos)?{
                if k=="GridIDs"{
                    for x in array(b,v,4096)?{
                        let id=u32::try_from(number(b,x)?).map_err(|_|denied("VASE_BINDER_ROOT_ID"))?;
                        bump(&mut a.roots,id)?;
                    }
                }else if k=="SubGrid"&&b.get(v.begin..v.end)!=Some(&b"null"[..]){
                    let id=n(b,v,"GridID")?;bump(&mut a.parents,id)?;
                }
                let ix=match k.as_str(){"GridID"=>Some(0),"GridId"=>Some(1),
                    "GridObjectID"=>Some(2),"GridObjectId"=>Some(3),"ObjectID"=>Some(4),"ObjectId"=>Some(5),_=>None};
                if let Some(i)=ix{need(fields[i].replace(v).is_none(),"VASE_BINDER_REF_DUPLICATE")?;}
                walk(b,v,gid,next,a,depth+1)?;
            }
            let gs=fields[..2].iter().filter(|x|x.is_some()).count();
            let os=fields[2..].iter().filter(|x|x.is_some()).count();
            if gs>0&&os>0{
                need(gs==1&&os==1,"VASE_BINDER_REF_AMBIGUOUS")?;
                let (g,o)=match fields{
                    [Some(g),None,Some(o),None,None,None]|
                    [None,Some(g),None,Some(o),None,None]|
                    [Some(g),None,None,None,Some(o),None]|
                    [None,Some(g),None,None,None,Some(o)]=>(g,o),
                    _=>return reject("VASE_BINDER_REF_SPELLING"),
                };
                let g=u32::try_from(number(b,g)?).map_err(|_|denied("VASE_BINDER_REF_UINT"))?;
                let o=u32::try_from(number(b,o)?).map_err(|_|denied("VASE_BINDER_REF_UINT"))?;
                a.pairs+=1;need(g!=gid||(o!=0&&o!=next),"VASE_BINDER_PROSPECTIVE_REFERENCE")?;
            }
        },
        Some(b'[')=>for x in array(b,s,250_000)?{walk(b,x,gid,next,a,depth+1)?;},
        Some(_)=>{},None=>return reject("VASE_BINDER_REF_SPAN"),
    }Ok(())
}
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct VaseEffectiveTarget{
    physical:VasePhysicalTarget,quota:geometry::QuotaBound,
    scanned_pairs:usize,projected_sha:[u8;32],
}
fn projected(b:&[u8],edits:&[Replacement])->CoreResult<[u8;32]>{
    let mut order:Vec<&Replacement>=edits.iter().collect();order.sort_by_key(|e|e.span.begin);
    let mut h=Sha256::new();let mut pos=0;
    for e in order{
        need(e.span.begin>=pos&&b.get(e.span.begin..e.span.end)==Some(e.old.as_slice()),"VASE_BINDER_RAW_CAS")?;
        h.update(&b[pos..e.span.begin]);h.update(&e.new);pos=e.span.end;
    }
    h.update(&b[pos..]);Ok(h.finalize().into())
}
impl ProductSession{
    /// Core-minted opaque same-session placement target. The physical
    /// definition/positive ordinary Catalog0 debit/marker/stock checks remain
    /// intact. This adds current floor/occupancy/whole Village quota graph,
    /// explicit prospective references and both common + placement-specific
    /// subscriber contracts. No UI supplied proof or private fixture pin.
    #[allow(dead_code)]
    pub(crate) fn mint_vase_effective_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)
        ->CoreResult<VaseEffectiveTarget>{
        let t=self.mint_vase_physical_target(e,gid,x,y)?;
        let edits=self.collect_vase_exact3_candidate(&t)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"VASE_BINDER_EPOCH")?;
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let begin=indexed_read::skip_ws(b,0);let top=Span{begin,end:indexed_read::value_end(b,begin)?};
        let (_,d)=pack()?;let p=geometry_pack()?;
        let village=array(b,f(b,r.world,"Villages")?,256)?.first().copied().ok_or(denied("VASE_BINDER_VILLAGE"))?;
        let v=projection(b,village,&["VillageObjectLimitName","HighEndVillageObjectLimitName","BoughtObjectLimit","Areas"])?;
        let extra=bounded_value(b,f(b,r.world,"ExtraLimitObject")?)?;
        let gc=f(b,r.world,"GridCollection")?;
        let mut grids=BTreeMap::new();let mut diff=std::collections::BTreeSet::new();
        for(k,g)in members(b,f(b,gc,"Grids")?,50_000)?{
            let id=key(&k)?;need(n(b,g,"ID")?==id&&grids.insert(id,g).is_none(),"VASE_BINDER_GRID_ID")?;
        }
        for(k,g)in members(b,f(b,gc,"DiffGrids")?,50_000)?{
            let id=key(&k)?;need(n(b,g,"ID")?==id&&diff.insert(id)&&!grids.contains_key(&id),"VASE_BINDER_OVERLAY_ID")?;
        }
        let mut incoming=Incoming::default();walk(b,top,gid,t.next,&mut incoming,0)?;
        let selected=bounded_value(b,*grids.get(&gid).ok_or(denied("VASE_BINDER_GRID"))?)?;
        geometry::check_local_pose(p,EXACT_STEAM,626,&selected,gid,x,y).map_err(denied)?;
        let quota=geometry::check_village_quota(p,EXACT_STEAM,626,&v,&extra,gid,|id|{
            let span=*grids.get(&id).ok_or("VASE_BINDER_QUOTA_GRID")?;
            let grid=bounded_value(b,span).map_err(|e|e.0)?;
            Ok(geometry::GridObservation{grid,root_refs:*incoming.roots.get(&id).unwrap_or(&0),
                parent_refs:*incoming.parents.get(&id).unwrap_or(&0),overlay:diff.contains(&id)})
        }).map_err(denied)?;
        // Existing amount predicates resolve exact active item/condition
        // references. Placement supplement adds operation-specific kinds,
        // area/recurring/treasure/snippet and offline-only event policy.
        // Do not weaken either guard or treat the supplement as a grant.
        subscribers(b,r.player,r.world,top,d,ITEM as i32,true)?;
        let player=projection(b,r.player,&["AchievementsData","DutySlots","BattlePassStates"])?;
        let world=projection(b,r.world,&["MissionSlots","RecurringEvents","TimeLostTreasures","NextTimeLostTreasureID","Snippets","NextSnippetID"])?;
        applicable::check_supplement(EXACT_STEAM,DEP.as_bytes(),SUPPLEMENT,
            applicable::PlacementScope::VaseAdd,&player,&world).map_err(denied)?;
        let projected_sha=projected(b,&edits)?;
        Ok(VaseEffectiveTarget{physical:t,quota,scanned_pairs:incoming.pairs,projected_sha})
    }
    /// Internal typed Stage, not exposed in WASM/Pages. Rebind all effective
    /// predicates and exact target/epoch from the immutable current Session,
    /// then use the one existing atomic semantic ledger and output lineage.
    #[allow(dead_code)]
    pub(crate) fn stage_vase_effective_add(&self,e:WorkerEnvelope,t:&VaseEffectiveTarget)
        ->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"VASE_BINDER_STAGE_ACTION")?;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};
        let v=&t.physical;
        let now=self.mint_vase_effective_target(read,v.grid,v.x,v.y)?;
        need(now==*t,"VASE_BINDER_TARGET_CAS")?;
        let edits=self.collect_vase_exact3_candidate(&now.physical)?;
        need(edits.len()==3,"VASE_BINDER_EXACT3")?;
        self.commit_semantic_replacements(e,edits,3,Some(now.projected_sha))
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn pose()->(u32,u32){
        let p=geometry_pack().unwrap();
        (4..=492).step_by(2).flat_map(|x|(4..=342).step_by(2).map(move|y|(x,y)))
            .find(|(x,y)|geometry::floor_halo(p,*x,*y).is_ok()).unwrap()
    }
    fn doc(x:u32,y:u32)->Value{
        let ox=if x<250{480}else{2};let oy=if y<175{330}else{2};
        json!({"GameInfo":{"Version":626},"World":{
          "Villages":[{"Areas":{"6":{"Unlocked":true,"GridIDs":[7]}},
            "VillageObjectLimitName":"Village04ObjectLimit","HighEndVillageObjectLimitName":"HighEndVillageObjectLimit",
            "BoughtObjectLimit":{"UniqueLimit":0,"InstanceLimit":0,"Exclusions":[],"SpecificItemLimits":[]}}],
          "FloatingIslands":{},"ExtraLimitObject":false,
          "GridCollection":{"Grids":{"7":{"ID":7,"GridDataPath":GRID_DATA,"GridDefaultLayoutPath":"",
            "TessellationFactor":2,"NextGridObjectID":9,"Objects":{"4":{"ID":4,"ItemID":ITEM,
            "X":ox,"Y":oy,"Orientation":"GridOrientation_Up","State":null}}}},"DiffGrids":{}},
          "MissionSlots":{},"RecurringEvents":{},"TimeLostTreasures":{},"NextTimeLostTreasureID":1,
          "Snippets":{},"NextSnippetID":0},
          "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},
            "Inventory":{"40000066":{"Amount":3,"Marker":"ItemMarker_None"}}}},
            "ContainerInventories":{},"AchievementsData":[],"EvolveStatesProfile":{"EvolveProgressState":{}},
            "DutySlots":{},"BattlePassStates":{"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}}},
          "ConditionalEventHistory":{"ActiveEvents":{}},"Unknown":{"keep":[1,2,3]}})
    }
    fn open(d:&Value)->ProductSession{
        let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),
            schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s
    }
    fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{
        let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}
    }
    #[test]
    fn vase_effective_exact3_same_session_atomic(){
        let(x,y)=pose();let mut d=doc(x,y);let s=open(&d);let before=s.receipt().unwrap();
        let e=env(&s,WorkerAction::ReadDomain);let t=s.mint_vase_effective_target(e,7,x,y).unwrap();
        assert_eq!(s.receipt().unwrap(),before);
        let foreign=open(&d);assert!(foreign.stage_vase_effective_add(env(&foreign,WorkerAction::Stage),&t).is_err());
        assert!(s.stage_vase_effective_add(e,&t).is_err());
        let st=env(&s,WorkerAction::Stage);let result=s.stage_vase_effective_add(st,&t).unwrap();
        assert_eq!(result.exact_field_changed_count,3);assert_eq!(result.staged_decoded_sha256,t.projected_sha);
        assert!(!result.product_writer_authorized);assert!(s.stage_vase_effective_add(st,&t).is_err());
        s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
        let ex=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();
        assert!(s.take_typed_semantic_decoded_once(ex).is_err());
        d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]=json!({
            "ID":9,"ItemID":ITEM,"X":x,"Y":y,"Orientation":"GridOrientation_Up","State":null});
        d["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(10);
        d["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(2);
        assert_eq!(out,serde_json::to_vec(&d).unwrap());
    }
    #[test]
    fn vase_effective_current_denials(){
        let(x,y)=pose();let d=doc(x,y);
        for i in 0..10{
            let mut q=d.clone();match i{
                0=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["X"]=json!(x),
                1=>q["Unknown"]["GridIDs"]=json!([7]),
                2=>q["Unknown"]["SubGrid"]=json!({"GridID":7}),
                3=>q["Unknown"]["ref"]=json!({"GridId":7,"ObjectId":9}),
                4=>q["World"]["Villages"][0]["BoughtObjectLimit"]["UniqueLimit"]=json!(1),
                5=>q["World"]["ExtraLimitObject"]=json!("false"),
                6=>q["World"]["RecurringEvents"]["1"]=json!({"Unknown":{"RecurringEventItemID":1}}),
                7=>q["World"]["Snippets"]["1"]=json!({}),
                8=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["State"]=json!({"Unknown":{}}),
                _=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(1),
            }
            if i==0{q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["Y"]=json!(y);}
            let s=open(&q);let before=s.receipt().unwrap();
            assert!(s.mint_vase_effective_target(env(&s,WorkerAction::ReadDomain),7,x,y).is_err(),"mode {i}");
            assert_eq!(s.receipt().unwrap(),before);
        }
    }
}
