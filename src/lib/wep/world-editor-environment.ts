export type WorldEditorEnvironmentInput = {
  userAgent?: string;
  maxTouchPoints?: number;
  userAgentDataMobile?: boolean | null;
};

export function isWorldEditorEnvironmentSupported(
  input: WorldEditorEnvironmentInput = {}
) {
  const ua = String(input.userAgent ?? '');
  const touch = Number(input.maxTouchPoints ?? 0);
  if (input.userAgentDataMobile === true) return false;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return false;
  if (/Macintosh/i.test(ua) && touch > 1) return false;
  return true;
}

export function currentWorldEditorEnvironmentSupported() {
  if (typeof navigator === 'undefined') return false;
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return isWorldEditorEnvironmentSupported({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    userAgentDataMobile: data?.mobile ?? null
  });
}
