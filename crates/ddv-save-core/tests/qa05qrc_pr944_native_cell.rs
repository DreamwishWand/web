#![cfg(feature = "indexed-read")]
use ddv_save_core::{BuildIdentity, BuildKind, Platform, SpatialExtent};
fn build() -> BuildIdentity {
    BuildIdentity { platform: Platform::SteamWindows, build_kind: BuildKind::SteamFullVersion,
        build_id: "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema: 626, externally_attested: true }
}
fn extent(w:u32,h:u32)->SpatialExtent { SpatialExtent{width:w,height:h} }
#[test]
fn every_cardinal_permutation_and_raw_word() {
    let b=build();
    for (w,h) in [(1,1),(1,7),(7,1),(2,5),(5,2),(3,4),(4,3)] {
        let e=extent(w,h);
        let layers:Vec<u32>=(0..w*h).map(|i|0x8000_0000 | i*17).collect();
        for ori in [0,4,8,12] {
            let (rw,rh)=if ori==4||ori==12 {(h,w)} else {(w,h)};
            let mut seen=std::collections::BTreeSet::new();
            // Independent forward map original -> rotated, not production inverse map.
            for x in 0..w { for y in 0..h {
                let (dx,dy)=match ori {0=>(w-1-x,h-1-y),4=>(h-1-y,x),8=>(x,y),12=>(y,w-1-x),_=>unreachable!()};
                assert!(seen.insert((dx,dy)));
                assert_eq!(e.steam1253_cardinal_layer_at(&b,&layers,ori,dx,dy,1,1).unwrap(),layers[(x*h+y) as usize]);
            }}
            assert_eq!(seen.len(),(w*h) as usize);
            for (x,y) in [(rw,0),(0,rh),(u32::MAX,0),(0,u32::MAX)] {
                assert!(e.steam1253_cardinal_layer_at(&b,&layers,ori,x,y,1,1).is_err());
            }
        }
    }
}
#[test]
fn malformed_area_counts_and_unverified_tessellation() {
    let b=build(); let e=extent(2,5); let layers=[1;10];
    for n in [0,1,9,11,20] {assert!(e.steam1253_cardinal_layer_at(&b,&vec![1;n],8,0,0,1,1).is_err());}
    for (g,a) in [(0,1),(1,0),(2,2),(4,1),(1,4),(u32::MAX,1)] {
        assert!(e.steam1253_cardinal_layer_at(&b,&layers,8,0,0,g,a).is_err());
    }
    for (w,h) in [(0,5),(5,0),(65536,65536),(i32::MAX as u32,2),(u32::MAX,u32::MAX)] {
        assert!(extent(w,h).steam1253_cardinal_layer_at(&b,&[],8,0,0,1,1).is_err());
    }
    for ori in 0..=255 { if ![0,4,8,12].contains(&ori) {
        assert!(e.steam1253_cardinal_layer_at(&b,&layers,ori,0,0,1,1).is_err());
    }}
}
#[test]
fn exhaustive_low_bit_collision_and_high_bit_invariance() {
    let b=build();
    for a in 0u32..128 {for c in 0u32..128 {
        let shared=(0..5).any(|i| ((a>>i)&1)==1 && ((c>>i)&1)==1);
        let cross=(a&32!=0 && c&64!=0)||(a&64!=0 && c&32!=0);
        let expected=shared||cross;
        assert_eq!(SpatialExtent::steam1253_layers_collide(&b,a,c).unwrap(),expected);
        assert_eq!(SpatialExtent::steam1253_layers_collide(&b,a|0x8000_0080,c|0x4000_0100).unwrap(),expected);
    }}
}
#[test]
fn ordinary_cells_floor_intersection_and_zero_skip() {
    let b=build();
    for accepted in [0,1,2,3,1024,1025,1<<26] {for actual in [0,1,2,3,1024,1025,1<<26] {
        for layer in [0,1,2,31,32,64,96,127] {for other in [0,1,2,31,32,64,96,127] {
            let conflict=(0..5).any(|i| ((layer>>i)&1)==1 && ((other>>i)&1)==1)
                || (layer&32!=0&&other&64!=0)||(layer&64!=0&&other&32!=0);
            let expected=layer==0 || (accepted&actual!=0&&!conflict);
            assert_eq!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,accepted,actual,&[0,other]).unwrap(),expected);
        }}
    }}
}
#[test]
fn unsupported_bits_wall_and_occupancy_even_zero_candidate() {
    let b=build();
    for layer in [0,1] {
        for bit in [1<<27,1<<28,1<<29,1<<30,1u32<<31] {
            assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,1024|bit,1024,&[]).is_err());
            assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,1024,1024|bit,&[]).is_err());
        }
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,0x800|1024,1024,&[]).is_err());
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,1024,1024,&[0,0x80]).is_err());
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,1024,1024,&vec![0;4097]).is_err());
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,layer,1024,1024,&vec![0;4096]).unwrap());
    }
    for bit in 7..32 {
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,1u32<<bit,1024,1024,&[]).is_err());
    }
}
#[test]
fn all_new_apis_reject_wrong_build_and_local_true_is_not_authority() {
    let b=build();
    let mut variants=vec![];
    let mut c=build(); c.schema=624;variants.push(c);
    let mut c=build(); c.build_id.push_str("-wrong");variants.push(c);
    let mut c=build(); c.externally_attested=false;variants.push(c);
    let mut c=build(); c.platform=Platform::Switch;variants.push(c);
    let mut c=build(); c.build_kind=BuildKind::SwitchBid;variants.push(c);
    for c in variants {
        assert!(extent(1,1).steam1253_cardinal_layer_at(&c,&[1],8,0,0,1,1).is_err());
        assert!(SpatialExtent::steam1253_layers_collide(&c,0,0).is_err());
        assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&c,0,0,0,&[]).is_err());
    }
    // Forged empty occupancy and a plausible mask can yield local true. This
    // explicitly documents why no ProductSession authorization is derived.
    assert!(SpatialExtent::steam1253_nonwall_cell_predicate(&b,1,1024,1024,&[]).unwrap());
    assert!(!SpatialExtent::steam1253_nonwall_cell_predicate(&b,1,1024,1024,&[1]).unwrap());
    assert_eq!(extent(1,1).steam1253_cardinal_layer_at(&b,&[0],8,0,0,1,1).unwrap(),0);
}
