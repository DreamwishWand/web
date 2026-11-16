//! Pure shared Fence ADD record construction; no Session, Build, geometry,
//! stock, rights, or mutation authority. Native and future exact FD01 use
//! the same constructor and FD01 descriptor. No additional shape is authorized.
use serde_json::{Value,json};
pub(super) const FD01_DESCRIPTORS:&[(u32,i32,i32,bool,bool)]=&[
    (40700246,0,0,false,true),(40700253,2,2,false,true),(40700246,4,4,false,true),
];
pub(super) enum ShapeError{Counter,Coordinate}
pub(super) fn fence_record(id:u32,item:u32,x:u32,y:u32,left:bool,diagonal:bool)->Value{
    json!({"ID":id,"ItemID":item,"X":x,"Y":y,
        "Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},
        "State":if diagonal{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})
}
pub(super) fn records_at(descriptors:&[(u32,i32,i32,bool,bool)],next:u32,x:u32,y:u32)->Result<Vec<Value>,ShapeError>{
    let coord=|v:u32,d:i32|i64::from(v).checked_add(i64::from(d))
        .filter(|n|*n>=0&&*n<=i64::from(i32::MAX)).map(|n|n as u32).ok_or(ShapeError::Coordinate);
    descriptors.iter().enumerate().map(|(i,(item,dx,dy,left,diag))|
        Ok(fence_record(next.checked_add(i as u32).ok_or(ShapeError::Counter)?,
            *item,coord(x,*dx)?,coord(y,*dy)?,*left,*diag))).collect()
}
/// Exact FD01 positive diagonal N3 layout-only. Caller independently proves
/// exact Build, bounds/floor/footprint, all ambient and references, stock and CAS.
#[allow(dead_code)]
pub(super) fn exact_fd01(next:u32,x:u32,y:u32)->Option<[Value;3]>{
    if next==0||next.checked_add(3)?>i32::MAX as u32{return None}
    records_at(FD01_DESCRIPTORS,next,x,y).ok()?.try_into().ok()
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn fd01_exact_layout_and_boundaries(){
        let a=exact_fd01(50,40,20).unwrap();
        assert_eq!(a,[
            json!({"ID":50,"ItemID":40700246,"X":40,"Y":20,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}}),
            json!({"ID":51,"ItemID":40700253,"X":42,"Y":22,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}}),
            json!({"ID":52,"ItemID":40700246,"X":44,"Y":24,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}})
        ]);
        let max=i32::MAX as u32;
        let edge=exact_fd01(max-3,max-4,max-4).unwrap();
        assert_eq!(edge[2]["ID"],json!(max-1));
        assert_eq!(edge[2]["X"],json!(max));assert_eq!(edge[2]["Y"],json!(max));
        for (n,x,y) in [(0,40,20),(max-2,40,20),(u32::MAX,40,20),
            (50,max-3,20),(50,40,max-3),(50,u32::MAX,20),(50,40,u32::MAX)]{
            assert!(exact_fd01(n,x,y).is_none());
        }
    }
}

/// Historical FRP01 exact family replacement. No Build, placement, rights,
/// connection, mutation or inventory authority; caller proves all separately.
/// Match the original collector's stricter x+4/y+6 and ID/counter guards.
pub(super) fn exact_frp01(ids:[u32;3],next:u32,x:u32,y:u32)->Option<([Value;3],[Value;3])>{
    let max=i32::MAX as u32;
    if next==0||next.checked_add(3)?>max||ids.iter().any(|id|*id==0||*id>=next)
        ||ids[0]==ids[1]||ids[0]==ids[2]||ids[1]==ids[2]
        ||x.checked_add(4)?>max||y.checked_add(6)?>max{return None}
    let y2=y.checked_add(2)?;let y4=y.checked_add(4)?;
    Some((
        [fence_record(ids[0],40700246,x,y,false,false),
         fence_record(ids[1],40700247,x,y2,true,false),
         fence_record(ids[2],40700246,x,y4,false,false)],
        [fence_record(next,40700268,x,y,false,false),
         fence_record(next+1,40700269,x,y2,true,false),
         fence_record(next+2,40700268,x,y4,false,false)]
    ))
}
#[cfg(test)]
mod frp01_tests{
    use super::*;
    #[test]
    fn exact_frp01_preserve_anchors_and_old_id_bounds(){
        let (old,new)=exact_frp01([10,11,12],50,40,20).unwrap();
        assert_eq!(old,[
            json!({"ID":10,"ItemID":40700246,"X":40,"Y":20,"Orientation":"GridOrientation_Down","State":null}),
            json!({"ID":11,"ItemID":40700247,"X":40,"Y":22,"Orientation":"GridOrientation_Left","State":null}),
            json!({"ID":12,"ItemID":40700246,"X":40,"Y":24,"Orientation":"GridOrientation_Down","State":null})
        ]);
        assert_eq!(new,[
            json!({"ID":50,"ItemID":40700268,"X":40,"Y":20,"Orientation":"GridOrientation_Down","State":null}),
            json!({"ID":51,"ItemID":40700269,"X":40,"Y":22,"Orientation":"GridOrientation_Left","State":null}),
            json!({"ID":52,"ItemID":40700268,"X":40,"Y":24,"Orientation":"GridOrientation_Down","State":null})
        ]);
        let max=i32::MAX as u32;
        assert!(exact_frp01([10,11,12],max-3,max-4,max-6).is_some());
        for (ids,n,x,y) in [([0,11,12],50,40,20),([10,10,12],50,40,20),
            ([10,11,50],50,40,20),([10,11,12],0,40,20),([10,11,12],max-2,40,20),
            ([10,11,12],50,max-3,20),([10,11,12],50,40,max-5),
            ([10,11,12],50,u32::MAX,20),([10,11,12],50,40,u32::MAX)]{
            assert!(exact_frp01(ids,n,x,y).is_none());
        }
    }
}
