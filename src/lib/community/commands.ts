import type {
  CreatorProfileId,
  EntityId,
  RevisionId,
  Visibility,
  WorkId,
  WorkType
} from './domain';

/**
 * Actor identity is intentionally absent from the command envelope.
 * The authenticated server/Edge adapter resolves the actor from verified
 * credentials and binds a command bus to that request context.
 */
export interface CommandEnvelope<T> {
  idempotencyKey: string;
  expectedVersion?: number;
  payload: T;
}

export interface CreateDraftWork {
  workType: WorkType;
  creatorProfileId: CreatorProfileId;
  visibility: Visibility;
}

export interface UpdateDraftWork {
  workId: WorkId;
  metadata: Record<string, unknown>;
}

export interface PublishWork {
  workId: WorkId;
  subtypeRevisionRef: string;
  mediaIds: EntityId[];
  artifactBlobIds?: string[];
}

export interface UnpublishWork {
  workId: WorkId;
}

export interface SaveEntity {
  targetEntityId: EntityId;
}

export interface FollowCreator {
  creatorProfileId: CreatorProfileId;
}

export interface AddReaction {
  targetEntityId: EntityId;
  reactionKind: string;
}

export interface AddComment {
  targetEntityId: EntityId;
  body: string;
  parentCommentId?: EntityId;
}

export interface ReportEntity {
  targetEntityId: EntityId;
  targetRevisionId?: RevisionId;
  reasonCode: string;
  detail?: string;
}

export interface ApplyModerationAction {
  caseId: string;
  actionType: 'close' | 'restrict' | 'remove' | 'restore' | 'restrict_account' | 'suspend_account';
  reason: string;
}

export interface CommunityCommandResult {
  entityId?: EntityId;
  workId?: WorkId;
  revisionId?: RevisionId;
  rowVersion?: number;
  replayed: boolean;
}

/**
 * Adapter boundary implemented by the server runtime.
 * The first production-shaped adapter is expected to use PostgreSQL/Supabase,
 * but product code depends on this contract rather than a provider SDK.
 */
export interface CommunityCommandBus {
  createDraftWork(command: CommandEnvelope<CreateDraftWork>): Promise<CommunityCommandResult>;
  updateDraftWork(command: CommandEnvelope<UpdateDraftWork>): Promise<CommunityCommandResult>;
  publishWork(command: CommandEnvelope<PublishWork>): Promise<CommunityCommandResult>;
  unpublishWork(command: CommandEnvelope<UnpublishWork>): Promise<CommunityCommandResult>;
  saveEntity(command: CommandEnvelope<SaveEntity>): Promise<CommunityCommandResult>;
  unsaveEntity(command: CommandEnvelope<SaveEntity>): Promise<CommunityCommandResult>;
  followCreator(command: CommandEnvelope<FollowCreator>): Promise<CommunityCommandResult>;
  unfollowCreator(command: CommandEnvelope<FollowCreator>): Promise<CommunityCommandResult>;
  addReaction(command: CommandEnvelope<AddReaction>): Promise<CommunityCommandResult>;
  removeReaction(command: CommandEnvelope<AddReaction>): Promise<CommunityCommandResult>;
  addComment(command: CommandEnvelope<AddComment>): Promise<CommunityCommandResult>;
  reportEntity(command: CommandEnvelope<ReportEntity>): Promise<CommunityCommandResult>;
  applyModerationAction(
    command: CommandEnvelope<ApplyModerationAction>
  ): Promise<CommunityCommandResult>;
}
