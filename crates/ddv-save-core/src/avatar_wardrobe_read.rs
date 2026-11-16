//! ACT1147: existing bounded Avatar/stock reader shared by native and product.
//! Internal observation only; no private plan, fixture, or authority.
use super::*;
use super::super::{Platform,BuildKind};
use sha2::{Digest,Sha256};
use serde_json::{json,Value};
    pub(super) const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
    pub(super) const MAX_AVATAR_FIELDS:usize=64;
    pub(super) const MAX_CUSTOMIZATIONS:usize=256;
    pub(super) const MAX_MAKEUP:usize=32; // bounded structural scan, not Native allowed set
    pub(super) const MAX_AVATAR_BYTES:usize=1024*1024;
    pub(super) fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|x|format!("{x:02x}")).collect()}
    pub(super) fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
    pub(super) fn members(bytes:&[u8],span:Span,max:usize)->CoreResult<Vec<(String,Span)>>{
        if span.end>bytes.len()||span.begin>=span.end||
            bytes.get(span.begin)!=Some(&b'{')||bytes.get(span.end-1)!=Some(&b'}'){
            return Err(denied("AVATAR_OBJECT_REQUIRED"));
        }
        let mut pos=skip_ws(bytes,span.begin+1);
        let mut out=Vec::new();
        while pos<span.end-1{
            if out.len()>=max{return Err(denied("AVATAR_MEMBER_BOUND"));}
            let (f,v,n,done)=indexed_field_at(bytes,span,pos)?;
            out.push((f.key,v));
            pos=skip_ws(bytes,n);
            if done{break}
        }
        if pos!=span.end-1{return Err(denied("AVATAR_OBJECT_SPAN"));}
        Ok(out)
    }
    pub(super) fn field(fields:&[(String,Span)],name:&str)->Option<Span>{
        fields.iter().find(|(k,_)|k==name).map(|(_,v)|*v)
    }
    pub(super) fn required(fields:&[(String,Span)],name:&str)->CoreResult<Span>{
        field(fields,name).ok_or(denied("AVATAR_REQUIRED_FIELD_ABSENT"))
    }
    pub(super) fn int(bytes:&[u8],span:Span)->CoreResult<i32>{
        let token=bytes.get(span.begin..span.end).ok_or(denied("AVATAR_INT_SPAN"))?;
        if token.is_empty()||token.len()>11{return Err(denied("AVATAR_INT32_REQUIRED"));}
        let v=serde_json::from_slice::<i32>(token).map_err(|_|denied("AVATAR_INT32_REQUIRED"))?;
        // Native int32 decimal tokens only, no exponents, float or strings.
        if token!=v.to_string().as_bytes(){return Err(denied("AVATAR_INT32_CANONICAL"));}
        Ok(v)
    }
    pub(super) fn key_u32(k:&str)->CoreResult<u32>{
        let v=k.parse::<u32>().map_err(|_|denied("AVATAR_MAP_KEY"))?;
        if v.to_string()!=k{return Err(denied("AVATAR_MAP_KEY"));}
        Ok(v)
    }
    pub(super) fn optional_int(bytes:&[u8],fields:&[(String,Span)],name:&str)->CoreResult<Option<i32>>{
        field(fields,name).map(|s|int(bytes,s)).transpose()
    }
    pub(super) fn palette(v:Option<i32>)->bool{v.map(|n|(0..90).contains(&n)).unwrap_or(false)}
    #[derive(Clone,Debug)]
    pub(super) struct RefEntry{pub(super) key:u32,pub(super) value:i32,pub(super) entry_sha:String}
    #[derive(Clone,Debug)]
    pub(super) struct RefMap{pub(super) present:bool,pub(super) sha:Option<String>,pub(super) entries:Vec<RefEntry>}
    pub(super) fn refs(bytes:&[u8],span:Option<Span>,mode:&str)->CoreResult<RefMap>{
        let Some(s)=span else{return Ok(RefMap{present:false,sha:None,entries:Vec::new()})};
        let max=match mode{"Clothes"|"IncompatibleClothes"=>18,"Makeup"=>MAX_MAKEUP,
            "ClothingCustomization"=>MAX_CUSTOMIZATIONS,_=>return Err(denied("AVATAR_REF_MODE"))};
        let mut entries=Vec::new();
        for (k,v) in members(bytes,s,max)?{
            let key=key_u32(&k)?;
            let value=match mode{
                "Clothes"|"IncompatibleClothes"=>{
                    if key>17{return Err(denied("AVATAR_CLOTHING_SLOT"));}
                    let n=int(bytes,v)?;
                    // Explicit zero is retained as a saved scalar, not an
                    // inferred unequipped/default or authorized item.
                    if n<0||(n!=0&&n/10_000_000!=5){return Err(denied("AVATAR_CLOTHING_ID_PREFIX"));}
                    n
                },
                "Makeup"=>{
                    if key>=32{return Err(denied("AVATAR_MAKEUP_SLOT_BOUND"));}
                    let obj=members(bytes,v,32)?;
                    // Only a physically present exact member is read. No
                    // alias/default or claim of actual Steam save presence.
                    let n=int(bytes,required(&obj,"MakeupItemID")?)?;
                    if n<=0||n/10_000_000!=14{return Err(denied("AVATAR_MAKEUP_ID_PREFIX"));}
                    n
                },
                "ClothingCustomization"=>{
                    if key==0||key>i32::MAX as u32||key/10_000_000!=5{
                        return Err(denied("AVATAR_CUSTOMIZATION_ITEM_KEY"));}
                    // Native map<int32,int32>: retain exact saved design scalar,
                    // including zero/negative, never assume design ownership.
                    int(bytes,v)?
                },
                _=>return Err(denied("AVATAR_REF_MODE")),
            };
            entries.push(RefEntry{key,value,entry_sha:sha(&bytes[v.begin..v.end])});
        }
        Ok(RefMap{present:true,sha:Some(sha(&bytes[s.begin..s.end])),entries})
    }
    pub(super) fn map_json(m:&RefMap)->Value{
        json!({"present":m.present,"mapSha256":m.sha,
            "entries":m.entries.iter().map(|r|json!({"key":r.key,"savedValue":r.value,"entrySha256":r.entry_sha})).collect::<Vec<_>>()})
    }
    #[derive(Clone,Debug)]
    pub(super) struct Branch {
        pub(super) sha:String,pub(super) hair:Option<i32>,pub(super) highlight:Option<i32>,
        pub(super) clothes:RefMap,pub(super) incompatible:RefMap,pub(super) makeup:RefMap,pub(super) customization:RefMap,
    }
    pub(super) fn branch(bytes:&[u8],span:Span)->CoreResult<Branch>{
        if span.end-span.begin>MAX_AVATAR_BYTES{return Err(denied("AVATAR_BRANCH_BYTE_BOUND"));}
        let f=members(bytes,span,MAX_AVATAR_FIELDS)?;
        Ok(Branch{sha:sha(&bytes[span.begin..span.end]),
            hair:optional_int(bytes,&f,"HairColorIndex")?,
            highlight:optional_int(bytes,&f,"HairHighlightColor")?,
            clothes:refs(bytes,field(&f,"Clothes"),"Clothes")?,
            incompatible:refs(bytes,field(&f,"IncompatibleClothes"),"IncompatibleClothes")?,
            makeup:refs(bytes,field(&f,"Makeup"),"Makeup")?,
            customization:refs(bytes,field(&f,"ClothingCustomization"),"ClothingCustomization")?,
        })
    }
    pub(super) fn branch_json(b:&Branch)->Value{
        json!({"branchSha256":b.sha,
            "hairColorIndex":b.hair,"hairColorIndexPresent":b.hair.is_some(),
            "hairHighlightColorIndex":b.highlight,"hairHighlightColorPresent":b.highlight.is_some(),
            "hairHighlightSavedField":"HairHighlightColor",
            "bothPackagedHairIndicesCandidate":palette(b.hair)&&palette(b.highlight),
            "clothes":map_json(&b.clothes),"incompatibleClothes":map_json(&b.incompatible),
            "makeup":map_json(&b.makeup),"clothingCustomization":map_json(&b.customization),
            "allFourReferenceMapsPresent":b.clothes.present&&b.incompatible.present&&b.makeup.present&&b.customization.present,
            "nativeReferenceClosureVerified":false,"rightsVerified":false})
    }
    /// Opaque native receipt; no Serialize/Deserialize for private source data.
    /// JSON is emitted only by the local explicit receipt executor.
    pub struct PrivateActiveAvatarReceipt{
        pub(super) scope:WorkerEnvelope,pub(super) is_male:bool,pub(super) female:Branch,pub(super) male:Branch,
    }
    impl PrivateActiveAvatarReceipt{
        pub fn to_private_receipt_json(&self)->Value{
            let active=if self.is_male{&self.male}else{&self.female};
            json!({"contract":"wand.native.private.active-avatar-read@1",
                "platform":"SteamWindows","fullVersion":EXACT,"schema":626,
                "sessionId":hex(&self.scope.session_id),"revision":self.scope.expected_revision,
                "indexGeneration":self.scope.expected_index_generation,
                "decodedSha256":hex(&self.scope.expected_decoded_sha256),
                "avatarIsMale":self.is_male,"activeBranch":if self.is_male{"MaleAvatar"}else{"FemaleAvatar"},
                "activeHairFieldsPresent":active.hair.is_some()&&active.highlight.is_some(),
                "activeBothPackagedHairIndicesCandidate":palette(active.hair)&&palette(active.highlight),
                "femaleAvatar":branch_json(&self.female),"maleAvatar":branch_json(&self.male),
                "fullDocumentRustValidated":true,"physicalGameInstallCryptographicallyProven":false,
                "actualAllowedPaletteVerified":false,"rightsVerified":false,
                "nativeReferenceClosureVerified":false,"cleanupClosureVerified":false,
                "productReadAccepted":false,"writerAuthorized":false,"editedCopyAuthorized":false,
                "applyAuthorized":false,"nativeV3Verified":false})
        }
    }
    pub(super) fn avatar_snapshot(bytes:&[u8],fields:&[(String,Span)],e:WorkerEnvelope)
        ->CoreResult<PrivateActiveAvatarReceipt>{
        let gender=required(fields,"AvatarIsMale")?;
        let is_male=match &bytes[gender.begin..gender.end]{
            b"true"=>true,b"false"=>false,_=>return Err(denied("AVATAR_GENDER_BOOL_REQUIRED")),
        };
        Ok(PrivateActiveAvatarReceipt{scope:e,is_male,
            female:branch(bytes,required(fields,"FemaleAvatar")?)?,
            male:branch(bytes,required(fields,"MaleAvatar")?)?})
    }
    pub(super) fn enum_token(bytes:&[u8],s:Span,prefix:&str)->CoreResult<String>{
        let v=text_token(bytes,s,128)?;
        if !v.starts_with(prefix)||v.len()<=prefix.len()||
           !v.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'){
            return Err(denied("AVATAR_DEP_ENUM_TOKEN"));}
        Ok(v)
    }
    pub(super) fn text_token(bytes:&[u8],span:Span,max:usize)->CoreResult<String>{
        let token=bytes.get(span.begin..span.end).ok_or(denied("SKIN_TOKEN_SPAN"))?;
        if token.len()>max{return Err(denied("SKIN_TOKEN_BOUND"));}
        serde_json::from_slice::<String>(token).map_err(|_|denied("SKIN_STRING_REQUIRED"))
    }
    pub(super) fn inventory_dependencies(bytes:&[u8],lists:Span,avatar:&PrivateActiveAvatarReceipt,proposed_clothing:Option<i32>)->CoreResult<Value>{
        use std::collections::BTreeSet;
        let mut clothes=BTreeSet::new();let mut makeup=BTreeSet::new();
        for b in [&avatar.female,&avatar.male]{
            for m in [&b.clothes,&b.incompatible]{
                for e in &m.entries{if e.value>0{clothes.insert(e.value);}}
            }
            for e in &b.customization.entries{clothes.insert(e.key as i32);}
            for e in &b.makeup.entries{makeup.insert(e.value);}
        }
        if let Some(id)=proposed_clothing{clothes.insert(id);}
        let mut selected=[None,None];
        for (key,rec) in members(bytes,lists,128)?{
            let id=key_u32(&key)?;
            let f=members(bytes,rec,64)?;
            let id_span=required(&f,"ID")?;let id_token=&bytes[id_span.begin..id_span.end];
            let saved=serde_json::from_slice::<u32>(id_token)
                .map_err(|_|denied("AVATAR_DEP_INVENTORY_ID"))?;
            if id!=saved||id_token!=saved.to_string().as_bytes(){return Err(denied("AVATAR_DEP_INVENTORY_ID"));}
            let ty=text_token(bytes,required(&f,"CompatibleItemType")?,128)?;
            if id==1||ty=="ItemType_Clothing"{
                if id!=1||ty!="ItemType_Clothing"||selected[0].replace((rec,required(&f,"Inventory")?)).is_some(){
                    return Err(denied("AVATAR_DEP_CLOTHING_ROUTE"));}
            }
            if id==3||ty=="ItemType_Makeup"{
                if id!=3||ty!="ItemType_Makeup"||selected[1].replace((rec,required(&f,"Inventory")?)).is_some(){
                    return Err(denied("AVATAR_DEP_MAKEUP_ROUTE"));}
            }
        }
        let reference_count=clothes.len()+makeup.len();
        let all_maps_present=[&avatar.female,&avatar.male].iter().all(|b|
            b.clothes.present&&b.incompatible.present&&b.makeup.present&&b.customization.present);
        let mut all_positive=true;let mut routes=Vec::new();
        for (i,wanted) in [clothes,makeup].into_iter().enumerate(){
            let (rec,items)=selected[i].ok_or(denied("AVATAR_DEP_REQUIRED_ROUTE_ABSENT"))?;
            let (id,major,ty)=if i==0{(1,5,"ItemType_Clothing")}else{(3,14,"ItemType_Makeup")};
            let mut found=std::collections::BTreeMap::new();
            for (k,v) in members(bytes,items,16384)?{
                let n=key_u32(&k)?;
                if n==0||n>i32::MAX as u32||n/10_000_000!=major{
                    return Err(denied("AVATAR_DEP_INVENTORY_ITEM_KEY"));}
                if wanted.contains(&(n as i32)){found.insert(n as i32,v);}
            }
            let mut entries=Vec::new();
            for n in wanted{
                let span=found.get(&n).copied();
                let mut amount=None;let mut marker=None;let mut marker_sha=None;
                if let Some(v)=span{
                    let f=members(bytes,v,64)?;
                    amount=Some(int(bytes,required(&f,"Amount")?)?);
                    if let Some(m)=field(&f,"Marker"){
                        marker=Some(enum_token(bytes,m,"ItemMarker_")?);
                        marker_sha=Some(sha(&bytes[m.begin..m.end]));
                    }
                }
                let positive=amount.is_some_and(|a|a>0);
                all_positive&=positive;
                entries.push(json!({"itemId":n,"present":span.is_some(),"savedAmount":amount,
                    "entrySha256":span.map(|v|sha(&bytes[v.begin..v.end])),
                    "markerPresent":marker.is_some(),"savedMarker":marker,"markerSha256":marker_sha,
                    "positiveSavedAmount":positive,"nativeHasItemVerified":false,"rightsVerified":false}));
            }
            routes.push(json!({"inventoryId":id,"compatibleItemType":ty,
                "recordSha256":sha(&bytes[rec.begin..rec.end]),"mapSha256":sha(&bytes[items.begin..items.end]),
                "entries":entries}));
        }
        Ok(json!({"listInventoriesSha256":sha(&bytes[lists.begin..lists.end]),"routes":routes,
            "observedUniqueReferenceCount":reference_count,"allFourMapsPerBranchPresent":all_maps_present,
            "allObservedReferencesHavePositiveSavedAmount":all_positive,
            "nativeExtractClothesAndMakeupVerified":false,"adequateDressVerified":false,
            "variationVerified":false,"rightsVerified":false}))
    }

impl ProductSession{
        pub(crate) fn observe_wardrobe_same_slot(&self,e:WorkerEnvelope,slot:u32,old:i32,new:i32,switch:bool)
            ->CoreResult<Value>{
            const SWITCH_BID:&str="9A239D3DB569756D";
            let b=&self.native_source_build;
            let matches_build=if switch{
                b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&b.build_id==SWITCH_BID
            }else{
                b.platform==Platform::SteamWindows&&b.build_kind==BuildKind::SteamFullVersion&&b.build_id==EXACT
            };
            if !matches_build||b.schema!=626||!b.externally_attested{
                return Err(denied("WARDROBE_EXACT_EXTERNAL_BUILD_REQUIRED"));}
            // Initial reviewed top-inner slot only; no hair, full-body, new
            // slot, arbitrary map path or untrusted Build generalization.
            if slot!=0||old/10_000_000!=5||new/10_000_000!=5||old==new{
                return Err(denied("WARDROBE_SELECTOR"));}
            let st=self.lock()?;validate_scope(self,&st,&e)?;
            let bytes=&self.decoded;let root=roots(bytes)?;
            let player=members(bytes,root.player,1024)?;
            let avatar=avatar_snapshot(bytes,&player,e)?;
            let active=if avatar.is_male{&avatar.male}else{&avatar.female};
            if !active.clothes.present||!active.incompatible.present||
               !active.customization.present||!active.customization.entries.is_empty()||
               active.incompatible.entries.iter().any(|v|v.key==slot){
                return Err(denied("WARDROBE_ACTIVE_MAP_SCOPE"));}
            let current=active.clothes.entries.iter().find(|v|v.key==slot)
                .ok_or(denied("WARDROBE_OCCUPIED_SLOT_REQUIRED"))?;
            if current.value!=old{return Err(denied("WARDROBE_OLD_VALUE"));}
            // The reviewed proposed item was not observed in either Avatar.
            // Do not infer absent/default, cleanup or conflicting slot safety.
            for branch in [&avatar.female,&avatar.male]{
                if branch.clothes.entries.iter().chain(branch.incompatible.entries.iter())
                    .any(|v|v.value==new)||branch.customization.entries.iter().any(|v|v.key==new as u32){
                    return Err(denied("WARDROBE_PROPOSED_ALREADY_REFERENCED"));}
            }
            let inventory=inventory_dependencies(bytes,required(&player,"ListInventories")?,&avatar,Some(new))?;
            let routes=inventory["routes"].as_array().ok_or(denied("WARDROBE_ROUTE"))?;
            let route=routes.first().filter(|v|v["inventoryId"]==1&&v["compatibleItemType"]=="ItemType_Clothing")
                .ok_or(denied("WARDROBE_ROUTE"))?;
            let rows=route["entries"].as_array().ok_or(denied("WARDROBE_STOCK_ROWS"))?;
            let stock=|id:i32|->CoreResult<Value>{
                let v=rows.iter().find(|v|v["itemId"]==id).ok_or(denied("WARDROBE_STOCK_ABSENT"))?;
                if v["present"]!=true||v["positiveSavedAmount"]!=true||v["markerPresent"]!=true||
                   !matches!(v["savedMarker"].as_str(),Some("ItemMarker_None")|Some("ItemMarker_Favorite")){
                    return Err(denied("WARDROBE_STOCK_OR_MARKER"));}
                Ok(v.clone())
            };
            let mut avatar_json=avatar.to_private_receipt_json();
            if switch{
                let obj=avatar_json.as_object_mut().ok_or(denied("WARDROBE_AVATAR_RECEIPT"))?;
                obj.remove("fullVersion");
                obj.insert("contract".into(),json!("wand.native.private.switch626.active-avatar-read@1"));
                obj.insert("platform".into(),json!("Switch"));
                obj.insert("buildKind".into(),json!("SwitchBid"));
                obj.insert("buildId".into(),json!(SWITCH_BID));
            }
            let value=json!({"contract":if switch{"wand.native.private.switch626.wardrobe-same-slot-readset@1"}else{"wand.native.private.wardrobe-same-slot-readset@1"},
                "avatar":avatar_json,"slot":slot,"oldItemId":old,"proposedItemId":new,
                "oldScalarSha256":current.entry_sha,"clothesMapSha256":active.clothes.sha,
                "inventory":{"listInventoriesSha256":inventory["listInventoriesSha256"],
                    "inventoryId":1,"compatibleItemType":"ItemType_Clothing",
                    "recordSha256":route["recordSha256"],"mapSha256":route["mapSha256"],
                    "oldStock":stock(old)?,"proposedStock":stock(new)?},
                "fullDocumentRustValidated":true,"sameSlotDefinitionVerified":false,
                "effectiveEligibilityVerified":false,"rightsVerified":false,
                "subscriberClosureVerified":false,"productReadAccepted":false,
                "writerAuthorized":false,"editedCopyAuthorized":false,"applyAuthorized":false});
            if serde_json::to_vec(&value).map_err(|_|denied("WARDROBE_RECEIPT_ENCODE"))?.len()>8*1024*1024{
                return Err(denied("WARDROBE_RECEIPT_BOUND"));}
            Ok(value)
        }
}
