//! Exact Switch624 FRP01 read-only geometry adapter. No 626 or Steam grant.
//! 624 floor/geometry/base source blobs 909a70f9/a5d4ec8b/a2a595ef:
//! all 19,600 floor cells, 72 installed dimension/stride rows equal existing
//! Meadow projection; only four missing 624 rows below. No new registry.
use super::*;
use serde_json::json;
pub(crate) const FRP_BUILD:&str="52BD625D9B4E0053";
const BASE:u32=40700246;const EXT:u32=40700247;const NEW_BASE:u32=40700268;const NEW_EXT:u32=40700269;
const EXTRA:[(u32,u32,u32,&str);4]=[
 (40700248,2,1,"6e5920e6c1bf9037ec0f40827b8deaa698bd39c0c59c55e656fceb4c601b0959"),
 (40700253,1,1,"b3b21c3f451c01c9908e34965480ceb14745b1a72825982c66ccc388dbdf8c78"),
 (NEW_BASE,1,1,"e967b9b3c71c759cf1eaba2a717defafa573e52681ed7de39005170f1d24a4ec"),
 (NEW_EXT,1,1,"f35fbcf3245c638d0a42281cd334fce8a4a3a4d3b34e2b8d693722663fab0a71"),
];
pub(crate) struct Frp624Geometry{provider:MeadowGeometry}
impl Frp624Geometry{
 pub(crate) fn fixed(build:&str,schema:u32)->Option<Self>{
  if build!=FRP_BUILD||schema!=624{return None}
  let mut p=MeadowGeometry::fixed(BUILD,626)?;
  // Independently decoded exact 624 floor record source bfd75928... and
  // semantic cda1a8c7...; floor4 projection is byte-identical.
  if format!("{:x}",Sha256::digest(&p.mask))!="8a585926ad08919aee80294ae14502efc5b2dae0ba22d7484b6871dce9d54c12"{return None}
  let a=p.data["delta"].as_array_mut()?;
  for (id,w,h,pin) in EXTRA{if a.iter().any(|r|n(&r[0])==Some(id)){return None}a.push(json!([id,w,h,1,pin]));}
  Some(Self{provider:p})
 }
 pub(crate) fn effective_building(&self,o:&Value,houses:&Value)->Option<Rect>{
  // Only two exact existing saved state/orientation/links; 624 installed
  // dimensions and stride match, actual historical cardinal footprints.
  self.provider.effective_building(o,houses)
 }
 pub(crate) fn diagonal_extension(&self,o:&Value,dims:(u32,u32))->Option<Rect>{
  if !exact_fields(o,&["ID","ItemID","X","Y","Orientation","State"])||n(&o["ID"])?==0||n(&o["ItemID"])?!=40700253||
     dims!=(2,2)||!matches!(o["Orientation"].as_str()?,"GridOrientation_Down"|"GridOrientation_Left")||
     o["State"]!=json!({"FenceMode":{"Diagonal":true}}){return None}
  let x=i64::from(n(&o["X"])?);let y=i64::from(n(&o["Y"])?);Some(Rect(x,y,x+2,y+2))
 }
 #[allow(dead_code)]
 pub(crate) fn local(&self,g:&Value,ids:[u32;3],common:impl Fn(u32)->Option<(u32,u32)>,
  mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  if n(&g["ID"])?==0||g["GridDataPath"]!=GRID||g["GridDefaultLayoutPath"]!=""||n(&g["TessellationFactor"])?!=2{return None}
  let next=n(&g["NextGridObjectID"])?;
  if next==0||next.checked_add(3)?>i32::MAX as u32||ids.iter().any(|i|*i==0||*i>=next)||
   ids[0]==ids[1]||ids[0]==ids[2]||ids[1]==ids[2]{return None}
  let objects=g["Objects"].as_object()?;if objects.len()<3||objects.len()>4096||objects.contains_key("0"){return None}
  for item in [BASE,EXT,NEW_BASE,NEW_EXT]{if self.provider.dimensions(item,&common)?!=(2,2){return None}}
  let first=objects.get(&ids[0].to_string())?;let x=n(&first["X"])?;let y=n(&first["Y"])?;
  if x%2!=0||y%2!=0||x.checked_add(2)?>W||y.checked_add(6)?>H{return None}
  let row=|id,item,dy,left|json!({"ID":id,"ItemID":item,"X":x,"Y":y+dy,
    "Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null});
  let expected=[row(ids[0],BASE,0u32,false),row(ids[1],EXT,2,true),row(ids[2],BASE,4,false)];
  if ids.iter().zip(expected.iter()).any(|(i,v)|objects.get(&i.to_string())!=Some(v)){return None}
  let mut boxes=Vec::with_capacity(3);
  for i in 0..3u32{let a=y+2*i;for dx in 0..2{for dy in 0..2{if !self.provider.floor4(x+dx,a+dy){return None}}}
   boxes.push(Rect(i64::from(x)-2,i64::from(a)-2,i64::from(x)+4,i64::from(a)+4));}
  // Exact old3 only. Keep the full conservative ambient bound; no 40005494
  // special case until a separate exact Native effective-bound proof exists.
  self.provider.clear_ambient(objects,next,&ids,&boxes,&common,&mut effective)?;Some(next)
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn switch624_frp_provider_exact_build_and_delta(){
  assert!(Frp624Geometry::fixed("9A239D3DB569756D",626).is_none());
  assert!(Frp624Geometry::fixed(FRP_BUILD,626).is_none());
  let p=Frp624Geometry::fixed(FRP_BUILD,624).unwrap();
  for i in [BASE,EXT,NEW_BASE,NEW_EXT,40700253]{assert_eq!(p.provider.dimensions(i,|_|Some((1,1))),Some((2,2)));}
  assert_eq!(p.provider.dimensions(40700248,|_|None),Some((4,2)));
  let o=json!({"ID":10,"ItemID":40700253,"X":40,"Y":20,"Orientation":"GridOrientation_Left","State":{"FenceMode":{"Diagonal":true}}});
  assert_eq!(p.diagonal_extension(&o,(2,2)),Some(Rect(40,20,42,22)));
  let mut q=o.clone();q["State"]["FenceMode"]["Diagonal"]=json!(false);assert!(p.diagonal_extension(&q,(2,2)).is_none());
 }
}
