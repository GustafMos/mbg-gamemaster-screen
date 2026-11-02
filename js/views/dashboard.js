/* DM dashboard — the at-a-glance screen */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, R = DM.render, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.dashboard = V;

  V.render = function () {
    const st = S.state;
    const enc = st.encounter;
    const root = el('div.view.dashboard-view');

    const avgLevel = st.players.length ? Math.round(st.players.reduce((a, p) => a + p.level, 0) / st.players.length * 10) / 10 : '—';
    const storyChapters = (DM.data.cos || []).filter(ch => /^Chapter/.test(ch.name));
    const chaptersDone = storyChapters.filter(ch => S.cosProgress(ch.id)).length;
    const nextChapter = (DM.data.cos || []).find(ch => /^Chapter/.test(ch.name) && !S.cosProgress(ch.id));

    // hero
    const hero = el('div.hero');
    const main = el('div.hero-main', {}, [
      el('div.eyebrow', { text: 'adventure · ' + (S.state.session.running ? 'Live session' : 'Prep') }),
      el('h1', { html: 'Welcome back to <em>Barovia</em>' }),
      el('p', { text: 'The mists are patient. Keep the table moving: drag combatants into initiative, search for anything, and keep the card reading close.' }),
      el('div.hero-actions', { style: { marginTop: '14px' } }, [
        (() => {
          const b = el('button.btn.primary', {}, [U.svg('swords'), el('span', { text: enc.combatants.length ? 'Back to initiative' : 'Start an encounter' })]);
          b.addEventListener('click', () => enc.combatants.length ? DM.navigate('initiative') : DM.navigate('encounters'));
          return b;
        })(),
        (() => { const b = el('button.btn', {}, [U.svg('search'), el('span', { text: 'Search everything' })]); b.addEventListener('click', () => UI.openPalette('')); return b; })(),
        (() => { const b = el('button.btn.gold', {}, [U.svg('sparkle'), el('span', { text: 'Draw tarokka' })]); b.addEventListener('click', () => DM.actions.drawTarokka()); return b; })()
      ])
    ]);
    const stats = el('div.hero-stats', {}, [
      statBox(st.players.length, 'Adventurers'),
      statBox(avgLevel, 'Avg. level'),
      statBox(enc.active ? 'R' + enc.round : '—', enc.active ? 'Round' : 'No fight'),
      statBox(chaptersDone + '/' + storyChapters.length, 'Chapters')
    ]);
    hero.appendChild(main);
    hero.appendChild(stats);
    root.appendChild(hero);

    const grid = el('div.dash-grid');
    const colA = el('div.dash-col');
    const colB = el('div.dash-col');

    // initiative / current turn
    const turnPanel = el('div.panel.turn-panel');
    const current = enc.active && enc.combatants[enc.turnIndex] ? enc.combatants[enc.turnIndex] : null;
    turnPanel.appendChild(el('div.panel-head', {}, [
      el('h3', { text: enc.combatants.length ? (enc.name || 'Encounter') : 'Initiative' }),
      el('span.spacer'),
      el('span.small.dim', { text: enc.active ? 'Round ' + enc.round : (enc.combatants.length ? 'Not started' : 'Empty') }),
      (() => { const b = el('button.link-btn.sm', { text: 'Open' }); b.addEventListener('click', () => DM.navigate('initiative')); return b; })()
    ]));
    if (!enc.combatants.length) {
      turnPanel.appendChild(el('div.panel-body', {}, [
        el('div.small.dim', { style: { marginBottom: '10px' }, text: 'No combatants. Search a monster or drag a party member onto the initiative bar.' }),
        (() => { const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'Build an encounter' })]); b.addEventListener('click', () => DM.navigate('encounters')); return b; })()
      ]));
    } else {
      turnPanel.appendChild(el('div.turn-now', {}, [
        el('div.label', { text: current ? 'Current turn' : 'Ready' }),
        el('b', { text: current ? current.name : 'Roll initiative' }),
        current ? el('div.init', { text: 'Initiative ' + current.init + ' · ' + S.effectiveCombatant(current).hp + '/' + S.effectiveCombatant(current).maxHp + ' hp' }) : el('div.small.dim', { style: { marginTop: '4px' }, text: 'Next turn starts the round.' }),
        el('div.row', { style: { justifyContent: 'center', gap: '5px', marginTop: '9px' } }, [
          (() => { const b = el('button.btn.xs', { text: 'Prev' }); b.addEventListener('click', () => { S.nextTurn(-1); V.refresh(); }); return b; })(),
          (() => { const b = el('button.btn.primary.xs', {}, [el('span', { text: 'Next turn' }), U.svg('chevron')]); b.addEventListener('click', () => { S.nextTurn(1); V.refresh(); }); return b; })()
        ])
      ]));
      const tl = el('div.turn-list');
      enc.combatants.slice(0, 12).forEach((c, i) => {
        const eff = S.effectiveCombatant(c);
        const row = el('div.turn-row' + (enc.active && i === enc.turnIndex ? '.active' : '') + (eff.hp <= 0 ? '.done' : ''), {}, [
          el('span.init', { text: String(c.init) }),
          el('span.nm', { text: c.name }),
          el('span.hpnum', { text: eff.hp + '/' + eff.maxHp })
        ]);
        row.addEventListener('click', () => { DM.navigate('initiative'); setTimeout(() => DM.views.initiative.openCombatant(c.id), 80); });
        tl.appendChild(row);
      });
      turnPanel.appendChild(tl);
    }
    colA.appendChild(turnPanel);

    // party
    const partyPanel = el('div.panel');
    partyPanel.appendChild(el('div.panel-head', {}, [
      el('h3', { text: 'The party' }),
      el('span.spacer'),
      (() => { const b = el('button.link-btn.sm', { text: 'Manage' }); b.addEventListener('click', () => DM.navigate('party')); return b; })()
    ]));
    const pb = el('div.panel-body');
    if (!st.players.length) {
      pb.appendChild(el('div.small.dim', { style: { marginBottom: '10px' }, text: 'Add your players to track HP, conditions, slots and inventory.' }));
      pb.appendChild((() => { const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'Add characters' })]); b.addEventListener('click', () => DM.navigate('party')); return b; })());
    } else {
      const list = el('div.party-mini');
      st.players.forEach(p => {
        const pct = p.maxHp ? Math.max(0, Math.min(100, p.hp / p.maxHp * 100)) : 0;
        const row = el('div.mini-pc', {}, [
          (() => { const a = el('div.avatar', { text: p.emoji || U.initials(p.name) }); a.style.background = 'linear-gradient(150deg, ' + p.color + ', #1a1524)'; return a; })(),
          el('div.mini-pc-main', {}, [
            el('div.mini-pc-name', {}, [p.name, p.conditions.length ? el('span.tag.purple', { text: p.conditions[0] + (p.conditions.length > 1 ? ' +' + (p.conditions.length - 1) : '') }) : null]),
            el('div.mini-pc-sub', { text: [p.className, 'Level ' + p.level, 'AC ' + p.ac].filter(Boolean).join(' · ') })
          ]),
          el('div.mini-pc-hp', {}, [
            el('div.hp-num', {}, [String(p.hp), el('small', { text: '/' + p.maxHp })]),
            (() => { const b = el('div.hp-bar' + (pct <= 0 ? '.crit' : pct <= 33 ? '.low' : '')); b.appendChild(el('i', { style: { width: pct + '%' } })); return b; })()
          ])
        ]);
        row.addEventListener('click', () => { DM.navigate('party'); setTimeout(() => DM.views.party.openCharacter(p.id), 80); });
        list.appendChild(row);
      });
      pb.appendChild(list);
    }
    partyPanel.appendChild(pb);
    colA.appendChild(partyPanel);

    // DM cheat sheet
    const cheat = el('div.panel');
    cheat.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Rules at a glance' }), el('span.spacer'), el('span.small.dim', { text: 'hover a condition' })]));
    const cb2 = el('div.panel-body');
    cb2.appendChild(el('div.label', { text: 'Ability check DCs', style: { marginBottom: '6px' } }));
    cb2.appendChild(el('div.row.wrap', { style: { gap: '5px', marginBottom: '12px' } }, [
      ['Very easy', 5], ['Easy', 10], ['Medium', 15], ['Hard', 20], ['Very hard', 25], ['Nearly impossible', 30]
    ].map(([label, dc]) => el('span.chip.static', { title: label, text: dc + ' · ' + label }))));
    cb2.appendChild(el('div.label', { text: 'Conditions', style: { marginBottom: '6px' } }));
    cb2.appendChild(el('div.row.wrap', { style: { gap: '4px' } }, U.CONDITIONS.map(c => el('span.cond-pill', { title: c.desc, text: c.name }))));
    cb2.appendChild(el('div.tip-box', { style: { marginTop: '10px' }, html: '<b>Exhaustion.</b> 1: disadvantage on checks · 2: speed halved · 3: disadvantage on attacks & saves · 4: HP maximum halved · 5: speed 0 · 6: death.' }));
    cheat.appendChild(cb2);
    colA.appendChild(cheat);

    // quick actions
    const quickPanel = el('div.panel');
    quickPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Quick actions' })]));
    const qb = el('div.panel-body');
    const qg = el('div.quick-grid');
    [['d20', 'Roll d20', () => UI.roll('1d20')],
     ['moon', 'Long rest', () => DM.actions.longRest()],
     ['skull', 'Random encounter', () => DM.actions.randomEncounter()],
     ['notes', 'New note', () => DM.actions.newNote()]]
      .forEach(([icon, label, fn]) => {
        const b = el('button.quick-tile', {}, [U.svg(icon), el('strong', { text: label })]);
        b.addEventListener('click', fn);
        qg.appendChild(b);
      });
    qb.appendChild(qg);
    quickPanel.appendChild(qb);
    colB.appendChild(quickPanel);

    // chapter progress
    const chPanel = el('div.panel');
    chPanel.appendChild(el('div.panel-head', {}, [
      el('h3', { text: 'Campaign progress' }),
      el('span.spacer'),
      el('span.small.dim', { text: chaptersDone + ' complete' })
    ]));
    const cb = el('div.panel-body');
    const cp = el('div.chapter-progress');
    (DM.data.cos || []).filter(ch => /^Chapter/.test(ch.name)).slice(0, 8).forEach(ch => {
      const done = S.cosProgress(ch.id);
      const row = el('div.cp-row' + (done ? '.done' : ''), {}, [
        el('span.cp-dot'),
        el('span.cp-name', { text: ch.name.replace(/^Chapter \d+:\s*/, '') }),
        el('span.tiny-text.dim', { text: ch.name.match(/^Chapter (\d+)/) ? ch.name.match(/^Chapter (\d+)/)[1] : '' })
      ]);
      row.addEventListener('click', () => { DM.navigate('cos'); setTimeout(() => DM.views.cos.jump(ch.id), 60); });
      cp.appendChild(row);
    });
    cb.appendChild(cp);
    if (nextChapter) {
      cb.appendChild(el('div.row', { style: { marginTop: '10px', gap: '6px', flexWrap: 'wrap' } }, [
        el('span.small.dim', { text: 'Next up:' }),
        el('span.small', { text: nextChapter.name.replace(/^Chapter \d+:\s*/, '') }),
        el('span.spacer'),
        (() => { const b = el('button.btn.xs', { text: 'Open' }); b.addEventListener('click', () => { DM.navigate('cos'); setTimeout(() => DM.views.cos.jump(nextChapter.id), 60); }); return b; })()
      ]));
    }
    chPanel.appendChild(cb);
    colB.appendChild(chPanel);

    // notes
    const notePanel = el('div.panel');
    notePanel.appendChild(el('div.panel-head', {}, [
      el('h3', { text: 'Pinned notes' }),
      el('span.spacer'),
      (() => { const b = el('button.link-btn.sm', { text: 'All notes' }); b.addEventListener('click', () => DM.navigate('notes')); return b; })()
    ]));
    const nb = el('div.panel-body');
    const noteRank = (n) => /^Current State/i.test(n.title) ? 0 : /^The Story So Far/i.test(n.title) ? 1 : /^Session 5/i.test(n.title) ? 2 : 3;
    const pinned = st.notes.filter(n => n.pinned).slice().sort((a, b) => noteRank(a) - noteRank(b) || (b.updated || 0) - (a.updated || 0)).slice(0, 4);
    if (!pinned.length) nb.appendChild(el('div.small.dim', { text: 'Pin a note to keep it on the screen.' }));
    else {
      pinned.forEach(n => {
        const row = el('div.mini-pc', { style: { padding: '7px 4px' } }, [
          el('div', { style: { flex: '1', minWidth: '0' } }, [
            el('div', { style: { fontSize: '12.5px', fontWeight: '600' }, text: n.title }),
            el('div.small.dim', { text: (n.body || '').replace(/[#*_>`]/g, '').slice(0, 90) || 'Empty note' })
          ]),
          el('span.tiny-text.dim', { text: U.fmtRelative(n.updated) })
        ]);
        row.addEventListener('click', () => { DM.navigate('notes'); setTimeout(() => DM.views.notes.open(n.id), 60); });
        nb.appendChild(row);
      });
    }
    notePanel.appendChild(nb);
    colB.appendChild(notePanel);

    const tip = el('div.tip-box', { html: '<b>At the table.</b> Use <kbd>Ctrl</kbd>+<kbd>K</kbd> for anything. Drag results onto the initiative bar. Press <kbd>N</kbd> for the next turn. Click any gold reference in a statblock to open it.' });
    colB.appendChild(tip);

    grid.appendChild(colA);
    grid.appendChild(colB);
    root.appendChild(grid);
    return root;
  };

  function statBox(value, label) {
    return el('div.hero-stat', {}, [el('b', { text: String(value) }), el('span', { text: label })]);
  }

  V.refresh = function () {
    if (DM.currentView !== 'dashboard') return;
    const main = document.getElementById('main');
    const scroll = main.scrollTop;
    const fresh = V.render();
    main.innerHTML = '';
    main.appendChild(fresh);
    main.scrollTop = scroll;
  };

  DM.bus.on('state', () => {
    if (DM.currentView !== 'dashboard') return;
    if (DM.ui.isDrawerOpen()) return;
    V.refresh();
  });

  DM.bus.on('drawer-closed', () => {
    if (DM.currentView === 'dashboard') V.refresh();
  });
})();
