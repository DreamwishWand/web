import { locale, getActiveLocale, resolveMessageFromCatalogs, t as sharedT } from './runtime.js';
import { communityCatalogs } from './messages/community/index.js';

export { locale };

export function ct(key, params = {}, code = getActiveLocale()) {
  const result = resolveMessageFromCatalogs(communityCatalogs, code, key, params);
  return result.missing ? sharedT(key, params, code) : result.text;
}
