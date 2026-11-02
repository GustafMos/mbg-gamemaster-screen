/* Shared UI: drawer, modals, toasts, command palette, dice, drag & drop */
(function () {
  'use strict';
  const U = DM.U;
  const el = U.el;
  const UI = {};
  DM.ui = UI;

  // ---------------------------------------------------------------- toast
  UI.toast = function (html, opts) {
    opts = opts || {};
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const t = el('div.toast' + (opts.cls ? '.' + opts.cls : ''), { html });
    wrap.appendChild(t);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 280);
    }, opts.timeout || 3400);
    return t;
  };

  // ---------------------------------------------------------------- drawer
  let drawerEl, drawerBody, drawerTitle, drawerTools, scrim;
  function initDrawer() {
    drawerEl = document.getElementById('drawer');
    drawerBody = document.getElementById('drawerBody');
    drawerTitle = document.getElementById('drawerTitle');
    drawerTools = document.getElementById('drawerTools');
    scrim = document.getElementById('scrim');
    document.getElementById('drawerClose').addEventListener('click', UI.closeDrawer);
    scrim.addEventListener('click', () => { UI.closeDrawer(); UI.closeModal(); });
  }

  UI.drawer = function (opts) {
    if (!drawerEl) initDrawer();
    opts = opts || {};
    drawerTitle.textContent = opts.title || '';
    drawerBody.innerHTML = '';
    drawerTools.innerHTML = '';
    if (typeof opts.body === 'string') drawerBody.innerHTML = opts.body;
    else if (opts.body) drawerBody.appendChild(opts.body);
    (opts.tools || []).forEach(t => {
      const b = el('button.icon-btn', { title: t.title || t.label || '', 'aria-label': t.title || t.label || '' });
      if (t.icon) b.appendChild(U.svg(t.icon));
      else b.textContent = t.label || '';
      if (t.cls) b.className += ' ' + t.cls;
      b.addEventListener('click', (e) => { e.preventDefault(); t.onClick && t.onClick(b); });
      drawerTools.appendChild(b);
    });
    drawerEl.classList.add('open');
    drawerEl.setAttribute('aria-hidden', 'false');
    scrim.classList.add('on');
    drawerBody.scrollTop = 0;
    return { body: drawerBody, tools: drawerTools };
  };
  UI.closeDrawer = function () {
    if (!drawerEl) return;
    const wasOpen = drawerEl.classList.contains('open');
    drawerEl.classList.remove('open');
    drawerEl.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('modalWrap').classList.contains('open')) scrim.classList.remove('on');
    if (wasOpen) DM.bus.emit('drawer-closed');
  };
  UI.isDrawerOpen = () => drawerEl && drawerEl.classList.contains('open');

  // ---------------------------------------------------------------- modal
  let modalWrap, modalEl;
  let modalOnClose = null;
  function initModal() {
    modalWrap = document.getElementById('modalWrap');
    modalEl = document.getElementById('modal');
    modalWrap.addEventListener('click', (e) => { if (e.target === modalWrap) UI.closeModal(); });
  }
  UI.modal = function (opts) {
    if (!modalWrap) initModal();
    opts = opts || {};
    modalOnClose = opts.onClose || null;
    modalEl.style.width = '';
    modalEl.style.maxHeight = '';
    modalEl.innerHTML = '';
    const head = el('div.modal-head', {}, [el('h2', { text: opts.title || '' })]);
    if (opts.subtitle) head.appendChild(el('span.small.dim', { text: opts.subtitle }));
    const close = el('button.icon-btn.sm', { 'aria-label': 'Close' }, [U.svg('close')]);
    close.addEventListener('click', UI.closeModal);
    head.appendChild(close);
    modalEl.appendChild(head);
    const body = el('div.modal-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modalEl.appendChild(body);
    const foot = el('div.modal-foot');
    (opts.buttons || [{ label: 'Close', cls: 'ghost', onClick: UI.closeModal }]).forEach(b => {
      const btn = el('button.btn' + (b.cls ? '.' + b.cls.replace(/ /g, '.') : ''), { text: b.label, html: b.html });
      btn.addEventListener('click', () => { if (b.onClick) b.onClick(btn); else UI.closeModal(); });
      foot.appendChild(btn);
    });
    modalEl.appendChild(foot);
    modalWrap.classList.add('open');
    modalWrap.setAttribute('aria-hidden', 'false');
    document.getElementById('scrim').classList.add('on');
    if (opts.onMount) opts.onMount(modalEl, body);
    const focusEl = modalEl.querySelector('input, textarea, select, button.btn.primary');
    if (focusEl) setTimeout(() => focusEl.focus(), 40);
    return { modal: modalEl, body, foot, close: UI.closeModal };
  };
  UI.closeModal = function () {
    if (!modalWrap) return;
    const wasOpen = modalWrap.classList.contains('open');
    modalWrap.classList.remove('open');
    modalWrap.setAttribute('aria-hidden', 'true');
    if (!UI.isDrawerOpen()) document.getElementById('scrim').classList.remove('on');
    if (wasOpen && modalOnClose) { const fn = modalOnClose; modalOnClose = null; fn(); }
  };
  UI.confirm = function (opts) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (v) => { if (settled) return; settled = true; UI.closeModal(); resolve(v); };
      UI.modal({
        title: opts.title || 'Are you sure?',
        body: '<p class="muted">' + U.esc(opts.message || '') + '</p>',
        buttons: [
          { label: opts.cancel || 'Cancel', cls: 'ghost', onClick: () => finish(false) },
          { label: opts.confirm || 'Confirm', cls: opts.danger ? 'danger' : 'primary', onClick: () => finish(true) }
        ],
        onClose: () => finish(false)
      });
    });
  };
  UI.prompt = function (opts) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (v) => { if (settled) return; settled = true; UI.closeModal(); resolve(v); };
      const input = el('input', { type: 'text', value: opts.value || '', placeholder: opts.placeholder || '' });
      const body = el('div', {}, [el('label.label', { text: opts.label || '' }), input]);
      UI.modal({
        title: opts.title || 'Enter a value',
        body,
        buttons: [
          { label: 'Cancel', cls: 'ghost', onClick: () => finish(null) },
          { label: opts.confirm || 'Save', cls: 'primary', onClick: () => finish(input.value) }
        ],
        onClose: () => finish(null),
        onMount: () => {
          input.focus(); input.select();
          input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(input.value); } });
        }
      });
    });
  };

  // ---------------------------------------------------------------- navigation
  UI.NAV = [
    { id: 'dashboard', label: 'Table', icon: 'home', hint: 'Alt+1' },
    { id: 'party', label: 'Party', icon: 'users', hint: 'Alt+2' },
    { id: 'sheets', label: 'Sheets', icon: 'scroll', hint: 'Alt+3' },
    { id: 'initiative', label: 'Initiative', icon: 'swords', hint: 'Alt+4' },
    { id: 'grid', label: 'Map', icon: 'map', hint: 'Alt+M' },
    { id: 'bestiary', label: 'Bestiary', icon: 'skull', hint: 'Alt+5' },
    { id: 'compendium', label: 'Search', icon: 'search', hint: 'Alt+6' },
    { id: 'encounters', label: 'Encounters', icon: 'target', hint: 'Alt+7' },
    { id: 'cos', label: 'Adventure', icon: 'castle', hint: 'Alt+8' },
    { id: 'notes', label: 'Notes', icon: 'notes', hint: 'Alt+9' },
    { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Alt+0' }
  ];

  UI.renderNav = function () {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const active = DM.currentView || 'dashboard';
    nav.innerHTML = '';
    UI.NAV.forEach(item => {
      const a = el('a.nav-item' + (active === item.id ? '.active' : ''), {
        href: '#/' + item.id, title: item.label + ' (' + item.hint + ')', 'data-nav': item.id
      }, [U.svg(item.icon), el('span.nav-label', { text: item.label })]);
      if (item.id === 'initiative') {
        const n = DM.store.state.encounter.combatants.length;
        if (n) a.appendChild(el('span.nav-badge', { text: String(n) }));
      }
      if (item.id === 'sheets') {
        const n = (DM.store.state.sheets || []).length;
        if (n) a.appendChild(el('span.nav-badge.quiet', { text: String(n) }));
      }
      if (item.id === 'cos' && DM.store.state.encounter.active) {
        a.appendChild(el('span.nav-badge.quiet', { text: '●' }));
      }
      nav.appendChild(a);
    });
    const sep = el('div.nav-sep');
    nav.appendChild(sep);
  };

  // ---------------------------------------------------------------- command palette
  let pal, palInput, palResults, palFilters, palHint;
  let palState = { items: [], sel: 0, kind: null, query: '' };

  UI.initPalette = function () {
    pal = document.getElementById('palette');
    palInput = document.getElementById('paletteInput');
    palResults = document.getElementById('paletteResults');
    palFilters = document.getElementById('paletteFilters');
    palHint = document.getElementById('paletteHint');
    const kinds = [
      ['All', null], ['Monsters', 'monster'], ['Items', 'item'], ['Spells', 'spell'],
      ['Rules', 'rules'], ['Adventure Areas', 'area'], ['Cards', 'tarokka']
    ];
    palFilters.innerHTML = '';
    kinds.forEach(([label, kind]) => {
      const b = el('button.chip' + (kind === null ? '.on' : ''), { text: label, 'data-kind': kind || '' });
      b.addEventListener('click', () => {
        palState.kind = kind;
        U.$$('.chip', palFilters).forEach(x => x.classList.toggle('on', (x.dataset.kind || null) === kind));
        renderPalette();
      });
      palFilters.appendChild(b);
    });
    palInput.addEventListener('input', () => { palState.query = palInput.value; renderPalette(); });
    palInput.addEventListener('keydown', palKey);
    pal.addEventListener('click', e => { if (e.target === pal) UI.closePalette(); });
    document.getElementById('searchLaunch').addEventListener('click', () => UI.openPalette(''));
    const jump = document.getElementById('paletteHint');
    if (jump) jump.textContent = '';
  };

  UI.openPalette = function (initial) {
    if (!pal) UI.initPalette();
    pal.classList.add('open');
    palInput.value = initial || '';
    palState.query = initial || '';
    palState.sel = 0;
    renderPalette();
    setTimeout(() => palInput.focus(), 20);
  };
  UI.closePalette = function () {
    if (!pal) return;
    pal.classList.remove('open');
  };
  UI.paletteOpen = () => pal && pal.classList.contains('open');

  function palKey(e) {
    if (e.key === 'Escape') { UI.closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); palState.sel = Math.min(palState.items.length - 1, palState.sel + 1); paintPaletteSel(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); palState.sel = Math.max(0, palState.sel - 1); paintPaletteSel(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = palState.items[palState.sel];
      if (!item) return;
      if (e.ctrlKey || e.metaKey) {
        if (item.type === 'doc' && item.doc.kind === 'monster') {
          const monster = item.doc.ref && item.doc.ref.source ? DM.data.monster(item.doc.ref.name, item.doc.ref.source) : DM.data.monster(item.doc.ref.name);
          if (monster) {
            DM.store.addMonsterCombatant(monster, 1);
            UI.toast('Added <b>' + U.esc(monster.name) + '</b> to initiative', { timeout: 2200 });
            return;
          }
        }
        if (item.type === 'doc' && item.doc.kind === 'item') {
          UI.closePalette();
          UI.quickAddItem(item.doc);
          return;
        }
      }
      choosePalette(item);
    }
  }

  function choosePalette(item) {
    if (!item) return;
    if (item.type === 'action') { UI.closePalette(); item.action(); return; }
    if (item.type === 'suggest') { UI.closePalette(); UI.openPalette(item.label); return; }
    if (item.type === 'recent') {
      const doc = DM.search.byKind(item.kind).find(d => d.name.toLowerCase() === String(item.label).toLowerCase());
      UI.closePalette();
      if (doc) { UI.openDoc(doc); return; }
      if (item.kind === 'monster') UI.openMonster(item.label);
      else if (item.kind === 'item') UI.openItem(item.label);
      else if (item.kind === 'spell') UI.openSpell(item.label);
      return;
    }
    if (item.type === 'doc') {
      UI.closePalette();
      UI.openDoc(item.doc);
    }
  }

  function palActions() {
    const acts = [
      { label: 'Roll initiative for everyone', sub: 'Initiative', icon: 'swords', action: () => DM.actions.rollAllInit() },
      { label: 'Start / open initiative tracker', sub: 'Initiative', icon: 'target', action: () => DM.navigate('initiative') },
      { label: 'Draw a tarokka card', sub: 'Adventure', icon: 'sparkle', action: () => DM.actions.drawTarokka() },
      { label: 'Random Barovian encounter', sub: 'Adventure', icon: 'skull', action: () => DM.actions.randomEncounter() },
      { label: 'Long rest the party', sub: 'Party', icon: 'moon', action: () => DM.actions.longRest() },
      { label: 'New note', sub: 'Notes', icon: 'notes', action: () => DM.actions.newNote() },
      { label: 'Export campaign backup', sub: 'Settings', icon: 'download', action: () => DM.actions.exportData() }
    ];
    return acts.map(a => ({ type: 'action', label: a.label, sub: a.sub, icon: a.icon, action: a.action }));
  }

  function renderPalette() {
    const q = palState.query.trim();
    let items = [];
    if (!q) {
      // recent + favourites + actions
      const recent = (DM.store.state.recent || []).slice(0, 5).map(r => ({ type: 'recent', kind: r.kind, name: r.name }));
      const favs = [];
      ['monster', 'item', 'spell'].forEach(k => {
        (DM.store.state.favorites[k] || []).slice(0, 4).forEach(f => favs.push({ type: 'fav', kind: k, name: f.name, source: f.source }));
      });
      items = [
        ...palActions().slice(0, 5),
        ...recent.map(r => ({ type: 'recent', label: r.name, sub: 'Recent · ' + cap(r.kind), kind: r.kind })),
        ...favs.map(f => ({ type: 'recent', label: f.name, sub: 'Favourite · ' + cap(f.kind), kind: f.kind }))
      ];
      palHint.textContent = '';
    } else {
      const params = { limit: 40, collapse: true };
      if (palState.kind === 'rules') params.filters = { kinds: ['feat', 'condition', 'rule'] };
      else if (palState.kind) params.kind = palState.kind;
      const res = DM.search.query(q, params);
      items = res.map(r => ({ type: 'doc', doc: r.doc, score: r.score, snippet: r.snippet }));
      palHint.textContent = res.length ? res.length + ' results' : 'No matches — try fewer words';
      if (!res.length) {
        const sug = DM.search.suggestions(q, { kind: palState.kind === 'rules' ? null : palState.kind });
        if (sug.length) items = sug.map(s => ({ type: 'suggest', label: s.name, kind: s.kind }));
      }
    }
    palState.items = items;
    palState.sel = U.clamp(palState.sel, 0, Math.max(0, items.length - 1));
    palResults.innerHTML = '';
    if (!items.length) {
      palResults.innerHTML = '<div class="pal-empty">Nothing found. Try a vaguer word — “fire sword”, “undead boss”, “healing potion”.</div>';
      return;
    }
    items.forEach((it, i) => {
      let row;
      if (it.type === 'doc') {
        const d = it.doc;
        row = el('div.pal-item' + (i === palState.sel ? '.sel' : ''), { 'data-i': i }, [
          el('div.result-glyph.' + glyphClass(d.kind), { text: glyph(d.kind) }),
          el('div.pi-main', {}, [
            el('div.pi-name', {}, [d.name, el('span.pi-kind', { text: DM.search.KIND_LABEL[d.kind] || d.kind })]),
            el('div.pi-sub', { text: it.snippet || d.sub })
          ]),
          el('div.pi-kind', { text: d.meta || '' })
        ]);
      } else if (it.type === 'action') {
        row = el('div.pal-item' + (i === palState.sel ? '.sel' : ''), { 'data-i': i }, [
          el('div.result-glyph', {}, [U.svg(it.icon || 'sparkle')]),
          el('div.pi-main', {}, [el('div.pi-name', { text: it.label }), el('div.pi-sub', { text: it.sub })]),
          el('div.pi-kind', { text: 'Action' })
        ]);
      } else {
        row = el('div.pal-item' + (i === palState.sel ? '.sel' : ''), { 'data-i': i }, [
          el('div.result-glyph.' + glyphClass(it.kind), { text: glyph(it.kind) }),
          el('div.pi-main', {}, [el('div.pi-name', { text: it.label }), el('div.pi-sub', { text: it.sub || (it.type === 'suggest' ? 'Did you mean…' : '') })]),
          el('div.pi-kind', { text: it.type === 'suggest' ? 'Suggestion' : '' })
        ]);
      }
      row.addEventListener('mouseenter', () => { palState.sel = i; paintPaletteSel(); });
      row.addEventListener('click', () => choosePalette(it));
      palResults.appendChild(row);
    });
  }

  function paintPaletteSel() {
    U.$$('.pal-item', palResults).forEach((r, i) => r.classList.toggle('sel', i === palState.sel));
    const sel = U.$('.pal-item.sel', palResults);
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function glyph(kind) {
    return ({ monster: 'M', item: 'I', spell: 'S', feat: 'F', condition: 'C', rule: 'R', area: 'A', chapter: 'C', tarokka: 'T', note: 'N' })[kind] || '·';
  }
  function glyphClass(kind) {
    return ({ monster: 'monster', item: 'item', spell: 'spell', rule: 'rule', condition: 'rule', feat: 'rule', area: 'rule', tarokka: 'item', note: 'rule' })[kind] || '';
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  // ---------------------------------------------------------------- dice
  let dicePop, diceGrid, diceLog;
  let diceHistory = [];
  let advMode = 0;

  UI.initDice = function () {
    dicePop = document.getElementById('dicePop');
    diceGrid = document.getElementById('diceGrid');
    diceLog = document.getElementById('diceLog');
    ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].forEach(d => {
      const b = el('button.die-btn', { text: d, 'data-die': d });
      b.addEventListener('click', () => UI.roll('1' + d, { adv: d === 'd20' ? advMode : 0 }));
      diceGrid.appendChild(b);
    });
    document.getElementById('diceRoll').addEventListener('click', () => {
      const expr = document.getElementById('diceExpr').value.trim();
      if (expr) UI.roll(expr, { adv: advMode });
    });
    document.getElementById('diceExpr').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('diceRoll').click();
    });
    U.$$('[data-adv]').forEach(b => b.addEventListener('click', () => {
      advMode = Number(b.dataset.adv);
      U.$$('[data-adv]').forEach(x => x.classList.toggle('on', Number(x.dataset.adv) === advMode));
    }));
    document.getElementById('diceBtn').addEventListener('click', e => { e.stopPropagation(); toggleDice(); });
    document.getElementById('quickDice').addEventListener('click', e => { e.stopPropagation(); toggleDice(); });
    document.getElementById('diceClose').addEventListener('click', () => dicePop.classList.remove('open'));
    document.addEventListener('click', e => {
      if (dicePop && dicePop.classList.contains('open') && !dicePop.contains(e.target) && e.target.id !== 'diceBtn' && !e.target.closest('#diceBtn') && !e.target.closest('#quickDice')) dicePop.classList.remove('open');
    });
    addDiceLog({ label: 'Ready to roll', total: null });
  };

  function toggleDice() {
    dicePop.classList.toggle('open');
    if (dicePop.classList.contains('open')) document.getElementById('diceExpr').focus();
  }

  function addDiceLog(r) {
    if (!diceLog) return;
    const row = el('div.dl-row' + (r.crit ? '.crit' : ''), {}, [
      el('span', { text: r.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
      el('span', { html: r.label }),
      r.total !== null && r.total !== undefined ? el('b', { text: String(r.total) }) : null
    ]);
    diceLog.prepend(row);
    while (diceLog.children.length > 18) diceLog.lastChild.remove();
  }

  UI.roll = function (expr, opts) {
    opts = opts || {};
    const r = U.dice.evaluate(expr, { adv: opts.adv || 0 });
    const mod = opts.mod ? Number(opts.mod) : 0;
    const total = r.total + mod;
    const label = (opts.label ? U.esc(opts.label) + ': ' : '') + '<b>' + U.esc(expr) + '</b>' + (mod ? (mod > 0 ? ' + ' + mod : ' − ' + Math.abs(mod)) : '');
    const detail = r.detail || '';
    UI.toast('<span class="t-dice">🎲</span> <span>' + label + ' → <b>' + total + '</b>' + (detail ? '<br><span class="dim small">' + U.esc(detail) + '</span>' : '') + '</span>', {
      cls: r.crit ? 'crit' : '', timeout: 4200
    });
    addDiceLog({ label: label + (detail ? ' <span class="dim">' + U.esc(detail) + '</span>' : ''), total: total, crit: r.crit, time: opts.time });
    return Object.assign({}, r, { total });
  };

  UI.rollCheck = function (mod, opts) {
    opts = opts || {};
    const r = U.dice.evaluate('1d20', { adv: opts.adv || 0 });
    const total = r.total + Number(mod || 0);
    const label = (opts.label ? U.esc(opts.label) + ' ' : '') + (mod >= 0 ? '+' : '−') + Math.abs(mod || 0);
    UI.toast('<span class="t-dice">d20</span> <span>' + label + ' → <b>' + total + '</b>' + (r.crit ? ' <b class="gold-text">CRIT!</b>' : r.fumble ? ' <b class="accent-text">FUMBLE</b>' : '') + '</span>', { cls: r.crit ? 'crit' : '' });
    addDiceLog({ label: label, total, crit: r.crit });
    return Object.assign({}, r, { total });
  };

  // ---------------------------------------------------------------- drag & drop
  UI.dragPayload = null;

  UI.draggable = function (elm, payloadFn) {
    elm.setAttribute('draggable', 'true');
    elm.addEventListener('dragstart', e => {
      let payload;
      try { payload = typeof payloadFn === 'function' ? payloadFn() : payloadFn; } catch (err) { payload = null; }
      if (!payload) { e.preventDefault(); return; }
      UI.dragPayload = payload;
      elm.classList.add('dragging');
      try {
        e.dataTransfer.setData('application/x-mbg-gamemaster', JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', payload.name || '');
        e.dataTransfer.effectAllowed = 'copyMove';
      } catch (err) { /* ignore */ }
    });
    elm.addEventListener('dragend', () => { elm.classList.remove('dragging'); UI.dragPayload = null; });
    return elm;
  };

  UI.dropzone = function (elm, onDrop, opts) {
    opts = opts || {};
    const enter = (e) => { e.preventDefault(); e.stopPropagation(); elm.classList.add('dragover'); };
    elm.addEventListener('dragenter', enter);
    elm.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; elm.classList.add('dragover'); });
    elm.addEventListener('dragleave', e => {
      if (e.target === elm || !elm.contains(e.relatedTarget)) elm.classList.remove('dragover');
    });
    elm.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      elm.classList.remove('dragover');
      let payload = null;
      try { payload = JSON.parse(e.dataTransfer.getData('application/x-mbg-gamemaster') || 'null'); } catch (err) { payload = null; }
      if (!payload) payload = UI.dragPayload;
      if (payload) onDrop(payload, e);
    });
    return elm;
  };

  // ---------------------------------------------------------------- entities
  UI.monsterButton = function (html, name) {
    return '<button class="btn sm" data-open-monster="' + U.esc(name) + '">' + html + '</button>';
  };

  UI.openMonster = function (name, source) {
    const m = source ? DM.data.monster(name, source) : DM.data.monster(name);
    if (!m) {
      UI.toast('Statblock not found for <b>' + U.esc(name) + '</b>', { cls: '' });
      return;
    }
    DM.store.touch('monster', m.name);
    const fav = DM.store.isFav('monster', m.name + '|' + m.source);
    const hb = !!(m.homebrew || m.source === 'HB');
    const { body } = UI.drawer({
      title: m.name,
      body: '<div class="statblock-wrap">' + DM.render.monster(m) + '</div>',
      tools: [
        { icon: 'star', title: 'Favourite', cls: fav ? 'fav-on' : '', onClick: (b) => { const on = DM.store.toggleFav('monster', { id: m.name + '|' + m.source, name: m.name, source: m.source }); b.style.color = on ? 'var(--gold)' : ''; UI.toast(on ? 'Added to favourites' : 'Removed from favourites'); } },
        { icon: 'print', title: 'Print statblock', onClick: () => setTimeout(() => window.print(), 120) },
        { icon: 'swords', title: 'Add to initiative', onClick: () => { DM.store.addMonsterCombatant(m, 1); UI.toast('Added <b>' + U.esc(m.name) + '</b> to initiative'); } },
        { icon: 'plus', title: 'Add to encounter builder', onClick: () => { DM.actions.addToEncounter(m); } },
        { icon: 'edit', title: hb ? 'Edit homebrew' : 'Clone & customise', onClick: () => { if (hb) DM.actions.editHomebrew('monster', m); else DM.actions.cloneMonster(m); } }
      ]
    });
    body.querySelector('.sb-name').style.marginTop = '0';
    return body;
  };

  UI.openItem = function (itemOrName, source) {
    const item = typeof itemOrName === 'string' ? DM.data.item(itemOrName, source) : itemOrName;
    if (!item) { UI.toast('Item not found.'); return; }
    DM.store.touch('item', item.name);
    const fav = DM.store.isFav('item', item.name + '|' + (item.source || ''));
    const hb = !!(item.homebrew || item.source === 'HB');
    const { body } = UI.drawer({
      title: item.name,
      body: DM.render.item(item),
      tools: [
        { icon: 'star', title: 'Favourite', onClick: (b) => { const on = DM.store.toggleFav('item', { id: item.name + '|' + (item.source || ''), name: item.name, source: item.source }); b.style.color = on ? 'var(--gold)' : ''; } },
        { icon: 'print', title: 'Print item', onClick: () => setTimeout(() => window.print(), 120) },
        { icon: 'users', title: 'Give to a party member', onClick: () => UI.giveItem(item) },
        { icon: 'edit', title: hb ? 'Edit homebrew' : 'Clone & customise', onClick: () => { if (hb) DM.actions.editHomebrew('item', item); else DM.actions.cloneItem(item); } }
      ]
    });
    body.querySelector('.sb-name').style.marginTop = '0';
    return body;
  };

  UI.openSpell = function (spellOrName, source) {
    const sp = typeof spellOrName === 'string' ? DM.data.spell(spellOrName, source) : spellOrName;
    if (!sp) { UI.toast('Spell not found.'); return; }
    DM.store.touch('spell', sp.name);
    const fav = DM.store.isFav('spell', sp.name + '|' + (sp.source || ''));
    const hb = !!(sp.homebrew || sp.source === 'HB');
    UI.drawer({
      title: sp.name,
      body: DM.render.spell(sp),
      tools: [
        { icon: 'star', title: 'Favourite', onClick: (b) => { const on = DM.store.toggleFav('spell', { id: sp.name + '|' + (sp.source || ''), name: sp.name, source: sp.source }); b.style.color = on ? 'var(--gold)' : ''; } },
        { icon: 'print', title: 'Print spell', onClick: () => setTimeout(() => window.print(), 120) },
        { icon: 'notes', title: 'Copy to notes', onClick: () => { DM.actions.spellToNote(sp); } },
        { icon: 'edit', title: hb ? 'Edit homebrew' : 'Copy to homebrew', onClick: () => { if (hb) DM.actions.editHomebrew('spell', sp); else DM.actions.newHomebrew('spell', sp); } }
      ]
    });
  };

  UI.openRule = function (name) {
    const rule = DM.data.rule(name);
    if (!rule) { UI.toast('Entry not found: ' + U.esc(name)); return; }
    const kind = (DM.data.rules.conditions || []).includes(rule) ? 'Condition' : (DM.data.rules.feats || []).includes(rule) ? 'Feat' : 'Rule';
    UI.drawer({
      title: rule.name,
      body: '<div class="statblock"><h2 class="sb-name">' + U.esc(rule.name) + '</h2><div class="sb-meta">' + kind + (rule.source ? ' · ' + U.esc(rule.source) : '') + '</div><hr class="sb-rule thin">' + DM.render.entries(rule.entries) + '</div>'
    });
  };

  UI.openDoc = function (doc) {
    if (!doc) return;
    if (doc.kind === 'monster') return UI.openMonster(doc.ref.name, doc.ref.source);
    if (doc.kind === 'item') return UI.openItem(doc.ref.name, doc.ref.source);
    if (doc.kind === 'spell') return UI.openSpell(doc.ref.name, doc.ref.source);
    if (doc.kind === 'feat' || doc.kind === 'condition' || doc.kind === 'rule') return UI.openRule(doc.ref.name);
    if (doc.kind === 'note') { DM.navigate('notes'); setTimeout(() => DM.views.notes.open(doc.ref.noteId), 60); return; }
    if (doc.kind === 'tarokka') { UI.openTarokka(doc.ref.name); return; }
    if (doc.kind === 'area' || doc.kind === 'chapter') {
      DM.actions.gotoCos(doc.ref.chapterId, doc.ref.anchor, doc.name);
      return;
    }
  };

  UI.openTarokka = function (name) {
    const card = (DM.data.tarokka.cards || []).find(c => c.name.toLowerCase() === String(name).toLowerCase());
    if (!card) return;
    UI.drawer({
      title: card.name,
      body: '<div class="statblock"><h2 class="sb-name">' + U.esc(card.name) + '</h2>' +
        '<div class="sb-meta">' + (card.suit ? U.esc(card.suit) + ' · ' + U.esc(String(card.value)) : 'High Deck') + '</div><hr class="sb-rule thin">' +
        DM.render.entries(card.entries) + '</div>'
    });
  };

  UI.giveItem = function (item) {
    const players = DM.store.state.players;
    if (!players.length) { UI.toast('Create a party member first.'); return; }
    const body = el('div', {}, [
      el('p.muted.small', { text: 'Add “' + item.name + '” to whose inventory?' }),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        players.map(p => {
          const b = el('button.btn', { style: { justifyContent: 'flex-start' } }, [
            el('span.avatar.sm', { text: U.initials(p.name) }), p.name
          ]);
          b.addEventListener('click', () => {
            DM.store.update(s => {
              const pl = s.players.find(x => x.id === p.id);
              if (!pl) return;
              const existing = pl.inventory.find(i => i.name === item.name && i.source === item.source);
              if (existing) existing.qty = (existing.qty || 1) + 1;
              else pl.inventory.push({ id: U.uid('inv'), name: item.name, source: item.source || '', qty: 1 });
            });
            UI.closeModal();
            UI.toast('Added <b>' + U.esc(item.name) + '</b> to ' + U.esc(p.name) + '’s inventory');
          });
          return b;
        }))
    ]);
    UI.modal({ title: 'Give item', body, buttons: [{ label: 'Cancel', cls: 'ghost' }] });
  };

  // Quick add item without full drawer (palette ctrl+enter)
  UI.quickAddItem = function (doc) {
    const item = DM.data.item(doc.ref.name, doc.ref.source);
    if (item) UI.giveItem(item);
  };

  // ---------------------------------------------------------------- delegated clicks
  UI.initDelegates = function () {
    document.addEventListener('click', e => {
      const dice = e.target.closest('[data-dice]');
      if (dice) {
        e.preventDefault();
        const expr = dice.dataset.dice;
        UI.roll(expr, { label: dice.dataset.label || '' });
        return;
      }
      const t = e.target.closest('[data-ref-kind]');
      if (t) {
        const kind = t.dataset.refKind, name = t.dataset.refName;
        if (kind === 'spell') { UI.openSpell(name, t.dataset.refSource); return; }
        if (kind === 'creature' || kind === 'monster') { UI.openMonster(name, t.dataset.refSource); return; }
        if (kind === 'item') { UI.openItem(name, t.dataset.refSource); return; }
        if (kind === 'condition' || kind === 'rule' || kind === 'feat') { UI.openRule(name); return; }
        if (kind === 'tarokka') { UI.openTarokka(name); return; }
        if (kind === 'table') { DM.navigate('cos'); return; }
      }
      const mon = e.target.closest('[data-open-monster]');
      if (mon) { UI.openMonster(mon.dataset.openMonster, mon.dataset.source); return; }
      const it = e.target.closest('[data-open-item]');
      if (it) { UI.openItem(it.dataset.openItem); return; }
      const area = e.target.closest('[data-area]');
      if (area) { DM.actions.gotoArea(area.dataset.area); return; }
      const rollBtn = e.target.closest('[data-table-roll]');
      if (rollBtn) {
        const wrap = rollBtn.closest('[data-roll-table]');
        if (wrap) {
          const rows = Array.from(wrap.querySelectorAll('tr[data-roll-min]'));
          const die = Number(rollBtn.dataset.die) || 20;
          const n = 1 + Math.floor(Math.random() * die);
          const row = rows.find(r => n >= Number(r.dataset.rollMin) && n <= Number(r.dataset.rollMax));
          rows.forEach(r => r.classList.remove('rolled'));
          if (row) {
            row.classList.add('rolled');
            row.style.background = 'rgba(201,163,94,.16)';
            setTimeout(() => { row.style.background = ''; }, 5000);
            UI.toast('<span class="t-dice">d' + die + '</span> → <b>' + n + '</b> · ' + U.esc(row.innerText.slice(0, 120)), { cls: 'crit' });
          } else {
            UI.toast('<span class="t-dice">d' + die + '</span> → <b>' + n + '</b>');
          }
        }
      }
    });
  };

  // ---------------------------------------------------------------- keyboard help
  UI.shortcuts = function () {
    const rows = [
      ['Ctrl / ⌘ + K', 'Open global search'],
      ['Alt + 1…0', 'Jump between screens'],
      ['Alt + M', 'Open the battle map'],
      ['N', 'Next turn in initiative'],
      ['P', 'Previous turn'],
      ['/', 'Focus the search on this screen'],
      ['D', 'Open the dice roller'],
      ['Esc', 'Close drawer, modal or palette'],
      ['?', 'Show this help']
    ];
    UI.modal({
      title: 'Keyboard shortcuts',
      body: '<div class="grid g2" style="gap:8px">' + rows.map(([k, v]) =>
        '<div class="row" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><kbd>' + U.esc(k) + '</kbd><span class="small muted">' + U.esc(v) + '</span></div>').join('') + '</div>' +
        '<p class="small dim" style="margin:14px 0 0">Search tip: type vague concepts — “fiery sword”, “undead boss”, “ice spell”, “K15” — and combine with <b>cr:</b>, <b>level:</b>, <b>rarity:</b> filters.</p>' +
        '<p class="small dim" style="margin:6px 0 0">5e content from the 5etools mirror. published adventure text © Wizards of the Coast — own the book to use it.</p>',
      buttons: [{ label: 'Got it', cls: 'primary' }]
    });
  };

  UI.init = function () {
    initDrawer();
    initModal();
    UI.initDelegates();
  };
})();
