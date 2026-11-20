//! 01B Steam v1.25.3: SOURCE_ONLY structural move/rotation preview.
//! Caller-supplied masks/IDs have no Core authority. Never a Writer gate.
use crate::{BuildIdentity,BuildKind,Platform,CoreError,CoreResult};
use std::collections::HashSet;
pub const STEAM_SPATIAL_PREFLIGHT_CONTRACT:&str="wand.01b.steam1253.preview@1";
const FULL_VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_CELLS:usize=4096;
#[derive(Clone,Copy,Debug,PartialEq,Eq,Hash)]
pub struct PreviewCell {pub x:i32,pub y:i32}
#[derive(Clone,Copy,Debug,PartialEq,Eq,Hash)]
pub struct PreviewObjectKey {pub grid_id:u32,pub object_id:u32}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct PreviewTransform {pub x:i32,pub y:i32,pub orientation:u8}
#[derive(Clone,Copy,Debug)]
pub struct PreviewGrid {pub id:u32,pub width:u32,pub height:u32,pub tessellation:u32}
#[derive(Clone,Copy,Debug)]
pub struct PreviewRestrictions {
    pub can_move:Option<bool>,
    pub can_rotate:Option<bool>,
    pub only_default_orientations:Option<bool>,
}
#[derive(Clone,Copy,Debug)]
pub struct PreviewOccupiedCell {pub object:PreviewObjectKey,pub cell:PreviewCell}
#[derive(Clone,Debug)]
pub struct PreviewSnapshot {
    pub key:PreviewObjectKey,
    pub grid:PreviewGrid,
    pub old:PreviewTransform,
    // Asserted offsets from old object origin, not authenticated Native footprint.
    pub local_cells:Vec<PreviewCell>,
    pub other_cells:Vec<PreviewOccupiedCell>,
    pub restrictions:PreviewRestrictions,
}
#[derive(Clone,Copy,Debug)]
pub struct PreviewRequest {pub expected_key:PreviewObjectKey,pub target:PreviewTransform}
#[derive(Clone,Debug)]
pub struct PreviewReceipt {
    pub contract:&'static str,
    pub new_cells:Vec<PreviewCell>,
    pub stored_enum_checked:bool,
    pub asserted_bounds_and_conflicts_checked:bool,
    pub source_object_authenticated:bool,
    pub native_footprint_parent_floor_verified:bool,
    pub native_placement_legal:bool,
    pub writer_authorized:bool,
}
fn denied(code:&'static str)->CoreError{CoreError(code)}
pub fn steam_orientation_defined(n:u8)->bool{n<16}
pub fn steam_orientation_cardinal(n:u8)->bool{n<16 && n%4==0}
/// Only geometrical candidate checks for 1-tessellation asserted 2D cells.
/// Complex rotations need Native GridArea/Footprint; do not fake transposition.
/// A passing preview NEVER proves its caller-supplied Source or Writer legality.
pub fn preflight_steam_move_rotate(
    build:&BuildIdentity,old:&PreviewSnapshot,req:PreviewRequest
)->CoreResult<PreviewReceipt>{
    if build.platform!=Platform::SteamWindows ||
       build.build_kind!=BuildKind::SteamFullVersion ||
       build.build_id!=FULL_VERSION || build.schema!=626 || !build.externally_attested {
        return Err(denied("SPATIAL_STEAM_BUILD_MISMATCH"));
    }
    if req.expected_key!=old.key || old.grid.id!=old.key.grid_id {
        return Err(denied("SPATIAL_OBJECT_KEY_MISMATCH"));
    }
    if !steam_orientation_defined(old.old.orientation) ||
       !steam_orientation_defined(req.target.orientation){
        return Err(denied("SPATIAL_ORIENTATION_UNKNOWN"));
    }
    if old.grid.width==0 || old.grid.height==0 ||
       old.grid.width>i32::MAX as u32 || old.grid.height>i32::MAX as u32{
        return Err(denied("SPATIAL_GRID_SIZE_UNKNOWN"));
    }
    if old.grid.tessellation!=1{return Err(denied("SPATIAL_TESSELLATION_UNKNOWN"));}
    if old.local_cells.is_empty()||old.local_cells.len()>MAX_CELLS ||
       old.other_cells.len()>100_000{
        return Err(denied("SPATIAL_CELLS_UNKNOWN_OR_OVERSIZED"));
    }
    let moved=req.target.x!=old.old.x||req.target.y!=old.old.y;
    let rotated=req.target.orientation!=old.old.orientation;
    if !moved&&!rotated{return Err(denied("SPATIAL_NOOP"));}
    if moved&&old.restrictions.can_move!=Some(true){
        return Err(denied("SPATIAL_MOVE_PERMISSION_NOT_ESTABLISHED"));
    }
    if rotated&&old.restrictions.can_rotate!=Some(true){
        return Err(denied("SPATIAL_ROTATE_PERMISSION_NOT_ESTABLISHED"));
    }
    if rotated&&old.restrictions.only_default_orientations.is_none(){
        return Err(denied("SPATIAL_ROTATION_RESTRICTION_UNKNOWN"));
    }
    if old.restrictions.only_default_orientations==Some(true) &&
       !steam_orientation_cardinal(req.target.orientation){
        return Err(denied("SPATIAL_DEFAULT_ORIENTATION_REQUIRED"));
    }
    // One-cell rotation has no changed 2D mask, but still no Native legality.
    if rotated&&(old.local_cells.len()!=1 ||
        old.local_cells[0]!=(PreviewCell{x:0,y:0})){
        return Err(denied("SPATIAL_ROTATED_FOOTPRINT_UNKNOWN"));
    }
    let mut local=HashSet::new();
    let mut new_set=HashSet::new();
    let mut new_cells=Vec::with_capacity(old.local_cells.len());
    for offset in &old.local_cells{
        if offset.x<0||offset.y<0||!local.insert(*offset){
            return Err(denied("SPATIAL_DUPLICATE_OR_NEGATIVE_MASK"));
        }
        let x=req.target.x.checked_add(offset.x)
            .ok_or(denied("SPATIAL_COORDINATE_OVERFLOW"))?;
        let y=req.target.y.checked_add(offset.y)
            .ok_or(denied("SPATIAL_COORDINATE_OVERFLOW"))?;
        if x<0||y<0||x>=old.grid.width as i32||y>=old.grid.height as i32{
            return Err(denied("SPATIAL_ASSERTED_OUT_OF_BOUNDS"));
        }
        let c=PreviewCell{x,y};
        if !new_set.insert(c){return Err(denied("SPATIAL_DUPLICATE_NEW_CELL"));}
        new_cells.push(c);
    }
    for c in &old.other_cells{
        if c.object!=old.key&&new_set.contains(&c.cell){
            return Err(denied("SPATIAL_ASSERTED_CELL_CONFLICT"));
        }
    }
    Ok(PreviewReceipt{
        contract:STEAM_SPATIAL_PREFLIGHT_CONTRACT,new_cells,
        stored_enum_checked:true,asserted_bounds_and_conflicts_checked:true,
        source_object_authenticated:false,
        native_footprint_parent_floor_verified:false,
        native_placement_legal:false,writer_authorized:false,
    })
}

// 01B / v1.26.1 installed GridData source envelope, read-only and fail-closed.
// This is game asset wire structure, NOT a Save Grid, Native floor oracle,
// runtime Worker command, placement permission, or Writer authorization.
pub const V1261_GRIDDATA_WIRE_CONTRACT:&str="wand.01b.v1261.griddata-envelope.readonly@1";
const GRID1261_STEAM:&str="releases_1.26ex-v1.26.1-633-g45e7ee77d30a-incremental-18";
const GRID1261_SWITCH:&str="3346726B2F640E01";
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct V1261GridDataEnvelope {
    pub contract:&'static str,
    pub width_candidate:u32,pub height_candidate:u32,
    pub palette_entries:usize,pub index_bits_per_cell:u8,pub payload_bytes:usize,
    pub source_sha256:[u8;32],
    pub provenance_authenticated:bool,pub native_floor_semantics_verified:bool,
    pub native_placement_legal:bool,pub game_save_writer_authorized:bool,
}
fn grid1261_var(b:&[u8],p:&mut usize)->CoreResult<u32> {
    let mut n=0u32;
    for i in 0..5u32 {
        let x=*b.get(*p).ok_or(denied("GRID1261_TRUNCATED"))?;
        *p+=1;
        if i==4 && x>15{return Err(denied("GRID1261_VARINT_OVERFLOW"));}
        n|=u32::from(x&127)<<(7*i);
        if x&128==0 {
            if i>0 && x==0{return Err(denied("GRID1261_NONCANONICAL"));}
            return Ok(n);
        }
    }
    Err(denied("GRID1261_VARINT_OVERFLOW"))
}
fn grid1261_tag(b:&[u8],p:&mut usize,n:u32)->CoreResult<()>{
    if grid1261_var(b,p)?!=n{return Err(denied("GRID1261_UNEXPECTED_FIELD"));}
    Ok(())
}
fn grid1261_bytes<'a>(b:&'a [u8],p:&mut usize,max:usize)->CoreResult<&'a [u8]>{
    let len=usize::try_from(grid1261_var(b,p)?).map_err(|_|denied("GRID1261_LENGTH"))?;
    if len>max{return Err(denied("GRID1261_LENGTH"));}
    let end=p.checked_add(len).ok_or(denied("GRID1261_LENGTH"))?;
    let v=b.get(*p..end).ok_or(denied("GRID1261_TRUNCATED"))?;
    *p=end;Ok(v)
}
/// Source BuildIdentity remains a caller assertion; even successful inspection
/// does not authenticate provenance, meaning of floor tokens or cell ordering.
pub fn inspect_v1261_griddata_envelope(
    build:&BuildIdentity,b:&[u8]
)->CoreResult<V1261GridDataEnvelope>{
    let correct=match (build.platform,build.build_kind){
        (Platform::SteamWindows,BuildKind::SteamFullVersion)=>build.build_id==GRID1261_STEAM,
        (Platform::Switch,BuildKind::SwitchBid)=>build.build_id==GRID1261_SWITCH,
        _=>false,
    };
    if !correct || !build.externally_attested {return Err(denied("GRID1261_BUILD"));}
    if b.is_empty()||b.len()>8*1024*1024{return Err(denied("GRID1261_LENGTH"));}
    let mut p=0usize;
    grid1261_tag(b,&mut p,8)?;let width=grid1261_var(b,&mut p)?;
    grid1261_tag(b,&mut p,16)?;let height=grid1261_var(b,&mut p)?;
    if width==0||height==0||width>4096||height>4096{return Err(denied("GRID1261_DIMENSIONS"));}
    let cells=(width as usize).checked_mul(height as usize).ok_or(denied("GRID1261_CELLS"))?;
    if cells>4*1024*1024{return Err(denied("GRID1261_CELLS"));}
    grid1261_tag(b,&mut p,34)?;let palette=grid1261_bytes(b,&mut p,1024)?;
    if palette.len()%4!=0||palette.is_empty(){return Err(denied("GRID1261_PALETTE"));}
    let count=palette.len()/4;
    let mut unique=std::collections::BTreeSet::new();
    for x in palette.chunks_exact(4){
        if !unique.insert(u32::from_le_bytes([x[0],x[1],x[2],x[3]])){
            return Err(denied("GRID1261_PALETTE_DUPLICATE"));
        }
    }
    let bits:u8=match count{1..=2=>1,3..=4=>2,5..=16=>4,17..=256=>8,
        _=>return Err(denied("GRID1261_PALETTE"))};
    let bit_count=cells.checked_mul(usize::from(bits)).ok_or(denied("GRID1261_CELLS"))?;
    let expected=bit_count.checked_add(7).ok_or(denied("GRID1261_LENGTH"))?/8;
    grid1261_tag(b,&mut p,42)?;let data=grid1261_bytes(b,&mut p,8*1024*1024)?;
    if p!=b.len()||data.len()!=expected{return Err(denied("GRID1261_PAYLOAD"));}
    let per_byte=8usize/usize::from(bits);
    let mask=(1u16<<bits)-1;
    for cell in 0..cells {
        let byte=data[cell/per_byte];
        let shift=(cell%per_byte)*usize::from(bits);
        if usize::from((u16::from(byte)>>shift)&mask)>=count {
            return Err(denied("GRID1261_UNDEFINED_INDEX"));
        }
    }
    if bit_count%8!=0&&data.last().copied().unwrap_or(0)>>(bit_count%8)!=0{
        return Err(denied("GRID1261_PADDING"));
    }
    use sha2::Digest;
    let mut sha=[0u8;32];sha.copy_from_slice(&sha2::Sha256::digest(b));
    Ok(V1261GridDataEnvelope {
        contract:V1261_GRIDDATA_WIRE_CONTRACT,width_candidate:width,height_candidate:height,
        palette_entries:count,index_bits_per_cell:bits,payload_bytes:data.len(),source_sha256:sha,
        provenance_authenticated:false,native_floor_semantics_verified:false,
        native_placement_legal:false,game_save_writer_authorized:false,
    })
}

#[cfg(test)]
mod grid1261_wire_tests{
    use super::*;
    fn identity(switch:bool)->BuildIdentity{
        BuildIdentity {platform:if switch{Platform::Switch}else{Platform::SteamWindows},
            build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
            build_id:if switch{GRID1261_SWITCH}else{GRID1261_STEAM}.into(),
            schema:643,externally_attested:true}
    }
    fn vi(mut n:u32)->Vec<u8>{
        let mut v=Vec::new();loop{
            let mut b=(n&127) as u8;n>>=7;if n>0{b|=128;}
            v.push(b);if n==0{return v;}
        }
    }
    fn frame(w:u32,h:u32,palette:&[u32],indices:&[u8])->Vec<u8>{
        assert_eq!(indices.len(),(w*h) as usize);
        let bits:usize=if palette.len()<=2{1}else if palette.len()<=4{2}else{4};
        let step=8/bits;let mut data=vec![0u8;(indices.len()+step-1)/step];
        for(i,x)in indices.iter().enumerate(){data[i/step]|=*x<<((i%step)*bits);}
        let mut out=vec![8];out.extend(vi(w));out.push(16);out.extend(vi(h));
        out.push(34);out.extend(vi((palette.len()*4) as u32));
        for token in palette{out.extend(token.to_le_bytes());}
        out.push(42);out.extend(vi(data.len() as u32));out.extend(data);out
    }
    #[test]fn source_palette_two_and_four_bit_off(){
        let four=frame(4,2,&[0,512,256,134479872,262144,134217728],&[0,1,2,3,4,5,0,1]);
        let two=frame(4,2,&[0,4,256,512],&[0,1,2,3,1,0,2,3]);
        for sw in [false,true]{
            let a=inspect_v1261_griddata_envelope(&identity(sw),&two).unwrap();
            let b=inspect_v1261_griddata_envelope(&identity(sw),&four).unwrap();
            assert_eq!((a.width_candidate,a.height_candidate,a.palette_entries,a.index_bits_per_cell,a.payload_bytes),(4,2,4,2,2));
            assert_eq!((b.palette_entries,b.index_bits_per_cell,b.payload_bytes),(6,4,4));
            for x in [a,b]{assert!(!x.provenance_authenticated&&!x.native_floor_semantics_verified&&!x.native_placement_legal&&!x.game_save_writer_authorized);}
        }
    }
    #[test]fn malformed_and_foreign_build_denied(){
        let valid=frame(4,2,&[0,4,256,512],&[0,1,2,3,1,0,2,3]);
        let deny=|v:&[u8]|assert!(inspect_v1261_griddata_envelope(&identity(false),v).is_err());
        deny(&[]);
        let mut b=valid.clone();b.pop();deny(&b);
        let mut b=valid.clone();b[0]=0x18;deny(&b);
        let mut b=valid.clone();b.extend([8,1]);deny(&b);
        let mut b=valid.clone();b[1]=0x80;b.insert(2,0);deny(&b);
        let mut b=frame(4,2,&[0,4,256],&[0,1,2,0,1,2,0,1]);*b.last_mut().unwrap()=0xff;deny(&b);
        let mut b=frame(3,1,&[0,4,256,512],&[0,1,2]);*b.last_mut().unwrap()|=0xc0;deny(&b);
        let mut b=valid.clone();b[10..14].copy_from_slice(&[0,0,0,0]);deny(&b);
        let mut foreign=identity(false);foreign.build_id="foreign".into();
        assert!(inspect_v1261_griddata_envelope(&foreign,&valid).is_err());
        let mut unattested=identity(false);unattested.externally_attested=false;
        assert!(inspect_v1261_griddata_envelope(&unattested,&valid).is_err());
    }
}