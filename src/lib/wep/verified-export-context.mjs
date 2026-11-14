// UI-only identity fence for the existing verified export path. This is not
// writer authorization: the underlying operation still validates its own
// source SHA, exact Build, target and diff. EditorSession.getDocument returns
// a new snapshot on every committed draft mutation; the route replaces it.
export function sameVerifiedExportContext(expected, current) {
  if (!expected || !current || expected.buildConfirmed !== true || current.buildConfirmed !== true) return false;
  if (!expected.source || !expected.bytes || !expected.baseline || !expected.draft) return false;
  return expected.epoch === current.epoch && expected.source === current.source &&
    expected.bytes === current.bytes && expected.baseline === current.baseline &&
    expected.draft === current.draft && expected.sourceName === current.sourceName &&
    expected.platform === current.platform && expected.buildId === current.buildId;
}
