//! Shared save core prototype owned by Wand/01A.
//! Reuses the strict token grammar, duplicate-key checks and byte span substitution
//! from DDVRE Rust v0.6.0 rust/ddv-core/src/json_syntax.rs and profile_json.rs.
//! This slice handles decoded UTF-8 JSON ONLY: no P1G, no WASM export, no Writer authority.
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::ops::Range;

pub const MAX_DECODED_JSON_BYTES: usize = 256 * 1024 * 1024;
const MAX_DEPTH: usize = 128;
const MAX_TOKENS: usize = 12_000_000;
const MAX_DIRECT_INDEX_ROWS: usize = 1_000_000;
const MAX_JS_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
pub type EngineResult<T> = Result<T, &'static str>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenChange {
    /// RFC6901 JSON pointer; the caller is responsible for semantic allowlisting.
    pub pointer: String,
    pub expected_old_string: String,
    pub replacement_string: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpanHit {
    pub pointer: String,
    pub span: Range<usize>,
    pub value: String,
}
#[derive(Debug)]
pub struct PatchedJson {
    pub bytes: Vec<u8>,
    pub original_sha256: [u8; 32],
    pub edited_sha256: [u8; 32],
    pub changed: Vec<SpanHit>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Capabilities {
    pub read: bool,
    pub encode_copy: bool,
    pub persistent_replace: bool,
}
pub const RESEARCH_CAPABILITIES: Capabilities = Capabilities {
    read: true, encode_copy: false, persistent_replace: false,
};
pub fn sha256(source: &[u8]) -> [u8;32] {
    Sha256::digest(source).into()
}
pub fn match_explicit_build(platform: &str, build_kind: &str, build_id: &str,
                            schema: u64, expected_schema: u64,
                            expected_platform: &str, expected_kind: &str,
                            expected_id: &str) -> EngineResult<()> {
    if schema != expected_schema { return Err("SAVE_SCHEMA_MISMATCH"); }
    if platform != expected_platform || build_kind != expected_kind || build_id != expected_id {
        return Err("EXPLICIT_BUILD_ID_MISMATCH");
    }
    Ok(())
}
pub fn validate_json(bytes: &[u8]) -> EngineResult<()> {
    let source = std::str::from_utf8(bytes).map_err(|_|"JSON_INVALID_UTF8")?;
    let watch = HashSet::new();
    let mut parser = Parser::new(source, &watch);
    parser.parse().map(|_| ())
}
pub fn patch_json_string_tokens(
    source: &[u8], expected_source_sha256: [u8;32], expected_schema: u64,
    changes: &[TokenChange]
) -> EngineResult<PatchedJson> {
    if source.len() > MAX_DECODED_JSON_BYTES { return Err("JSON_TOO_LARGE"); }
    if changes.is_empty() || changes.len() > 64 { return Err("CHANGE_COUNT_INVALID"); }
    let source_hash = sha256(source);
    if source_hash != expected_source_sha256 { return Err("SOURCE_SHA_CAS_FAILED"); }
    let mut targets = HashSet::new();
    for change in changes {
        if change.pointer.is_empty() || !change.pointer.starts_with('/') ||
            change.pointer.len() > 1024 || change.pointer.contains("//") ||
            !targets.insert(change.pointer.clone()) { return Err("INVALID_OR_DUPLICATE_POINTER"); }
        if change.expected_old_string == change.replacement_string { return Err("NO_OP_DENIED"); }
        if change.replacement_string.len() > 128 { return Err("REPLACEMENT_TOO_LARGE"); }
        // Reject noncanonical JSON Pointer escapes, preserving exact semantics.
        for component in change.pointer[1..].split('/') {
            let bytes = component.as_bytes();
            let mut i = 0;
            while i < bytes.len() {
                if bytes[i] == b'~' {
                    if i + 1 >= bytes.len() || !matches!(bytes[i+1], b'0' | b'1') {
                        return Err("INVALID_JSON_POINTER_ESCAPE");
                    }
                    i += 1;
                }
                i += 1;
            }
        }
    }
    // Reuse the Wand strict parser semantics with a sparse span collection.
    // No serde_json::Value, no structuredClone, no full-tree recursive diff.
    let text = std::str::from_utf8(source).map_err(|_| "JSON_INVALID_UTF8")?;
    let mut watch = targets;
    watch.insert("/GameInfo/Version".to_owned());
    let mut parser = Parser::new(text,&watch);
    let found = parser.parse()?;
    let schema = found.get("/GameInfo/Version").ok_or("SCHEMA_MISSING")?;
    if schema.kind != TokenKind::Number || schema.raw.parse::<u64>().ok() != Some(expected_schema) {
        return Err("SAVE_SCHEMA_MISMATCH");
    }
    let mut spans = Vec::with_capacity(changes.len());
    for change in changes {
        let hit = found.get(&change.pointer).ok_or("POINTER_NOT_FOUND")?;
        if hit.kind != TokenKind::String { return Err("POINTER_NOT_STRING"); }
        if hit.decoded.as_deref() != Some(change.expected_old_string.as_str()) {
            return Err("SOURCE_VALUE_CAS_FAILED");
        }
        spans.push((hit.span.clone(),change));
    }
    spans.sort_unstable_by_key(|v| v.0.start);
    for pair in spans.windows(2) {
        if pair[0].0.end > pair[1].0.start { return Err("OVERLAPPING_EDITS"); }
    }
    // Borrow original and splice only specifically selected token ranges.
    let mut edited = Vec::with_capacity(source.len().saturating_add(changes.len()*32));
    let mut changed = Vec::with_capacity(changes.len());
    let mut cursor=0;
    for (span,change) in spans {
        edited.extend_from_slice(&source[cursor..span.start]);
        edited.extend_from_slice(encode_string(&change.replacement_string).as_bytes());
        changed.push(SpanHit {pointer:change.pointer.clone(),span:span.clone(),
            value:change.expected_old_string.clone()});
        cursor=span.end;
    }
    edited.extend_from_slice(&source[cursor..]);
    // Independent complete JSON validation of edited bytes, plus exact selected new values.
    let out_text=std::str::from_utf8(&edited).map_err(|_|"EDITED_INVALID_UTF8")?;
    let mut after=Parser::new(out_text,&watch);
    let observed=after.parse()?;
    if observed.get("/GameInfo/Version").and_then(|v|v.raw.parse::<u64>().ok()) != Some(expected_schema) {
        return Err("EDITED_SCHEMA_DRIFT");
    }
    for change in changes {
        let got=observed.get(&change.pointer).ok_or("EDITED_POINTER_MISSING")?;
        if got.kind!=TokenKind::String ||
           got.decoded.as_deref()!=Some(change.replacement_string.as_str()) {
            return Err("EDITED_VALUE_MISMATCH");
        }
    }
    if sha256(source)!=source_hash {return Err("SOURCE_MUTATION_DETECTED");}
    let edited_hash=sha256(&edited);
    Ok(PatchedJson {bytes:edited,original_sha256:source_hash,edited_sha256:edited_hash,changed})
}
fn encode_string(value: &str) -> String {
    let mut result=String::from("\"");
    for c in value.chars() {
        match c {
            '"' =>result.push_str("\\\""),
            '\\'=>result.push_str("\\\\"),
            '\n'=>result.push_str("\\n"),
            '\r'=>result.push_str("\\r"),
            '\t'=>result.push_str("\\t"),
            x if x <= '\u{001f}'=>result.push_str(&format!("\\u{:04x}",x as u32)),
            x=>result.push(x),
        }
    }
    result.push('"');
    result
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TokenKind { String, Number, Object, Array, Other }
#[derive(Debug)]
struct Field {span:Range<usize>,kind:TokenKind,decoded:Option<String>,raw:String}
struct Parser<'a> {
 source:&'a str, cursor:usize, tokens:usize, watch:&'a HashSet<String>,
 fields:HashMap<String,Field>,selected_hash_only:bool,
 direct_target:Option<String>, direct_seen:bool,
 direct_kind:Option<DirectIndexKind>, direct_items:Vec<DirectChildSpan>,
}
impl<'a> Parser<'a> {
 fn new(source:&'a str,watch:&'a HashSet<String>)->Self {
   Self{source,cursor:0,tokens:0,watch,fields:HashMap::new(),selected_hash_only:false,
      direct_target:None,direct_seen:false,direct_kind:None,direct_items:Vec::new()}
 }
 fn peek(&self)->Option<u8>{self.source.as_bytes().get(self.cursor).copied()}
 fn whitespace(&mut self) {
  while matches!(self.peek(),Some(b' ' | b'\n' | b'\r' | b'\t')) {self.cursor+=1;}
 }
 fn parse(&mut self)->EngineResult<HashMap<String,Field>> {
  if self.source.len()>MAX_DECODED_JSON_BYTES{return Err("JSON_TOO_LARGE");}
  self.value("",0)?;
  self.whitespace();
  if self.cursor!=self.source.len(){return Err("JSON_TRAILING_CONTENT");}
  Ok(std::mem::take(&mut self.fields))
 }
 fn value(&mut self,path:&str,depth:usize)->EngineResult<()> {
  if depth>MAX_DEPTH{return Err("JSON_TOO_DEEP");}
  self.tokens+=1;
  if self.tokens>MAX_TOKENS{return Err("JSON_TOO_MANY_TOKENS");}
  self.whitespace();
  let start=self.cursor;
  let mut decoded=None;
  let mut kind=TokenKind::Other;
  match self.peek(){
   Some(b'{')=>{
    kind=TokenKind::Object;
    let indexed=self.direct_target.as_deref()==Some(path);
    if indexed {
      self.direct_seen=true;self.direct_kind=Some(DirectIndexKind::Object);
    }
    self.cursor+=1;self.whitespace();let mut keys=HashSet::new();
    if self.peek()!=Some(b'}'){
     loop {
      self.whitespace();
      if self.peek()!=Some(b'"'){return Err("JSON_OBJECT_KEY");}
      let key=self.string()?;
      if !keys.insert(key.clone()){return Err("JSON_DUPLICATE_KEY");}
      self.whitespace();self.token(b':')?;
      let child=pointer_child(path,&key);
      self.whitespace();
      let begin=self.cursor;
      self.value(&child,depth+1)?;
      if indexed {
        if self.direct_items.len()>=MAX_DIRECT_INDEX_ROWS{return Err("DIRECT_INDEX_TOO_LARGE");}
        if key.len()>128{return Err("DIRECT_INDEX_KEY_TOO_LARGE");}
        self.direct_items.push(DirectChildSpan{key,span:begin..self.cursor});
      }
      self.whitespace();
      if self.peek()!=Some(b','){break;}
      self.cursor+=1;
     }
    }
    self.token(b'}')?;
   }
   Some(b'[')=>{
    kind=TokenKind::Array;
    let indexed=self.direct_target.as_deref()==Some(path);
    if indexed {
      self.direct_seen=true;self.direct_kind=Some(DirectIndexKind::Array);
    }
    self.cursor+=1;self.whitespace();let mut i=0usize;
    if self.peek()!=Some(b']'){
     loop {
      let key=i.to_string();
      let child=pointer_child(path,&key);
      self.whitespace();
      let begin=self.cursor;
      self.value(&child,depth+1)?;
      if indexed {
        if self.direct_items.len()>=MAX_DIRECT_INDEX_ROWS{return Err("DIRECT_INDEX_TOO_LARGE");}
        self.direct_items.push(DirectChildSpan{key,span:begin..self.cursor});
      }
      i=i.checked_add(1).ok_or("ARRAY_INDEX_OVERFLOW")?;
      self.whitespace();
      if self.peek()!=Some(b','){break;}
      self.cursor+=1;
     }
    }
    self.token(b']')?;
   }
   Some(b'"')=>{
    kind=TokenKind::String;
    if self.watch.contains(path) && !self.selected_hash_only {
      decoded=Some(self.string()?);
    } else {
      // Validate all escape grammar WITHOUT allocating full unrelated strings.
      // A 200 MB synthetic/unknown-field string must not become another 200 MB String.
      self.skip_string()?;
    }
   }
   Some(b't')=>self.literal("true")?,
   Some(b'f')=>self.literal("false")?,
   Some(b'n')=>self.literal("null")?,
   Some(b'-' | b'0'..=b'9')=>{
    kind=TokenKind::Number;
    self.number()?;
   }
   _=>return Err("JSON_UNEXPECTED_TOKEN"),
  }
  if self.watch.contains(path) {
   if self.fields.contains_key(path) {return Err("DUPLICATE_SELECTED_POINTER");}
   // Hash-only selection stores spans and NEVER clones even a 200MiB
   // selected subtree or quoted string. Legacy exact-CAS token API unchanged.
   let raw=if self.selected_hash_only {String::new()} else {
     self.source[start..self.cursor].to_owned()
   };
   self.fields.insert(path.to_owned(),Field{span:start..self.cursor,kind,decoded,raw});
  }
  Ok(())
 }
 fn token(&mut self,v:u8)->EngineResult<()> {
  self.whitespace();
  if self.peek()!=Some(v){return Err("JSON_UNEXPECTED_TOKEN");}
  self.cursor+=1;Ok(())
 }
 fn literal(&mut self,s:&str)->EngineResult<()> {
  if !self.source[self.cursor..].starts_with(s){return Err("JSON_BAD_LITERAL");}
  self.cursor+=s.len();Ok(())
 }
 fn number(&mut self)->EngineResult<()> {
  let start=self.cursor;
  if self.peek()==Some(b'-'){self.cursor+=1;}
  match self.peek(){
   Some(b'0')=>self.cursor+=1,
   Some(b'1'..=b'9')=>while matches!(self.peek(),Some(b'0'..=b'9')){self.cursor+=1;},
   _=>return Err("JSON_BAD_NUMBER")
  }
  let mut fractional=false;
  if self.peek()==Some(b'.'){
   fractional=true;self.cursor+=1;
   if !matches!(self.peek(),Some(b'0'..=b'9')){return Err("JSON_BAD_NUMBER");}
   while matches!(self.peek(),Some(b'0'..=b'9')){self.cursor+=1;}
  }
  if matches!(self.peek(),Some(b'e'|b'E')){
   fractional=true;self.cursor+=1;
   if matches!(self.peek(),Some(b'+'|b'-')){self.cursor+=1;}
   if !matches!(self.peek(),Some(b'0'..=b'9')){return Err("JSON_BAD_NUMBER");}
   while matches!(self.peek(),Some(b'0'..=b'9')){self.cursor+=1;}
  }
  let raw=&self.source[start..self.cursor];
  if fractional {
    let n=raw.parse::<f64>().map_err(|_|"JSON_INVALID_NUMBER")?;
    if !n.is_finite() || n.abs() > MAX_JS_SAFE_INTEGER as f64 {
      return Err("JSON_UNSAFE_NUMBER");
    }
  } else {
    let magnitude=raw.trim_start_matches('-').parse::<u64>().map_err(|_|"JSON_UNSAFE_INTEGER")?;
    if magnitude>MAX_JS_SAFE_INTEGER {return Err("JSON_UNSAFE_INTEGER");}
  }
  Ok(())
 }
 fn skip_string(&mut self)->EngineResult<()> {
  if self.peek()!=Some(b'"'){return Err("JSON_EXPECTED_STRING");}
  self.cursor+=1;let begin=self.cursor;
  loop {
    match self.peek() {
      Some(b'"') => {
        let raw=&self.source[begin..self.cursor];
        self.cursor+=1;
        return validate_string(raw);
      }
      Some(b'\\') => {
        self.cursor+=1;
        if self.peek().is_none(){return Err("JSON_BAD_ESCAPE");}
        self.cursor+=1;
      }
      Some(0..=31)=>return Err("JSON_CONTROL_CHARACTER"),
      Some(_)=>self.cursor+=1,
      None=>return Err("JSON_UNTERMINATED_STRING")
    }
  }
 }
 fn string(&mut self)->EngineResult<String>{
  if self.peek()!=Some(b'"'){return Err("JSON_EXPECTED_STRING");}
  self.cursor+=1;let begin=self.cursor;
  loop{
   match self.peek(){
    Some(b'"')=>{
     let raw=&self.source[begin..self.cursor];
     self.cursor+=1;
     return decode_string(raw);
    }
    Some(b'\\')=>{
     self.cursor+=1;
     if self.peek().is_none(){return Err("JSON_BAD_ESCAPE");}
     self.cursor+=1;
    }
    Some(0..=31)=>return Err("JSON_CONTROL_CHARACTER"),
    Some(_)=>self.cursor+=1,
    None=>return Err("JSON_UNTERMINATED_STRING")
   }
  }
 }
}
fn pointer_child(parent:&str,key:&str)->String{
 let mut out=String::with_capacity(parent.len()+key.len()+1);
 out.push_str(parent);out.push('/');
 for c in key.chars(){match c{'~'=>out.push_str("~0"),'/'=>out.push_str("~1"),x=>out.push(x)}}
 out
}
fn hex4(chars:&mut impl Iterator<Item=char>)->EngineResult<u32>{
 let mut n=0u32;
 for _ in 0..4 {
  n=n*16+chars.next().and_then(|c|c.to_digit(16)).ok_or("JSON_BAD_UNICODE_ESCAPE")?;
 }
 Ok(n)
}
fn validate_string(raw:&str)->EngineResult<()>{
 let mut chars=raw.chars();
 while let Some(c)=chars.next(){
  if c!='\\'{continue;}
  match chars.next().ok_or("JSON_BAD_ESCAPE")? {
   '"'|'\\'|'/'|'b'|'f'|'n'|'r'|'t'=>{},
   'u'=>{
     let hi=hex4(&mut chars)?;
     if (0xD800..=0xDBFF).contains(&hi) {
       if chars.next()!=Some('\\')||chars.next()!=Some('u'){return Err("JSON_BAD_SURROGATE");}
       let lo=hex4(&mut chars)?;
       if !(0xDC00..=0xDFFF).contains(&lo){return Err("JSON_BAD_SURROGATE");}
     } else if (0xDC00..=0xDFFF).contains(&hi) {
       return Err("JSON_BAD_SURROGATE");
     }
   }
   _=>return Err("JSON_BAD_ESCAPE")
  }
 }
 Ok(())
}
fn decode_string(raw:&str)->EngineResult<String>{
 let mut out=String::new();let mut chars=raw.chars();
 while let Some(c)=chars.next(){
  if c!='\\'{out.push(c);continue;}
  match chars.next().ok_or("JSON_BAD_ESCAPE")? {
   '"'=>out.push('"'),'\\'=>out.push('\\'),'/'=>out.push('/'),
   'b'=>out.push('\u{0008}'),'f'=>out.push('\u{000c}'),
   'n'=>out.push('\n'),'r'=>out.push('\r'),'t'=>out.push('\t'),
   'u'=>{
    let hi=hex4(&mut chars)?;
    let scalar=if (0xD800..=0xDBFF).contains(&hi){
     if chars.next()!=Some('\\')||chars.next()!=Some('u'){return Err("JSON_BAD_SURROGATE");}
     let lo=hex4(&mut chars)?;
     if !(0xDC00..=0xDFFF).contains(&lo){return Err("JSON_BAD_SURROGATE");}
     0x10000+(hi-0xD800)*0x400+(lo-0xDC00)
    }else{
     if (0xDC00..=0xDFFF).contains(&hi){return Err("JSON_BAD_SURROGATE");}
     hi
    };
    out.push(char::from_u32(scalar).ok_or("JSON_BAD_UNICODE_ESCAPE")?);
   }
   _=>return Err("JSON_BAD_ESCAPE")
  }
 }
 Ok(out)
}

#[cfg(target_arch = "wasm32")]
pub mod wasm_probe;

/// Sparse byte-span query. Full strict validation runs before any index is returned;
/// the caller must still verify semantic identity using Wand domain validators.
/// A small requested pointer set does not imply a partial-document validity check.
pub fn index_selected_tokens(source: &[u8], pointers: &[String]) -> EngineResult<Vec<SpanHit>> {
    if pointers.len() > 512 { return Err("INDEX_WATCH_SET_TOO_LARGE"); }
    let watch: HashSet<String> = pointers.iter().cloned().collect();
    if watch.len() != pointers.len() { return Err("INDEX_DUPLICATE_WATCH"); }
    let text = std::str::from_utf8(source).map_err(|_|"JSON_INVALID_UTF8")?;
    let mut parser = Parser::new(text,&watch);
    let found = parser.parse()?;
    let mut result=Vec::with_capacity(found.len());
    for pointer in pointers {
        if let Some(field)=found.get(pointer) {
            result.push(SpanHit {
                pointer:pointer.clone(),span:field.span.clone(),
                value:field.raw.clone()
            });
        }
    }
    Ok(result)
}
/// Bounded SHA-256 witness for a selected lexical token in a fully validated
/// source. No full serde_json::Value, no copied selected token, one full scan.
/// An oversized or absent pointer is omitted, NEVER treated as an empty hash.
/// This is source evidence only, not a proof of Native graph dependencies.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct SparseTokenSha256 {
 pub pointer:String,pub raw_sha256:[u8;32],pub raw_bytes:usize,
 pub lexical_kind:&'static str,
}
pub fn index_selected_token_sha256(
 source:&[u8],pointers:&[String],max_span_bytes:usize
)->EngineResult<Vec<SparseTokenSha256>> {
 if pointers.len()>512{return Err("INDEX_WATCH_SET_TOO_LARGE");}
 if max_span_bytes==0||max_span_bytes>2*1024*1024{
   return Err("INDEX_HASH_SPAN_BUDGET_INVALID");
 }
 let watch:HashSet<String>=pointers.iter().cloned().collect();
 if watch.len()!=pointers.len(){return Err("INDEX_DUPLICATE_WATCH");}
 let text=std::str::from_utf8(source).map_err(|_|"JSON_INVALID_UTF8")?;
 let mut parser=Parser::new(text,&watch);
 parser.selected_hash_only=true;
 let fields=parser.parse()?; // complete strict source validation
 let mut result=Vec::with_capacity(fields.len());
 for pointer in pointers {
   if let Some(field)=fields.get(pointer) {
     let length=field.span.end-field.span.start;
     if length<=max_span_bytes {
       result.push(SparseTokenSha256 {
         pointer:pointer.clone(),
         raw_sha256:sha256(&source[field.span.clone()]),
         raw_bytes:length,
         lexical_kind:match field.kind {
           TokenKind::String=>"string",TokenKind::Number=>"number",
           TokenKind::Object=>"object",TokenKind::Array=>"array",
           TokenKind::Other=>"other"
         }
       });
     }
   }
 }
 Ok(result)
}
pub mod session;
pub mod semantic_safety;
pub mod p1g;



/// Strictly validate and decode one JSON string token. The caller retains the
/// original lexical form separately for byte-exact CAS; decoded equality alone
/// never substitutes for the raw token witness.
pub fn strict_decode_json_string_token(raw:&str)->EngineResult<String>{
 validate_json(raw.as_bytes())?;
 if raw.len()<2||!raw.starts_with('"')||!raw.ends_with('"'){
  return Err("JSON_STRING_TOKEN_REQUIRED");
 }
 decode_string(&raw[1..raw.len()-1])
}
pub mod w1_evidence;
pub mod trusted_read;

/// An exhaustive direct-child byte-span index built by the EXISTING strict
/// Wand parser during its one full-document validation traversal. It does NOT
/// construct a full serde_json graph, nor prove cross-domain references.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum DirectIndexKind {Array,Object}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct DirectChildSpan {pub key:String,pub span:Range<usize>}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct DirectChildIndex {
 pub parent_pointer:String,
 pub kind:DirectIndexKind,
 pub items:Vec<DirectChildSpan>,
 pub complete_from_strict_full_scan:bool,
}
pub fn index_direct_children(source:&[u8],parent_pointer:&str)->EngineResult<DirectChildIndex>{
 if !parent_pointer.starts_with('/')||parent_pointer.len()>1024||
    parent_pointer.contains("//"){return Err("DIRECT_INDEX_POINTER_INVALID");}
 let source=std::str::from_utf8(source).map_err(|_|"JSON_INVALID_UTF8")?;
 let watch=HashSet::new();
 let mut parser=Parser::new(source,&watch);
 parser.direct_target=Some(parent_pointer.to_owned());
 parser.parse()?;
 if !parser.direct_seen{return Err("DIRECT_INDEX_PARENT_MISSING_OR_WRONG_TYPE");}
 let kind=parser.direct_kind.ok_or("DIRECT_INDEX_PARENT_WRONG_TYPE")?;
 if kind==DirectIndexKind::Object {
   // Save-local numeric keys are not array positions; preserve their exact
   // identity. Any ambiguous alias ("01" vs "1") fails closed in the consumer.
   let mut seen=HashSet::new();
   for item in &parser.direct_items {
      if item.key.parse::<usize>().is_err()||
         !seen.insert(item.key.parse::<usize>().unwrap()){
        return Err("DIRECT_INDEX_OBJECT_KEY_AMBIGUOUS");
      }
   }
 }
 Ok(DirectChildIndex{parent_pointer:parent_pointer.to_owned(),
   kind,items:parser.direct_items,complete_from_strict_full_scan:true})
}
