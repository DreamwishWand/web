#![cfg(feature = "indexed-read")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialExtent};
fn steam()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,
        build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema:626,externally_attested:true}
}
#[test]
fn asymmetric_native_x_major_masks_all_cardinal_orientations(){
    let a=SpatialExtent{width:2,height:3};
    let layer=[1,2,4,8,16,32];
    for (ori,expected) in [
        (0,[32,16,8,4,2,1]),
        (4,[4,32,2,16,1,8]),
        (8,[1,2,4,8,16,32]),
        (12,[8,1,16,2,32,4]),
    ] {
        let size=a.steam1253_cardinal_bounds(&steam(),ori,1,1).unwrap();
        let mut got=Vec::new();
        for x in 0..size.width {for y in 0..size.height{
            got.push(a.steam1253_cardinal_layer_at(
                &steam(),&layer,ori,x,y,1,1).unwrap());
        }}
        assert_eq!(got,expected);
    }
}
#[test]
fn layer_word_preserved_and_bounds_shape_tessellation_fail_closed(){
    let a=SpatialExtent{width:2,height:3};
    let raw=[0,1,2,4,8,0x144];
    assert_eq!(a.steam1253_cardinal_layer_at(&steam(),&raw,0,0,0,1,1).unwrap(),0x144);
    assert_eq!(a.steam1253_cardinal_layer_at(&steam(),&raw,8,0,0,1,1).unwrap(),0);
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,4,3,0,1,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,4,0,2,1,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw[..5],8,0,0,1,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,1,0,0,1,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,8,0,0,3,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,8,0,0,2,2).is_err());
    assert!(a.steam1253_cardinal_layer_at(&steam(),&raw,8,0,0,1,2).is_err());
    assert!(SpatialExtent{width:0,height:3}
        .steam1253_cardinal_layer_at(&steam(),&[],8,0,0,1,1).is_err());
    assert!(SpatialExtent{width:i32::MAX as u32,height:2}
        .steam1253_cardinal_layer_at(&steam(),&[],8,0,0,1,1).is_err());
}
#[test]
fn native_layer_collision_exclusive_and_cross_clear_block(){
    let b=steam();
    for (a,c,expected) in [
        (4,4,true),(4,8,false),(0x20,0x40,true),(0x40,0x20,true),
        (0x20,0x20,false),(0x40,0x40,false),(0,31,false),
        (0x100,0x100,false),(0x104,4,true),
    ] {
        assert_eq!(SpatialExtent::steam1253_layers_collide(&b,a,c).unwrap(),expected);
        assert_eq!(SpatialExtent::steam1253_layers_collide(&b,c,a).unwrap(),expected);
    }
}
#[test]
fn ordinary_cell_floor_collision_and_zero_layer_scope(){
    let b=steam();
    let p=|layer,floor,others:&[u32]|SpatialExtent::steam1253_nonwall_cell_predicate(
        &b,layer,1024,floor,others);
    assert!(p(4,1024,&[8]).unwrap());
    assert!(!p(4,1024,&[8,4]).unwrap());
    assert!(!p(4,4,&[]).unwrap());
    assert!(!p(4,0,&[]).unwrap());
    assert!(p(0,0,&[4,8]).unwrap());
    assert!(!p(0x20,1024,&[0x40]).unwrap());
    assert!(p(0x40,1024,&[0x40]).unwrap());
    assert!(p(0x144,1024,&[]).is_err());
    assert!(p(4,1024,&[0x100]).is_err());
    assert!(p(4,1<<31,&[]).is_err());
    assert!(SpatialExtent::steam1253_nonwall_cell_predicate(
        &b,4,0x800|1024,1024,&[]).is_err());
    assert!(p(4,1024,&vec![0;4097]).is_err());
}
#[test]
fn exact_build_reused_no_switch_or_unattested_permission(){
    let mut b=steam();
    b.platform=Platform::Switch;b.build_kind=BuildKind::SwitchBid;
    b.build_id="9A239D3DB569756D".into();
    let a=SpatialExtent{width:1,height:1};
    assert!(a.steam1253_cardinal_layer_at(&b,&[4],8,0,0,1,1).is_err());
    assert!(SpatialExtent::steam1253_layers_collide(&b,4,4).is_err());
    b=steam();b.externally_attested=false;
    assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,4,1024,1024,&[]).is_err());
}

#[test]
fn exact_two_to_one_layer_blocks_before_cardinal_rotation() {
    let a = SpatialExtent {width:2,height:3};
    let layer = [0,2,4,8,16,0x144];
    for (ori, width, height, expected) in [
        (0, 2, 3, [0x144,16,8,4,2,0]),
        (4, 3, 2, [4,0x144,2,16,0,8]),
        (8, 2, 3, [0,2,4,8,16,0x144]),
        (12,3, 2, [8,0,16,2,0x144,4]),
    ] {
        let b = steam();
        let size = a.steam1253_cardinal_bounds(&b,ori,2,1).unwrap();
        assert_eq!((size.width,size.height),(width*2,height*2));
        for x in 0..size.width { for y in 0..size.height {
            assert_eq!(a.steam1253_cardinal_layer_at(&b,&layer,ori,x,y,2,1).unwrap(),
                expected[((x/2)*height+y/2) as usize], "orientation={ori}, x={x}, y={y}");
        }}
        assert!(a.steam1253_cardinal_layer_at(&b,&layer,ori,size.width,0,2,1).is_err());
        assert!(a.steam1253_cardinal_layer_at(&b,&layer,ori,0,size.height,2,1).is_err());
    }
    let b = steam();
    let a = SpatialExtent {width:1,height:1};
    for x in 0..2 { for y in 0..2 {
        assert_eq!(a.steam1253_cardinal_layer_at(&b,&[0x144],8,x,y,2,1).unwrap(),0x144);
    }}
    assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,0x144,4,4,&[]).is_err());
}

#[test]
fn two_to_one_rejects_wrong_build_shape_ratio_and_overflow() {
    let mut b = steam();
    let a = SpatialExtent{width:2,height:3};
    let layer = [1,2,4,8,16,32];
    assert!(a.steam1253_cardinal_layer_at(&b,&layer[..5],8,0,0,2,1).is_err());
    assert!(a.steam1253_cardinal_layer_at(&b,&layer,1,0,0,2,1).is_err());
    for (g,t) in [(0,1),(1,2),(2,2),(3,1),(4,2)] {
        assert_eq!(a.steam1253_cardinal_layer_at(&b,&layer,8,0,0,g,t).unwrap_err().0,
            "SPATIAL_NATIVE_CELL_TESSELLATION_UNVERIFIED");
    }
    assert!(SpatialExtent{width:i32::MAX as u32,height:1}
        .steam1253_cardinal_layer_at(&b,&[],8,0,0,2,1).is_err());
    b.externally_attested=false;
    assert!(a.steam1253_cardinal_layer_at(&b,&layer,8,0,0,2,1).is_err());
}
