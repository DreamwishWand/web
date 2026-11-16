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

 #[test]fn qa1891_makeup_color1_lexical_exact1(){
  let mut d=doc();d["Opaque"]=json!({"escaped":"keep","decoy":[53,60]});
  d["Player"]["MaleAvatar"]["Makeup"]["1"]["KeepOpaque"]=json!({"raw":"keep","decoy":53});
  let raw=serde_json::to_string(&d).unwrap().replace("\"escaped\":\"keep\"","\"escaped\":\"\\u006beep\"");
  let build=BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
   build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true};
  let mut s=ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),build.clone()).unwrap();s.worker_bound=true;
  let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();let p=s.prepare_fixed_makeup_color1(e).unwrap();
  assert_eq!(&s.decoded[p.span.begin..p.span.end],b"53");
  let st=WorkerEnvelope{action:WorkerAction::Stage,..e};let mut neg=0;
  assert!(s.stage_fixed_makeup_color1(e,&p).is_err());neg+=1;
  for bad in [WorkerEnvelope{expected_revision:1,..st},
              WorkerEnvelope{expected_index_generation:2,..st},
              WorkerEnvelope{expected_decoded_sha256:[0;32],..st}]{
   assert!(s.stage_fixed_makeup_color1(bad,&p).is_err());neg+=1;
  }
  let mut forged=s.prepare_fixed_makeup_color1(e).unwrap();forged.projected[0]^=1;
  assert!(s.stage_fixed_makeup_color1(st,&forged).is_err());neg+=1;
  let mut foreign=ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),build).unwrap();foreign.worker_bound=true;
  assert!(foreign.stage_fixed_makeup_color1(env(&foreign,WorkerAction::Stage),&p).is_err());neg+=1;
  assert_eq!(s.receipt().unwrap(),before);
  let r=s.stage_fixed_makeup_color1(st,&p).unwrap();
  assert_eq!((r.operation_count,r.exact_field_changed_count),(1,1));
  assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);
  assert!(s.stage_fixed_makeup_color1(st,&p).is_err());neg+=1;
  s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());neg+=1;
  s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
  let ex=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();
  assert!(s.take_typed_semantic_decoded_once(ex).is_err());neg+=1;
  let mut want=d.clone();want["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"]=json!(60);
  let expected=serde_json::to_string(&want).unwrap().replace("\"escaped\":\"keep\"","\"escaped\":\"\\u006beep\"");
  assert_eq!(out,expected.as_bytes());assert_eq!(s.decoded.as_ref(),raw.as_bytes());
  assert_eq!(want["Player"]["ListInventories"],d["Player"]["ListInventories"]);
  assert_eq!(want["Player"]["FemaleAvatar"],d["Player"]["FemaleAvatar"]);
  assert_eq!(sha(&out),hex(&r.staged_decoded_sha256));
  std::fs::write("/tmp/qrc1891-makeup1-reopen.json",out).unwrap();
  assert_eq!(neg,9);
  println!("QRC1891_MAKEUP_COLOR1_ACTUAL 1POS {neg}NEG EXACT1 LEXICAL_ORIGINAL_UNCHANGED");
 }
 #[test]fn qa1891_makeup_color1_child_reopen(){
  let out=std::fs::read("/tmp/qrc1891-makeup1-reopen.json").unwrap();
  let build=BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
    build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true};
  let s=ProductSession::open_decoded_readonly(out.clone(),build).unwrap();let r=s.receipt().unwrap();
  assert_eq!((r.revision,r.index_generation,r.schema),(0,1,626));
  assert_eq!(sha(&out),hex(&r.decoded_sha256));
  assert!(!r.writer_authorized&&!r.edited_copy_authorized&&!r.apply_authorized);
  let d:Value=serde_json::from_slice(&out).unwrap();
  assert_eq!(d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex1"],60);
  assert_eq!(d["Player"]["FemaleAvatar"]["Makeup"]["1"]["ColorIndex1"],60);
  for channel in ["ColorIndex2","ColorIndex3"]{assert_eq!(d["Player"]["MaleAvatar"]["Makeup"]["1"][channel],-1);}
  assert_eq!(d["Player"]["ListInventories"]["3"]["Inventory"]["140100014"]["Amount"],2);
  assert!(String::from_utf8(out).unwrap().contains(r#"\u006beep"#));
  println!("QRC1891_MAKEUP_COLOR1_CHILD_REOPEN_PASS schema626");
 }
 #[test]fn qa1891_makeup_color1_reference_negatives(){
  let mut neg=0;
  for i in 0..5{let mut d=doc();match i{
   0=>d["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]["Amount"]=json!(0),
   1=>d["Player"]["MaleAvatar"]["Makeup"]["01"]=d["Player"]["MaleAvatar"]["Makeup"]["1"].clone(),
   2=>d["Player"]["FemaleAvatar"]["Makeup"]["1"]["ColorIndex2"]=json!(2),
   3=>d["Player"]["MaleAvatar"]["Makeup"]["1"]["ColorIndex3"]=json!(2),
   _=>d["Player"]["ListInventories"]["3"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
  }
   let s=open(&d);assert!(s.prepare_fixed_makeup_color1(env(&s,WorkerAction::ReadDomain)).is_err(),"case{i}");neg+=1;
  }
  assert_eq!(neg,5);println!("QRC1891_MAKEUP_COLOR1_REFERENCE_ACTUAL {neg}NEG");
 }

}
