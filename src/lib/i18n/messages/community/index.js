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
import dreamsnapEn from './dreamsnaps.en.js';
import dreamsnapFr from './dreamsnaps.fr.js';
import dreamsnapIt from './dreamsnaps.it.js';
import dreamsnapDe from './dreamsnaps.de.js';
import dreamsnapEs from './dreamsnaps.es-ES.js';
import dreamsnapJa from './dreamsnaps.ja.js';
import dreamsnapZh from './dreamsnaps.zh-CN.js';
import dreamsnapPt from './dreamsnaps.pt-BR.js';

const merge = (...parts) => Object.freeze(Object.assign({}, ...parts));

export const communityCatalogs = Object.freeze({
  en: merge(en, dreamsnapEn),
  fr: merge(fr, dreamsnapFr),
  it: merge(it, dreamsnapIt),
  de: merge(de, dreamsnapDe),
  'es-ES': merge(es, esQa, dreamsnapEs),
  ja: merge(ja, jaQa, dreamsnapJa),
  'zh-CN': merge(zh, zhQa, dreamsnapZh),
  'pt-BR': merge(pt, ptQa, dreamsnapPt)
});
