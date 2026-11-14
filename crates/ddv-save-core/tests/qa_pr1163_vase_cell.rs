#![cfg(feature="indexed-read")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialExtent};
const ITEM:u32=40000066;
const RAW:u32=0x144;
const FLOOR:u32=0x07cb_f4ff;
fn steam()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}}
fn pred(b:&BuildIdentity,f:u32,n:&[u32])->bool{SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(b,ITEM,RAW,FLOOR,f,n).unwrap()}
#[test]
fn multi_neighbor_independent_oracle_and_permutation(){
 let b=steam();let mut n=0;
 for a in 0..128u32 {for c in 0..128u32 {
  for f in [0,4,0x800,0x07cb_f4ff]{
   // Raw 0x144 has exclusive bit 2 and Blocking bit 6. Candidate
   // collides with neighbor bit 2 or Clear bit 5, not bit 6 itself.
   let expected=f&FLOOR!=0 && ((a|c)&0x24)==0;
   assert_eq!(pred(&b,f,&[a,c]),expected);
   assert_eq!(pred(&b,f,&[c,a]),expected);n+=2;
  }
 }}
 assert!(pred(&b,4,&vec![0x40;4096]));
 let mut masks=vec![0x40;4096];masks[4095]=0x20;assert!(!pred(&b,4,&masks));
 assert_eq!(masks[4095],0x20);
 println!("QA1163_INDEPENDENT_PAIR_PERMUTATION_{n}_PASS");
}
#[test]
fn invalid_neighbors_cannot_hide_behind_false_placement_or_wrong_scope(){
 let b=steam();let mut n=0;
 for bad in [0x80,0x100,0x144,0x8000_0000,u32::MAX] {
  for f in [0,4,0x800]{
   for ns in [[bad,4],[4,bad],[0,bad]]{
    assert_eq!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(&b,ITEM,RAW,FLOOR,f,&ns).unwrap_err().0,"SPATIAL_NATIVE_LAYER_BITS_UNVERIFIED");n+=1;
   }
  }
 }
 for f in [0x0800_0000,1<<31,u32::MAX]{assert_eq!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(&b,ITEM,RAW,FLOOR,f,&[]).unwrap_err().0,"SPATIAL_NATIVE_FLOOR_BITS_UNVERIFIED");n+=1;}
 assert_eq!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(&b,ITEM,RAW,FLOOR,0,&vec![0;4097]).unwrap_err().0,"SPATIAL_NATIVE_CELL_OCCUPANCY_BOUNDS");n+=1;
 for (id,raw,f) in [(40001838,RAW,FLOOR),(ITEM,0x44,FLOOR),(ITEM,0x144,FLOOR^1),(ITEM,RAW,FLOOR|0x800)]{
  assert_eq!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(&b,id,raw,f,4,&[]).unwrap_err().0,"SPATIAL_NATIVE_VASE_CELL_SCOPE_UNVERIFIED");n+=1;
 }
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,RAW,FLOOR,0,&[]).is_err());
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,0x44,FLOOR,4,&[RAW]).is_err());
 assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,0x44,FLOOR,4,&[]).unwrap());
 let raw=[RAW];assert_eq!(SpatialExtent{width:1,height:1}.steam1253_cardinal_layer_at(&b,&raw,8,0,0,1,1).unwrap(),RAW);assert_eq!(raw,[RAW]);
 let mut wrong=b;wrong.externally_attested=false;assert!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(&wrong,ITEM,RAW,FLOOR,4,&[]).is_err());n+=1;
 println!("QA1163_{n}_FAIL_CLOSED_GENERIC_RAW_PRESERVED");
}
