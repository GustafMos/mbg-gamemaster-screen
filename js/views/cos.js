/* adventure toolkit: full chapter reader, tarokka reading, NPCs, locations */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, R = DM.render, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.cos = V;

  V.tab = 'chapters';
  V.chapterId = null;
  let rootEl = null;
  let fortunes = null;

  const MAPS = [
    { group: 'Barovia', file: 'barovia.webp', title: 'Map 2.1 — Barovia', sub: 'Player map · the whole valley (1 hex = ¼ mile)' },
    { group: 'The Castle', file: 'castle-walls.webp', title: 'Castle Walls', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-main-floor.webp', title: 'Main Floor', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-court.webp', title: 'Court of the Count', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-weeping.webp', title: 'Rooms of Weeping', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-spires.webp', title: 'Spires & Tower', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-larders.webp', title: 'Larders of Ill Omen', sub: 'Player battlemap' },
    { group: 'The Castle', file: 'castle-dungeons.webp', title: 'Dungeon & Catacombs', sub: 'Player battlemap' },
    { group: 'Barovia', file: 'village-barovia.webp', title: 'Village of Barovia', sub: 'Player map (Area E)' },
    { group: 'Barovia', file: 'vallaki.webp', title: 'Town of Vallaki', sub: 'Player map (Area N)' },
    { group: 'Barovia', file: 'old-bonegrinder.webp', title: 'Old Bonegrinder', sub: 'Player map (Area O)' },
    { group: 'Barovia', file: 'krezk.webp', title: 'Village of Krezk', sub: 'Player map (Area S)' },
    { group: 'Barovia', file: 'amber-temple.webp', title: 'Amber Temple — Upper Level', sub: 'Player map (Area X)' },
    { group: 'Barovia', file: 'yester-hill.webp', title: 'Yester Hill', sub: 'Player map (Area Y)' },
    { group: 'Barovia', file: 'werewolf-den.webp', title: 'Werewolf Den', sub: 'Player map (Area Z)' },
    { group: 'Barovia', file: 'wizard-of-wines.webp', title: 'Wizard of Wines', sub: 'Player map (Area W)' }
  ];

  const POSITIONS = [    { key: 'tome', name: 'The Tome of Strahd', num: 'I', deck: 'common', hint: 'History. Knowledge of the ancient will help you understand your enemy.' },
    { key: 'symbol', name: 'The Holy Symbol of Ravenkind', num: 'II', deck: 'common', hint: 'A powerful force for good and protection — a holy symbol of great hope.' },
    { key: 'sunsword', name: 'The Sunsword', num: 'III', deck: 'common', hint: 'A weapon of vengeance: a sword of sunlight.' },
    { key: 'enemy', name: 'Strahd’s Enemy', num: 'IV', deck: 'high', hint: 'One who will help you greatly in the battle against darkness.' },
    { key: 'strahd', name: 'Strahd', num: 'V', deck: 'high', hint: 'A creature of darkness, whose powers are beyond mortality. This card leads you to him.' }
  ];

  V.render = function (opts) {
    if (opts && opts.tab) V.tab = opts.tab;
    if (opts && opts.chapterId) V.chapterId = opts.chapterId;
    if (!V.chapterId) V.chapterId = S.state.cos.activeChapter;
    if (!DM.data.cos.find(c => c.id === V.chapterId)) V.chapterId = '013';

    rootEl = el('div.view.cos-view');
    if (!DM.data.cos.length) {
      rootEl.appendChild(el('div.page-head', {}, [
        el('div', {}, [
          el('div.eyebrow', { text: 'Adventure' }),
          el('h1', { text: 'Adventure data not installed' }),
          el('p', { text: 'This build of the app does not include the adventure module text or maps. Run the setup steps in the README to fetch the 5etools data and rebuild the local data bundles.' })
        ])
      ]));
      rootEl.appendChild(el('div.empty', {}, [
        el('div.em-icon', { text: '🏰' }),
        el('h3', { text: 'Nothing to show yet' }),
        el('p', { text: 'The tool and UI are here; the game content is intentionally not committed to the repository.' })
      ]));
      return rootEl;
    }
    const head = el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Adventure' }),
        el('h1', { text: 'The Adventure' }),
        el('p', { text: 'Chapter text, the card reading, every named NPC, player maps and a searchable index of locations — tuned for running at the table.' })
      ]),
      el('div.head-actions', {}, [
        (() => { const b = el('button.btn.sm', {}, [U.svg('sparkle'), el('span', { text: 'Draw tarokka' })]); b.addEventListener('click', () => { V.tab = 'reading'; V.refresh(); }); return b; })(),
        (() => { const b = el('button.btn.sm', {}, [U.svg('users'), el('span', { text: 'NPCs' })]); b.addEventListener('click', () => { V.tab = 'npcs'; V.refresh(); }); return b; })()
      ])
    ]);
    rootEl.appendChild(head);

    const tabs = el('div.kind-tabs', { style: { marginBottom: '14px' } });
    [['chapters', 'Chapters'], ['reading', 'Tarokka reading'], ['npcs', 'NPCs & villains'], ['locations', 'Location index'], ['maps', 'Maps']].forEach(([id, label]) => {
      const b = el('button.kind-tab' + (V.tab === id ? '.on' : ''), { text: label });
      b.addEventListener('click', () => { V.tab = id; V.refresh(); });
      tabs.appendChild(b);
    });
    rootEl.appendChild(tabs);

    if (V.tab === 'chapters') rootEl.appendChild(chaptersTab());
    else if (V.tab === 'reading') rootEl.appendChild(readingTab());
    else if (V.tab === 'npcs') rootEl.appendChild(npcsTab());
    else if (V.tab === 'locations') rootEl.appendChild(locationsTab());
    else rootEl.appendChild(mapsTab());
    return rootEl;
  };

  // ---------------------------------------------------------------- chapters
  function chaptersTab() {
    const layout = el('div.cos-layout');
    const side = el('div.panel');
    side.appendChild(el('div.panel-head', {}, [
      el('h3', { text: 'Chapters' }),
      el('span.spacer'),
      el('span.small.dim', { text: Object.values(S.state.cos.progress || {}).filter(Boolean).length + '/' + DM.data.cos.length })
    ]));
    const list = el('div.chapter-list');
    DM.data.cos.forEach(ch => {
      const done = S.cosProgress(ch.id);
      const active = ch.id === V.chapterId;
      const info = chapterMeta(ch);
      const item = el('div.chapter-item' + (active ? '.active' : '') + (done ? '.done' : ''), { title: ch.name }, [
        el('span.chapter-num', { text: info.num }),
        el('span', { style: { flex: '1', lineHeight: '1.3' }, text: info.title })
      ]);
      item.addEventListener('click', () => { V.chapterId = ch.id; S.update(s => s.cos.activeChapter = ch.id); V.refresh(); });
      list.appendChild(item);
    });
    side.appendChild(list);
    layout.appendChild(side);

    const ch = DM.data.cos.find(c => c.id === V.chapterId) || DM.data.cos[0];
    const panel = el('div.panel');
    const reader = el('div.chapter-reader');
    const meta = chapterMeta(ch);
    const done = S.cosProgress(ch.id);
    reader.appendChild(el('div.eyebrow', { text: meta.eyebrow }));
    reader.appendChild(el('h1', { text: meta.title }));
    reader.appendChild(el('div.ch-meta', { text: [ch.page ? 'Page ' + ch.page : '', meta.words || ''].filter(Boolean).join(' · ') }));
    reader.appendChild(el('div.row', { style: { gap: '6px', marginBottom: '8px' } }, [
      (() => {
        const b = el('button.btn.xs' + (done ? '.gold' : ''), {}, [U.svg('check'), el('span', { text: done ? 'Completed' : 'Mark complete' })]);
        b.addEventListener('click', () => { S.setCosProgress(ch.id, !done); V.refresh(); });
        return b;
      })(),
      (() => { const b = el('button.btn.xs.ghost', { text: 'Copy chapter link' }); b.addEventListener('click', () => { copyText(ch.name + ' — ' + location.href.split('#')[0] + '#/cos/' + ch.id); }); return b; })()
    ]));

    // table of contents
    const toc = el('div.chapter-toc');
    const topSections = (ch.entries || []).filter(e => e && e.name && (e.type === 'section' || e.type === 'entries'));
    topSections.slice(0, 18).forEach(sec => {
      const b = el('button.chip', { text: stripChapterNum(sec.name) });
      b.addEventListener('click', () => { V.tab = 'chapters'; V.refresh(); setTimeout(() => scrollToAnchor(sec.id), 30); });
      toc.appendChild(b);
    });
    if (toc.children.length) reader.appendChild(toc);

    const body = el('div.ch-reader-body');
    let openedFirst = false;
    (ch.entries || []).forEach(entry => {
      if (entry && entry.name && (entry.type === 'section' || entry.type === 'entries')) {
        const det = el('details.section-details');
        if (!openedFirst) { det.open = true; openedFirst = true; }
        if (entry.id) det.id = 'sec-' + entry.id;
        det.appendChild(el('summary', { html: R.inline(stripChapterNum(entry.name)) }));
        const inner = el('div');
        inner.innerHTML = R.entries(entry.entries, { collapsible: true });
        det.appendChild(inner);
        body.appendChild(det);
      } else {
        const d = el('div');
        d.innerHTML = R.entries(entry);
        body.appendChild(d);
      }
    });
    reader.appendChild(body);

    // DM notes
    const noteWrap = el('div.cos-note');
    noteWrap.appendChild(el('div.label', { text: 'Chapter notes', style: { marginBottom: '5px' } }));
    const ta = el('textarea', { rows: 4, placeholder: 'What happened, what changed, who owes the party a favour…' });
    ta.value = S.cosNote(ch.id);
    ta.addEventListener('change', () => S.setCosNote(ch.id, ta.value));
    noteWrap.appendChild(ta);
    reader.appendChild(noteWrap);
    panel.appendChild(reader);
    layout.appendChild(panel);
    return layout;
  }

  function chapterMeta(ch) {
    const name = ch.name || '';
    let m = /^(Chapter|Appendix)\s+([0-9A-Z]+):\s*(.*)$/i.exec(name);
    if (m) {
      return { num: m[2], title: m[3], eyebrow: m[1] + ' ' + m[2], words: '' };
    }
    if (/^Foreword/i.test(name)) return { num: '—', title: name.replace(/^Foreword:\s*/, ''), eyebrow: 'Foreword' };
    if (/^Introduction/i.test(name)) return { num: '—', title: name, eyebrow: 'Introduction' };
    if (/^Epilogue/i.test(name)) return { num: '—', title: name, eyebrow: 'Epilogue' };
    return { num: '·', title: name, eyebrow: 'adventure' };
  }
  function stripChapterNum(name) {
    return String(name || '').replace(/^(Chapter|Appendix)\s+[0-9A-Z]+:\s*/i, '').replace(/^\d+\.\s*/, '');
  }

  function scrollToAnchor(id) {
    if (!id) return;
    const target = document.getElementById('sec-' + id);
    if (!target) return;
    // open every details ancestor / all details in the reader for reliable positioning
    document.querySelectorAll('.ch-reader-body details').forEach(d => d.open = true);
    setTimeout(() => {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.classList.add('anchor-flash');
      setTimeout(() => target.classList.remove('anchor-flash'), 2600);
    }, 60);
  }
  V.scrollToAnchor = scrollToAnchor;

  // ---------------------------------------------------------------- tarokka
  function parseFortunes() {
    if (fortunes) return fortunes;
    const out = { common: {}, enemy: {}, location: {} };
    const ch = DM.data.cos.find(c => /^Chapter 1/.test(c.name)) || DM.data.cos[0];
    if (!ch) return out;

    const extractCard = (readaloud) => {
      const raw = JSON.stringify(readaloud || '');
      const m = /\{@card\s+([^|}\\]*)/i.exec(raw);
      return m ? m[1].trim() : null;
    };

    function parseWrapper(wrapper, group) {
      const outs = [];
      let cur = null;
      (wrapper.wrappeds || []).forEach(w => {
        if (w && w.type === 'insetReadaloud') {
          cur = { card: extractCard(w.entries), quote: R.entries(w.entries), resolution: [] };
          outs.push(cur);
        } else if (cur) {
          cur.resolution.push(w);
        }
      });
      outs.forEach(o => {
        if (!o.card) return;
        const entry = { quote: o.quote, resolution: R.entries(o.resolution) };
        if (group === 'common') {
          if (!out.common[o.card]) out.common[o.card] = entry;
        } else {
          if (!out[group][o.card]) out[group][o.card] = [];
          out[group][o.card].push(entry);
        }
      });
    }

    function walk(node, ctx) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(n => walk(n, ctx)); return; }
      if (typeof node !== 'object') return;
      let next = ctx;
      if (node.name === 'Treasure Locations') next = 'common';
      if (node.name === 'Strahd’s Enemy' || node.name === "Strahd's Enemy") {
        if (node.id === '059') next = 'enemy';
      }
      if (node.name === 'Strahd’s Location in the Castle' || node.name === "Strahd's Location in the Castle") next = 'location';
      if (node.type === 'wrapper' && ctx) parseWrapper(node, ctx);
      if (node.entries) walk(node.entries, next);
      if (node.wrappeds) walk(node.wrappeds, next);
    }
    walk(ch.entries, null);
    fortunes = out;
    return out;
  }

  function readingTab() {
    const cards = DM.data.tarokka.cards || [];
    const reading = S.state.cos.reading || { cards: {}, ts: null };
    const wrap = el('div');

    const intro = el('div.panel', { style: { marginBottom: '14px' } });
    intro.appendChild(el('div.panel-body', {}, [
      el('div.row', { style: { alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' } }, [
        el('div', { style: { flex: '1', minWidth: '280px' } }, [
          el('div.eyebrow', { text: 'Card Reading' }),
          el('h2', { style: { fontFamily: 'var(--serif)', margin: '2px 0 6px', fontSize: '21px' }, text: 'The card reading' }),
          el('p.small.muted', { style: { margin: '0 0 8px' }, text: 'Draw one card for each position. The first three come from the common deck; the last two from the high deck. Duplicate cards are avoided automatically. Readings are saved with your campaign.' }),
          el('div.row.wrap', { style: { gap: '6px' } }, [
            (() => { const b = el('button.btn.primary.sm', {}, [U.svg('sparkle'), el('span', { text: 'Draw all five' })]); b.addEventListener('click', () => drawAll()); return b; })(),
            (() => { const b = el('button.btn.sm', { text: 'Clear reading' }); b.addEventListener('click', () => { S.saveReading(null); V.refresh(); }); return b; })(),
            (() => { const b = el('button.btn.ghost.sm', { text: 'Browse the deck' }); b.addEventListener('click', browseDeck); return b; })(),
            reading.ts ? el('span.small.dim', { text: 'Saved ' + U.fmtRelative(reading.ts) }) : null
          ])
        ]),
        el('div', { style: { width: 'min(300px, 100%)' } }, [
          el('div.tip-box', { html: '<b>Running the reading.</b> Read the italic text aloud, then note the location. If a card offers A and B results, pick the one that fits your campaign. The fifth card only matters once the party reaches The Castle.' })
        ])
      ])
    ]));
    wrap.appendChild(intro);

    const grid = el('div.tarokka-grid');
    POSITIONS.forEach(pos => {
      const saved = reading.cards && reading.cards[pos.key];
      const card = saved ? (cards.find(c => c.name === saved.name) || cards.find(c => c.suit === saved.suit && String(c.value) === String(saved.value))) : null;
      const slot = el('div.tarot-slot' + (card ? '.filled' : '.empty'));
      slot.appendChild(el('div.pos', { text: pos.num + ' · ' + pos.name }));
      if (!card) {
        slot.appendChild(el('div', { style: { textAlign: 'center', padding: '22px 0' } }, [
          el('div', { style: { fontFamily: 'var(--serif)', fontSize: '15px', color: 'var(--muted)' }, text: 'Draw a card' }),
          el('div.small.dim', { style: { marginTop: '4px' }, text: pos.deck === 'high' ? 'High deck' : 'Common deck' })
        ]));
        slot.addEventListener('click', () => drawSlot(pos));
      } else {
        const meaning = card.entries ? R.entries(card.entries).replace(/<\/?p>/g, '') : '';
        slot.appendChild(el('div.card-name', { text: cardTitle(card) }));
        slot.appendChild(el('div.card-suit', { text: card.suit ? card.suit + ' · ' + (Number(card.value) === 10 ? 'Master' : card.value) : 'High Deck' }));
        slot.appendChild(el('div.meaning', { html: meaning }));
        const outcome = outcomeFor(pos, card);
        if (outcome) {
          const out = el('div.outcome');
          out.innerHTML = outcome;
          slot.appendChild(out);
        }
        const tools = el('div.row', { style: { gap: '3px', marginTop: 'auto', paddingTop: '4px' } }, [
          (() => { const b = el('button.link-btn.tiny-text', { text: 'Redraw' }); b.addEventListener('click', (e) => { e.stopPropagation(); drawSlot(pos); }); return b; })(),
          (() => { const b = el('button.link-btn.tiny-text', { text: 'Card' }); b.addEventListener('click', (e) => { e.stopPropagation(); UI.openTarokka(card.name); }); return b; })(),
          el('span.spacer'),
          (() => { const b = el('button.hp-btn', { title: 'Clear card', text: '×', style: { width: '20px', height: '20px' } }); b.addEventListener('click', (e) => { e.stopPropagation(); clearSlot(pos.key); }); return b; })()
        ]);
        slot.appendChild(tools);
      }
      grid.appendChild(slot);
    });
    wrap.appendChild(grid);

    if (reading.ts) {
      const bar = el('div.row', { style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } }, [
        el('span.small.dim', { text: 'Last saved ' + U.fmtDate(reading.ts) }),
        el('span.spacer'),
        (() => { const b = el('button.btn.sm', {}, [U.svg('notes'), el('span', { text: 'Copy reading to a note' })]); b.addEventListener('click', () => copyReading(reading)); return b; })()
      ]);
      wrap.appendChild(bar);
    }
    return wrap;
  }

  const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Master'];
  function cardTitle(card) {
    if (!card) return '';
    if (!card.suit) return card.name;
    const n = Number(card.value);
    return (NUMBER_WORDS[n] || card.value) + ' of ' + card.suit + ' — ' + card.name;
  }

  function outcomeFor(pos, card) {    const f = parseFortunes();
    if (!card) return '';
    let entry = null;
    if (pos.key === 'enemy') {
      const arr = f.enemy[card.name] || [];
      if (!arr.length) return '';
      return arr.map((e, i) => '<div style="margin-bottom:6px"><b>' + (arr.length > 1 ? String.fromCharCode(65 + i) + '. ' : 'Outcome. ') + '</b>' + e.resolution + '</div>').join('') +
        (arr.length > 1 ? '<div class="tiny-text dim">Choose the version that fits your campaign.</div>' : '');
    }
    if (pos.deck === 'common') entry = f.common[card.name];
    else entry = (f.location[card.name] || [])[0];
    if (!entry) return '';
    return '<b>Outcome.</b> ' + entry.resolution;
  }

  function currentReading() {
    const r = S.state.cos.reading || { cards: {}, ts: null };
    return { cards: Object.assign({}, r.cards || {}), ts: r.ts };
  }

  function drawSlot(pos, silent) {
    const cards = DM.data.tarokka.cards || [];
    const reading = currentReading();
    const deck = cards.filter(c => pos.deck === 'high' ? !c.suit : !!c.suit);
    const used = new Set(Object.values(reading.cards).map(c => c.name));
    let pool = deck.filter(c => !used.has(c.name));
    if (!pool.length) pool = deck;
    const card = U.pick(pool);
    reading.cards[pos.key] = { name: card.name, suit: card.suit || '', value: card.value || '' };
    reading.ts = Date.now();
    S.saveReading(reading);
    if (!silent) {
      V.refresh();
      const f = parseFortunes();
      let outcome = pos.deck === 'common' ? f.common[card.name] : (pos.key === 'enemy' ? (f.enemy[card.name] || [])[0] : (f.location[card.name] || [])[0]);
      const plainOutcome = outcome ? stripHtml(outcome.resolution).slice(0, 90) : '';
      UI.toast('<span class="t-dice">🎴</span> <b>' + pos.name + ':</b> ' + U.esc(card.name) + (card.suit ? ' (' + U.esc(card.suit + ' ' + card.value) + ')' : '') + (plainOutcome ? '<br><span class="dim small">' + U.esc(plainOutcome) + '…</span>' : ''), { timeout: 5000 });
    }
  }

  function clearSlot(key) {
    const reading = currentReading();
    delete reading.cards[key];
    reading.ts = Date.now();
    S.saveReading(reading);
    V.refresh();
  }

  function drawAll() {
    const reading = { cards: {}, ts: Date.now() };
    const cards = DM.data.tarokka.cards || [];
    const used = new Set();
    POSITIONS.forEach(pos => {
      const deck = cards.filter(c => pos.deck === 'high' ? !c.suit : !!c.suit);
      let pool = deck.filter(c => !used.has(c.name));
      if (!pool.length) pool = deck;
      const card = U.pick(pool);
      used.add(card.name);
      reading.cards[pos.key] = { name: card.name, suit: card.suit || '', value: card.value || '' };
    });
    S.saveReading(reading);
    V.refresh();
    UI.toast('🎴 The cards are drawn. <b>Read the first three aloud</b>, then reveal the enemy and the castle.');
  }

  function copyReading(reading) {
    const cards = DM.data.tarokka.cards || [];
    let text = 'Card Reading\n\n';
    POSITIONS.forEach(pos => {
      const saved = reading.cards[pos.key];
      if (!saved) { text += pos.name + ': (not drawn)\n'; return; }
      const card = cards.find(c => c.name === saved.name);
      text += pos.name + ': ' + saved.name + (saved.suit ? ' (' + saved.suit + ' ' + saved.value + ')' : '') + '\n';
      text += '  ' + stripHtml(card ? R.entries(card.entries) : '') + '\n';
      const f = parseFortunes();
      const o = pos.deck === 'common' ? f.common[saved.name] : (pos.key === 'enemy' ? (f.enemy[saved.name] || [])[0] : (f.location[saved.name] || [])[0]);
      if (o) text += '  ' + stripHtml(o.resolution) + '\n';
      text += '\n';
    });
    const note = S.addNote({ title: 'Card Reading — ' + new Date().toLocaleDateString(), body: text });
    UI.toast('Reading copied to a new note.');
    DM.navigate('notes');
    setTimeout(() => DM.views.notes.open(note.id), 80);
  }

  function browseDeck() {
    const cards = DM.data.tarokka.cards || [];
    const body = el('div');
    const high = cards.filter(c => !c.suit);
    const common = cards.filter(c => c.suit);
    body.appendChild(el('div.label', { text: 'High deck', style: { marginBottom: '6px' } }));
    body.appendChild(cardGrid(high));
    body.appendChild(el('div.label', { text: 'Common deck', style: { marginTop: '14px', marginBottom: '6px' } }));
    body.appendChild(cardGrid(common));
    UI.modal({ title: 'Tarokka deck', body, buttons: [{ label: 'Close', cls: 'primary' }] });
  }
  function cardGrid(cards) {
    const g = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '5px' } });
    cards.forEach(c => {
      const b = el('button.chip', { title: stripHtml(R.entries(c.entries)), style: { justifyContent: 'flex-start', padding: '6px 8px', fontSize: '10.5px' }, text: c.name });
      b.addEventListener('click', () => { UI.closeModal(); UI.openTarokka(c.name); });
      g.appendChild(b);
    });
    return g;
  }

  // ---------------------------------------------------------------- npcs
  function npcsTab() {
    const wrap = el('div');
    const all = DM.data.monsters.filter(m => m.source === 'CoS');
    const named = all.filter(m => m.isNpc);
    const npcNames = ['Strahd von Zarovich', 'Ireena Kolyana', 'Ismark Kolyanovich', 'Rudolph van Richten', 'Rictavio', 'Ezmerelda d’Avenir', 'Madam Eva', 'Baba Lysaga', 'Kasimir Velikov', 'the Abbot', 'Rahadin', 'Ludmilla Vilisevic', 'Anastrasya Karelova', 'Volenta Popofsky', 'Izek Strazni', 'Victor Vallakovich', 'Stella Wachter', 'Fiona Wachter', 'Vargas Vallakovich', 'Arabelle', 'Arrigal', 'Luvash', 'Gadof Blinsky', 'Morgantha', 'Davian Martikov', 'Urwin Martikov', 'the Mad Mage of Mount Baratok', 'Pidlwick II', 'Sir Godfrey Gwilym', 'Vladimir Horngaard', 'Exethanter', 'Kiril Stoyanovich', 'Emil Toranescu', 'Zuleika Toranescu', 'Donavich', 'Doru', 'Parriwimple'];
    const byName = new Map(named.map(m => [m.name.toLowerCase(), m]));

    const search = el('input', { type: 'search', placeholder: 'Filter adventure characters…' });
    const grid = el('div.npc-grid');
    const filterRow = el('div.row.wrap', { style: { gap: '5px', marginBottom: '12px' } }, [
      (() => { const b = el('button.chip.on', { text: 'Named characters' }); return b; })(),
      (() => { const b = el('button.chip', { text: 'All adventure monsters' }); return b; })()
    ]);

    function paint(filter) {
      grid.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      let list = filter === 'named' ? named : all;
      if (q) list = list.filter(m => m.name.toLowerCase().includes(q) || (m.type && JSON.stringify(m.type).toLowerCase().includes(q)));
      list = list.slice().sort((a, b) => {
        const ai = npcNames.findIndex(n => n.toLowerCase() === a.name.toLowerCase());
        const bi = npcNames.findIndex(n => n.toLowerCase() === b.name.toLowerCase());
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return a.name.localeCompare(b.name);
      });
      if (!list.length) { grid.innerHTML = '<div class="pal-empty">No characters match.</div>'; return; }
      list.forEach(m => {
        const card = el('div.npc-card', {}, [
          el('div.avatar', { text: U.initials(m.name), style: { background: 'linear-gradient(150deg, ' + U.colorFor(m.name) + ', #1a1524)' } }),
          el('div', { style: { flex: '1', minWidth: '0' } }, [
            el('div.nm', { text: m.name }),
            el('div.sub', { text: [R.monsterMeta(m), m.isNpc ? 'named NPC' : ''].filter(Boolean).join(' · ') })
          ])
        ]);
        card.addEventListener('click', () => UI.openMonster(m.name, m.source));
        UI.draggable(card, () => ({ type: 'monster', name: m.name, source: m.source }));
        grid.appendChild(card);
      });
    }
    let mode = 'named';
    const chips = filterRow.querySelectorAll('button.chip');
    chips.forEach((c, i) => c.addEventListener('click', () => {
      mode = i === 0 ? 'named' : 'all';
      chips.forEach(x => x.classList.toggle('on', x === c));
      paint(mode);
    }));
    search.addEventListener('input', U.debounce(() => paint(mode), 120));
    wrap.appendChild(el('div.row', { style: { gap: '8px', marginBottom: '8px', flexWrap: 'wrap' } }, [
      el('div.search-field', { style: { flex: '1', minWidth: '220px' } }, [U.svg('search'), search]),
      filterRow
    ]));
    wrap.appendChild(el('p.small.dim', { text: 'Named NPCs are pulled from the adventure bestiary. Click for a statblock, drag for initiative.' }));
    wrap.appendChild(grid);
    paint('named');
    return wrap;
  }

  // ---------------------------------------------------------------- locations
  function locationsTab() {
    const wrap = el('div');
    const search = el('input', { type: 'search', placeholder: 'Find a location — “K15”, “abbey”, “amber temple”, “Berez”…' });
    const chapterSel = el('select', { style: { width: 'auto', maxWidth: '260px' } });
    chapterSel.appendChild(el('option', { value: '', text: 'All chapters' }));
    DM.data.cos.forEach(ch => chapterSel.appendChild(el('option', { value: ch.id, text: ch.name })));
    const list = el('div.panel');
    list.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Location index' }), el('span.spacer'), el('span.small.dim', { id: 'locCount' })]));
    const body = el('div.panel-body');
    const rows = el('div.area-list');
    body.appendChild(rows);
    list.appendChild(body);

    function paint() {
      const q = search.value.trim().toLowerCase();
      const chId = chapterSel.value;
      const docs = DM.search.byKind('area').filter(d => /^[A-Z]{1,2}\d*[a-z]?[.\s]/.test(d.name) || /^Area\b/i.test(d.name));
      let filtered = docs.filter(d => (!chId || d.ref.chapterId === chId));
      if (q) filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q) || (d.text || '').toLowerCase().includes(q));
      rows.innerHTML = '';
      const count = document.getElementById('locCount');
      if (count) count.textContent = filtered.length + ' entries';
      if (!filtered.length) { rows.innerHTML = '<div class="pal-empty">No locations found.</div>'; return; }
      filtered.sort((a, b) => {
        const ca = DM.data.cosChapter(a.ref.chapterId), cb = DM.data.cosChapter(b.ref.chapterId);
        return (ca ? ca.name : '').localeCompare(cb ? cb.name : '') || a.name.localeCompare(b.name);
      });
      let lastCh = null;
      filtered.slice(0, 400).forEach(d => {
        if (d.ref.chapterId !== lastCh) {
          lastCh = d.ref.chapterId;
          const ch = DM.data.cosChapter(lastCh);
          rows.appendChild(el('div.eyebrow', { style: { marginTop: '10px', marginBottom: '2px' }, text: ch ? ch.name : 'adventure' }));
        }
        const row = el('div.area-row', {}, [
          el('span.area-code', { text: d.name.match(/^[A-Z]{1,2}\d+[a-z]?/) ? d.name : '' }),
          el('span.area-name', { text: d.name }),
          el('span.area-ch', { text: d.sub.replace(/^.*?·\s*/, '') })
        ]);
        row.addEventListener('click', () => { V.chapterId = d.ref.chapterId; V.tab = 'chapters'; S.update(s => s.cos.activeChapter = d.ref.chapterId); V.refresh(); setTimeout(() => scrollToAnchor(d.ref.anchor), 80); });
        rows.appendChild(row);
      });
      if (filtered.length > 400) rows.appendChild(el('div.small.dim', { style: { padding: '8px' }, text: 'Showing first 400 — narrow the search to see more.' }));
    }
    search.addEventListener('input', U.debounce(paint, 120));
    chapterSel.addEventListener('change', paint);
    wrap.appendChild(el('div.toolbar', {}, [
      el('div.search-field', { style: { flex: '1' } }, [U.svg('search'), search]),
      chapterSel
    ]));
    wrap.appendChild(list);
    paint();
    return wrap;
  }

  // ---------------------------------------------------------------- maps
  function mapsTab() {
    const wrap = el('div');
    wrap.appendChild(el('div.tip-box', { style: { marginBottom: '14px' }, html: '<b>Player-facing maps.</b> Click a map to open it large. These are the player versions from the module — they contain no DM annotations. Use your browser’s zoom, or right-click → open image in a new tab for a second screen.' }));
    const missing = el('div.empty', { style: { display: 'none', marginTop: '12px' } }, [
      el('h3', { text: 'Maps are not bundled' }),
      el('p', { text: 'This build has no map image files. Run the optional map download step in the setup instructions, or copy the adventure player maps into assets/maps.' })
    ]);
    let failed = 0;
    const groups = {};
    MAPS.forEach(m => { (groups[m.group] = groups[m.group] || []).push(m); });
    Object.keys(groups).forEach(group => {
      wrap.appendChild(el('div.section-head', {}, [el('h2', { text: group }), el('span.rule')]));
      const grid = el('div.map-grid');
      groups[group].forEach(m => {
        const card = el('div.map-card', { title: m.title });
        const img = el('img', { src: 'assets/maps/' + m.file, alt: m.title, loading: 'lazy' });
        img.addEventListener('error', () => {
          card.style.display = 'none';
          failed++;
          if (failed >= MAPS.length) missing.style.display = '';
        });
        card.appendChild(img);
        card.appendChild(el('div.map-meta', {}, [
          el('div.map-title', { text: m.title }),
          el('div.map-sub', { text: m.sub })
        ]));
        card.addEventListener('click', () => openMap(m));
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    });
    wrap.appendChild(missing);
    return wrap;
  }

  function openMap(m) {
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    const img = el('img', { src: 'assets/maps/' + m.file, alt: m.title, style: { width: '100%', height: 'auto', borderRadius: '6px', background: '#0a0810' } });
    body.appendChild(img);
    body.appendChild(el('div.row', { style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } }, [
      el('span.small.dim', { text: m.sub }),
      (() => { const a = el('a.btn.sm', { href: 'assets/maps/' + m.file, target: '_blank', rel: 'noopener', text: 'Open full size' }); return a; })()
    ]));
    UI.modal({ title: m.title, body, buttons: [{ label: 'Close', cls: 'primary' }] });
    const modal = document.getElementById('modal');
    modal.style.width = 'min(1100px, 96vw)';
    modal.style.maxHeight = '92vh';
  }

  // ---------------------------------------------------------------- helpers
  function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.toast('Copied to clipboard')).catch(() => UI.toast('Could not copy'));
    else UI.toast('Clipboard unavailable');
  }

  V.refresh = function () {
    if (DM.currentView !== 'cos') return;
    const scroll = document.getElementById('main').scrollTop;
    const old = rootEl;
    const fresh = V.render();
    if (old && old.isConnected) old.replaceWith(fresh); else document.getElementById('main').appendChild(fresh);
    rootEl = fresh;
    document.getElementById('main').scrollTop = scroll;
  };

  V.jump = function (chapterId) {
    V.tab = 'chapters';
    V.chapterId = chapterId;
    S.update(s => s.cos.activeChapter = chapterId);
    if (DM.currentView === 'cos') V.refresh();
    else DM.navigate('cos');
  };
})();
