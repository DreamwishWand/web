#![cfg(feature = "indexed-read")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialExtent};

fn steam()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,
        build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema:626,externally_attested:true}
}
const ITEM:u32=40000066;
const RAW:u32=0x144;
const FLOOR:u32=0x07cb_f4ff;

#[test]
fn exact_vase_raw_layer_matches_native_collision_for_known_neighbors(){
    let b=steam();
    for neighbor in 0u32..=0x7f {
        let expected=neighbor&0x24==0;
        for floor in [4,16] {
            assert_eq!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
                &b,ITEM,RAW,FLOOR,floor,&[neighbor]).unwrap(),expected);
        }
        assert_eq!(SpatialExtent::steam1253_layers_collide(&b,RAW,neighbor).unwrap(),!expected);
    }
    let mask=[RAW];
    assert_eq!(SpatialExtent{width:1,height:1}.steam1253_cardinal_layer_at(
        &b,&mask,8,0,0,1,1).unwrap(),RAW);
    assert_eq!(mask,[RAW]);
    assert!(SpatialExtent::steam1253_nonwall_cell_predicate(
        &b,RAW,FLOOR,4,&[]).is_err());
}
#[test]
fn exact_vase_floor_and_neighbor_bounds_remain_fail_closed(){
    let b=steam();
    let p=|floor,others:&[u32]|SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &b,ITEM,RAW,FLOOR,floor,others);
    for bit in 0..27 {
        let floor=1u32<<bit;
        assert_eq!(p(floor,&[]).unwrap(),floor&FLOOR!=0);
    }
    assert!(!p(0,&[]).unwrap());
    assert!(p(4,&[0x40,0x8,0x2]).unwrap());
    assert!(!p(4,&[0x40,0x20]).unwrap());
    for unknown in [0x80,0x100,0x144,0x200,1<<31] {
        assert!(p(4,&[unknown]).is_err());
    }
    assert!(p(1<<31,&[]).is_err());
    assert!(p(4,&vec![0;4097]).is_err());
    assert!(p(4,&vec![0;4096]).unwrap());
}
#[test]
fn scope_does_not_admit_other_items_masks_floors_or_builds(){
    let b=steam();
    let p=|id,mask,floor|SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &b,id,mask,floor,4,&[]);
    for id in [0,40000053,40000065,40000067,u32::MAX] { assert!(p(id,RAW,FLOOR).is_err()); }
    for mask in [0,0x44,0x100,0x104,0x145,0x244,0x80000144] { assert!(p(ITEM,mask,FLOOR).is_err()); }
    for floor in [0,4,FLOOR|0x800,FLOOR|1<<31] { assert!(p(ITEM,RAW,floor).is_err()); }
    let mut wrong=b.clone();wrong.externally_attested=false;
    assert!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &wrong,ITEM,RAW,FLOOR,4,&[]).is_err());
    wrong=b.clone();wrong.schema=624;
    assert!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &wrong,ITEM,RAW,FLOOR,4,&[]).is_err());
    wrong=b.clone();wrong.build_id="wrong".into();
    assert!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &wrong,ITEM,RAW,FLOOR,4,&[]).is_err());
    wrong=b.clone();wrong.platform=Platform::Switch;wrong.build_kind=BuildKind::SwitchBid;
    wrong.build_id="9A239D3DB569756D".into();
    assert!(SpatialExtent::steam1253_furniture_40000066_nonwall_cell_predicate(
        &wrong,ITEM,RAW,FLOOR,4,&[]).is_err());
}
