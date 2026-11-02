// Independent Node oracle for newly scoped synthetic Grid/Container and opaque token rules.
// This is NOT Rust binary parity, real P1G or a DDV native semantic oracle.
import assert from 'node:assert/strict';

const source = JSON.stringify({
  GameInfo:{Version:626},
  Player:{ContainerInventories:{ChestA:{Items:[]},ChestB:{Items:[]}}},
  World:{GridCollection:{Grids:{5:{Objects:{3:{
    ID:3,ItemID:10,X:4,
    State:{Storage:{ContainerInventoryID:'ChestA'},Mystery:{nested:{number:1.0,text:'é'}}}
  }}}}},RecurringEvents:{0:{ItemSpawning:{
    RecurringEventItemID:2010000021,OneofVariant:'W1',NextOccurrence:'2126-08-20T00:00:00Z'
  }}}},
  Unknown:{value:'no change'}
});
function scan(value,path='',out=[]) {
  if (Array.isArray(value)) value.forEach((v,i)=>scan(v,path+'/'+i,out));
  else if (value && typeof value==='object') for(const [k,v] of Object.entries(value)) {
    const next=path+'/'+k.replaceAll('~','~0').replaceAll('/','~1');
    if(k==='ContainerInventoryID') out.push([next,v]);
    scan(v,next,out);
  }
  return out;
}
const before=JSON.parse(source);
const expected='/World/GridCollection/Grids/5/Objects/3/State/Storage/ContainerInventoryID';
const links=scan(before);
assert.deepEqual(links,[[expected,'ChestA']]);
const nodes=new Set(['grid:5:object:3','container:ChestA','container:ChestB']);
const complete=new Set(['grid:5:object:3->container:ChestA']);
const omitted=new Set();
const wrong=new Set(['grid:5:object:3->container:ChestB']);
const accepted=(edges,tree)=> {
  const all=scan(tree);
  if(all.length!==1||all[0][0]!==expected)return false;
  if(!tree.Player.ContainerInventories[all[0][1]])return false;
  const derived='grid:5:object:3->container:'+all[0][1];
  return nodes.has('container:'+all[0][1])&&edges.size===1&&edges.has(derived);
};
assert.equal(accepted(complete,before),true);
assert.equal(accepted(omitted,before),false);
assert.equal(accepted(wrong,before),false);
const unknownDeletion=structuredClone(before);
delete unknownDeletion.World.GridCollection.Grids['5'].Objects['3'].State;
assert.equal(Object.hasOwn(unknownDeletion.World.GridCollection.Grids['5'].Objects['3'],'State'),false);
const allowedX=structuredClone(before);
allowedX.World.GridCollection.Grids['5'].Objects['3'].X=5;
assert.deepEqual(allowedX.World.GridCollection.Grids['5'].Objects['3'].State,
  before.World.GridCollection.Grids['5'].Objects['3'].State);
const rebound=structuredClone(before);
rebound.World.GridCollection.Grids['5'].Objects['3'].State.Storage.ContainerInventoryID='ChestB';
assert.equal(accepted(complete,rebound),false);
assert.equal(accepted(new Set(['grid:5:object:3->container:ChestB']),rebound),true);
const escaped='{"State":{"Opaque":{"text":"\\u00e9","num":1.00}}}';
const equivalent='{"State":{"Opaque":{"text":"é","num":1.0}}}';
assert.deepEqual(JSON.parse(escaped),JSON.parse(equivalent));
assert.notEqual(escaped,equivalent,'lexical preservation must reject semantic-only rewrite');
console.log('SOURCE_CLOSURE_JS_ORACLE_PASS: derived omitted/false edge negative; nested unknown preserve/deny; lexical byte negative; post-graph rebinding');
