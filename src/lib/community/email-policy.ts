export const AUTH_PROVIDER_EMAIL_KINDS = [
  'email_verification',
  'password_recovery'
] as const;

export const WAND_TRANSACTIONAL_EMAIL_KINDS = [
  'security_critical',
  'moderation_critical',
  'wand_cloud_purchase',
  'gift'
] as const;

export const OPERATOR_EMAIL_KINDS = [
  'operator_critical_operations_alert'
] as const;

export const COMMUNITY_ACTIVITY_EMAIL_DISABLED = [
  'comment',
  'reply',
  'reaction',
  'follow',
  'save',
  'work_published'
] as const;

export type AuthProviderEmailKind = (typeof AUTH_PROVIDER_EMAIL_KINDS)[number];
export type WandTransactionalEmailKind = (typeof WAND_TRANSACTIONAL_EMAIL_KINDS)[number];
export type OperatorEmailKind = (typeof OPERATOR_EMAIL_KINDS)[number];

export function isCommunityActivityEmailDisabled(kind: string): boolean {
  return (COMMUNITY_ACTIVITY_EMAIL_DISABLED as readonly string[]).includes(kind);
}
