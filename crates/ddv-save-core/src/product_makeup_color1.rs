//! ACT1486: exact Steam626 active MaleAvatar Makeup slot1 ColorIndex1 53->60.
//! Existing Avatar observer + one ProductSession/semantic ledger. No generic
//! Cosmetics selection, rights grant, public WASM ABI, P1G mutation or ON.
use super::*;
use super::appearance_observer::*;
use serde_json::{json,Value};
const SLOT:u32=1;
const ITEM:i32=140100014;
const OLD:i32=53;
const NEW:i32=60;
#[derive(Debug)]
pub(super) struct FixedMakeupColor1{
 pub(super) scope:WorkerEnvelope,pub(super) span:Span,
 pub(super) token_sha:String,pub(super) female_sha:String,
 pub(super) male_sha:String,pub(super) entry_sha:String,
 pub(super) routes_sha:String,pub(super) projected:[u8;32],
}
// Exact physical saved slot; never create, remap or select a new item.
fn slot1(b:&[u8],avatar:Span)->CoreResult<(Span,Span)>{
 let f=members(b,avatar,MAX_AVATAR_FIELDS)?;
 let m=required(&f,"Makeup")?;
 let mut selected=None;
 for (key,span) in members(b,m,MAX_MAKEUP)?{
  let slot=key_u32(&key)?;
  if slot>=MAX_MAKEUP as u32{return Err(denied("MAKEUP_COLOR1_SLOT_BOUND"));}
  if slot==SLOT{
   if selected.replace(span).is_some(){return Err(denied("MAKEUP_COLOR1_SLOT_ALIAS"));}
  }
 }
 let entry=selected.ok_or(denied("MAKEUP_COLOR1_SLOT_ABSENT"))?;
 let fs=members(b,entry,32)?;
 if int(b,required(&fs,"MakeupItemID")?)?!=ITEM{return Err(denied("MAKEUP_COLOR1_EXACT_ITEM"));}
 // Native disabled channels are preserved; this operation may never enable them.
 for name in ["ColorIndex2","ColorIndex3"]{
  if int(b,required(&fs,name)?)?!=-1{return Err(denied("MAKEUP_COLOR1_DISABLED_CHANNEL"));}
 }
 Ok((entry,required(&fs,"ColorIndex1")?))
}
fn ok(b:bool,s:&'static str)->CoreResult<()>{if b{Ok(())}else{Err(denied(s))}}
impl ProductSession{
 pub(super) fn prepare_fixed_makeup_color1(&self,e:WorkerEnvelope)->CoreResult<FixedMakeupColor1>{
  product_appearance_scope(self,&e)?;
  self.prepare_fixed_makeup_color1_lexical(e)
 }
 fn prepare_fixed_makeup_color1_lexical(&self,e:WorkerEnvelope)->CoreResult<FixedMakeupColor1>{
  let st=self.lock()?;validate_scope(self,&st,&e)?;
  ok(st.revision==0&&st.generation==1&&st.semantic.is_none(),"MAKEUP_COLOR1_EPOCH")?;
  let b=&self.decoded;let root=roots(b)?;
  let p=members(b,root.player,1024)?;
  let male=required(&p,"AvatarIsMale")?;
  ok(&b[male.begin..male.end]==b"true","MAKEUP_COLOR1_MALE_ACTIVE")?;
  let fs=required(&p,"FemaleAvatar")?;
  let ms=required(&p,"MaleAvatar")?;
  let f=branch(b,fs)?;let m=branch(b,ms)?;
  ok(f.clothes.present&&f.incompatible.present&&f.makeup.present&&f.customization.present&&
     m.clothes.present&&m.incompatible.present&&m.makeup.present&&m.customization.present,
     "MAKEUP_COLOR1_REFERENCE_MAPS")?;
  let (_,other)=slot1(b,fs)?;
  let (entry,span)=slot1(b,ms)?;
  ok(int(b,other)?==NEW&&int(b,span)?==OLD&&NEW>=0&&NEW<75,"MAKEUP_COLOR1_FIXED_PAIR")?;
  // Existing branch observer validates other scalar kinds but cannot authorize
  // rights, status, a non-packaged item, or a new/absent field.
  let _=branch_dependencies(b,ms)?;let _=branch_dependencies(b,fs)?;
  let owner=inventory_dependencies(b,required(&p,"ListInventories")?,&f,&m)?;
  ok(owner["allFourMapsPerBranchPresent"]==true&&
     owner["allObservedReferencesHavePositiveSavedAmount"]==true,
     "MAKEUP_COLOR1_STOCK_REFS")?;
  let routes=owner["routes"].as_array().ok_or(denied("MAKEUP_COLOR1_ROUTES"))?;
  ok(routes.len()==2&&routes[1]["inventoryId"]==3&&routes[1]["compatibleItemType"]=="ItemType_Makeup",
     "MAKEUP_COLOR1_ROUTE3")?;
  let entries=routes[1]["entries"].as_array().ok_or(denied("MAKEUP_COLOR1_ENTRIES"))?;
  let selected=entries.iter().filter(|v|v["itemId"]==ITEM).collect::<Vec<_>>();
  ok(selected.len()==1&&selected[0]["present"]==true&&
     selected[0]["positiveSavedAmount"]==true&&
     selected[0]["savedMarker"]=="ItemMarker_None","MAKEUP_COLOR1_STOCK_MARKER")?;
  for r in routes{
   for e in r["entries"].as_array().ok_or(denied("MAKEUP_COLOR1_ENTRY_ROUTE"))?{
    ok(e["markerPresent"]==true,"MAKEUP_COLOR1_MARKER_REQUIRED")?;
   }
  }
  let selected_sha=sha(&b[span.begin..span.end]);
  let projected=self.project_appearance_scalar_candidate(span,OLD,NEW)?;
  Ok(FixedMakeupColor1{scope:e,span,token_sha:selected_sha,
   female_sha:f.sha,male_sha:m.sha,entry_sha:sha(&b[entry.begin..entry.end]),
   routes_sha:sha(&serde_json::to_vec(&owner).map_err(|_|denied("MAKEUP_COLOR1_ROUTE_JSON"))?),
   projected})
 }
 // ACT1487 build-only adapter. Steam's accepted method stays Steam-only.
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 pub(super) fn prepare_switch626_fixed_makeup_color1(&self,e:WorkerEnvelope)->CoreResult<FixedMakeupColor1>{
  use crate::{Platform,BuildKind};
  let b=&self.native_source_build;
  if !self.worker_bound||b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
     b.build_id!="9A239D3DB569756D"||b.schema!=626||!b.externally_attested{
    return Err(denied("MAKEUP_COLOR1_EXACT_SWITCH626_REQUIRED"));
  }
  self.prepare_fixed_makeup_color1_lexical(e)
 }
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 pub(super) fn stage_switch626_fixed_makeup_color1(&self,e:WorkerEnvelope,p:&FixedMakeupColor1)
     ->CoreResult<crate::SemanticStageReceipt>{
  ok(e.action==WorkerAction::Stage,"MAKEUP_COLOR1_SWITCH_STAGE_ACTION")?;
  let now=self.prepare_switch626_fixed_makeup_color1(WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
  ok(now.scope==p.scope&&now.span.begin==p.span.begin&&now.span.end==p.span.end&&
     now.token_sha==p.token_sha&&now.entry_sha==p.entry_sha&&
     now.female_sha==p.female_sha&&now.male_sha==p.male_sha&&
     now.routes_sha==p.routes_sha&&now.projected==p.projected,
     "MAKEUP_COLOR1_SWITCH_STAGE_CAS")?;
  self.commit_switch626_makeup_color1_candidate(e,now.span,OLD,NEW,now.projected)
 }
 pub(super) fn stage_fixed_makeup_color1(&self,e:WorkerEnvelope,p:&FixedMakeupColor1)
     ->CoreResult<crate::SemanticStageReceipt>{
  ok(e.action==WorkerAction::Stage,"MAKEUP_COLOR1_STAGE_ACTION")?;
  let now=self.prepare_fixed_makeup_color1(WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
  ok(now.scope==p.scope&&now.span.begin==p.span.begin&&now.span.end==p.span.end&&
     now.token_sha==p.token_sha&&now.entry_sha==p.entry_sha&&
     now.female_sha==p.female_sha&&now.male_sha==p.male_sha&&
     now.routes_sha==p.routes_sha&&now.projected==p.projected,
     "MAKEUP_COLOR1_STAGE_CAS")?;
  self.commit_appearance_scalar_candidate(e,now.span,OLD,NEW,now.projected)
 }
}

#[cfg(test)]
mod tests{
 use super::*;
 use crate::{BuildIdentity,BuildKind,Platform};
 fn avatar(color:i32)->Value{json!({
  "HairColorIndex":32,"HairHighlightColor":4,"Clothes":{"0":50000001},
  "IncompatibleClothes":{},"ClothingCustomization":{},
  "Makeup":{"1":{"MakeupItemID":ITEM,"ColorIndex1":color,
                   "ColorIndex2":-1,"ColorIndex3":-1,"Opacity":0.5,"Gloss":0.25,
                   "KeepOpaque":{"notEdited":7}}}
 })}
 fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},
  "Player":{"AvatarIsMale":true,"FemaleAvatar":avatar(NEW),"MaleAvatar":avatar(OLD),
    "ListInventories":{
      "1":{"ID":1,"CompatibleItemType":"ItemType_Clothing",
           "Inventory":{"50000001":{"Amount":1,"Marker":"ItemMarker_None"}}},
      "3":{"ID":3,"CompatibleItemType":"ItemType_Makeup",
           "Inventory":{"140100014":{"Amount":2,"Marker":"ItemMarker_None","KeepOpaque":42}}}
    }}})}
 fn open(v:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
    build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true}).unwrap();
  s.worker_bound=true;s
 }
 fn env(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{
  let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
    session_id:r.session_id,expected_revision:r.revision,
    expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}
 }
 #[test]fn makeup_color1_exact1_product_atomic_reopen(){
  let d=doc();let bytes=serde_json::to_vec(&d).unwrap();let s=open(&d);
  let read=env(&s,WorkerAction::ReadDomain);let p=s.prepare_fixed_makeup_color1(read).unwrap();
  assert_eq!(&s.decoded[p.span.begin..p.span.end],b"53");
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..read};
  assert!(s.stage_fixed_makeup_color1(read,&p).is_err());
  let foreign=open(&d);assert!(foreign.stage_fixed_makeup_color1(env(&foreign,WorkerAction::Stage),&p).is_err());
  let mut forged=s.prepare_fixed_makeup_color1(read).unwrap();
  forged.projected[0]^=1;assert!(s.stage_fixed_makeup_color1(stage,&forged).is_err());
  assert!(s.stage_fixed_makeup_color1(WorkerEnvelope{expected_revision:1,..stage},&p).is_err());
  assert!(s.stage_fixed_makeup_color1(WorkerEnvelope{expected_decoded_sha256:[0;32],..stage},&p).is_err());
  let receipt=s.stage_fixed_makeup_color1(stage,&p).unwrap();
  assert_eq!((receipt.operation_count,receipt.exact_field_changed_count),(1,1));
  assert!(!receipt.product_writer_authorized);assert!(!receipt.original_overwrite_authorized);
  assert!(s.stage_fixed_makeup_color1(stage,&p).is_err());
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  let outenv=env(&s,WorkerAction::ExportEditedCopy);
  let out=s.take_typed_semantic_decoded_once(outenv).unwrap();
  assert!(s.take_typed_semantic_decoded_once(outenv).is_err());
  let mut wanted=d.clone();
  wanted["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(NEW);
  assert_eq!(out,serde_json::to_vec(&wanted).unwrap());
  assert_eq!(serde_json::to_vec(&d).unwrap(),bytes);
  assert_eq!(sha(&out),hex(&receipt.staged_decoded_sha256));
  let reopened=open(&wanted);
  assert_eq!(reopened.receipt().unwrap().schema,626);
 }
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 fn open_switch(v:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),
   BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
    build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  s.worker_bound=true;s
 }
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 #[test]fn switch626_makeup_color1_build_adapter_exact1_atomic_reopen(){
  let d=doc();let source=serde_json::to_vec(&d).unwrap();let s=open_switch(&d);
  let e=env(&s,WorkerAction::ReadDomain);
  assert!(s.prepare_fixed_makeup_color1(e).is_err(),"Steam API must not accept Switch");
  let p=s.prepare_switch626_fixed_makeup_color1(e).unwrap();
  assert_eq!(s.receipt().unwrap().revision,0);
  assert_eq!(&s.decoded[p.span.begin..p.span.end],b"53");
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(s.stage_switch626_fixed_makeup_color1(e,&p).is_err());
  let mut forged=s.prepare_switch626_fixed_makeup_color1(e).unwrap();
  forged.projected[0]^=1;
  assert!(s.stage_switch626_fixed_makeup_color1(stage,&forged).is_err());
  for bad in [WorkerEnvelope{expected_revision:1,..stage},
              WorkerEnvelope{expected_index_generation:2,..stage},
              WorkerEnvelope{expected_decoded_sha256:[0;32],..stage}]{
   assert!(s.stage_switch626_fixed_makeup_color1(bad,&p).is_err());
  }
  let other=open_switch(&d);
  assert!(other.stage_switch626_fixed_makeup_color1(env(&other,WorkerAction::Stage),&p).is_err());
  let steam=open(&d);
  assert!(steam.prepare_switch626_fixed_makeup_color1(env(&steam,WorkerAction::ReadDomain)).is_err());
  let r=s.stage_switch626_fixed_makeup_color1(stage,&p).unwrap();
  assert_eq!((r.operation_count,r.exact_field_changed_count),(1,1));
  assert!(!r.native_v3_verified&&!r.product_writer_authorized&&!r.original_overwrite_authorized);
  assert!(s.stage_switch626_fixed_makeup_color1(stage,&p).is_err());
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  let out_e=env(&s,WorkerAction::ExportEditedCopy);
  let out=s.take_typed_semantic_decoded_once(out_e).unwrap();
  assert!(s.take_typed_semantic_decoded_once(out_e).is_err());
  let mut expected=d.clone();expected["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(NEW);
  assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
  assert_eq!(out,serde_json::to_vec(&expected).unwrap());
  assert_eq!(sha(&out),hex(&r.staged_decoded_sha256));
  assert_eq!(serde_json::to_vec(&d).unwrap(),source);
  let fresh=open_switch(&expected);assert_eq!(fresh.receipt().unwrap().schema,626);
 }
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 #[test]fn switch626_makeup_color1_build_adapter_negatives(){
  for i in 0..11{
   let mut d=doc();
   match i{
    0=>d["Player"]["AvatarIsMale"]=json!(false),
    1=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(52),
    2=>d["Player"]["FemaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(59),
    3=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["MakeupItemID"]=json!(140100015),
    4=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex2"]=json!(20),
    5=>{d["Player"]["MaleAvatar"]["Makeup"].as_object_mut().unwrap().remove("1");},
    6=>d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]["Amount"]=json!(0),
    7=>d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]["Marker"]=json!("ItemMarker_Favorite"),
    8=>d["Player"]["ListInventories"]["3"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
    9=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex3"]=json!(30),
    _=>d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]=Value::Null,
   }
   let s=open_switch(&d);
   assert!(s.prepare_switch626_fixed_makeup_color1(env(&s,WorkerAction::ReadDomain)).is_err(),"negative {i}");
  }
 }
 #[test]fn makeup_color1_exact1_product_denials(){
  for i in 0..9{
   let mut d=doc();
   match i{
    0=>d["Player"]["AvatarIsMale"]=json!(false),
    1=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(52),
    2=>d["Player"]["FemaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(59),
    3=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["MakeupItemID"]=json!(140100015),
    4=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex2"]=json!(20),
    5=>d["Player"]["MaleAvatar"]["Makeup"].as_object_mut().unwrap().remove("1").map(|_|()).unwrap_or(()),
    6=>d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]["Amount"]=json!(0),
    7=>d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]["Marker"]=json!("ItemMarker_Favorite"),
    _=>d["Player"]["ListInventories"]["3"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
   }
   let s=open(&d);assert!(s.prepare_fixed_makeup_color1(env(&s,WorkerAction::ReadDomain)).is_err(),"negative {i}");
  }
 }

 #[cfg(feature="product-switch626-makeup-color1-internal")]
 #[test]
 fn qa1902_switch_opaque_cas_and_build_exclusion(){
  let mut d=doc();
  d["World"]["UnrelatedOpaque"]=json!({"Escaped":"a\\b","Array":[null,42,true],"UnknownId":9001});
  d["Player"]["MaleAvatar"]["Makeup"]["1"]["KeepOpaque"]=json!({"Nested":{"x":7},"Path":"a/b"});
  let original=serde_json::to_vec(&d).unwrap();
  let s=open_switch(&d);let read=env(&s,WorkerAction::ReadDomain);
  let p=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  assert_eq!(&s.decoded[p.span.begin..p.span.end],b"53");
  assert!(s.prepare_fixed_makeup_color1(read).is_err());
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..read};
  let mut negatives=1usize;
  macro_rules! deny {($expr:expr)=>{{assert!(($expr).is_err());negatives+=1;}};}
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.token_sha="0".repeat(64);deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.female_sha="0".repeat(64);deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.male_sha="0".repeat(64);deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.entry_sha="0".repeat(64);deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.routes_sha="0".repeat(64);deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.projected[0]^=1;deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.span.begin+=1;deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  let mut bad=s.prepare_switch626_fixed_makeup_color1(read).unwrap();
  bad.scope.expected_revision=2;deny!(s.stage_switch626_fixed_makeup_color1(stage,&bad));
  deny!(s.stage_switch626_fixed_makeup_color1(read,&p));
  deny!(s.stage_switch626_fixed_makeup_color1(WorkerEnvelope{expected_revision:1,..stage},&p));
  deny!(s.stage_switch626_fixed_makeup_color1(WorkerEnvelope{expected_index_generation:2,..stage},&p));
  deny!(s.stage_switch626_fixed_makeup_color1(WorkerEnvelope{expected_decoded_sha256:[0;32],..stage},&p));
  deny!(s.stage_switch626_fixed_makeup_color1(WorkerEnvelope{session_id:[0;16],..stage},&p));
  let foreign=open_switch(&d);
  deny!(foreign.stage_switch626_fixed_makeup_color1(env(&foreign,WorkerAction::Stage),&p));
  let steam=open(&d);
  deny!(steam.prepare_switch626_fixed_makeup_color1(env(&steam,WorkerAction::ReadDomain)));
  for (id,attested) in [("WRONG_BID",true),("9A239D3DB569756D",false)]{
   let b=BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
      build_id:id.into(),schema:626,externally_attested:attested};
   match ProductSession::open_decoded_readonly(original.clone(),b){
    Err(_)=>negatives+=1,
    Ok(mut alt)=>{alt.worker_bound=true;deny!(alt.prepare_switch626_fixed_makeup_color1(env(&alt,WorkerAction::ReadDomain)));},
   }
  }
  let r=s.stage_switch626_fixed_makeup_color1(stage,&p).unwrap();
  assert_eq!((r.operation_count,r.exact_field_changed_count),(1,1));
  assert!(!r.native_v3_verified&&!r.product_writer_authorized&&!r.original_overwrite_authorized);
  deny!(s.stage_switch626_fixed_makeup_color1(stage,&p));
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  deny!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)));
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  let ex=env(&s,WorkerAction::ExportEditedCopy);
  let out=s.take_typed_semantic_decoded_once(ex).unwrap();
  deny!(s.take_typed_semantic_decoded_once(ex));
  let mut want=d.clone();want["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(60);
  assert_eq!(out,serde_json::to_vec(&want).unwrap());
  assert_eq!(serde_json::to_vec(&d).unwrap(),original);
  assert_eq!(sha(&out),hex(&r.staged_decoded_sha256));
  std::fs::write("/tmp/qrc1902-switch-makeup-edited.json",&out).unwrap();
  std::fs::write("/tmp/qrc1902-switch-makeup-original.json",&original).unwrap();
  println!("QRC1902_SWITCH_MAKEUP_EXACT1_ACTUAL 1POS {}NEG SHA_ORIGINAL_UNCHANGED",negatives);
 }
 #[cfg(feature="product-switch626-makeup-color1-internal")]
 #[test]
 #[ignore="QA-only independent process after exact output stage"]
 fn qa1902_switch_makeup_child_reopen(){
  let bytes=std::fs::read("/tmp/qrc1902-switch-makeup-edited.json").unwrap();
  let raw=std::fs::read("/tmp/qrc1902-switch-makeup-original.json").unwrap();
  let v:Value=serde_json::from_slice(&bytes).unwrap();
  assert_eq!(v["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"],json!(60));
  let s=open_switch(&v);assert_eq!(s.receipt().unwrap().schema,626);
  assert!(s.prepare_switch626_fixed_makeup_color1(env(&s,WorkerAction::ReadDomain)).is_err());
  assert_ne!(sha(&raw),sha(&bytes));
  let before:Value=serde_json::from_slice(&raw).unwrap();
  assert_eq!(before["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"],json!(53));
  println!("QRC1902_SWITCH_MAKEUP_CHILD_REOPEN_PASS schema626 exact1");
 }
}
