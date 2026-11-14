// ACT505: finite staged release trust. Only the committed active selector
// authorizes a Pages sealer. Changing it requires a separate reviewed cutover.
// The two future tuples are validation/staging vocabulary, not live host proof.
export const RELEASE_REPOSITORY_ID='1371485649';
const tuple=(repository,origin,basePath)=>Object.freeze({
 repository,signerWorkflow:repository+'/.github/workflows/pages.yml',
 sourceRef:'refs/heads/main',origin,basePath
});
export const RELEASE_TUPLES=Object.freeze([
 tuple('DreamwishWand/web','https://dreamwishwand.github.io','/web'),
 tuple('DreamwishWand/web','https://dreamwishwand.com',''),
 tuple('DreamwishWand/site','https://dreamwishwand.com','')
]);
export const LEGACY_RELEASE_TUPLE=RELEASE_TUPLES[0];
// Deliberately NOT selected by environment, input, manifest or caller.
export const ACTIVE_RELEASE_TUPLE=LEGACY_RELEASE_TUPLE;
const keys=Object.keys(LEGACY_RELEASE_TUPLE);
export function matchReleaseTuple(value){
 return RELEASE_TUPLES.find(t=>value&&keys.every(k=>value[k]===t[k]))??null;
}
export function releaseDelivery(tuple){
 const t=matchReleaseTuple(tuple);
 if(!t)throw Error('R22_RELEASE_TRUST_TUPLE_DENIED');
 return Object.freeze({...t,repositoryId:RELEASE_REPOSITORY_ID});
}
export function manifestMatchesRelease(manifest,tuple){
 const t=matchReleaseTuple(tuple);
 if(!t||manifest?.source?.repository!==t.repository)return false;
 // Historical signed manifest bytes remain unmodified. A legacy manifest
 // cannot be relabelled as either root tuple, even with recomputed pins.
 if(t===LEGACY_RELEASE_TUPLE)return !Object.hasOwn(manifest,'delivery');
 const d=manifest?.delivery,expected=releaseDelivery(t);
 return !!d&&typeof d==='object'&&!Array.isArray(d)&&
  Object.keys(d).length===Object.keys(expected).length&&
  Object.keys(expected).every(k=>d[k]===expected[k]);
}
export function protectedPagesContextMatches(env,source,checkout){
 const t=ACTIVE_RELEASE_TUPLE;
 return typeof source==='string'&&/^[0-9a-f]{40}$/.test(source)&&
  env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY_ID===RELEASE_REPOSITORY_ID&&
  env.GITHUB_REPOSITORY===t.repository&&env.GITHUB_REF===t.sourceRef&&
  env.GITHUB_SHA===source&&env.GITHUB_WORKFLOW_SHA===source&&checkout===source&&
  env.GITHUB_WORKFLOW_REF===t.signerWorkflow+'@'+t.sourceRef&&
  ['push','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)&&
  env.WAND_PUBLIC_READONLY_ASSET_GATE==='OWNER_APPROVED_THREE_FILES_20261111';
}
