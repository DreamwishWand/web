//! Shared placement reference closure for the existing lexical ProductSession.
//! World aliases and preset-local grid endpoints are distinct typed namespaces.
//! No saved data, second reader, provider authority or edit permission.
use super::*;
use std::collections::BTreeMap;
const MAX_NODES:usize=1_000_000;
#[derive(Default)]
pub(super) struct Incoming{
    pub(super) roots:BTreeMap<u32,u32>,pub(super) parents:BTreeMap<u32,u32>,
    pub(super) pairs:usize,nodes:usize,
}
impl Incoming{
    pub(super) fn root(&self,id:u32)->u32{*self.roots.get(&id).unwrap_or(&0)}
    pub(super) fn parent(&self,id:u32)->u32{*self.parents.get(&id).unwrap_or(&0)}
}
fn bump(m:&mut BTreeMap<u32,u32>,id:u32)->CoreResult<()>{
    need(m.len()<50_000||m.contains_key(&id),"PLACEMENT_REF_MAP_BOUND")?;
    let x=m.entry(id).or_insert(0);*x=x.checked_add(1).ok_or(denied("PLACEMENT_REF_COUNT"))?;Ok(())
}
fn uint(b:&[u8],s:Span)->CoreResult<u32>{u32::try_from(number(b,s)?).map_err(|_|denied("PLACEMENT_REF_UINT"))}
fn canonical(k:&str)->bool{k.parse::<u32>().is_ok_and(|n|n.to_string()==k)}
// A JSON key named "[]" is never an array segment.
#[derive(Debug,PartialEq,Eq)]
enum Segment{Key(String),Element}
use Segment::{Key,Element};
fn k(s:&Segment,w:&str)->bool{matches!(s,Key(x) if x==w)}
fn ck(s:&Segment)->bool{matches!(s,Key(x) if canonical(x))}
fn building_map(p:&[Segment])->bool{p.len()==2&&k(&p[0],"World")&&k(&p[1],"BuildingInfos")}
fn building(p:&[Segment])->bool{p.len()==3&&building_map(&p[..2])&&ck(&p[2])}
fn house_rooms(p:&[Segment])->bool{
    p.len()==6&&k(&p[0],"World")&&k(&p[1],"PlayerHouses")&&p[2]==Element&&k(&p[3],"Floors")&&p[4]==Element&&k(&p[5],"Rooms")
}
fn room(p:&[Segment])->bool{
    (p.len()==4&&building(&p[..3])&&k(&p[3],"Room"))||
    (p.len()==7&&house_rooms(&p[..6])&&ck(&p[6]))
}
fn preset(p:&[Segment])->bool{p.len()==4&&k(&p[0],"World")&&k(&p[1],"DecorationPresets")&&p[2]==Element&&k(&p[3],"GridCollection")}
fn exact_array_owner(p:&[Segment])->bool{
    (p.len()==2&&k(&p[0],"World")&&(k(&p[1],"DecorationPresets")||k(&p[1],"PlayerHouses")))||
    (p.len()==4&&k(&p[0],"World")&&k(&p[1],"PlayerHouses")&&p[2]==Element&&k(&p[3],"Floors"))
}
fn validate_owner(b:&[u8],s:Span,p:&[Segment])->CoreResult<()>{
    if exact_array_owner(p)||world_puzzles(p)||realm_puzzles(p){need(b.get(s.begin)==Some(&b'['),"PLACEMENT_ARRAY_OWNER")?;}
    if building_map(p)||house_rooms(p){
        for (key,_) in members(b,s,50_000)?{need(canonical(&key),"PLACEMENT_OWNER_KEY")?;}
    }
    if building(p){
        let grid=opt(b,s,"GridIDs")?;let room=opt(b,s,"Room")?;
        need(grid.is_some()!=room.is_some(),"PLACEMENT_BUILDING_ONEOF")?;
    }
    if room(p){
        uint(b,f(b,s,"FloorGridID")?)?;
        for (key,v) in members(b,f(b,s,"WallGridIDs")?,4)?{
            need(canonical(&key)&&key.parse::<u32>().is_ok_and(|n|n<4),"PLACEMENT_ROOM_WALL_KEY")?;uint(b,v)?;
        }
    }
    Ok(())
}
// E2433: installed DreamProductions local puzzle namespace. The two
// definitions and GridData paths are static game data, never saved IDs.
const DREAM:&str="Worlds!InsideOut!DreamProductions";
const DREAM_LAYOUT:&str="SceneLayouts/Realms/InsideOut/DreamProductions/InsideOut-DreamProductions-DefaultLayout.json";
const PUZZLES:[((u32,u32,u32),u32,&str);2]=[
    ((2070001289,2,1),0,"GridData/Worlds/InsideOut_DreamProductions_Stage-GridData.json"),
    ((2070001290,13,0),2,"GridData/Worlds/InsideOut_DreamProductions_Puzzle02-GridData.json"),
];
fn world_puzzles(p:&[Segment])->bool{p.len()==2&&k(&p[0],"World")&&k(&p[1],"SceneryPuzzles")}
fn realm_puzzles(p:&[Segment])->bool{p.len()==4&&k(&p[0],"World")&&k(&p[1],"Realms")&&k(&p[3],"SceneryPuzzles")}
fn puzzle_row(p:&[Segment])->bool{
    p.last()==Some(&Element)&&(world_puzzles(&p[..p.len()-1])||realm_puzzles(&p[..p.len()-1]))
}
fn local_puzzle_row(p:&[Segment])->bool{p.len()==5&&puzzle_row(p)&&k(&p[2],DREAM)}
type PuzzleKey=(u32,u32,u32);
fn puzzle(b:&[u8],s:Span)->CoreResult<(PuzzleKey,u32,u32)>{
    let m=members(b,s,5)?;
    need(m.len()==5,"PLACEMENT_PUZZLE_FIELDS")?;
    let ids=array(b,f(b,s,"GridIDs")?,1)?;
    let ans=array(b,f(b,s,"AnswerGridIDs")?,1)?;
    need(ids.len()==1&&ans.len()==1,"PLACEMENT_PUZZLE_CARDINALITY")?;
    Ok(((n(b,s,"MissionItemID")?,n(b,s,"StepID")?,n(b,s,"SubStepID")?),uint(b,ids[0])?,uint(b,ans[0])?))
}
fn grid_at(b:&[u8],map:Span,id:u32)->CoreResult<Option<Span>>{
    let x=opt(b,map,&id.to_string())?;
    if let Some(x)=x{need(n(b,x,"ID")?==id,"PLACEMENT_PUZZLE_GRID_ID")?;}
    Ok(x)
}
fn validate_puzzles(b:&[u8],top:Span)->CoreResult<()>{
    let Some(w)=opt(b,top,"World")? else{return Ok(())};
    let realms=opt(b,w,"Realms")?;
    let rows=opt(b,w,"SceneryPuzzles")?;
    if realms.is_none()&&rows.is_none(){return Ok(())}
    // Existing synthetic/early-save empty rows do not require a new grid
    // provider. A non-empty actual puzzle must have physical endpoints.
    let mut mirror=BTreeMap::new();
    let mut realm_rows=None;
    if let Some(r)=realms{
        for (name,realm) in members(b,r,4096)?{
            if let Some(rs)=opt(b,realm,"SceneryPuzzles")?{
                let v=array(b,rs,4096)?;
                if name==DREAM && !v.is_empty(){realm_rows=Some((realm,v));}
                else{need(v.is_empty(),"PLACEMENT_UNKNOWN_REALM_PUZZLE")?;}
            }
        }
    }
    let world_rows=if let Some(s)=rows{array(b,s,4096)?}else{vec![]};
    if world_rows.is_empty()&&realm_rows.is_none(){return Ok(())}
    let gc=f(b,w,"GridCollection")?;
    let grids=f(b,gc,"Grids")?;let diff=f(b,gc,"DiffGrids")?;
    let mut village=std::collections::BTreeSet::new();
    if let Some(vs)=opt(b,w,"Villages")?{
        for v in array(b,vs,256)?{
            for (_,a) in members(b,f(b,v,"Areas")?,4096)?{
                for x in array(b,f(b,a,"GridIDs")?,4096)?{village.insert(uint(b,x)?);}
            }
        }
    }
    for x in world_rows{
        let (key,g,a)=puzzle(b,x)?;
        need(!village.contains(&g)&&grid_at(b,grids,g)?.is_some()&&grid_at(b,diff,g)?.is_none(),"PLACEMENT_WORLD_PUZZLE_ENDPOINT")?;
        need(mirror.insert(key,(g,a)).is_none(),"PLACEMENT_WORLD_PUZZLE_DUPLICATE")?;
    }
    if let Some((realm,rows))=realm_rows{
        let ids=array(b,f(b,realm,"GridIDs")?,3)?.into_iter().map(|x|uint(b,x)).collect::<CoreResult<Vec<_>>>()?;
        need(ids.len()==3&&ids.iter().copied().collect::<std::collections::BTreeSet<_>>().len()==3&&ids.iter().all(|i|!village.contains(i)),"PLACEMENT_REALM_GRID_IDS")?;
        let mut local_rows=BTreeMap::new();
        for x in rows{
            let (key,g,a)=puzzle(b,x)?;
            need(local_rows.insert(key,(g,a)).is_none(),"PLACEMENT_REALM_PUZZLE_DUPLICATE")?;
        }
        need(local_rows.len()==2,"PLACEMENT_REALM_PUZZLE_COUNT")?;
        let mut used=std::collections::BTreeSet::new();
        for (key,local_id,path) in PUZZLES{
            need(local_rows.get(&key)==Some(&(local_id,local_id)),"PLACEMENT_REALM_PUZZLE_LOCAL")?;
            let mut found=None;
            for &id in &ids{
                if let Some(x)=grid_at(b,grids,id)?{
                    if strv(b,x,"GridDataPath")?==path{
                        need(grid_at(b,diff,id)?.is_none()&&found.replace(id).is_none(),"PLACEMENT_REALM_PUZZLE_PATH")?;
                    }
                }
            }
            let id=found.ok_or(denied("PLACEMENT_REALM_PUZZLE_PATH"))?;
            need(used.insert(id)&&mirror.get(&key)==Some(&(id,local_id)),"PLACEMENT_REALM_PUZZLE_MIRROR")?;
        }
        let rest=ids.into_iter().filter(|id|!used.contains(id)).collect::<Vec<_>>();
        need(rest.len()==1,"PLACEMENT_REALM_REMAINDER")?;
        let x=grid_at(b,diff,rest[0])?.ok_or(denied("PLACEMENT_REALM_REMAINDER"))?;
        need(grid_at(b,grids,rest[0])?.is_none()&&strv(b,x,"GridDefaultLayoutPath")?==DREAM_LAYOUT,"PLACEMENT_REALM_REMAINDER")?;
    }else{
        // A mirror without its exact local owner is not a proof.
        need(PUZZLES.iter().all(|(key,_,_)|!mirror.contains_key(key)),"PLACEMENT_REALM_MISSING_OWNER")?;
    }
    Ok(())
}
struct Local{grids:BTreeMap<u32,Span>}
fn local(b:&[u8],s:Span)->CoreResult<Local>{
    let mut grids=BTreeMap::new();
    need(members(b,f(b,s,"DiffGrids")?,50_000)?.is_empty(),"PLACEMENT_PRESET_OVERLAY")?;
    for(k,g)in members(b,f(b,s,"Grids")?,50_000)?{
        let id=key(&k)?;need(n(b,g,"ID")?==id&&grids.insert(id,g).is_none(),"PLACEMENT_PRESET_GRID_ID")?;
        for(k,o)in members(b,f(b,g,"Objects")?,16384)?{
            need(key(&k)?==n(b,o,"ID")?,"PLACEMENT_PRESET_OBJECT_ID")?;
        }
    }
    Ok(Local{grids})
}
fn local_object_path(p:&[Segment])->bool{
    p.len()==9&&preset(&p[..4])&&k(&p[4],"Grids")&&ck(&p[5])&&k(&p[6],"Objects")&&ck(&p[7])&&k(&p[8],"State")
}
fn local_endpoint(b:&[u8],l:&Local,g:u32,o:Option<u32>)->CoreResult<()>{
    let g=*l.grids.get(&g).ok_or(denied("PLACEMENT_PRESET_GRID_ENDPOINT"))?;
    if let Some(o)=o{let r=f(b,f(b,g,"Objects")?,&o.to_string())?;need(n(b,r,"ID")?==o,"PLACEMENT_PRESET_OBJECT_ENDPOINT")?;}
    Ok(())
}
fn walk(b:&[u8],s:Span,path:&mut Vec<Segment>,ns:Option<&Local>,g:u32,seed:Option<u32>,next:u32,end:u32,a:&mut Incoming)->CoreResult<()>{
    a.nodes+=1;need(a.nodes<=MAX_NODES&&path.len()<=64,"PLACEMENT_REF_BOUND")?;
    // A local collection is recognized only by its exact typed owning path.
    // Every object/edge remains traversed; local aliases never count as World.
    validate_owner(b,s,path)?;
    let own=if preset(path){Some(local(b,s)?)}else{None};
    let ns=own.as_ref().or(ns);
    if ns.is_some()&&local_object_path(path)&&b.get(s.begin)==Some(&b'{')&&opt(b,s,"SubGrid")?.is_some(){
        need(members(b,s,1)?.len()==1,"PLACEMENT_PRESET_STATE_ONEOF")?;
    }
    match b.get(s.begin){
        Some(b'{')=>{
            let mut pos=s.begin+1;let mut fields:[Option<Span>;6]=[None;6];
            while let Some((k,v))=next_object_member(b,s,&mut pos)?{
                if k=="AnswerGridIDs"{
                    // Answer grids use installed layout namespace, only at validated puzzle rows.
                    need(puzzle_row(path),"PLACEMENT_PUZZLE_ANSWER_OWNER")?;
                    for x in array(b,v,1)?{uint(b,x)?;}
                }else if k=="GridIDs"{
                    let ids=if building(path){
                        let m=members(b,v,1)?;need(m.len()==1&&m[0].0=="List","PLACEMENT_BUILDING_GRIDIDS_WRAPPER")?;m[0].1
                    }else{v};
                    for x in array(b,ids,4096)?{
                        let id=uint(b,x)?;
                        if local_puzzle_row(path){ /* exact local endpoint/mirror validated before walk */ }
                        else if let Some(l)=ns{local_endpoint(b,l,id,None)?;}else{bump(&mut a.roots,id)?;}
                    }
                }else if k=="SubGrid"&&b.get(v.begin..v.end)!=Some(&b"null"[..]){
                    let id=n(b,v,"GridID")?;
                    if let Some(l)=ns{
                        need(local_object_path(path),"PLACEMENT_PRESET_SUBGRID_PATH")?;
                        let m=members(b,v,2)?;need(m.len()==2&&m.iter().any(|(k,_)|k=="DesignID"),"PLACEMENT_PRESET_SUBGRID_SHAPE")?;
                        let d=f(b,v,"DesignID")?;need(b.get(d.begin..d.end)==Some(&b"null"[..])||uint(b,d).is_ok(),"PLACEMENT_PRESET_DESIGN")?;
                        local_endpoint(b,l,id,None)?;
                    }else{bump(&mut a.parents,id)?;}
                }else if k=="FloorGridID"||k=="WallGridIDs"{
                    // Known Room edges; unknown paths are not a license to
                    // ignore a scalar or wall-map address.
                    let vals=if k=="FloorGridID"{vec![v]}else{
                        members(b,v,4)?.into_iter().map(|(k,x)|{
                            need(canonical(&k)&&k.parse::<u32>().is_ok_and(|n|n<4),"PLACEMENT_ROOM_WALL_KEY")?;Ok(x)
                        }).collect::<CoreResult<Vec<_>>>()?};
                    for x in vals{let id=uint(b,x)?;
                        if let Some(l)=ns{local_endpoint(b,l,id,None)?;}
                        else{bump(&mut a.roots,id)?;}
                    }
                    // Exact known Room shape is used for interpretation;
                    // no exemption for unrecognized paths.
                    // Unknown paths remain globally counted; no local exemption.
                }
                let ix=match k.as_str(){"GridID"=>Some(0),"GridId"=>Some(1),"GridObjectID"=>Some(2),"GridObjectId"=>Some(3),"ObjectID"=>Some(4),"ObjectId"=>Some(5),_=>None};
                if let Some(i)=ix{need(fields[i].replace(v).is_none(),"PLACEMENT_REF_DUPLICATE")?;}
                path.push(Key(k));walk(b,v,path,ns,g,seed,next,end,a)?;path.pop();
            }
            let gs=fields[..2].iter().filter(|v|v.is_some()).count();let os=fields[2..].iter().filter(|v|v.is_some()).count();
            if gs>0&&os>0{
                need(gs==1&&os==1,"PLACEMENT_REF_AMBIGUOUS")?;
                let (x,y)=match fields{
                    [Some(x),None,Some(y),None,None,None]|[None,Some(x),None,Some(y),None,None]|
                    [Some(x),None,None,None,Some(y),None]|[None,Some(x),None,None,None,Some(y)]=>(x,y),
                    _=>return reject("PLACEMENT_REF_SPELLING")};
                let id=uint(b,x)?;let oid=uint(b,y)?;a.pairs+=1;
                if let Some(l)=ns{local_endpoint(b,l,id,Some(oid))?;}
                else{need(id!=g||(oid!=0&&Some(oid)!=seed&&!(next..end).contains(&oid)),"PLACEMENT_REF_TARGET")?;}
            }
        },
        Some(b'[')=>{path.push(Element);for x in array(b,s,250_000)?{walk(b,x,path,ns,g,seed,next,end,a)?;}path.pop();},
        Some(_)=>{},None=>return reject("PLACEMENT_REF_SPAN"),
    }Ok(())
}
pub(super) fn scan(b:&[u8],top:Span,g:u32,seed:Option<u32>,next:u32,end:u32)->CoreResult<Incoming>{
    need(next<end,"PLACEMENT_REF_RANGE")?;
    validate_puzzles(b,top)?;
    let mut a=Incoming::default();walk(b,top,&mut Vec::new(),None,g,seed,next,end,&mut a)?;Ok(a)
}
#[cfg(test)]
mod tests{
    use super::*;use serde_json::json;
    fn check(v:&Value)->CoreResult<Incoming>{let b=serde_json::to_vec(v).unwrap();scan(&b,Span{begin:0,end:b.len()},7,None,9,10)}

    #[test]fn puzzle_local_zero_not_world_root_and_mirror_required(){
        let mut d=json!({"World":{"Villages":[{"Areas":{"7":{"GridIDs":[0]}}}],
            "GridCollection":{"Grids":{"0":{"ID":0},"30":{"ID":30,"GridDataPath":PUZZLES[0].2},"31":{"ID":31,"GridDataPath":PUZZLES[1].2}},"DiffGrids":{"32":{"ID":32,"GridDefaultLayoutPath":DREAM_LAYOUT}}},
            "Realms":{},"SceneryPuzzles":[]}});
        let row=|(mid,step,sub):(u32,u32,u32),g:u32,a:u32|json!({"MissionItemID":mid,"StepID":step,"SubStepID":sub,"GridIDs":[g],"AnswerGridIDs":[a]});
        d["World"]["Realms"][DREAM]=json!({"GridIDs":[30,32,31],"SceneryPuzzles":[row(PUZZLES[0].0,0,0),row(PUZZLES[1].0,2,2)]});
        d["World"]["SceneryPuzzles"]=json!([row(PUZZLES[0].0,30,0),row(PUZZLES[1].0,31,2)]);
        let a=check(&d).unwrap();assert_eq!(a.root(0),1);assert_eq!(a.root(30),2);
        for i in 0..10{let mut x=d.clone();match i{
            0=>x["World"]["Realms"][DREAM]["SceneryPuzzles"][0]["GridIDs"]=json!([1]),
            1=>x["World"]["Realms"][DREAM]["SceneryPuzzles"][0]["AnswerGridIDs"]=json!([1]),
            2=>x["World"]["SceneryPuzzles"][0]["GridIDs"]=json!([0]),
            3=>x["World"]["SceneryPuzzles"][0]["AnswerGridIDs"]=json!([1]),
            4=>x["World"]["GridCollection"]["Grids"]["30"]["GridDataPath"]=json!("Other"),
            5=>x["World"]["Realms"][DREAM]["GridIDs"]=json!([0,31,32]),
            6=>x["World"]["SceneryPuzzles"]=json!([row(PUZZLES[0].0,30,0)]),
            7=>x["World"]["Realms"]["Other"]=json!({"SceneryPuzzles":[row(PUZZLES[0].0,0,0)]}),
            8=>x["World"]["Realms"][DREAM]["SceneryPuzzles"]=json!({"[]":row(PUZZLES[0].0,0,0)}),
            _=>x["Unknown"]=json!({"AnswerGridIDs":[0]})
        }assert!(check(&x).is_err(),"puzzle mode {i}");}
    }
    #[test]fn typed_namespaces_and_real_aliases(){
        let d=json!({"World":{"BuildingInfos":{"100":{"GridIDs":{"List":[11]}}},
            "Villages":[{"Areas":{"6":{"GridIDs":[7]}}}],
            "DecorationPresets":[{"GridCollection":{"Grids":{"0":{"ID":0,"Objects":{"1":{"ID":1,"State":{"SubGrid":{"GridID":7,"DesignID":null}}}}},
                "7":{"ID":7,"Objects":{}}},"DiffGrids":{}}}],
            "PlayerHouses":[{"Floors":[{"Rooms":{"0":{"FloorGridID":12,"WallGridIDs":{"0":13}}}}]}]}});
        let a=check(&d).unwrap();assert_eq!((a.root(7),a.parent(7),a.root(11),a.root(12),a.root(13)),(1,0,1,1,1));
        let mut x=d.clone();x["World"]["BuildingInfos"]["100"]["GridIDs"]["List"]=json!([7]);assert_eq!(check(&x).unwrap().root(7),2);
        let mut x=d.clone();x["World"]["BuildingInfos"]["100"]["GridIDs"]["Extra"]=json!(0);assert!(check(&x).is_err());
        let mut x=d.clone();x["Unknown"]=json!({"GridIDs":{"List":[7]}});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["DecorationPresets"][0]["GridCollection"]["Grids"]["0"]["Objects"]["1"]["State"]["SubGrid"]["GridID"]=json!(8);assert!(check(&x).is_err());
        let mut x=d.clone();x["Unknown"]=json!({"SubGrid":{"GridID":7}});assert_eq!(check(&x).unwrap().parent(7),1);
        let mut x=d.clone();x["World"]["BuildingInfos"]["100"]["Room"]=json!({"FloorGridID":11,"WallGridIDs":{}});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["BuildingInfos"]["100"]=json!({});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["BuildingInfos"]=json!({"0100":{"Room":{"FloorGridID":11,"WallGridIDs":{}}}});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["DecorationPresets"]=json!({"[]":d["World"]["DecorationPresets"][0]});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["DecorationPresets"][0]["GridCollection"]["Grids"]["0"]["Objects"]["1"]["State"]["Other"]=json!({});assert!(check(&x).is_err());
        let mut x=d.clone();x["World"]["PlayerHouses"][0]["Floors"][0]["Rooms"]=json!({"00":{"FloorGridID":12,"WallGridIDs":{}}});assert!(check(&x).is_err());
        let mut x=d.clone();x["Unknown"]=json!({"GridID":7,"ObjectID":9});assert!(check(&x).is_err());
    }
}
