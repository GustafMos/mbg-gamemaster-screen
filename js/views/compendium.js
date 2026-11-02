/* Unified search / compendium — the fast, vague-friendly lookup */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, R = DM.render, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.compendium = V;

  const state = {
    kind: 'all',
    query: '',
    rarity: '',
    level: '',
    school: '',
    source: '',
    crMin: '',
    crMax: '',
    limit: 100
  };
  let rootEl = null, resultsEl = null, filterEl = null, tabsEl = null;

  const TABS = [
    ['all', 'Everything'],
    ['monster', 'Monsters'],
    ['item', 'Items'],
    ['spell', 'Spells'],
    ['rules', 'Rules & feats'],
    ['cos', 'Adventure'],
    ['tarokka', 'Tarokka'],
    ['homebrew', 'Homebrew']
  ];

  const KINDS = {
    all: null,
    monster: 'monster',
    item: 'item',
    spell: 'spell',
    rules: ['feat', 'condition', 'rule'],
    cos: ['area', 'chapter'],
    tarokka: ['tarokka'],
    homebrew: null
  };

  V.render = function (opts) {
    if (opts && opts.query !== undefined) state.query = opts.query;
    state.limit = 100;
    rootEl = el('div.view.compendium-view');

    const searchBox = el('div.comp-search');
    searchBox.appendChild(el('div.eyebrow', { text: 'Compendium' }));
    searchBox.appendChild(el('h1', { text: 'Search everything' }));
    searchBox.appendChild(el('p', { text: 'Vague is fine. Describe what you need — “fiery sword”, “undead boss”, “healing potion”, “K15” — and combine with filters. Drag monsters onto the initiative bar, or open an item to give it to a character.' }));
    const big = el('div.big-search', {}, [
      U.svg('search'),
      (() => {
        const inp = el('input', { type: 'search', id: 'compSearch', placeholder: 'Describe what you are looking for…', value: state.query, autocomplete: 'off', spellcheck: 'false' });
        inp.addEventListener('input', U.debounce(() => { state.query = inp.value; state.limit = 100; renderResults(); }, 130));
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            state.query = inp.value;
            state.limit = 100;
            const first = state.query.trim() ? getResults(state.query)[0] : null;
            if (first) { UI.openDoc(first.doc); return; }
            renderResults();
          }
          if (e.key === 'Escape') { inp.value = ''; state.query = ''; renderResults(); }
        });
        return inp;
      })(),
      el('kbd', { text: 'Enter' })
    ]);
    searchBox.appendChild(big);

    tabsEl = el('div.kind-tabs');
    TABS.forEach(([id, label]) => {
      const b = el('button.kind-tab' + (state.kind === id ? '.on' : ''), { text: label });
      b.addEventListener('click', () => {
        state.kind = id; state.limit = 100;
        U.$$('.kind-tab', tabsEl).forEach(x => x.classList.toggle('on', x === b));
        renderFilters();
        renderResults();
      });
      tabsEl.appendChild(b);
    });
    searchBox.appendChild(tabsEl);

    const suggest = el('div.suggest-line', {}, [el('span', { text: 'Try:' })]);
    ['healing potion', 'fire sword', 'undead boss', 'invisibility', 'raise dead', 'werewolf', 'Strahd', 'amber temple'].forEach(q => {
      const b = el('button.chip', { text: q });
      b.addEventListener('click', () => {
        state.query = q;
        const inp = document.getElementById('compSearch');
        if (inp) inp.value = q;
        renderResults();
      });
      suggest.appendChild(b);
    });
    searchBox.appendChild(suggest);
    rootEl.appendChild(searchBox);

    filterEl = el('div.toolbar', { id: 'compFilters' });
    rootEl.appendChild(filterEl);
    renderFilters();

    const panel = el('div.panel');
    const body = el('div.panel-body');
    resultsEl = el('div.search-results');
    body.appendChild(resultsEl);
    panel.appendChild(body);
    rootEl.appendChild(panel);

    setTimeout(() => {
      renderResults();
      const inp = document.getElementById('compSearch');
      if (opts && opts.focus && inp) inp.focus();
    }, 0);
    return rootEl;
  };

  function renderFilters() {
    if (!filterEl) return;
    filterEl.innerHTML = '';
    filterEl.appendChild(el('div.row', { style: { gap: '5px' } }, [
      U.svg('filter'),
      el('span.small.dim', { text: 'Filters' })
    ]));

    const add = (node) => filterEl.appendChild(node);
    const kind = state.kind;
    const show = (k) => kind === 'all' || kind === k;

    if (show('item')) {
      const sel = el('select', { style: { width: 'auto', padding: '5px 8px', fontSize: '11px' } });
      sel.appendChild(el('option', { value: '', text: 'Any rarity' }));
      U.RARITIES.forEach(r => sel.appendChild(el('option', { value: r, text: r.charAt(0).toUpperCase() + r.slice(1) })));
      sel.value = state.rarity;
      sel.addEventListener('change', () => { state.rarity = sel.value; renderResults(); });
      add(sel);
    }
    if (show('spell')) {
      const lv = el('select', { style: { width: 'auto', padding: '5px 8px', fontSize: '11px' } });
      lv.appendChild(el('option', { value: '', text: 'Any level' }));
      lv.appendChild(el('option', { value: '0', text: 'Cantrip' }));
      for (let i = 1; i <= 9; i++) lv.appendChild(el('option', { value: String(i), text: 'Level ' + i }));
      lv.value = state.level;
      lv.addEventListener('change', () => { state.level = lv.value; renderResults(); });
      add(lv);

      const sc = el('select', { style: { width: 'auto', padding: '5px 8px', fontSize: '11px' } });
      sc.appendChild(el('option', { value: '', text: 'Any school' }));
      U.SCHOOLS.forEach(s => sc.appendChild(el('option', { value: s.toLowerCase(), text: s })));
      sc.value = state.school;
      sc.addEventListener('change', () => { state.school = sc.value; renderResults(); });
      add(sc);
    }
    if (show('monster')) {
      const inp = el('input', { type: 'number', placeholder: 'CR min', value: state.crMin, step: '0.125', min: '0', style: { width: '78px', padding: '5px 6px', fontSize: '11px' } });
      inp.addEventListener('change', () => { state.crMin = inp.value; renderResults(); });
      add(inp);
      const inp2 = el('input', { type: 'number', placeholder: 'CR max', value: state.crMax, step: '0.125', min: '0', style: { width: '78px', padding: '5px 6px', fontSize: '11px' } });
      inp2.addEventListener('change', () => { state.crMax = inp2.value; renderResults(); });
      add(inp2);
    }

    const src = el('select', { style: { width: 'auto', padding: '5px 8px', fontSize: '11px' } });
    src.appendChild(el('option', { value: '', text: 'Any source' }));
    Array.from(new Set(DM.search.docs().map(d => d.f && d.f.source).filter(Boolean))).sort().forEach(s => {
      src.appendChild(el('option', { value: s, text: s }));
    });
    src.value = state.source;
    src.addEventListener('change', () => { state.source = src.value; renderResults(); });
    add(src);

    add(el('span.spacer'));
    const reset = el('button.link-btn.sm', { text: 'Clear' });
    reset.addEventListener('click', () => {
      Object.assign(state, { rarity: '', level: '', school: '', source: '', crMin: '', crMax: '' });
      renderFilters(); renderResults();
    });
    add(reset);
  }

  function getKindFilter() {
    const k = KINDS[state.kind];
    return Array.isArray(k) ? null : k;
  }

  function getResults(query) {
    const filters = {
      rarity: state.rarity || undefined,
      level: state.level === '' ? undefined : Number(state.level),
      school: state.school || undefined,
      source: state.source || undefined,
      crMin: state.crMin === '' ? undefined : U.crValue(state.crMin),
      crMax: state.crMax === '' ? undefined : U.crValue(state.crMax)
    };
    const k = KINDS[state.kind];
    if (Array.isArray(k)) filters.kinds = k;
    if (state.kind === 'homebrew') filters.homebrew = true;
    return DM.search.query(query, { kind: getKindFilter(), filters, limit: 2000, collapse: true });
  }

  function renderResults() {
    if (!resultsEl) return;
    const q = state.query.trim();
    const Q = DM.search.parseQuery(q);
    resultsEl.innerHTML = '';

    if (!q && state.kind === 'all' && !state.rarity && !state.source && state.level === '' && state.crMin === '' && !state.school) {
      renderLanding();
      return;
    }

    let results = getResults(q);
    if (state.kind === 'homebrew') results = results.filter(r => r.doc.f && r.doc.f.homebrew);
    const total = results.length;
    const shown = results.slice(0, state.limit);

    resultsEl.appendChild(el('div.row', { style: { padding: '4px 4px 8px', justifyContent: 'space-between' } }, [
      el('span.small.dim', { text: total.toLocaleString() + ' result' + (total === 1 ? '' : 's') + (q ? ' for “' + q + '”' : '') }),
      el('span.small.dim', { text: 'Click to open · drag to initiative' })
    ]));

    if (!total) {
      resultsEl.appendChild(el('div.empty', {}, [
        el('div.em-icon', { text: '🔍' }),
        el('h3', { text: 'Nothing found' }),
        el('p', { text: 'Try a vaguer description, fewer words, or clear a filter.' })
      ]));
      const sug = DM.search.suggestions(q, { kind: getKindFilter() });
      if (sug.length) {
        const row = el('div.row.wrap', { style: { justifyContent: 'center', gap: '5px' } }, [el('span.small.dim', { text: 'Did you mean:' })]);
        sug.forEach(s => { const b = el('button.chip', { text: s.name }); b.addEventListener('click', () => { state.query = s.name; const inp = document.getElementById('compSearch'); if (inp) inp.value = s.name; renderResults(); }); row.appendChild(b); });
        resultsEl.appendChild(row);
      }
      return;
    }

    shown.forEach(r => resultsEl.appendChild(resultRow(r, Q)));
    if (total > shown.length) {
      const b = el('button.btn.block', { text: 'Show more (' + (total - shown.length) + ' remaining)' });
      b.addEventListener('click', () => { state.limit += 150; renderResults(); });
      resultsEl.appendChild(b);
    }
  }

  function resultRow(r, Q) {
    const d = r.doc;
    const row = el('div.sr-row', { 'data-id': d.id });
    row.appendChild(el('div.result-glyph.' + glyphClass(d.kind), { text: glyph(d.kind) }));
    const bodyEl = el('div.sr-body');
    const title = el('div.sr-title', {}, [
      el('span', { html: DM.search.highlight(d.name, Q.tokens) }),
      el('span.tag', { text: DM.search.KIND_LABEL[d.kind] || d.kind }),
      d.f && d.f.homebrew ? el('span.tag.gold', { text: 'Homebrew' }) : (d.ref && d.ref.source ? el('span.tag', { text: d.ref.source }) : null),
      d.kind === 'item' && d.f && d.f.rarity && d.f.rarity !== 'mundane' ? el('span.tag.' + (U.RARITY_CLASS[d.f.rarity] || ''), { text: d.f.rarity }) : null,
      d.kind === 'monster' && d.meta ? el('span.tag', { text: 'CR ' + d.meta }) : null,
      d.kind === 'spell' && d.sub ? el('span.tag.blue', { text: d.sub.replace(' · ' + (d.sub.split(' · ')[1] || ''), '') }) : null
    ]);
    bodyEl.appendChild(title);
    bodyEl.appendChild(el('div.sr-snippet', { html: DM.search.highlight(r.snippet || d.sub || '', Q.tokens) }));
    if (d.sub && d.kind !== 'monster' && d.kind !== 'item') bodyEl.appendChild(el('div.sr-snippet', { style: { marginTop: '1px', opacity: '.7' }, text: d.sub }));
    row.appendChild(bodyEl);

    const actions = el('div.sr-actions');
    const starKind = ['monster', 'item', 'spell'].includes(d.kind) ? d.kind : null;
    if (starKind) {
      const id = d.name + '|' + (d.ref.source || '');
      const star = el('button.star-btn' + (S.isFav(starKind, id) ? '.on' : ''), { title: 'Favourite', html: '<svg><use href="#i-star"/></svg>' });
      star.addEventListener('click', (e) => { e.stopPropagation(); const on = S.toggleFav(starKind, { id, name: d.name, source: d.ref.source }); star.classList.toggle('on', on); });
      actions.appendChild(star);
    }
    if (d.kind === 'monster') {
      const add = el('button.star-btn', { title: 'Add to initiative', html: '<svg><use href="#i-swords"/></svg>' });
      add.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = DM.data.monster(d.ref.name, d.ref.source);
        if (m) { S.addMonsterCombatant(m, 1); UI.toast('Added <b>' + U.esc(m.name) + '</b> to initiative'); }
      });
      actions.appendChild(add);
    }
    if (d.kind === 'item') {
      const give = el('button.star-btn', { title: 'Give to a party member', html: '<svg><use href="#i-users"/></svg>' });
      give.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = DM.data.item(d.ref.name, d.ref.source);
        if (item) UI.giveItem(item);
      });
      actions.appendChild(give);
    }
    if (d.kind === 'spell') {
      const note = el('button.star-btn', { title: 'Copy to notes', html: '<svg><use href="#i-notes"/></svg>' });
      note.addEventListener('click', (e) => {
        e.stopPropagation();
        const sp = DM.data.spell(d.ref.name, d.ref.source);
        if (sp) DM.actions.spellToNote(sp);
      });
      actions.appendChild(note);
    }
    row.appendChild(actions);

    row.addEventListener('click', () => UI.openDoc(d));
    if (d.kind === 'monster') UI.draggable(row, () => ({ type: 'monster', name: d.ref.name, source: d.ref.source }));
    if (d.kind === 'item') UI.draggable(row, () => ({ type: 'item', name: d.ref.name, source: d.ref.source }));
    return row;
  }

  function renderLanding() {
    resultsEl.innerHTML = '';
    const recent = (S.state.recent || []).slice(0, 8);
    const favs = [];
    ['monster', 'item', 'spell'].forEach(k => (S.state.favorites[k] || []).slice(0, 4).forEach(f => favs.push({ kind: k, name: f.name, source: f.source })));

    const grid = el('div.dash-grid');
    const left = el('div.dash-col');
    const right = el('div.dash-col');

    const recentPanel = el('div.panel');
    recentPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Recently used' }), el('span.spacer'), el('span.small.dim', { text: 'Keeps the table moving' })]));
    const rb = el('div.panel-body');
    if (!recent.length) rb.appendChild(el('div.small.dim', { text: 'Monsters, items and spells you open will appear here.' }));
    else {
      const list = el('div.result-list');
      recent.forEach(r => {
        const row = el('div.result-row', {}, [
          el('div.result-glyph.' + glyphClass(r.kind), { text: glyph(r.kind) }),
          el('div.result-main', {}, [el('div.result-name', { text: r.name }), el('div.result-meta', { text: DM.search.KIND_LABEL[r.kind] + ' · ' + U.fmtRelative(r.ts) })])
        ]);
        row.addEventListener('click', () => {
          if (r.kind === 'monster') UI.openMonster(r.name);
          else if (r.kind === 'item') UI.openItem(r.name);
          else if (r.kind === 'spell') UI.openSpell(r.name);
        });
        list.appendChild(row);
      });
      rb.appendChild(list);
    }
    recentPanel.appendChild(rb);
    left.appendChild(recentPanel);

    const brewPanel = el('div.panel');
    brewPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Make it yours' })]));
    const bb = el('div.panel-body');
    bb.appendChild(el('p.small.muted', { text: 'Find the closest thing, clone it, then change the numbers. Homebrew lives here alongside the books and shows up in every search.' }));
    const brow = el('div.row.wrap', { style: { gap: '6px' } });
    [['Item', 'item'], ['Spell', 'spell'], ['Monster', 'monster']].forEach(([label, kind]) => {
      const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'New ' + label.toLowerCase() })]);
      b.addEventListener('click', () => DM.actions.newHomebrew(kind));
      brow.appendChild(b);
    });
    bb.appendChild(brow);
    const hb = el('div', { style: { marginTop: '12px' } });
    const counts = [['items', S.state.homebrew.items.length], ['spells', S.state.homebrew.spells.length], ['monsters', S.state.homebrew.monsters.length]];
    hb.appendChild(el('div.row.wrap', { style: { gap: '6px' } }, counts.map(([n, c]) => el('span.chip.static', { text: c + ' homebrew ' + n }))));
    bb.appendChild(hb);
    brewPanel.appendChild(bb);
    left.appendChild(brewPanel);

    const favPanel = el('div.panel');
    favPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Favourites' }), el('span.spacer'), el('button.link-btn.sm', { text: 'Bestiary', onclick: () => DM.navigate('bestiary') })]));
    const fb = el('div.panel-body');
    if (!favs.length) fb.appendChild(el('div.small.dim', { text: 'Star a monster, item or spell and it will be one click away.' }));
    else {
      const list = el('div.result-list');
      favs.forEach(f => {
        const row = el('div.result-row', {}, [
          el('div.result-glyph.' + glyphClass(f.kind), { text: glyph(f.kind) }),
          el('div.result-main', {}, [el('div.result-name', { text: f.name }), el('div.result-meta', { text: DM.search.KIND_LABEL[f.kind] })]),
          el('button.star-btn.on', { html: '<svg><use href="#i-star"/></svg>' })
        ]);
        row.addEventListener('click', () => {
          if (f.kind === 'monster') UI.openMonster(f.name, f.source);
          else if (f.kind === 'item') UI.openItem(f.name, f.source);
          else UI.openSpell(f.name, f.source);
        });
        list.appendChild(row);
      });
      fb.appendChild(list);
    }
    favPanel.appendChild(fb);
    right.appendChild(favPanel);

    const tip = el('div.tip-box', {}, [
      el('b', { text: 'Vague search tips. ' }),
      'Try “fiery greatsword”, “undead boss”, “potion that heals”, “spell to see invisible things”. Add ',
      el('code', { text: 'cr:5' }), ', ', el('code', { text: 'level:3' }), ' or ', el('code', { text: 'rarity:legendary' }), ' to narrow it down.'
    ]);
    right.appendChild(tip);

    grid.appendChild(left);
    grid.appendChild(right);
    resultsEl.appendChild(grid);
  }

  function glyph(kind) {
    return ({ monster: 'M', item: 'I', spell: 'S', feat: 'F', condition: 'C', rule: 'R', area: 'A', chapter: 'C', tarokka: 'T', note: 'N' })[kind] || '·';
  }
  function glyphClass(kind) {
    return ({ monster: 'monster', item: 'item', spell: 'spell', rule: 'rule', condition: 'rule', feat: 'rule', area: 'rule', chapter: 'rule', tarokka: 'item', note: 'rule' })[kind] || '';
  }

  V.focus = function () {
    const inp = document.getElementById('compSearch');
    if (inp) inp.focus();
  };

  DM.bus.on('state', () => {
    if (DM.currentView !== 'compendium') return;
    // Keep favourites/counts fresh without stealing focus.
    const active = document.activeElement;
    if (active && active.id === 'compSearch') return;
  });
})();
