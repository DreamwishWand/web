//! SR03 installed Meadow geometry delta; no save/session/rights or Stage authority.
//! 13 common definition dimensions are supplied by the existing trusted COMP03
//! installed resolver. The 59 additional rows are installed-only references,
//! not a registry of permitted targets. No saved object IDs or coordinates.
use serde_json::Value;
use sha2::{Digest,Sha256};
const PACK:&str=r#"{"build":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","contract":"wand.steam626.sr03.geometry-delta@1","delta":[[20000091,12,10,1,"7c6c6f0b1084fcd7f17077a230b789b0c8d661f6dcd2890fde426e1de5c92541"],[20100000,8,4,1,"3a489c1c6f588009bb86b056c911e40d31fb0c6aaed453b04ec7e6bb35fb0f0d"],[20100004,8,4,1,"8826b17cb0622ef29de28722e29d6147567abf3ef81d526f7d65d7fe3b3ac056"],[20100005,8,4,1,"309be568e7f2a1d1a44ac83b3aff9e7a429d3e0d04f7e52f45d269b6ea6bea34"],[20100006,8,4,1,"fb3bc4afcd74d1152cc6f32084a1e215e9edb1d5185e9395434810345b69a5a7"],[20100007,8,4,1,"ede011738ddd30eb1e001fffce0aba6e6946601502ce15468cc84eb318c39ef7"],[20100008,8,4,1,"db81df3b2e0fe55cca4b37c4cd4a7809e30c22bdb883fbd98e84d5b5eca84a61"],[20100009,8,4,1,"367f275bc24278f4e0e39d92ed499492704aaba3ec39c88dce3afe1e5efd32bc"],[20300002,6,6,1,"7608edaa1173b730e45dfd888e0750e26ea67be3b60ada5006010d86ab85606c"],[20300115,7,5,1,"4b024c5d461aa4d3a77344e1946dc46d478a6d05891a8809bc63cd54c4648c2d"],[20500005,11,13,1,"cf32d344d2621e4caa83d7c05652013e7f7ed008fd1ed13a1ab3562a159f52ff"],[20500024,12,13,1,"ea14f098d6468a0c6afe2645e3633f41a467edb20656f19a0823b1d6dbe4b351"],[20500040,20,20,1,"8ab5200b5971fcf050cda3b68627d2d895a5259d1c19f5d3e302f703d164cfa8"],[20500060,16,16,1,"b3f375b4006623079ba83d18c03330877fe6eefaf05a6b2e1b526b34db42f80c"],[20500086,12,13,1,"afeecc2e3403cc9c53974e7bd985d3618a25954a04335da0e765ad7454f03cac"],[20500096,17,20,1,"01ff668228d135c727168a29a44d146736213910370ae466210deb8175385e17"],[40000182,4,2,1,"cf2d3a2da35e31196e85be422c154088de17af8a75388b189d62ef95c25a3993"],[40000394,1,1,1,"8722072b70bb4a9eb4aa49d8f553c3a5eb22af4e37c344ee45a9df6c371eecad"],[40001050,2,2,1,"dc7e3b1172d45de70eaa9f4c87c9339b52ef89f625557f35a903213622f52558"],[40001052,2,3,1,"6650494db844ef65f9b2d43ea95e3d4aeeb0604ef04969682433661408a01ebc"],[40001071,4,3,1,"5da16e26d78888410cf200d055e0474eea32c12af45cc8ba273a3880289341ef"],[40001088,2,2,1,"aa85398f1b479440133b556148e10b2213efa412d757862f1ae6b54e7150b771"],[40001135,12,1,1,"6ebcd3350fe66ec41b853443d3d918dda8050ae41044658f4f70a1b66586934b"],[40001587,3,3,1,"2b98b51bc098d4b36f22f52926b0a143ea91c04be68c91c12a734eed4878fbd0"],[40001701,2,2,1,"8a87dd3b9baa89d6a947d2a9500f304e11e2ddb407d84ec567c56c8e196c412a"],[40002113,10,12,1,"4a8639c7ee41427c29fb32ebaef79a6e56c11e9904d090d34ea0574c89bd547d"],[40002393,10,3,1,"bf83d6fbb5c1074b587d41031096f8e7ff5ab9f2d59393f357d98b524dff36fb"],[40002410,2,2,1,"98eb424b51285e65c1619f9b0e065b35b751226d478b2905a6741d2a433743fd"],[40002518,8,8,1,"fda98a80b97b03b37b9b3ac24926ecd3091f16c82aae63c4b7bb627c4da03255"],[40002656,2,2,1,"faf5994ae1f959e3e6d99796056fd468d531dead8309d41dcc66646380193e72"],[40002662,10,10,1,"b403592fe4ba62e2398c03dfe74850ff0c72f4a13ca6f746c973ecee1abfded2"],[40002991,8,8,1,"c78620fe7f03044cb9529c5bb3cb04682a3e989fb7b48a21a2e0726db654d24d"],[40003507,4,4,1,"750e8589e72bf11d442d6a378c38afa4889680cdd568b875eb92d569730d10b2"],[40003563,8,2,1,"33a55c54fa89f98622fd87a5726965544bc6962f8b6c44e128d50e47ddfacfae"],[40003564,4,2,1,"a4facf3ceede17ecdab0a2cbc616bae697b0f7037ebf9f0c3b67dad4a1c51e11"],[40003568,8,8,1,"615ca375b94ac565b6daa8255887ed61169c1e1bcc0e307955e0ad4fe0c347d0"],[40003578,4,2,1,"396717ecfe387d728b63a7e25fcd9cf8944cd45ec897fd96e8cc51624322b288"],[40003714,2,2,1,"cf97d52a7278f82671685004092f69c984a1c4bcb0f661eb7af1ceb415139b9d"],[40003760,2,2,1,"ae90d3c9bb47ad53f3892563442fff34e9b780c7221a4ba01184ed2bd5066464"],[40004190,2,2,1,"e86e0dfdc0247252af52305f3daa0741cb637f3860d856a22274e125488a9a58"],[40004191,2,2,1,"454ea4cafe73d41d7b7cef7d76f0c23016e810c50de7193c51c00d8f90f6c0ec"],[40004375,6,2,1,"814e7501f410ecde9f9f8f4b5625edb5870a185be1d9a4b9fb10b34a92f3fab3"],[40005226,9,7,1,"a8ceff707ed11cc21ebcda860718eb3547adef7e7e4eb1df734cfa8c8440716a"],[40005494,9,1,1,"f20350badf6521173ddd421a9d513d74f84409a069c82536de70f53f902d7fe9"],[40005495,1,1,1,"7c688f335d793e24332c8203feb52fdd66cf6930c4a9eae51c2b34ba6703c5cd"],[40200139,1,1,1,"c5adc5ad631172481d5e2a319c23a30167f5796b2c84d0db7ad0571403b987ec"],[40200346,10,10,1,"11377bac1082b1dfbe6b3a64bc8f5938b6986319c7372306073cbdb942f6fd9e"],[40200348,5,5,1,"eaac16a6066a7f63038f204ff3fd806fd94547491ca09e3a23caacd0513f5f4f"],[40200441,3,3,1,"3cbc57819fb07c695932596f5759cd3eda72345999becc932eee0d0d2a708847"],[40200442,3,3,1,"15a3fb0c14b7e9ffab0ec7f761011cce5d421cfe58f9c431ab41b4791c45e0fc"],[40200444,7,9,1,"c717e079832497c9d0dab756b45aded933cf8862448139a6add332882a82ce3d"],[40200485,2,2,1,"b17030853b00464a83962bfc5bd9a8bdd45d35090ecd0ff5a1750b2f1c8432b2"],[40200488,10,10,1,"9651b6265109a8962c0ff771b23e0bf5ad4bad9bc91bc13727dbb670c45aa104"],[40200642,2,2,1,"23bac6f299d5c7ae475a55067150bc7ec242bf301fc019abf3ae160467852d86"],[40700176,2,2,1,"6d8d411c8a05a501bd741f705a7a9b55c2ce854d40cdae7141f468dfc1459f9a"],[40700177,3,3,1,"7ee34e9ed7756cbe157a67d74d5e26067900006a8401f6ad18416d6f0bba41ee"],[40700178,4,4,1,"777aaf70c284e2f244bdbd66644860645bb23b056970016bfdbaf8ef0b485c47"],[40700254,2,2,1,"b71f1b46205cacd36a4a08ffc74b1de5d9cef657c2f68fef21c25ddca49accfe"],[40700256,4,4,1,"c99ea92325de663c74971d5762140790fbe70494994d9fb5cc43958ac4b1188f"]],"floor4Hex":"000000000000fe393e0000000000000000ffffffff0f00000000000000f0ffffffff03000000000000f0ffffffff3f00000000000000ffffffffff03000000000000f0ffffffff1f00000000000000ffffffffff01000000000000f0ffffffff1f00000000000000ffffffffff01000000000000e0ffffffff1f00000000000000feffffffff01000000000000e0ffffffff1f00000000000000feffffffff01000000000000e0ffffffff1f00000000000000feffffffff03000000000000e0ffffffff3f00000000000000feffffffff07000000000000e0ffffffff7f00000000000000fcffffffff0f000000000000c0ffffffffff00000000000000feffffffff0f000000000000f0ffffffffff00000000000000ffffffffff0f000000000000f0ffffffffff00000000000000ffffffffff0f000000000000f0ffffffffff00000000000000feffffffff0f000000000000e0ffffffffff00000000000000feffffffff0f000000000000e0ffffffffff00000000000000ffffffffff0f000000000000f0ffffffffff00000000000000ffffffffff03000000000000f0ffffffff3f00000000000000ffffffffff03000000000000f0ffffffff3f000000000000ffffffffffff010000000000f8ffffffffff0f0000000000e0ffffffffffff000000000000feffffffffff070000000000e0ffffffffff7f000000000000ffffffffffff070000000000f0ffffffffff7f000000000000ffffffffffff070000000000f0ffffffffff7f000000000000ffffffffffff070000000000f0ffffffffff7f0000000000c0ffffffffffff070000000000feffffffffff7f0000000000e0ffffffffffff0f0000000000feffffffffffff000000f00fe0ffffffffffff0f000000ff00feffffffffffff000000f00fe0ffffffffffffff000000ffffffffffffffffff0f0000f0ffffffffffffffffff0f0000ffffffffffffffffffff0000f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000feffffffffffffffffff0100e0ffffffffffffffffff1f0000feffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffcfffff3f0000ffffffffffff3f80ffff0f00e0ffffffffffff01f8ffff7f00feffffffffff0f00ffffff07e0ffffffffff7f00a0ffff7f00feffffffffff0700f0ffff07e0ffffffffff7f0000ffff7f00feffffffffff0700f8ffff07e0ffffffffff7f00c0ffff7f00feffffffffff0700feffff07e0ffffffffff7f00e0ffff7f00feffffffffff0700ffffff07e0ffffffffff7f00f0ffff7f00feffffffffff0fc0ffffff0fe0ffffffffffffffffffffff00ffffffffffffffffffffff07f0ffffffffffffffffffff7f00ffff3ff0ffffffffffffff07f0ffff01f8ffffffffffff7f00ffff0f00ffffffffffffff0ff0ff7f00e0ffffffffffffff00fcff0700feffffffffffff0fc0ff7f00e0ffffffffffffff00fcff0700feffffffffffff0fc0ff7f00e0ffffffffffffff00fcff0700feffffffffffff0fc0ff7f00e0ffffffffffffff00fcff0700ffffffffffffff0fe0ffff00f0ffffffffffffff00feff3fc0ffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0fc0ffffffffffffffffffffff00fcffffffffffffffffffff0fc0ffffffffffffffffffffff00fcffffffffffffffffffff0fc0ffffffffffffffffffff7f00fcffffffffffffffffffff00c0ffffffffffffffffffff0000fcffffffffffffffffff0f00f0ffffffffffffffffffff0000ffffffffffffffffffff0700f07f80ffffffffffffff3f00000000f8ffffffffffffff0300000080ffffffffffffff1f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0000000080ffffffffffffff0f00000000f8ffffffffffffff0100000080ffffffffffffff3f00000000f8ffffffffffffff0300e0ffffffffffffffffff7f0000feffffffffffffffffff0700e0ffffffffffffffffff7f0000feffffffffffffffffff0f00e0ffffffffffffffffffff0f00ffffffffffffffffffffff03f0ffffffffffffffffffff7f00ffffffffffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0ff0ffffffffffffffffffffff00ffffffffffffffffffffff0ff0ffffffffff87ffffffffff00ffffffffff7ff8ffffffff01f0ffffffffff07ffffffff1f00ffffffffff0f00feffffff01f0ffffffff7f00c0ffffff0f00ffffffffff0300f8ffffff00f0ffffffff1f0000ffffff0700f8ffffffff0000e0ffff7f0080ffffffff010000fcffff0700f8ffffff0f000080ffff7f00c0ffffff7f000000f0ffff0700fcffffff03000000ffff7f00c0ffffff3f000000f0ffff0f00fcffffff03000000ffffff00c0ffffff7f000000e0ffff0f00feffffff07000000feffff01f0ffffff7f000000e0ffff3f00ffffffff03000000feffff07f0ffffff3f000000e0ffffff00ffffffff03000000feffff0ff0ffffff3f000000e0ffffff00ffffffff03000000feffff0ff0ffffff7f000000e0ffffff00ffffffff07000000feffff0ff0ffffffff000000e0ffffff00ffffffff1f000000feffff0ff0ffffffff1f0000f0ffffff00ffffffffff0300c0ffffff0fe0ffffffff3f0000feffffff00feffffffff1f00f0ffffff07e0ffffffffff0380ffffff0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff1f0000ffffffffffffffffffff0100f0ffffffffffffffffff070000ffffffffffffffffffff0100f0ffffffffffffffffff0f0000ffffffffffffffffff7f0000f0ffffffffffffffffff030000ffffffffffffffffff1f0000e0ffffffffffffffffff010000fcffffffffffffffff1f0000c0ffffffffffffffff7f000000fcffffffffffffffff070000c0ff3f1cc0ff7f00f07f000000","floorSize":[196,100],"schema":626,"shared":[[40100035,2,"7857fa388ce5df599003442ab0d9ce6b9658e7be1a7a6e0d6660ab932d80654c"],[40100068,2,"38259bcaf241a068214204562fb0a540623c5bb34db86ca1f4ee4e3e7cc0dfe3"],[40700076,1,"481bfbab5d0cdaca07fd522972fb9b28706fa543659176ad9eb920e4d60a8e7a"],[40700077,1,"1731e0e6992ffe1fd678344be06fea836cb62284c0b9e812a49e4b38c0b9d214"],[40700078,1,"0e62b1fcd5f3082e89b6d13c15ef50e9ddeefffc1f4d2b3de72124a4028d1681"],[40700079,1,"81c67089d84946efb7654829c0829174a43a55cc9fc5c55b350ea3e766f76c03"],[40700080,1,"75c925e0f0c30abeb8fec522215593e12d8114343cb572b80626ccf9067656c1"],[40700081,1,"35bb5c31d9f711f5f7c523e2b8113c9a9a8ea87fffb15b1640518fdd2718e6ff"],[40700246,1,"7b8f9de3aa97b1374c926aae1e2949b9fb122f1a3dab61db06312f8a6a0802cc"],[40700247,1,"171f9e9df26eba44279c1485227ea3133188258de9b5b6313d9d8af7b7aec3ad"],[40700249,1,"8483bf80e2d0b856d0fe6166cf0879cdc4faed3a4f4fb639e989b5b613562f5d"],[40700250,1,"574c37d16540712069c74b322f2324bfe6729df0b6f078caaa47ca1ff260192e"],[40700252,1,"1d6c124855de3a9bade33200b3fe714efa26c4097763b84b74ce78c8481d6cb9"]],"sourceSha256":{"ActivityItem.json":"20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4","Building.json":"c111aea8770c2b210d4e544a7562d3d08a068b1427842f604f878ea8f4d294a3","Furniture.json":"823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674","Village04-MeadowLevel-GridData.json":"bfd75928343dacc6f2768f80585a0c2b1d5afe1c12ee2f97777bc94c20a96424"}}
"#;
const PACK_SHA:&str="ea09905ba83fa29c955117c121aa9e8a4ccee1bd24d4b5dc11eccb1c53023351";
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
pub(crate) const GRID:&str="GridData/Villages/Village04-MeadowLevel-GridData.json";
pub(crate) const ROAD:u32=40100068;
const W:u32=392;const H:u32=200;
fn n(v:&Value)->Option<u32>{v.as_u64()?.try_into().ok()}
fn exact_fields(v:&Value,keys:&[&str])->bool{v.as_object().is_some_and(|o|o.len()==keys.len()&&keys.iter().all(|k|o.contains_key(*k)))}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub(crate) struct Rect(pub(crate) i64,pub(crate) i64,pub(crate) i64,pub(crate) i64);
impl Rect{fn intersects(self,o:Self)->bool{self.0<o.2&&o.0<self.2&&self.1<o.3&&o.1<self.3}fn valid(self)->bool{self.0<self.2&&self.1<self.3}}
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct LocalTarget{pub(crate) keep:u32,pub(crate) moved:u32,pub(crate) next:u32,pub(crate) x:u32,pub(crate) y:u32}
pub(crate) struct MeadowGeometry{data:Value,mask:Vec<u8>,switch626:bool}
impl MeadowGeometry{
 /// E2902/E2931 exact 73 frame/child pins and floor on attested Switch626.
 pub(crate) fn fixed_switch626(build:&str,schema:u32)->Option<Self>{
  if build!="9A239D3DB569756D"||schema!=626{return None}
  let mut p=Self::fixed(BUILD,626)?;p.switch626=true;Some(p)
 }
 pub(crate) fn fixed(build:&str,schema:u32)->Option<Self>{
  if build!=BUILD||schema!=626||format!("{:x}",Sha256::digest(PACK.as_bytes()))!=PACK_SHA{return None}
  let data:Value=serde_json::from_str(PACK).ok()?;
  if data["contract"]!="wand.steam626.sr03.geometry-delta@1"||data["build"]!=BUILD||n(&data["schema"])?!=626||data["shared"].as_array()?.len()!=13||data["delta"].as_array()?.len()!=59{return None}
  let h=data["floor4Hex"].as_str()?;if h.len()!=4900{return None}let mut mask=Vec::with_capacity(2450);
  for i in (0..h.len()).step_by(2){mask.push(u8::from_str_radix(h.get(i..i+2)?,16).ok()?)}
  Some(Self{data,mask,switch626:false})
 }
 /// Common callback is internal, from the fixed installed COMP03 resolver,
 /// NOT a public ABI input. Logical definition dimensions are converted with
 /// exact per-definition stride, never inferred from the other operation.
 pub(crate) fn dimensions(&self,item:u32,common:impl Fn(u32)->Option<(u32,u32)>)->Option<(u32,u32)>{
  for r in self.data["shared"].as_array()?{if n(&r[0])?==item{let(w,h)=common(item)?;let t=n(&r[1])?;return scaled(w,h,t)}}
  for r in self.data["delta"].as_array()?{if n(&r[0])?==item{return scaled(n(&r[1])?,n(&r[2])?,n(&r[3])?)}}
  None
 }
 /// ACT1196: exact two saved building classes on the fixed installed provider.
 /// The caller must obtain houses from the same validated immutable World and
 /// establish fresh ordinary-load/overlay/provider identity before use.
 /// A malformed special item never falls back to a generic rectangle.
 pub(crate) fn effective_building(&self,o:&Value,houses:&Value)->Option<Rect>{
  if !exact_fields(o,&["ID","ItemID","X","Y","Orientation","State"])||n(&o["ID"])?==0{return None}
  let item=n(&o["ItemID"])?;let x=i64::from(n(&o["X"])?);let y=i64::from(n(&o["Y"])?);
  let s=&o["State"];
  let (def,w,h)=match item{
   20500005=>{
    if o["Orientation"]!="GridOrientation_Right"||!exact_fields(s,&["HouseData"]){return None}
    let a=&s["HouseData"];
    if !exact_fields(a,&["Built","UpgradeState","PlayerHouseIndex"])||a["Built"]!=true||n(&a["PlayerHouseIndex"])?!=0
     ||!exact_fields(&a["UpgradeState"],&["Level"])||n(&a["UpgradeState"]["Level"])?!=4{return None}
    let hs=houses.as_array()?;if hs.is_empty()||hs.len()>4096{return None}
    if n(&hs[0]["HouseItemID"])?!=item||hs.iter().any(|v|!v.is_object()||n(&v["HouseItemID"]).is_none())||hs.iter().filter(|v|n(&v["HouseItemID"])==Some(item)).count()!=1{return None}
    ("cf32d344d2621e4caa83d7c05652013e7f7ed008fd1ed13a1ab3562a159f52ff",26,22)
   },
   20300115=>{
    if o["Orientation"]!="GridOrientation_Down"||!exact_fields(s,&["BuildingWithSkinData"]){return None}
    let a=&s["BuildingWithSkinData"];
    if !exact_fields(a,&["UpgradeState","CurrentSkinItemID"])||!a["UpgradeState"].is_null()||n(&a["CurrentSkinItemID"])?!=0{return None}
    ("4b024c5d461aa4d3a77344e1946dc46d478a6d05891a8809bc63cd54c4648c2d",14,10)
   },
   _=>return None,
  };
  let row=self.data["delta"].as_array()?.iter().find(|v|n(&v[0])==Some(item))?;
  if row[4]!=def||n(&row[3])?!=1{return None}
  let dims=self.dimensions(item,|_|None)?;
  if (item==20500005&&dims!=(22,26))||(item==20300115&&dims!=(14,10)){return None}
  Some(Rect(x,y,x+i64::from(w),y+i64::from(h)))
 }
 /// Route exact affected buildings through their fixed proof, never through
 /// the remaining ambient callback. No product/session/rights grant here.
 pub(crate) fn local_candidate_with_buildings(&self,grid:&Value,keep:u32,moved:u32,houses:&Value,common:impl Fn(u32)->Option<(u32,u32)>,mut other:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<LocalTarget>{
  self.local_candidate(grid,keep,moved,common,|o,dims|match n(&o["ItemID"])?{
   20500005|20300115=>self.effective_building(o,houses),
   _=>other(o,dims),
  })
 }
 pub(crate) fn floor4(&self,x:u32,y:u32)->bool{if x>=W||y>=H{return false}let i=((x/2)*100+y/2) as usize;self.mask[i/8]&(1<<(i%8))!=0}
 /// Exact five saved 2x2 cells and two-cell halo. This deliberately accepts
 /// only a *Core-owned* ambient proof callback; it does not infer an effective
 /// footprint from State or a definition alone. Missing proof rejects.
 /// Caller must prove current root/parent/overlay/reference/epoch/stock/rights.
 pub(crate) fn local_candidate(&self,grid:&Value,keep:u32,moved:u32,common:impl Fn(u32)->Option<(u32,u32)>,mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<LocalTarget>{
  if n(&grid["ID"])?==0||grid["GridDataPath"]!=GRID||grid["GridDefaultLayoutPath"]!=""||n(&grid["TessellationFactor"])?!=2{return None}
  let next=n(&grid["NextGridObjectID"])?;if keep==0||moved==0||keep==moved||keep>=next||moved>=next||next.checked_add(3)?>i32::MAX as u32{return None}
  let objects=grid["Objects"].as_object()?;if objects.len()>4096{return None}
  let a=objects.get(&keep.to_string())?;let b=objects.get(&moved.to_string())?;
  let x=n(&a["X"])?;let y=n(&a["Y"])?;
  if x%4!=0||y%4!=0||!seed(a,keep,x,y)||!seed(b,moved,x.checked_add(4)?,y)||x.checked_add(10)?>W||y.checked_add(6)?>H{return None}
  if self.dimensions(ROAD,&common)?!=(2,2){return None}
  let anchors=[(x,y),(x+4,y),(x+4,y+4),(x+8,y),(x+8,y+4)];
  let mut boxes=Vec::with_capacity(5);
  for (x,y) in anchors{for dx in 0..2{for dy in 0..2{if !self.floor4(x+dx,y+dy){return None}}}boxes.push(Rect(i64::from(x)-2,i64::from(y)-2,i64::from(x)+4,i64::from(y)+4));}
  self.clear_ambient(objects,next,&[keep,moved],&boxes,&common,&mut effective)?;
  Some(LocalTarget{keep,moved,next,x,y})
 }
 /// Exact R01 horizontal three-add pose; no debit, no target/Stage authority.
 /// Unlike mixed q5, NO existing object is exempted from the halo scan.
 /// The caller binds the exact Switch626 provider and same-session references.
 pub(crate) fn local_r01_with_buildings(&self,grid:&Value,x:u32,y:u32,houses:&Value,common:impl Fn(u32)->Option<(u32,u32)>,mut other:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  self.local_r01(grid,x,y,common,|o,dims|match n(&o["ItemID"])?{
   20500005|20300115=>self.effective_building(o,houses),
   _=>other(o,dims),
  })
 }
 pub(crate) fn local_r01(&self,grid:&Value,x:u32,y:u32,common:impl Fn(u32)->Option<(u32,u32)>,mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  if n(&grid["ID"])?==0||grid["GridDataPath"]!=GRID||grid["GridDefaultLayoutPath"]!=""||n(&grid["TessellationFactor"])?!=2{return None}
  let next=n(&grid["NextGridObjectID"])?;
  if next==0||next.checked_add(3)?>i32::MAX as u32||x%4!=0||y%4!=0||x.checked_add(10)?>W||y.checked_add(2)?>H{return None}
  let objects=grid["Objects"].as_object()?;
  if objects.is_empty()||objects.len()>4096||objects.contains_key("0")||self.dimensions(ROAD,&common)?!=(2,2){return None}
  let anchors=[(x,y),(x+4,y),(x+8,y)];
  let mut boxes=Vec::with_capacity(3);
  for (x,y) in anchors{for dx in 0..2{for dy in 0..2{if !self.floor4(x+dx,y+dy){return None}}}boxes.push(Rect(i64::from(x)-2,i64::from(y)-2,i64::from(x)+4,i64::from(y)+4));}
  self.clear_ambient(objects,next,&[],&boxes,&common,&mut effective)?;
  Some(next)
 }
 pub(crate) fn local_r02_with_buildings(&self,grid:&Value,x:u32,y:u32,houses:&Value,common:impl Fn(u32)->Option<(u32,u32)>,mut other:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  self.local_r02(grid,x,y,common,|o,dims|match n(&o["ItemID"])?{
   20500005|20300115=>self.effective_building(o,houses),
   _=>other(o,dims),
  })
 }
 pub(crate) fn local_r02(&self,grid:&Value,x:u32,y:u32,common:impl Fn(u32)->Option<(u32,u32)>,mut effective:impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<u32>{
  if n(&grid["ID"])?==0||grid["GridDataPath"]!=GRID||grid["GridDefaultLayoutPath"]!=""||n(&grid["TessellationFactor"])?!=2{return None}
  let next=n(&grid["NextGridObjectID"])?;
  if next==0||next.checked_add(4)?>i32::MAX as u32||x%4!=0||y%4!=0||x.checked_add(6)?>W||y.checked_add(6)?>H{return None}
  let objects=grid["Objects"].as_object()?;
  if objects.is_empty()||objects.len()>4096||objects.contains_key("0")||self.dimensions(ROAD,&common)?!=(2,2){return None}
  let anchors=[(x,y),(x+4,y+4),(x+4,y),(x,y+4)];
  let mut boxes=Vec::with_capacity(4);
  for (x,y) in anchors{for dx in 0..2{for dy in 0..2{if !self.floor4(x+dx,y+dy){return None}}}boxes.push(Rect(i64::from(x)-2,i64::from(y)-2,i64::from(x)+4,i64::from(y)+4));}
  self.clear_ambient(objects,next,&[],&boxes,&common,&mut effective)?;
  Some(next)
 }
 fn clear_ambient(&self,objects:&serde_json::Map<String,Value>,next:u32,exclude:&[u32],boxes:&[Rect],common:&impl Fn(u32)->Option<(u32,u32)>,effective:&mut impl FnMut(&Value,(u32,u32))->Option<Rect>)->Option<()>{
  for(k,o)in objects{if !exact_fields(o,&["ID","ItemID","X","Y","Orientation","State"]){return None}let id=n(&o["ID"])?;if k!=&id.to_string()||id>=next{return None}if exclude.contains(&id){continue}
   let dims=self.dimensions(n(&o["ItemID"])?,common)?;let ox=i64::from(n(&o["X"])?);let oy=i64::from(n(&o["Y"])?);o["Orientation"].as_str()?;
   let rect=effective(o,dims)?;if !rect.valid()||ox<rect.0||ox>=rect.2||oy<rect.1||oy>=rect.3||boxes.iter().any(|b|b.intersects(rect)){return None}
  }
  Some(())
 }
}
fn scaled(w:u32,h:u32,t:u32)->Option<(u32,u32)>{if ![1,2].contains(&t)||w==0||h==0{return None}let a=w.checked_mul(2)?;let b=h.checked_mul(2)?;if a%t!=0||b%t!=0{return None}Some((a/t,b/t))}
fn seed(o:&Value,id:u32,x:u32,y:u32)->bool{exact_fields(o,&["ID","ItemID","X","Y","Orientation","State"])&&n(&o["ID"])==Some(id)&&n(&o["ItemID"])==Some(ROAD)&&n(&o["X"])==Some(x)&&n(&o["Y"])==Some(y)&&o["Orientation"]=="GridOrientation_Down"&&o["State"].is_null()}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn common(i:u32)->Option<(u32,u32)>{if i==ROAD{Some((2,2))}else{None}}
 fn fixture(p:&MeadowGeometry)->Value{let(x,y)=(0..W-10).step_by(4).flat_map(|x|(0..H-6).step_by(4).map(move|y|(x,y))).find(|&(x,y)|[(x,y),(x+4,y),(x+4,y+4),(x+8,y),(x+8,y+4)].iter().all(|&(x,y)|(0..2).all(|a|(0..2).all(|b|p.floor4(x+a,y+b))))).unwrap();
 let road=|id,x,y|json!({"ID":id,"ItemID":ROAD,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":null});json!({"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":{"10":road(10,x,y),"11":road(11,x+4,y)}})}
 #[test]fn exact_native_building_bounds_and_no_fallback(){
  let p=MeadowGeometry::fixed(BUILD,626).unwrap();
  let h=json!([{"HouseItemID":20500005}]);
  let house=json!({"ID":12,"ItemID":20500005,"X":80,"Y":40,"Orientation":"GridOrientation_Right",
      "State":{"HouseData":{"Built":true,"UpgradeState":{"Level":4},"PlayerHouseIndex":0}}});
  let skin=json!({"ID":13,"ItemID":20300115,"X":100,"Y":60,"Orientation":"GridOrientation_Down",
      "State":{"BuildingWithSkinData":{"UpgradeState":null,"CurrentSkinItemID":0}}});
  assert_eq!(p.effective_building(&house,&h),Some(Rect(80,40,106,62)));
  assert_eq!(p.effective_building(&skin,&h),Some(Rect(100,60,114,70)));
  for o in [&house,&skin]{
   for (key,value) in [("ID",json!(0)),("X",json!(0.5)),("Orientation",json!("GridOrientation_Up")),("State",json!(null)),("From",json!({})),("GridArea",json!({})),("ItemID",json!(20000000))]{
    let mut q=o.clone();q[key]=value;assert!(p.effective_building(&q,&h).is_none());
   }
  }
  for (key,value) in [("Built",json!(false)),("PlayerHouseIndex",json!(false)),("PlayerHouseIndex",json!(1)),("UpgradeState",json!({"Level":3})),("UpgradeState",json!({"Level":4,"Extra":0}))]{
   let mut q=house.clone();q["State"]["HouseData"][key]=value;assert!(p.effective_building(&q,&h).is_none());
  }
  for bad in [json!([]),json!([{"HouseItemID":20500006}]),json!([{"HouseItemID":20500005},{"HouseItemID":20500005}]),json!([{"HouseItemID":20500005},null]),json!([{"HouseItemID":20500005},{"HouseItemID":"20500005"}]),json!([{"HouseItemID":20500005},{}])]{
   assert!(p.effective_building(&house,&bad).is_none());
  }
  for (key,value) in [("CurrentSkinItemID",json!(false)),("CurrentSkinItemID",json!(20300116)),("UpgradeState",json!({"Level":1}))]{
   let mut q=skin.clone();q["State"]["BuildingWithSkinData"][key]=value;assert!(p.effective_building(&q,&h).is_none());
  }
  let mut d=fixture(&p);let x=n(&d["Objects"]["10"]["X"]).unwrap();let y=n(&d["Objects"]["10"]["Y"]).unwrap();
  let mut o=house.clone();o["X"]=json!(x+12);o["Y"]=json!(y);
  d["Objects"]["12"]=o;assert!(p.local_candidate_with_buildings(&d,10,11,&h,common,|_,_|panic!("special fallback")).is_some());
  d["Objects"]["12"]["X"]=json!(x+11);
  assert!(p.local_candidate_with_buildings(&d,10,11,&h,common,|_,_|panic!("special fallback")).is_none());
  d["Objects"]["12"]["X"]=json!(x+12);d["Objects"]["12"]["State"]["HouseData"]["Built"]=json!(false);
  assert!(p.local_candidate_with_buildings(&d,10,11,&h,common,|_,_|panic!("special fallback")).is_none());
 }
 #[test]fn installed_delta_and_exact_local_scope(){let p=MeadowGeometry::fixed(BUILD,626).unwrap();assert!(MeadowGeometry::fixed("foreign",626).is_none());assert!(MeadowGeometry::fixed(BUILD,624).is_none());assert_eq!(p.dimensions(ROAD,common),Some((2,2)));assert!(p.dimensions(ROAD,|_|None).is_none());assert!(p.dimensions(0,common).is_none());assert_eq!((0..196).flat_map(|x|(0..100).map(move|y|(x,y))).filter(|&(x,y)|p.floor4(x*2,y*2)).count(),13208);assert!(!p.floor4(W,0));assert!(!p.floor4(0,H));let d=fixture(&p);assert!(p.local_candidate(&d,10,11,common,|_,_|None).is_some());
 for (k,v) in [("ID",json!(0)),("GridDataPath",json!("bad")),("GridDefaultLayoutPath",json!("overlay")),("TessellationFactor",json!(1)),("NextGridObjectID",json!(11))]{let mut q=d.clone();q[k]=v;assert!(p.local_candidate(&q,10,11,common,|_,_|None).is_none())}for(k,v)in[("X",json!(1)),("State",json!({})),("Orientation",json!("GridOrientation_Up")),("ItemID",json!(40000066)),("ID",json!(12))]{let mut q=d.clone();q["Objects"]["10"][k]=v;assert!(p.local_candidate(&q,10,11,common,|_,_|None).is_none())}
 let mut q=d.clone();let mut o=q["Objects"]["10"].clone();o["ID"]=json!(12);q["Objects"]["12"]=o;assert!(p.local_candidate(&q,10,11,common,|_,_|None).is_none());let x=n(&q["Objects"]["10"]["X"]).unwrap() as i64;let y=n(&q["Objects"]["10"]["Y"]).unwrap() as i64;assert!(p.local_candidate(&q,10,11,common,|_,_|Some(Rect(x,y,x+2,y+2))).is_none());assert!(p.local_candidate(&q,10,11,common,|_,_|Some(Rect(x-4,y,x-2,y+2))).is_none());let far_x=x+12; q["Objects"]["12"]["X"]=json!(far_x);assert!(p.local_candidate(&q,10,11,common,|_,_|Some(Rect(far_x,y,far_x+2,y+2))).is_some());q["Objects"]["12"]["X"]=json!(far_x-1);assert!(p.local_candidate(&q,10,11,common,|_,_|Some(Rect(far_x-1,y,far_x+1,y+2))).is_none());}
}

#[cfg(test)]
mod r01_local_tests {
 use super::*;use serde_json::json;
 #[test]fn exact_r01_no_existing_seed_exemption(){
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let common=|id|if id==ROAD{Some((2,2))}else{None};
  let(x,y)=(0..W-10).step_by(4).flat_map(|x|(0..H-2).step_by(4).map(move|y|(x,y)))
   .find(|&(x,y)|[(x,y),(x+4,y),(x+8,y)].iter().all(|&(a,b)|(0..2).all(|i|(0..2).all(|j|p.floor4(a+i,b+j))))).unwrap();
  let fx=if x<190{388}else{0};let fy=if y<100{196}else{0};
  let mut g=json!({"ID":42,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":{"12":{"ID":12,"ItemID":ROAD,"X":fx,"Y":fy,"Orientation":"GridOrientation_Down","State":null}}});
  let effective=|o:&Value,_|{let a=i64::from(n(&o["X"])?);let b=i64::from(n(&o["Y"])?);Some(Rect(a,b,a+2,b+2))};
  assert_eq!(p.local_r01(&g,x,y,common,effective),Some(50));
  for (a,b) in [(x,y),(x+4,y),(x+8,y),(x+10,y),(x,y+2)]{
   g["Objects"]["12"]["X"]=json!(a);g["Objects"]["12"]["Y"]=json!(b);
   assert!(p.local_r01(&g,x,y,common,effective).is_none());
  }
  g["Objects"]["12"]["X"]=json!(fx);g["Objects"]["12"]["Y"]=json!(fy);
  assert!(p.local_r01(&g,x+1,y,common,effective).is_none());
  assert!(p.local_r01(&g,x,y,common,|_,_|None).is_none());
  for (k,v) in [("NextGridObjectID",json!(i32::MAX)),("GridDefaultLayoutPath",json!("foreign")),("TessellationFactor",json!(1))]{let mut q=g.clone();q[k]=v;assert!(p.local_r01(&q,x,y,common,effective).is_none());}
 }
}

#[path="fm01_product_geometry.rs"]
mod fm01_product_geometry;

#[path="fence_product_geometry.rs"]
mod fence_product_geometry;

pub(crate) use fence_product_geometry::FenceAddTargetKind;
