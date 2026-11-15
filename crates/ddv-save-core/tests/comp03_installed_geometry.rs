// Test the standalone projection before the Core owner binds it to a session.
#[path = "../src/comp03_installed_geometry.rs"]
mod comp03_installed_geometry;

use comp03_installed_geometry::{InstalledGeometry,LocalGeometry};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
fn well()->Value{json!({"ID":0,"ItemID":20300048,"X":120,"Y":120,"Orientation":"GridOrientation_Down","State":{"BuildingWithSkinData":{"UpgradeState":{"Level":1},"CurrentSkinItemID":170200005}}})}
fn obj(id:u32,item:u32,x:u32,y:u32,o:&str)->Value{json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":o,"State":null})}
fn grid()->Value{json!({"ID":7654321,"GridDataPath":"GridData/FloatingIslands/FloatingIsland_Snow/FloatingIsland_SnowGrid-GridData.json","GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":9000,"Objects":{"0":well(),"13":obj(13,40100038,40,40,"GridOrientation_Down")}})}
#[test]
fn qa_act1010_independent_cardinal_footprint_and_fail_closed(){
    let p=InstalledGeometry::fixed().unwrap();
    let data=p.data();
    // Independent pin: canonical JSON (sorted keys) plus terminal newline.
    let mut bytes=serde_json::to_vec(data).unwrap();bytes.push(b'\n');
    assert_eq!(bytes.len(),3937);
    assert_eq!(format!("{:x}",Sha256::digest(&bytes)),"a1fdec93eb98e8a54227c32a2deec969b26415a4d4d10245446f21a238584196");
    assert_eq!(data["excludedDiagonalCount"],96);assert_eq!(data["excludedOnlineOrSpecialCount"],4);
    let groups=[(40100000u32,2u32,2u32,vec![6,8,9,10,12,14,15,16,18,19,20,21,30,31,32,33,34,35,36,37,38,39,40,41,42,43,50,53,54,55,56,57,58,59,60,62,64,65,66,67,68,75,76,82,87]),
      (40700000,1,1,vec![0,7,9,14,15,21,22,28,29,35,36,42,43,49,50,57,60,61,67,68,75,81,82,88,104,105,112,113,191,192,202,207,213,214,224,225,246,247,257,258,268,269,279,280,295,300,306,311]),
      (40700000,2,1,vec![2,8,16,23,30,37,44,51,62,69,76,83,106,114,193,208,215,226,248,259,270,281,301,312]),
      (40700000,3,1,vec![10,17,24,31,38,45,52,58,63,70,77,84,107,115,194,209,216,227,249,260,271,282,302,313]),
      (40700000,4,1,vec![4,11,18,25,32,39,46,53,64,71,78,85,108,116,195,210,217,228,250,261,272,283,303,314]),
      (40700000,5,1,vec![12,19,26,33,40,47,54,59,65,72,79,86,109,117,196,211,218,229,251,262,273,284,304,315]),
      (40700000,6,1,vec![6,13,20,27,34,41,48,55,66,73,80,87,110,118,197,212,219,230,252,263,274,285,305,316])];
    let mut expected=std::collections::BTreeMap::new();
    for (base,w,h,ids) in groups{for id in ids{assert!(expected.insert(base+id,(w,h)).is_none());}}
    assert_eq!(expected.len(),213);
    let mut pos=0;let mut neg=0;
    for (item,(w,h)) in &expected{
        assert_eq!(p.dimensions(*item),Some((*w,*h)));
        for (o,width,height) in [("GridOrientation_Up",*w,*h),("GridOrientation_Down",*w,*h),("GridOrientation_Left",*h,*w),("GridOrientation_Right",*h,*w)]{
            // Half-open halo [36,56) x [36,56). Touching left/bottom edge
            // is safe; exactly one saved cell crossing is not.
            for (x,y) in [(36-2*width,40),(40,36-2*height),(56,40),(40,56),(260-2*width,260-2*height)]{
                let mut g=grid();g["Objects"]["77"]=obj(77,*item,x,y,o);
                assert_eq!(p.local_geometry(&g,&well(),13),Some(LocalGeometry{seed_x:40,seed_y:40,next:9000}),"{item} {o} {x},{y}");pos+=1;
            }
            for (x,y) in [(37-2*width,40),(40,37-2*height),(55,40),(40,55),(261-2*width,260-2*height),(260-2*width,261-2*height)]{
                let mut g=grid();g["Objects"]["77"]=obj(77,*item,x,y,o);
                assert!(p.local_geometry(&g,&well(),13).is_none(),"{item} {o} {x},{y}");neg+=1;
            }
        }
    }
    for id in (40100000..40100100).chain(40700000..40700317){
        if !expected.contains_key(&id){assert!(p.dimensions(id).is_none());let mut g=grid();g["Objects"]["77"]=obj(77,id,200,200,"GridOrientation_Down");assert!(p.local_geometry(&g,&well(),13).is_none());neg+=1;}
    }
    // Well exclusion is [80,161), independently intersecting the halo.
    for (x,y,ok) in [(64,120,true),(68,120,false),(164,120,false),(168,120,true),(120,64,true),(120,68,false),(120,164,false),(120,168,true),(0,0,true),(248,248,true)]{
        let mut g=grid();g["Objects"]["13"]["X"]=json!(x);g["Objects"]["13"]["Y"]=json!(y);
        assert_eq!(p.local_geometry(&g,&well(),13).is_some(),ok,"well edge {x},{y}");
        if ok{pos+=1}else{neg+=1}
    }
    let g=grid();
    let mut cases=Vec::new();
    for (k,v) in [("ID",json!(1.0)),("ID",json!("1")),("NextGridObjectID",json!(0)),("NextGridObjectID",json!(13)),("NextGridObjectID",json!(2147483640u32)),("NextGridObjectID",json!(4294967296u64)),("NextGridObjectID",json!("9000")),("TessellationFactor",json!(2.0)),("GridDataPath",json!(data["roots"][1]["gridDataPath"])),("GridDefaultLayoutPath",json!(null)),("Objects",json!([]))]{let mut x=g.clone();x[k]=v;cases.push(x);}
    for (k,v) in [("ID",json!(14)),("ItemID",json!(40100038.0)),("X",json!(-1)),("Y",json!(40.0)),("X",json!(4294967295u32)),("Orientation",json!("GridOrientation_Left")),("State",json!({})),("From",json!(null))]{let mut x=g.clone();x["Objects"]["13"][k]=v;cases.push(x);}
    for k in ["State","Orientation","ItemID","X","Y","ID"]{let mut x=g.clone();x["Objects"]["13"].as_object_mut().unwrap().remove(k);cases.push(x);}
    let mut x=g.clone();x["Objects"]["013"]=obj(13,40100038,200,200,"GridOrientation_Down");cases.push(x);
    let mut x=g.clone();x["Objects"]["9000"]=obj(9000,40100038,200,200,"GridOrientation_Down");cases.push(x);
    let mut x=g.clone();x["Objects"]["0"]["State"]["BuildingWithSkinData"]["CurrentSkinItemID"]=json!(170200006);cases.push(x);
    let mut x=g.clone();x["Objects"].as_object_mut().unwrap().remove("0");cases.push(x);
    for x in cases{assert!(p.local_geometry(&x,&well(),13).is_none());neg+=1;}
    for k in ["X","Y","State","Orientation","ItemID","ID"]{let mut w=well();w.as_object_mut().unwrap().remove(k);assert!(p.local_geometry(&g,&w,13).is_none());neg+=1;}
    for id in [0,14,9000]{assert!(p.local_geometry(&g,&well(),id).is_none());neg+=1;}
    let mut x=g.clone();x["NextGridObjectID"]=json!(2147483639u32);assert!(p.local_geometry(&x,&well(),13).is_some());pos+=1;
    let mut x=g.clone();for i in 100..4194{ x["Objects"][i.to_string()]=obj(i,40100038,200,200,"GridOrientation_Down");}
    assert_eq!(x["Objects"].as_object().unwrap().len(),4096);assert!(p.local_geometry(&x,&well(),13).is_some());pos+=1;
    x["Objects"]["4194"]=obj(4194,40100038,200,200,"GridOrientation_Down");assert!(p.local_geometry(&x,&well(),13).is_none());neg+=1;
    assert_eq!((pos,neg),(4268,5359));
}
