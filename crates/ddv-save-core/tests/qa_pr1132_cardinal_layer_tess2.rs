#![cfg(feature="indexed-read")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialExtent};
fn steam()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}}
#[test]
fn forward_project_each_source_cell_into_rotated_two_by_two_blocks(){
 let b=steam();
 let mut positive=0;
 for (w,h) in [(2u32,3u32),(3,5),(5,1),(1,4),(1,1)]{
  let a=SpatialExtent{width:w,height:h};
  let masks:Vec<u32>=(0..w*h).map(|i|0x80000000 | (i+1)*0x101).collect();
  for ori in [0u8,4,8,12]{
   let (rw,rh)=if ori==4||ori==12{(h,w)}else{(w,h)};
   let bounds=a.steam1253_cardinal_bounds(&b,ori,2,1).unwrap();
   assert_eq!((bounds.width,bounds.height),(2*rw,2*rh));
   // Forward projection from source cell to rotated grid, not the production inverse formula.
   for x in 0..w { for y in 0..h {
    let (rx,ry)=match ori{0=>(w-1-x,h-1-y),4=>(h-1-y,x),8=>(x,y),12=>(y,w-1-x),_=>unreachable!()};
    let expected=masks[(x*h+y) as usize];
    assert_eq!(a.steam1253_cardinal_layer_at(&b,&masks,ori,rx,ry,1,1).unwrap(),expected);
    for subx in 0..2 {for suby in 0..2 {
     assert_eq!(a.steam1253_cardinal_layer_at(&b,&masks,ori,rx*2+subx,ry*2+suby,2,1).unwrap(),expected);
     positive+=1;
    }}
   }}
   for (x,y) in [(2*rw,0),(0,2*rh),(2*rw,2*rh),(u32::MAX,0),(0,u32::MAX)]{
    assert_eq!(a.steam1253_cardinal_layer_at(&b,&masks,ori,x,y,2,1).unwrap_err().0,"SPATIAL_NATIVE_CELL_OUTSIDE_AREA");
   }
  }
 }
 println!("QA1132_FORWARD_ORACLE_{positive}_SUBCELLS_RAW_HIGH_BITS");
}
#[test]
fn deny_build_ratio_mask_shape_and_overflow_without_widening_nonwall(){
 let b=steam();let a=SpatialExtent{width:2,height:3};let raw=[1,2,4,8,16,0x80000144];
 let mut negatives=0;
 for ori in [0u8,4,8,12]{
  for (g,t) in [(0,0),(0,1),(1,0),(1,2),(2,0),(2,2),(3,1),(4,2),(u32::MAX,1)]{
   assert_eq!(a.steam1253_cardinal_layer_at(&b,&raw,ori,0,0,g,t).unwrap_err().0,"SPATIAL_NATIVE_CELL_TESSELLATION_UNVERIFIED");negatives+=1;
  }
  for len in [0,1,5,7]{let mask=vec![4;len];assert_eq!(a.steam1253_cardinal_layer_at(&b,&mask,ori,0,0,2,1).unwrap_err().0,"SPATIAL_NATIVE_LAYER_COUNT_INVALID");negatives+=1;}
 }
 for ori in [1,2,3,5,6,7,9,10,11,13,14,15,16,255]{assert!(a.steam1253_cardinal_layer_at(&b,&raw,ori,0,0,2,1).is_err());negatives+=1;}
 for variant in 0..5{let mut bad=steam();match variant{0=>bad.externally_attested=false,1=>bad.schema=624,2=>bad.build_id.push('x'),3=>bad.platform=Platform::Switch,4=>bad.build_kind=BuildKind::SwitchBid,_=>unreachable!()};assert_eq!(a.steam1253_cardinal_layer_at(&bad,&raw,8,0,0,2,1).unwrap_err().0,"SPATIAL_NATIVE_STEAM_BUILD_REQUIRED");negatives+=1;}
 for (w,h) in [(0,1),(1,0),(i32::MAX as u32/2+1,1),(1,i32::MAX as u32/2+1),(u32::MAX,1),(65536,65536)]{assert!(SpatialExtent{width:w,height:h}.steam1253_cardinal_layer_at(&b,&[],8,0,0,2,1).is_err());negatives+=1;}
 let value=a.steam1253_cardinal_layer_at(&b,&raw,8,3,5,2,1).unwrap();assert_eq!(value,0x80000144);
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,value,1024,1024,&[]).is_err());
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,4,1024,1024,&[value]).is_err());
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,4,1024,1024,&[8]).unwrap());
 println!("QA1132_{negatives}_NEG_NONWALL_HIGH_BIT_DENIAL");
}
