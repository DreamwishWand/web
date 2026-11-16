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

/// Exact Steam626 isolated ordinary Biome2Fence Base, one record only.
/// Pure layout; caller separately proves the external Steam Build, target
/// isolation/floor/footprint/references, rights, cost and stock CAS.
/// Neither a product admission nor a grant to modify Inventory.
#[allow(dead_code)]
pub(super) fn exact_steam626_fence_single_ortho(next:u32,x:u32,y:u32)->Option<Value>{
    if next==0||next.checked_add(1)?>i32::MAX as u32{return None}
    let [record]:[Value;1]=records_at(&[(40700246,0,0,false,false)],next,x,y).ok()?.try_into().ok()?;
    Some(record)
}
#[cfg(test)]
mod steam_single_fence_tests{
    use super::*;
    #[test]
    fn exact_steam626_single_ortho_base_no_other_record(){
        let a=exact_steam626_fence_single_ortho(50,40,20).unwrap();
        assert_eq!(a,json!({"ID":50,"ItemID":40700246,"X":40,"Y":20,"Orientation":"GridOrientation_Down","State":null}));
        let m=i32::MAX as u32;
        let edge=exact_steam626_fence_single_ortho(m-1,m,m).unwrap();
        assert_eq!(edge,json!({"ID":m-1,"ItemID":40700246,"X":m,"Y":m,"Orientation":"GridOrientation_Down","State":null}));
        for (n,x,y) in [(0,40,20),(m,40,20),(u32::MAX,40,20),
            (50,m+1,20),(50,40,m+1),(50,u32::MAX,20),(50,40,u32::MAX)]{
            assert!(exact_steam626_fence_single_ortho(n,x,y).is_none());
        }
    }
}
