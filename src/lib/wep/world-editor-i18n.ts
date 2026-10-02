import { t } from '../i18n/runtime.js';
import { machineCodeSegment } from '../i18n/messages/world-editor/_factory.js';

type Params = Record<string, unknown>;

const COMMAND_REASON_KEYS: Record<string, string> = Object.freeze({
  WEP_DRAFT_AUTHORING_NOT_BOUND: 'worldEditor.commandReason.draftAuthoringNotBound',
  WEP_SELECTION_EMPTY: 'worldEditor.commandReason.selectionEmpty',
  WORLD_OBJECT_NOT_EDITABLE: 'worldEditor.coreReason.worldObjectNotEditable',
  WEP_CLIPBOARD_EMPTY: 'worldEditor.commandReason.clipboardEmpty',
  WEP_UNDO_HISTORY_EMPTY: 'worldEditor.commandReason.undoHistoryEmpty',
  WEP_REDO_HISTORY_EMPTY: 'worldEditor.commandReason.redoHistoryEmpty',
  WEP_EDITOR_SESSION_UNAVAILABLE: 'worldEditor.commandReason.editorSessionUnavailable',
  WEP_ORIGINAL_SAVE_BACKUP_UNAVAILABLE: 'worldEditor.commandReason.originalBackupUnavailable'
});

const VALIDATION_GROUP_KEYS: Record<string, string> = Object.freeze({
  INVALID: 'worldEditor.validation.nativeInvalid',
  REPLACEMENT_POLICY: 'worldEditor.validation.replacementPolicy',
  UNKNOWN: 'worldEditor.validation.nativeUnverified',
  EXACT_BUILD: 'worldEditor.validation.exactBuildUnverified',
  OTHER: 'worldEditor.validation.otherBlocker'
});

export function worldEditorText(
  key: string,
  params: Params = {},
  locale?: string
): string {
  return t(key, params, locale);
}

export function localizeWepBlocker(
  code: string,
  locale?: string
): {
  code: string;
  title: string;
  message: string;
  action: string;
} {
  const machineCode = String(code ?? '');
  const segment = machineCodeSegment(machineCode);
  const prefix = `worldEditor.blocker.${segment}`;
  const title = t(`${prefix}.title`, {}, locale);
  const message = t(`${prefix}.message`, {}, locale);
  const action = t(`${prefix}.action`, {}, locale);
  const missing = (value: string) => value.startsWith('⟦');
  return {
    code: machineCode,
    title: missing(title)
      ? t('worldEditor.live.unknownBlockerTitle', {}, locale)
      : title,
    message: missing(message)
      ? t('worldEditor.live.unknownBlockerMessage', {}, locale)
      : message,
    action: missing(action)
      ? t('worldEditor.live.unknownBlockerAction', {}, locale)
      : action
  };
}

export function localizeCoreReason(
  code: string,
  locale?: string
): string {
  const machineCode = String(code ?? '');
  const key = `worldEditor.coreReason.${machineCodeSegment(machineCode)}`;
  const resolved = t(key, {}, locale);
  return resolved.startsWith('⟦')
    ? t('worldEditor.live.coreReasonDefault', {}, locale)
    : resolved;
}

export function localizeCommandReason(
  reasonCode: string | null | undefined,
  fallback: string,
  locale?: string
): string {
  const code = String(reasonCode ?? '');
  if (COMMAND_REASON_KEYS[code]) {
    return t(COMMAND_REASON_KEYS[code], {}, locale);
  }
  if (code) {
    const core = t(
      `worldEditor.coreReason.${machineCodeSegment(code)}`,
      {},
      locale
    );
    if (!core.startsWith('⟦')) return core;
  }
  return fallback;
}

export function localizeValidationGroup(
  groupId: string,
  fallback: string,
  locale?: string
): string {
  const key = VALIDATION_GROUP_KEYS[String(groupId)] ?? '';
  return key ? t(key, {}, locale) : fallback;
}

export function localizeCommandLabel(
  command: string,
  fallback: string,
  locale?: string
): string {
  const keys: Record<string, string> = {
    move: 'worldEditor.command.move',
    rotate: 'worldEditor.command.rotate',
    copy: 'worldEditor.command.copy',
    paste: 'worldEditor.command.paste',
    duplicate: 'worldEditor.command.duplicate',
    delete: 'worldEditor.command.delete',
    undo: 'worldEditor.command.undo',
    redo: 'worldEditor.command.redo',
    reviewSavePrep: 'worldEditor.command.reviewSavePrep',
    downloadOriginalBackup: 'worldEditor.command.downloadOriginalBackup'
  };
  return keys[command] ? t(keys[command], {}, locale) : fallback;
}
