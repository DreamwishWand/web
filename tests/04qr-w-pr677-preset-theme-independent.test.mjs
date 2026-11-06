// 04 QR-W independent NEW_ONLY QA: Source PR677 fixed HEAD / Preset Theme8 & Facet4.
// This is synthetic source-scoped only; matching facets never proves public rights or Native identity.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {
  PRESET_THEME_PICKER_GROUPS,PRESET_THEME_FACETS,PRESET_THEME_LIFECYCLE,
  PRESET_THEME_WORKING_BATCH,PRESET_THEME_STAGE1_BOUNDARIES,
  isPresetThemePickerGroup,matchesPresetThemeFacets
} from "../src/lib/product/preset-theme-stage1-contract.mjs";

const BASE="5bc658f119aec1d08138e10bf8294700c74bd700";
const MAIN_AT_QA="fec73080ccc2d65098750f9f18999a3563658ecd";
const SOURCE="099b6eab4fb02943b093c1b5f43f1962daf5498b";
const sourceBlobs=new Map([
  ["src/lib/product/preset-theme-stage1-contract.mjs","e69646a70de0151bce3059603afa2b1832d3df5b"],
  ["tests/preset-theme-stage1-contract.test.mjs","78fd7df4dda979dde7016b1bacc831bece1c829d"]
]);
const qaFiles=[
  ".github/workflows/04qr-w-pr677-preset-theme-independent.yml",
  "tests/04qr-w-pr677-preset-theme-independent.test.mjs"
];
const disjointMainFiles=[
  "src/lib/presets/native-local-file-import-contract.mjs",
  "src/lib/presets/native-local-preset-quarantine.mjs",
  "tests/01d-native-local-preset-quarantine.test.mjs",
  "tests/01d-native-preset-local-file-import-contract.test.mjs"
].sort();
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const diff=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
test("QR677 source exact two Git blobs; QA adds only two independent files (or inherited accepted main4 on GitHub merge ref)",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  assert.deepEqual(diff(BASE,SOURCE),[...sourceBlobs.keys()].sort());
  for(const [p,sha] of sourceBlobs)assert.equal(git("hash-object",p),sha,p);
  const changed=diff(SOURCE,"HEAD");
  for(const p of qaFiles)assert.ok(changed.includes(p),p);
  const inherited=changed.filter(x=>!qaFiles.includes(x));
  assert.ok(inherited.length===0||JSON.stringify(inherited)===JSON.stringify(disjointMainFiles),
    "No unreviewed product changes: "+inherited.join(","));
  for(const file of inherited)assert.equal(git("hash-object",file),git("rev-parse",MAIN_AT_QA+":"+file),file);
});

test("QR677 exactly final PRESET73 eight canonical groups; old ninth is denied and array is frozen",()=>{
  assert.deepEqual(PRESET_THEME_PICKER_GROUPS,[
    "Style & Aesthetic","Era & Design","Mood & Atmosphere","Regional & Cultural",
    "Fantasy & Genre","Nature & Landscape","Place & Setting","Venue & Function"
  ]);
  assert.equal(PRESET_THEME_PICKER_GROUPS.length,8);
  assert.equal(isPresetThemePickerGroup("Composition & Visual Character"),false);
  for(const x of [null,0,undefined,"","Era & Design ","composition & visual character"])assert.equal(isPresetThemePickerGroup(x),false);
  assert.equal(Object.isFrozen(PRESET_THEME_PICKER_GROUPS),true);
});

test("QR677 PRESET43 featuredWork is explicit and DDV-native eligible, not inferred from Item or non-DDV",()=>{
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.featuredWorkRequiresCurrentDdvNativeIdentityAndIcon,true);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.featuredWorkMustBeAuthorSelected,true);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.automaticFeaturedWorkAssignmentFromItems,false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.createdOrPublishedByThisModule,false);
});

test("QR677 CANDIDATE historical 148/31/48 never means active/public; PRESET106 no cap",()=>{
  assert.deepEqual(PRESET_THEME_LIFECYCLE,["CANDIDATE","ACTIVE","DEPRECATED","MERGED"]);
  assert.deepEqual(PRESET_THEME_WORKING_BATCH,{
    highConfidenceCandidates:148,aliasMergeCandidates:31,heldCandidates:48,publicActiveCount:null
  });
  for(const k of ["publicRegistryApproved","numericAssignmentCapApproved","typicalAssignmentCountApproved","candidateAutomaticallyActive","themeRequestAutomaticallyPublic"]){
    assert.equal(PRESET_THEME_STAGE1_BOUNDARIES[k],false,k);
  }
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.draftDefaultState,"CANDIDATE");
  assert.equal(Object.isFrozen(PRESET_THEME_WORKING_BATCH),true);
  assert.equal(Object.isFrozen(PRESET_THEME_STAGE1_BOUNDARIES),true);
});

test("QR677 four controlled facet families, intra-family OR inter-family AND; no public access inference",()=>{
  assert.deepEqual(PRESET_THEME_FACETS,["season","seasonalEvent","decorationTheme","featuredWork"]);
  const record={season:["winter"],seasonalEvent:["christmas"],decorationTheme:["cozy","modern"],featuredWork:["ddv-work"]};
  assert.equal(matchesPresetThemeFacets(record,{season:["autumn","winter"],decorationTheme:["cozy","rustic"],featuredWork:["ddv-work"]}),true);
  assert.equal(matchesPresetThemeFacets(record,{season:["autumn","winter"],decorationTheme:["rustic"]}),false);
  assert.equal(matchesPresetThemeFacets(record,{season:["winter"],featuredWork:["foreign-work"]}),false);
  assert.equal(matchesPresetThemeFacets(record,{}),true);
  assert.equal(matchesPresetThemeFacets(record,{season:[]}),true);
});

test("QR677 unknown, malformed, forged selection and record entry deny rather than match",()=>{
  const record={season:["winter"],decorationTheme:["cozy"]};
  for(const selected of [null,[],{tag:["cozy"]},{season:"winter"},{season:[null]},{season:[""]},{season:[42]},{featuredWork:["unknown"],newFacet:[]}]) {
    assert.equal(matchesPresetThemeFacets(record,selected),false,JSON.stringify(selected));
  }
  for(const invalid of [null,[],{season:"winter"},{season:[null]},{season:[""]},{season:[17]},{}]){
    assert.equal(matchesPresetThemeFacets(invalid,{season:["winter"]}),false,JSON.stringify(invalid));
  }
});

test("QR677 negative: record INHERITED facet is not an own serialized canonical facet",()=>{
  const inherited=Object.create({season:["winter"]});
  inherited.decorationTheme=["cozy"];
  assert.equal(Object.hasOwn(inherited,"season"),false);
  assert.equal(matchesPresetThemeFacets(inherited,{season:["winter"],decorationTheme:["cozy"]}),false,
    "Inherited season cannot promote an unverified record to a positive match");
});

test("QR677 negative: sparse facet array inherited index cannot masquerade as serialized selected ID",()=>{
  const sparse=Array(1);
  const prototype=Object.create(Array.prototype);
  Object.defineProperty(prototype,"0",{value:"winter",configurable:true});
  Object.setPrototypeOf(sparse,prototype);
  assert.equal(Object.hasOwn(sparse,0),false);
  assert.equal(matchesPresetThemeFacets({season:sparse},{season:["winter"]}),false,
    "Inherited array index cannot mint native verified facet ID");
});