export function formErrorAttributes({ errorId, hasError = true, describedBy = [] } = {}) {
  const ids = [...(Array.isArray(describedBy) ? describedBy : [describedBy]), hasError ? errorId : null].filter(Boolean);
  return {
    'aria-invalid': hasError ? 'true' : undefined,
    'aria-describedby': ids.length ? [...new Set(ids)].join(' ') : undefined
  };
}
