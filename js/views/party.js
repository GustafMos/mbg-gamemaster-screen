/* Party manager */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.party = V;

  let rootEl = null;

  V.render = function () {
    const p = S.state.players;
    rootEl = el('div.view.party-view');
    const head = el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'The adventurers' }),
        el('h1', { text: 'The Party' }),
        el('p', { text: p.length + ' characters · drag a card onto the initiative bar. Open an item in Search to hand it to a character.' })
      ]),
      el('div.head-actions', {}, [
        btn('Long rest', 'moon', () => V.longRest(), 'btn gold sm'),
        btn('Add character', 'plus', () => V.addCharacter(), 'btn primary'),
        btn('', 'sparkle', () => V.loadSample(), 'btn sm', 'Demo party')
      ])
    ]);
    rootEl.appendChild(head);

    if (!p.length) {
      const empty = el('div.empty', {}, [
        el('div.em-icon', { text: '🛡' }),
        el('h3', { text: 'No adventurers yet' }),
        el('p', { text: 'Add your players to track hit points, conditions, spell slots and inventory — then drag them into initiative in one move.' }),
        el('div.row', { style: { justifyContent: 'center' } }, [
          btn('Add your first character', 'plus', () => V.addCharacter(), 'btn primary'),
          btn('Load a demo party', 'users', () => V.loadSample(), 'btn'),
          btn('Import backup', 'upload', () => DM.views.settings.importDialog(), 'btn ghost')
        ])
      ]);
      rootEl.appendChild(empty);
      return rootEl;
    }

    const grid = el('div.party-grid');
    p.forEach(player => grid.appendChild(pcCard(player)));
    rootEl.appendChild(grid);

    // party inventory + afflictions
    const extra = el('div.dash-grid', { style: { marginTop: '16px' } });
    const invPanel = el('div.panel');
    invPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Party inventory' }), el('span.spacer'), el('span.small.dim', { text: 'aggregated across characters' })]));
    const invBody = el('div.panel-body');
    const counts = new Map();
    p.forEach(pl => (pl.inventory || []).forEach(it => {
      const key = it.name + '|' + (it.source || '');
      if (!counts.has(key)) counts.set(key, { name: it.name, source: it.source, qty: 0 });
      counts.get(key).qty += it.qty || 1;
    }));
    if (!counts.size) invBody.appendChild(el('div.small.dim', { text: 'No items yet. Drag an item from Search onto a character card, or add one from the character sheet.' }));
    else {
      const list = el('div.row.wrap', { style: { gap: '5px' } });
      Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name)).forEach(it => {
        const chip = el('button.chip', { text: it.name + ' ×' + it.qty, title: it.source || 'custom' });
        if (it.source && DM.data.item(it.name, it.source)) chip.addEventListener('click', () => UI.openItem(it.name, it.source));
        list.appendChild(chip);
      });
      invBody.appendChild(list);
    }
    invPanel.appendChild(invBody);
    extra.appendChild(invPanel);

    const statusPanel = el('div.panel');
    statusPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Afflictions & concentration' }), el('span.spacer'), (() => { const b = el('button.btn.xs', { text: 'Long rest' }); b.addEventListener('click', () => V.longRest()); return b; })()]));
    const statusBody = el('div.panel-body');
    const afflicted = p.filter(pl => pl.conditions.length || pl.concentration || pl.hp <= 0);
    if (!afflicted.length) statusBody.appendChild(el('div.small.dim', { text: 'Everyone is healthy. Enjoy it while it lasts.' }));
    else {
      afflicted.forEach(pl => {
        statusBody.appendChild(el('div.row', { style: { gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--line)' } }, [
          el('span.avatar.sm', { text: U.initials(pl.name) }),
          el('div', { style: { flex: '1' } }, [
            el('div.row.wrap', { style: { gap: '4px' } }, [
              el('span.small', { text: pl.name }),
              pl.hp <= 0 ? el('span.tag.accent', { text: 'DOWN' }) : null,
              pl.concentration ? el('span.tag.purple', { text: '◈ ' + pl.concentration }) : null
            ]),
            pl.conditions.length ? el('div.row.wrap', { style: { gap: '4px', marginTop: '3px' } }, pl.conditions.map(c => el('span.cond-pill', { text: c }))) : null
          ])
        ]));
      });
    }
    statusPanel.appendChild(statusBody);
    extra.appendChild(statusPanel);
    rootEl.appendChild(extra);

    // initiative helper strip
    const enc = S.state.encounter;
    if (enc.combatants.length) {
      const strip = el('div.panel', { style: { marginTop: '18px' } }, [
        el('div.panel-head', {}, [el('h3', { text: 'In initiative' }), el('span.spacer'), el('button.btn.xs', { onclick: () => DM.navigate('initiative') }, 'Open tracker')]),
        el('div.panel-body.row.wrap', {}, enc.combatants.map(c => {
          const eff = S.effectiveCombatant(c);
          return el('span.chip', { title: c.name, onclick: () => DM.navigate('initiative') }, [
            (c.kind === 'player' ? '● ' : '') + c.name + ' · ' + eff.hp + '/' + eff.maxHp
          ]);
        }))
      ]);
      rootEl.appendChild(strip);
    }
    return rootEl;
  };

  function btn(label, icon, onclick, cls, title) {
    const b = el('button.' + (cls || 'btn').replace(/ /g, '.'), { title: title || label });
    if (icon) b.appendChild(U.svg(icon));
    if (label) b.appendChild(el('span', { text: label }));
    b.addEventListener('click', onclick);
    return b;
  }

  function pcCard(p) {
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const hpClass = p.hp <= 0 ? 'crit' : hpPct <= 33 ? 'low' : '';
    const card = el('article.pc-card' + (p.hp <= 0 ? '.pc-dead' : ''), { 'data-player': p.id });
    card.style.setProperty('--pc-color', p.color);

    const top = el('div.pc-top');
    const av = el('div.avatar.lg', { text: p.emoji || U.initials(p.name) });
    av.style.background = 'linear-gradient(150deg, ' + p.color + ', rgba(20,16,28,.9))';
    top.appendChild(av);
    top.appendChild(el('div.pc-id', {}, [
      el('h3.pc-name', { text: p.name }),
      el('div.pc-sub', { text: [p.ancestry, p.className, p.level ? 'Level ' + p.level : '', p.player].filter(Boolean).join(' · ') || 'Unassigned' }),
      el('div.row.wrap', { style: { marginTop: '6px', gap: '5px' } }, [
        el('span.tag.gold', { text: 'Init ' + (p.initiativeBonus >= 0 ? '+' : '') + p.initiativeBonus }),
        el('span.tag', { text: 'PP ' + passivePerception(p) }),
        el('span.tag', { text: p.speed || '30 ft.' }),
        p.inspiration ? el('span.tag.gold', { text: '★ Inspired' }) : null
      ])
    ]));
    top.appendChild(el('div.pc-ac', {}, [el('b', { text: String(p.ac) }), el('span', { text: 'AC' })]));
    card.appendChild(top);

    const hpTop = el('div.pc-hp-top', {}, [
      el('div', {}, [
        el('span.pc-hp-num', {}, [String(p.hp), el('small', { text: ' / ' + p.maxHp })]),
        p.tempHp > 0 ? el('span.chip.blue.static', { style: { marginLeft: '7px' }, text: '+' + p.tempHp + ' temp' }) : null
      ]),
      el('div.pc-hp-tools', {}, [
        hpButton('minus', 'dmg', 'Damage', () => hpPrompt(p, 'damage')),
        hpButton('plus', 'heal', 'Heal', () => hpPrompt(p, 'heal')),
        hpButton('edit', '', 'Edit character', () => V.openCharacter(p.id))
      ])
    ]);
    const hpBar = el('div.hp-bar' + (hpClass ? '.' + hpClass : ''));
    hpBar.appendChild(el('i', { style: { width: hpPct + '%' } }));
    card.appendChild(el('div.pc-hp', {}, [hpTop, hpBar]));
    if (p.hp <= 0) {
      card.appendChild(deathSaveRow(p));
    }

    if (p.conditions.length) {
      card.appendChild(el('div.cond-row', {}, p.conditions.map(c => el('span.cond-pill', { text: c }))));
    }

    // spell slots pips
    const slots = Object.entries(p.spellSlots || {}).filter(([lvl, s]) => s && s.max > 0);
    if (slots.length) {
      const row = el('div.row.wrap', { style: { marginTop: '9px', gap: '10px' } });
      slots.forEach(([lvl, s]) => {
        const g = el('div.slot-group', { title: 'Level ' + lvl + ' spell slots' }, [el('span', { text: 'L' + lvl })]);
        const pips = el('div.slot-pips');
        for (let i = 0; i < s.max; i++) {
          const pip = el('button.slot-pip' + (i < s.used ? '.used' : ''), { 'data-slot': lvl, 'data-i': i, title: 'Level ' + lvl + ' slot ' + (i + 1) });
          pips.appendChild(pip);
        }
        g.appendChild(pips);
        row.appendChild(g);
      });
      card.appendChild(row);
    }

    const foot = el('div.pc-foot', {}, [
      el('span.hint', { text: 'Drag to initiative' }),
      el('span.spacer'),
      el('button.link-btn', { text: 'Conditions', onclick: (e) => { e.stopPropagation(); conditionPicker(p); } }),
      el('button.link-btn', { text: 'Notes', onclick: (e) => { e.stopPropagation(); V.openCharacter(p.id, 'notes'); } })
    ]);
    card.appendChild(foot);

    // interactions
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      V.openCharacter(p.id);
    });
    card.querySelectorAll('[data-slot]').forEach(pip => pip.addEventListener('click', (e) => {
      e.stopPropagation();
      const lvl = pip.dataset.slot, i = Number(pip.dataset.i);
      S.update(() => {
        const s = p.spellSlots[lvl];
        s.used = (i + 1 === s.used) ? i : i + 1;
        s.used = U.clamp(s.used, 0, s.max);
      });
    }));
    UI.draggable(card, () => ({ type: 'player', playerId: p.id, name: p.name }));
    UI.dropzone(card, (payload) => {
      if (payload.type === 'item') {
        addItemToPlayer(p.id, payload);
      }
    });
    return card;
  }

  function hpButton(icon, cls, title, onclick) {
    const b = el('button.hp-btn' + (cls ? '.' + cls : ''), { title, 'aria-label': title }, [U.svg(icon)]);
    b.addEventListener('click', (e) => { e.stopPropagation(); onclick(); });
    return b;
  }

  function deathSaveRow(p) {
    const row = el('div.row', { style: { marginTop: '9px', gap: '12px' } }, [
      el('span.tiny-text.dim', { text: 'Death saves' }),
      savePips(p, 'successes', '✓'),
      savePips(p, 'failures', '✕')
    ]);
    return row;
  }
  function savePips(p, key, glyph) {
    const wrap = el('div.row', { style: { gap: '4px' } });
    for (let i = 0; i < 3; i++) {
      const on = (p.deathSaves[key] || 0) > i;
      const b = el('button.hp-btn', {
        style: { width: '20px', height: '20px', fontSize: '10px', color: on ? (key === 'successes' ? 'var(--green)' : 'var(--danger)') : '' },
        title: 'Toggle ' + key, text: glyph
      });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        S.update(() => { p.deathSaves[key] = on ? i : i + 1; });
      });
      wrap.appendChild(b);
    }
    return wrap;
  }

  function passivePerception(p) {
    if (p.passivePerception) return p.passivePerception;
    return 10 + U.mod(p.stats.wis);
  }

  V.addCharacter = function () {
    const p = S.addPlayer({ name: 'New adventurer', className: 'Adventurer', level: 1 });
    V.openCharacter(p.id, 'name');
  };

  V.loadSample = function () {
    if (S.state.players.length) {
      UI.confirm({ title: 'Add demo party?', message: 'This appends four level 3 adventurers to your existing party.', confirm: 'Add them' }).then(ok => {
        if (ok) addSample();
      });
    } else addSample();
    function addSample() {
      const demo = [
        { name: 'Sera Vane', player: 'Alex', ancestry: 'Human', className: 'Cleric (War)', level: 3, ac: 18, maxHp: 27, stats: { str: 15, dex: 10, con: 14, int: 11, wis: 16, cha: 12 }, initiativeBonus: 0, spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } }, notes: 'Keeps the party alive. Holy symbol of the Morninglord.' },
        { name: 'Kaelen Dusk', player: 'Robin', ancestry: 'Half-elf', className: 'Rogue (Assassin)', level: 3, ac: 15, maxHp: 24, stats: { str: 10, dex: 17, con: 12, int: 13, wis: 12, cha: 14 }, initiativeBonus: 3 },
        { name: 'Bram Ironfoot', player: 'Sam', ancestry: 'Mountain dwarf', className: 'Fighter (Champion)', level: 3, ac: 18, maxHp: 34, stats: { str: 17, dex: 12, con: 15, int: 8, wis: 11, cha: 10 }, initiativeBonus: 1 },
        { name: 'Lyra Moonwhisper', player: 'Jo', ancestry: 'High elf', className: 'Wizard (Divination)', level: 3, ac: 12, maxHp: 17, stats: { str: 8, dex: 14, con: 12, int: 17, wis: 13, cha: 10 }, initiativeBonus: 2, spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } }, notes: 'Portents: 14, 7. Looking for a lost tome.' }
      ];
      demo.forEach(d => {
        const p = S.addPlayer(d);
        p.hp = p.maxHp;
        p.inventory = [
          { id: U.uid('inv'), name: 'Potion of Healing', source: 'DMG', qty: 2 },
          { id: U.uid('inv'), name: 'Rations (1 day)', source: 'PHB', qty: 5 }
        ];
      });
      S.update(() => {});
      UI.toast('Demo party added — drag a card onto the initiative bar to try it out.');
    }
  };

  function addItemToPlayer(playerId, payload) {
    const item = payload.name;
    S.update(s => {
      const p = s.players.find(x => x.id === playerId);
      if (!p) return;
      if (payload.fromPlayerId && payload.fromPlayerId !== playerId) {
        const from = s.players.find(x => x.id === payload.fromPlayerId);
        if (from) {
          const src = from.inventory.find(i => i.name === item && (i.source || '') === (payload.source || ''));
          if (src) { src.qty = (src.qty || 1) - 1; if (src.qty <= 0) from.inventory = from.inventory.filter(i => i.id !== src.id); }
        }
      }
      const existing = p.inventory.find(i => i.name === item && (i.source || '') === (payload.source || ''));
      if (existing) existing.qty = (existing.qty || 1) + 1;
      else p.inventory.push({ id: U.uid('inv'), name: item, source: payload.source || '', qty: 1 });
    });
    const p = S.player(playerId);
    const from = payload.fromPlayerId ? S.player(payload.fromPlayerId) : null;
    UI.toast((from ? 'Moved ' : 'Gave ') + '<b>' + U.esc(payload.name) + '</b>' + (from ? ' from ' + U.esc(from.name) : '') + ' to ' + U.esc(p ? p.name : ''));
  }

  // ---------------------------------------------------------------- hp prompt
  function hpPrompt(p, mode) {
    const label = mode === 'damage' ? 'Damage taken' : 'Hit points restored';
    let value = 0;
    const input = el('input', { type: 'number', min: 0, value: '0', placeholder: '0' });
    const quick = el('div.row.wrap', { style: { gap: '5px' } }, [1, 5, 10, 20].map(n => {
      const b = el('button.chip', { text: String(n), type: 'button' });
      b.addEventListener('click', () => { input.value = String(Number(input.value || 0) + n); input.focus(); });
      return b;
    }));
    const body = el('div', {}, [
      el('p.small.muted', { text: (mode === 'damage' ? 'How much damage does ' : 'How much healing for ') + p.name + ' take?' }),
      el('div.field', {}, [el('label.label', { text: label }), input]),
      quick,
      el('div.small.dim', { text: 'Current: ' + p.hp + ' / ' + p.maxHp + (p.tempHp ? ' (+' + p.tempHp + ' temp)' : '') })
    ]);
    const submit = () => {
      const amt = Math.max(0, U.num(input.value, 0));
      if (!amt) { UI.closeModal(); return; }
      S.adjustPlayerHp(p.id, amt, mode === 'damage');
      UI.closeModal();
      const after = S.player(p.id);
      UI.toast((mode === 'damage' ? '💥 ' : '💚 ') + U.esc(p.name) + ' ' + (mode === 'damage' ? 'takes <b>' + amt + '</b> damage' : 'regains <b>' + amt + '</b> HP') + ' → <b>' + (after ? after.hp : '?') + '/' + p.maxHp + '</b>');
    };
    UI.modal({
      title: mode === 'damage' ? 'Deal damage' : 'Heal',
      body,
      buttons: [
        { label: 'Cancel', cls: 'ghost' },
        { label: mode === 'damage' ? 'Deal damage' : 'Heal', cls: mode === 'damage' ? 'danger' : 'primary', onClick: submit }
      ],
      onMount: () => { input.focus(); input.select(); input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }); }
    });
  }
  V.hpPrompt = hpPrompt;

  // ---------------------------------------------------------------- conditions
  function conditionPicker(p) {
    const body = el('div');
    const grid = el('div.row.wrap', { style: { gap: '5px' } });
    U.CONDITIONS.forEach(c => {
      const b = el('button.chip' + (p.conditions.includes(c.name) ? '.on' : ''), { title: c.desc, text: c.name });
      b.addEventListener('click', () => {
        S.togglePlayerCondition(p.id, c.name);
        b.classList.toggle('on');
      });
      grid.appendChild(b);
    });
    body.appendChild(el('p.small.muted', { text: 'Click to toggle. Conditions are shared with the initiative tracker.' }));
    body.appendChild(grid);
    body.appendChild(el('div.row', { style: { marginTop: '10px' } }, [
      el('input', { type: 'text', placeholder: 'Add a custom condition…', id: 'customCond', style: { flex: '1' } }),
      (() => {
        const b = el('button.btn.sm', { text: 'Add' });
        b.addEventListener('click', () => {
          const inp = document.getElementById('customCond');
          const v = inp.value.trim();
          if (v && !p.conditions.includes(v)) S.update(() => p.conditions.push(v));
          inp.value = '';
        });
        return b;
      })()
    ]));
    UI.modal({ title: 'Conditions — ' + p.name, body, buttons: [{ label: 'Done', cls: 'primary' }] });
  }

  // ---------------------------------------------------------------- character sheet
  V.openCharacter = function (playerId, focusField) {
    const p = S.player(playerId);
    if (!p) return;
    const body = el('div.char-sheet');

    const header = el('div.row', { style: { gap: '12px', marginBottom: '6px' } }, [
      (() => {
        const av = el('div.avatar.lg', { text: p.emoji || U.initials(p.name) });
        av.style.background = 'linear-gradient(150deg, ' + p.color + ', rgba(20,16,28,.9))';
        return av;
      })(),
      el('div', {}, [
        el('div.eyebrow', { text: [p.ancestry, p.className, 'Level ' + p.level].filter(Boolean).join(' · ') }),
        el('div', { style: { fontFamily: 'var(--serif)', fontSize: '19px', fontWeight: '700' } }, [p.name]),
        el('div.small.dim', { text: p.player ? 'Played by ' + p.player : '' })
      ]),
      el('span.spacer'),
      (() => {
        const b = el('button.btn.xs.gold', { text: p.inspiration ? '★ Inspired' : '☆ Inspire' });
        b.addEventListener('click', () => { S.update(() => p.inspiration = !p.inspiration); V.openCharacter(p.id); V.refresh(); });
        return b;
      })()
    ]);
    body.appendChild(header);

    // vitals
    const vitals = el('div.grid.g4', { style: { margin: '14px 0' } });
    vitals.appendChild(numField('AC', p.ac, v => { p.ac = v; syncCombatant(p); }, { min: 1, max: 40 }));
    vitals.appendChild(numField('Max HP', p.maxHp, v => { p.maxHp = Math.max(1, v); p.hp = Math.min(p.hp, p.maxHp); syncCombatant(p); }, { min: 1 }));
    vitals.appendChild(numField('Current HP', p.hp, v => { p.hp = U.clamp(v, 0, p.maxHp); }, { min: 0, max: p.maxHp }));
    vitals.appendChild(numField('Temp HP', p.tempHp, v => { p.tempHp = Math.max(0, v); }, { min: 0 }));
    vitals.appendChild(numField('Initiative', p.initiativeBonus, v => { p.initiativeBonus = v; }, { min: -10, max: 20 }));
    vitals.appendChild(numField('Speed (ft)', parseInt(p.speed, 10) || 30, v => { p.speed = v + ' ft.'; }, { min: 0 }));
    vitals.appendChild(numField('Passive Per.', p.passivePerception || 10 + U.mod(p.stats.wis), v => { p.passivePerception = v; }, { min: 1 }));
    vitals.appendChild(el('div.field', {}, [
      el('label.label', { text: 'Inspiration' }),
      (() => {
        const b = el('button.btn' + (p.inspiration ? '.gold' : ''), { text: p.inspiration ? '★ Inspired' : 'Not inspired' });
        b.addEventListener('click', () => { S.update(() => p.inspiration = !p.inspiration); V.openCharacter(p.id); V.refreshSheet(); });
        return b;
      })()
    ]));
    body.appendChild(vitals);

    // details
    body.appendChild(el('div.label', { text: 'Identity', style: { margin: '10px 0 6px' } }));
    body.appendChild(el('div.grid.g2', {}, [
      textField('Character name', p.name, v => { p.name = v || 'Unnamed'; syncCombatant(p); }, 'charName'),
      textField('Player', p.player, v => p.player = v),
      textField('Ancestry / species', p.ancestry, v => p.ancestry = v),
      textField('Class & subclass', p.className, v => p.className = v),
      numField('Level', p.level, v => p.level = U.clamp(v, 1, 20), { min: 1, max: 20 }),
      textField('Concentration', p.concentration, v => p.concentration = v, '', 'e.g. Bless')
    ]));

    // abilities
    body.appendChild(el('div.label', { text: 'Ability scores', style: { margin: '16px 0 6px' } }));
    const abil = el('div.grid.g6');
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => {
      const mod = U.modStr(p.stats[k]);
      const wrap = el('div.field', {}, [
        el('label.label', { text: k.toUpperCase() + '  ' + mod }),
        (() => {
          const inp = el('input', { type: 'number', value: p.stats[k], min: 1, max: 30 });
          inp.addEventListener('change', () => {
            S.update(() => { p.stats[k] = U.clamp(U.num(inp.value, 10), 1, 30); });
            inp.parentElement.querySelector('label').textContent = k.toUpperCase() + '  ' + U.modStr(p.stats[k]);
            V.refreshSheet();
          });
          return inp;
        })()
      ]);
      abil.appendChild(wrap);
    });
    body.appendChild(abil);

    // conditions + slots
    body.appendChild(el('div.row', { style: { justifyContent: 'space-between', margin: '16px 0 6px' } }, [
      el('div.label', { text: 'Conditions' }),
      (() => { const b = el('button.link-btn', { text: 'Manage' }); b.addEventListener('click', () => conditionPicker(p)); return b; })()
    ]));
    body.appendChild(el('div.row.wrap', { style: { gap: '4px' } }, p.conditions.length
      ? p.conditions.map(c => el('span.cond-pill', { text: c }))
      : [el('span.small.dim', { text: 'None' })]));

    // spell slots
    const slotWrap = el('div', { style: { marginTop: '16px' } }, [el('div.label', { text: 'Spell slots', style: { marginBottom: '6px' } })]);
    const maxLevel = 9;
    const slotGrid = el('div.grid.g5');
    for (let l = 1; l <= maxLevel; l++) {
      const s = p.spellSlots[l] || { max: 0, used: 0 };
      const f = el('div.field', {}, [
        el('label.label', { text: 'Level ' + l }),
        el('div.input-row', {}, [
          (() => {
            const inp = el('input', { type: 'number', value: s.max, min: 0, max: 9, title: 'Max slots', style: { width: '56px' } });
            inp.addEventListener('change', () => {
              S.update(() => {
                const val = U.clamp(U.num(inp.value, 0), 0, 9);
                if (!val) delete p.spellSlots[l];
                else { p.spellSlots[l] = p.spellSlots[l] || { max: 0, used: 0 }; p.spellSlots[l].max = val; p.spellSlots[l].used = Math.min(p.spellSlots[l].used || 0, val); }
              });
              V.openCharacter(p.id);
            });
            return inp;
          })(),
          (() => {
            const inp = el('input', { type: 'number', value: s.used, min: 0, max: s.max || 9, title: 'Used', style: { width: '56px' } });
            inp.addEventListener('change', () => {
              S.update(() => {
                if (p.spellSlots[l]) p.spellSlots[l].used = U.clamp(U.num(inp.value, 0), 0, p.spellSlots[l].max);
              });
            });
            return inp;
          })()
        ])
      ]);
      slotGrid.appendChild(f);
    }
    slotWrap.appendChild(slotGrid);
    body.appendChild(slotWrap);

    // inventory
    body.appendChild(el('div.row', { style: { justifyContent: 'space-between', margin: '18px 0 8px' } }, [
      el('div.label', { text: 'Inventory' }),
      (() => {
        const b = el('button.btn.xs', { text: '+ Add item' });
        b.addEventListener('click', () => addInventoryItem(p));
        return b;
      })()
    ]));
    const inv = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
    if (!p.inventory.length) inv.appendChild(el('div.small.dim', { text: 'Nothing carried yet. Drop an item from search onto the character card, or add one here.' }));
    p.inventory.forEach(item => {
      const row = el('div.row', { style: { padding: '7px 9px', border: '1px solid var(--line)', borderRadius: '7px', gap: '8px' } }, [
        el('span', { style: { flex: '1', fontSize: '12px' } }, [item.name + (item.source ? ' ' : '')]),
        el('span.tag', { text: item.source || 'custom' }),
        el('span.mono.small', { text: '×' + (item.qty || 1) }),
        (() => {
          const b = el('button.hp-btn', { text: '−', title: 'Decrease' });
          b.addEventListener('click', (e) => { e.stopPropagation(); S.update(() => { item.qty = (item.qty || 1) - 1; if (item.qty <= 0) p.inventory = p.inventory.filter(i => i.id !== item.id); }); V.openCharacter(p.id); });
          return b;
        })(),
        (() => {
          const b = el('button.hp-btn', { text: '+', title: 'Increase' });
          b.addEventListener('click', (e) => { e.stopPropagation(); S.update(() => item.qty = (item.qty || 1) + 1); V.openCharacter(p.id); });
          return b;
        })(),
        (() => {
          const b = el('button.hp-btn', { title: 'Remove', html: '<svg style="width:12px;height:12px"><use href="#i-trash"/></svg>' });
          b.addEventListener('click', (e) => { e.stopPropagation(); S.update(() => p.inventory = p.inventory.filter(i => i.id !== item.id)); V.openCharacter(p.id); });
          return b;
        })()
      ]);
      if (item.source && DM.data.item(item.name, item.source)) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', (e) => { if (e.target.closest('button')) return; UI.openItem(item.name, item.source); });
      }
      UI.draggable(row, () => ({ type: 'item', name: item.name, source: item.source || '', fromPlayerId: p.id, invId: item.id }));
      inv.appendChild(row);
    });
    body.appendChild(inv);

    // notes
    body.appendChild(el('div.label', { text: 'Notes & secrets', style: { margin: '18px 0 6px' } }));
    const notes = el('textarea', { rows: 6, placeholder: 'Backstory, secrets, plot hooks, bonds…' });
    notes.value = p.notes || '';
    notes.addEventListener('change', () => S.update(() => p.notes = notes.value));
    body.appendChild(notes);

    body.appendChild(el('div.row', { style: { marginTop: '18px', justifyContent: 'space-between' } }, [
      (() => {
        const b = el('button.btn.danger.sm', {}, [U.svg('trash'), el('span', { text: 'Delete character' })]);
        b.addEventListener('click', async () => {
          if (await UI.confirm({ title: 'Delete ' + p.name + '?', message: 'This removes the character and any combatant linked to them. This cannot be undone.', confirm: 'Delete', danger: true })) {
            S.removePlayer(p.id); UI.closeDrawer(); V.refresh();
          }
        });
        return b;
      })(),
      el('span.small.dim', { text: 'Changes save automatically' })
    ]));

    UI.drawer({
      title: p.name,
      body,
      tools: [
        { icon: 'dice', title: 'Roll a d20 check', onClick: () => UI.rollCheck(0, { label: p.name }) },
        { icon: 'swords', title: 'Add to initiative', onClick: () => { S.addPlayerCombatant(p.id); UI.toast(p.name + ' joined initiative'); } },
        { icon: 'scroll', title: 'Create a character sheet', onClick: () => { UI.closeDrawer(); DM.views.sheets.createFromPlayer(p.id); } }
      ]
    });
    if (focusField === 'name') setTimeout(() => { const i = body.querySelector('#charName'); if (i) { i.focus(); i.select(); } }, 80);
  };

  V.refreshSheet = function () { /* grid refresh while drawer stays open */ V.refresh(); };

  function textField(label, value, onchange, id, placeholder) {
    const inp = el('input', { type: 'text', value: value || '', placeholder: placeholder || '', id: id || null });
    inp.addEventListener('change', () => { S.update(() => onchange(inp.value)); V.refresh(); });
    return el('div.field', {}, [el('label.label', { text: label }), inp]);
  }
  function numField(label, value, onchange, opts) {
    opts = opts || {};
    const inp = el('input', { type: 'number', value: value == null ? '' : String(value), min: opts.min, max: opts.max });
    inp.addEventListener('change', () => { S.update(() => onchange(U.num(inp.value, opts.min || 0))); V.refresh(); });
    return el('div.field', {}, [el('label.label', { text: label }), inp]);
  }

  function addInventoryItem(p) {
    const name = el('input', { type: 'text', placeholder: 'Item name' });
    const qty = el('input', { type: 'number', value: '1', min: '1' });
    const source = el('input', { type: 'text', placeholder: 'Source (optional, e.g. DMG)' });
    const body = el('div', {}, [
      el('div.field', {}, [el('label.label', { text: 'Item' }), name]),
      el('div.grid.g2', {}, [el('div.field', {}, [el('label.label', { text: 'Quantity' }), qty]), el('div.field', {}, [el('label.label', { text: 'Source' }), source])])
    ]);
    UI.modal({
      title: 'Add to ' + p.name + '’s inventory',
      body,
      buttons: [
        { label: 'Cancel', cls: 'ghost' },
        {
          label: 'Add', cls: 'primary', onClick: () => {
            if (!name.value.trim()) return;
            S.update(() => p.inventory.push({ id: U.uid('inv'), name: name.value.trim(), source: source.value.trim(), qty: Math.max(1, U.num(qty.value, 1)) }));
            UI.closeModal(); V.openCharacter(p.id);
          }
        }
      ]
    });
  }

  function syncCombatant(p) {
    const c = S.state.encounter.combatants.find(x => x.playerId === p.id);
    if (c) { c.name = p.name; c.ac = p.ac; c.maxHp = p.maxHp; }
  }

  V.longRest = function () {
    if (!S.state.players.length) { UI.toast('No party to rest.'); return; }
    S.update(s => {
      s.players.forEach(p => {
        p.hp = p.maxHp;
        p.tempHp = 0;
        p.conditions = [];
        p.concentration = '';
        p.deathSaves = { successes: 0, failures: 0 };
        Object.values(p.spellSlots || {}).forEach(sl => sl.used = 0);
      });
    });
    V.refresh();
    UI.toast('🌙 The party takes a long rest — HP, slots and conditions restored.');
  };

  V.refresh = function () {
    if (!rootEl || !rootEl.isConnected) return;
    const scroll = document.getElementById('main').scrollTop;
    const old = rootEl;
    const fresh = V.render();
    old.replaceWith(fresh);
    rootEl = fresh;
    document.getElementById('main').scrollTop = scroll;
    DM.ui.renderNav();
  };

  DM.bus.on('state', () => {
    if (DM.currentView === 'party') {
      // Light refresh when external changes (damage from initiative) occur.
      if (document.getElementById('drawer').classList.contains('open')) return;
      V.refresh();
    }
  });
})();
