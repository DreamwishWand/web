//! ACT1507: Steam626 exact owned AvatarFeature Eyeball ColorIndex2 64->69.
//! Uses the existing strict document/lexical Avatar observer, one ProductSession
//! and typed scalar ledger. No generic palette, new ownership, public ABI or ON.
use super::*;
use super::appearance_observer::*;
use serde_json::{json,Value};

const ITEM:i32=70000010;
const ROUTE:u32=9;
const OLD:i32=64;
const NEW:i32=69;
#[derive(Debug)]
pub(crate) struct FixedEyeballColor2{
 pub(crate) scope:WorkerEnvelope,pub(crate) span:Span,
 pub(crate) active_eye_sha:String,pub(crate) inactive_eye_sha:String,
 pub(crate) male_sha:String,pub(crate) female_sha:String,
 pub(crate) stock_entry_sha:String,pub(crate) route_sha:String,
 pub(crate) selected_token_sha:String,pub(crate) projected:[u8;32],
}
fn check_ok(ok:bool,why:&'static str)->CoreResult<()>{
 if ok{Ok(())}else{Err(denied(why))}
}
fn eye(b:&[u8],avatar:Span)->CoreResult<(Span,Span,i32)>{
 let a=members(b,avatar,MAX_AVATAR_FIELDS)?;
 let e=required(&a,"Eyeball")?;
 check_ok(b.get(e.begin..e.end)!=Some(b"null"),"EYECOLOR2_EYE_ABSENT")?;
 let fields=members(b,e,32)?;
 check_ok(int(b,required(&fields,"EyeballItemID")?)?==ITEM,"EYECOLOR2_EXACT_ITEM")?;
 let selected=required(&fields,"ColorIndex2")?;
 let current=int(b,selected)?;
 // Other channels are observed as typed scalars, never interpreted as a grant
 // or normalized. Their original byte spans are preserved by the shared ledger.
 for name in ["ColorIndex1","ColorIndex3"]{
  if let Some(s)=field(&fields,name){let _=int(b,s)?;}
 }
 Ok((e,selected,current))
}
fn stock(b:&[u8],player:&[(String,Span)])->CoreResult<(String,String)>{
 let lists=required(player,"ListInventories")?;
 let mut route=None;
 for (key,rec) in members(b,lists,128)?{
  let id=key_u32(&key)?;
  check_ok(int(b,required(&members(b,rec,64)?,"ID")?)?==id as i32,
           "EYECOLOR2_INVENTORY_ID")?;
  let fields=members(b,rec,64)?;
  let ty=text_token(b,required(&fields,"CompatibleItemType")?,128)?;
  if id==ROUTE||ty=="ItemType_AvatarFeature"{
   check_ok(id==ROUTE&&ty=="ItemType_AvatarFeature"&&route.is_none(),
            "EYECOLOR2_EXACT_ROUTE9")?;
   route=Some((rec,required(&fields,"Inventory")?));
  }
 }
 let (rec,items)=route.ok_or(denied("EYECOLOR2_ROUTE9_ABSENT"))?;
 let mut target=None;
 for(k,v)in members(b,items,16384)?{
  let id=key_u32(&k)?;
  check_ok(id>0&&id<=i32::MAX as u32&&id/10_000_000==7,"EYECOLOR2_STOCK_ITEM_KIND")?;
  if id==ITEM as u32{check_ok(target.replace(v).is_none(),"EYECOLOR2_STOCK_ALIAS")?;}
 }
 let entry=target.ok_or(denied("EYECOLOR2_STOCK_ABSENT"))?;
 let f=members(b,entry,64)?;
 let amount=int(b,required(&f,"Amount")?)?;
 check_ok(amount>0&&amount<=9999,"EYECOLOR2_STOCK_AMOUNT")?;
 let marker=enum_token(b,required(&f,"Marker")?,"ItemMarker_")?;
 check_ok(!marker.is_empty(),"EYECOLOR2_STOCK_MARKER")?;
 // A precise inventory route/entry SHA pin, not a Native entitlement proof.
 Ok((sha(&b[rec.begin..rec.end]),sha(&b[entry.begin..entry.end])))
}
impl ProductSession{
 pub(crate) fn prepare_fixed_steam626_eyecolor2(&self,e:WorkerEnvelope)->CoreResult<FixedEyeballColor2>{
  product_appearance_scope(self,&e)?;
  self.prepare_fixed_eyecolor2_lexical(e)
 }
 fn prepare_fixed_eyecolor2_lexical(&self,e:WorkerEnvelope)->CoreResult<FixedEyeballColor2>{
  let st=self.lock()?;validate_scope(self,&st,&e)?;
  check_ok(st.revision==0&&st.generation==1&&st.semantic.is_none(),"EYECOLOR2_EPOCH")?;
  let b=&self.decoded;let root=roots(b)?;
  let player=members(b,root.player,1024)?;
  let male=required(&player,"AvatarIsMale")?;
  check_ok(b.get(male.begin..male.end)==Some(b"true"),"EYECOLOR2_MALE_ACTIVE")?;
  let fs=required(&player,"FemaleAvatar")?;
  let ms=required(&player,"MaleAvatar")?;
  let (inactive,_,inactive_color)=eye(b,fs)?;
  let (active,span,old)=eye(b,ms)?;
  check_ok(inactive_color==NEW&&old==OLD&&OLD>=0&&OLD<75&&NEW<75,
           "EYECOLOR2_FIXED_SCALAR_SCOPE")?;
  let female=branch(b,fs)?;let male=branch(b,ms)?;
  let _=branch_dependencies(b,fs)?;let _=branch_dependencies(b,ms)?;
  let (route_sha,entry_sha)=stock(b,&player)?;
  let projected=self.project_appearance_scalar_candidate(span,OLD,NEW)?;
  Ok(FixedEyeballColor2{scope:e,span,
   active_eye_sha:sha(&b[active.begin..active.end]),
   inactive_eye_sha:sha(&b[inactive.begin..inactive.end]),
   male_sha:male.sha,female_sha:female.sha,
   stock_entry_sha:entry_sha,route_sha,
   selected_token_sha:sha(&b[span.begin..span.end]),projected})
 }
 // ACT1508: exact affected Switch626 Build delta. Separate admission only;
 // no extra scanner/Session or public Worker command.
 #[cfg(feature="product-switch626-eyecolor2-internal")]
 pub(crate) fn prepare_fixed_switch626_eyecolor2(&self,e:WorkerEnvelope)->CoreResult<FixedEyeballColor2>{
  use crate::{Platform,BuildKind};
  let b=&self.native_source_build;
  if !self.worker_bound||b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
     b.build_id!="9A239D3DB569756D"||b.schema!=626||!b.externally_attested{
    return Err(denied("EYECOLOR2_EXACT_SWITCH626_BUILD_REQUIRED"));
  }
  self.prepare_fixed_eyecolor2_lexical(e)
 }
 #[cfg(feature="product-switch626-eyecolor2-internal")]
 pub(crate) fn stage_fixed_switch626_eyecolor2(&self,e:WorkerEnvelope,p:&FixedEyeballColor2)
     ->CoreResult<crate::SemanticStageReceipt>{
  check_ok(e.action==WorkerAction::Stage,"EYECOLOR2_SWITCH_STAGE_ACTION")?;
  let current=self.prepare_fixed_switch626_eyecolor2(WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
  check_ok(current.scope==p.scope&&current.span.begin==p.span.begin&&current.span.end==p.span.end&&
   current.active_eye_sha==p.active_eye_sha&&current.inactive_eye_sha==p.inactive_eye_sha&&
   current.male_sha==p.male_sha&&current.female_sha==p.female_sha&&
   current.stock_entry_sha==p.stock_entry_sha&&current.route_sha==p.route_sha&&
   current.selected_token_sha==p.selected_token_sha&&current.projected==p.projected,
   "EYECOLOR2_SWITCH_STAGE_WITNESS_CAS")?;
  self.commit_switch626_eyecolor2_candidate(e,current.span,OLD,NEW,current.projected)
 }
 pub(crate) fn stage_fixed_steam626_eyecolor2(&self,e:WorkerEnvelope,p:&FixedEyeballColor2)
     ->CoreResult<crate::SemanticStageReceipt>{
  check_ok(e.action==WorkerAction::Stage,"EYECOLOR2_STAGE_ACTION")?;
  let current=self.prepare_fixed_steam626_eyecolor2(WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
  check_ok(current.scope==p.scope&&current.span.begin==p.span.begin&&current.span.end==p.span.end&&
   current.active_eye_sha==p.active_eye_sha&&current.inactive_eye_sha==p.inactive_eye_sha&&
   current.male_sha==p.male_sha&&current.female_sha==p.female_sha&&
   current.stock_entry_sha==p.stock_entry_sha&&current.route_sha==p.route_sha&&
   current.selected_token_sha==p.selected_token_sha&&current.projected==p.projected,
   "EYECOLOR2_STAGE_WITNESS_CAS")?;
  self.commit_appearance_scalar_candidate(e,current.span,OLD,NEW,current.projected)
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 use crate::{BuildIdentity,BuildKind,Platform};
 fn avatar(color:i32)->Value{
  json!({"Eyeball":{"EyeballItemID":ITEM,"ColorIndex1":20,"ColorIndex2":color,
                    "ColorIndex3":-1,"OpaqueEye":{"preserve":[1,2,3]}},
         "HairColorIndex":0,"HairHighlightColor":0,"Clothes":{},"Makeup":{},
         "IncompatibleClothes":{},"ClothingCustomization":{}})
 }
 fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},
   "Player":{"AvatarIsMale":true,"FemaleAvatar":avatar(NEW),"MaleAvatar":avatar(OLD),
    "ListInventories":{"9":{"ID":9,"CompatibleItemType":"ItemType_AvatarFeature",
       "Inventory":{"70000010":{"Amount":2,"Marker":"ItemMarker_None",
                                    "OpaqueInventory":{"preserve":42}}}}}}})}
 fn open(d:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
      build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true}).unwrap();
  s.worker_bound=true;s
 }
 fn envelope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{
  let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
    session_id:r.session_id,expected_revision:r.revision,
    expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}
 }
 #[test]fn steam626_eyecolor2_exact1_atomic_and_reopen(){
  let d=doc();let original=serde_json::to_vec(&d).unwrap();let s=open(&d);
  let e=envelope(&s,WorkerAction::ReadDomain);let p=s.prepare_fixed_steam626_eyecolor2(e).unwrap();
  assert_eq!(&s.decoded[p.span.begin..p.span.end],b"64");
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(s.stage_fixed_steam626_eyecolor2(e,&p).is_err());
  let other=open(&d);assert!(other.stage_fixed_steam626_eyecolor2(
    envelope(&other,WorkerAction::Stage),&p).is_err());
  let mut forged=s.prepare_fixed_steam626_eyecolor2(e).unwrap();forged.projected[0]^=1;
  assert!(s.stage_fixed_steam626_eyecolor2(stage,&forged).is_err());
  for bad in [WorkerEnvelope{expected_revision:1,..stage},
              WorkerEnvelope{expected_index_generation:2,..stage},
              WorkerEnvelope{expected_decoded_sha256:[0;32],..stage}]{
   assert!(s.stage_fixed_steam626_eyecolor2(bad,&p).is_err());
  }
  let receipt=s.stage_fixed_steam626_eyecolor2(stage,&p).unwrap();
  assert_eq!((receipt.operation_count,receipt.exact_field_changed_count),(1,1));
  assert!(!receipt.product_writer_authorized&&!receipt.native_v3_verified);
  assert!(s.stage_fixed_steam626_eyecolor2(stage,&p).is_err());
  s.undo_typed_semantic_batch(envelope(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(envelope(&s,WorkerAction::ExportEditedCopy)).is_err());
  s.redo_typed_semantic_batch(envelope(&s,WorkerAction::Stage)).unwrap();
  let export=envelope(&s,WorkerAction::ExportEditedCopy);
  let result=s.take_typed_semantic_decoded_once(export).unwrap();
  assert!(s.take_typed_semantic_decoded_once(export).is_err());
  let mut want=d.clone();want["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(NEW);
  assert_eq!(serde_json::from_slice::<Value>(&result).unwrap(),want);
  assert_eq!(result,serde_json::to_vec(&want).unwrap());
  assert_eq!(serde_json::to_vec(&d).unwrap(),original);
  assert_eq!(sha(&result),hex(&receipt.staged_decoded_sha256));
  let reopened=open(&want);assert_eq!(reopened.receipt().unwrap().schema,626);
 }
 #[cfg(feature="product-switch626-eyecolor2-internal")]
 fn open_switch(d:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
      build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  s.worker_bound=true;s
 }
 #[cfg(feature="product-switch626-eyecolor2-internal")]
 #[test]fn switch626_eyecolor2_build_delta_exact1_and_reopen(){
  let d=doc();let source=serde_json::to_vec(&d).unwrap();let s=open_switch(&d);
  let e=envelope(&s,WorkerAction::ReadDomain);
  assert!(s.prepare_fixed_steam626_eyecolor2(e).is_err(),"no Switch via Steam");
  let t=s.prepare_fixed_switch626_eyecolor2(e).unwrap();
  assert_eq!(&s.decoded[t.span.begin..t.span.end],b"64");
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(s.stage_fixed_switch626_eyecolor2(e,&t).is_err());
  let alien=open_switch(&d);
  assert!(alien.stage_fixed_switch626_eyecolor2(
      envelope(&alien,WorkerAction::Stage),&t).is_err(),"foreign Session");
  let mut forged=s.prepare_fixed_switch626_eyecolor2(e).unwrap();
  forged.projected[0]^=1;
  assert!(s.stage_fixed_switch626_eyecolor2(stage,&forged).is_err());
  for bad in [WorkerEnvelope{expected_revision:1,..stage},
              WorkerEnvelope{expected_index_generation:2,..stage},
              WorkerEnvelope{expected_decoded_sha256:[0;32],..stage}]{
    assert!(s.stage_fixed_switch626_eyecolor2(bad,&t).is_err());
  }
  let steam=open(&d);
  assert!(steam.prepare_fixed_switch626_eyecolor2(
    envelope(&steam,WorkerAction::ReadDomain)).is_err(),"no Steam via Switch");
  let r=s.stage_fixed_switch626_eyecolor2(stage,&t).unwrap();
  assert_eq!((r.operation_count,r.exact_field_changed_count),(1,1));
  assert!(!r.native_v3_verified&&!r.product_writer_authorized&&!r.original_overwrite_authorized);
  assert!(s.stage_fixed_switch626_eyecolor2(stage,&t).is_err(),"replay");
  s.undo_typed_semantic_batch(envelope(&s,WorkerAction::Stage)).unwrap();
  assert!(s.take_typed_semantic_decoded_once(
    envelope(&s,WorkerAction::ExportEditedCopy)).is_err(),"Undo cannot Export");
  s.redo_typed_semantic_batch(envelope(&s,WorkerAction::Stage)).unwrap();
  let outenv=envelope(&s,WorkerAction::ExportEditedCopy);
  let out=s.take_typed_semantic_decoded_once(outenv).unwrap();
  assert!(s.take_typed_semantic_decoded_once(outenv).is_err(),"once");
  let mut expected=d.clone();
  expected["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(NEW);
  assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
  assert_eq!(out,serde_json::to_vec(&expected).unwrap());
  assert_eq!(serde_json::to_vec(&d).unwrap(),source);
  assert_eq!(sha(&out),hex(&r.staged_decoded_sha256));
  let reopened=open_switch(&expected);
  assert_eq!(reopened.receipt().unwrap().schema,626);
 }
 #[cfg(feature="product-switch626-eyecolor2-internal")]
 #[test]fn switch626_eyecolor2_build_delta_negatives(){
  for i in 0..13 {
    let mut d=doc();
    match i {
      0=>d["Player"]["AvatarIsMale"]=json!(false),
      1=>d["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(63),
      2=>d["Player"]["FemaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(68),
      3=>d["Player"]["MaleAvatar"]["Eyeball"]["EyeballItemID"]=json!(70000011),
      4=>d["Player"]["MaleAvatar"]["Eyeball"]=Value::Null,
      5=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Amount"]=json!(0),
      6=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Marker"]=Value::Null,
      7=>d["Player"]["ListInventories"]["9"]["CompatibleItemType"]=json!("ItemType_Clothing"),
      8=>d["Player"]["ListInventories"]["9"]["ID"]=json!(8),
      9=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]=Value::Null,
      10=>d["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex1"]=json!("bad"),
      11=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Amount"]=json!(10000),
      _=>d["Player"]["FemaleAvatar"]["Eyeball"]["EyeballItemID"]=json!(70000011),
    }
    let s=open_switch(&d);
    assert!(s.prepare_fixed_switch626_eyecolor2(
      envelope(&s,WorkerAction::ReadDomain)).is_err(),"expected denial {i}");
  }
 }
 #[test]fn steam626_eyecolor2_exact1_negatives(){
  for i in 0..12{
   let mut d=doc();
   match i{
    0=>d["Player"]["AvatarIsMale"]=json!(false),
    1=>d["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(63),
    2=>d["Player"]["FemaleAvatar"]["Eyeball"]["ColorIndex2"]=json!(68),
    3=>d["Player"]["MaleAvatar"]["Eyeball"]["EyeballItemID"]=json!(70000011),
    4=>d["Player"]["MaleAvatar"]["Eyeball"]=Value::Null,
    5=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Amount"]=json!(0),
    6=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Marker"]=Value::Null,
    7=>d["Player"]["ListInventories"]["9"]["CompatibleItemType"]=json!("ItemType_Clothing"),
    8=>d["Player"]["ListInventories"]["9"]["ID"]=json!(8),
    9=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]=Value::Null,
    10=>d["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex1"]=json!("bad"),
    _=>d["Player"]["ListInventories"]["9"]["Inventory"]["70000010"]["Amount"]=json!(10_000),
   }
   let s=open(&d);
   assert!(s.prepare_fixed_steam626_eyecolor2(envelope(&s,WorkerAction::ReadDomain)).is_err(),
           "expected denial {i}");
  }
  let d=doc();let mut switch=ProductSession::open_decoded_readonly(serde_json::to_vec(&d).unwrap(),
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
      build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  switch.worker_bound=true;
  assert!(switch.prepare_fixed_steam626_eyecolor2(envelope(&switch,WorkerAction::ReadDomain)).is_err());
 }
 #[cfg(feature="product-switch626-eyecolor2-scoped")]
 #[test]fn switch626_eyecolor2_worker_abi_exact1_cas_undo_reopen(){
  let d=doc();let original=serde_json::to_vec(&d).unwrap();
  let s=open_switch(&d);let e=envelope(&s,WorkerAction::ReadDomain);
  let p=s.prepare_fixed_switch626_eyecolor2(e).unwrap();
  let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
  let preview=g.preview_switch_eyecolor2(e).unwrap();
  assert_eq!(preview["contract"],"wand.worker.switch626.eyecolor2-exact1@1");
  assert_eq!(preview["eyeballItemId"],ITEM);
  assert_eq!(preview["oldColorIndex"],OLD);
  assert_eq!(preview["newColorIndex"],NEW);
  assert_eq!(preview["exactFieldChangedCount"],1);
  assert_eq!(preview["inventoryDelta"],0);
  assert_eq!(preview["writerAuthorized"],false);
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  let call=|guard:&crate::worker_session::WorkerSessionGuard,active:&str,projected:[u8;32]|
      guard.stage_switch_eyecolor2(stage,active,&p.inactive_eye_sha,&p.male_sha,
          &p.female_sha,&p.stock_entry_sha,&p.route_sha,&p.selected_token_sha,projected);
  assert!(call(&g,"00",p.projected).is_err());
  let mut forged=p.projected;forged[0]^=1;
  assert!(call(&g,&p.active_eye_sha,forged).is_err());
  assert!(g.stage_switch_eyecolor2(e,&p.active_eye_sha,&p.inactive_eye_sha,&p.male_sha,
          &p.female_sha,&p.stock_entry_sha,&p.route_sha,&p.selected_token_sha,p.projected).is_err());
  let receipt=call(&g,&p.active_eye_sha,p.projected).unwrap();
  assert_eq!((receipt.operation_count,receipt.exact_field_changed_count),(1,1));
  assert!(!receipt.product_writer_authorized&&!receipt.original_overwrite_authorized);
  assert!(call(&g,&p.active_eye_sha,p.projected).is_err());
  let current=g.receipt().unwrap();
  let mut scope=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:current.session_id,
    expected_revision:current.revision,expected_index_generation:current.index_generation,
    expected_decoded_sha256:current.decoded_sha256,action:WorkerAction::Stage};
  g.toggle_scoped_edit(scope,false).unwrap();
  let current=g.receipt().unwrap();
  scope.expected_revision=current.revision;scope.expected_index_generation=current.index_generation;
  scope.expected_decoded_sha256=current.decoded_sha256;
  g.toggle_scoped_edit(scope,true).unwrap();
  let current=g.receipt().unwrap();
  scope.expected_revision=current.revision;scope.expected_index_generation=current.index_generation;
  scope.expected_decoded_sha256=current.decoded_sha256;scope.action=WorkerAction::ExportEditedCopy;
  let edited=g.take_scoped_edit(scope).unwrap();
  assert!(g.take_scoped_edit(scope).is_err());
  assert_ne!(edited,original);
  let v:Value=serde_json::from_slice(&edited).unwrap();
  assert_eq!(v["Player"]["MaleAvatar"]["Eyeball"]["ColorIndex2"],NEW);
  assert_eq!(v["Player"]["FemaleAvatar"],d["Player"]["FemaleAvatar"]);
  assert_eq!(v["Player"]["ListInventories"],d["Player"]["ListInventories"]);
  assert_eq!(serde_json::to_vec(&d).unwrap(),original);
  let reopen=ProductSession::open_decoded_readonly(edited,BuildIdentity{
    platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
    build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  assert_eq!(reopen.receipt().unwrap().schema,626);
 }
}
