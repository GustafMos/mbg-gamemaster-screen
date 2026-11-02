/* Settings, backup & data */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.settings = V;

  V.render = function () {
    const st = S.state;
    const root = el('div.view.settings-view');
    root.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Configuration' }),
        el('h1', { text: 'Settings & data' }),
        el('p', { text: 'Your campaign lives in this browser. Export a backup before clearing site data, changing computers, or trusting fate.' })
      ])
    ]));

    const grid = el('div.settings-grid');

    // campaign
    const campaign = el('div.panel');
    campaign.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Campaign' })]));
    const cb = el('div.panel-body');
    const name = el('input', { type: 'text', value: st.campaign.name });
    name.addEventListener('change', () => S.update(s => s.campaign.name = name.value || 'adventure'));
    cb.appendChild(el('div.field', {}, [el('label.label', { text: 'Campaign name' }), name]));
    cb.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Session timer' }), el('span', { text: 'Tracks time at the table. Pauses with the top-bar control.' })]),
      el('span.mono.small', { id: 'settingsTimer', text: U.fmtDuration(S.timerElapsed()) }),
      (() => { const b = el('button.btn.xs', { text: st.session.running ? 'Pause' : 'Start' }); b.addEventListener('click', () => { S.toggleTimer(); V.refresh(); }); return b; })(),
      (() => { const b = el('button.btn.xs.ghost', { text: 'Reset' }); b.addEventListener('click', () => { S.resetTimer(); V.refresh(); }); return b; })()
    ]));
    cb.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Skip defeated monsters' }), el('span', { text: 'The Next turn button skips creatures at 0 HP.' })]),
      toggle(st.settings.skipDead, v => S.update(s => s.settings.skipDead = v))
    ]));
    cb.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Roll initiative on drop' }), el('span', { text: 'Monsters and players entering the tracker roll automatically. Turn off to enter initiative by hand.' })]),
      toggle(st.settings.autoRollInitiative !== false, v => S.update(s => s.settings.autoRollInitiative = v))
    ]));
    campaign.appendChild(cb);
    grid.appendChild(campaign);

    // data
    const data = el('div.panel');
    data.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Data & backup' })]));
    const db = el('div.panel-body');
    if (!S.storageOk) {
      db.appendChild(el('div.tip-box', { html: '<b>Storage blocked.</b> Your browser is not allowing local storage for this file. Export a backup to keep your campaign, or run the app from a local web server.' }));
    }
    db.appendChild(el('p.small.muted', { text: 'Everything — party, notes, homebrew, card reading — is stored in this browser under one save. Exports are plain JSON.' }));
    const row = el('div.row.wrap', { style: { gap: '6px', marginTop: '10px' } });
    row.appendChild((() => { const b = el('button.btn.primary.sm', {}, [U.svg('download'), el('span', { text: 'Export backup' })]); b.addEventListener('click', exportData); return b; })());
    row.appendChild((() => { const b = el('button.btn.sm', {}, [U.svg('upload'), el('span', { text: 'Import backup' })]); b.addEventListener('click', importDialog); return b; })());
    row.appendChild((() => { const b = el('button.btn.danger.sm', {}, [U.svg('trash'), el('span', { text: 'Reset everything' })]); b.addEventListener('click', resetAll); return b; })());
    db.appendChild(row);
    const noteRow = el('div.row.wrap', { style: { gap: '6px', marginTop: '8px' } });
    noteRow.appendChild((() => { const b = el('button.btn.sm', {}, [U.svg('upload'), el('span', { text: 'Import Obsidian folder' })]); b.addEventListener('click', () => DM.obsidian.pickFolder()); return b; })());
    noteRow.appendChild((() => { const b = el('button.btn.sm', {}, [U.svg('notes'), el('span', { text: 'Re-import campaign archive' })]); b.title = 'Adds any bundled archive notes that are missing from this save'; b.addEventListener('click', () => { const n = S.importArchive(true); UI.toast(n ? 'Imported <b>' + n + '</b> archive note' + (n === 1 ? '' : 's') + '.' : 'The campaign archive is already complete.'); }); return b; })());
    db.appendChild(noteRow);
    db.appendChild(el('div.small.dim', { style: { marginTop: '8px' }, text: 'Notes imported from Obsidian stay in this browser. Export a backup to move them to another machine.' }));
    db.appendChild(el('div.small.dim', { style: { marginTop: '10px' }, text: 'Save key: mbg.gamemaster.v1 · last saved locally' }));
    data.appendChild(db);
    grid.appendChild(data);

    // table stats
    const stats = el('div.panel');
    stats.appendChild(el('div.panel-head', {}, [el('h3', { text: 'At a glance' })]));
    const sb = el('div.panel-body');
    const statGrid = el('div.stat-grid');
    [
      [st.players.length, 'Party members'],
      [(st.sheets || []).length, 'Sheets'],
      [st.notes.length, 'Notes'],
      [st.templates.length, 'Encounters saved'],
      [st.homebrew.items.length + st.homebrew.spells.length + st.homebrew.monsters.length, 'Homebrew'],
      [(DM.data.monsters.length || 0).toLocaleString(), 'Monsters'],
      [(DM.data.items.length || 0).toLocaleString(), 'Items'],
      [DM.data.spells.length, 'Spells']
    ].forEach(([v, l]) => statGrid.appendChild(el('div.stat-box', {}, [el('b', { text: String(v) }), el('span', { text: l })])));
    sb.appendChild(statGrid);
    sb.appendChild(el('div.row.wrap', { style: { gap: '5px', marginTop: '12px' } }, [
      el('span.chip.static', { text: DM.search.docs().length + ' search docs' }),
      el('span.chip.static', { text: DM.data.spells.length + ' spells' }),
      el('span.chip.static', { text: '5etools data' }),
      el('span.chip.static', { text: 'Adventure text' })
    ]));
    stats.appendChild(sb);
    grid.appendChild(stats);

    // help
    const help = el('div.panel');
    help.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Table aids' })]));
    const hb2 = el('div.panel-body');
    hb2.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Keyboard shortcuts' }), el('span', { text: 'Search, turns, dice, navigation.' })]),
      (() => { const b = el('button.btn.xs', { text: 'Show' }); b.addEventListener('click', () => UI.shortcuts()); return b; })()
    ]));
    hb2.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Demo party' }), el('span', { text: 'Four level 3 characters, ready to drag into a fight.' })]),
      (() => { const b = el('button.btn.xs', { text: 'Load' }); b.addEventListener('click', () => { DM.views.party.loadSample(); }); return b; })()
    ]));
    hb2.appendChild(el('div.setting-row', {}, [
      el('div.sr-main', {}, [el('b', { text: 'Print a statblock' }), el('span', { text: 'Open any statblock and use the browser print dialog — the app chrome is hidden.' })]),
      (() => { const b = el('button.btn.xs', { text: 'Bestiary' }); b.addEventListener('click', () => DM.navigate('bestiary')); return b; })()
    ]));
    help.appendChild(hb2);
    grid.appendChild(help);

    // about
    const about = el('div.panel');
    about.appendChild(el('div.panel-head', {}, [el('h3', { text: 'About this screen' })]));
    const ab = el('div.panel-body');
    ab.appendChild(el('p.small.muted', { text: 'A single-file, offline-first DM screen for 5e play. Built with vanilla JavaScript — no accounts, no servers, no telemetry.' }));
    ab.appendChild(el('p.small.dim', { text: 'Monster, spell, item and rule data from the 5etools mirror. Adventure text © Wizards of the Coast; own the book to use it at your table. Tarokka card meanings from the same source.' }));
    ab.appendChild(el('div.small.dim', { style: { marginTop: '6px' }, text: 'Tip: keep this folder on a cloud drive and export a backup after each session.' }));
    about.appendChild(ab);
    grid.appendChild(about);

    root.appendChild(grid);
    return root;
  };

  function toggle(on, onChange, disabled) {
    const b = el('button.chip' + (on ? '.green' : ''), { text: on ? 'On' : 'Off' });
    if (disabled) { b.style.opacity = '.6'; b.title = 'Always on'; return b; }
    b.addEventListener('click', () => {
      const next = !b.classList.contains('green');
      b.classList.toggle('green', next);
      b.textContent = next ? 'On' : 'Off';
      if (onChange) onChange(next);
    });
    return b;
  }

  function exportData() {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = 'mbg-gamemaster-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    UI.toast('Backup exported.');
  }
  V.exportData = exportData;

  function importDialog() {
    const input = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const incoming = parsed.state || parsed;
          const count = (incoming.players || []).length;
          UI.confirm({
            title: 'Import backup?',
            message: 'This replaces the current campaign with the backup' + (count ? ' (' + count + ' party members)' : '') + '. Export your current data first if you want to keep it.',
            confirm: 'Import & replace', danger: true
          }).then(ok => {
            if (!ok) return;
            try {
              S.importJSON(String(reader.result || ''));
              UI.closeModal();
              V.refresh();
              DM.navigate('dashboard');
              UI.toast('Campaign imported.');
            } catch (err) {
              UI.toast('Import failed: ' + U.esc(err.message));
            }
          });
        } catch (e) {
          UI.toast('That file is not valid JSON.');
        }
      };
      reader.readAsText(f);
      input.remove();
    });
    input.click();
  }
  V.importDialog = importDialog;

  async function resetAll() {
    const ok = await UI.confirm({
      title: 'Reset everything?',
      message: 'Deletes the party, notes, homebrew, saved encounters and card readings from this browser. Export a backup first. This cannot be undone.',
      confirm: 'Delete my campaign',
      danger: true
    });
    if (!ok) return;
    const sure = await UI.confirm({ title: 'Really reset?', message: 'The mists take everything.', confirm: 'Yes, reset', danger: true });
    if (!sure) return;
    S.reset();
    DM.navigate('dashboard');
    UI.toast('A new campaign begins.');
  }

  V.refresh = function () {
    if (DM.currentView !== 'settings') return;
    const main = document.getElementById('main');
    main.innerHTML = '';
    main.appendChild(V.render());
  };

  DM.bus.on('state', () => {
    if (DM.currentView !== 'settings') return;
    const t = document.getElementById('settingsTimer');
    if (t) t.textContent = U.fmtDuration(S.timerElapsed());
  });
})();
