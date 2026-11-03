//! Strictly scoped synthetic SaveSession semantic safety checks.
//! NEVER interprets an asserted graph as complete or grants Writer rights.
//! Full document JSON grammar is validated by core BEFORE these tiny snapshots.
use crate::{EngineResult,index_selected_tokens};
use crate::session::{Domain,ReferenceIndex};
use serde_json::Value;

const MAX_SCOPED_SUBTREE:usize=2*1024*1024;
fn scoped_value(raw:&str)->EngineResult<Value>{
 if raw.len()>MAX_SCOPED_SUBTREE{return Err("SOURCE_SUBTREE_AUDIT_TOO_LARGE");}
 serde_json::from_str(raw).map_err(|_|"SOURCE_SUBTREE_AUDIT_INVALID")
}

/// Do not silently discard existing nested object members when replacing
/// a subtree. Array removals/reorders without a domain-authenticated identity
/// mapping are NOT safe; this research port refuses shortening any array.
/// This deliberately does not prove that existing unknown *values* were
/// preserved by a caller-controlled semantic update; product guard remains OFF.
pub fn reject_structural_loss(old:&str,new:&str)->EngineResult<()>{
 let old=scoped_value(old)?;
 let new=scoped_value(new)?;
 fn check(old:&Value,new:&Value)->EngineResult<()>{
  match(old,new){
   (Value::Object(a),Value::Object(b))=>{
    for(k,v)in a{
     let updated=b.get(k).ok_or("STRUCTURAL_NESTED_FIELD_REMOVAL_UNVERIFIED")?;
     check(v,updated)?;
    }
   },
   (Value::Array(a),Value::Array(b))=>{
    if a.len()>b.len(){return Err("STRUCTURAL_ARRAY_REMOVAL_UNVERIFIED");}
    for(v,updated)in a.iter().zip(b.iter()){check(v,updated)?;}
   },
   (Value::Array(_),_)|(Value::Object(_),_)=>{
    return Err("STRUCTURAL_CONTAINER_TYPE_CHANGED");
   },
   _=>{}
  }
  Ok(())
 }
 check(&old,&new)
}

/// Only verify observed, recognized GridObject.Container -> Player.ContainerInventories
/// references from CURRENT save JSON. This is deliberately NOT complete Native
/// semantic reference extraction; all capability flags remain false.
/// To avoid unbounded full graph cloning, inspect two strictly size-capped
/// selected subtrees. If either shape is ambiguous, fail closed.
pub fn verify_observed_chest_edges(bytes:&[u8],refs:&ReferenceIndex)->EngineResult<()>{
 let paths=[
  "/World/GridCollection".to_owned(),
  "/Player/ContainerInventories".to_owned()
 ];
 let hits=index_selected_tokens(bytes,&paths)?;
 let grid=hits.iter().find(|v|v.pointer==paths[0]);
 let inv=hits.iter().find(|v|v.pointer==paths[1]);
 let Some(grid)=grid else {return Ok(());};
 let gv=scoped_value(&grid.value)?;
 let root=gv.as_object().ok_or("REFERENCE_GRID_SHAPE_UNVERIFIED")?;
 let grids=root.get("Grids").and_then(Value::as_object)
   .ok_or("REFERENCE_GRID_SHAPE_UNVERIFIED")?;
 let mut discovered=0usize;
 let parsed_inv=match inv{
  Some(i)=>Some(scoped_value(&i.value)?),
  None=>None
 };
 for (grid_key,grid_item) in grids {
  let objs=grid_item.get("Objects").and_then(Value::as_object)
   .ok_or("REFERENCE_OBJECT_SHAPE_UNVERIFIED")?;
  for (object_key,object) in objs {
   let Some(container)=object.get("Container") else {continue;};
   let name=container.as_str().ok_or("REFERENCE_CONTAINER_ID_INVALID")?;
   if name.is_empty()||name.len()>128{return Err("REFERENCE_CONTAINER_ID_INVALID");}
   let containers=parsed_inv.as_ref().and_then(Value::as_object)
     .ok_or("REFERENCE_CONTAINER_COLLECTION_MISSING")?;
   if !containers.contains_key(name){return Err("REFERENCE_CHEST_TARGET_MISSING_IN_SOURCE");}
   let prefix=format!("grid:{grid_key}:");
   let suffix=format!(":{object_key}");
   let matching_sources:Vec<_>=refs.nodes.iter().filter(|id|
    id.domain==Domain::Grid&&id.key.starts_with(&prefix)&&id.key.ends_with(&suffix)
   ).collect();
   if matching_sources.len()!=1{return Err("REFERENCE_GRID_IDENTITY_UNPROVEN");}
   let matching_targets:Vec<_>=refs.nodes.iter().filter(|id|
    matches!(id.domain,Domain::ContainerInventory|Domain::Chest)&&
    id.key==format!("chest:{name}")
   ).collect();
   if matching_targets.len()!=1{return Err("REFERENCE_CHEST_IDENTITY_UNPROVEN");}
   if !refs.edges.iter().any(|e|&e.from==matching_sources[0]&&&e.to==matching_targets[0]){
    return Err("REFERENCE_CHEST_EDGE_MISSING");
   }
   discovered+=1;
   if discovered>100_000{return Err("REFERENCE_AUDIT_EDGE_LIMIT");}
  }
 }
 Ok(())
}
