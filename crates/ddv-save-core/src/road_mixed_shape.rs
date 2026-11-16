//! Exact mixed road q5 descriptor shared by the accepted Native RM01/S-R03
//! operation and future product target preparation. No save/session/rights,
//! geometry, inventory authorization or caller-supplied plan is accepted here.
use serde_json::{Value,json};
pub(super) const ROAD:u32=40100068;
pub(super) fn object(id:u32,x:u32,y:u32,diagonal:bool)->Value{
    json!({"ID":id,"ItemID":ROAD,"X":x,"Y":y,"Orientation":"GridOrientation_Down",
        "State":if diagonal{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})
}

pub(super) struct MixedRoadShape{
    pub(super) old:[Value;2],
    pub(super) after:[Value;5],
    pub(super) anchors:[(u32,u32);5],
}
/// Exact retain/move/three-add shape. Coordinates are saved coordinates;
/// the caller must independently prove Build, floor/footprint/halo and
/// occupancy, typed target identity, old-value/epoch CAS, debit3 and
/// affected references. This function never grants authority.
pub(super) fn exact_q5(keep:u32,moved:u32,next:u32,x:u32,y:u32)->Option<MixedRoadShape>{
    if keep==0||moved==0||keep==moved||keep>=next||moved>=next||
        next.checked_add(3)?>i32::MAX as u32{return None;}
    let x4=x.checked_add(4)?;let x8=x.checked_add(8)?;let y4=y.checked_add(4)?;
    if x8>i32::MAX as u32||y4>i32::MAX as u32{return None;}
    Some(MixedRoadShape{
        old:[object(keep,x,y,false),object(moved,x4,y,false)],
        after:[object(keep,x,y,false),object(moved,x8,y4,true),
            object(next,x4,y,true),object(next+1,x4,y4,true),object(next+2,x8,y,true)],
        anchors:[(x,y),(x4,y),(x4,y4),(x8,y),(x8,y4)],
    })
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn exact_mixed_q5_descriptor_and_boundaries(){
        let s=exact_q5(10,11,50,40,20).unwrap();
        assert_eq!(s.old,[object(10,40,20,false),object(11,44,20,false)]);
        assert_eq!(s.after,[object(10,40,20,false),object(11,48,24,true),
            object(50,44,20,true),object(51,44,24,true),object(52,48,20,true)]);
        assert_eq!(s.anchors,[(40,20),(44,20),(44,24),(48,20),(48,24)]);
        assert_eq!(s.after[0],s.old[0]);
        let max=i32::MAX as u32;
        let t=exact_q5(1,2,max-3,max-8,max-4).unwrap();
        assert_eq!(t.after[4]["ID"],json!(max-1));
        assert_eq!(t.after[1]["X"],json!(max));
        assert_eq!(t.after[1]["Y"],json!(max));
        for (a,b,n,x,y) in [(0,2,50,40,20),(1,0,50,40,20),(1,1,50,40,20),
            (50,2,50,40,20),(1,50,50,40,20),(1,2,max-2,40,20),
            (1,2,u32::MAX,40,20),(1,2,50,max-7,20),
            (1,2,50,40,max-3),(1,2,50,u32::MAX,20),(1,2,50,40,u32::MAX)]{
            assert!(exact_q5(a,b,n,x,y).is_none());
        }
    }
}
