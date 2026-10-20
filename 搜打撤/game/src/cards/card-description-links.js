import { descRich } from './cards.view.js';
import { displayCardDescription } from './card-description-text.js';
import { termKeyFor } from '../ui/term-tips.js';
import { esc, escAttr } from '../core/shared.js';
import '../../css/card-description-links.css';

const ordinaryNames = new Set(['攻击', '伤害', '护甲', '生命', '能量', '法伤', '回合', '装备', '牌库', '弃牌', '抽牌']);
const searchPatterns = new Map();

function regexEscape(value) {
  return Array.from(value).map(char => '\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char).join('');
}

export function highlightSearchText(value, query = '') {
  const text = String(value || '');
  const needle = query.trim();
  if (!needle) return esc(text);
  let pattern = searchPatterns.get(needle);
  if (!pattern) {
    pattern = new RegExp(regexEscape(needle), 'gi');
    if (searchPatterns.size >= 16) searchPatterns.delete(searchPatterns.keys().next().value);
    searchPatterns.set(needle, pattern);
  }
  let result = '', offset = 0;
  for (const match of text.matchAll(pattern)) {
    result += esc(text.slice(offset, match.index)) +
      '<mark class="studio-search-hit">' + esc(match[0]) + '</mark>';
    offset = match.index + match[0].length;
  }
  return result + esc(text.slice(offset));
}

function letterKey(index) {
  let key = '';
  do { key = String.fromCharCode(65 + index % 26) + key; index = Math.floor(index / 26) - 1; } while (index >= 0);
  return key;
}

// Card names are protected before rich-text rendering, so terms and numbers cannot
// split a referenced name or change HTML attributes. Ambiguous names stay plain.
export function createCardDescriptionRenderer(cards = []) {
  const byId = new Map(), byName = new Map();
  for (const card of cards) {
    if (!card?.id || !card.name) continue;
    const id = String(card.id);
    if (byId.has(id)) continue;
    byId.set(id, card);
    const name = String(card.name);
    const entries = byName.get(name) || [];
    if (!entries.some(entry => entry.id === card.id)) entries.push(card);
    byName.set(name, entries);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const pattern = names.length ? new RegExp(names.map(regexEscape).join('|'), 'g') : null;
  // A renderer owns one catalog snapshot. Bound memory while reusing hover/zoom/search HTML.
  const renderCache = new Map();
  function fragment(text, currentId, query) {
    let prefix = '\uE000R';
    while (text.includes(prefix)) prefix += 'R';
    const replacements = [];
    const protectedText = pattern ? text.replace(pattern, (name, offset) => {
      const candidates = byName.get(name);
      const quoted = "'“‘「【《".includes(text[offset - 1] || '\0') &&
        "'”’」】》".includes(text[offset + name.length] || '\0');
      if (candidates.length !== 1 || String(candidates[0].id) === String(currentId) ||
          (!quoted && (name.length < 2 || termKeyFor(name) || ordinaryNames.has(name)))) return name;
      const card = candidates[0];
      const token = prefix + letterKey(replacements.length) + '\uE001';
      const link = '<button type="button" class="card-description-ref" data-act="libCardReference" data-photo-zoom-source data-card-reference="' +
        escAttr(card.id) + '" title="查看卡牌：' + escAttr(name) + '">' +
        highlightSearchText(name, query) + '</button>';
      replacements.push([token, link]);
      return token;
    }) : text;
    let html = descRich(protectedText);
    for (const [token, link] of replacements) html = html.split(token).join(link);
    return html;
  }
  return {
    getCard: id => byId.get(String(id)) || null,
    render(value, currentId, query = '') {
      const text = displayCardDescription(value, currentId, byId.get(String(currentId)));
      const queryText = query.trim();
      const needle = queryText.toLowerCase();
      const key = JSON.stringify([String(currentId), text, queryText]);
      if (renderCache.has(key)) return renderCache.get(key);
      const pieces = needle ? text.match(/[^。！？；;\n]+[。！？；;\n]*|[。！？；;\n]+/g) || [] : null;
      const html = pieces ? pieces.map(piece => {
        const html = fragment(piece, currentId, queryText);
        return piece.toLowerCase().includes(needle)
          ? '<span class="studio-search-sentence">' + html + '</span>' : html;
      }).join('') : fragment(text, currentId, '');
      if (renderCache.size >= 128) renderCache.delete(renderCache.keys().next().value);
      renderCache.set(key, html);
      return html;
    },
  };
}
