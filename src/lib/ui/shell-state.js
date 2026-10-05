import { writable } from 'svelte/store';

export const DEFAULT_SHELL_STATE = Object.freeze({
  save: Object.freeze({ state: 'none', label: '', status: '', href: null }),
  account: Object.freeze({ signedIn: false, label: '', href: null }),
  notifications: Object.freeze({ available: false, unread: false, href: null }),
  contextActions: Object.freeze([])
});

function cloneDefault() {
  return {
    save: { ...DEFAULT_SHELL_STATE.save },
    account: { ...DEFAULT_SHELL_STATE.account },
    notifications: { ...DEFAULT_SHELL_STATE.notifications },
    contextActions: []
  };
}

export const shellState = writable(cloneDefault());

export function updateShellState(patch = {}) {
  shellState.update((current) => ({
    ...current,
    ...patch,
    save: patch.save ? { ...current.save, ...patch.save } : current.save,
    account: patch.account ? { ...current.account, ...patch.account } : current.account,
    notifications: patch.notifications ? { ...current.notifications, ...patch.notifications } : current.notifications,
    contextActions: patch.contextActions ? [...patch.contextActions] : current.contextActions
  }));
}

export function setShellContextActions(actions = []) {
  shellState.update((current) => ({ ...current, contextActions: [...actions] }));
}

export function resetShellState() {
  shellState.set(cloneDefault());
}

export function dispatchShellIntent(intent, detail = {}) {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent('wand:shell-intent', { detail: { intent, ...detail } }));
  return true;
}
