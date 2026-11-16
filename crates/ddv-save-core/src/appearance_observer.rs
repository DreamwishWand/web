//! Shared lexical appearance observers; extracted from accepted native reader.
//! No native executor, Save export, product authority, or public WASM ABI.
use super::*;
use sha2::{Digest,Sha256};
use serde_json::{json,Value};
use super::super::{Platform,BuildKind};
pub(super) const APPEARANCE_BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
pub(super) fn product_appearance_scope(s:&ProductSession,e:&WorkerEnvelope)->CoreResult<()> {
    let b=&s.native_source_build;
    if !s.worker_bound || b.platform!=Platform::SteamWindows || b.build_kind!=BuildKind::SteamFullVersion || b.build_id!=APPEARANCE_BUILD || b.schema!=626 || !b.externally_attested {return Err(denied("APPEARANCE_EXACT_WORKER_BUILD_REQUIRED"));}
    let state=s.lock()?;validate_scope(s,&state,e)
}
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

pub(super) fn dependency_hash(bytes:&[u8],s:Option<Span>)->Value{
    json!({"present":s.is_some(),"sha256":s.map(|v|sha(&bytes[v.begin..v.end]))})
}
pub(super) fn array_spans(bytes:&[u8],s:Span,max:usize)->CoreResult<Vec<Span>>{
    if s.begin>=s.end||s.end>bytes.len()||bytes.get(s.begin)!=Some(&b'[')||
        bytes.get(s.end-1)!=Some(&b']'){return Err(denied("AVATAR_DEP_ARRAY_REQUIRED"));}
    let mut pos=skip_ws(bytes,s.begin+1);let mut out=Vec::new();
    while pos<s.end-1{
        if out.len()>=max{return Err(denied("AVATAR_DEP_ARRAY_BOUND"));}
        let end=value_end(bytes,pos)?;
        if end>=s.end||end-pos>1024*1024{return Err(denied("AVATAR_DEP_RECORD_BOUND"));}
        out.push(Span{begin:pos,end});
        pos=skip_ws(bytes,end);
        match bytes.get(pos){
            Some(b',') if pos<s.end-1=>pos=skip_ws(bytes,pos+1),
            Some(b']') if pos==s.end-1=>break,
            _=>return Err(denied("AVATAR_DEP_ARRAY_TERMINATOR")),
        }
    }
    Ok(out)
}

pub(super) fn enum_token(bytes:&[u8],s:Span,prefix:&str)->CoreResult<String>{
    let v=text_token(bytes,s,128)?;
    if !v.starts_with(prefix)||v.len()<=prefix.len()||
       !v.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'){
        return Err(denied("AVATAR_DEP_ENUM_TOKEN"));}
    Ok(v)
}

pub(super) fn inventory_dependencies(bytes:&[u8],lists:Span,female:&Branch,male:&Branch)->CoreResult<Value>{
    use std::collections::BTreeSet;
    let mut clothes=BTreeSet::new();let mut makeup=BTreeSet::new();
    for b in [female,male]{
        for m in [&b.clothes,&b.incompatible]{
            for e in &m.entries{if e.value>0{clothes.insert(e.value);}}
        }
        for e in &b.customization.entries{clothes.insert(e.key as i32);}
        for e in &b.makeup.entries{makeup.insert(e.value);}
    }
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
    let all_maps_present=[female,male].iter().all(|b|
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

pub(super) fn character_id(v:i32)->bool{v>0&&v/10_000_000==1}
pub(super) fn character_skin_id(v:i32)->bool{
    v>0&&v/10_000_000==17&&(v%10_000_000)/100_000==0
}
pub(super) fn text_token(bytes:&[u8],span:Span,max:usize)->CoreResult<String>{
    let token=bytes.get(span.begin..span.end).ok_or(denied("SKIN_TOKEN_SPAN"))?;
    if token.len()>max{return Err(denied("SKIN_TOKEN_BOUND"));}
    serde_json::from_slice::<String>(token).map_err(|_|denied("SKIN_STRING_REQUIRED"))
}
pub(super) fn character_span(bytes:&[u8],array:Span,target:i32)->CoreResult<(usize,Span,Span)>{
    if array.begin>=array.end||array.end>bytes.len()||
        bytes.get(array.begin)!=Some(&b'[')||bytes.get(array.end-1)!=Some(&b']'){
        return Err(denied("SKIN_CHARACTERS_ARRAY_REQUIRED"));
    }
    let mut pos=skip_ws(bytes,array.begin+1);
    let mut index=0usize;
    let mut seen=std::collections::BTreeSet::new();
    let mut found=None;
    while pos<array.end-1{
        if index>=512{return Err(denied("SKIN_CHARACTER_COUNT_BOUND"));}
        let end=value_end(bytes,pos)?;
        if end>=array.end||end-pos>1024*1024{return Err(denied("SKIN_CHARACTER_SPAN_BOUND"));}
        let span=Span{begin:pos,end};
        let fs=members(bytes,span,128)?;
        let base=required(&fs,"Base")?;
        let b=members(bytes,base,32)?;
        // JSON spelling is the exact observed lowercase "id" in the
        // prior serialized shape. No "Id"/"ID" fallback or array index.
        // Steam626 physical presence remains subject to real private read.
        let id=int(bytes,required(&b,"id")?)?;
        if !character_id(id)||!seen.insert(id){return Err(denied("SKIN_CHARACTER_ID_OR_DUPLICATE"));}
        if id==target{found=Some((index,span,base));}
        index+=1;
        pos=skip_ws(bytes,end);
        match bytes.get(pos){
            Some(b',') if pos<array.end-1=>pos=skip_ws(bytes,pos+1),
            Some(b']') if pos==array.end-1=>break,
            _=>return Err(denied("SKIN_CHARACTER_ARRAY_TERMINATOR")),
        }
    }
    found.ok_or(denied("SKIN_CHARACTER_NOT_PRESENT"))
}
pub(super) fn skin_inventory(bytes:&[u8],lists:Span,skin:i32)->CoreResult<Value>{
    let mut selected=None;
    for (key,record) in members(bytes,lists,128)?{
        let id=key_u32(&key)?;
        let fs=members(bytes,record,64)?;
        let id_span=required(&fs,"ID")?;
        let actual=serde_json::from_slice::<u32>(&bytes[id_span.begin..id_span.end])
            .map_err(|_|denied("SKIN_INVENTORY_ID_TYPE"))?;
        if actual!=id{return Err(denied("SKIN_INVENTORY_ID_MISMATCH"));}
        let ty=text_token(bytes,required(&fs,"CompatibleItemType")?,128)?;
        if ty!="ItemType_Skin"{continue;}
        // ID zero is a persisted unrelated route; only the selected Skin route must be positive.
        if id==0{return Err(denied("SKIN_INVENTORY_ID_ZERO"));}
        // Reject ambiguous compatible routes even if only one has item.
        if selected.is_some(){return Err(denied("SKIN_COMPATIBLE_INVENTORY_AMBIGUOUS"));}
        selected=Some((id,record,required(&fs,"Inventory")?));
    }
    let (id,record,items)=selected.ok_or(denied("SKIN_COMPATIBLE_INVENTORY_ABSENT"))?;
    let entries=members(bytes,items,16384)?;
    let wanted=skin.to_string();
    let mut found=None;
    for (k,v) in entries{
        let n=key_u32(&k)?;
        if n>i32::MAX as u32||n==0||n/10_000_000!=17{
            return Err(denied("SKIN_INVENTORY_ITEM_KEY"));
        }
        if k==wanted{found=Some(v);}
    }
    let entry=found.ok_or(denied("SKIN_INVENTORY_ENTRY_ABSENT"))?;
    let fields=members(bytes,entry,64)?;
    let amount=int(bytes,required(&fields,"Amount")?)?;
    if amount<1{return Err(denied("SKIN_NO_POSITIVE_SAVED_AMOUNT"));}
    let marker_span=field(&fields,"Marker");
    let marker=marker_span.map(|s|text_token(bytes,s,128)).transpose()?;
    if let Some(m)=&marker{
        if !m.starts_with("ItemMarker_")||m.len()<=11||
            !m.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'){
            return Err(denied("SKIN_MARKER_SHAPE"));
        }
    }
    Ok(json!({"inventoryId":id,"compatibleItemType":"ItemType_Skin",
        "itemId":skin,"savedAmount":amount,"markerPresent":marker.is_some(),
        "savedMarker":marker,"markerSha256":marker_span.map(|s|sha(&bytes[s.begin..s.end])),
        "inventoryRecordSha256":sha(&bytes[record.begin..record.end]),
        "entrySha256":sha(&bytes[entry.begin..entry.end]),
        "positiveSavedAmount":true,"nativeHasItemVerified":false,
        "markerSemanticsVerified":false,"rightsVerified":false}))
}

pub(super) fn skin_dialogue_flags(bytes:&[u8],span:Option<Span>,target:i32)->CoreResult<Value>{
    let mut entries=Vec::new();let mut target_positions=Vec::new();
    if let Some(s)=span{
        for (i,v) in array_spans(bytes,s,16384)?.into_iter().enumerate(){
            let n=int(bytes,v)?;
            // Only the physical int32 is attested here. Native flag-ID
            // classification is part of the exact condition/catalog join.
            let digest=sha(&bytes[v.begin..v.end]);
            if n==target{target_positions.push(i);}
            // Repeated int32 is not assumed to be a set; retain physical
            // duplicate positions, do not silently normalize the list.
            entries.push(json!({"position":i,"flagId":n,"tokenSha256":digest}));
        }
    }
    let membership=span.map(|_|!target_positions.is_empty());
    Ok(json!({"targetFlagId":target,"persistedList":dependency_hash(bytes,span),
        "entries":entries,"targetPositions":target_positions,"persistedMembership":membership,
        "runtimeOverrideInitialized":null,"runtimeOverrideKeyPresent":null,"runtimeOverrideValue":null,
        "effectiveFlagValue":null,"effectiveFlagVerified":false,"runtimeOverrideVerified":false}))
}

// Existing Native dependency observers shared verbatim (visibility only).
pub(super) fn scalar_witness(bytes:&[u8],fs:&[(String,Span)],key:&str)->CoreResult<Value>{
    let v=field(fs,key);
    Ok(json!({"present":v.is_some(),"value":v.map(|s|int(bytes,s)).transpose()?,
        "sha256":v.map(|s|sha(&bytes[s.begin..s.end]))}))
}
pub(super) fn token_witness(bytes:&[u8],fs:&[(String,Span)],key:&str)->CoreResult<Value>{
    let v=field(fs,key);
    Ok(json!({"present":v.is_some(),"value":v.map(|s|text_token(bytes,s,128)).transpose()?,
        "sha256":v.map(|s|sha(&bytes[s.begin..s.end]))}))
}
pub(super) fn branch_dependencies(bytes:&[u8],s:Span)->CoreResult<Value>{
    let fs=members(bytes,s,MAX_AVATAR_FIELDS)?;
    let mut scalars=serde_json::Map::new();
    for key in ["Id","SkinColorIndex","HairColorIndex","HairHighlightColor","BodyType","SprintEffectID"]{
        scalars.insert(key.into(),scalar_witness(bytes,&fs,key)?);
    }
    let mut makeup=Vec::new();
    if let Some(m)=field(&fs,"Makeup"){
        for (key,entry) in members(bytes,m,MAX_MAKEUP)?{
            let slot=key_u32(&key)?;if slot>=32{return Err(denied("AVATAR_MAKEUP_SLOT_BOUND"));}
            let f=members(bytes,entry,32)?;
            let item=int(bytes,required(&f,"MakeupItemID")?)?;
            if item<=0||item/10_000_000!=14{return Err(denied("AVATAR_MAKEUP_ID_PREFIX"));}
            let mut colors=serde_json::Map::new();
            for k in ["ColorIndex1","ColorIndex2","ColorIndex3"]{
                colors.insert(k.into(),scalar_witness(bytes,&f,k)?);
            }
            // Physical numeric token, bounded and finite. No float
            // reconstruction or assumption about Native accepted range.
            for k in ["Opacity","Gloss"]{
                let span=field(&f,k);
                let raw=span.map(|v|{
                    let b=&bytes[v.begin..v.end];
                    if b.len()>64{return Err(denied("AVATAR_DEP_NUMBER_BOUND"));}
                    let n=serde_json::from_slice::<f64>(b).map_err(|_|denied("AVATAR_DEP_NUMBER_REQUIRED"))?;
                    if !n.is_finite(){return Err(denied("AVATAR_DEP_NUMBER_REQUIRED"));}
                    std::str::from_utf8(b).map(str::to_owned).map_err(|_|denied("AVATAR_DEP_NUMBER_REQUIRED"))
                }).transpose()?;
                colors.insert(k.into(),json!({"present":span.is_some(),"numericToken":raw,
                    "sha256":span.map(|v|sha(&bytes[v.begin..v.end]))}));
            }
            makeup.push(json!({"slot":slot,"itemId":item,"entrySha256":sha(&bytes[entry.begin..entry.end]),"scalars":colors}));
        }
    }
    let mut face=Vec::new();
    if let Some(v)=field(&fs,"FaceType"){
        for (key,entry) in members(bytes,v,32)?{
            let n=key_u32(&key)?;
            face.push(json!({"key":n,"savedValue":int(bytes,entry)?,"sha256":sha(&bytes[entry.begin..entry.end])}));
        }
    }
    let mut eye=serde_json::Map::new();
    if let Some(v)=field(&fs,"Eyeball"){
        // Explicit null stays distinct from a present object. No default
        // or invented color/item ID when the object is missing/null.
        if &bytes[v.begin..v.end]!=b"null"{
            let f=members(bytes,v,32)?;
            for k in ["EyeballItemID","ColorIndex1","ColorIndex2","ColorIndex3"]{
                eye.insert(k.into(),scalar_witness(bytes,&f,k)?);
            }
        }
    }
    Ok(json!({"branchSha256":sha(&bytes[s.begin..s.end]),"scalars":scalars,
        "faceType":dependency_hash(bytes,field(&fs,"FaceType")),"faceTypeEntries":face,
        "eyeball":dependency_hash(bytes,field(&fs,"Eyeball")),"eyeballScalars":eye,
        "makeup":makeup,"otherFieldsRetainedByBranchHash":true}))
}
pub(super) fn achievements_dependencies(bytes:&[u8],s:Option<Span>)->CoreResult<Value>{
    achievements_dependencies_mode(bytes,s,false,&mut DependencyBudget::default())
}
pub(super) fn achievements_dependencies_mode(bytes:&[u8],s:Option<Span>,detail:bool,budget:&mut DependencyBudget)->CoreResult<Value>{
    let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"entries":[],"completeNativeClosureVerified":false}))};
    let mut seen=std::collections::BTreeSet::new();let mut out=Vec::new();
    // ACT490: amount detail shares one budget with Mission and Evolve.
    for v in array_spans(bytes,span,4096)?{
        let f=members(bytes,v,64)?;
        let id=int(bytes,required(&f,"AchievementID")?)?;
        if id<=0||id/10_000_000!=211||!seen.insert(id){return Err(denied("AVATAR_DEP_ACHIEVEMENT_ID"));}
        let state=field(&f,"State").map(|x|enum_token(bytes,x,"AchievementState_")).transpose()?;
        let mut row=json!({"achievementId":id,"recordSha256":sha(&bytes[v.begin..v.end]),
            "state":state,"statePresent":state.is_some(),
            "curAmount":scalar_witness(bytes,&f,"CurAmount")?,
            "maxAmount":scalar_witness(bytes,&f,"MaxAmount")?,
            "claimedRewardMilestone":scalar_witness(bytes,&f,"ClaimedRewardMilestone")?,
            "typesCollected":dependency_hash(bytes,field(&f,"TypesCollected")),
            "itemsUsed":dependency_hash(bytes,field(&f,"ItemsUsed"))});
        if detail{
            row["typesCollectedTyped"]=amount_int_refs(bytes,field(&f,"TypesCollected"),budget)?;
            row["itemsUsedTyped"]=amount_int_refs(bytes,field(&f,"ItemsUsed"),budget)?;
            let grids=field(&f,"GridObjectsCollected");
            row["gridObjectsCollected"]=dependency_hash(bytes,grids);
            let addresses=if let Some(s)=grids{if &bytes[s.begin..s.end]==b"null"{None}else{field(&members(bytes,s,64)?,"GridObjectAddresses")}}else{None};
            row["gridObjectsCollectedTyped"]=amount_grid_refs(bytes,addresses,"GridID","GridObjectID",budget)?;
        }
        out.push(row);
    }
    Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),"entries":out,
        "completeNativeClosureVerified":false}))
}
#[derive(Default)]
pub(super) struct DependencyBudget{pub(super) nodes:usize,pub(super) progress_entries:usize,pub(super) progress_bytes:usize,pub(super) reference_entries:usize}
impl DependencyBudget{
    pub(super) fn node(&mut self)->CoreResult<()>{
        self.nodes+=1;
        if self.nodes>8192{return Err(denied("AVATAR_DEP_SUBSCRIBER_NODE_BOUND"));}
        Ok(())
    }
    pub(super) fn reference(&mut self)->CoreResult<()>{
        self.reference_entries+=1;
        if self.reference_entries>65536{return Err(denied("AMOUNT_DEP_REFERENCE_BOUND"));}
        Ok(())
    }
    pub(super) fn progress(&mut self,key:&str,value_bytes:usize)->CoreResult<()>{
        self.progress_entries+=1;
        self.progress_bytes=self.progress_bytes.checked_add(key.len()+value_bytes)
            .ok_or(denied("AVATAR_DEP_PROGRESS_BOUND"))?;
        if self.progress_entries>4096||self.progress_bytes>2*1024*1024{
            return Err(denied("AVATAR_DEP_PROGRESS_BOUND"));}
        Ok(())
    }
}
pub(super) fn objective_dependencies_mode(bytes:&[u8],v:Span,budget:&mut DependencyBudget,detail:bool)->CoreResult<Value>{
    budget.node()?;
    let f=members(bytes,v,128)?;
    let mut progress=Vec::new();
    if let Some(s)=field(&f,"ProgressKeys"){
        for (key,val) in members(bytes,s,64)?{
            // Exact persisted scalar string, bounded; no caller paths,
            // no interpretation or defaulting of the Native progress key.
            if key.len()>128{return Err(denied("AVATAR_DEP_PROGRESS_KEY_BOUND"));}
            budget.progress(&key,val.end-val.begin)?;
            progress.push(json!({"key":key,"savedValue":text_token(bytes,val,512)?,
                "sha256":sha(&bytes[val.begin..val.end])}));
        }
    }
    let mut row=json!({"recordSha256":sha(&bytes[v.begin..v.end]),
        "targetAmount":if detail{amount_float_witness(bytes,field(&f,"TargetAmount"))?}else{scalar_witness(bytes,&f,"TargetAmount")?},
        "curAmount":if detail{Value::Null}else{scalar_witness(bytes,&f,"CurAmount")?},
        "status":token_witness(bytes,&f,"Status")?,
        "stepType":token_witness(bytes,&f,"StepType")?,
        "progressKeys":dependency_hash(bytes,field(&f,"ProgressKeys")),"progressEntries":progress,
        "itemIdsCollected":dependency_hash(bytes,field(&f,"ItemIdsCollected")),
        "gridObjectIdsCollected":dependency_hash(bytes,field(&f,"GridObjectIdsCollected")),
        "itemFilter":dependency_hash(bytes,field(&f,"ItemFilter"))});
    if detail{
        row["itemAmount"]=amount_float_witness(bytes,field(&f,"ItemAmount"))?;
        row["nonNativeCurAmountField"]=dependency_hash(bytes,field(&f,"CurAmount"));
        row["currentAmountKeyVerified"]=json!(false);
        row["effectiveCurrentAmount"]=Value::Null;
        row["itemIdsCollectedTyped"]=amount_int_refs(bytes,field(&f,"ItemIdsCollected"),budget)?;
        row["gridObjectIdsCollectedTyped"]=amount_grid_refs(bytes,field(&f,"GridObjectIdsCollected"),"GridId","GridObjectId",budget)?;
        row["runtimeGeneratedFilterVerified"]=json!(false);
    }
    Ok(row)
}
pub(super) fn mission_dependencies(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget)->CoreResult<Value>{
    mission_dependencies_mode(bytes,s,budget,false)
}
pub(super) fn mission_dependencies_mode(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget,detail:bool)->CoreResult<Value>{
    let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"groups":[],"completeNativeClosureVerified":false}))};
    let mut groups=Vec::new();let mut total_slots=0usize;let mut total_objectives=0usize;
    for (key,g) in members(bytes,span,128)?{
        let group=key_u32(&key)?;let fs=members(bytes,g,64)?;
        let a=required(&fs,"Slots")?;let mut slots=Vec::new();let mut ids=std::collections::BTreeSet::new();
        for v in array_spans(bytes,a,512)?{
            budget.node()?;
            total_slots+=1;if total_slots>1024{return Err(denied("AVATAR_DEP_MISSION_SLOT_BOUND"));}
            let f=members(bytes,v,128)?;
            let slot=int(bytes,required(&f,"SlotId")?)?;
            let mission=int(bytes,required(&f,"MissionId")?)?;
            if slot<0||!ids.insert(slot)||mission<0||(mission>0&&mission/10_000_000!=207){
                return Err(denied("AVATAR_DEP_MISSION_ID"));}
            let state=field(&f,"State").map(|s|enum_token(bytes,s,"MissionSlotState_")).transpose()?;
            let current=optional_int(bytes,&f,"CurrentStepIndex")?;
            let mut steps=Vec::new();
            if let Some(a)=field(&f,"MissionSteps"){
                for (si,step) in array_spans(bytes,a,256)?.into_iter().enumerate(){
                    budget.node()?;
                    let sf=members(bytes,step,64)?;let mut substeps=Vec::new();
                    if let Some(ss)=field(&sf,"SubSteps"){
                        for (ui,sub) in array_spans(bytes,ss,256)?.into_iter().enumerate(){
                            budget.node()?;
                            let uf=members(bytes,sub,64)?;let mut objectives=Vec::new();
                            if let Some(o)=field(&uf,"Objectives"){
                                for (oi,obj) in array_spans(bytes,o,256)?.into_iter().enumerate(){
                                    total_objectives+=1;
                                    if total_objectives>4096{return Err(denied("AVATAR_DEP_OBJECTIVE_BOUND"));}
                                    objectives.push(json!({"physicalIndex":oi,"witness":objective_dependencies_mode(bytes,obj,budget,detail)?}));
                                }
                            }
                            substeps.push(json!({"physicalIndex":ui,"recordSha256":sha(&bytes[sub.begin..sub.end]),
                                "objectivesPresent":field(&uf,"Objectives").is_some(),"objectives":objectives}));
                        }
                    }
                    steps.push(json!({"physicalIndex":si,"recordSha256":sha(&bytes[step.begin..step.end]),
                        "subStepsPresent":field(&sf,"SubSteps").is_some(),"subSteps":substeps}));
                }
            }
            let mut row=json!({"slotId":slot,"missionId":mission,"recordSha256":sha(&bytes[v.begin..v.end]),
                "state":state,"statePresent":state.is_some(),"currentStepIndex":current,
                "currentStepIndexPresent":current.is_some(),
                "characterId":scalar_witness(bytes,&f,"CharacterId")?,
                "missionSteps":dependency_hash(bytes,field(&f,"MissionSteps")),"steps":steps});
            if detail{
                row["class"]=token_witness(bytes,&f,"Class")?;
                let mut filters=Vec::new();
                if let Some(s)=field(&f,"ItemsToGive"){
                    for (i,s) in array_spans(bytes,s,256)?.into_iter().enumerate(){
                        budget.reference()?;
                        let fs=members(bytes,s,128)?;
                        filters.push(json!({"position":i,"recordSha256":sha(&bytes[s.begin..s.end]),
                            "item":scalar_witness(bytes,&fs,"Item")?,
                            "itemList":amount_int_refs(bytes,field(&fs,"ItemList"),budget)?,
                            "type":token_witness(bytes,&fs,"Type")?,
                            "subType":token_witness(bytes,&fs,"SubType")?,
                            "set":scalar_witness(bytes,&fs,"Set")?,
                            "tags":amount_int_refs(bytes,field(&fs,"Tags"),budget)?,
                            "effectiveFilterVerified":false}));
                    }
                }
                row["itemsToGive"]=json!({"saved":dependency_hash(bytes,field(&f,"ItemsToGive")),"entries":filters});
                row["itemsToGiveAmount"]=amount_int_refs(bytes,field(&f,"ItemsToGiveAmount"),budget)?;
                row["rewards"]=dependency_hash(bytes,field(&f,"Rewards"));
                row["rewardPresents"]=dependency_hash(bytes,field(&f,"RewardPresents"));
                row["additionalRewards"]=dependency_hash(bytes,field(&f,"AdditionalRewards"));
            }
            slots.push(row);
        }
        groups.push(json!({"groupKey":group,"recordSha256":sha(&bytes[g.begin..g.end]),"slots":slots}));
    }
    Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),"groups":groups,
        "completeNativeClosureVerified":false}))
}
pub(super) fn evolve_dependencies(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget)->CoreResult<Value>{
    evolve_dependencies_mode(bytes,s,budget,false)
}
pub(super) fn evolve_dependencies_mode(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget,detail:bool)->CoreResult<Value>{
    let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"entries":[],"completeNativeClosureVerified":false}))};
    let fs=members(bytes,span,64)?;
    let map=field(&fs,"EvolveProgressState");
    let mut out=Vec::new();
    if let Some(a)=map{
        for (k,v) in members(bytes,a,4096)?{
            budget.node()?;
            let id=key_u32(&k)?;
            let f=members(bytes,v,64)?;
            if id==0||id>i32::MAX as u32||int(bytes,required(&f,"ItemID")?)?!=id as i32{
                return Err(denied("AVATAR_DEP_EVOLVE_ID"));}
            let o=field(&f,"Objective").map(|x|objective_dependencies_mode(bytes,x,budget,detail)).transpose()?;
            out.push(json!({"itemId":id,"recordSha256":sha(&bytes[v.begin..v.end]),
                "level":scalar_witness(bytes,&f,"Level")?,"objectivePresent":o.is_some(),"objective":o}));
        }
    }
    Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),
        "map":dependency_hash(bytes,map),"entries":out,"completeNativeClosureVerified":false}))
}

pub(super) fn conditional_event_dependencies(bytes:&[u8],span:Option<Span>)->CoreResult<Value>{
    let Some(s)=span else{return Ok(json!({"present":false,"sha256":null,
        "activeEvents":{"present":false,"sha256":null,"entries":[]},"inboxSpawnCount":{"present":false,"sha256":null},
        "effectiveRegistryVerified":false,"completeNativeClosureVerified":false}))};
    let f=members(bytes,s,64)?;
    let active=field(&f,"ActiveEvents");let mut events=Vec::new();
    if let Some(a)=active{
        for (key,v) in members(bytes,a,4096)?{
            let id=key_u32(&key)?;
            if id==0||id>i32::MAX as u32{return Err(denied("SKIN_DEP_EVENT_ID"));}
            let fs=members(bytes,v,128)?;
            events.push(json!({"eventId":id,"recordSha256":sha(&bytes[v.begin..v.end]),
                "spawnState":dependency_hash(bytes,field(&fs,"SpawnState"))}));
        }
    }
    Ok(json!({"present":true,"sha256":sha(&bytes[s.begin..s.end]),
        "activeEvents":{"present":active.is_some(),"sha256":active.map(|v|sha(&bytes[v.begin..v.end])),"entries":events},
        "inboxSpawnCount":dependency_hash(bytes,field(&f,"InboxSpawnCount")),
        "effectiveRegistryVerified":false,"completeNativeClosureVerified":false}))
}
pub(super) fn skin_selection_dependencies(bytes:&[u8],chars:Span)->CoreResult<Vec<Value>>{
    let mut seen=std::collections::BTreeSet::new();let mut out=Vec::new();
    for (i,v) in array_spans(bytes,chars,512)?.into_iter().enumerate(){
        let fs=members(bytes,v,128)?;let base=required(&fs,"Base")?;
        let id=int(bytes,required(&members(bytes,base,32)?,"id")?)?;
        if !character_id(id)||!seen.insert(id){return Err(denied("SKIN_DEP_CHARACTER_ID"));}
        out.push(json!({"characterId":id,"physicalIndex":i,"recordSha256":sha(&bytes[v.begin..v.end]),
            "skinId":scalar_witness(bytes,&fs,"SkinID")?}));
    }
    Ok(out)
}

// ACT422 exact Native field types verified in E1198 dump SHA.
pub(super) fn amount_uint(bytes:&[u8],s:Span)->CoreResult<u32>{
    let n=serde_json::from_slice::<u32>(&bytes[s.begin..s.end]).map_err(|_|denied("AMOUNT_DEP_UINT32"))?;
    if n.to_string().as_bytes()!=&bytes[s.begin..s.end]{return Err(denied("AMOUNT_DEP_UINT_CANONICAL"));}
    Ok(n)
}
pub(super) fn amount_float_witness(bytes:&[u8],s:Option<Span>)->CoreResult<Value>{
    let Some(s)=s else{return Ok(json!({"present":false,"rawToken":null,"sha256":null}))};
    let raw=&bytes[s.begin..s.end];
    if raw.len()>64{return Err(denied("AMOUNT_DEP_FLOAT_BOUND"));}
    let n=serde_json::from_slice::<f32>(raw).map_err(|_|denied("AMOUNT_DEP_FLOAT32"))?;
    if !n.is_finite(){return Err(denied("AMOUNT_DEP_FLOAT32"));}
    let token=std::str::from_utf8(raw).map_err(|_|denied("AMOUNT_DEP_FLOAT_TOKEN"))?;
    Ok(json!({"present":true,"rawToken":token,"sha256":sha(raw)}))
}
pub(super) fn amount_int_refs(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget)->CoreResult<Value>{
    let mut entries=Vec::new();
    if let Some(s)=s{
        for (position,v) in array_spans(bytes,s,16384)?.into_iter().enumerate(){
            budget.reference()?;
            entries.push(json!({"position":position,"value":int(bytes,v)?,
                "sha256":sha(&bytes[v.begin..v.end])}));
        }
    }
    Ok(json!({"saved":dependency_hash(bytes,s),"entries":entries}))
}
pub(super) fn amount_grid_refs(bytes:&[u8],s:Option<Span>,g:&str,o:&str,budget:&mut DependencyBudget)->CoreResult<Value>{
    let mut entries=Vec::new();
    if let Some(s)=s{
        for (position,v) in array_spans(bytes,s,16384)?.into_iter().enumerate(){
            budget.reference()?;
            let f=members(bytes,v,32)?;
            let grid=field(&f,g).map(|x|amount_uint(bytes,x)).transpose()?;
            let object=field(&f,o).map(|x|amount_uint(bytes,x)).transpose()?;
            entries.push(json!({"position":position,"gridId":grid,"objectId":object,
                "recordSha256":sha(&bytes[v.begin..v.end]),"completePhysicalAddress":grid.is_some()&&object.is_some()}));
        }
    }
    Ok(json!({"saved":dependency_hash(bytes,s),"entries":entries}))
}


