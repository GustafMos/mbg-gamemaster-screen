/* Unified fuzzy search across all bundled 5e content and campaign data */
(function () {
  'use strict';
  const U = DM.U, R = DM.render, F = U.fuzzy;
  const Search = {};
  DM.search = Search;

  let docs = [];
  let byId = new Map();
  let built = false;
  let building = false;
  let dirty = true;
  let version = 0;

  Search.KIND_LABEL = {
    monster: 'Monster', item: 'Item', spell: 'Spell', feat: 'Feat',
    condition: 'Condition', rule: 'Rule', area: 'Area', chapter: 'Chapter',
    tarokka: 'Tarokka', note: 'Note', homebrew: 'Homebrew'
  };

  function makeDoc(kind, name, sub, text, ref, extra) {
    const nameNorm = F.normalize(name);
    const textNorm = F.normalize(text || '');
    const nameTokens = new Set(F.contentTokens(name));
    const hayTokens = new Set(F.contentTokens(name + ' ' + (sub || '') + ' ' + (text || '')));
    const id = (extra && extra.id) || (kind + '|' + nameNorm + '|' + F.normalize((extra && extra.source) || ''));
    return Object.assign({
      id, kind, name, nameNorm, sub: sub || '', text: text || '', textNorm,
      nameTokens, hayTokens, trigrams: F.trigrams(name),
      ref: ref || null, f: {}, source: (extra && extra.source) || '', meta: (extra && extra.meta) || ''
    }, extra || {});
  }

  function build() {
    const t0 = performance.now();
    const next = [];
    const add = (d) => { if (d && d.name) next.push(d); };

    // Monsters
    DM.data.monsters.forEach(m => {
      const type = m.type && typeof m.type === 'object' ? m.type.type : (m.type || '');
      const tags = m.type && m.type.tags ? ', ' + m.type.tags.join(', ') : '';
      const summary = plain(m.trait) + ' ' + plain(m.action) + ' ' + plain(m.legendary) + ' ' + plain(m.spellcasting);
      add(makeDoc('monster', m.name,
        [U.crText(m.cr) ? 'CR ' + U.crText(m.cr) : '', type + tags, m.size ? (U.SIZES[m.size[0]] || '') : ''].filter(Boolean).join(' · '),
        (type + tags + ' ' + (m.alignment || []).join(' ') + ' ' + summary).slice(0, 1600),
        { name: m.name, source: m.source },
        { source: m.source, meta: U.crText(m.cr), f: { cr: U.crValue(m.cr), type: type.toLowerCase(), size: (m.size || [])[0], source: m.source, rarity: null } }));
    });

    // Items (magic + mundane)
    DM.data.items.forEach(it => add(itemDoc(it, false)));
    DM.data.bases.forEach(it => add(itemDoc(it, true)));

    // Spells
    DM.data.spells.forEach(sp => {
      const school = (sp.school || '').toLowerCase();
      const level = Number(sp.level) || 0;
      const text = [R.summary(sp.entries), R.summary(sp.entriesHigherLevel), (sp.damageInflict || []).join(' '), (sp.savingThrow || []).join(' ')].join(' ');
      add(makeDoc('spell', sp.name, (level === 0 ? 'Cantrip' : 'Level ' + level) + ' · ' + cap(school) + (sp.ritual ? ' · Ritual' : ''),
        text.slice(0, 1400),
        { name: sp.name, source: sp.source },
        { source: sp.source, meta: String(level), f: { level, school, source: sp.source, concentration: !!sp.concentration, ritual: !!sp.ritual } }));
    });

    // Feats / conditions / rules
    (DM.data.rules.feats || []).forEach(ft => {
      add(makeDoc('feat', ft.name, 'Feat · ' + (ft.source || ''), (R.summary(ft.prerequisite) + ' ' + R.summary(ft.entries)).slice(0, 1200), { name: ft.name, source: ft.source }, { source: ft.source, f: { source: ft.source } }));
    });
    (DM.data.rules.conditions || []).forEach(c => {
      add(makeDoc('condition', c.name, 'Condition', R.summary(c.entries).slice(0, 900), { name: c.name }, { f: {} }));
    });
    (DM.data.rules.actions || []).forEach(a => {
      add(makeDoc('rule', a.name, 'Rule · ' + (a.source || ''), R.summary(a.entries).slice(0, 900), { name: a.name }, { source: a.source, f: { source: a.source } }));
    });
    (DM.data.rules.diseases || []).forEach(c => {
      add(makeDoc('rule', c.name, 'Disease', R.summary(c.entries).slice(0, 700), { name: c.name }, { f: {} }));
    });

    // Tarokka cards
    (DM.data.tarokka.cards || []).forEach(card => {
      const suit = card.suit ? card.suit + ' · ' + card.value : 'High Deck';
      add(makeDoc('tarokka', card.name, suit, R.summary(card.entries).slice(0, 500), { name: card.name, suit: card.suit, value: card.value }, { f: {} }));
    });

    // adventure chapters + areas
    (DM.data.cos || []).forEach(ch => {
      const chText = plain(ch.entries).slice(0, 2500);
      add(makeDoc('chapter', ch.name, 'Adventure' + (ch.page ? ' · p. ' + ch.page : ''), chText,
        { chapterId: ch.id, anchor: '' }, { source: 'CoS', f: { source: 'CoS' }, id: 'chapter|' + ch.id }));
      // Walk named sections / areas for the location index
      const seen = new Set();
      walkEntries(ch.entries, (node) => {
        if (!node.name || typeof node.name !== 'string') return;
        const nm = node.name.trim();
        if (!nm || nm.length > 90) return;
        const isArea = /^[A-Z]{0,2}\d+[a-z]?\b/.test(nm) || /^(area|room|crypt|tomb)\b/i.test(nm) || !!(node.id && (node.type === 'section' || node.type === 'entries'));
        if (!isArea) return;
        const key = F.normalize(nm);
        if (seen.has(key + (node.id || ''))) return;
        seen.add(key + (node.id || ''));
        const summary = plain(node.entries || node.entry || '').slice(0, 700);
        let sub = ch.name.replace(/^Chapter \d+: /, '');
        if (node.name.match(/^[A-Z]{1,2}\d+[a-z]?$/)) sub += ' · Area ' + node.name;
        add(makeDoc('area', nm, sub, summary,
          { chapterId: ch.id, anchor: node.id || '', sectionName: nm },
          { id: 'area|' + ch.id + '|' + (node.id || key), source: 'CoS', f: { source: 'CoS' } }));
      });
    });

    // Homebrew
    const st = DM.store.state;
    (st.homebrew.items || []).forEach(it => add(itemDoc(it, false, true)));
    (st.homebrew.monsters || []).forEach(m => {
      add(makeDoc('monster', m.name, 'Homebrew · CR ' + U.crText(m.cr), plain(m.trait) + ' ' + plain(m.action),
        { name: m.name, source: m.source || 'HB' }, { id: 'hb|monster|' + m.id, source: m.source || 'HB', f: { cr: U.crValue(m.cr), type: (m.type && m.type.type) || '', size: (m.size || [])[0], homebrew: true } }));
    });
    (st.homebrew.spells || []).forEach(sp => {
      add(makeDoc('spell', sp.name, 'Homebrew · ' + (Number(sp.level) === 0 ? 'Cantrip' : 'Level ' + sp.level), R.summary(sp.entries),
        { name: sp.name, source: sp.source || 'HB' }, { id: 'hb|spell|' + sp.id, source: sp.source || 'HB', f: { level: Number(sp.level) || 0, school: sp.school || '', homebrew: true } }));
    });

    // Notes
    (st.notes || []).forEach(n => {
      add(makeDoc('note', n.title || 'Untitled note', 'Note · ' + (n.category || 'Campaign') + (n.pinned ? ' · pinned' : ''),
        ((n.category || '') + ' ' + (n.tags || []).join(' ') + ' ' + (n.body || '')).slice(0, 4000),
        { noteId: n.id }, { id: 'note|' + n.id, f: {} }));
    });

    docs = next;
    byId = new Map(docs.map(d => [d.id, d]));
    built = true;
    dirty = false;
    version++;
    console.info('Search index built: ' + docs.length + ' docs in ' + Math.round(performance.now() - t0) + 'ms');
  }

  function itemDoc(it, isBase, homebrew) {
    const base = it.baseItem ? DM.data.baseItem(it.baseItem) : null;
    const typeLabel = R.itemTypeLabel(it, base);
    let rarity = it.rarity && it.rarity !== 'none' ? String(it.rarity) : (isBase ? 'mundane' : '');
    if (rarity === 'unknown') rarity = '';
    const text = [R.summary(it.entries), R.summary(it.additionalEntries), base ? R.summary(base.entries) : '', (it.dmg1 || '') + ' ' + (it.dmgType || ''), it.requiresText || ''].join(' ');
    return makeDoc('item', it.name,
      [rarity, typeLabel, it.reqAttune ? 'attunement' : ''].filter(Boolean).join(' · '),
      text.slice(0, 1200),
      { name: it.name, source: it.source },
      {
        id: (homebrew ? 'hb|item|' + it.id : 'item|' + F.normalize(it.name) + '|' + (it.source || '')),
        source: it.source || (homebrew ? 'HB' : ''),
        meta: rarity,
        f: { rarity: rarity.toLowerCase(), itemType: (it.type || (base && base.type) || '').toUpperCase(), source: it.source, homebrew: !!homebrew, variantBase: it.baseItem ? String(it.baseItem).split('|')[0] : '' }
      });
  }

  function walkEntries(node, cb) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(n => walkEntries(n, cb)); return; }
    if (typeof node !== 'object') return;
    cb(node);
    for (const k of ['entries', 'wrappeds', 'items', 'rows']) {
      if (node[k]) walkEntries(node[k], cb);
    }
  }

  function plain(node) {
    try { return R.summary(node); } catch (e) { return ''; }
  }
  function plainText(s) {
    return String(s || '').replace(/[#*_>`]/g, ' ').replace(/\s+/g, ' ');
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  Search.init = function (force) {
    if (building) return;
    if (built && !force) return;
    building = true;
    build();
    building = false;
    DM.bus.emit('search-ready');
  };
  Search.rebuildSoon = U.debounce(() => { Search.init(true); DM.bus.emit('search-rebuilt'); }, 400);
  Search.isReady = () => built;
  Search.docs = () => { if (!built) Search.init(); return docs; };
  Search.doc = (id) => byId.get(id);

  // ---------------------------------------------------------------- query
  function parseQuery(raw) {
    const q = { raw: String(raw || ''), tokens: [], phrase: '', filters: {} };
    let text = String(raw || '').trim();
    // explicit filters
    text = text.replace(/\b(cr|level|lvl|rarity|source|type|size|school|kind):("[^"]+"|[^\s]+)/gi, (m, key, val) => {
      key = key.toLowerCase(); val = val.replace(/^"|"$/g, '').toLowerCase();
      if (key === 'lvl') key = 'level';
      if (key === 'cr' && /^\d+(\.\d+)?-\d+(\.\d+)?$/.test(val)) {
        const [a, b] = val.split('-').map(Number);
        q.filters.crMin = a; q.filters.crMax = b;
      } else if (key === 'cr') {
        q.filters.crMin = q.filters.crMax = U.crValue(val);
        if (val === '0') q.filters.crMin = q.filters.crMax = 0;
      } else if (key === 'level') {
        if (/^\d+-\d+$/.test(val)) { const [a, b] = val.split('-').map(Number); q.filters.levelMin = a; q.filters.levelMax = b; }
        else q.filters.level = Number(val);
      } else if (key === 'rarity') q.filters.rarity = val;
      else if (key === 'source') q.filters.source = val;
      else if (key === 'type') q.filters.type = val;
      else if (key === 'size') q.filters.size = val;
      else if (key === 'school') q.filters.school = val;
      else if (key === 'kind') q.kind = val;
      return ' ';
    });
    // quoted phrases
    text = text.replace(/"([^"]+)"/g, (m, inner) => { q.phrase = F.normalize(inner); return ' ' + inner + ' '; });
    q.tokens = F.contentTokens(text).filter(t => t.length > 0);
    q.phrase = q.phrase || '';
    if (!q.phrase && q.tokens.length) q.phrase = F.normalize(text);
    q.trigrams = F.trigrams(text);
    q.kindHint = detectKindHint(q.tokens);
    return q;
  }
  Search.parseQuery = parseQuery;

  const KIND_WORDS = {
    monster: ['monster', 'creature', 'statblock', 'bestiary', 'npc', 'enemy', 'boss', 'villain', 'encounter'],
    item: ['item', 'magic', 'weapon', 'armor', 'potion', 'wondrous', 'loot', 'equipment', 'sword', 'blade', 'shield', 'wand', 'ring', 'scroll', 'cloak', 'boots', 'helm', 'bag', 'rope', 'staff', 'rod'],
    spell: ['spell', 'cantrip'],
    feat: ['feat'],
    rule: ['rule', 'condition', 'action', 'hazard'],
    area: ['area', 'location', 'room', 'chapter', 'barovia']
  };
  function detectKindHint(tokens) {
    for (const k in KIND_WORDS) {
      if (KIND_WORDS[k].some(w => tokens.includes(w))) return k;
    }
    return null;
  }

  function matchesFilters(d, f) {
    if (!f) return true;
    const x = d.f || {};
    if (f.crMin !== undefined && f.crMin !== null && !(d.kind === 'monster' || d.kind === 'homebrew') ) return false;
    if (f.crMin !== undefined && f.crMin !== null) { if (x.cr == null || x.cr < f.crMin) return false; }
    if (f.crMax !== undefined && f.crMax !== null) { if (x.cr == null || x.cr > f.crMax) return false; }
    if (f.level !== undefined && f.level !== null) { if (x.level !== f.level) return false; }
    if (f.levelMin !== undefined && (x.level == null || x.level < f.levelMin)) return false;
    if (f.levelMax !== undefined && (x.level == null || x.level > f.levelMax)) return false;
    if (f.rarity && f.rarity.length) {
      const rar = (x.rarity || '').toLowerCase();
      if (rar !== f.rarity.toLowerCase()) return false;
    }
    if (f.school && f.school.length) { if ((x.school || '') !== f.school) return false; }
    if (f.source && f.source.length) { if ((x.source || '').toLowerCase() !== f.source) return false; }
    if (f.type && f.type.length) { if (!(x.type || '').includes(f.type)) return false; }
    if (f.size && f.size.length) { if ((x.size || '') !== f.size) return false; }
    if (f.kinds && f.kinds.length) { if (!f.kinds.includes(d.kind)) return false; }
    if (f.rarities && f.rarities.length) { if (!f.rarities.includes((x.rarity || '').toLowerCase())) return false; }
    if (f.types && f.types.length) { if (!f.types.includes(x.type)) return false; }
    if (f.sources && f.sources.length) { if (!f.sources.includes(x.source)) return false; }
    if (f.schools && f.schools.length) { if (!f.schools.includes(x.school)) return false; }
    return true;
  }
  Search.matchesFilters = matchesFilters;

  Search.query = function (raw, opts) {
    opts = opts || {};
    if (!built) Search.init();
    const q = parseQuery(raw);
    const filters = Object.assign({}, q.filters, opts.filters || {});
    const kind = opts.kind || q.kind || null;
    const kindHint = kind || q.kindHint;
    const limit = opts.limit || 60;
    const boost = opts.boost || DM.store.boostMap();
    const loose = !!opts.loose;
    let out = [];

    if (!q.tokens.length) {
      // no text: return a sensible browse list
      out = docs.filter(d => matchesFilters(d, filters) && (!kind || d.kind === kind));
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out.slice(0, limit).map(d => ({ doc: d, score: 0, matched: [], snippet: snippetFor(d, []) }));
    }

    for (const d of docs) {
      if (kind && d.kind !== kind) continue;
      if (!matchesFilters(d, filters)) continue;
      const r = F.scoreDoc(d, q, { kind: kindHint, boost });
      if (r === -1) { if (!loose) continue; }
      let score = r === -1 ? 0 : r.score;
      if (r === -1 && loose) {
        // partial: count matching tokens
        let c = 0;
        for (const t of q.tokens) if (d.hayTokens.has(t) || d.nameNorm.includes(t)) c++;
        if (!c) continue;
        score = c * 40;
      }
      if (kindHint && d.kind === kindHint) score += 60;
      // For generated base-item variants (Flame Tongue (Longsword) etc.),
      // make the longsword version the representative result in vague searches.
      if (d.f && d.f.variantBase) score += d.f.variantBase === 'Longsword' ? 14 : -4;
      if (score > 0) out.push({ doc: d, score, matched: r.matched || [] });
    }

    if (!out.length && !loose) {
      return Search.query(raw, Object.assign({}, opts, { loose: true }));
    }

    out.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));
    if (opts.collapse) out = collapseVariants(out, q.tokens);
    // If kind not explicitly chosen, avoid burying the most likely kind under many body matches.
    return out.slice(0, limit).map(x => Object.assign({}, x, { snippet: snippetFor(x.doc, q.tokens) }));
  };

  const BASE_WORDS = ['longsword', 'greatsword', 'shortsword', 'rapier', 'scimitar', 'longbow', 'shortbow', 'dagger', 'axe', 'battleaxe', 'greataxe', 'mace', 'spear', 'hammer', 'warhammer', 'glaive', 'halberd', 'flail', 'whip', 'club', 'staff', 'quarterstaff'];
  function collapseVariants(results, tokens) {
    if (tokens && tokens.some(t => BASE_WORDS.includes(t))) return results;
    const seen = new Set();
    return results.filter(r => {
      const name = r.doc.name;
      if (!r.doc.f || !r.doc.f.variantBase) return true;
      const root = name.replace(/\s*\([^)]*\)\s*$/, '');
      if (seen.has(root)) return false;
      seen.add(root);
      return true;
    });
  }
  Search.collapseVariants = collapseVariants;

  function snippetFor(doc, tokens) {
    if (doc.kind === 'item' || doc.kind === 'spell' || doc.kind === 'monster') {
      const text = doc.text || '';
      return clip(text, 180);
    }
    return clip(doc.text || '', 170);
  }
  function clip(text, n) {
    if (!text) return '';
    let s = text.replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    return s.slice(0, n).replace(/\s+\S*$/, '') + '…';
  }
  Search.clip = clip;

  Search.highlight = function (text, tokens) {
    if (!tokens || !tokens.length) return U.esc(text || '');
    let out = U.esc(String(text || ''));
    const uniq = Array.from(new Set(tokens.filter(t => t.length > 2))).slice(0, 6);
    if (!uniq.length) return out;
    const re = new RegExp('(' + uniq.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return out.replace(re, '<mark>$1</mark>');
  };

  // Helpers used by views
  Search.suggestions = function (raw, opts) {
    const q = parseQuery(raw);
    if (!q.tokens.length) return [];
    // Collect candidate names whose trigrams resemble the query, for "did you mean".
    const scored = [];
    for (const d of docs) {
      if (opts && opts.kind && d.kind !== opts.kind) continue;
      const sim = F.diceSimilarity(d.trigrams, q.trigrams);
      if (sim > 0.42) scored.push({ name: d.name, sim, kind: d.kind });
    }
    scored.sort((a, b) => b.sim - a.sim);
    const seen = new Set();
    return scored.filter(s => { const k = s.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
  };

  Search.byKind = function (kind) {
    if (!built) Search.init();
    return docs.filter(d => d.kind === kind);
  };

  Search.facets = function (kind) {
    if (!built) Search.init();
    const out = { sources: new Map(), rarities: new Map(), types: new Map(), schools: new Map(), sizes: new Map() };
    docs.forEach(d => {
      if (kind && kind !== 'all' && d.kind !== kind) return;
      const inc = (map, v) => { if (!v) return; map.set(v, (map.get(v) || 0) + 1); };
      inc(out.sources, (d.f && d.f.source) || d.source);
      inc(out.rarities, (d.f && d.f.rarity) || (d.meta && d.kind === 'item' ? d.meta : ''));
      inc(out.types, d.f && d.f.type);
      inc(out.schools, d.f && d.f.school);
      inc(out.sizes, d.f && d.f.size);
    });
    return out;
  };

  // warm the index after the first paint; rebuild when notes/homebrew change
  let lastSig = '';
  DM.bus.on('state', () => {
    if (!built) return;
    const st = DM.store.state;
    const sig = (st.notes || []).map(n => n.id + ':' + n.updated + ':' + n.title).join('|') + '#' +
      ['items', 'spells', 'monsters'].map(k => (st.homebrew[k] || []).map(x => x.id || x.name).join(',')).join('|');
    if (sig !== lastSig) { lastSig = sig; Search.rebuildSoon(); }
  });
  Search.rebuildSoon();
})();
