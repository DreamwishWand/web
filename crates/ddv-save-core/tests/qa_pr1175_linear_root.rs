#![cfg(feature="indexed-read")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,SpatialAreaRef,SpatialCandidateIndex,SpatialExtent,SpatialGridRef,SpatialObjectKey,SpatialObjectRef,SpatialScope,MAX_SPATIAL_GRIDS};
fn build()->BuildIdentity{BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}}
fn scope()->SpatialScope{SpatialScope{session_id:[9;16],revision:17,index_generation:31,decoded_sha256:[8;32]}}
fn key(g:u64,o:u64)->SpatialObjectKey{SpatialObjectKey{grid_id:g,object_id:o}}
fn obj(g:u64,o:u64,c:Option<u64>)->SpatialObjectRef{SpatialObjectRef{key:key(g,o),item_id:40000066,serialized_x:0,serialized_y:0,orientation:8,proposed_footprint:Some(SpatialExtent{width:1,height:1}),child_grid_id:c}}
fn grid(g:u64,p:Option<SpatialObjectKey>)->SpatialGridRef{SpatialGridRef{grid_id:g,proposed_bounds:Some(SpatialExtent{width:4,height:4}),parent_object:p}}
fn rnd(x:&mut u64)->u64{*x=x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);*x}
fn shuffle<T>(v:&mut [T],s:&mut u64){for i in (1..v.len()).rev(){let j=(rnd(s)%(i as u64+1)) as usize;v.swap(i,j)}}
#[test]
fn independent_forest_forward_owner_oracle_all_nodes(){
 let mut seed=13;let mut checked=0;
 for (n,roots,chain) in [(8192u64,1u64,true),(8192,64,false),(4096,256,false),(128,8,false),(1,1,false)]{
  let mut areas=Vec::new();let mut gs=Vec::new();let mut os=Vec::new();let mut owner=vec![0;n as usize+1];
  for id in 1..=n{
   let p=if id<=roots{None}else{Some(if chain{id-1}else{1+rnd(&mut seed)%(id-1)})};
   if let Some(p)=p{owner[id as usize]=owner[p as usize];gs.push(grid(id,Some(key(p,id+100))));os.push(obj(p,id+100,Some(id)));}
   else{owner[id as usize]=id;gs.push(grid(id,None));areas.push(SpatialAreaRef{village_index:(id%7) as u32,area_key:id+1000,root_grid_ids:vec![id]});}
   os.push(obj(id,1,None));
  }
  for _ in 0..2{
   shuffle(&mut gs,&mut seed);shuffle(&mut os,&mut seed);shuffle(&mut areas,&mut seed);
   let i=SpatialCandidateIndex::validate(&build(),scope(),&areas,&gs,&os).unwrap();
   for id in 1..=n{let h=i.inspect(scope(),key(id,1)).unwrap();let r=owner[id as usize];assert_eq!((h.root_grid_id,h.area_village_index,h.area_key),(r,(r%7) as u32,r+1000));assert_eq!(h.object.key,key(id,1));assert!(!h.native_layout_verified&&!h.source_session_authenticated&&!h.product_writer_authorized);checked+=1;}
   assert!(!i.product_read_accepted&&!i.product_writer_authorized&&!i.full_native_reference_closure_verified);
   let mut stale=scope();stale.index_generation+=1;assert!(i.inspect(stale,key(1,1)).is_err());
  }
 }
 println!("QA1175_FORWARD_FOREST_{checked}_OWNER_WITNESSES_PASS");
}
#[test]
fn malformed_components_never_publish_cached_owner(){
 let mut areas=vec![SpatialAreaRef{village_index:2,area_key:44,root_grid_ids:vec![1]}];
 let mut gs=vec![grid(1,None),grid(2,Some(key(1,9)))];
 let mut os=vec![obj(1,9,Some(2)),obj(2,1,None)];
 let deny=|a:&[SpatialAreaRef],g:&[SpatialGridRef],o:&[SpatialObjectRef],code:&str|{assert_eq!(SpatialCandidateIndex::validate(&build(),scope(),a,g,o).err().unwrap().0,code);};
 for id in 3..=1026{let p=if id==3{1026}else{id-1};let c=if id==1026{3}else{id+1};gs.push(grid(id,Some(key(p,9))));os.push(obj(id,9,Some(c)));}
 for _ in 0..2{deny(&areas,&gs,&os,"SPATIAL_SUBGRID_PARENT_CYCLE");gs.reverse();os.reverse();}
 gs.retain(|g|g.grid_id<=2);os.retain(|o|o.key.grid_id<=2);gs.push(grid(3,None));os.push(obj(3,1,None));
 deny(&areas,&gs,&os,"SPATIAL_GRID_NOT_REACHABLE_FROM_AREA");
 areas[0].root_grid_ids.push(3);assert!(SpatialCandidateIndex::validate(&build(),scope(),&areas,&gs,&os).is_ok());
 areas[0].root_grid_ids.push(2);deny(&areas,&gs,&os,"SPATIAL_ROOT_SUBGRID_OWNERSHIP_CONFLICT");areas[0].root_grid_ids.pop();
 areas.push(SpatialAreaRef{village_index:4,area_key:45,root_grid_ids:vec![1]});deny(&areas,&gs,&os,"SPATIAL_DUPLICATE_AREA_GRID_OWNER");areas.pop();
 os.push(obj(3,9,Some(2)));deny(&areas,&gs,&os,"SPATIAL_SUBGRID_PARENT_MISMATCH");os.pop();
 let mut wrong=build();wrong.schema=624;assert!(SpatialCandidateIndex::validate(&wrong,scope(),&areas,&gs,&os).is_err());
 let g:Vec<_>=(1..=MAX_SPATIAL_GRIDS as u64+1).map(|id|grid(id,None)).collect();deny(&areas,&g,&[],"SPATIAL_TYPED_SCOPE_BUDGET");
 println!("QA1175_CYCLE_ORPHAN_OWNER_ALIAS_BUILD_BOUND_DENIAL_PASS");
}
