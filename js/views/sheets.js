/* Character sheet maker and PDF exporter */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.sheets = V;

  const SKILLS = [
    ['acrobatics', 'Acrobatics', 'dex'], ['animalHandling', 'Animal Handling', 'wis'], ['arcana', 'Arcana', 'int'], ['athletics', 'Athletics', 'str'],
    ['deception', 'Deception', 'cha'], ['history', 'History', 'int'], ['insight', 'Insight', 'wis'], ['intimidation', 'Intimidation', 'cha'],
    ['investigation', 'Investigation', 'int'], ['medicine', 'Medicine', 'wis'], ['nature', 'Nature', 'int'], ['perception', 'Perception', 'wis'],
    ['performance', 'Performance', 'cha'], ['persuasion', 'Persuasion', 'cha'], ['religion', 'Religion', 'int'], ['sleightOfHand', 'Sleight of Hand', 'dex'],
    ['stealth', 'Stealth', 'dex'], ['survival', 'Survival', 'wis']
  ];
  const SAVES = [['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'], ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma']];
  const ABIL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

  let rootEl = null;
  let formEl = null;
  let previewEl = null;
  let saveTimer = null;

  V.editing = null;

  // ---------------------------------------------------------------- render
  V.render = function (opts) {
    opts = opts || {};
    if (opts.open) V.editing = opts.open;
    const sheet = V.editing ? S.sheet(V.editing) : null;
    if (V.editing && !sheet) V.editing = null;
    previewEl = null;
    formEl = null;
    rootEl = sheet ? builder(sheet) : listView();
    return rootEl;
  };

  V.open = function (id) {
    V.editing = id;
    if (DM.currentView !== 'sheets') DM.navigate('sheets');
    else V.rerender();
  };

  V.create = function (partial) {
    const sheet = S.addSheet(partial || {});
    V.open(sheet.id);
    return sheet;
  };

  V.createFromPlayer = function (playerId) {
    const sheet = S.sheetFromPlayer(playerId);
    if (!sheet) { UI.toast('Party member not found.'); return; }
    V.open(sheet.id);
    UI.toast('Created a sheet for <b>' + U.esc(sheet.name) + '</b>. Fill in the mechanical details.');
  };

  function listView() {
    const root = el('div.view.sheets-view');
    root.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Character records' }),
        el('h1', { text: 'Character Sheets' }),
        el('p', { text: 'Build a character sheet, keep it saved in the campaign, and export a black-and-white raven sheet as a PDF. The artwork is a public-domain woodcut, not generated.' })
      ]),
      el('div.head-actions', {}, [
        (() => { const b = el('button.btn.sm', {}, [U.svg('users'), el('span', { text: 'Party sheets' })]); b.title = 'Create sheets for every party member who does not have one'; b.addEventListener('click', createPartySheets); return b; })(),
        (() => { const b = el('button.btn.sm', {}, [U.svg('scroll'), el('span', { text: 'From party member' })]); b.addEventListener('click', fromPartyDialog); return b; })(),
        (() => { const b = el('button.btn.primary', {}, [U.svg('plus'), el('span', { text: 'New sheet' })]); b.addEventListener('click', () => V.create()); return b; })()
      ])
    ]));

    const sheets = (S.state.sheets || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!sheets.length) {
      const empty = el('div.empty.sheet-empty', {}, [
        el('img', { src: 'assets/art/raven-wolf.jpg', alt: 'Public-domain raven woodcut' }),
        el('h3', { text: 'No character sheets yet' }),
        el('p', { text: 'Make a clean sheet for a player. Everything stays in your campaign save.' }),
        el('div.row', { style: { justifyContent: 'center', gap: '6px' } }, [
          (() => { const b = el('button.btn.primary', { text: 'Create a sheet' }); b.addEventListener('click', () => V.create()); return b; })()
        ])
      ]);
      root.appendChild(empty);
      return root;
    }

    const grid = el('div.sheet-list');
    sheets.forEach(sh => {
      const card = el('article.sheet-list-card', {});
      card.appendChild(el('div.sheet-list-top', {}, [
        el('img', { src: 'assets/art/raven-wolf.jpg', alt: '', class: 'sheet-list-raven' }),
        el('div', { style: { flex: '1', minWidth: '0' } }, [
          el('h3', { text: sh.name }),
          el('div.small.dim', { text: [sh.ancestry, sh.className + (sh.subclass ? ' (' + sh.subclass + ')' : ''), 'Level ' + sh.level].filter(Boolean).join(' · ') }),
          el('div.tiny-text.dim', { style: { marginTop: '3px' }, text: [sh.background, sh.player ? 'Played by ' + sh.player : ''].filter(Boolean).join(' · ') })
        ])
      ]));
      card.appendChild(el('div.sheet-list-foot', {}, [
        el('span.tiny-text.dim', { text: 'Updated ' + U.fmtRelative(sh.updatedAt || sh.createdAt) }),
        el('span.spacer'),
        (() => { const b = el('button.btn.xs', { text: 'Open' }); b.addEventListener('click', (e) => { e.stopPropagation(); V.open(sh.id); }); return b; })(),
        (() => { const b = el('button.btn.xs.gold', { text: 'PDF' }); b.addEventListener('click', async (e) => { e.stopPropagation(); V.open(sh.id); setTimeout(() => V.exportPDF(), 250); }); return b; })()
      ]));
      card.addEventListener('click', () => V.open(sh.id));
      grid.appendChild(card);
    });
    root.appendChild(grid);

    root.appendChild(el('div.tip-box', { style: { marginTop: '16px' }, html: '<b>Artwork credit.</b> The raven used in the sheet is a public-domain woodcut by Joseph Wolf / Joseph Swain, via Wikimedia Commons. Cormorant Garamond and Cinzel are SIL Open Font License. No AI-generated imagery is used.' }));
    return root;
  }

  // ---------------------------------------------------------------- builder
  function builder(sheet) {
    const root = el('div.view.sheets-view');
    const head = el('div.page-head.sheet-builder-head', {}, [
      el('div', {}, [
        el('div.row', { style: { gap: '8px' } }, [
          (() => { const b = el('button.btn.ghost.sm', { text: '← Sheets' }); b.addEventListener('click', () => { flushSave(); V.editing = null; V.rerender(); }); return b; })(),
          el('span.eyebrow', { text: 'Character record' })
        ]),
        el('h1', { text: sheet.name || 'New character' }),
        el('p', { text: 'Everything on this page updates the print sheet live. Long text is saved in the campaign and included in the PDF.' })
      ]),
      el('div.head-actions.sheet-actions', {}, [
        el('span.small.dim', { id: 'sheetSaveState', text: 'Saved' }),
        (() => { const b = el('button.btn.sm', {}, [U.svg('download'), el('span', { text: 'Export PDF' })]); b.addEventListener('click', () => V.exportPDF()); return b; })(),
        (() => { const b = el('button.btn.sm', {}, [U.svg('print'), el('span', { text: 'Print' })]); b.addEventListener('click', () => V.print()); return b; })(),
        (() => { const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'Duplicate' })]); b.addEventListener('click', () => { const copy = S.duplicateSheet(sheet.id); if (copy) V.open(copy.id); }); return b; })(),
        (() => { const b = el('button.btn.ghost.sm', {}, [U.svg('trash')]); b.title = 'Delete sheet'; b.addEventListener('click', async () => { if (await UI.confirm({ title: 'Delete sheet?', message: '“' + sheet.name + '” will be removed.', confirm: 'Delete', danger: true })) { S.deleteSheet(sheet.id); V.editing = null; V.rerender(); } }); return b; })()
      ])
    ]);
    root.appendChild(head);

    const layout = el('div.sheet-builder');
    formEl = el('div.sheet-form panel');
    const formHead = el('div.panel-head', {}, [
      el('h3', { text: 'Edit sheet' }),
      el('span.spacer'),
      el('span.small.dim', { text: 'Autosaves' })
    ]);
    formEl.appendChild(formHead);
    const formBody = el('div.sheet-form-body');
    formEl.appendChild(formBody);
    buildForm(formBody, sheet);
    layout.appendChild(formEl);

    const previewWrap = el('div.sheet-preview-wrap');
    const previewHead = el('div.sheet-preview-head', {}, [
      el('span', { text: 'Print preview · A4' }),
      el('span.spacer'),
      el('span.tiny-text', { text: 'Public-domain raven woodcut · 2 pages' })
    ]);
    previewWrap.appendChild(previewHead);
    previewEl = el('div.sheet-preview');
    previewEl.style.setProperty('--paper-w', '210mm');
    previewWrap.appendChild(previewEl);
    layout.appendChild(previewWrap);
    root.appendChild(layout);

    renderPreview(sheet);
    return root;
  }

  function buildForm(container, sheet) {
    const section = (title, open, children) => {
      const det = el('details.sheet-form-section', { open: open ? 'open' : null });
      det.appendChild(el('summary', { text: title }));
      const body = el('div.sheet-form-section-body');
      children.forEach(c => body.appendChild(c));
      det.appendChild(body);
      container.appendChild(det);
      return det;
    };
    const field = (label, node, cls) => el('div.field' + (cls ? '.' + cls : ''), {}, [el('label.label', { text: label }), node]);

    const textInput = (key, placeholder) => {
      const inp = el('input', { type: 'text', value: sheet[key] || '', placeholder: placeholder || '' });
      inp.addEventListener('input', () => { sheet[key] = inp.value; scheduleSave(sheet); renderPreview(sheet); if (key === 'name') { const h = rootEl && rootEl.querySelector('.page-head h1'); if (h) h.textContent = inp.value || 'New character'; } });
      return inp;
    };
    const numInput = (key, opts) => {
      const inp = el('input', { type: 'number', value: sheet[key] == null ? '' : String(sheet[key]), min: opts && opts.min, max: opts && opts.max });
      inp.addEventListener('input', () => {
        sheet[key] = opts && opts.float ? Number(inp.value) || 0 : U.num(inp.value, 0);
        if (key === 'level') sheet.level = U.clamp(sheet.level, 1, 20);
        scheduleSave(sheet); renderPreview(sheet);
      });
      return inp;
    };
    const area = (key, rows, placeholder) => {
      const ta = el('textarea', { rows: rows || 4, placeholder: placeholder || '' });
      ta.value = sheet[key] || '';
      ta.addEventListener('input', () => { sheet[key] = ta.value; scheduleSave(sheet); renderPreview(sheet); });
      return ta;
    };

    section('Identity', true, [
      el('div.grid.g2', {}, [field('Character name', textInput('name', 'e.g. Aria')), field('Player', textInput('player'))]),
      el('div.grid.g3', {}, [
        field('Class', textInput('className', 'e.g. Warlock')),
        field('Subclass', textInput('subclass', 'e.g. The Great Old One')),
        field('Level', numInput('level', { min: 1, max: 20 }))
      ]),
      el('div.grid.g3', {}, [
        field('Ancestry / species', textInput('ancestry', 'e.g. Raven')),
        field('Background', textInput('background', 'e.g. Familiar')),
        field('Alignment', textInput('alignment', 'e.g. Neutral good'))
      ]),
      field('Experience points', textInput('xp', '0'))
    ]);

    section('Combat', true, [
      el('div.grid.g4', {}, [
        field('Armor Class', numInput('ac', { min: 0 })), field('Initiative', numInput('initiative', { min: -20 })),
        field('Speed', textInput('speed', '30 ft.')), field('Hit dice', textInput('hitDice', '1d8'))
      ]),
      el('div.grid.g3', {}, [
        field('Max HP', numInput('hpMax', { min: 0 })), field('Current HP', numInput('hpCurrent', { min: 0 })),
        field('Temp HP', numInput('tempHp', { min: 0 }))
      ])
    ]);

    const abilityInputs = {};
    const abilityGrid = el('div.grid.g6');
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => {
      const inp = el('input', { type: 'number', value: String(sheet.abilities[k] || 10), min: 1, max: 30 });
      inp.addEventListener('input', () => { sheet.abilities[k] = U.clamp(U.num(inp.value, 10), 1, 30); scheduleSave(sheet); renderPreview(sheet); });
      abilityInputs[k] = inp;
      abilityGrid.appendChild(el('div.field', {}, [el('label.label', { text: k.toUpperCase() }), inp]));
    });
    section('Ability scores', true, [abilityGrid]);

    const saveList = el('div.sheet-prof-grid');
    SAVES.forEach(([k, label]) => {
      const row = el('div.sheet-prof-row', {}, [el('span', { text: label }), profButton(sheet, 'saveProf', k, 1, () => { scheduleSave(sheet); renderPreview(sheet); })]);
      saveList.appendChild(row);
    });
    const skillList = el('div.sheet-prof-grid.two');
    SKILLS.forEach(([k, label, ab]) => {
      const row = el('div.sheet-prof-row', {}, [
        el('span', {}, [label, el('small.dim', { text: ' ' + ab.toUpperCase() })]),
        profButton(sheet, 'skillProf', k, 2, () => { scheduleSave(sheet); renderPreview(sheet); })
      ]);
      skillList.appendChild(row);
    });
    section('Saving throws & skills', true, [
      el('div.label', { text: 'Saving throws' }), saveList,
      el('div.label', { text: 'Skills  (— none · P proficient · E expertise)', style: { marginTop: '10px' } }), skillList
    ]);

    const attacksWrap = el('div');
    const paintAttacks = () => {
      attacksWrap.innerHTML = '';
      (sheet.attacks || []).forEach((atk, i) => {
        const row = el('div.sheet-attack-edit', {}, [
          (() => { const inp = el('input', { type: 'text', value: atk.name || '', placeholder: 'Attack / weapon' }); inp.addEventListener('input', () => { atk.name = inp.value; scheduleSave(sheet); renderPreview(sheet); }); return inp; })(),
          (() => { const inp = el('input', { type: 'text', value: atk.bonus || '', placeholder: '+5' }); inp.addEventListener('input', () => { atk.bonus = inp.value; scheduleSave(sheet); renderPreview(sheet); }); return inp; })(),
          (() => { const inp = el('input', { type: 'text', value: atk.damage || '', placeholder: '1d8+3' }); inp.addEventListener('input', () => { atk.damage = inp.value; scheduleSave(sheet); renderPreview(sheet); }); return inp; })(),
          (() => { const inp = el('input', { type: 'text', value: atk.notes || '', placeholder: 'notes / range' }); inp.addEventListener('input', () => { atk.notes = inp.value; scheduleSave(sheet); renderPreview(sheet); }); return inp; })(),
          (() => { const b = el('button.hp-btn', { title: 'Remove', text: '×' }); b.addEventListener('click', () => { sheet.attacks.splice(i, 1); scheduleSave(sheet); paintAttacks(); renderPreview(sheet); }); return b; })()
        ]);
        attacksWrap.appendChild(row);
      });
      const add = el('button.btn.xs', { text: '+ Add attack' });
      add.addEventListener('click', () => { sheet.attacks.push({ name: '', bonus: '', damage: '', notes: '' }); scheduleSave(sheet); paintAttacks(); renderPreview(sheet); });
      attacksWrap.appendChild(add);
    };
    paintAttacks();
    section('Attacks', true, [attacksWrap]);

    section('Features, proficiencies & gear', true, [
      field('Features & traits', area('features', 4, 'Class features, racial traits, feats…')),
      field('Proficiencies & languages', area('proficiencies', 3, 'Armor, weapons, tools, languages…')),
      field('Equipment', area('equipment', 3, 'Carried gear, armour, weapons…')),
      field('Treasure', area('treasure', 2, 'Coins, gems, art objects…'))
    ]);

    section('Spells', false, [
      el('div.grid.g3', {}, [
        field('Spellcasting ability', (() => {
          const sel = el('select', {});
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => sel.appendChild(el('option', { value: k, text: ABIL[k] })));
          sel.value = sheet.spellAbility || 'wis';
          sel.addEventListener('change', () => { sheet.spellAbility = sel.value; scheduleSave(sheet); renderPreview(sheet); });
          return sel;
        })()),
        field('Spell save DC', textInput('spellSaveDC', '13')),
        field('Spell attack bonus', textInput('spellAttack', '+5'))
      ]),
      ...([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => field(lvl === 0 ? 'Cantrips' : 'Level ' + lvl, (() => {
        const ta = el('textarea', { rows: lvl === 0 ? 2 : 1, placeholder: '' });
        ta.value = sheet.spells[lvl] || '';
        ta.addEventListener('input', () => { sheet.spells[lvl] = ta.value; scheduleSave(sheet); renderPreview(sheet); });
        return ta;
      })())))
    ]);

    section('Roleplay & journal', false, [
      el('div.grid.g2', {}, [field('Personality traits', area('personality', 3)), field('Ideals', area('ideals', 3))]),
      el('div.grid.g2', {}, [field('Bonds', area('bonds', 3)), field('Flaws', area('flaws', 3))]),
      field('Appearance', area('appearance', 3)),
      field('Backstory', area('backstory', 7)),
      field('Allies & organisations', area('allies', 3)),
      field('Notes', area('notes', 3))
    ]);
  }

  function profButton(sheet, group, key, max, onChange) {
    const b = el('button.sheet-prof-btn');
    const paint = () => {
      const v = Number((sheet[group] || {})[key] || 0);
      b.textContent = v === 0 ? '—' : v === 1 ? 'P' : 'E';
      b.classList.toggle('on', v > 0);
      b.dataset.state = String(v);
    };
    b.addEventListener('click', () => {
      const cur = Number((sheet[group] || {})[key] || 0);
      sheet[group] = sheet[group] || {};
      sheet[group][key] = cur >= max ? 0 : cur + 1;
      paint();
      if (onChange) onChange();
    });
    paint();
    return b;
  }

  // ---------------------------------------------------------------- preview
  function abilityMod(score) { return U.mod(score); }
  function fmt(n) { return (n >= 0 ? '+' : '') + n; }
  function profBonus(level) { return Math.floor((U.num(level, 1) - 1) / 4) + 2; }

  function sheetText(v) {
    const s = String(v == null ? '' : v);
    return U.esc(s).replace(/\n/g, '<br>');
  }

  function renderPreview(sheet) {
    if (!previewEl) return;
    previewEl.innerHTML = pageOne(sheet) + pageTwo(sheet);
  }

  function pageOne(sheet) {
    const pb = profBonus(sheet.level);
    const skillsHtml = SKILLS.map(([key, label, ab]) => {
      const p = Number((sheet.skillProf || {})[key] || 0);
      const bonus = abilityMod(sheet.abilities[ab]) + (p ? pb * p : 0);
      return '<div class="sheet-skill"><span class="prof-dot ' + (p ? 'filled' : '') + '"></span><span class="skill-name">' + U.esc(label) + '</span><span class="skill-ability">' + ab.toUpperCase() + '</span><b>' + fmt(bonus) + '</b></div>';
    }).join('');
    const savesHtml = SAVES.map(([k, label]) => {
      const p = !!(sheet.saveProf || {})[k];
      const bonus = abilityMod(sheet.abilities[k]) + (p ? pb : 0);
      return '<div class="sheet-save"><span class="prof-dot ' + (p ? 'filled' : '') + '"></span><span>' + U.esc(label) + '</span><b>' + fmt(bonus) + '</b></div>';
    }).join('');
    const attacks = (sheet.attacks || []).filter(a => a && (a.name || a.bonus || a.damage || a.notes));
    const attackRows = (attacks.length ? attacks : [null, null, null]).map(a => '<tr><td>' + sheetText(a ? a.name : '') + '</td><td class="center">' + sheetText(a ? a.bonus : '') + '</td><td class="center">' + sheetText(a ? a.damage : '') + '</td><td>' + sheetText(a ? a.notes : '') + '</td></tr>').join('');
    const passive = 10 + abilityMod(sheet.abilities.wis) + (Number((sheet.skillProf || {}).perception || 0) ? pb * Number((sheet.skillProf || {}).perception || 0) : 0);
    const spellAbility = ABIL[sheet.spellAbility] || '—';

    return `
    <div class="sheet-page">
      <div class="sheet-frame">
        <div class="sheet-ornament top"></div>
        <header class="sheet-header">
          <div class="sheet-header-text">
            <div class="sheet-kicker">GameMaster Character Record</div>
            <h1>${U.esc(sheet.name || 'Unnamed')}</h1>
            <div class="sheet-class">Level ${U.esc(String(sheet.level || 1))} ${U.esc(sheet.className || '')}${sheet.subclass ? ' <span>(' + U.esc(sheet.subclass) + ')</span>' : ''}</div>
            <div class="sheet-ident">${[sheet.ancestry, sheet.background, sheet.alignment, sheet.player ? 'Player: ' + sheet.player : ''].filter(Boolean).map(U.esc).join('  ·  ')}</div>
          </div>
          <img class="sheet-raven" src="assets/art/raven-wolf.jpg" alt="">
        </header>
        <div class="sheet-double-rule"></div>
        <div class="sheet-combat">
          <div class="sheet-stat"><span>Armor Class</span><b>${U.esc(sheet.ac)}</b></div>
          <div class="sheet-stat"><span>Initiative</span><b>${fmt(U.num(sheet.initiative, 0))}</b></div>
          <div class="sheet-stat"><span>Speed</span><b>${U.esc(sheet.speed || '—')}</b></div>
          <div class="sheet-stat wide"><span>Hit Points</span><b>${U.esc(sheet.hpCurrent)} / ${U.esc(sheet.hpMax)}</b></div>
          <div class="sheet-stat"><span>Temp HP</span><b>${U.esc(sheet.tempHp || 0)}</b></div>
          <div class="sheet-stat"><span>Hit Dice</span><b>${U.esc(sheet.hitDice || '—')}</b></div>
          <div class="sheet-stat"><span>Proficiency</span><b>${fmt(pb)}</b></div>
        </div>
        <div class="sheet-columns">
          <aside class="sheet-col-left">
            <div class="sheet-abilities">
              ${['str','dex','con','int','wis','cha'].map(k => `<div class="sheet-ability"><span>${k.toUpperCase()}</span><b>${sheet.abilities[k]}</b><em>${fmt(abilityMod(sheet.abilities[k]))}</em></div>`).join('')}
            </div>
            <h2 class="sheet-h2">Saving Throws</h2>
            <div class="sheet-saves">${savesHtml}</div>
            <h2 class="sheet-h2">Skills</h2>
            <div class="sheet-skills">${skillsHtml}</div>
            <div class="sheet-passive"><span>Passive Perception</span><b>${passive}</b></div>
            <h2 class="sheet-h2">Proficiencies & Languages</h2>
            <div class="sheet-text small">${sheetText(sheet.proficiencies) || '<span class="sheet-empty">—</span>'}</div>
            <div class="sheet-death">
              <span>Death saves</span>
              <div>${'○'.repeat(3)} successes</div>
              <div>${'○'.repeat(3)} failures</div>
            </div>
          </aside>
          <section class="sheet-col-right">
            <h2 class="sheet-h2">Attacks</h2>
            <table class="sheet-table"><thead><tr><th>Attack</th><th class="center">Bonus</th><th class="center">Damage</th><th>Notes</th></tr></thead><tbody>${attackRows}</tbody></table>
            <h2 class="sheet-h2">Features & Traits</h2>
            <div class="sheet-text">${sheetText(sheet.features) || '<span class="sheet-empty">—</span>'}</div>
            <h2 class="sheet-h2">Equipment</h2>
            <div class="sheet-text">${sheetText(sheet.equipment) || '<span class="sheet-empty">—</span>'}</div>
            <h2 class="sheet-h2">Treasure</h2>
            <div class="sheet-text">${sheetText(sheet.treasure) || '<span class="sheet-empty">—</span>'}</div>
            <h2 class="sheet-h2">Notes</h2>
            <div class="sheet-rule-lines">${'<i></i>'.repeat(9)}</div>
          </section>
        </div>
        <footer class="sheet-footer"><span>${U.esc(sheet.name || '')}</span><span>MBG's GameMaster Screen</span><span>1</span></footer>
        <img class="sheet-crow" src="assets/art/crow-cc0.svg" alt="">
      </div>
    </div>`;
  }

  function pageTwo(sheet) {
    const spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
      const text = (sheet.spells || {})[lvl] || '';
      if (!text) return '';
      return `<div class="sheet-spell-level"><span>${lvl === 0 ? 'Cantrips' : 'Level ' + lvl}</span><div>${sheetText(text)}</div></div>`;
    }).join('');
    const spellAbility = ABIL[sheet.spellAbility] || '—';
    return `
    <div class="sheet-page">
      <div class="sheet-frame">
        <div class="sheet-ornament top"></div>
        <header class="sheet-header compact">
          <div class="sheet-header-text">
            <div class="sheet-kicker">GameMaster Character Record</div>
            <h1>${U.esc(sheet.name || 'Unnamed')}</h1>
            <div class="sheet-class">Spells, story & bonds</div>
          </div>
          <img class="sheet-raven small" src="assets/art/raven-wolf.jpg" alt="">
        </header>
        <div class="sheet-double-rule"></div>
        <div class="sheet-spell-stats">
          <div><span>Spellcasting Ability</span><b>${U.esc(spellAbility)}</b></div>
          <div><span>Spell Save DC</span><b>${U.esc(sheet.spellSaveDC || '—')}</b></div>
          <div><span>Spell Attack</span><b>${U.esc(sheet.spellAttack || '—')}</b></div>
        </div>
        <h2 class="sheet-h2">Spells</h2>
        <div class="sheet-spells">${spellLevels || '<div class="sheet-empty">No spells recorded.</div>'}</div>
        <div class="sheet-roleplay">
          <div><h2 class="sheet-h2">Personality</h2><div class="sheet-text">${sheetText(sheet.personality) || '<span class="sheet-empty">—</span>'}</div></div>
          <div><h2 class="sheet-h2">Ideals</h2><div class="sheet-text">${sheetText(sheet.ideals) || '<span class="sheet-empty">—</span>'}</div></div>
          <div><h2 class="sheet-h2">Bonds</h2><div class="sheet-text">${sheetText(sheet.bonds) || '<span class="sheet-empty">—</span>'}</div></div>
          <div><h2 class="sheet-h2">Flaws</h2><div class="sheet-text">${sheetText(sheet.flaws) || '<span class="sheet-empty">—</span>'}</div></div>
        </div>
        <h2 class="sheet-h2">Appearance</h2>
        <div class="sheet-text">${sheetText(sheet.appearance) || '<span class="sheet-empty">—</span>'}</div>
        <h2 class="sheet-h2">Backstory</h2>
        <div class="sheet-text backstory">${sheetText(sheet.backstory) || '<span class="sheet-empty">—</span>'}</div>
        <div class="sheet-two">
          <div><h2 class="sheet-h2">Allies & Organisations</h2><div class="sheet-text">${sheetText(sheet.allies) || '<span class="sheet-empty">—</span>'}</div></div>
          <div><h2 class="sheet-h2">Notes</h2><div class="sheet-text">${sheetText(sheet.notes) || '<span class="sheet-empty">—</span>'}</div></div>
        </div>
        <h2 class="sheet-h2">Journal</h2>
        <div class="sheet-rule-lines tall">${'<i></i>'.repeat(14)}</div>
        <footer class="sheet-footer"><span>${U.esc(sheet.name || '')}</span><span>MBG's GameMaster Screen</span><span>2</span></footer>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- persistence / export
  function scheduleSave(sheet) {
    const stateEl = document.getElementById('sheetSaveState');
    if (stateEl) stateEl.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      S.saveSheet(sheet.id, sheet);
      if (stateEl) stateEl.textContent = 'Saved';
    }, 300);
  }

  function flushSave() {
    if (!V.editing) return;
    const sheet = S.sheet(V.editing);
    if (!sheet) return;
    clearTimeout(saveTimer);
    S.saveSheet(sheet.id, sheet);
  }

  async function waitForPrint() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    const imgs = Array.from(document.querySelectorAll('.sheet-preview img'));
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
  }

  V.exportPDF = async function () {
    const sheet = S.sheet(V.editing);
    if (!sheet) return;
    if (!window.html2canvas || !window.jspdf) {
      UI.toast('PDF libraries are missing — use Print instead.', { timeout: 5000 });
      return;
    }
    flushSave();
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Export PDF'));
    if (btn) { btn.disabled = true; btn.textContent = 'Building PDF…'; }
    try {
      renderPreview(sheet);
      await waitForPrint();
      await new Promise(r => setTimeout(r, 60));
      const pages = Array.from(previewEl.querySelectorAll('.sheet-page'));
      if (!pages.length) throw new Error('No sheet pages to export');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2.4, backgroundColor: '#ffffff', useCORS: true, logging: false });
        if (i) pdf.addPage();
        const img = canvas.toDataURL('image/jpeg', 0.94);
        pdf.addImage(img, 'JPEG', 0, 0, 210, 297);
      }
      const safe = (sheet.name || 'character').replace(/[^a-z0-9\-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'character';
      pdf.save(safe + '-gamemaster-sheet.pdf');
      UI.toast('PDF exported: <b>' + U.esc(safe) + '-gamemaster-sheet.pdf</b>');
    } catch (e) {
      console.error(e);
      UI.toast('PDF export failed: ' + U.esc(e.message || e), { timeout: 6000 });
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
    }
  };

  V.print = function () {
    const sheet = S.sheet(V.editing);
    if (!sheet) return;
    flushSave();
    let root = document.getElementById('sheetPrintRoot');
    if (!root) {
      root = el('div', { id: 'sheetPrintRoot' });
      document.body.appendChild(root);
    }
    root.innerHTML = previewEl.innerHTML;
    document.body.classList.add('printing-sheet');
    const cleanup = () => {
      document.body.classList.remove('printing-sheet');
      root.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1200);
    }, 250);
  };

  // ---------------------------------------------------------------- create flows
  function createPartySheets() {
    const players = S.state.players || [];
    if (!players.length) { UI.toast('No party members yet. Create them in the Party tab first.'); return; }
    const existing = new Set((S.state.sheets || []).map(sh => sh.name.toLowerCase()));
    let made = 0;
    players.forEach(p => {
      if (existing.has(p.name.toLowerCase())) return;
      S.sheetFromPlayer(p.id);
      made++;
    });
    if (made) {
      UI.toast('Created <b>' + made + '</b> party sheet' + (made === 1 ? '' : 's') + '.');
      V.rerender();
    } else UI.toast('Every party member already has a sheet.');
  }
  V.createPartySheets = createPartySheets;

  function fromPartyDialog() {
    const players = S.state.players || [];
    if (!players.length) {
      UI.toast('No party members yet. Create a character in the Party tab first.');
      return;
    }
    const body = el('div', {}, [
      el('p.small.muted', { text: 'Copy the basics into a new sheet. You can fill in skills, gear and spells afterwards.' }),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, players.map(p => {
        const b = el('button.btn', { style: { justifyContent: 'flex-start' } }, [
          el('span.avatar.sm', { text: U.initials(p.name) }),
          el('span', { text: p.name + ' · ' + (p.className || 'Adventurer') + ' ' + p.level })
        ]);
        b.addEventListener('click', () => { UI.closeModal(); V.createFromPlayer(p.id); });
        return b;
      }))
    ]);
    UI.modal({ title: 'Create sheet from party', body, buttons: [{ label: 'Cancel', cls: 'ghost' }] });
  }

  V.rerender = function () {
    const old = rootEl;
    if (!old || !old.isConnected) {
      const main = document.getElementById('main');
      main.innerHTML = '';
      const fresh = V.render();
      main.appendChild(fresh);
      rootEl = fresh;
      return;
    }
    const scroll = document.getElementById('main').scrollTop;
    const fresh = V.render();
    old.replaceWith(fresh);
    rootEl = fresh;
    document.getElementById('main').scrollTop = scroll;
  };

  DM.bus.on('state', () => {
    if (DM.currentView !== 'sheets') return;
    // Don't rebuild while the builder is open; it would steal focus from inputs.
    if (V.editing) return;
    V.rerender();
  });
})();
