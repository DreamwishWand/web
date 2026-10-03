import en from './en.js';
import fr from './fr.js';
import it from './it.js';
import de from './de.js';
import es from './es-ES.js';
import esQa from './qa.es-ES.js';
import ja from './ja.js';
import jaQa from './qa.ja.js';
import zh from './zh-CN.js';
import zhQa from './qa.zh-CN.js';
import pt from './pt-BR.js';
import ptQa from './qa.pt-BR.js';

const merge = (...parts) => Object.freeze(Object.assign({}, ...parts));

export const communityCatalogs = Object.freeze({
  en,
  fr,
  it,
  de,
  'es-ES': merge(es, esQa),
  ja: merge(ja, jaQa),
  'zh-CN': merge(zh, zhQa),
  'pt-BR': merge(pt, ptQa)
});
