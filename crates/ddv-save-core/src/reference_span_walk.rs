//! Shared bounded lexical reference walker. Original native scanner implementation; no session or write authority.
use super::indexed_read::{skip_ws,string_end,value_end,Span};
use crate::{CoreError,CoreResult};
const MAX_KEY_BYTES:usize=128;
fn fail(s:&'static str)->CoreError{CoreError(s)}
// The strict whole-document JSON validator ran before ProductSession opened.
// This walker reuses the already-accepted lexical span parser, never builds a
// serde_json::Value tree or exports original text to JS/UI.
pub(super) fn object<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(String,Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'{')||b.get(s.end-1)!=Some(&b'}'){
        return Err(fail("NATIVE_REF_OBJECT_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let begin=i;
        let end=string_end(b,i)?;
        if end-begin>MAX_KEY_BYTES{return Err(fail("NATIVE_REF_KEY_BOUNDS"));}
        let key:String=serde_json::from_slice(&b[begin..end])
            .map_err(|_|fail("NATIVE_REF_KEY_INVALID"))?;
        i=skip_ws(b,end);
        if b.get(i)!=Some(&b':'){return Err(fail("NATIVE_REF_COLON"));}
        i=skip_ws(b,i+1);
        let last=value_end(b,i)?;
        if last>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_OBJECT"));}
        visit(key,Span{begin:i,end:last})?;
        i=skip_ws(b,last);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b'}') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_OBJECT_DELIMITER")),
        }
    }
}
pub(super) fn array<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'[')||b.get(s.end-1)!=Some(&b']'){
        return Err(fail("NATIVE_REF_ARRAY_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let end=value_end(b,i)?;
        if end>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_ARRAY"));}
        visit(Span{begin:i,end})?;
        i=skip_ws(b,end);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b']') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_ARRAY_DELIMITER")),
        }
    }
}
pub(super) fn field(b:&[u8],s:Span,name:&str)->CoreResult<Option<Span>>{
    let mut result=None;
    object(b,s,|key,val|{
        if key==name {
            if result.replace(val).is_some(){return Err(fail("NATIVE_REF_FIELD_DUPLICATE"));}
        }
        Ok(())
    })?;
    Ok(result)
}
pub(super) fn required(b:&[u8],s:Span,name:&str)->CoreResult<Span>{
    field(b,s,name)?.ok_or(fail("NATIVE_REF_REQUIRED_FIELD_MISSING"))
}
