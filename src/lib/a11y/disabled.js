export function explainedDisabledAttributes({ disabled, reasonId, describedBy = [] } = {}) {
  if (!disabled) return {};
  const ids = [...(Array.isArray(describedBy) ? describedBy : [describedBy]), reasonId].filter(Boolean);
  return {
    'aria-disabled': 'true',
    'aria-describedby': ids.length ? [...new Set(ids)].join(' ') : undefined
  };
}
export function guardDisabledActivation(event, disabled) {
  if (!disabled) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return true;
}
