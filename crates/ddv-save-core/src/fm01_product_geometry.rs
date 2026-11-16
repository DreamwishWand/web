//! FM01 fixed preserve-one local geometry. 01C's accepted historical_collect
//! exact old/new descriptor contract; no new topology compiler or write grant.
use super::*;
use serde_json::json;
const BASE:u32=40700246;
const EXT:u32=40700247;
fn row(id:u32,item:u32,x:u32,y:u32,left:bool)->Value{
 json!({"ID":id,"ItemID":item,"X":x,"Y":y,
        "Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null})
}
impl MeadowGeometry{
 /// Use only after the caller binds the exact Switch626 session and typed old/fresh reference census.
 #[allow(dead_code)]
 pub(crate) fn local_fm01_with_buildings(&self,grid:&Value,ids:[u32;5],houses:&Value,
   common:impl Fn(u32)->Option<(u32,u32)>,mut other:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  self.local_fm01(grid,ids,common,|o,dims|match n(&o["ItemID"])?{
   20500005|20300115=>self.effective_building(o,houses),
   _=>other(o,dims),
  })
 }
 #[allow(dead_code)]
 pub(crate) fn local_fm01(&self,grid:&Value,ids:[u32;5],
  common:impl Fn(u32)->Option<(u32,u32)>,mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  if n(&grid["ID"])?==0||grid["GridDataPath"]!=GRID||grid["GridDefaultLayoutPath"]!=""||n(&grid["TessellationFactor"])?!=2{return None}
  let next=n(&grid["NextGridObjectID"])?;
  if next==0||next.checked_add(3)?>i32::MAX as u32||ids.iter().any(|i|*i==0||*i>=next)
     ||(0..5).any(|i|(i+1..5).any(|j|ids[i]==ids[j])){return None}
  let objects=grid["Objects"].as_object()?;
  if objects.len()<5||objects.len()>4096||objects.contains_key("0")
    ||self.dimensions(BASE,&common)?!=(2,2)||self.dimensions(EXT,&common)?!=(2,2){return None}
  let first=objects.get(&ids[0].to_string())?;let x=n(&first["X"])?;let y=n(&first["Y"])?;
  if x%2!=0||y%2!=0||x.checked_add(6)?>W||y.checked_add(8)?>H{return None}
  // Exact five old descriptors from the accepted 01C preserve-one FM01.
  let expected=[row(ids[0],BASE,x,y,false),row(ids[1],EXT,x+2,y,false),
    row(ids[2],BASE,x+4,y,false),row(ids[3],EXT,x+4,y+2,true),row(ids[4],BASE,x+4,y+4,false)];
  if ids.iter().zip(expected.iter()).any(|(id,w)|objects.get(&id.to_string())!=Some(w)){return None}
  // Old/new union: keep first, erase four, add at (0,2),(0,4),(2,6).
  // All eight footprints are exact 2x2; the diagonal new base remains 2x2.
  let anchors=[(x,y),(x+2,y),(x+4,y),(x+4,y+2),(x+4,y+4),(x,y+2),(x,y+4),(x+2,y+6)];
  let mut boxes=Vec::with_capacity(8);
  for (a,b) in anchors{
   for dx in 0..2{for dy in 0..2{if !self.floor4(a+dx,b+dy){return None}}}
   boxes.push(Rect(i64::from(a)-2,i64::from(b)-2,i64::from(a)+4,i64::from(b)+4));
  }
  self.clear_ambient(objects,next,&ids,&boxes,&common,&mut effective)?;
  Some(next)
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn switch626_fm01_exact_old_new_union_and_halo(){
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let common=|i|if [BASE,EXT].contains(&i){Some((1,1))}else if i==ROAD{Some((2,2))}else{None};
  let (x,y)=(0..W-5).step_by(2).flat_map(|a|(0..H-7).step_by(2).map(move|b|(a,b)))
   .find(|&(a,b)|[(a,b),(a+2,b),(a+4,b),(a+4,b+2),(a+4,b+4),(a,b+2),(a,b+4),(a+2,b+6)].iter()
    .all(|&(c,d)|(0..2).all(|i|(0..2).all(|j|p.floor4(c+i,d+j))))).unwrap();
  let ids=[1,2,3,4,5];
  let mut g=json!({"ID":42,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":10,
    "Objects":{"1":row(1,BASE,x,y,false),"2":row(2,EXT,x+2,y,false),"3":row(3,BASE,x+4,y,false),
    "4":row(4,EXT,x+4,y+2,true),"5":row(5,BASE,x+4,y+4,false)}});
  let rect=|o:&Value,d:(u32,u32)|{let a=i64::from(n(&o["X"])?);let b=i64::from(n(&o["Y"])?);Some(Rect(a,b,a+i64::from(d.0),b+i64::from(d.1)))};
  assert_eq!(p.local_fm01(&g,ids,common,rect),Some(10));
  assert!(p.local_fm01(&g,[1,2,3,4,4],common,rect).is_none());
  assert!(p.local_fm01(&g,[1,3,2,4,5],common,rect).is_none());
  for (k,v) in [("GridDefaultLayoutPath",json!("foreign")),("TessellationFactor",json!(1)),("NextGridObjectID",json!(i32::MAX))]{
   let mut q=g.clone();q[k]=v;assert!(p.local_fm01(&q,ids,common,rect).is_none());
  }
  for (k,v) in [("ItemID",json!(40700248)),("X",json!(x+1)),("State",json!({"FenceMode":{"Diagonal":true}})),("Orientation",json!("GridOrientation_Left"))]{
   let mut q=g.clone();q["Objects"]["2"][k]=v;assert!(p.local_fm01(&q,ids,common,rect).is_none());
  }
  // Existing non-target rows may not overlap either old or new union/halo.
  for (a,b) in [(x,y),(x+2,y+6),(x+6,y+4)]{
   g["Objects"]["6"]=row(6,BASE,a,b,false);
   assert!(p.local_fm01(&g,ids,common,rect).is_none());
  }
  g["Objects"].as_object_mut().unwrap().remove("6");
  assert!(p.local_fm01(&g,ids,|_|None,rect).is_none());
  assert_eq!(p.local_fm01(&g,ids,common,rect),Some(10));
 }
}
