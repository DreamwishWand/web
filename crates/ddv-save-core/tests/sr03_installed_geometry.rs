// Source-only SR03 local geometry regression; no session or Writer grant.
#[path="../src/sr03_installed_geometry.rs"]
mod sr03_installed_geometry;

use sr03_installed_geometry::{MeadowGeometry, Rect, GRID, ROAD};
use serde_json::{json,Value};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn common(id:u32)->Option<(u32,u32)>{if id==ROAD{Some((2,2))}else{None}}
fn row(id:u32,item:u32,x:u32,y:u32,state:Value,orientation:&str)->Value{
    json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":orientation,"State":state})
}
fn fixture(x:u32,y:u32)->Value{
    json!({"ID":91001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":51,"Objects":{
        "17":row(17,ROAD,x,y,Value::Null,"GridOrientation_Down"),
        "29":row(29,ROAD,x+4,y,Value::Null,"GridOrientation_Down")}})
}
#[test]
fn qa_act1206_independent_geometry_and_exact_ambient_bounds(){
    let p=MeadowGeometry::fixed(BUILD,626).unwrap();
    let mut yes=0;let mut no=0;
    // Independent literal floor oracle from installed pack E2580 (column-major floor4).
    let raw=include_str!("../src/sr03_installed_geometry.rs");
    let h=raw.split_once("\"floor4Hex\":\"").unwrap().1.split_once('"').unwrap().0;
    let bytes:Vec<u8>=(0..h.len()).step_by(2).map(|i|u8::from_str_radix(&h[i..i+2],16).unwrap()).collect();
    use sha2::{Sha256,Digest};
    assert_eq!(format!("{:x}",Sha256::digest(&bytes)),"8a585926ad08919aee80294ae14502efc5b2dae0ba22d7484b6871dce9d54c12");
    let floor=|x:u32,y:u32|{let i=(x/2*100+y/2) as usize;bytes[i/8]&(1<<(i%8))!=0};
    assert_eq!(bytes.len(),2450);assert_eq!(bytes.iter().map(|b|b.count_ones()).sum::<u32>(),13208);
    for x in (0..=382u32).step_by(4){for y in (0..=194u32).step_by(4){
        let d=fixture(x,y);
        let expect=[(x,y),(x+4,y),(x+4,y+4),(x+8,y),(x+8,y+4)].iter().all(|&(a,b)|floor(a,b));
        let got=p.local_candidate(&d,17,29,common,|_,_|None);
        assert_eq!(got.is_some(),expect,"anchor {x} {y}");
        if let Some(t)=got{assert_eq!((t.keep,t.moved,t.next,t.x,t.y),(17,29,51,x,y));yes+=1}else{no+=1}
    }}
    assert_eq!((yes,no),(2974,1730));
    let (x,y)=(4u32,72u32);
    let d=fixture(x,y);
    let mut a=d.clone();
    let house=|xx:u32,yy:u32|row(37,20500005,xx,yy,json!({"HouseData":{"Built":true,"UpgradeState":{"Level":4},"PlayerHouseIndex":0}}),"GridOrientation_Right");
    let skin=|xx:u32,yy:u32|row(37,20300115,xx,yy,json!({"BuildingWithSkinData":{"UpgradeState":null,"CurrentSkinItemID":0}}),"GridOrientation_Down");
    let houses=json!([{"HouseItemID":20500005},{"HouseItemID":20500024}]);
    let mut good=0;let mut bad=0;
    for r in [house(x+12,y),skin(x+12,y)]{
        a["Objects"]["37"]=r.clone();
        assert!(p.local_candidate_with_buildings(&a,17,29,&houses,common,|_,_|panic!("special fallback")).is_some());good+=1;
        let mut q=a.clone();q["Objects"]["37"]["X"]=json!(x+11);
        assert!(p.local_candidate_with_buildings(&q,17,29,&houses,common,|_,_|panic!("special fallback")).is_none());bad+=1;
        let mut q=a.clone();q["Objects"]["37"]["State"]=json!(null);
        assert!(p.local_candidate_with_buildings(&q,17,29,&houses,common,|_,_|panic!("special fallback")).is_none());bad+=1;
    }
    assert_eq!(p.effective_building(&house(x+12,y),&houses),Some(Rect((x+12) as i64,y as i64,(x+38) as i64,(y+22) as i64)));
    assert_eq!(p.effective_building(&skin(x+12,y),&houses),Some(Rect((x+12) as i64,y as i64,(x+26) as i64,(y+10) as i64)));
    for h in [json!([{"HouseItemID":20500005},null]),json!([{"HouseItemID":20500005},{"HouseItemID":true}]),json!([{"HouseItemID":20500005},{"Other":20500024}]),json!([{"HouseItemID":20500005},{"HouseItemID":20500005}])]{
        assert!(p.effective_building(&house(x+12,y),&h).is_none());bad+=1;
    }
    for (k,v) in [("NextGridObjectID",json!(2147483646u32)),("GridDefaultLayoutPath",json!("overlay")),("TessellationFactor",json!(1)),("ID",json!(false))]{
        let mut q=d.clone();q[k]=v;assert!(p.local_candidate(&q,17,29,common,|_,_|None).is_none());bad+=1;
    }
    let mut q=d.clone();q["Objects"]["37"]=row(37,ROAD,x+12,y,Value::Null,"GridOrientation_Down");
    assert!(p.local_candidate(&q,17,29,common,|_,_|None).is_none());bad+=1;
    assert!(p.local_candidate(&q,17,29,common,|_,_|Some(Rect(0,0,1,1))).is_none());bad+=1;
    assert!(p.local_candidate(&q,17,29,common,|_,_|Some(Rect((x+12) as i64,y as i64,(x+14) as i64,(y+2) as i64))).is_some());good+=1;
    assert_eq!(p.dimensions(20500005,common),Some((22,26)));
    assert_eq!(p.dimensions(20300115,common),Some((14,10)));
    assert_eq!(p.dimensions(40003563,common),Some((16,4)));
    assert!(p.dimensions(4294967295,common).is_none());bad+=1;
    assert!(MeadowGeometry::fixed("foreign",626).is_none());bad+=1;
    assert_eq!((good,bad),(3,16));
    println!("ACT1206_SR03_LOCAL_ACTUAL {}POS {}NEG {}BOUND_POS {}BOUND_NEG",yes,no,good,bad);
}
