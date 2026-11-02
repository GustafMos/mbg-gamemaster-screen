/* Encounter builder with adventure random encounters */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, R = DM.render, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.encounters = V;

  // Draft persists while the app is open.
  const draft = { name: 'A dark road', monsters: [] };
  let rootEl = null;

  // Barovian random encounters, weighted by party tier.
  const TABLE = [
    { name: 'Dire Wolf', qty: [2, 4], tier: 1, note: 'A pack of gaunt wolves pads out of the fog.' },
    { name: 'Wolf', qty: [2, 6], tier: 1, note: 'Yellow eyes ring the road; the wolves are starving.' },
    { name: 'Zombie', qty: [3, 6], tier: 1, note: 'The dead of Barovia rise, still wearing their funeral clothes.' },
    { name: 'Skeleton', qty: [3, 6], tier: 1, note: 'Bones clatter in the mist — an old patrol that never went home.' },
    { name: 'Swarm of Bats', qty: [2, 4], tier: 1, note: 'The night sky tears open into a storm of leathery wings.' },
    { name: 'Ghoul', qty: [2, 4], tier: 1, note: 'Hunched shapes gnaw at something in the ditch.' },
    { name: 'Scarecrow', qty: [1, 3], tier: 1, note: 'The fields are empty, but the scarecrows have turned to watch you.' },
    { name: 'Twig Blight', qty: [3, 6], tier: 1, note: 'The undergrowth itself comes alive, thorny and hungry.' },
    { name: 'Bandit', qty: [3, 5], tier: 1, note: 'Vistani bandits demand a toll — or everything you carry.' },
    { name: 'Wight', qty: [1, 1], tier: 2, note: 'A dead knight in rusted plate raises a blade and points at you.' },
    { name: 'Werewolf', qty: [1, 2], tier: 2, note: 'Something large runs on two legs between the trees.' },
    { name: 'Wraith', qty: [1, 2], tier: 2, note: 'A cold absence of light drifts toward you, whispering names.' },
    { name: 'Night Hag', qty: [1, 1], tier: 2, note: 'A hunched figure offers you a dream pastry, smiling too wide.' },
    { name: 'Vampire Spawn', qty: [1, 2], tier: 2, note: 'Pale figures step from the treeline, moving far too fast.' },
    { name: 'Revenant', qty: [1, 1], tier: 2, note: 'A revenant bars the road, burning with an old oath.' },
    { name: 'Flesh Golem', qty: [1, 1], tier: 2, note: 'Stitched flesh lurches from the abbey ruins.' },
    { name: 'Shambling Mound', qty: [1, 1], tier: 2, note: 'The bog stands up and walks.' },
    { name: 'Roc', qty: [1, 1], tier: 3, note: 'A shadow passes over the valley — something ancient has woken.' },
    { name: 'Baba Lysaga', qty: [1, 1], tier: 3, note: 'The swamp witch comes calling, hut and all.' },
    { name: 'Strahd von Zarovich', qty: [1, 1], tier: 3, note: 'The air goes still. He is here — and he is merely amused.' }
  ];

  V.render = function () {
    rootEl = el('div.view.encounters-view');
    const avgLevel = partyLevels().length ? Math.round(partyLevels().reduce((a, b) => a + b, 0) / partyLevels().length) : 3;

    rootEl.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Encounter builder' }),
        el('h1', { text: 'Set the stage' }),
        el('p', { text: 'Build an encounter, check the maths against the party, then send it to initiative with one click. Drag monsters in from Search or the Bestiary.' })
      ]),
      el('div.head-actions', {}, [
        (() => {
          const b = el('button.btn.sm', {}, [U.svg('sparkle'), el('span', { text: 'Random Barovian encounter' })]);
          b.addEventListener('click', () => randomEncounter());
          return b;
        })(),
        (() => {
          const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'Add monsters' })]);
          b.addEventListener('click', picker);
          return b;
        })(),
        (() => {
          const b = el('button.btn.primary', {}, [U.svg('swords'), el('span', { text: 'Run encounter' })]);
          b.addEventListener('click', runEncounter);
          return b;
        })()
      ])
    ]));

    const layout = el('div.enc-layout');
    const left = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

    // draft
    const panel = el('div.panel');
    const head = el('div.panel-head', {}, [
      (() => {
        const inp = el('input', { type: 'text', value: draft.name, placeholder: 'Encounter name', style: { background: 'transparent', border: '0', fontFamily: 'var(--serif)', fontSize: '15px', fontWeight: '700', padding: '0' } });
        inp.addEventListener('change', () => { draft.name = inp.value; });
        return inp;
      })(),
      el('span.spacer'),
      el('span.small.dim', { text: draft.monsters.reduce((a, b) => a + b.qty, 0) + ' creatures' })
    ]);
    panel.appendChild(head);
    const body = el('div.panel-body');
    const drop = el('div.enc-drop', { 'data-drop': 'encounter' });
    UI.dropzone(drop, (payload) => {
      if (payload.type === 'monster') { addMonster(payload.name, payload.source, 1); }
    });
    if (!draft.monsters.length) {
      drop.appendChild(el('div.enc-empty', {}, [
        el('div', { style: { fontSize: '22px', marginBottom: '6px' }, text: '＋' }),
        el('div', { text: 'Drop monsters here, or use “Add monsters”.' }),
        el('div.small.dim', { style: { marginTop: '4px' }, text: 'Search is fuzzy: try “undead boss” or “cr:5”.' })
      ]));
    } else {
      draft.monsters.forEach((entry, idx) => drop.appendChild(draftRow(entry, idx)));
    }
    body.appendChild(drop);
    panel.appendChild(body);
    left.appendChild(panel);

    // templates
    const tplPanel = el('div.panel');
    tplPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Saved encounters' }), el('span.spacer'), el('span.small.dim', { text: S.state.templates.length + ' saved' })]));
    const tb = el('div.panel-body');
    if (!S.state.templates.length) tb.appendChild(el('div.small.dim', { text: 'Save a draft to reuse it later — e.g. “Strahd’s dinner”, “Amber Temple guardians”.' }));
    else {
      const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      S.state.templates.slice().reverse().forEach(t => {
        const count = (t.monsters || []).reduce((a, b) => a + (b.qty || 1), 0);
        const row = el('div.enc-row', {}, [
          el('div', { style: { flex: '1' } }, [
            el('div.nm', { text: t.name }),
            el('div.small.dim', { text: count + ' creatures · ' + U.fmtRelative(t.created) })
          ]),
          (() => { const b = el('button.btn.xs', { text: 'Load' }); b.addEventListener('click', () => loadTemplate(t)); return b; })(),
          (() => { const b = el('button.hp-btn', { title: 'Delete', html: '<svg style="width:12px;height:12px"><use href="#i-trash"/></svg>' }); b.addEventListener('click', async () => { if (await UI.confirm({ title: 'Delete template?', message: t.name, confirm: 'Delete', danger: true })) { S.update(s => s.templates = s.templates.filter(x => x.id !== t.id)); V.refresh(); } }); return b; })()
        ]);
        list.appendChild(row);
      });
      tb.appendChild(list);
    }
    tplPanel.appendChild(tb);
    left.appendChild(tplPanel);
    layout.appendChild(left);

    // right: maths
    const right = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    const math = U.encounterMath(draft.monsters.map(m => ({ cr: m.cr, qty: m.qty })), partyLevels().length ? partyLevels() : [3, 3, 3, 3]);
    const mathPanel = el('div.panel');
    mathPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Difficulty' }), el('span.spacer'), el('span.small.dim', { text: partyLevels().length ? partyLevels().length + ' PCs · avg lvl ' + avgLevel : 'Assumes 4 PCs · lvl 3' })]));
    const mb = el('div.panel-body');
    mb.appendChild(el('div.diff-verdict.' + math.verdict, { text: math.count ? math.verdict.charAt(0).toUpperCase() + math.verdict.slice(1) : 'Empty' }));
    mb.appendChild(el('div.small.dim', { style: { marginBottom: '10px' }, text: math.count ? (math.count + ' creatures · multiplier ×' + math.multiplier) : 'Add monsters to see the maths.' }));
    mb.appendChild(el('div.diff-labels', {}, [el('span', { text: 'easy' }), el('span', { text: 'medium' }), el('span', { text: 'hard' }), el('span', { text: 'deadly' })]));
    const meter = el('div.diff-meter');
    const totalW = math.thresholds[3] * 1.15 || 1;
    meter.appendChild(el('i', { style: { width: Math.min(100, math.thresholds[0] / totalW * 100) + '%', background: '#3d7a56' } }));
    meter.appendChild(el('i', { style: { width: Math.min(100, (math.thresholds[1] - math.thresholds[0]) / totalW * 100) + '%', background: '#7a7a3d' } }));
    meter.appendChild(el('i', { style: { width: Math.min(100, (math.thresholds[2] - math.thresholds[1]) / totalW * 100) + '%', background: '#a8713a' } }));
    meter.appendChild(el('i', { style: { width: Math.min(100, (math.thresholds[3] - math.thresholds[2]) / totalW * 100) + '%', background: '#8e2b35' } }));
    mb.appendChild(meter);
    const marker = el('div', { style: { position: 'relative', height: '12px' } });
    marker.appendChild(el('div', { style: { position: 'absolute', left: Math.min(98, math.adjusted / totalW * 100) + '%', top: '1px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ink)', boxShadow: '0 0 8px #fff', transform: 'translateX(-50%)' } }));
    mb.appendChild(marker);
    mb.appendChild(el('div', { style: { marginTop: '10px' } }, [
      el('div.xp-line', {}, [el('span', { text: 'Monster XP' }), el('b', { text: math.rawXp.toLocaleString() })]),
      el('div.xp-line', {}, [el('span', { text: 'Adjusted XP' }), el('b', { text: math.adjusted.toLocaleString() })]),
      el('div.xp-line', {}, [el('span', { text: 'Easy / medium' }), el('b', { text: math.thresholds[0].toLocaleString() + ' / ' + math.thresholds[1].toLocaleString() })]),
      el('div.xp-line', {}, [el('span', { text: 'Hard / deadly' }), el('b', { text: math.thresholds[2].toLocaleString() + ' / ' + math.thresholds[3].toLocaleString() })])
    ]));
    mathPanel.appendChild(mb);
    right.appendChild(mathPanel);

    // party levels
    const pp = el('div.panel');
    pp.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Party' }), el('span.spacer'), el('button.link-btn.sm', { text: 'Edit party', onclick: () => DM.navigate('party') })]));
    const pb = el('div.panel-body');
    const levels = partyLevels();
    if (!levels.length) pb.appendChild(el('div.small.dim', { text: 'No party added. The maths assumes four level 3 characters. Add characters in the Party tab for accurate thresholds.' }));
    else pb.appendChild(el('div.row.wrap', { style: { gap: '5px' } }, S.state.players.map(p => el('span.chip.static', { text: p.name + ' · ' + p.level }))));
    pp.appendChild(pb);
    right.appendChild(pp);

    // save / start
    const actions = el('div.panel');
    const ab = el('div.panel-body', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
      (() => { const b = el('button.btn.primary.block', {}, [U.svg('swords'), el('span', { text: 'Run this encounter' })]); b.addEventListener('click', runEncounter); return b; })(),
      (() => { const b = el('button.btn.block', {}, [U.svg('download'), el('span', { text: 'Save as template' })]); b.addEventListener('click', saveTemplate); return b; })(),
      (() => { const b = el('button.btn.ghost.block', {}, [U.svg('trash'), el('span', { text: 'Clear draft' })]); b.addEventListener('click', () => { draft.monsters = []; V.refresh(); }); return b; })()
    ]);
    actions.appendChild(ab);
    right.appendChild(actions);

    layout.appendChild(right);
    rootEl.appendChild(layout);
    return rootEl;
  };

  function partyLevels() {
    return S.state.players.map(p => p.level);
  }

  function draftRow(entry, idx) {
    const row = el('div.enc-row');
    row.appendChild(el('div.result-glyph.monster', { text: U.crText(entry.cr) }));
    row.appendChild(el('div', { style: { flex: '1', minWidth: '0' } }, [
      el('div.nm', { text: entry.name }),
      el('div.small.dim', { text: 'CR ' + U.crText(entry.cr) + ' · ' + (U.crToXp(entry.cr) * entry.qty).toLocaleString() + ' XP · ' + (entry.source || 'Custom') })
    ]));
    const qty = el('div.qty', {}, [
      (() => { const b = el('button.qty-btn', { text: '−' }); b.addEventListener('click', () => { entry.qty = Math.max(1, entry.qty - 1); V.refresh(); }); return b; })(),
      el('span.mono', { text: '×' + entry.qty, style: { minWidth: '22px', textAlign: 'center', fontSize: '12px' } }),
      (() => { const b = el('button.qty-btn', { text: '+' }); b.addEventListener('click', () => { entry.qty += 1; V.refresh(); }); return b; })()
    ]);
    row.appendChild(qty);
    const open = el('button.hp-btn', { title: 'View statblock', html: '<svg style="width:13px;height:13px"><use href="#i-book"/></svg>' });
    open.addEventListener('click', () => { const m = DM.data.monster(entry.name, entry.source); if (m) UI.openMonster(m.name, m.source); });
    row.appendChild(open);
    const del = el('button.hp-btn', { title: 'Remove', html: '<svg style="width:12px;height:12px"><use href="#i-trash"/></svg>' });
    del.addEventListener('click', () => { draft.monsters.splice(idx, 1); V.refresh(); });
    row.appendChild(del);
    const m = DM.data.monster(entry.name, entry.source);
    if (m) UI.draggable(row, () => ({ type: 'monster', name: m.name, source: m.source }));
    return row;
  }

  function addMonster(name, source, qty) {
    const m = DM.data.monster(name, source);
    if (!m) return;
    const existing = draft.monsters.find(x => x.name === m.name && x.source === m.source);
    if (existing) existing.qty += qty;
    else draft.monsters.push({ name: m.name, source: m.source, cr: m.cr, qty });
    V.refresh();
  }
  V.addMonster = addMonster;

  function picker() {
    const body = el('div');
    const qty = el('input', { type: 'number', value: '1', min: '1', max: '30', style: { width: '64px' } });
    const search = el('input', { type: 'search', placeholder: 'Search monsters… “undead”, “wolf”, “cr:5”' });
    const results = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '340px', overflowY: 'auto', marginTop: '8px' } });
    body.appendChild(el('div.row', { style: { gap: '8px' } }, [
      el('div.search-field', { style: { flex: '1' } }, [U.svg('search'), search]),
      el('div.field', { style: { width: '70px' } }, [el('label.label', { text: 'Qty' }), qty])
    ]));
    body.appendChild(results);
    body.appendChild(el('div.small.dim', { style: { marginTop: '6px' }, text: 'Click a monster to add it. Keep the window open to add more.' }));

    const curated = ['Dire Wolf', 'Werewolf', 'Vampire Spawn', 'Zombie', 'Skeleton', 'Ghoul', 'Wraith', 'Strahd von Zarovich'];
    function paint() {
      results.innerHTML = '';
      const q = search.value.trim();
      let list;
      if (!q) list = curated.map(n => DM.data.monster(n)).filter(Boolean);
      else list = DM.search.query(q, { kind: 'monster', limit: 30 }).map(r => DM.data.monster(r.doc.ref.name, r.doc.ref.source)).filter(Boolean);
      if (!list.length) { results.innerHTML = '<div class="pal-empty">No matches.</div>'; return; }
      list.forEach(m => {
        const row = el('div.result-row', {}, [
          el('div.result-glyph.monster', { text: U.crText(m.cr) }),
          el('div.result-main', {}, [
            el('div.result-name', {}, [m.name, el('span.tag', { text: 'CR ' + U.crText(m.cr) })]),
            el('div.result-meta', { text: R.monsterMeta(m) + ' · ' + m.source })
          ]),
          el('button.btn.xs.primary', { text: 'Add' })
        ]);
        row.addEventListener('click', () => {
          const n = Math.max(1, U.num(qty.value, 1));
          addMonster(m.name, m.source, n);
          UI.toast('Added <b>' + n + '× ' + U.esc(m.name) + '</b> to the encounter');
        });
        results.appendChild(row);
      });
    }
    search.addEventListener('input', U.debounce(paint, 110));
    paint();
    UI.modal({ title: 'Add monsters', body, buttons: [{ label: 'Done', cls: 'primary', onClick: () => { UI.closeModal(); V.refresh(); } }] });
  }

  function saveTemplate() {
    if (!draft.monsters.length) { UI.toast('Add some monsters first.'); return; }
    UI.prompt({ title: 'Save encounter template', label: 'Name', value: draft.name, confirm: 'Save' }).then(name => {
      if (name === null) return;
      S.saveTemplate(name, draft.monsters.map(m => ({ monsterName: m.name, source: m.source, cr: m.cr, qty: m.qty })));
      draft.name = name;
      V.refresh();
      UI.toast('Saved <b>' + U.esc(name) + '</b>');
    });
  }

  function loadTemplate(t) {
    draft.name = t.name;
    draft.monsters = (t.monsters || []).map(m => {
      const mon = DM.data.monster(m.monsterName, m.source);
      return { name: m.monsterName, source: m.source, cr: mon ? mon.cr : m.cr, qty: m.qty || 1 };
    });
    V.refresh();
    UI.toast('Loaded <b>' + U.esc(t.name) + '</b>');
  }

  async function runEncounter() {
    if (!draft.monsters.length) { UI.toast('Add monsters before running the encounter.'); return; }
    const list = draft.monsters.map(m => ({ monster: DM.data.monster(m.name, m.source), qty: m.qty })).filter(x => x.monster);
    if (!list.length) return;
    if (S.state.players.length) {
      const ok = await UI.confirm({
        title: 'Start encounter?',
        message: 'This replaces the current initiative tracker with “' + draft.name + '” and adds the whole party. You can remove anyone who is not involved.',
        confirm: 'Start'
      });
      if (!ok) return;
    }
    S.startEncounterFrom(draft.name, list, { includeParty: true });
    DM.navigate('initiative');
    UI.toast('⚔ <b>' + U.esc(draft.name) + '</b> — roll initiative!');
  }

  function randomEncounter() {
    const levels = partyLevels();
    const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
    const tier = avg <= 4 ? 1 : avg <= 9 ? 2 : 3;
    const pool = TABLE.filter(t => t.tier <= tier);
    const picks = [];
    const notes = [];
    const count = avg <= 4 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const t = U.pick(pool);
      if (picks.some(p => p.t === t)) continue;
      const qty = t.qty[0] + Math.floor(Math.random() * (t.qty[1] - t.qty[0] + 1));
      const m = DM.data.monster(t.name);
      if (!m) continue;
      picks.push({ t, qty });
      notes.push(t.note);
    }
    if (!picks.length) return;
    draft.name = 'Barovian encounter';
    draft.monsters = picks.map(({ t, qty }) => ({ name: t.name, source: (DM.data.monster(t.name) || {}).source, cr: (DM.data.monster(t.name) || {}).cr, qty }));
    V.refresh();
    UI.modal({
      title: 'An encounter on the road',
      body: '<div class="readaloud">' + U.esc(notes.slice(0, 2).join(' ')) + '</div><p class="small muted">“' + U.esc(notes[0] || '') + '”</p>' +
        '<div class="row wrap" style="gap:5px">' + draft.monsters.map(m => '<span class="chip">' + U.esc(m.qty + '× ' + m.name) + '</span>').join('') + '</div>',
      buttons: [
        { label: 'Reroll', cls: 'ghost', onClick: () => { UI.closeModal(); randomEncounter(); } },
        { label: 'Add to draft', cls: 'primary', onClick: () => UI.closeModal() }
      ]
    });
  }

  V.refresh = function () {
    if (DM.currentView !== 'encounters' || !rootEl) return;
    const scroll = document.getElementById('main').scrollTop;
    const old = rootEl;
    const fresh = V.render();
    if (old.isConnected) old.replaceWith(fresh); else document.getElementById('main').appendChild(fresh);
    rootEl = fresh;
    document.getElementById('main').scrollTop = scroll;
  };
  V.random = randomEncounter;
})();
