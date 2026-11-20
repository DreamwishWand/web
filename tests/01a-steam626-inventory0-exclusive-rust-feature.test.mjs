import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cargo=readFileSync('crates/ddv-save-core/Cargo.toml','utf8');
const source=readFileSync('crates/ddv-save-core/src/wasm_worker.rs','utf8');
const section=(name)=>{
 const at=source.indexOf('pub fn '+name+'(');
 assert.notEqual(at,-1,'required Rust ABI '+name);
 return source.slice(at,source.indexOf('\n    }',at)+6);
};
test('Inventory0 is an explicit OFF-by-default product Rust feature with one existing Session',()=>{
 assert.match(cargo,/^default = \[\]$/m);
 assert.match(cargo,/^product-steam626-catalog0-scoped = \["product-amount-scoped"\]$/m);
 assert.match(source,/compile_error!\("STEAM626_CATALOG0_PRODUCT_FEATURE_CONFLICT"\)/);
 for(const forbidden of ['product-steam626-chest-scoped','product-switch626-chest-scoped','product-steam626-comp03-scoped','product-steam626-sr03-scoped','product-collection-scoped'])
  assert.match(source.slice(0,5000),new RegExp('feature="'+forbidden+'"'),'compiled mixed feature denied '+forbidden);
});
test('Real Rust Worker selects only InventoryID0 and excludes Chest/placement/Switch exports',()=>{
 const discover=section('discover_scoped_amount');
 const preview=section('preview_scoped_amount');
 const stage=section('stage_scoped_amount');
 assert.match(discover,/feature="product-steam626-catalog0-scoped"/);
 assert.match(discover,/profile!="catalog0-furniture"/);
 assert.match(preview,/profile!="catalog0-furniture"\|\|id!=0\|\|new==0/);
 assert.match(stage,/profile!="catalog0-furniture"\|\|id!=0\|\|old<2\|\|old\.checked_sub\(1\)!=Some\(new\)/);
 const selection=source.slice(source.indexOf('fn scoped_selection('),source.indexOf('fn scoped_selection(')+900);
 assert.match(selection,/\#\[cfg\(not\(feature="product-steam626-catalog0-scoped"\)\)\]\s*"linked-crop-chest48"/);
 for(const name of ['preview_steam626_comp03','stage_steam626_comp03','discover_switch626_chest','preview_switch626_chest','stage_switch626_chest']){
  const at=source.indexOf('pub fn '+name+'(');
  assert.ok(at>0,name);
  assert.match(source.slice(at-950,at),/feature="product-steam626-catalog0-scoped"/,'isolated ABI '+name);
 }
});
test('Inventory-only Rust source preserves CAS, staged output, identity, and immutable original',()=>{
 const preview=section('preview_scoped_amount'),stage=section('stage_scoped_amount');
 assert.match(preview,/scoped_edit_envelope\(session_id,revision,index_generation,decoded_sha256,WorkerAction::ReadDomain\)/);
 assert.match(stage,/scoped_edit_envelope\(session_id,revision,index_generation,decoded_sha256,WorkerAction::Stage\)/);
 assert.match(stage,/guard\.stage_scoped_amount\(e,selection,old,new,from_hex\(entry_sha256\)\?\)/);
 assert.match(stage,/self\.scoped_domain\.set\(Some\(ScopedEditDomain::Amount\)\)/);
 assert.match(source,/pub fn begin_scoped_amount_output\(/);
 assert.match(source,/pub fn next_scoped_amount_output_chunk\(/);
 assert.match(source,/pub fn close\(/);
 const pack=JSON.parse(readFileSync('crates/ddv-save-core/data/steam626-amount-packaged-candidates.json','utf8'));
 assert.equal(pack.profiles.catalog0Furniture.entries.length,234);
 assert.ok(pack.profiles.catalog0Furniture.entries.some(([id])=>id===40000048));
});
