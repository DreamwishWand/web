//! Research-only raw WebAssembly ABI used by synthetic browser probes.
//! Not linked into product and never handles P1G or filesystem operations.
use crate::{patch_json_string_tokens,TokenChange};
use std::{slice,ptr};
static mut OUTPUT_LEN:usize=0;
static mut ERROR_CODE:u32=0;
#[no_mangle]
pub extern "C" fn ddv_probe_allocate(len:usize)->*mut u8 {
 if len==0 || len > crate::MAX_DECODED_JSON_BYTES {return ptr::null_mut();}
 Box::into_raw(vec![0u8;len].into_boxed_slice()) as *mut u8
}
#[no_mangle]
pub unsafe extern "C" fn ddv_probe_free(p:*mut u8,len:usize){
 if !p.is_null()&&len>0 {
  drop(Box::from_raw(ptr::slice_from_raw_parts_mut(p,len)));
 }
}
#[no_mangle]
pub extern "C" fn ddv_probe_output_len()->usize{unsafe{OUTPUT_LEN}}
#[no_mangle]
pub extern "C" fn ddv_probe_error_code()->u32{unsafe{ERROR_CODE}}
#[no_mangle]
pub unsafe extern "C" fn ddv_probe_patch(
 input:*const u8,input_len:usize,expected_sha:*const u8,schema:u64,
 pointer_bytes:*const u8,pointer_len:usize,
 old_bytes:*const u8,old_len:usize,
 new_bytes:*const u8,new_len:usize
)->*mut u8 {
 OUTPUT_LEN=0;ERROR_CODE=0;
 if input.is_null()||expected_sha.is_null()||pointer_bytes.is_null()||
    old_bytes.is_null()||new_bytes.is_null()||
    input_len==0||input_len>crate::MAX_DECODED_JSON_BYTES||
    pointer_len==0||pointer_len>1024||old_len>128||new_len>128{
   ERROR_CODE=1;return ptr::null_mut();
 }
 let original=slice::from_raw_parts(input,input_len);
 let mut sha=[0u8;32];sha.copy_from_slice(slice::from_raw_parts(expected_sha,32));
 let ptr_string=match std::str::from_utf8(slice::from_raw_parts(pointer_bytes,pointer_len)){
  Ok(s)=>s,Err(_)=>{ERROR_CODE=2;return ptr::null_mut();}
 };
 let old_string=match std::str::from_utf8(slice::from_raw_parts(old_bytes,old_len)){
  Ok(s)=>s,Err(_)=>{ERROR_CODE=2;return ptr::null_mut();}
 };
 let new_string=match std::str::from_utf8(slice::from_raw_parts(new_bytes,new_len)){
  Ok(s)=>s,Err(_)=>{ERROR_CODE=2;return ptr::null_mut();}
 };
 let plan=[TokenChange{pointer:ptr_string.to_owned(),expected_old_string:old_string.to_owned(),
   replacement_string:new_string.to_owned()}];
 let result=match patch_json_string_tokens(original,sha,schema,&plan){
  Ok(r)=>r,Err(_)=>{ERROR_CODE=3;return ptr::null_mut();}
 };
 let boxed=result.bytes.into_boxed_slice();
 OUTPUT_LEN=boxed.len();
 Box::into_raw(boxed) as *mut u8
}
