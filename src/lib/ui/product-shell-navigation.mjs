// HOME-UX-43..53: one Product-local navigation registry, no global seven-Product toolbar.
// Only real first-level route destinations are linked; in-page tabs stay inside their Product.
import { homeCopy } from '../product-home/copy.js';
import { decorateEntryCopy } from '../decorate/copy.js';
import { dreamsnapsStage1Copy } from '../community/dreamsnaps-stage1-root.mjs';
import { helpStage1Copy } from '../community/help-stage1-copy.js';
import { stage1GalleryCopy } from '../community/gallery-stage1-root.mjs';

export function normalizeShellPath(pathname) {
  const raw = typeof pathname === 'string' ? pathname.split(/[?#]/, 1)[0] : '/';
  const stripped = raw === '/web' ? '/' : raw.startsWith('/web/') ? raw.slice(4) : raw;
  const withSlash = stripped.startsWith('/') ? stripped : '/';
  return withSlash.endsWith('/') ? withSlash : withSlash + '/';
}

function within(path, prefix) {
  return path === prefix || path.startsWith(prefix);
}

function currentSection(path, destination) {
  return within(path, destination);
}

export function resolveProductShell(pathname, locale = 'en') {
  const path = normalizeShellPath(pathname);
  const home = homeCopy(locale);
  const decorate = decorateEntryCopy(locale);
  const dreams = dreamsnapsStage1Copy(locale);
  const help = helpStage1Copy(locale);
  const gallery = stage1GalleryCopy(locale);
  const definitions = {
    decorate: { root: '/decorate/', label: home.decorate, sections: [
      { id: 'explore', href: '/explore/', label: decorate.explore },
      { id: 'moodboards', href: '/moodboards/', label: decorate.moodboards },
      { id: 'editor', href: '/editor/world/', label: decorate.worldEditor }
    ] },
    collection: { root: '/collection/', label: home.collection, sections: [] },
    guide: { root: '/guide/', label: home.guide, sections: [] },
    presets: { root: '/presets/', label: home.presets, sections: [] },
    gallery: { root: '/gallery/', label: home.gallery, sections: [
      { id: 'my', href: '/gallery/my/', label: gallery.mine }
    ] },
    dreamsnaps: { root: '/dreamsnaps/', label: home.dreamsnaps, sections: [
      { id: 'community', href: '/dreamsnaps/community/', label: dreams.community },
      { id: 'submit', href: '/dreamsnaps/submit/', label: dreams.submit },
      { id: 'judge', href: '/dreamsnaps/judge/', label: dreams.judge },
      { id: 'results', href: '/dreamsnaps/results/', label: dreams.results },
      { id: 'my', href: '/dreamsnaps/my/', label: dreams.my }
    ] },
    help: { root: '/help/', label: help.title, sections: [
      { id: 'questions', href: '/help/questions/', label: help.questions },
      { id: 'tips', href: '/help/tips/', label: help.tips },
      { id: 'issues', href: '/help/issues/', label: help.issues },
      { id: 'my', href: '/help/my/', label: help.activity }
    ] }
  };
  let id = null;
  if (within(path, '/editor/world/') || within(path, '/explore/') || within(path, '/moodboards/') || within(path, '/decorate/')) id = 'decorate';
  else if (within(path, '/collection/')) id = 'collection';
  else if (within(path, '/guide/')) id = 'guide';
  else if (within(path, '/presets/')) id = 'presets';
  else if (within(path, '/gallery/')) id = 'gallery';
  else if (within(path, '/dreamsnaps/')) id = 'dreamsnaps';
  else if (within(path, '/help/') || within(path, '/qa/')) id = 'help';

  const definition = id ? definitions[id] : null;
  const presentation = within(path, '/editor/world/') ? 'immersive' : 'standard';
  return {
    id,
    path,
    presentation,
    rootHref: definition?.root ?? null,
    rootLabel: definition?.label ?? '',
    atRoot: definition ? path === definition.root : false,
    sections: (definition?.sections ?? []).map(section => ({
      ...section,
      current: currentSection(path, section.href)
    }))
  };
}
