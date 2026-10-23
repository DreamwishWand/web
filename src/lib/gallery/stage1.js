/**
 * 08 WEB photo-only Gallery UI boundary.
 * Community owns authoritative classification, media provenance and publication.
 * IMPORTANT: Existing community_publish_gallery_v4 has no outdoor/indoor target
 * or verified ToM Base Item field. This facade must fail CLOSED, not serialize
 * a fake classification into description or arbitrary item arrays.
 */
export const GALLERY_PUBLICATION_BLOCKER = 'GALLERY_CLASSIFIED_PHOTO_PUBLICATION_API_REQUIRED';
export const GALLERY_OWNER_MUTATION_BLOCKER = 'GALLERY_IMMUTABLE_REVISION_AND_RETIREMENT_API_REQUIRED';
export const kinds = Object.freeze(['outdoor','indoor','tom_furniture','tom_clothing']);
export const MAX_IMAGES = 10;
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg','image/png','image/webp']);
export const categoryFor = (kind) => kinds.includes(kind) ? (kind.startsWith('tom_') ? 'tom' : 'decorations') : null;

export function validateGalleryImages(files) {
  if(!Array.isArray(files)||files.length<1||files.length>MAX_IMAGES) return 'count';
  if(files.some(x=>!ALLOWED_IMAGE_TYPES.includes(x.type)||x.size<=0)) return 'type';
  if(new Set(files.map(x=>[x.name,x.size,x.lastModified].join(':'))).size!==files.length) return 'duplicate';
  return null;
}
export function validateGalleryComposition(input) {
  const issues=[];
  if(!kinds.includes(input.kind)) issues.push('kind');
  if(!String(input.title??'').trim()||String(input.title).trim().length>240) issues.push('title');
  if(String(input.description??'').length>20000) issues.push('description');
  const fileIssue=validateGalleryImages(input.files);
  if(fileIssue)issues.push('images_'+fileIssue);
  if(input.kind==='outdoor' && !['biome','floating_island'].includes(input.targetType))issues.push('target');
  if(input.kind==='indoor' && input.targetType!=='room')issues.push('target');
  if(!String(input.targetName??'').trim())issues.push('targetName');
  if(categoryFor(input.kind)==='tom'&&!/^\d+$/.test(String(input.baseItemId??'')))issues.push('baseItem');
  if(input.originalityConfirmed!==true)issues.push('originality');
  return issues;
}
export function canUseClassifiedPhotoPublishApi(capabilities) {
  return capabilities?.classificationValidated===true &&
    capabilities?.mediaAtomicity===true &&
    capabilities?.publicOnly===true &&
    capabilities?.creatorAuthorized===true;
}
export function assertClassifiedPhotoPublishContract(capabilities) {
  if(!canUseClassifiedPhotoPublishApi(capabilities))throw new Error(GALLERY_PUBLICATION_BLOCKER);
}
export function workUrl(base,workId) {
  return base+'/gallery/?work='+encodeURIComponent(String(workId));
}
export function moveMedia(list,index,direction) {
  const other=index+direction;
  if(other<0||other>=list.length)return [...list];
  const copy=[...list];
  [copy[index],copy[other]]=[copy[other],copy[index]];
  return copy;
}
export function decorationsOrTom(kind) {
  return kinds.includes(kind) ? categoryFor(kind) : null;
}
export const galleryWorkIsPublic = (work) => work?.lifecycleState==='published' && work?.visibility==='public' && work?.moderationState==='clear';
