/* App bootstrap: routing, timer, global drops, actions, homebrew editor */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui, R = DM.render;
  DM.currentView = 'dashboard';

  // ---------------------------------------------------------------- router
  const VIEWS = ['dashboard', 'party', 'sheets', 'initiative', 'grid', 'bestiary', 'compendium', 'encounters', 'cos', 'notes', 'settings'];

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    let view = parts[0] || 'dashboard';
    if (!VIEWS.includes(view)) view = 'dashboard';
    return { view, params: parts.slice(1) };
  }

  DM.navigate = function (view, opts) {
    opts = opts || {};
    if (!VIEWS.includes(view)) view = 'dashboard';
    const target = '#/' + view + (opts.suffix || '');
    if (location.hash === target) renderView(view, opts);
    else location.hash = target;
  };

  function renderView(view, opts) {
    opts = opts || {};
    if (UI.paletteOpen()) UI.closePalette();
    UI.closeDrawer();
    UI.closeModal();
    DM.currentView = view;
    const main = document.getElementById('main');
    main.innerHTML = '';
    main.scrollTop = 0;
    let node = null;
    try {
      if (view === 'dashboard') node = DM.views.dashboard.render();
      else if (view === 'party') node = DM.views.party.render();
      else if (view === 'sheets') node = DM.views.sheets.render(opts);
      else if (view === 'initiative') node = DM.views.initiative.render();
      else if (view === 'grid') node = DM.views.grid.render();
      else if (view === 'bestiary') node = DM.views.bestiary.render(opts);
      else if (view === 'compendium') node = DM.views.compendium.render(opts);
      else if (view === 'encounters') node = DM.views.encounters.render();
      else if (view === 'cos') node = DM.views.cos.render(opts);
      else if (view === 'notes') node = DM.views.notes.render();
      else if (view === 'settings') node = DM.views.settings.render();
    } catch (e) {
      console.error(e);
      node = el('div.view', {}, [
        el('div.empty', {}, [
          el('h3', { text: 'Something went wrong rendering this screen' }),
          el('p', { text: String(e.message || e) }),
          (() => { const b = el('button.btn', { text: 'Reload' }); b.addEventListener('click', () => location.reload()); return b; })()
        ])
      ]);
    }
    main.appendChild(node);
    UI.renderNav();
    DM.views.initiative.renderDock();
    S.state.settings.lastView = view;
    S.save();
    if (opts.after) setTimeout(opts.after, 80);
  }
  DM.renderView = renderView;

  function route() {
    const { view, params } = parseHash();
    const opts = {};
    if (view === 'cos' && params[0]) {
      const tabAliases = ['chapters', 'reading', 'npcs', 'locations', 'maps'];
      if (tabAliases.includes(params[0])) {
        DM.views.cos.tab = params[0];
      } else {
        DM.views.cos.tab = 'chapters';
        DM.views.cos.chapterId = params[0];
        opts.chapterId = params[0];
      }
    }
    if (view === 'compendium' && params[0]) opts.query = decodeURIComponent(params[0]);
    if (view === 'sheets' && params[0]) opts.open = decodeURIComponent(params[0]);
    if (view === 'bestiary' && params[0]) {
      const q = decodeURIComponent(params.join('/'));
      opts.query = q;
      opts.after = () => {
        const exact = DM.data.monster(q);
        if (exact) { UI.openMonster(exact.name, exact.source); return; }
        const hit = DM.search.query(q, { kind: 'monster', limit: 1 })[0];
        if (hit) UI.openMonster(hit.doc.ref.name, hit.doc.ref.source);
      };
    }
    renderView(view, opts);
  }
  window.addEventListener('hashchange', route);

  // ---------------------------------------------------------------- timer
  let timerInterval = null;
  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const d = document.getElementById('timerDisplay');
      if (d) d.textContent = U.fmtDuration(S.timerElapsed());
      const s = document.getElementById('settingsTimer');
      if (s && DM.currentView === 'settings') s.textContent = U.fmtDuration(S.timerElapsed());
      const btn = document.getElementById('timerToggle');
      if (btn) {
        const icon = btn.querySelector('use');
        if (icon) icon.setAttribute('href', S.state.session.running ? '#i-pause' : '#i-play');
        btn.setAttribute('aria-label', S.state.session.running ? 'Pause session timer' : 'Start session timer');
      }
    }, 1000);
  }

  // ---------------------------------------------------------------- actions
  const A = {};
  DM.actions = A;

  A.rollAllInit = function () {
    if (!S.state.encounter.combatants.length) { UI.toast('No combatants in the tracker.'); return; }
    S.rollAllInitiative();
    UI.toast('🎲 Initiative rolled for <b>' + S.state.encounter.combatants.length + '</b> combatants');
    DM.views.initiative.renderDock();
  };

  A.drawTarokka = function () {
    const cards = DM.data.tarokka.cards || [];
    if (!cards.length) { UI.toast('Tarokka deck is not loaded.'); return; }
    const card = U.pick(cards);
    UI.openTarokka(card.name);
  };

  A.randomEncounter = function () {
    DM.navigate('encounters');
    setTimeout(() => { if (DM.views.encounters.random) DM.views.encounters.random(); }, 90);
  };

  A.longRest = function () { DM.views.party.longRest(); };

  A.newNote = function () { DM.views.notes.newNote(); };

  A.exportData = function () { DM.views.settings.exportData(); };

  A.addToEncounter = function (monster) {
    if (!monster) return;
    if (DM.currentView === 'encounters') {
      DM.views.encounters.addMonster(monster.name, monster.source, 1);
    } else {
      DM.views.encounters.addMonster(monster.name, monster.source, 1);
      DM.navigate('encounters');
    }
    UI.toast('Added <b>' + U.esc(monster.name) + '</b> to the encounter draft');
  };

  A.gotoCos = function (chapterId, anchor, name) {
    DM.views.cos.tab = 'chapters';
    DM.views.cos.chapterId = chapterId || '013';
    S.update(s => s.cos.activeChapter = DM.views.cos.chapterId);
    DM.navigate('cos');
    setTimeout(() => {
      if (anchor) {
        DM.views.cos.scrollToAnchor(anchor);
      } else if (name) {
        const main = document.getElementById('main');
        if (main) main.scrollTop = 0;
      }
    }, 140);
  };

  A.gotoArea = function (id) {
    // `{@area chapter 2|0a0|x}` points at a chapter id rather than an area anchor.
    if (DM.data.cosChapter(id)) { A.gotoCos(id, '', ''); return; }
    const docs = DM.search.byKind('area');
    const doc = docs.find(d => d.ref && d.ref.anchor === id) || docs.find(d => d.ref && d.ref.sectionName && d.ref.sectionName.toLowerCase() === String(id).toLowerCase());
    if (doc) A.gotoCos(doc.ref.chapterId, doc.ref.anchor, doc.name);
    else UI.toast('Location reference not found: ' + U.esc(id));
  };

  A.spellToNote = function (sp) {
    const meta = [Number(sp.level) === 0 ? 'Cantrip' : 'Level ' + sp.level, sp.school ? sp.school.charAt(0).toUpperCase() + sp.school.slice(1) : '', (sp.time || []).map(t => t.number + ' ' + t.unit).join(', '), sp.range ? (sp.range.type === 'point' ? sp.range.distance.amount + ' ' + sp.range.distance.type : sp.range.type) : '', sp.duration ? sp.duration.map(d => d.type === 'instant' ? 'Instantaneous' : (d.duration ? (d.concentration ? 'Concentration, up to ' : '') + d.duration.amount + ' ' + d.duration.type : '')).join(', ') : ''].filter(Boolean).join(' · ');
    const body = '## ' + sp.name + '\n\n*' + meta + '*\n\n' + strip(R.entries(sp.entries)).replace(/\n+/g, '\n\n') + (sp.entriesHigherLevel ? '\n\n### At higher levels\n\n' + strip(R.entries(sp.entriesHigherLevel)) : '');
    const note = S.addNote({ title: sp.name, body });
    UI.toast('Spell copied to notes.');
    DM.navigate('notes');
    setTimeout(() => DM.views.notes.open(note.id), 80);
  };

  function strip(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').replace(/[ \t]+/g, ' ').trim();
  }

  // ---------------------------------------------------------------- homebrew
  let homebrewCount = 0;
  function nextHomebrewId(kind) { return 'hb_' + kind + '_' + Date.now().toString(36) + '_' + (homebrewCount++); }

  A.newHomebrew = function (kind, src) { openBrewEditor(kind, src || null); };
  A.cloneItem = function (item) { openBrewEditor('item', item); };
  A.cloneMonster = function (monster) { openBrewEditor('monster', monster); };
  A.editHomebrew = function (kind, obj) { openBrewEditor(kind, obj, obj); };

  function openBrewEditor(kind, sourceItem, edit) {
    const isEdit = !!edit;
    const isClone = !!sourceItem && !isEdit;
    const title = isEdit ? 'Edit ' + sourceItem.name : (isClone ? 'Customise ' + sourceItem.name : 'New homebrew ' + kind);
    let body, save;

    if (kind === 'item') {
      const src = sourceItem || {};
      const base = src.baseItem ? DM.data.baseItem(src.baseItem) : null;
      const name = el('input', { type: 'text', value: src.name ? (isClone ? src.name + ' (custom)' : src.name) : '', placeholder: 'e.g. Blade of the Morninglord' });
      const type = el('select', {});
      [['W', 'Wondrous item'], ['M', 'Melee weapon'], ['R', 'Ranged weapon'], ['LA', 'Light armor'], ['MA', 'Medium armor'], ['HA', 'Heavy armor'], ['S', 'Shield'], ['P', 'Potion'], ['SC', 'Scroll'], ['RG', 'Ring'], ['WD', 'Wand'], ['SCF', 'Spellcasting focus'], ['T', 'Tool'], ['G', 'Gear']].forEach(([v, l]) => type.appendChild(el('option', { value: v, text: l })));
      type.value = src.type || 'W';
      const rarity = el('select', {});
      ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies'].forEach(r => rarity.appendChild(el('option', { value: r, text: r.charAt(0).toUpperCase() + r.slice(1) })));
      rarity.value = src.rarity || 'uncommon';
      const attune = el('input', { type: 'checkbox', checked: !!src.reqAttune });
      const dmg1 = el('input', { type: 'text', value: src.dmg1 || (base && base.dmg1) || '', placeholder: '1d8' });
      const dmgType = el('select', {});
      dmgType.appendChild(el('option', { value: '', text: '—' }));
      U.DAMAGE_TYPES.forEach(d => dmgType.appendChild(el('option', { value: d, text: d.charAt(0).toUpperCase() + d.slice(1) })));
      dmgType.value = src.dmgType || (base && base.dmgType) || '';
      const weight = el('input', { type: 'number', value: src.weight != null ? src.weight : (base && base.weight != null ? base.weight : ''), min: '0', step: '0.5' });
      const value = el('input', { type: 'number', value: src.value != null ? Math.round(src.value / 100) : (base && base.value != null ? Math.round(base.value / 100) : ''), min: '0', step: '1', placeholder: 'gp' });
      const desc = el('textarea', { rows: 7, placeholder: 'What does it do?' });
      desc.value = src.entries ? strip(R.entries(src.entries)) : '';

      body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        field('Name', name),
        el('div.grid.g2', {}, [field('Type', type), field('Rarity', rarity)]),
        el('div.row', { style: { gap: '8px' } }, [attune, el('span.small', { text: 'Requires attunement' })]),
        el('div.grid.g4', {}, [field('Damage', dmg1), field('Damage type', dmgType), field('Weight (lb)', weight), field('Value (gp)', value)]),
        field('Description', desc)
      ]);
      save = () => {
        if (!name.value.trim()) { UI.toast('Give the item a name.'); return; }
        const entries = desc.value.split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
        const obj = {
          id: isEdit ? edit.id : nextHomebrewId('item'),
          name: name.value.trim(), source: 'HB', homebrew: true,
          type: type.value, rarity: rarity.value, reqAttune: attune.checked,
          dmg1: dmg1.value.trim() || undefined,
          dmgType: dmgType.value || undefined,
          weight: weight.value === '' ? undefined : Number(weight.value),
          value: value.value === '' ? undefined : Math.round(Number(value.value) * 100),
          entries: entries.length ? entries : ['A custom magic item.'],
          baseItem: src.baseItem
        };
        S.update(s => {
          const arr = s.homebrew.items;
          const i = arr.findIndex(x => x.id === obj.id);
          if (i >= 0) arr[i] = obj; else arr.push(obj);
        });
        DM.search.rebuildSoon();
        UI.closeModal();
        UI.toast('Saved <b>' + U.esc(obj.name) + '</b> to homebrew.');
        setTimeout(() => UI.openItem(obj.name, 'HB'), 120);
      };
    } else if (kind === 'spell') {
      const src = sourceItem || {};
      const name = el('input', { type: 'text', value: src.name ? (isClone ? src.name + ' (custom)' : src.name) : '', placeholder: 'e.g. Strahd’s Sigh' });
      const level = el('select', {});
      level.appendChild(el('option', { value: '0', text: 'Cantrip' }));
      for (let i = 1; i <= 9; i++) level.appendChild(el('option', { value: String(i), text: 'Level ' + i }));
      level.value = String(src.level || 1);
      const school = el('select', {});
      U.SCHOOLS.forEach(s => school.appendChild(el('option', { value: s.toLowerCase(), text: s })));
      school.value = src.school || 'necromancy';
      const time = el('input', { type: 'text', value: src.time ? src.time.map(t => t.number + ' ' + t.unit).join(', ') : '1 action' });
      const range = el('input', { type: 'text', value: src.range ? (src.range.type === 'point' ? src.range.distance.amount + ' ' + src.range.distance.type : src.range.type) : '60 feet' });
      const components = el('input', { type: 'text', value: 'V, S' });
      const duration = el('input', { type: 'text', value: 'Instantaneous' });
      const ritual = el('input', { type: 'checkbox', checked: !!(src && src.ritual) });
      const desc = el('textarea', { rows: 7, placeholder: 'Spell description…' });
      desc.value = src.entries ? strip(R.entries(src.entries)) : '';
      body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        field('Name', name),
        el('div.grid.g2', {}, [field('Level', level), field('School', school)]),
        el('div.grid.g2', {}, [field('Casting time', time), field('Range', range)]),
        el('div.grid.g2', {}, [field('Components', components), field('Duration', duration)]),
        el('div.row', { style: { gap: '8px' } }, [ritual, el('span.small', { text: 'Ritual' })]),
        field('Description', desc)
      ]);
      save = () => {
        if (!name.value.trim()) { UI.toast('Give the spell a name.'); return; }
        const lvl = Number(level.value);
        const tRaw = time.value.trim() || '1 action';
        const tm = tRaw.match(/^(\d+)\s*(.*)$/);
        const rRaw = range.value.trim() || '60 feet';
        const rm = rRaw.match(/^(\d+)\s*(.*)$/);
        const dRaw = duration.value.trim() || 'Instantaneous';
        const dm = dRaw.match(/(\d+)\s*(round|minute|hour|day|month|year)s?/i);
        const concentration = /concentration/i.test(dRaw);
        const durationObj = /instant/i.test(dRaw) ? { type: 'instant' }
          : /permanent/i.test(dRaw) ? { type: 'permanent' }
            : /special/i.test(dRaw) ? { type: 'special' }
              : { type: 'timed', duration: { amount: dm ? Number(dm[1]) : 1, type: dm ? dm[2].toLowerCase() : 'minute' }, concentration };
        const comp = components.value.toUpperCase();
        const obj = {
          id: isEdit ? edit.id : nextHomebrewId('spell'),
          name: name.value.trim(), source: 'HB', homebrew: true,
          level: lvl, school: school.value, ritual: ritual.checked,
          time: [{ number: tm ? Number(tm[1]) || 1 : 1, unit: tm ? (tm[2] || 'action') : 'action' }],
          range: /^self/i.test(rRaw) ? { type: 'self' } : /^touch/i.test(rRaw) ? { type: 'touch' } : rm ? { type: 'point', distance: { amount: Number(rm[1]) || 60, type: rm[2] || 'feet' } } : { type: 'special' },
          components: { v: comp.includes('V'), s: comp.includes('S'), m: comp.includes('M') ? 'a material component' : false },
          duration: [durationObj],
          entries: desc.value.split(/\n{2,}/).map(x => x.trim()).filter(Boolean)
        };
        S.update(s => {
          const arr = s.homebrew.spells;
          const i = arr.findIndex(x => x.id === obj.id);
          if (i >= 0) arr[i] = obj; else arr.push(obj);
        });
        DM.search.rebuildSoon();
        UI.closeModal();
        UI.toast('Saved <b>' + U.esc(obj.name) + '</b> to homebrew.');
        setTimeout(() => UI.openSpell(obj.name, 'HB'), 120);
      };
    } else {
      const src = sourceItem || {};
      const name = el('input', { type: 'text', value: src.name ? (isClone ? src.name + ' (custom)' : src.name) : '', placeholder: 'e.g. Strahd’s Shadow' });
      const size = el('select', {});
      Object.entries(U.SIZES).forEach(([k, v]) => size.appendChild(el('option', { value: k, text: v })));
      size.value = (src.size && src.size[0]) || 'M';
      const type = el('input', { type: 'text', value: src.type ? (src.type.type || src.type) : 'undead', placeholder: 'undead' });
      const alignment = el('input', { type: 'text', value: 'neutral evil' });
      const ac = el('input', { type: 'number', value: (() => { const a = src.ac; if (!a) return 12; if (typeof a === 'number') return a; if (Array.isArray(a)) return typeof a[0] === 'number' ? a[0] : (a[0] && a[0].ac) || 12; return a.ac || 12; })(), min: '1' });
      const hp = el('input', { type: 'number', value: src.hp ? (src.hp.average || src.hp) : 30, min: '1' });
      const cr = el('input', { type: 'text', value: src.cr !== undefined ? String(src.cr) : '1', style: { width: '80px' } });
      const stats = {};
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => { stats[k] = el('input', { type: 'number', value: src[k] || 10, min: '1', max: '30' }); });
      const desc = el('textarea', { rows: 7, placeholder: 'Traits, actions, tactics…' });
      desc.value = src.trait ? strip(R.entries(src.trait)) : '';

      body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        field('Name', name),
        el('div.grid.g3', {}, [field('Size', size), field('Type', type), field('Alignment', alignment)]),
        el('div.grid.g4', {}, [field('AC', ac), field('HP', hp), field('CR', cr)]),
        el('div.label', { text: 'Ability scores' }),
        el('div.grid.g6', {}, ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => field(k.toUpperCase(), stats[k]))),
        field('Traits & actions', desc)
      ]);
      save = () => {
        if (!name.value.trim()) { UI.toast('Give the monster a name.'); return; }
        const obj = {
          id: isEdit ? edit.id : nextHomebrewId('monster'),
          name: name.value.trim(), source: 'HB', homebrew: true,
          size: [size.value], type: { type: type.value.trim().toLowerCase() || 'humanoid' },
          alignment: [alignment.value.trim() || 'neutral'],
          ac: [{ ac: Number(ac.value) || 10 }],
          hp: { average: Number(hp.value) || 1, formula: '' },
          speed: { walk: 30 },
          str: Number(stats.str.value) || 10, dex: Number(stats.dex.value) || 10, con: Number(stats.con.value) || 10,
          int: Number(stats.int.value) || 10, wis: Number(stats.wis.value) || 10, cha: Number(stats.cha.value) || 10,
          cr: cr.value.trim() || '1',
          trait: [{ name: 'Traits', entries: desc.value.split(/\n{2,}/).map(x => x.trim()).filter(Boolean) }]
        };
        S.update(s => {
          const arr = s.homebrew.monsters;
          const i = arr.findIndex(x => x.id === obj.id);
          if (i >= 0) arr[i] = obj; else arr.push(obj);
        });
        DM.search.rebuildSoon();
        UI.closeModal();
        UI.toast('Saved <b>' + U.esc(obj.name) + '</b> to homebrew.');
        setTimeout(() => UI.openMonster(obj.name, 'HB'), 120);
      };
    }

    function field(label, node) {
      return el('div.field', {}, [el('label.label', { text: label }), node]);
    }

    UI.modal({
      title,
      body,
      buttons: [
        { label: 'Cancel', cls: 'ghost' },
        { label: isEdit ? 'Save changes' : (isClone ? 'Save custom copy' : 'Save homebrew'), cls: 'primary', onClick: save },
        ...(isEdit ? [{
          label: 'Delete', cls: 'danger', onClick: (btn) => {
            if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Click again to delete'; return; }
            const key = kind === 'item' ? 'items' : kind === 'spell' ? 'spells' : 'monsters';
            S.update(s => { s.homebrew[key] = s.homebrew[key].filter(x => x.id !== edit.id); });
            DM.search.rebuildSoon();
            UI.closeModal();
            UI.toast('Deleted <b>' + U.esc(edit.name) + '</b>');
          }
        }] : [])
      ]
    });
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    UI.init();
    UI.initPalette();
    UI.initDice();
    startTimerLoop();
    UI.renderNav();

    // campaign rename
    document.getElementById('campaignBtn').addEventListener('click', async () => {
      const name = await UI.prompt({ title: 'Campaign name', label: 'Shown in the top bar', value: S.state.campaign.name, confirm: 'Rename' });
      if (name !== null && name.trim()) {
        S.update(s => s.campaign.name = name.trim());
        document.getElementById('campaignName').textContent = name.trim();
        document.title = name.trim() + " — MBG's GameMaster Screen";
      }
    });
    document.getElementById('campaignName').textContent = S.state.campaign.name;
    document.title = S.state.campaign.name + " — MBG's GameMaster Screen";

    // nav toggle
    document.getElementById('navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    document.getElementById('helpBtn').addEventListener('click', () => UI.shortcuts());

    // timer buttons
    document.getElementById('timerToggle').addEventListener('click', (e) => { e.stopPropagation(); S.toggleTimer(); });
    (() => {
      const use = document.querySelector('#timerToggle use');
      if (use) use.setAttribute('href', S.state.session.running ? '#i-pause' : '#i-play');
    })();
    document.getElementById('timerReset').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (await UI.confirm({ title: 'Reset session timer?', message: 'This sets the clock back to 0:00:00.', confirm: 'Reset' })) S.resetTimer();
    });

    // dock controls
    document.getElementById('dockExpand').addEventListener('click', () => DM.navigate('initiative'));
    document.getElementById('dockNext').addEventListener('click', () => { S.nextTurn(1); DM.views.initiative.renderDock(); });
    document.getElementById('dockPrev').addEventListener('click', () => { S.nextTurn(-1); DM.views.initiative.renderDock(); });
    document.getElementById('dockOpen')?.addEventListener('click', () => DM.navigate('initiative'));

    // global drop zone: initiative bar
    UI.dropzone(document.getElementById('dock'), (payload) => {
      if (payload.type === 'monster') {
        const m = DM.data.monster(payload.name, payload.source);
        if (m) { S.addMonsterCombatant(m, 1); UI.toast('🎲 <b>' + U.esc(m.name) + '</b> rolled into initiative'); }
      } else if (payload.type === 'player') {
        const c = S.addPlayerCombatant(payload.playerId);
        if (c) UI.toast('🎲 <b>' + U.esc(payload.name) + '</b> rolled into initiative');
        else UI.toast(U.esc(payload.name) + ' is already in initiative');
      } else if (payload.type === 'item') {
        UI.toast('Drop items onto a party card to add them to an inventory.');
      }
      DM.views.initiative.renderDock();
    }, {});

    // global drag safety
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    // keyboard
    document.addEventListener('keydown', handleKey);

    // nav + state
    DM.bus.on('state', () => {
      UI.renderNav();
      const nameEl = document.getElementById('campaignName');
      if (nameEl && nameEl.textContent !== S.state.campaign.name) nameEl.textContent = S.state.campaign.name;
    });
    DM.bus.on('drawer-closed', () => { if (DM.currentView === 'party') DM.views.party.refresh(); });
    DM.bus.on('search-ready', () => { /* warm done */ });

    window.addEventListener('beforeunload', () => S.save(true));

    if (!location.hash) {
      location.hash = '#/dashboard';
    } else {
      route();
    }
    DM.views.initiative.renderDock();
    startTimerLoop();
    console.info("MBG's GameMaster Screen ready. " + DM.data.monsters.length + ' monsters, ' + DM.data.items.length + ' items, ' + DM.data.spells.length + ' spells.');
  }

  function handleKey(e) {
    const typing = e.target && (e.target.matches('input, textarea, select, [contenteditable="true"]'));
    const k = e.key;

    if ((e.ctrlKey || e.metaKey) && String(k).toLowerCase() === 'k') {
      e.preventDefault();
      UI.openPalette('');
      return;
    }
    if (e.altKey && /^[0-9]$/.test(k)) {
      e.preventDefault();
      const idx = k === '0' ? UI.NAV.length - 1 : Number(k) - 1;
      const item = UI.NAV[idx];
      if (item) DM.navigate(item.id);
      return;
    }
    if (e.altKey && String(k).toLowerCase() === 'm') {
      e.preventDefault();
      DM.navigate('grid');
      return;
    }
    if (k === 'Escape') {
      if (UI.paletteOpen()) UI.closePalette();
      else if (document.getElementById('modalWrap').classList.contains('open')) UI.closeModal();
      else if (UI.isDrawerOpen()) UI.closeDrawer();
      else if (document.getElementById('dicePop').classList.contains('open')) document.getElementById('dicePop').classList.remove('open');
      else if (DM.currentView === 'grid' && DM.views.grid.cancelMeasure()) { /* handled */ }
      document.body.classList.remove('nav-open');
      return;
    }
    if (typing || UI.paletteOpen() || document.getElementById('modalWrap').classList.contains('open')) return;

    if (k === '?' || (k === '/' && e.shiftKey)) { e.preventDefault(); UI.shortcuts(); return; }
    if (k === '/') {
      e.preventDefault();
      if (DM.currentView === 'compendium') DM.views.compendium.focus();
      else if (DM.currentView === 'bestiary') { const i = document.getElementById('bestiarySearch'); if (i) i.focus(); }
      else UI.openPalette('/');
      return;
    }
    if (k === 'n' || k === 'N') {
      if (S.state.encounter.combatants.length) { e.preventDefault(); S.nextTurn(1); DM.views.initiative.renderDock(); }
      return;
    }
    if (k === 'p' || k === 'P') {
      if (S.state.encounter.combatants.length) { e.preventDefault(); S.nextTurn(-1); DM.views.initiative.renderDock(); }
      return;
    }
    if (k === 'd' || k === 'D') {
      e.preventDefault();
      const pop = document.getElementById('dicePop');
      pop.classList.toggle('open');
      return;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
