#![cfg(feature = "indexed-read")]
//! Focused SYNTHETIC source-scoped proof of same Steam GridArea bounds.
/// This intentionally does NOT test item permission / real GridCells / Writer.
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,SpatialExtent,
};
fn steam() -> BuildIdentity {
    BuildIdentity {
        platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema:626,externally_attested:true,
    }
}
fn area()->SpatialExtent{SpatialExtent{width:2,height:3}}
#[test]
fn cardinal_0_8_normal_4_12_swap_dimensions() {
    for n in [0,8] {
        assert_eq!(area().steam1253_cardinal_bounds(&steam(),n,1,1).unwrap(),area());
    }
    for n in [4,12] {
        assert_eq!(
            area().steam1253_cardinal_bounds(&steam(),n,1,1).unwrap(),
            SpatialExtent{width:3,height:2}
        );
    }
}
#[test]
fn grid_and_area_tessellation_use_exact_division() {
    assert_eq!(
        area().steam1253_cardinal_bounds(&steam(),4,2,1).unwrap(),
        SpatialExtent{width:6,height:4}
    );
    assert_eq!(
        area().steam1253_cardinal_bounds(&steam(),8,2,2).unwrap(),
        area()
    );
    assert_eq!(
        area().steam1253_cardinal_bounds(&steam(),4,3,2).unwrap_err().0,
        "SPATIAL_NATIVE_AREA_SCALE_INEXACT"
    );
}
#[test]
fn native_noncardinal_undefined_and_integer_limits_rejected() {
    for n in [1,2,3,5,6,7,9,10,11,13,14,15,16,255] {
        assert_eq!(
            area().steam1253_cardinal_bounds(&steam(),n,1,1).unwrap_err().0,
            "SPATIAL_NATIVE_NONCARDINAL_SIZE_UNVERIFIED"
        );
    }
    assert_eq!(
        SpatialExtent{width:i32::MAX as u32,height:1}
            .steam1253_cardinal_bounds(&steam(),0,2,1).unwrap_err().0,
        "SPATIAL_NATIVE_AREA_SCALE_OVERFLOW"
    );
    assert_eq!(
        area().steam1253_cardinal_bounds(&steam(),0,0,1).unwrap_err().0,
        "SPATIAL_NATIVE_AREA_SIZE_OR_TESSELLATION_INVALID"
    );
    assert_eq!(
        SpatialExtent{width:0,height:2}
            .steam1253_cardinal_bounds(&steam(),0,1,1).unwrap_err().0,
        "SPATIAL_NATIVE_AREA_SIZE_OR_TESSELLATION_INVALID"
    );
}
#[test]
fn same_schema_switch_and_wrong_steam_fullversion_denied() {
    let mut wrong=steam();
    wrong.platform=Platform::Switch;wrong.build_kind=BuildKind::SwitchBid;
    wrong.build_id="9A239D3DB569756D".into();
    assert_eq!(
        area().steam1253_cardinal_bounds(&wrong,0,1,1).unwrap_err().0,
        "SPATIAL_NATIVE_STEAM_BUILD_REQUIRED"
    );
    let mut wrong=steam();wrong.build_id="releases_1.25-v1.25.0".into();
    assert_eq!(
        area().steam1253_cardinal_bounds(&wrong,4,1,1).unwrap_err().0,
        "SPATIAL_NATIVE_STEAM_BUILD_REQUIRED"
    );
    let mut wrong=steam();wrong.externally_attested=false;
    assert_eq!(
        area().steam1253_cardinal_bounds(&wrong,4,1,1).unwrap_err().0,
        "SPATIAL_NATIVE_STEAM_BUILD_REQUIRED"
    );
}
