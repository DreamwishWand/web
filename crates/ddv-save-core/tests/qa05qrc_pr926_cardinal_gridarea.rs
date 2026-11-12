#![cfg(feature = "indexed-read")]
//! 05 QR-C independent changed-only PR926 GridArea cardinal bounds QA.
//! PUBLIC SYNTHETIC only. This is a caller-asserted rectangle calculation,
//! NEVER authenticated native placement, footprint, collision, or Writer.
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialExtent};
const VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn steam()->BuildIdentity{BuildIdentity{
 platform:Platform::SteamWindows,
 build_kind:BuildKind::SteamFullVersion,
 build_id:VERSION.to_owned(),schema:626,externally_attested:true}}
fn rect(x:u32,y:u32)->SpatialExtent{SpatialExtent{width:x,height:y}}
fn calc(d:SpatialExtent,o:u8,g:u32,a:u32)->Result<SpatialExtent,&'static str>{
 d.steam1253_cardinal_bounds(&steam(),o,g,a).map_err(|e|e.0)
}
fn deny(d:SpatialExtent,o:u8,g:u32,a:u32,expected:&str){
 assert_eq!(calc(d,o,g,a).unwrap_err(),expected,"orientation {o}, grid {g}, area {a}");
}
#[test]
fn qa_only_cardinal_zero_eight_untransposed_four_twelve_swap(){
 let input=rect(7,13);
 for orientation in [0,8] {
   assert_eq!(calc(input,orientation,1,1).unwrap(),input);
 }
 for orientation in [4,12] {
   assert_eq!(calc(input,orientation,1,1).unwrap(),rect(13,7));
 }
}
#[test]
fn qa_all_u8_orientations_exhaustive_non_cardinal_fail_closed(){
 let input=rect(3,5);
 for orientation in 0_u8..=255 {
   match orientation {
     0|8=>assert_eq!(calc(input,orientation,1,1).unwrap(),input),
     4|12=>assert_eq!(calc(input,orientation,1,1).unwrap(),rect(5,3)),
     _=>deny(input,orientation,1,1,"SPATIAL_NATIVE_NONCARDINAL_SIZE_UNVERIFIED")
   }
 }
}
#[test]
fn qa_tessellation_native_grid_times_area_divisor_exact_dimensions(){
 for (o,want) in [(0,rect(8,6)),(8,rect(8,6)),
                  (4,rect(6,8)),(12,rect(6,8))]{
   assert_eq!(calc(rect(4,3),o,12,6).unwrap(),want);
 }
 assert_eq!(calc(rect(6,9),0,2,3).unwrap(),rect(4,6));
 assert_eq!(calc(rect(9,6),12,2,3).unwrap(),rect(4,6));
}
#[test]
fn qa_fail_closed_fractional_native_division_even_when_truncation_possible(){
 for o in [0,4,8,12]{
   deny(rect(2,3),o,3,2,"SPATIAL_NATIVE_AREA_SCALE_INEXACT");
   deny(rect(1,1),o,1,2,"SPATIAL_NATIVE_AREA_SCALE_INEXACT");
 }
 // First output dimension is divisible, the other isn't: never return a
 // partially computed / truncated rectangular result.
 for o in [0,4,8,12]{
   deny(rect(4,3),o,1,2,"SPATIAL_NATIVE_AREA_SCALE_INEXACT");
 }
}
#[test]
fn qa_dimensions_zero_or_above_signed_i32_and_tessellation_invalid(){
 let max=i32::MAX as u32;
 for d in [rect(0,1),rect(1,0),rect(0,0),rect(max+1,1),
           rect(1,max+1),rect(u32::MAX,1),rect(1,u32::MAX)]{
   deny(d,0,1,1,"SPATIAL_NATIVE_AREA_SIZE_OR_TESSELLATION_INVALID");
 }
 for (g,a) in [(0,1),(1,0),(0,0),(max+1,1),
                (1,max+1),(u32::MAX,1),(1,u32::MAX)]{
   deny(rect(1,1),0,g,a,"SPATIAL_NATIVE_AREA_SIZE_OR_TESSELLATION_INVALID");
 }
}
#[test]
fn qa_signed_i32_multiply_must_overflow_before_division(){
 let max=i32::MAX as u32;
 for o in [0,4,8,12] {
   // Algebraically (MAX*2)/2 fits, but native signed 32-bit multiplication
   // occurs first. Accepting its reduced value would misrepresent the native.
   deny(rect(max,1),o,2,2,"SPATIAL_NATIVE_AREA_SCALE_OVERFLOW");
   deny(rect(1,max),o,2,2,"SPATIAL_NATIVE_AREA_SCALE_OVERFLOW");
   deny(rect(2,1),o,max,max,"SPATIAL_NATIVE_AREA_SCALE_OVERFLOW");
   deny(rect(1,2),o,max,max,"SPATIAL_NATIVE_AREA_SCALE_OVERFLOW");
 }
}
#[test]
fn qa_signed_i32_edge_valid_without_overflow_or_truncation(){
 let max=i32::MAX as u32;
 let d=rect(max,1);
 assert_eq!(calc(d,0,1,1).unwrap(),d);
 assert_eq!(calc(d,8,1,1).unwrap(),d);
 assert_eq!(calc(d,4,1,1).unwrap(),rect(1,max));
 assert_eq!(calc(rect(1,1),0,max,1).unwrap(),rect(max,max));
 assert_eq!(calc(rect(1,1),12,max,max).unwrap(),rect(1,1));
}
#[test]
fn qa_exact_build_switch_schema_bid_platform_kind_attestation_fail_closed(){
 let d=rect(2,3);
 let mut cases=Vec::new();
 let mut b=steam();b.platform=Platform::Switch;b.build_kind=BuildKind::SwitchBid;
 b.build_id="9A239D3DB569756D".into();cases.push(b);
 let mut b=steam();b.build_id="releases_1.25-v1.25.0".into();cases.push(b);
 let mut b=steam();b.build_id="releases_1.25-v1.25.3".into();cases.push(b);
 let mut b=steam();b.schema=624;cases.push(b);
 let mut b=steam();b.schema=625;cases.push(b);
 let mut b=steam();b.schema=627;cases.push(b);
 let mut b=steam();b.externally_attested=false;cases.push(b);
 let mut b=steam();b.build_kind=BuildKind::SwitchBid;cases.push(b);
 let mut b=steam();b.platform=Platform::Switch;cases.push(b);
 for build in cases {
   for o in [0,4,8,12] {
     assert_eq!(d.steam1253_cardinal_bounds(&build,o,1,1).unwrap_err().0,
                "SPATIAL_NATIVE_STEAM_BUILD_REQUIRED");
   }
 }
}
#[test]
fn qa_source_input_is_untrusted_even_if_externally_attested_is_claimed(){
 // Caller can fabricate both the input rectangle and the attested bool.
 // This positive merely evaluates a rectangle and MUST NOT become a Native
 // ObjectID, placement legality, ownership or product operation permission.
 let claimed=rect(971,779);
 let output=claimed.steam1253_cardinal_bounds(&steam(),4,1,1).unwrap();
 assert_eq!(output,rect(779,971));
 // A successful return type is only width and height, not proof flags.
 assert_eq!(output.width,779);
 assert_eq!(output.height,971);
}
#[test]
fn qa_no_hidden_rounding_or_mismatched_scale_when_untouched_orientation(){
 for d in [rect(1,1),rect(4,6),rect(7,21),rect(50,100)]{
   for o in [0,8] {
     assert_eq!(calc(d,o,1,1).unwrap(),d);
     assert_eq!(calc(d,o,9,9).unwrap(),d);
   }
   for o in [4,12] {
     assert_eq!(calc(d,o,1,1).unwrap(),rect(d.height,d.width));
   }
 }
}
