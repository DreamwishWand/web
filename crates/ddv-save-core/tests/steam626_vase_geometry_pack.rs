//! Independent compile and source tests of the installed-data reference.
#[path = "../src/steam626_vase_geometry.rs"]
mod steam626_vase_geometry;
use steam626_vase_geometry::*;
use serde_json::{json,Value};
use std::sync::OnceLock;
const DATA:&str=include_str!("../data/steam626-vase-geometry-quota.jsonl");
static PACK:OnceLock<GeometryPack>=OnceLock::new();
fn pack()->&'static GeometryPack{PACK.get_or_init(||load(DATA).unwrap())}
fn pose()->(u32,u32){
    let p=pack();
    (4..=492).step_by(2).flat_map(|x|(4..=342).step_by(2).map(move|y|(x,y)))
        .find(|(x,y)|floor_halo(p,*x,*y).is_ok()).unwrap()
}
fn object(id:u32,item:u32,x:i32,y:i32,s:Value)->Value{json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":"GridOrientation_Up","State":s})}
fn grid(id:u32,objects:Value)->Value{json!({"ID":id,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":100000,"Objects":objects})}
fn village()->Value{json!({"VillageObjectLimitName":"Village04ObjectLimit","HighEndVillageObjectLimitName":"HighEndVillageObjectLimit","BoughtObjectLimit":{"UniqueLimit":0,"InstanceLimit":0,"Exclusions":[],"SpecificItemLimits":[]},"Areas":{"6":{"Unlocked":true,"GridIDs":[7]}}})}
#[test]
fn exact_pack_floor_and_local_geometry(){
    let p=pack();
    assert!(load(&format!("{} ",DATA)).is_err());
    let (x,y)=pose();let mut g=grid(7,json!({"1":object(1,ITEM,0,0,Value::Null)}));
    // Choose a synthetic ambient anchor far from the selected public floor.
    g["Objects"]["1"]["X"]=json!(1000);g["Objects"]["1"]["Y"]=json!(1000);
    assert!(check_local_pose(pack(),BUILD,626,&g,7,x,y).is_ok());
    for (bx,by) in [(x+1,y),(0,0),(500,y),(u32::MAX,y)] {assert!(check_local_pose(pack(),BUILD,626,&g,7,bx,by).is_err());}
    assert!(check_local_pose(pack(),"other",626,&g,7,x,y).is_err());assert!(check_local_pose(pack(),BUILD,624,&g,7,x,y).is_err());
    for i in 0..9 {
        let mut q=g.clone();match i {
            0=>{q["Objects"]["1"]["X"]=json!(x);q["Objects"]["1"]["Y"]=json!(y);},
            1=>q["Objects"]["1"]["ItemID"]=json!(49999999),
            2=>q["Objects"]["1"]["State"]=json!({"Unknown":{}}),
            3=>q["Objects"]["1"]["From"]=Value::Null,
            4=>q["Objects"]["1"]["Orientation"]=json!("unknown"),
            5=>q["GridDefaultLayoutPath"]=json!("unknown"),
            6=>q["GridDataPath"]=json!("unknown"),
            7=>q["TessellationFactor"]=json!(1),
            _=>q["Objects"]["1"]["ID"]=json!(2),
        }
        assert!(check_local_pose(pack(),BUILD,626,&q,7,x,y).is_err(),"{i}");
    }
    let bad=(4..=492).step_by(2).flat_map(|x|(4..=342).step_by(2).map(move|y|(x,y)))
        .find(|(x,y)|floor_halo(p,*x,*y).is_err()).unwrap();
    assert!(check_local_pose(pack(),BUILD,626,&g,7,bad.0,bad.1).is_err());
}
fn quota(v:&Value, root:&Value, child:&Value, root_refs:u32,parent_refs:u32,overlay:bool)->R<QuotaBound>{
    check_village_quota(pack(),BUILD,626,v,&json!(false),7,|id|match id {
        7=>Ok(GridObservation{grid:root.clone(),root_refs,parent_refs:0,overlay}),
        8=>Ok(GridObservation{grid:child.clone(),root_refs:0,parent_refs,overlay:false}),
        _=>Err("missing"),
    })
}
#[test]
fn current_quota_closure_and_fail_closed(){
    let v=village();let excluded=serde_json::from_str::<Value>(DATA.lines().last().unwrap()).unwrap()[1][0].as_u64().unwrap() as u32;
    let root=grid(7,json!({"1":object(1,ITEM,0,0,json!({"SubGrid":{"GridID":8}})),"2":object(2,excluded,0,0,Value::Null)}));
    let child=grid(8,json!({"1":object(1,ITEM,0,0,Value::Null)}));
    assert_eq!(quota(&v,&root,&child,1,1,false).unwrap(),QuotaBound{grids:2,raw:3,excluded:1,post_unique_upper:3,post_instance_upper:3});
    for (r,p,o) in [(0,1,false),(2,1,false),(1,0,false),(1,2,false),(1,1,true)]{assert!(quota(&v,&root,&child,r,p,o).is_err());}
    for i in 0..7 {let mut q=v.clone();match i{
        0=>q["BoughtObjectLimit"]["UniqueLimit"]=json!(1),
        1=>q["VillageObjectLimitName"]=json!("other"),
        2=>q["HighEndVillageObjectLimitName"]=json!("other"),
        3=>q["Areas"]["6"]["Unlocked"]=json!(false),
        4=>q["Areas"]["5"]=json!({"Unlocked":true,"GridIDs":[7]}),
        5=>q["Areas"]["6"]["GridIDs"]=json!([7,9]),
        _=>q["BoughtObjectLimit"]["SpecificItemLimits"]=json!([1]),
    }assert!(quota(&q,&root,&child,1,1,false).is_err());}
    for i in 0..6{let mut q=child.clone();match i{
        0=>q["Objects"]["1"]["State"]=json!({"SubGrid":{"GridID":7}}),
        1=>q["Objects"]["1"]["State"]=json!({"SubGrid":{"GridID":0}}),
        2=>q["Objects"]["1"]["State"]=json!({"Unknown":{}}),
        3=>q["Objects"]["1"]["ID"]=json!(2),
        4=>q["GridDefaultLayoutPath"]=json!("unknown"),
        _=>q["Objects"]["1"]["ItemID"]=json!(0),
    }assert!(quota(&v,&root,&q,1,1,false).is_err());}
    let mut crowded=serde_json::Map::new();for i in 1..=3000 {crowded.insert(i.to_string(),object(i,ITEM,0,0,Value::Null));}
    assert!(quota(&v,&grid(7,Value::Object(crowded)),&child,1,1,false).is_err());
    // An unknown subtype-shaped ID is counted, not subtracted by ID pattern.
    let unknown=40199999;
    let q=grid(7,json!({"1":object(1,unknown,0,0,Value::Null)}));
    assert_eq!(quota(&v,&q,&child,1,1,false).unwrap().post_instance_upper,2);
}
