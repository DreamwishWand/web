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


#[test]
fn qa_vase_floor_complete_matrix_quota_exact_boundaries(){
    use std::collections::{BTreeMap,BTreeSet};
    let mut bits=Vec::new();let mut dimensions=BTreeMap::new();let mut exclusions=BTreeSet::new();
    for line in DATA.lines().skip(1){
        let v:Value=serde_json::from_str(line).unwrap();
        match v[0].as_str().unwrap(){
            "floor"=>{assert_eq!(v[1].as_u64().unwrap() as usize,bits.len());
                let s=v[2].as_str().unwrap();for i in (0..s.len()).step_by(2){bits.push(u8::from_str_radix(&s[i..i+2],16).unwrap());}},
            "dims"=>{for x in v[3].as_array().unwrap(){assert!(dimensions.insert(x.as_u64().unwrap() as u32,(v[1].as_u64().unwrap(),v[2].as_u64().unwrap())).is_none());}},
            "excluded"=>{for x in v[1].as_array().unwrap(){assert!(exclusions.insert(x.as_u64().unwrap() as u32));}},
            _=>panic!("unknown row"),
        }
    }
    assert_eq!((bits.len(),dimensions.len(),exclusions.len()),(5469,6591,49));
    assert_eq!(bits.iter().map(|x|x.count_ones()).sum::<u32>(),11314);
    let mut pos=0;let mut neg=0;let mut good=None;
    // Independent six-by-six logical-cell oracle for every even raw anchor.
    // x-major mask offset and half-open 12x12 raw halo are pinned.
    for x in 0u32..250{for y in 0u32..175{
        let ok=x>=2&&x+4<=250&&y>=2&&y+4<=175&&
            (x-2..x+4).all(|i|(y-2..y+4).all(|j|{let n=(i*175+j) as usize;bits[n/8]&(1u8<<(n%8))!=0}));
        assert_eq!(floor_halo(pack(),2*x,2*y).is_ok(),ok,"{x},{y}");
        if ok{pos+=1;good=Some((2*x,2*y));}else{neg+=1;}
    }}
    let (x,y)=good.unwrap();
    let mut g=grid(7,json!({"1":object(1,ITEM,(x+8+4) as i32,y as i32,Value::Null)}));
    assert!(check_local_pose(pack(),BUILD,626,&g,7,x,y).is_ok());pos+=1;
    g["Objects"]["1"]["X"]=json!(x+11);
    assert!(check_local_pose(pack(),BUILD,626,&g,7,x,y).is_err());neg+=1;
    g["Objects"]["1"]["X"]=json!(x+12);
    for orientation in ["GridOrientation_Up","GridOrientation_Right","GridOrientation_Down","GridOrientation_Left"]{
        g["Objects"]["1"]["Orientation"]=json!(orientation);
        assert!(check_local_pose(pack(),BUILD,626,&g,7,x,y).is_ok());pos+=1;
    }
    for (field,val) in [("ID",json!(100000)),("ItemID",json!(20099999)),("X",json!("12")),("Y",json!(1000001)),("State",json!({"SubGrid":{"GridID":8}})),("State",json!({"Keyhole":null}))]{
        let mut q=g.clone();q["Objects"]["1"][field]=val;
        assert!(check_local_pose(pack(),BUILD,626,&q,7,x,y).is_err());neg+=1;
    }
    // Quota conservatively counts all distinct IDs, including excluded IDs
    // for unique upper bound, and only exact exclusion membership for instances.
    let all:Vec<u32>=dimensions.keys().copied().filter(|id|!exclusions.contains(id)&&*id!=ITEM).take(600).collect();
    let root_for=|n:usize,unique:usize,ex:usize|{
        let mut m=serde_json::Map::new();let excluded=*exclusions.iter().next().unwrap();
        for i in 0..n{let item=if i<ex{excluded}else{all[(i-ex)%unique]};let id=i as u32+1;
            m.insert(id.to_string(),object(id,item,0,0,Value::Null));}
        grid(7,Value::Object(m))
    };
    let v=village();
    for (n,unique,ex,ok) in [(2999,599,0,true),(3000,599,0,false),(599,599,0,true),(600,600,0,false),(3000,598,1,true),(3001,598,1,false)]{
        let g=root_for(n,unique,ex);
        let res=check_village_quota(pack(),BUILD,626,&v,&json!(true),7,|id|{assert_eq!(id,7);Ok(GridObservation{grid:g.clone(),root_refs:1,parent_refs:0,overlay:false})});
        assert_eq!(res.is_ok(),ok,"{n}/{unique}/{ex}");
        if ok{let q=res.unwrap();assert_eq!(q.raw,n);assert_eq!(q.excluded,ex);assert_eq!(q.post_unique_upper,unique+(ex>0) as usize+1);assert_eq!(q.post_instance_upper,n-ex+1);pos+=1;}else{neg+=1;}
    }
    let root=grid(7,json!({"1":object(1,ITEM,0,0,json!({"SubGrid":{"GridID":8}}))}));
    let child=grid(8,json!({"1":object(1,ITEM,0,0,json!({"SubGrid":{"GridID":9}}))}));
    let leaf=grid(9,json!({"1":object(1,ITEM,0,0,Value::Null)}));
    let walk=|bad:u32|check_village_quota(pack(),BUILD,626,&v,&json!(false),7,|id|{
        let mut grid=match id{7=>root.clone(),8=>child.clone(),9=>leaf.clone(),_=>return Err("missing")};
        if bad==1&&id==9{grid["Objects"]["1"]["State"]=json!({"SubGrid":{"GridID":8}});}
        if bad==2&&id==8{grid["Objects"]["2"]=object(2,ITEM,0,0,json!({"SubGrid":{"GridID":9}}));}
        Ok(GridObservation{grid,root_refs:if id==7{1}else if bad==3&&id==9{1}else{0},parent_refs:if id==7{0}else if bad==4&&id==8{2}else{1},overlay:bad==5&&id==9})
    });
    assert_eq!(walk(0).unwrap(),QuotaBound{grids:3,raw:3,excluded:0,post_unique_upper:2,post_instance_upper:4});pos+=1;
    for k in 1..=5{assert!(walk(k).is_err());neg+=1;}
    assert_eq!(pos+neg,43750+24);
    eprintln!("ACT1093_VASE_GEOMETRY_MATRIX {pos}POS {neg}NEG PASS");
}
