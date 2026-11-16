//! Exact Switch626 FD01/FE01 geometry delta. No new generic topology or ambient grant.
use super::*;
use serde_json::json;
const BASE:u32=40700246;
const FD_EXT:u32=40700253;
const FE_OLD_EXT:u32=40700252;
const FE_NEW_EXT:u32=40700248;
// E3497 exact Switch626 raw payload pins; stride 1, logical 1x1 / 2x1.
// Only target-shape resolution uses these two new rows; existing ambient
// and Steam providers are untouched.
const FENCE_ROWS:[(u32,u32,u32,u32,&str);2]=[
 (FD_EXT,1,1,1,"b3b21c3f451c01c9908e34965480ceb14745b1a72825982c66ccc388dbdf8c78"),
 (FE_NEW_EXT,2,1,1,"6e5920e6c1bf9037ec0f40827b8deaa698bd39c0c59c55e656fceb4c601b0959"),
];
fn row(id:u32,item:u32,x:u32,y:u32,left:bool)->Value{
 json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null})
}
fn header(g:&Value,add:u32)->Option<u32>{
 if n(&g["ID"])?==0||g["GridDataPath"]!=GRID||g["GridDefaultLayoutPath"]!=""||n(&g["TessellationFactor"])?!=2{return None}
 let next=n(&g["NextGridObjectID"])?;if next==0||next.checked_add(add)?>i32::MAX as u32{return None}Some(next)
}
fn halo(x:u32,y:u32,w:u32,h:u32)->Rect{Rect(i64::from(x)-2,i64::from(y)-2,i64::from(x+w)+2,i64::from(y+h)+2)}
impl MeadowGeometry{
 fn fence_dimensions(&self,item:u32,common:&impl Fn(u32)->Option<(u32,u32)>)->Option<(u32,u32)>{
  if !self.switch626{return None}
  if let Some((_,w,h,t,pin))=FENCE_ROWS.iter().find(|r|r.0==item){if pin.len()!=64{return None}return scaled(*w,*h,*t)}
  self.dimensions(item,common)
 }
 fn target_cells(&self,x:u32,y:u32,w:u32,h:u32)->Option<Rect>{
  if x%2!=0||y%2!=0||x.checked_add(w)?>W||y.checked_add(h)?>H{return None}
  for a in 0..w{for b in 0..h{if !self.floor4(x+a,y+b){return None}}}Some(halo(x,y,w,h))
 }
 /// E3492 exact native bound for only this Switch626 class/state/orientation
 /// and unique current HouseItemID link. No fallback for unproved variants.
 pub(crate) fn fe01_house_bound(&self,o:&Value,houses:&Value)->Option<Rect>{
  if !self.switch626||!exact_fields(o,&["ID","ItemID","X","Y","Orientation","State"])||n(&o["ID"])?==0||
   n(&o["ItemID"])?!=20500024||o["Orientation"]!="GridOrientation_UpLeft"||!exact_fields(&o["State"],&["HouseData"]){return None}
  let p=&o["State"]["HouseData"];if !exact_fields(p,&["Built","PlayerHouseIndex","UpgradeState"])||p["Built"]!=true||
   !exact_fields(&p["UpgradeState"],&["Level"])||n(&p["UpgradeState"]["Level"])?!=1{return None}
  let hs=houses.as_array()?;let ix=n(&p["PlayerHouseIndex"])? as usize;
  if hs.is_empty()||hs.len()>4096||n(&hs.get(ix)?["HouseItemID"])?!=20500024||
   hs.iter().any(|v|!v.is_object()||n(&v["HouseItemID"]).is_none())||
   hs.iter().filter(|v|n(&v["HouseItemID"])==Some(20500024)).count()!=1{return None}
  let row=self.data["delta"].as_array()?.iter().find(|r|n(&r[0])==Some(20500024))?;
  if row[4]!="ea14f098d6468a0c6afe2645e3633f41a467edb20656f19a0823b1d6dbe4b351"||
   self.dimensions(20500024,|_|None)?!=(24,26){return None}
  // Native MoreRotationSize: integer abs sums /100 at coefficients -71/-71,
  // then tessellation 2/1; AddToGridCells uses nonnegative local offsets.
  let x=i64::from(n(&o["X"])?);let y=i64::from(n(&o["Y"])?);Some(Rect(x,y,x+34,y+34))
 }
 #[allow(dead_code)]
 pub(crate) fn local_fd01(&self,g:&Value,x:u32,y:u32,common:impl Fn(u32)->Option<(u32,u32)>,
  mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  let next=header(g,3)?;let objects=g["Objects"].as_object()?;
  if objects.is_empty()||objects.len()>4096||objects.contains_key("0")||
   self.fence_dimensions(BASE,&common)?!=(2,2)||self.fence_dimensions(FD_EXT,&common)?!=(2,2){return None}
  let mut boxes=Vec::with_capacity(3);
  for i in 0..3u32{boxes.push(self.target_cells(x.checked_add(2*i)?,y.checked_add(2*i)?,2,2)?);}
  self.clear_ambient(objects,next,&[],&boxes,&common,&mut effective)?;Some(next)
 }
 #[allow(dead_code)]
 pub(crate) fn local_fe01(&self,g:&Value,ids:[u32;4],common:impl Fn(u32)->Option<(u32,u32)>,
  mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  let next=header(g,4)?;let objects=g["Objects"].as_object()?;
  if objects.len()<4||objects.len()>4096||objects.contains_key("0")||
   ids.iter().any(|i|*i==0||*i>=next)||(0..4).any(|i|(i+1..4).any(|j|ids[i]==ids[j]))||
   self.fence_dimensions(BASE,&common)?!=(2,2)||self.fence_dimensions(FE_OLD_EXT,&common)?!=(12,2)||
   self.fence_dimensions(FE_NEW_EXT,&common)?!=(4,2){return None}
  let first=objects.get(&ids[0].to_string())?;let x=n(&first["X"])?;let y=n(&first["Y"])?;
  if x.checked_add(2)?>W||y.checked_add(18)?>H{return None}
  // Exact 01C retain endpoints, erase old extension/base, create two new
  // extensions and two bases. Old/new union is the same 2x18 footprint.
  let expected=[row(ids[0],BASE,x,y,false),row(ids[1],BASE,x,y+16,false),
   row(ids[2],FE_OLD_EXT,x,y+2,true),row(ids[3],BASE,x,y+14,false)];
  if ids.iter().zip(expected.iter()).any(|(id,w)|objects.get(&id.to_string())!=Some(w)){return None}
  let mut boxes=Vec::with_capacity(8);
  for (dy,h) in [(0,2),(16,2),(2,12),(14,2),(2,4),(6,2),(10,2),(12,4)]{boxes.push(self.target_cells(x,y+dy,2,h)?);}
  self.clear_ambient(objects,next,&ids,&boxes,&common,&mut effective)?;Some(next)
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn switch626_fence_frame_and_exact_house_bound(){
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();let steam=MeadowGeometry::fixed(BUILD,626).unwrap();
  assert_eq!(p.fence_dimensions(FD_EXT,&|_|None),Some((2,2)));assert_eq!(p.fence_dimensions(FE_NEW_EXT,&|_|None),Some((4,2)));
  assert!(steam.fence_dimensions(FD_EXT,&|_|None).is_none());assert!(p.dimensions(FD_EXT,|_|None).is_none());
  let h=json!({"ID":1,"ItemID":20500024,"X":40,"Y":20,"Orientation":"GridOrientation_UpLeft","State":{"HouseData":{"Built":true,"PlayerHouseIndex":0,"UpgradeState":{"Level":1}}}});
  let houses=json!([{"HouseItemID":20500024}]);assert_eq!(p.fe01_house_bound(&h,&houses),Some(Rect(40,20,74,54)));
  assert!(steam.fe01_house_bound(&h,&houses).is_none());
  for (field,v) in [("Built",json!(false)),("PlayerHouseIndex",json!(1)),("UpgradeState",json!({"Level":2}))]{let mut q=h.clone();q["State"]["HouseData"][field]=v;assert!(p.fe01_house_bound(&q,&houses).is_none());}
  let mut q=h.clone();q["Orientation"]=json!("GridOrientation_Down");assert!(p.fe01_house_bound(&q,&houses).is_none());
  let mut q=h.clone();q["State"]["HouseData"]["Cache"]=json!(true);assert!(p.fe01_house_bound(&q,&houses).is_none());
  assert!(p.fe01_house_bound(&h,&json!([{"HouseItemID":20500024},{"HouseItemID":20500024}])).is_none());
 }
}