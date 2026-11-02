/* Initiative tracker + combatant runner */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui, R = DM.render;
  const V = {};
  DM.views = DM.views || {};
  DM.views.initiative = V;

  let rootEl = null;

  V.render = function () {
    const enc = S.state.encounter;
    const players = S.state.players;
    rootEl = el('div.view.initiative-view');

    const head = el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: enc.active ? 'Round ' + enc.round : 'Not started' }),
        el('h1', {}, [
          enc.name || 'Encounter',
          el('span.dim', { style: { fontSize: '13px', fontFamily: 'var(--sans)', marginLeft: '10px', fontWeight: '400' }, text: enc.combatants.length ? enc.combatants.length + ' combatants' : '' })
        ]),
        el('p', { text: 'Drag monsters here from Search or the Bestiary, drag rows to reorder. Click a combatant to open quick controls and its statblock.' })
      ]),
      el('div.head-actions', {}, [
        btn('Roll all', 'dice', () => { S.rollAllInitiative(); UI.toast('Initiative rolled for everyone'); }, 'btn sm'),
        btn('Save template', 'download', () => saveTemplate(), 'btn sm'),
        btn('Add combatant', 'plus', () => addDialog(), 'btn primary'),
        btn('', 'trash', () => clearEncounter(), 'btn ghost sm', 'Clear')
      ])
    ]);
    rootEl.appendChild(head);

    const layout = el('div.init-layout');
    const left = el('div.panel');
    left.appendChild(el('div.panel-head', {}, [
      el('h3', { text: enc.active ? 'Turn order' : 'Combatants' }),
      el('span.spacer'),
      el('div.row', { style: { gap: '4px' } }, [
        (() => { const b = btn('', 'chevron', () => S.nextTurn(-1), 'dock-btn', 'Previous turn'); b.style.transform = 'rotate(180deg)'; return b; })(),
        btn('Next turn', 'chevron', () => S.nextTurn(1), 'dock-btn next')
      ])
    ]));
    const listWrap = el('div.panel-body');
    if (!enc.combatants.length) {
      listWrap.appendChild(el('div.enc-empty', {}, [
        el('div', { style: { fontSize: '22px', marginBottom: '6px' }, text: '⚔' }),
        el('div', { text: 'No combatants yet.' }),
        el('div.small.dim', { style: { marginTop: '4px' }, text: 'Drop a monster from search, or use “Add combatant”.' })
      ]));
    } else {
      const list = el('div.init-list');
      enc.combatants.forEach((c, idx) => list.appendChild(combatantRow(c, idx)));
      listWrap.appendChild(list);
    }
    left.appendChild(listWrap);
    UI.dropzone(left, (payload) => {
      if (payload.type === 'monster') {
        const m = DM.data.monster(payload.name, payload.source);
        if (m) { S.addMonsterCombatant(m, 1); UI.toast('🎲 <b>' + U.esc(m.name) + '</b> rolled into initiative'); refresh(); }
      } else if (payload.type === 'player') {
        const c = S.addPlayerCombatant(payload.playerId);
        if (c) { UI.toast('🎲 <b>' + U.esc(payload.name) + '</b> rolled into initiative'); refresh(); }
        else UI.toast(U.esc(payload.name) + ' is already in initiative');
      }
    });
    layout.appendChild(left);

    layout.appendChild(sidePanel());
    rootEl.appendChild(layout);
    return rootEl;
  };

  function btn(label, icon, onclick, cls, title) {
    const b = el('button.' + (cls || 'btn').replace(/ /g, '.'), { title: title || label || '' });
    if (icon) b.appendChild(U.svg(icon));
    if (label) b.appendChild(el('span', { text: label }));
    b.addEventListener('click', onclick);
    return b;
  }

  function combatantRow(c, idx) {
    const eff = S.effectiveCombatant(c);
    const active = S.state.encounter.active && idx === S.state.encounter.turnIndex;
    const pct = eff.maxHp ? Math.max(0, Math.min(100, (eff.hp / eff.maxHp) * 100)) : 0;
    const row = el('div.combatant' + (active ? '.active' : '') + (eff.hp <= 0 ? '.down' : ''), { 'data-cmb': c.id });
    row.appendChild(el('div.drag-handle', { title: 'Drag to reorder' }, [U.svg('grip')]));
    const initBtn = el('button.init-badge', { title: 'Set initiative', text: String(c.init) });
    initBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = await UI.prompt({ title: 'Initiative for ' + c.name, label: 'Initiative', value: String(c.init), confirm: 'Set' });
      if (val !== null) { S.setInitiative(c.id, U.num(val, c.init)); refresh(); }
    });
    row.appendChild(initBtn);

    const main = el('div.combatant-main');
    const nameRow = el('div.combatant-name', {}, [
      el('span', { text: c.name }),
      c.hidden ? el('span.hidden-tag', { text: 'hidden' }) : null,
      c.kind === 'monster' && c.cr !== undefined ? el('span.tag', { text: 'CR ' + U.crText(c.cr) }) : null,
      c.concentration ? el('span.tag.purple', { text: '◈ ' + c.concentration }) : null
    ]);
    main.appendChild(nameRow);
    const sub = el('div.combatant-sub', {}, [
      el('span.small.dim', { text: c.kind === 'player' ? 'Player character' : (DM.data.sourceLabel(c.source) || 'Monster') }),
      el('span.small.dim', { text: 'AC ' + eff.ac })
    ]);
    main.appendChild(sub);
    if (eff.conditions.length) {
      const cr = el('div.cond-row');
      eff.conditions.slice(0, 5).forEach(cond => cr.appendChild(el('span.cond-pill' + (['Unconscious', 'Paralyzed', 'Stunned', 'Petrified'].includes(cond) ? '.bad' : ''), { text: cond })));
      main.appendChild(cr);
    }
    row.appendChild(main);

    const hp = el('div.combatant-hp');
    const bar = el('div.hp-bar' + (pct <= 0 ? '.crit' : pct <= 33 ? '.low' : ''));
    bar.appendChild(el('i', { style: { width: pct + '%' } }));
    hp.appendChild(bar);
    hp.appendChild(el('span.num', {}, [
      String(eff.hp), el('span.dim', { text: '/' + eff.maxHp + (eff.tempHp ? '+' + eff.tempHp : '') })
    ]));
    row.appendChild(hp);

    const quick = el('div.hp-quick');
    const inp = el('input', { type: 'number', placeholder: '±', min: 0, title: 'Amount (Enter = damage)' });
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const amt = U.num(inp.value, 0);
        if (amt) { S.applyCombatantHp(c.id, amt, e.shiftKey ? 'heal' : 'damage'); inp.value = ''; refresh(); }
      }
    });
    quick.appendChild(inp);
    const dmgBtn = el('button.hp-btn.dmg', { title: 'Damage (shift+click input to heal)', html: '<svg><use href="#i-skull"/></svg>' });
    dmgBtn.addEventListener('click', e => {
      e.stopPropagation();
      const amt = U.num(inp.value, 0) || 1;
      S.applyCombatantHp(c.id, amt, 'damage');
      inp.value = ''; refresh();
    });
    quick.appendChild(dmgBtn);
    const healBtn = el('button.hp-btn.heal', { title: 'Heal', html: '<svg><use href="#i-heart"/></svg>' });
    healBtn.addEventListener('click', e => {
      e.stopPropagation();
      const amt = U.num(inp.value, 0) || 1;
      S.applyCombatantHp(c.id, amt, 'heal');
      inp.value = ''; refresh();
    });
    quick.appendChild(healBtn);
    row.appendChild(quick);

    const actions = el('div.combatant-actions');
    const condBtn = el('button.icon-btn.sm', { title: 'Conditions', html: '<svg><use href="#i-warning"/></svg>' });
    condBtn.addEventListener('click', e => { e.stopPropagation(); conditionPicker(c); });
    actions.appendChild(condBtn);
    const openBtn = el('button.icon-btn.sm', { title: 'Open', html: '<svg><use href="#i-edit"/></svg>' });
    openBtn.addEventListener('click', e => { e.stopPropagation(); V.openCombatant(c.id); });
    actions.appendChild(openBtn);
    const delBtn = el('button.icon-btn.sm', { title: 'Remove', html: '<svg><use href="#i-trash"/></svg>' });
    delBtn.addEventListener('click', async e => {
      e.stopPropagation();
      S.removeCombatant(c.id); refresh();
      UI.toast('Removed <b>' + U.esc(c.name) + '</b>');
    });
    actions.appendChild(delBtn);
    row.appendChild(actions);

    row.addEventListener('click', () => V.openCombatant(c.id));

    // drag reorder
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', e => {
      row.classList.add('dragging');
      V._dragId = c.id;
      try { e.dataTransfer.setData('application/x-mbg-gamemaster-cmb', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); V._dragId = null; });
    row.addEventListener('dragover', e => { if (V._dragId) { e.preventDefault(); row.style.borderColor = 'rgba(201,163,94,.6)'; } });
    row.addEventListener('dragleave', () => { row.style.borderColor = ''; });
    row.addEventListener('drop', e => {
      row.style.borderColor = '';
      const id = V._dragId || e.dataTransfer.getData('application/x-mbg-gamemaster-cmb');
      if (id && id !== c.id) {
        e.preventDefault(); e.stopPropagation();
        S.update(s => {
          const arr = s.encounter.combatants;
          const from = arr.findIndex(x => x.id === id);
          const to = arr.findIndex(x => x.id === c.id);
          if (from < 0 || to < 0) return;
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
        });
        refresh();
      }
    });
    return row;
  }

  function sidePanel() {
    const enc = S.state.encounter;
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

    // current turn
    const current = enc.active && enc.combatants[enc.turnIndex] ? enc.combatants[enc.turnIndex] : null;
    const curPanel = el('div.panel.turn-panel');
    curPanel.appendChild(el('div.turn-now', {}, [
      el('div.label', { text: current ? 'Current turn' : 'Ready when you are' }),
      el('b', { text: current ? current.name : 'No active turn' }),
      current ? el('div.init', { text: 'Initiative ' + current.init + ' · Round ' + enc.round }) : el('div.small.dim', { style: { marginTop: '6px' }, text: 'Roll initiative or press Next turn to begin.' }),
      el('div.row', { style: { justifyContent: 'center', marginTop: '12px', gap: '5px' } }, [
        btn('Prev', 'chevron', () => { S.nextTurn(-1); refresh(); }, 'btn sm'),
        btn('Next turn', 'chevron', () => { S.nextTurn(1); refresh(); }, 'btn primary sm')
      ])
    ]));
    if (current) {
      const eff = S.effectiveCombatant(current);
      const conds = el('div.panel-body');
      conds.appendChild(el('div.label', { text: 'Quick conditions', style: { marginBottom: '7px' } }));
      const chips = el('div.row.wrap', { style: { gap: '4px' } });
      U.CONDITION_NAMES.forEach(nm => {
        if (['Exhaustion'].includes(nm)) return;
        const on = eff.conditions.includes(nm);
        const b = el('button.chip' + (on ? '.on' : ''), { text: nm });
        b.addEventListener('click', () => { S.toggleCombatantCondition(current.id, nm); refresh(); });
        chips.appendChild(b);
      });
      conds.appendChild(chips);
      curPanel.appendChild(conds);
    }
    wrap.appendChild(curPanel);

    // encounter maths
    const mathPanel = el('div.panel');
    mathPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Encounter maths' }), el('span.spacer'), el('span.small.dim', { text: S.state.players.length ? S.state.players.length + ' PCs' : 'Assumes 4 PCs' })]));
    const math = U.encounterMath(enc.combatants.filter(c => c.kind === 'monster').map(c => ({ cr: c.cr, qty: 1 })), S.state.players.length ? S.state.players.map(p => p.level) : [3, 3, 3, 3]);
    const dashboard = el('div.panel-body');
    dashboard.appendChild(el('div.xp-line', {}, [el('span', { text: 'Monster XP' }), el('b', { text: math.rawXp.toLocaleString() })]));
    dashboard.appendChild(el('div.xp-line', {}, [el('span', { text: 'Adjusted (' + math.multiplier + '×)' }), el('b', { text: math.adjusted.toLocaleString() })]));
    dashboard.appendChild(el('div.xp-line', {}, [el('span', { text: 'Deadly threshold' }), el('b', { text: math.thresholds[3].toLocaleString() })]));
    dashboard.appendChild(el('div.diff-verdict.' + math.verdict, { text: math.count ? cap(math.verdict) : '—' }));
    dashboard.appendChild(el('div.diff-labels', {}, [el('span', { text: 'easy' }), el('span', { text: 'medium' }), el('span', { text: 'hard' }), el('span', { text: 'deadly' })]));
    const meter = el('div.diff-meter');
    const totalW = math.thresholds[3] * 1.15 || 1;
    const seg = (v, color) => el('i', { style: { width: Math.min(100, (v / totalW) * 100) + '%', background: color } });
    meter.appendChild(seg(math.thresholds[0], '#3d7a56'));
    meter.appendChild(seg(math.thresholds[1] - math.thresholds[0], '#7a7a3d'));
    meter.appendChild(seg(math.thresholds[2] - math.thresholds[1], '#a8713a'));
    meter.appendChild(seg(math.thresholds[3] - math.thresholds[2], '#8e2b35'));
    dashboard.appendChild(meter);
    mathPanel.appendChild(dashboard);
    wrap.appendChild(mathPanel);

    // party quick
    if (S.state.players.length) {
      const pp = el('div.panel');
      pp.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Party' }), el('span.spacer'), el('button.link-btn.sm', { text: 'Manage', onclick: () => DM.navigate('party') })]));
      const pb = el('div.panel-body', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
      S.state.players.forEach(p => {
        const inEnc = enc.combatants.some(c => c.playerId === p.id);
        const pct = p.maxHp ? Math.max(0, (p.hp / p.maxHp) * 100) : 0;
        const row = el('div.row', { style: { gap: '8px' } }, [
          el('span.avatar.sm', { text: U.initials(p.name) }),
          el('div', { style: { flex: '1', minWidth: '0' } }, [
            el('div.row', { style: { justifyContent: 'space-between' } }, [el('span.small', { text: p.name }), el('span.tiny-text.dim', { text: p.hp + '/' + p.maxHp })]),
            (() => { const b = el('div.hp-bar' + (pct <= 33 ? '.low' : '')); b.appendChild(el('i', { style: { width: pct + '%' } })); return b; })()
          ]),
          inEnc ? el('span.tag.green', { text: 'in' }) : (() => {
            const b = el('button.icon-btn.sm', { title: 'Add to initiative', html: '<svg><use href="#i-plus"/></svg>' });
            b.addEventListener('click', () => { S.addPlayerCombatant(p.id); refresh(); });
            return b;
          })()
        ]);
        pb.appendChild(row);
      });
      pp.appendChild(pb);
      wrap.appendChild(pp);
    }
    return wrap;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  // ---------------------------------------------------------------- combatant drawer
  V.openCombatant = function (id, keepScroll) {
    const c = S.combatant(id);
    if (!c) return;
    const prevScroll = keepScroll ? (document.getElementById('drawerBody').scrollTop || 0) : 0;
    const eff = S.effectiveCombatant(c);
    const isPlayer = !!c.playerId;
    const body = el('div.combat-drawer');

    if (isPlayer) {
      body.appendChild(el('div.row', { style: { justifyContent: 'space-between', marginBottom: '10px' } }, [
        el('span.small.dim', { text: 'Player character' }),
        (() => { const b = el('button.btn.xs', { text: 'Open character sheet' }); b.addEventListener('click', () => DM.views.party.openCharacter(c.playerId)); return b; })()
      ]));
    }

    // HP card
    const hpCard = el('div.panel', {}, [
      el('div.panel-body', {}, [
        el('div.row', { style: { justifyContent: 'space-between', alignItems: 'flex-end' } }, [
          el('div', {}, [
            el('div.label', { text: 'Hit points' }),
            el('div', { style: { fontFamily: 'var(--serif)', fontSize: '30px', lineHeight: '1.1' } }, [
              String(eff.hp), el('span.dim', { style: { fontSize: '14px' }, text: ' / ' + eff.maxHp })
            ])
          ]),
          eff.tempHp ? el('span.chip.blue.static', { text: '+' + eff.tempHp + ' temp' }) : null
        ]),
        (() => { const b = el('div.hp-bar' + (eff.hp <= 0 ? '.crit' : eff.hp / eff.maxHp <= .33 ? '.low' : ''), { style: { marginTop: '8px' } }); b.appendChild(el('i', { style: { width: Math.max(0, Math.min(100, eff.hp / eff.maxHp * 100)) + '%' } })); return b; })(),
        hpControls(c.id, eff),
      ])
    ]);
    body.appendChild(hpCard);

    // stats
    body.appendChild(el('div.grid.g4', { style: { marginTop: '14px' } }, [
      numEdit('Initiative', c.init, v => { S.setInitiative(c.id, v); }, { min: -10, max: 50 }),
      numEdit('Armor Class', isPlayer ? eff.ac : c.ac, v => { if (!isPlayer) { c.ac = v; S.save(); } else { const p = S.player(c.playerId); if (p) S.update(() => p.ac = v); } }, { min: 1, max: 40 }),
      numEdit('Max HP', isPlayer ? eff.maxHp : c.maxHp, v => {
        if (isPlayer) { const p = S.player(c.playerId); if (p) S.update(() => { p.maxHp = Math.max(1, v); p.hp = Math.min(p.hp, p.maxHp); }); }
        else S.update(() => { c.maxHp = Math.max(1, v); c.hp = Math.min(c.hp, c.maxHp); });
      }, { min: 1 }),
      numEdit('Temp HP', eff.tempHp, v => {
        if (isPlayer) { const p = S.player(c.playerId); if (p) S.update(() => p.tempHp = Math.max(0, v)); }
        else S.update(() => c.tempHp = Math.max(0, v));
      }, { min: 0 })
    ]));

    // conditions
    body.appendChild(el('div.row', { style: { justifyContent: 'space-between', margin: '16px 0 7px' } }, [
      el('div.label', { text: 'Conditions' }),
      el('span.small.dim', { text: 'Concentration: ' + (eff.concentration || '—') })
    ]));
    const condGrid = el('div.row.wrap', { style: { gap: '4px' } });
    U.CONDITION_NAMES.forEach(nm => {
      const on = eff.conditions.includes(nm);
      const b = el('button.chip' + (on ? '.on' : ''), { text: nm, title: (U.CONDITIONS.find(x => x.name === nm) || {}).desc });
      b.addEventListener('click', () => { S.toggleCombatantCondition(c.id, nm); V.openCombatant(id, true); });
      condGrid.appendChild(b);
    });
    body.appendChild(condGrid);

    // death saves / concentration
    if (isPlayer) {
      const p = S.player(c.playerId);
      if (p) {
        body.appendChild(el('div.row', { style: { marginTop: '14px', gap: '16px' } }, [
          el('div', {}, [
            el('div.label', { text: 'Death saves', style: { marginBottom: '6px' } }),
            el('div.row', { style: { gap: '10px' } }, [
              el('div.row', { style: { gap: '4px' } }, [0, 1, 2].map(i => {
                const on = (p.deathSaves.successes || 0) > i;
                const b = el('button.hp-btn', { text: '✓', style: { color: on ? 'var(--green)' : '' } });
                b.addEventListener('click', () => { S.update(() => p.deathSaves.successes = on ? i : i + 1); V.openCombatant(id, true); });
                return b;
              })),
              el('div.row', { style: { gap: '4px' } }, [0, 1, 2].map(i => {
                const on = (p.deathSaves.failures || 0) > i;
                const b = el('button.hp-btn', { text: '✕', style: { color: on ? 'var(--danger)' : '' } });
                b.addEventListener('click', () => { S.update(() => p.deathSaves.failures = on ? i : i + 1); V.openCombatant(id, true); });
                return b;
              }))
            ])
          ]),
          el('div.field', { style: { flex: '1' } }, [
            el('label.label', { text: 'Concentration' }),
            (() => {
              const inp = el('input', { type: 'text', value: p.concentration || '', placeholder: 'Spell name' });
              inp.addEventListener('change', () => S.update(() => p.concentration = inp.value));
              return inp;
            })()
          ])
        ]));
      }
    } else {
      body.appendChild(el('div.row', { style: { marginTop: '14px', gap: '10px', alignItems: 'center' } }, [
        (() => {
          const b = el('button.chip' + (c.hidden ? '.on' : ''), { text: c.hidden ? 'Hidden from players' : 'Visible to players' });
          b.addEventListener('click', () => { S.update(() => c.hidden = !c.hidden); V.openCombatant(id, true); });
          return b;
        })(),
        (() => {
          const b = el('button.chip' + (c.concentration ? '.on' : ''), { text: 'Concentration' });
          b.addEventListener('click', async () => {
            const val = await UI.prompt({ title: 'Concentration', label: 'Spell or effect', value: c.concentration || '' });
            if (val !== null) { S.update(() => c.concentration = val); V.openCombatant(id, true); }
          });
          return b;
        })()
      ]));
    }

    // notes
    body.appendChild(el('div.label', { text: 'DM notes', style: { margin: '16px 0 6px' } }));
    const notes = el('textarea', { rows: 3, placeholder: 'Tactics, legendary actions used, loot…' });
    notes.value = c.notes || '';
    notes.addEventListener('change', () => S.update(() => c.notes = notes.value));
    body.appendChild(notes);

    // statblock
    const monster = c.monsterName ? DM.data.monster(c.monsterName, c.source) : null;
    if (monster) {
      const det = el('details.section-details', { style: { marginTop: '16px' } });
      det.appendChild(el('summary', { text: 'Statblock' }));
      const sb = el('div', { html: R.monster(monster), style: { padding: '10px 2px' } });
      det.appendChild(sb);
      body.appendChild(det);
    }

    body.appendChild(el('div.row', { style: { marginTop: '18px', justifyContent: 'space-between' } }, [
      (() => {
        const b = el('button.btn.danger.sm', {}, [U.svg('trash'), el('span', { text: 'Remove from encounter' })]);
        b.addEventListener('click', () => { S.removeCombatant(c.id); UI.closeDrawer(); refresh(); });
        return b;
      })(),
      monster ? (() => { const b = el('button.btn.sm', { text: 'Open full statblock' }); b.addEventListener('click', () => UI.openMonster(monster.name, monster.source)); return b; })() : null
    ]));

    UI.drawer({
      title: c.name,
      body,
      tools: [
        { icon: 'dice', title: 'Roll initiative', onClick: () => { const r = S.rollCombatantInitiative(c.id); UI.toast(U.esc(c.name) + ' initiative: <b>' + r.total + '</b>'); refresh(); V.openCombatant(id, true); } },
        { icon: 'skull', title: 'Roll death save', onClick: () => UI.rollCheck(0, { label: c.name + ' death save' }) }
      ]
    });
    if (keepScroll) {
      const db = document.getElementById('drawerBody');
      if (db) setTimeout(() => { db.scrollTop = prevScroll; }, 0);
    }
  };

  function hpControls(id, eff) {
    const wrap = el('div', { style: { marginTop: '12px' } });
    const row = el('div.row', { style: { gap: '6px', flexWrap: 'wrap' } });
    const inp = el('input', { type: 'number', placeholder: 'Amount', min: 0, style: { width: '110px' } });
    row.appendChild(inp);
    const apply = (kind) => {
      const amt = U.num(inp.value, 0);
      if (!amt) return;
      S.applyCombatantHp(id, amt, kind);
      inp.value = '';
      const c = S.combatant(id);
      UI.toast((kind === 'damage' ? '💥 ' : '💚 ') + U.esc(c.name) + (kind === 'damage' ? ' takes ' : ' regains ') + '<b>' + amt + '</b>');
      refresh();
      V.openCombatant(id, true);
    };
    const dmg = el('button.btn.danger.sm', {}, [U.svg('skull'), el('span', { text: 'Damage' })]);
    dmg.addEventListener('click', () => apply('damage'));
    const heal = el('button.btn.sm', {}, [U.svg('heart'), el('span', { text: 'Heal' })]);
    heal.addEventListener('click', () => apply('heal'));
    row.appendChild(dmg); row.appendChild(heal);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') apply('damage'); });
    wrap.appendChild(row);
    const quick = el('div.row.wrap', { style: { gap: '4px', marginTop: '6px' } });
    [1, 5, 10, 20].forEach(n => {
      const b = el('button.chip', { text: '−' + n });
      b.addEventListener('click', () => { S.applyCombatantHp(id, n, 'damage'); refresh(); V.openCombatant(id, true); });
      quick.appendChild(b);
    });
    [1, 5, 10, 20].forEach(n => {
      const b = el('button.chip', { text: '+' + n });
      b.addEventListener('click', () => { S.applyCombatantHp(id, n, 'heal'); refresh(); V.openCombatant(id, true); });
      quick.appendChild(b);
    });
    wrap.appendChild(quick);
    return wrap;
  }

  function numEdit(label, value, onchange, opts) {
    const inp = el('input', { type: 'number', value: value == null ? '' : String(value), min: opts.min, max: opts.max });
    inp.addEventListener('change', () => { onchange(U.num(inp.value, 0)); refresh(); });
    return el('div.field', {}, [el('label.label', { text: label }), inp]);
  }

  function conditionPicker(c) {
    const eff = S.effectiveCombatant(c);
    const body = el('div');
    const grid = el('div.row.wrap', { style: { gap: '5px' } });
    U.CONDITIONS.forEach(cond => {
      const b = el('button.chip' + (eff.conditions.includes(cond.name) ? '.on' : ''), { text: cond.name, title: cond.desc });
      b.addEventListener('click', () => { S.toggleCombatantCondition(c.id, cond.name); b.classList.toggle('on'); refresh(); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    UI.modal({ title: 'Conditions — ' + c.name, body, buttons: [{ label: 'Done', cls: 'primary' }] });
  }

  // ---------------------------------------------------------------- add dialog
  function addDialog() {
    const enc = S.state.encounter;
    const body = el('div');
    const qty = el('input', { type: 'number', value: '1', min: '1', max: '30', style: { width: '70px' } });
    const search = el('input', { type: 'search', placeholder: 'Search monsters… try “undead”, “wolf”, “cr:3”, “vampire”' });
    const results = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '300px', overflowY: 'auto', marginTop: '8px' } });
    body.appendChild(el('div.row', { style: { gap: '8px' } }, [
      el('div.search-field', { style: { flex: '1' } }, [U.svg('search'), search]),
      el('div.field', { style: { width: '80px' } }, [el('label.label', { text: 'Qty' }), qty])
    ]));
    body.appendChild(results);
    body.appendChild(el('div.small.dim', { style: { marginTop: '6px' }, text: 'Tip: drop results straight onto the initiative dock. Ctrl+Enter in global search also adds to initiative.' }));

    const curated = ['Strahd von Zarovich', 'Vampire Spawn', 'Dire Wolf', 'Werewolf', 'Zombie', 'Skeleton', 'Ghoul', 'Wraith', 'Swarm of Bats', 'Night Hag', 'Wight', 'Baba Lysaga'];
    function paint() {
      const q = search.value.trim();
      results.innerHTML = '';
      let list;
      if (!q) {
        list = curated.map(n => DM.data.monster(n)).filter(Boolean);
      } else {
        list = DM.search.query(q, { kind: 'monster', limit: 25 }).map(r => DM.data.monster(r.doc.ref.name, r.doc.ref.source)).filter(Boolean);
      }
      if (!list.length) { results.innerHTML = '<div class="pal-empty">No monsters match.</div>'; return; }
      list.forEach(m => {
        const row = el('div.result-row', {}, [
          el('div.result-glyph.monster', { text: 'M' }),
          el('div.result-main', {}, [
            el('div.result-name', {}, [m.name, el('span.tag', { text: 'CR ' + U.crText(m.cr) })]),
            el('div.result-meta', { text: R.monsterMeta(m) + ' · ' + m.source })
          ]),
          el('button.btn.xs.primary', { text: 'Add' })
        ]);
        row.addEventListener('click', () => {
          const n = Math.max(1, U.num(qty.value, 1));
          S.addMonsterCombatant(m, n);
          UI.toast('Added <b>' + n + '× ' + U.esc(m.name) + '</b> to initiative');
          refresh();
        });
        UI.draggable(row, () => ({ type: 'monster', name: m.name, source: m.source }));
        results.appendChild(row);
      });
    }
    search.addEventListener('input', U.debounce(paint, 100));
    paint();

    // party add
    if (S.state.players.length) {
      body.appendChild(el('div.label', { text: 'Party', style: { marginTop: '14px' } }));
      const pr = el('div.row.wrap', { style: { gap: '5px', marginTop: '4px' } });
      S.state.players.forEach(p => {
        const already = enc.combatants.some(c => c.playerId === p.id);
        const b = el('button.chip' + (already ? '.green' : ''), { text: p.name + (already ? ' ✓' : '') });
        if (!already) b.addEventListener('click', () => { S.addPlayerCombatant(p.id); UI.toast(p.name + ' joined initiative'); refresh(); });
        pr.appendChild(b);
      });
      body.appendChild(pr);
    }

    // custom combatant
    const det = el('details.section-details', { style: { marginTop: '14px' } });
    det.appendChild(el('summary', { text: 'Add a custom combatant' }));
    const cname = el('input', { type: 'text', placeholder: 'Name' });
    const chp = el('input', { type: 'number', value: '10', min: '1', style: { width: '80px' } });
    const cac = el('input', { type: 'number', value: '12', min: '1', style: { width: '80px' } });
    const cinit = el('input', { type: 'number', value: '0', style: { width: '80px' } });
    const cBtn = el('button.btn.primary.sm', { text: 'Add custom' });
    cBtn.addEventListener('click', () => {
      if (!cname.value.trim()) return;
      S.update(s => {
        s.encounter.combatants.push(S.newCombatant({ kind: 'custom', name: cname.value.trim(), hp: U.num(chp.value, 10), maxHp: U.num(chp.value, 10), ac: U.num(cac.value, 10), init: U.num(cinit.value, 0) }));
        s.encounter.combatants.sort((a, b) => b.init - a.init);
        s.encounter.active = true; s.encounter.round = s.encounter.round || 1;
      });
      cname.value = ''; refresh();
    });
    det.appendChild(el('div.grid.g4', { style: { marginTop: '6px' } }, [
      el('div.field', { style: { gridColumn: 'span 2' } }, [el('label.label', { text: 'Name' }), cname]),
      el('div.field', {}, [el('label.label', { text: 'HP' }), chp]),
      el('div.field', {}, [el('label.label', { text: 'AC' }), cac])
    ]));
    det.appendChild(el('div.row', { style: { marginTop: '6px' } }, [el('div.field', { style: { width: '90px' } }, [el('label.label', { text: 'Initiative' }), cinit]), cBtn]));
    body.appendChild(det);

    UI.modal({ title: 'Add combatants', body, buttons: [{ label: 'Done', cls: 'primary' }] });
  }

  V.addDialog = addDialog;

  // ---------------------------------------------------------------- actions
  function saveTemplate() {
    if (!S.state.encounter.combatants.length) { UI.toast('Nothing to save yet.'); return; }
    UI.prompt({ title: 'Save encounter template', label: 'Name', value: S.state.encounter.name || 'Encounter', confirm: 'Save' }).then(name => {
      if (name === null) return;
      const groups = {};
      S.state.encounter.combatants.filter(c => c.kind === 'monster').forEach(c => {
        const key = c.monsterName + '|' + (c.source || '');
        if (!groups[key]) groups[key] = { monsterName: c.monsterName, source: c.source, cr: c.cr, qty: 0 };
        groups[key].qty++;
      });
      S.saveTemplate(name, Object.values(groups));
      UI.toast('Saved encounter template <b>' + U.esc(name) + '</b>');
    });
  }

  async function clearEncounter() {
    if (!S.state.encounter.combatants.length) return;
    if (await UI.confirm({ title: 'Clear encounter?', message: 'Removes all combatants from the tracker. Saved templates are untouched.', confirm: 'Clear', danger: true })) {
      S.clearEncounter();
      refresh();
      UI.toast('Encounter cleared');
    }
  }

  // ---------------------------------------------------------------- dock
  V.renderDock = function () {
    const dock = document.getElementById('dock');
    const track = document.getElementById('dockTrack');
    const roundEl = document.getElementById('dockRound');
    if (!dock || !track) return;
    const enc = S.state.encounter;
    roundEl.textContent = enc.active ? 'Round ' + enc.round : (enc.combatants.length ? 'Ready' : '—');
    const empty = document.getElementById('dockOpen');
    track.innerHTML = '';
    if (!enc.combatants.length) {
      const e = el('div.dock-empty', { html: '' }, [
        el('span', { text: 'Drag a monster or party member here to roll initiative.' }),
        (() => { const b = el('button.link-btn', { text: 'Open tracker' }); b.id = 'dockOpen'; b.addEventListener('click', () => DM.navigate('initiative')); return b; })()
      ]);
      track.appendChild(e);
      return;
    }
    enc.combatants.forEach((c, i) => {
      const eff = S.effectiveCombatant(c);
      const active = enc.active && i === enc.turnIndex;
      const pct = eff.maxHp ? Math.max(0, Math.min(100, eff.hp / eff.maxHp * 100)) : 0;
      const card = el('div.dock-card' + (active ? '.active' : '') + (eff.hp <= 0 ? '.dead' : ''), { title: c.name + ' — ' + eff.hp + '/' + eff.maxHp });
      card.appendChild(el('div.dc-top', {}, [
        el('span.dc-init', { text: String(c.init) }),
        el('span.dc-name', { text: c.name }),
        eff.conditions.length ? el('span.dc-cond', { title: eff.conditions.join(', ') }) : null
      ]));
      const bar = el('div.hp-bar' + (pct <= 33 ? '.crit' : ''));
      bar.appendChild(el('i', { style: { width: pct + '%' } }));
      card.appendChild(bar);
      card.appendChild(el('div.dc-hp', {}, [el('span', { text: eff.hp + '/' + eff.maxHp }), el('span', { text: c.kind === 'player' ? 'PC' : 'CR ' + U.crText(c.cr) })]));
      card.addEventListener('click', () => { V.openCombatant(c.id); });
      track.appendChild(card);
    });
  };

  // ---------------------------------------------------------------- wiring
  function refresh() {
    if (DM.currentView === 'initiative') {
      const scroll = document.getElementById('main').scrollTop;
      const old = rootEl;
      const fresh = V.render();
      if (old && old.isConnected) old.replaceWith(fresh); else document.getElementById('main').appendChild(fresh);
      rootEl = fresh;
      document.getElementById('main').scrollTop = scroll;
    }
    V.renderDock();
    DM.ui.renderNav();
  }
  V.refresh = refresh;

  DM.bus.on('state', () => {
    V.renderDock();
    if (DM.currentView === 'initiative' && !UI.isDrawerOpen()) refresh();
    if (DM.currentView === 'initiative' && UI.isDrawerOpen()) DM.ui.renderNav();
  });

  DM.bus.on('drawer-closed', () => {
    if (DM.currentView === 'initiative') refresh();
  });
})();
