//! ACT1147 exact ordinary owned same-slot top-inner Wardrobe candidate.
//! Static catalog projection + current typed observation, no caller proof,
//! private plan, event replay, grant, new slot, or generic Wardrobe authority.
use super::*;
use serde_json::{json,Value};
use std::collections::{BTreeMap,BTreeSet};
use std::sync::OnceLock;
const PACK:&[u8]=include_bytes!("../data/wardrobe-clothing-compat-v1.json");
const PACK_SHA:&str="9bcf2cf489238074df8ea0b385a6675c8efcd51bb009cac37d8e107ec1a5d0b2";
const OLD:u32=50000352;const NEW:u32=50000214;
const OLD_SHA:&str="5cd109f93fe23ca05a6f03553c6df08565d78bc84096314bc5fb658a70d02175";
const NEW_SHA:&str="a46064476f795b6b0650e2d029a98c2d398ab4413494c0163e48b633685d1ea9";
const BID:&str="9A239D3DB569756D";
fn need(v:bool,e:&'static str)->CoreResult<()>{if v{Ok(())}else{Err(denied(e))}}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn u(v:&Value)->CoreResult<u32>{v.as_u64().and_then(|x|u32::try_from(x).ok()).ok_or(denied("WARDROBE_PRODUCT_UINT"))}
fn ar(v:&Value)->CoreResult<&Vec<Value>>{v.as_array().ok_or(denied("WARDROBE_PRODUCT_ARRAY"))}
struct Row{slot:u32,mask:u32,items:BTreeSet<u32>,ordinary:bool}
type Rows=BTreeMap<u32,Row>;
static ROWS:OnceLock<CoreResult<Rows>>=OnceLock::new();
fn parse()->CoreResult<Rows>{
    need(hex(&sha(PACK))==PACK_SHA,"WARDROBE_PRODUCT_PACK_SHA")?;
    let p:Value=serde_json::from_slice(PACK).map_err(|_|denied("WARDROBE_PRODUCT_PACK"))?;
    need(p["contract"]=="wand.catalog.wardrobe-clothing-compat@1"&&p["authority"]=="static-packaged-data-only"&&p["sourceCount"]==1900&&p["rowFormat"]==6&&p["productWriterAuthorized"]==false&&p["runtimeTargetAuthority"]==false&&
        p["builds"]==json!([{"id":EXACT_STEAM,"kind":"SteamFullVersion","platform":"SteamWindows","schema":626},{"id":BID,"kind":"SwitchBid","platform":"Switch","schema":626}]),"WARDROBE_PRODUCT_PACK_HEADER")?;
    need(p["compatibility"]==json!({"fullbodyExcludes":[0,1,7,15],"fullbodySlot":9,"maxMapEntriesPerMap":18,"relation":"bidirectional-retained-conflict-equivalence","slotMax":17,"slotMin":0,"unknown":"deny","withoutFullbodyRequires":[0,1]}),"WARDROBE_PRODUCT_PACK_CONTRACT")?;
    let rows=ar(&p["rows"])?;need(rows.len()==1898,"WARDROBE_PRODUCT_PACK_COUNT")?;
    let mut out=BTreeMap::new();let mut prev=0;let mut ordinary=0;
    for r in rows{
        let x=ar(r)?;need(x.len()==6,"WARDROBE_PRODUCT_PACK_ROW")?;
        let id=u(&x[0])?;let slot=u(&x[2])?;let mask=u(&x[3])?;let eligible=u(&x[5])?;
        need(id/10_000_000==5&&id>prev&&slot<=17&&mask<1<<18&&eligible<=1,"WARDROBE_PRODUCT_PACK_ROW")?;prev=id;
        let def=x[1].as_str().ok_or(denied("WARDROBE_PRODUCT_PACK_DEF"))?;
        need(def.len()==64&&def.bytes().all(|b|matches!(b,b'0'..=b'9'|b'a'..=b'f')),"WARDROBE_PRODUCT_PACK_DEF")?;
        if id==OLD{need(def==OLD_SHA,"WARDROBE_PRODUCT_PACK_OLD")?;}if id==NEW{need(def==NEW_SHA,"WARDROBE_PRODUCT_PACK_NEW")?;}
        let mut items=BTreeSet::new();let mut last=0;
        let xs=ar(&x[4])?;need(xs.len()<=1900,"WARDROBE_PRODUCT_PACK_CONFLICT_BOUND")?;
        for z in xs{let n=u(z)?;need(n/10_000_000==5&&n>last&&items.insert(n),"WARDROBE_PRODUCT_PACK_CONFLICT")?;last=n;}
        ordinary+=eligible;
        need(out.insert(id,Row{slot,mask,items,ordinary:eligible==1}).is_none(),"WARDROBE_PRODUCT_PACK_DUP")?;
    }
    need(ordinary==647&&out.contains_key(&OLD)&&out.contains_key(&NEW)&&!out.contains_key(&50800150)&&!out.contains_key(&51500057),"WARDROBE_PRODUCT_PACK_PARTITION")?;
    Ok(out)
}
fn rows()->CoreResult<&'static Rows>{ROWS.get_or_init(parse).as_ref().map_err(|e|*e)}
fn row(r:&Rows,id:u32)->CoreResult<&Row>{r.get(&id).ok_or(denied("WARDROBE_PRODUCT_UNKNOWN_CLOTHING"))}
fn rel(r:&Rows,a:u32,b:u32)->CoreResult<bool>{
    let x=row(r,a)?;let y=row(r,b)?;let except=|s|matches!(s,0|1|7|15);
    Ok(x.mask&(1<<y.slot)!=0||x.items.contains(&b)||(x.slot==9&&except(y.slot))||(y.slot==9&&except(x.slot)))
}
fn maps(v:&Value,r:&Rows)->CoreResult<BTreeMap<u32,u32>>{
    need(v["present"]==true,"WARDROBE_PRODUCT_MAP_PRESENT")?;
    let xs=ar(&v["entries"])?;need(xs.len()<=18,"WARDROBE_PRODUCT_MAP_BOUND")?;
    let mut out=BTreeMap::new();let mut ids=BTreeSet::new();
    for x in xs{let slot=u(&x["key"])?;let id=u(&x["savedValue"])?;
        need(slot<=17&&row(r,id)?.slot==slot&&ids.insert(id)&&out.insert(slot,id).is_none(),"WARDROBE_PRODUCT_MAP_ENTRY")?;}
    Ok(out)
}
fn valid(r:&Rows,e:&BTreeMap<u32,u32>,inc:&BTreeMap<u32,u32>)->CoreResult<()>{
    need(!e.keys().any(|k|inc.contains_key(k))&&e.values().chain(inc.values()).copied().collect::<BTreeSet<_>>().len()==e.len()+inc.len(),"WARDROBE_PRODUCT_MAP_OVERLAP")?;
    need(if e.contains_key(&9){[0,1,7,15].iter().all(|k|!e.contains_key(k))}else{e.contains_key(&0)&&e.contains_key(&1)},"WARDROBE_PRODUCT_ADEQUATE")?;
    for &a in e.values(){for &b in e.values(){if a!=b{need(!rel(r,a,b)?,"WARDROBE_PRODUCT_ACTIVE_CONFLICT")?;}}}
    for &a in inc.values(){let mut hit=false;for &b in e.values(){hit|=rel(r,a,b)?||rel(r,b,a)?;}need(hit,"WARDROBE_PRODUCT_INCOMPATIBLE_REASON")?;}
    Ok(())
}
fn compatible(v:&Value)->CoreResult<()>{
    let r=rows()?;let a=row(r,OLD)?;let b=row(r,NEW)?;
    need(a.slot==0&&b.slot==0&&a.ordinary&&b.ordinary&&a.mask==b.mask&&a.items==b.items,"WARDROBE_PRODUCT_PAIR")?;
    let mut e=maps(&v["avatar"]["maleAvatar"]["clothes"],r)?;let inc=maps(&v["avatar"]["maleAvatar"]["incompatibleClothes"],r)?;
    need(e.get(&0)==Some(&OLD)&&!e.values().chain(inc.values()).any(|i|*i==NEW),"WARDROBE_PRODUCT_PAIR_CURRENT")?;
    valid(r,&e,&inc)?;
    for &x in e.values().chain(inc.values()){if x!=OLD{need(rel(r,OLD,x)?==rel(r,NEW,x)?&&rel(r,x,OLD)?==rel(r,x,NEW)?,"WARDROBE_PRODUCT_RELATION")?;}}
    e.insert(0,NEW);valid(r,&e,&inc)
}
// Full-document lexical selected-literal closure. No event or subscriber
// mutation/replay: inventory/collection/active scalar only. Known catalog
// membership is read-only; unknown direct references are not waived.
#[derive(PartialEq,Eq)]enum Seg{K(String),E}
fn k(p:&[Seg],i:usize,s:&str)->bool{matches!(p.get(i),Some(Seg::K(x)) if x==s)}
fn chosen(s:&str)->bool{s=="50000352"||s=="50000214"}
fn walk(b:&[u8],s:Span,p:&mut Vec<Seg>,nodes:&mut usize)->CoreResult<()>{
    *nodes+=1;need(*nodes<=1_000_000&&p.len()<=64,"WARDROBE_PRODUCT_REF_BOUND")?;
    match b.get(s.begin){
        Some(b'{')=>{let mut pos=s.begin+1;while let Some((key,v))=next_object_member(b,s,&mut pos)?{
            if chosen(&key){
                let inv=p.len()==4&&k(p,0,"Player")&&k(p,1,"ListInventories")&&k(p,2,"1")&&k(p,3,"Inventory")&&b.get(v.begin)==Some(&b'{');
                let collection=p.len()==6&&k(p,0,"Player")&&k(p,1,"CollectionSets")&&p[2]==Seg::E&&k(p,3,"GroupData")&&p[4]==Seg::E&&k(p,5,"GroupsCollectionItems")&&matches!(&b[v.begin..v.end],b"true"|b"false");
                need(inv||collection,"WARDROBE_PRODUCT_UNKNOWN_ITEM_KEY")?;
            }
            p.push(Seg::K(key));walk(b,v,p,nodes)?;p.pop();
        }},
        Some(b'[')=>{let mut pos=indexed_read::skip_ws(b,s.begin+1);while pos<s.end-1{
            let end=indexed_read::value_end(b,pos)?;need(end<s.end,"WARDROBE_PRODUCT_REF_ARRAY")?;
            p.push(Seg::E);walk(b,Span{begin:pos,end},p,nodes)?;p.pop();
            pos=indexed_read::skip_ws(b,end);if pos==s.end-1{break}need(b.get(pos)==Some(&b','),"WARDROBE_PRODUCT_REF_ARRAY")?;pos=indexed_read::skip_ws(b,pos+1);
        }},
        Some(_)=>{let raw=&b[s.begin..s.end];if raw==b"50000352"||raw==b"50000214"||raw==b"\"50000352\""||raw==b"\"50000214\""{
            need(p.len()==4&&k(p,0,"Player")&&k(p,1,"MaleAvatar")&&k(p,2,"Clothes")&&k(p,3,"0")&&raw==b"50000352","WARDROBE_PRODUCT_UNKNOWN_ITEM_REF")?;
        }},None=>return Err(denied("WARDROBE_PRODUCT_REF_SPAN")),
    }Ok(())
}
fn empty(b:&[u8],s:Span)->bool{let x=indexed_read::skip_ws(b,s.begin+1);matches!(b.get(s.begin),Some(b'{')|Some(b'['))&&x==s.end-1}
struct Target{edit:Replacement,witness:[u8;32],out:[u8;32]}
impl ProductSession{
    fn bind_wardrobe(&self,e:WorkerEnvelope,switch:bool)->CoreResult<Target>{
        need(self.worker_bound&&e.action==WorkerAction::ReadDomain&&e.expected_revision==0&&e.expected_index_generation==1,"WARDROBE_PRODUCT_EPOCH")?;
        let r=self.observe_wardrobe_same_slot(e,0,OLD as i32,NEW as i32,switch)?;
        need(r["avatar"]["avatarIsMale"]==true&&r["avatar"]["activeBranch"]=="MaleAvatar","WARDROBE_PRODUCT_MALE")?;
        compatible(&r)?;
        let b=&self.decoded;let player=indexed_read::roots(b)?.player;
        for k in ["MaleClothingDesigns","FemaleClothingDesigns","OutfitPresets"]{need(empty(b,object_field(b,player,k)?),"WARDROBE_PRODUCT_DESIGNS_PRESETS")?;}
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        walk(b,top,&mut Vec::new(),&mut 0)?;
        // Existing saved conditional event-state contract rejects new
        // effective state shapes; no event replay or rights modification.
        let hist=object_field(b,top,"ConditionalEventHistory")?;
        super::product_amount_scoped::saved_event_states(b,object_field(b,hist,"ActiveEvents")?)?;
        let span=object_field(b,object_field(b,object_field(b,player,"MaleAvatar")?,"Clothes")?,"0")?;
        need(number(b,span)?==OLD as u64&&hex(&sha(&b[span.begin..span.end]))==r["oldScalarSha256"],"WARDROBE_PRODUCT_RAW_OLD")?;
        let edit=Replacement{span,old:b[span.begin..span.end].to_vec(),new:NEW.to_string().into_bytes()};
        let mut h=Sha256::new();h.update(&b[..span.begin]);h.update(&edit.new);h.update(&b[span.end..]);let out=h.finalize().into();
        let mut h=Sha256::new();h.update(if switch{BID.as_bytes()}else{EXACT_STEAM.as_bytes()});h.update(PACK_SHA.as_bytes());h.update(serde_json::to_vec(&r).map_err(|_|denied("WARDROBE_PRODUCT_WITNESS"))?);let witness=h.finalize().into();
        Ok(Target{edit,witness,out})
    }
    pub(crate) fn preview_product_wardrobe(&self,e:WorkerEnvelope,switch:bool)->CoreResult<Value>{
        let t=self.bind_wardrobe(e,switch)?;
        Ok(json!({"contract":if switch{"wand.worker.switch626.wardrobe-same-slot@1"}else{"wand.worker.steam626.wardrobe-same-slot@1"},
          "slot":0,"oldItemId":OLD,"newItemId":NEW,"definitionPackSha256":PACK_SHA,"witnessSha256":hex(&t.witness),"projectedDecodedSha256":hex(&t.out),
          "sessionId":hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,"decodedSha256":hex(&e.expected_decoded_sha256),"writerAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    pub(crate) fn stage_product_wardrobe(&self,e:WorkerEnvelope,old:u32,new:u32,witness:[u8;32],out:[u8;32],switch:bool)->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage&&old==OLD&&new==NEW,"WARDROBE_PRODUCT_STAGE_SCOPE")?;
        let t=self.bind_wardrobe(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},switch)?;
        need(t.witness==witness&&t.out==out,"WARDROBE_PRODUCT_TARGET_CAS")?;
        self.commit_semantic_replacements(e,vec![t.edit],1,Some(out))
    }
}
#[cfg(test)]
mod tests{
use super::*;use crate::BuildIdentity;
fn doc()->Value{json!({"GameInfo":{"Version":626},"ConditionalEventHistory":{"ActiveEvents":{}},"World":{"Unknown":{"keep":1}},"Player":{
 "AvatarIsMale":true,"FemaleAvatar":{"Clothes":{},"IncompatibleClothes":{},"ClothingCustomization":{},"Makeup":{}},
 "MaleAvatar":{"Clothes":{"0":OLD,"1":50100047},"IncompatibleClothes":{},"ClothingCustomization":{},"Makeup":{}},
 "MaleClothingDesigns":[],"FemaleClothingDesigns":[],"OutfitPresets":[],
 "ListInventories":{"1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{"50000352":{"Amount":8,"Marker":"ItemMarker_None"},"50000214":{"Amount":9,"Marker":"ItemMarker_None"},"50100047":{"Amount":1,"Marker":"ItemMarker_None"}}},"3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{}}},
 "CollectionSets":[{"CollectionDefinitionID":2120000001,"GroupData":[{"GroupsCollectionItems":{"50000352":true,"50000214":true}}]}]}})}
fn open(d:&Value,switch:bool)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),BuildIdentity{platform:if switch{Platform::Switch}else{Platform::SteamWindows},build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},build_id:(if switch{BID}else{EXACT_STEAM}).into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
#[test]fn product_wardrobe_exact1_both_builds(){
 for sw in [false,true]{let d=doc();let s=open(&d,sw);let e=env(&s,WorkerAction::ReadDomain);let t=s.bind_wardrobe(e,sw).unwrap();assert!(s.preview_product_wardrobe(e,!sw).is_err());
 let st=env(&s,WorkerAction::Stage);assert!(s.stage_product_wardrobe(st,OLD,NEW,[0;32],t.out,sw).is_err());assert!(s.stage_product_wardrobe(st,NEW,OLD,t.witness,t.out,sw).is_err());assert!(open(&d,sw).stage_product_wardrobe(st,OLD,NEW,t.witness,t.out,sw).is_err());
 assert_eq!(s.stage_product_wardrobe(st,OLD,NEW,t.witness,t.out,sw).unwrap().exact_field_changed_count,1);assert!(s.stage_product_wardrobe(st,OLD,NEW,t.witness,t.out,sw).is_err());
 s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 let ex=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();let mut want=d.clone();want["Player"]["MaleAvatar"]["Clothes"]["0"]=json!(NEW);assert_eq!(out,serde_json::to_vec(&want).unwrap());assert!(s.take_typed_semantic_decoded_once(ex).is_err());
 for i in 0..8{let mut x=d.clone();match i{0=>x["Player"]["AvatarIsMale"]=json!(false),1=>x["Player"]["ListInventories"]["1"]["Inventory"]["50000214"]["Amount"]=json!(0),2=>x["Player"]["MaleAvatar"]["Clothes"]["1"]=json!(59999999),3=>{x["Player"]["MaleAvatar"]["Clothes"].as_object_mut().unwrap().remove("1");},4=>x["Player"]["OutfitPresets"]=json!([{}]),5=>x["World"]["Unknown"]=json!({"ItemID":NEW}),6=>x["Player"]["MaleAvatar"]["IncompatibleClothes"]["0"]=json!(NEW),_=>x["ConditionalEventHistory"]["ActiveEvents"]["1"]=json!({"Unknown":{}})};
 let x=open(&x,sw);assert!(x.preview_product_wardrobe(env(&x,WorkerAction::ReadDomain),sw).is_err(),"mode {i}");
 }
 }
}
}
