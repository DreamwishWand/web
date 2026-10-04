/**
 * Dreamwish Wand Community Core shared domain contract.
 *
 * Product adapters (Gallery, Presets, DreamSnaps, Q&A) may extend this
 * contract, but must not redefine identity, ownership, visibility,
 * moderation or shared interaction semantics.
 */

export const COMMUNITY_SCHEMA_VERSION = 1 as const;

export const accountStatuses = ['active', 'restricted', 'suspended', 'deleted'] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export const visibilityValues = ['private', 'unlisted', 'public'] as const;
export type Visibility = (typeof visibilityValues)[number];

export const moderationStates = ['clear', 'under_review', 'restricted', 'removed'] as const;
export type ModerationState = (typeof moderationStates)[number];

export const workLifecycleStates = ['draft', 'published', 'unpublished', 'deleted'] as const;
export type WorkLifecycleState = (typeof workLifecycleStates)[number];

export const workTypes = ['gallery', 'preset', 'dreamsnap', 'question', 'tip'] as const;
export type WorkType = (typeof workTypes)[number];

export const entityTypes = [
  'creator_profile',
  'community_work',
  'preset_artifact',
  'media_asset',
  'comment'
] as const;
export type CommunityEntityType = (typeof entityTypes)[number];

export type AccountId = string;
export type EntityId = string;
export type CreatorProfileId = EntityId;
export type WorkId = EntityId;
export type RevisionId = string;

export interface CommunityWorkState {
  workId: WorkId;
  ownerAccountId: AccountId;
  creatorProfileId: CreatorProfileId;
  lifecycleState: WorkLifecycleState;
  visibility: Visibility;
  moderationState: ModerationState;
  currentPublishedRevisionId: RevisionId | null;
}

export interface AccessContext {
  requesterAccountId: AccountId | null;
  isStaff: boolean;
}

export interface PublishPreflight {
  ownerMatches: boolean;
  accountMayPublish: boolean;
  subtypeValid: boolean;
  mediaReady: boolean;
  artifactReady: boolean;
  moderationAllowsPublish: boolean;
}

export interface PublishPreflightResult {
  ok: boolean;
  failures: Array<
    | 'OWNER_MISMATCH'
    | 'ACCOUNT_CANNOT_PUBLISH'
    | 'SUBTYPE_INVALID'
    | 'MEDIA_NOT_READY'
    | 'ARTIFACT_NOT_READY'
    | 'MODERATION_BLOCKED'
  >;
}

export function isDiscoverable(work: CommunityWorkState): boolean {
  return (
    work.lifecycleState === 'published' &&
    work.visibility === 'public' &&
    work.moderationState === 'clear' &&
    work.currentPublishedRevisionId !== null
  );
}

export function canReadWork(work: CommunityWorkState, context: AccessContext): boolean {
  if (context.isStaff || context.requesterAccountId === work.ownerAccountId) return true;
  if (work.lifecycleState !== 'published' || work.currentPublishedRevisionId === null) return false;
  if (work.moderationState !== 'clear') return false;
  return work.visibility === 'public' || work.visibility === 'unlisted';
}

export function canMutateOwnedContent(
  ownerAccountId: AccountId,
  context: AccessContext
): boolean {
  return context.isStaff || context.requesterAccountId === ownerAccountId;
}

export function normalizeCreatorHandle(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function evaluatePublishPreflight(input: PublishPreflight): PublishPreflightResult {
  const failures: PublishPreflightResult['failures'] = [];
  if (!input.ownerMatches) failures.push('OWNER_MISMATCH');
  if (!input.accountMayPublish) failures.push('ACCOUNT_CANNOT_PUBLISH');
  if (!input.subtypeValid) failures.push('SUBTYPE_INVALID');
  if (!input.mediaReady) failures.push('MEDIA_NOT_READY');
  if (!input.artifactReady) failures.push('ARTIFACT_NOT_READY');
  if (!input.moderationAllowsPublish) failures.push('MODERATION_BLOCKED');
  return { ok: failures.length === 0, failures };
}

export function canTransitionLifecycle(
  from: WorkLifecycleState,
  to: WorkLifecycleState
): boolean {
  if (from === to) return true;
  const allowed: Record<WorkLifecycleState, ReadonlySet<WorkLifecycleState>> = {
    draft: new Set(['published', 'deleted']),
    published: new Set(['unpublished', 'deleted']),
    unpublished: new Set(['published', 'deleted']),
    deleted: new Set()
  };
  return allowed[from].has(to);
}
