/* Bestiary browser */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, R = DM.render, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.bestiary = V;

  const TYPES = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
  const state = {
    query: '',
    crMin: '',
    crMax: '',
    types: [],
    sizes: [],
    sources: [],
    favOnly: false,
    sort: 'relevance',
    limit: 80
  };
  let viewEl = null, listEl = null, countEl = null;

  V.render = function (opts) {
    if (opts && opts.query !== undefined) state.query = opts.query;
    const sources = Array.from(new Set(DM.data.monsters.map(m => m.source))).sort();
    viewEl = el('div.view.bestiary-view');

    viewEl.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Bestiary' }),
        el('h1', { text: 'Monsters & NPCs' }),
        el('p', { text: DM.data.monsters.length.toLocaleString() + ' statblocks from the core books, adventure and Van Richten’s Guide. Drag a result onto the initiative bar.' })
      ]),
      el('div.head-actions', {}, [
        (() => {
          const b = el('button.btn.sm', {}, [U.svg('sparkle'), el('span', { text: 'Surprise me' })]);
          b.addEventListener('click', () => {
            const pool = DM.data.monsters.filter(m => U.crValue(m.cr) >= 0.125 && U.crValue(m.cr) <= 10);
            const m = U.pick(pool);
            if (m) UI.openMonster(m.name, m.source);
          });
          return b;
        })(),
        (() => {
          const b = el('button.btn.primary.sm', {}, [U.svg('plus'), el('span', { text: 'Add combatant' })]);
          b.addEventListener('click', () => DM.views.initiative.addDialog());
          return b;
        })()
      ])
    ]));

    const layout = el('div.browse-layout');

    // filters
    const side = el('aside.panel.filters');
    side.appendChild(el('div.filter-group', {}, [
      el('label.label', { text: 'Search' }),
      el('div.search-field', {}, [
        U.svg('search'),
        (() => {
          const inp = el('input', { type: 'search', placeholder: 'vague is fine — “undead boss”', value: state.query, id: 'bestiarySearch' });
          inp.addEventListener('input', U.debounce(() => { state.query = inp.value; state.limit = 80; renderResults(); }, 140));
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              state.query = inp.value;
              state.limit = 80;
              renderResults();
              const first = getMonsters()[0];
              if (first) UI.openMonster(first.m.name, first.m.source);
            }
          });
          return inp;
        })()
      ])
    ]));

    side.appendChild(el('div.filter-group', {}, [
      el('label.label', { text: 'Challenge rating' }),
      el('div.range-row', {}, [
        (() => { const i = el('input', { type: 'number', placeholder: 'min', value: state.crMin, step: '0.125', min: '0', max: '30' }); i.addEventListener('change', () => { state.crMin = i.value; state.limit = 80; renderResults(); }); return i; })(),
        el('span.range-sep', { text: 'to' }),
        (() => { const i = el('input', { type: 'number', placeholder: 'max', value: state.crMax, step: '0.125', min: '0', max: '30' }); i.addEventListener('change', () => { state.crMax = i.value; state.limit = 80; renderResults(); }); return i; })()
      ])
    ]));

    const typeGroup = el('div.filter-group', {}, [el('label.label', { text: 'Creature type' })]);
    const typeList = el('div.filter-list');
    TYPES.forEach(t => {
      const on = state.types.includes(t);
      const c = el('button.chip' + (on ? '.on' : ''), { text: t.charAt(0).toUpperCase() + t.slice(1) });
      c.addEventListener('click', () => { toggle(state.types, t); c.classList.toggle('on'); state.limit = 80; renderResults(); });
      typeList.appendChild(c);
    });
    typeGroup.appendChild(typeList);
    side.appendChild(typeGroup);

    side.appendChild(el('div.filter-group', {}, [
      el('label.label', { text: 'Size' }),
      (() => {
        const row = el('div.filter-list');
        ['T', 'S', 'M', 'L', 'H', 'G'].forEach(sz => {
          const on = state.sizes.includes(sz);
          const c = el('button.chip' + (on ? '.on' : ''), { text: U.SIZES[sz] });
          c.addEventListener('click', () => { toggle(state.sizes, sz); c.classList.toggle('on'); state.limit = 80; renderResults(); });
          row.appendChild(c);
        });
        return row;
      })()
    ]));

    side.appendChild(el('div.filter-group', {}, [
      el('label.label', { text: 'Source' }),
      (() => {
        const list = el('div.filter-list.one-col');
        sources.forEach(src => {
          const on = state.sources.includes(src);
          const row = el('label.check-row', {}, [
            (() => { const i = el('input', { type: 'checkbox', checked: on }); i.addEventListener('change', () => { toggle(state.sources, src); state.limit = 80; renderResults(); }); return i; })(),
            el('span', { text: src + ' — ' + DM.data.sourceLabel(src) })
          ]);
          list.appendChild(row);
        });
        return list;
      })()
    ]));

    side.appendChild(el('div.filter-group', {}, [
      (() => {
        const b = el('button.chip' + (state.favOnly ? '.on' : ''), { text: '★ Favourites only' });
        b.addEventListener('click', () => { state.favOnly = !state.favOnly; b.classList.toggle('on'); state.limit = 80; renderResults(); });
        return b;
      })(),
      el('span.spacer'),
      (() => {
        const b = el('button.link-btn.sm', { text: 'Reset filters' });
        b.addEventListener('click', () => {
          Object.assign(state, { query: '', crMin: '', crMax: '', types: [], sizes: [], sources: [], favOnly: false, limit: 80 });
          V.render();
        });
        return b;
      })()
    ]));
    layout.appendChild(side);

    // results
    const resultsPanel = el('div.panel');
    resultsPanel.appendChild(el('div.toolbar', {}, [
      el('div.row', { style: { gap: '6px' } }, [
        el('span.result-count', { id: 'bestiaryCount' }),
        (() => { const s = el('span.dim', { text: '·' }); return s; })(),
        el('div.row', { style: { gap: '4px' } }, [
          (() => {
            const sel = el('select', { style: { width: 'auto', padding: '4px 8px', fontSize: '11px' } }, [
              el('option', { value: 'relevance', text: 'Best match' }),
              el('option', { value: 'name', text: 'Name A–Z' }),
              el('option', { value: 'cr', text: 'Challenge rating' })
            ]);
            sel.value = state.sort;
            sel.addEventListener('change', () => { state.sort = sel.value; renderResults(); });
            return sel;
          })()
        ])
      ]),
      el('span.spacer'),
      el('span.small.dim', { text: 'Drag to initiative ↓' })
    ]));
    const body = el('div.panel-body');
    listEl = el('div.result-list');
    countEl = document.getElementById('bestiaryCount');
    body.appendChild(listEl);
    resultsPanel.appendChild(body);
    layout.appendChild(resultsPanel);
    viewEl.appendChild(layout);

    setTimeout(renderResults, 0);
    return viewEl;
  };

  function toggle(arr, v) {
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
  }

  function filtersForSearch() {
    return {
      crMin: state.crMin === '' ? undefined : U.crValue(state.crMin),
      crMax: state.crMax === '' ? undefined : U.crValue(state.crMax),
      types: state.types.length ? state.types : undefined,
      sizes: state.sizes.length ? state.sizes : undefined,
      sources: state.sources.length ? state.sources : undefined
    };
  }

  function getMonsters() {
    let results;
    if (!state.query.trim() && !state.types.length && !state.sizes.length && !state.sources.length && state.crMin === '' && state.crMax === '' && !state.favOnly) {
      results = DM.search.query('', { kind: 'monster', limit: 2000 });
    } else {
      results = DM.search.query(state.query, { kind: 'monster', filters: filtersForSearch(), limit: 2000 });
    }
    let list = results.map(r => ({ m: DM.data.monster(r.doc.ref.name, r.doc.ref.source), score: r.score || 0 })).filter(x => x.m);
    if (state.favOnly) list = list.filter(x => S.isFav('monster', x.m.name + '|' + x.m.source));
    if (state.sort === 'name') list.sort((a, b) => a.m.name.localeCompare(b.m.name));
    else if (state.sort === 'cr') list.sort((a, b) => U.crValue(a.m.cr) - U.crValue(b.m.cr) || a.m.name.localeCompare(b.m.name));
    // dedupe by name+source
    const seen = new Set();
    return list.filter(x => { const k = x.m.name + '|' + x.m.source; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  function renderResults() {
    if (!listEl) return;
    const all = getMonsters();
    const shown = all.slice(0, state.limit);
    const countEl2 = document.getElementById('bestiaryCount');
    if (countEl2) countEl2.textContent = all.length.toLocaleString() + ' statblock' + (all.length === 1 ? '' : 's');
    listEl.innerHTML = '';
    if (!all.length) {
      listEl.appendChild(el('div.empty', {}, [
        el('div.em-icon', { text: '🔍' }),
        el('h3', { text: 'No monsters match' }),
        el('p', { text: 'Try loosening the filters, or search for a concept like “fire”, “boss” or “undead”.' })
      ]));
      return;
    }
    shown.forEach(({ m }) => listEl.appendChild(monsterRow(m)));
    if (all.length > shown.length) {
      const more = el('button.btn.block', { text: 'Show ' + Math.min(120, all.length - shown.length) + ' more of ' + (all.length - shown.length) });
      more.addEventListener('click', () => { state.limit += 120; renderResults(); });
      listEl.appendChild(more);
    }
  }

  function monsterRow(m) {
    const fav = S.isFav('monster', m.name + '|' + m.source);
    const row = el('div.result-row', { 'data-name': m.name });
    row.appendChild(el('div.result-glyph.monster', { text: U.crText(m.cr) === '—' ? '?' : U.crText(m.cr) }));
    row.appendChild(el('div.result-main', {}, [
      el('div.result-name', {}, [m.name, m.source === 'CoS' ? el('span.tag.accent', { text: 'CoS' }) : null]),
      el('div.result-meta', { text: R.monsterMeta(m) + ' · ' + (m.environment && m.environment.length ? m.environment.slice(0, 3).join(', ') : DM.data.sourceLabel(m.source)) })
    ]));
    row.appendChild(el('div.result-tags', {}, [
      el('span.tag', { text: m.source }),
      (m.hp && m.hp.average) ? el('span.tag', { text: m.hp.average + ' hp' }) : null
    ]));
    const actions = el('div.result-actions');
    const star = el('button.star-btn' + (fav ? '.on' : ''), { title: 'Favourite', html: '<svg><use href="#i-star"/></svg>' });
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = S.toggleFav('monster', { id: m.name + '|' + m.source, name: m.name, source: m.source });
      star.classList.toggle('on', on);
    });
    actions.appendChild(star);
    const addEnc = el('button.star-btn', { title: 'Add to encounter builder', html: '<svg><use href="#i-target"/></svg>' });
    addEnc.addEventListener('click', (e) => { e.stopPropagation(); DM.actions.addToEncounter(m); });
    actions.appendChild(addEnc);
    const addInit = el('button.star-btn', { title: 'Add to initiative', html: '<svg><use href="#i-swords"/></svg>' });
    addInit.addEventListener('click', (e) => { e.stopPropagation(); S.addMonsterCombatant(m, 1); UI.toast('Added <b>' + U.esc(m.name) + '</b> to initiative'); });
    actions.appendChild(addInit);
    row.appendChild(actions);
    row.addEventListener('click', () => UI.openMonster(m.name, m.source));
    UI.draggable(row, () => ({ type: 'monster', name: m.name, source: m.source }));
    return row;
  }

  V.refresh = function () { if (DM.currentView === 'bestiary') V.render(); };
})();
