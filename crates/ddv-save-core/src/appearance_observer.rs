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
