const FOCUSABLE = ['button:not([disabled])','[href]','input:not([disabled])','select:not([disabled])','textarea:not([disabled])','[tabindex]:not([tabindex="-1"])'].join(',');
function focusables(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => node.getAttribute('aria-hidden') !== 'true');
}
export function openModalDialog(dialog, { initialFocus = null, returnFocus = null } = {}) {
  if (!dialog || typeof dialog.showModal !== 'function') throw new TypeError('A native <dialog> element is required.');
  const previous = returnFocus ?? dialog.ownerDocument?.activeElement ?? null;
  if (!dialog.open) dialog.showModal();
  queueMicrotask(() => (initialFocus ?? focusables(dialog)[0] ?? dialog)?.focus?.());
  return () => closeModalDialog(dialog, { returnFocus: previous });
}
export function closeModalDialog(dialog, { returnFocus = null } = {}) {
  if (dialog?.open && typeof dialog.close === 'function') dialog.close();
  queueMicrotask(() => returnFocus?.focus?.());
}
export function trapDialogTab(event, dialog) {
  if (event?.key !== 'Tab' || !dialog?.open) return false;
  const nodes = focusables(dialog);
  if (!nodes.length) { event.preventDefault(); dialog.focus?.(); return true; }
  const first = nodes[0], last = nodes[nodes.length - 1], active = dialog.ownerDocument?.activeElement;
  if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); return true; }
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); return true; }
  return false;
}
