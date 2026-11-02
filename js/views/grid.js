/* Simple battle map: draggable tokens and 5e grid distance measurement */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.grid = V;

  let rootEl = null;
  let surface = null;
  let layer = null;
  let sideEl = null;
  let distanceEl = null;
  let measureBtn = null;
  let selected = null;

  const measure = { active: false, start: null, end: null, locked: false };

  // ---------------------------------------------------------------- setup
  V.render = function () {
    const map = S.state.map;
    maybePlaceParty(map);
    selected = selected && map.tokens.some(t => t.id === selected) ? selected : null;

    rootEl = el('div.view.grid-view');
    rootEl.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Tabletop' }),
        el('h1', { text: 'Battle Map' }),
        el('p', { text: 'Drag tokens around the grid. Drag a token onto the initiative bar to add it to the fight, or drag a combatant from the bar onto the grid. Switch on Measure and drag across the map to read the distance.' })
      ]),
      el('div.head-actions', {}, [
        (() => { const b = el('button.btn.sm', {}, [U.svg('users'), el('span', { text: 'Place party' })]); b.addEventListener('click', addAllParty); return b; })(),
        (() => { const b = el('button.btn.sm', {}, [U.svg('plus'), el('span', { text: 'Add token' })]); b.addEventListener('click', addTokenDialog); return b; })(),
        (() => { const b = el('button.btn.primary.sm', {}, [U.svg('map'), el('span', { text: 'Measure' })]); measureBtn = b; b.addEventListener('click', toggleMeasure); return b; })(),
        (() => { const b = el('button.btn.ghost.sm', {}, [U.svg('trash')]); b.title = 'Clear all tokens'; b.addEventListener('click', clearTokens); return b; })()
      ])
    ]));

    const toolbar = el('div.toolbar.map-toolbar');
    toolbar.appendChild((() => {
      const wrap = el('div.row', { style: { gap: '6px' } }, [U.svg('map'), el('span.small.dim', { text: 'Grid' })]);
      const sel = el('select', { style: { width: 'auto', padding: '4px 8px', fontSize: '11px' } });
      [['20,15', '20 × 15'], ['24,16', '24 × 16'], ['30,20', '30 × 20'], ['40,25', '40 × 25']].forEach(([v, l]) => sel.appendChild(el('option', { value: v, text: l })));
      sel.value = map.cols + ',' + map.rows;
      sel.addEventListener('change', () => {
        const [c, r] = sel.value.split(',').map(Number);
        S.updateMap({ cols: c, rows: r });
        map.tokens.forEach(t => { t.x = Math.min(t.x, c - t.size); t.y = Math.min(t.y, r - t.size); });
        S.save();
        V.refresh();
      });
      wrap.appendChild(sel);
      return wrap;
    })());
    toolbar.appendChild((() => {
      const wrap = el('div.row', { style: { gap: '4px' } }, [el('span.small.dim', { text: 'Cell' })]);
      const minus = el('button.qty-btn', { text: '−', title: 'Smaller grid' });
      minus.addEventListener('click', () => { S.updateMap({ cell: U.clamp(map.cell - 4, 32, 72) }); V.refresh(); });
      const plus = el('button.qty-btn', { text: '+', title: 'Larger grid' });
      plus.addEventListener('click', () => { S.updateMap({ cell: U.clamp(map.cell + 4, 32, 72) }); V.refresh(); });
      wrap.appendChild(minus);
      wrap.appendChild(el('span.small.mono', { text: map.cell + 'px' }));
      wrap.appendChild(plus);
      return wrap;
    })());
    toolbar.appendChild((() => {
      const wrap = el('div.row', { style: { gap: '6px' } }, [el('span.small.dim', { text: 'Distance' })]);
      const sel = el('select', { style: { width: 'auto', padding: '4px 8px', fontSize: '11px' } });
      sel.appendChild(el('option', { value: 'simple', text: '5 ft per square' }));
      sel.appendChild(el('option', { value: 'alternating', text: '5–10–5 diagonals' }));
      sel.value = map.diagonal;
      sel.addEventListener('change', () => { S.updateMap({ diagonal: sel.value }); drawMeasure(); });
      wrap.appendChild(sel);
      return wrap;
    })());
    toolbar.appendChild(el('span.spacer'));
    distanceEl = el('span.map-readout', { text: 'Measure is off' });
    toolbar.appendChild(distanceEl);
    rootEl.appendChild(toolbar);

    const layout = el('div.map-layout');

    const panel = el('div.panel.map-panel');
    const scroll = el('div.map-scroll');
    surface = el('div.map-surface');
    surface.style.setProperty('--cell', map.cell + 'px');
    surface.style.width = (map.cols * map.cell) + 'px';
    surface.style.height = (map.rows * map.cell) + 'px';
    surface.classList.toggle('measuring', measure.active);

    layer = el('div.map-measure-layer');
    surface.appendChild(layer);

    map.tokens.forEach(t => surface.appendChild(tokenEl(t, map)));

    scroll.appendChild(surface);
    panel.appendChild(scroll);
    layout.appendChild(panel);

    sideEl = el('div.map-side');
    layout.appendChild(sideEl);
    rootEl.appendChild(layout);
    renderSide();
    drawMeasure();
    bindSurface();

    if (measure.active) {
      measureBtn.classList.add('gold');
      measureBtn.innerHTML = '';
      measureBtn.appendChild(U.svg('x'));
      measureBtn.appendChild(el('span', { text: 'Stop measuring' }));
    } else {
      measureBtn.classList.remove('gold');
    }

    return rootEl;
  };

  function maybePlaceParty(map) {
    if (map.initialized || !S.state.players.length) return;
    const players = S.state.players.filter(p => p.hp > 0 && !(p.conditions || []).includes('Dead'));
    players.forEach((p, i) => {
      map.tokens.push(S.normalizeMapToken({
        id: U.uid('token'), kind: 'player', playerId: p.id, name: p.name,
        x: 1 + (i % 6) * 2, y: 1 + Math.floor(i / 6) * 2,
        size: 1, hp: p.hp, maxHp: p.maxHp, ac: p.ac, color: p.color
      }));
    });
    map.initialized = true;
    S.save();
  }

  function tokenEl(t, map) {
    const eff = S.mapTokenHp(t);
    const cell = map.cell;
    const tok = el('div.map-token' + (t.kind === 'player' ? '.player' : '.monster') + (selected === t.id ? '.selected' : ''), {
      title: t.name + ' — ' + eff.hp + '/' + eff.maxHp + ' HP',
      'data-token': t.id
    });
    tok.style.left = (t.x * cell + 3) + 'px';
    tok.style.top = (t.y * cell + 3) + 'px';
    tok.style.width = (t.size * cell - 6) + 'px';
    tok.style.height = (t.size * cell - 6) + 'px';
    tok.style.setProperty('--tok-color', t.color || '#8c3a46');
    tok.appendChild(el('span.mt-initials', { text: U.initials(t.name) }));
    const bar = el('span.mt-hp');
    const pct = eff.maxHp ? Math.max(0, Math.min(100, eff.hp / eff.maxHp * 100)) : 0;
    bar.appendChild(el('i', { style: { width: pct + '%' } }));
    tok.appendChild(bar);
    if (eff.conditions && eff.conditions.length) tok.appendChild(el('span.mt-cond', { title: eff.conditions.join(', ') }));
    bindTokenDrag(tok, t, map);
    return tok;
  }

  function bindTokenDrag(tok, t, map) {
    tok.addEventListener('pointerdown', (e) => {
      if (measure.active || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      select(t.id);
      const startClientX = e.clientX, startClientY = e.clientY;
      const ox = t.x, oy = t.y;
      let moved = false;
      let overDock = false;
      const setDockHover = (on) => {
        if (overDock === on) return;
        overDock = on;
        tok.classList.toggle('drag-to-init', on);
        const dock = document.getElementById('dock');
        if (dock) dock.classList.toggle('dragover', on);
      };
      try { tok.setPointerCapture(e.pointerId); } catch (err) {}
      const move = (ev) => {
        if (isOverInitiativeDock(ev.clientX, ev.clientY)) { setDockHover(true); return; }
        setDockHover(false);
        const dx = Math.round((ev.clientX - startClientX) / map.cell);
        const dy = Math.round((ev.clientY - startClientY) / map.cell);
        if (!dx && !dy) return;
        moved = true;
        t.x = U.clamp(ox + dx, 0, map.cols - t.size);
        t.y = U.clamp(oy + dy, 0, map.rows - t.size);
        tok.style.left = (t.x * map.cell + 3) + 'px';
        tok.style.top = (t.y * map.cell + 3) + 'px';
      };
      const finish = (ev, cancelled) => {
        tok.removeEventListener('pointermove', move);
        tok.removeEventListener('pointerup', up);
        tok.removeEventListener('pointercancel', cancel);
        try { tok.releasePointerCapture(e.pointerId); } catch (err) {}
        const dropOnDock = !cancelled && (overDock || isOverInitiativeDock(ev.clientX, ev.clientY));
        setDockHover(false);
        if (dropOnDock) { sendTokenToInitiative(t); return; }
        if (!cancelled && moved) S.moveMapToken(t.id, t.x, t.y);
      };
      const up = (ev) => finish(ev, false);
      const cancel = (ev) => finish(ev, true);
      tok.addEventListener('pointermove', move);
      tok.addEventListener('pointerup', up);
      tok.addEventListener('pointercancel', cancel);
    });
    tok.addEventListener('dblclick', (e) => { e.stopPropagation(); select(t.id); openToken(t); });
  }

  function isOverInitiativeDock(x, y) {
    const dock = document.getElementById('dock');
    if (!dock) return false;
    const r = dock.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function sendTokenToInitiative(t) {
    const c = S.addTokenCombatant(t);
    if (c) UI.toast('🎲 <b>' + U.esc(t.name) + '</b> rolled into initiative');
    else UI.toast(U.esc(t.name) + ' is already in initiative');
  }

  function bindSurface() {
    surface.addEventListener('pointerdown', (e) => {
      if (!measure.active || e.button !== 0) {
        if (!measure.active && !e.target.closest('.map-token')) { selected = null; renderSide(); surface.querySelectorAll('.map-token.selected').forEach(x => x.classList.remove('selected')); }
        return;
      }
      e.preventDefault();
      const c = cellFromEvent(e);
      measure.start = c;
      measure.end = c;
      measure.locked = false;
      try { surface.setPointerCapture(e.pointerId); } catch (err) {}
      drawMeasure();
    });
    surface.addEventListener('pointermove', (e) => {
      const c = cellFromEvent(e);
      if (measure.active && measure.start && !measure.locked) {
        measure.end = c;
        drawMeasure();
      } else if (measure.active && !measure.start) {
        if (distanceEl) distanceEl.textContent = cellName(c.x, c.y);
      }
    });
    surface.addEventListener('pointerup', (e) => {
      if (!measure.active || !measure.start) return;
      measure.end = cellFromEvent(e);
      measure.locked = true;
      try { surface.releasePointerCapture(e.pointerId); } catch (err) {}
      drawMeasure();
    });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    UI.dropzone(surface, (payload, e) => {
      const c = cellFromEvent(e);
      if (payload.type === 'combatant') addCombatantToken(payload, c);
      else addPayloadToken(payload, c);
    });
  }

  function cellFromEvent(e) {
    const r = surface.getBoundingClientRect();
    const map = S.state.map;
    return {
      x: U.clamp(Math.floor((e.clientX - r.left) / map.cell), 0, map.cols - 1),
      y: U.clamp(Math.floor((e.clientY - r.top) / map.cell), 0, map.rows - 1)
    };
  }

  function cellName(x, y) {
    let n = x, s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s + (y + 1);
  }

  // ---------------------------------------------------------------- measurement
  function distance() {
    if (!measure.start) return null;
    const end = measure.end || measure.start;
    const dx = Math.abs(end.x - measure.start.x);
    const dy = Math.abs(end.y - measure.start.y);
    const diag = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diag;
    const squares = S.state.map.diagonal === 'alternating'
      ? straight + diag + Math.floor(diag / 2)
      : Math.max(dx, dy);
    return { feet: squares * 5, squares, dx, dy, start: measure.start, end };
  }

  function drawMeasure() {
    if (!layer || !distanceEl) return;
    const map = S.state.map;
    layer.innerHTML = '';
    layer.style.width = (map.cols * map.cell) + 'px';
    layer.style.height = (map.rows * map.cell) + 'px';
    if (!measure.start) {
      distanceEl.textContent = measure.active ? 'Click or drag across the grid' : 'Measure is off';
      return;
    }
    const d = distance();
    if (!d) return;
    const cell = map.cell;
    const sx = (d.start.x + .5) * cell, sy = (d.start.y + .5) * cell;
    const ex = (d.end.x + .5) * cell, ey = (d.end.y + .5) * cell;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    layer.innerHTML =
      '<svg width="' + (map.cols * cell) + '" height="' + (map.rows * cell) + '">' +
      '<line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey + '" class="measure-line"/>' +
      '<circle cx="' + sx + '" cy="' + sy + '" r="6" class="measure-dot"/>' +
      '<circle cx="' + ex + '" cy="' + ey + '" r="6" class="measure-dot end"/>' +
      '<g transform="translate(' + mx + ',' + (my - 10) + ')"><rect x="-38" y="-13" width="76" height="24" rx="4" class="measure-bg"/>' +
      '<text x="0" y="4" text-anchor="middle" class="measure-text">' + d.feet + ' ft.</text></g>' +
      '</svg>';
    distanceEl.textContent = d.feet + ' ft. · ' + d.squares + ' sq';
  }

  function toggleMeasure() {
    measure.active = !measure.active;
    measure.start = measure.end = null;
    measure.locked = false;
    V.refresh();
  }

  V.cancelMeasure = function () {
    if (DM.currentView !== 'grid') return false;
    if (!measure.active && !measure.start) return false;
    measure.active = false;
    measure.start = measure.end = null;
    measure.locked = false;
    V.refresh();
    return true;
  };

  // ---------------------------------------------------------------- side panel
  function renderSide() {
    if (!sideEl) return;
    sideEl.innerHTML = '';
    const map = S.state.map;
    const t = map.tokens.find(x => x.id === selected);

    // selected token
    const selPanel = el('div.panel');
    selPanel.appendChild(el('div.panel-head', {}, [el('h3', { text: t ? 'Selected token' : 'Map controls' }), el('span.spacer'), t ? el('span.tag', { text: t.kind }) : null]));
    const sb = el('div.panel-body');
    if (t) {
      const eff = S.mapTokenHp(t);
      sb.appendChild(el('div.row', { style: { gap: '9px', alignItems: 'flex-start' } }, [
        (() => {
          const a = el('div.avatar', { text: U.initials(t.name) });
          a.style.background = 'linear-gradient(150deg, ' + (t.color || '#8c3a46') + ', #1a1524)';
          return a;
        })(),
        el('div', { style: { flex: '1', minWidth: '0' } }, [
          el('div', { style: { fontFamily: 'var(--serif)', fontSize: '16px', fontWeight: '700' }, text: t.name }),
          el('div.small.dim', { text: 'HP ' + eff.hp + ' / ' + eff.maxHp + ' · AC ' + eff.ac })
        ])
      ]));
      const hpRow = el('div.row.wrap', { style: { gap: '4px', marginTop: '10px' } }, [
        ['−5', -5], ['−1', -1], ['+1', 1], ['+5', 5]
      ].map(([label, amount]) => {
        const b = el('button.chip' + (amount < 0 ? '.red' : '.green'), { text: label });
        b.addEventListener('click', () => adjustToken(t, Math.abs(amount), amount < 0 ? 'damage' : 'heal'));
        return b;
      }));
      sb.appendChild(hpRow);
      sb.appendChild(el('div.row.wrap', { style: { gap: '5px', marginTop: '10px' } }, [
        (() => {
          const b = el('button.btn.xs', { text: t.kind === 'player' ? 'Open character sheet' : 'Open statblock' });
          b.addEventListener('click', () => openToken(t));
          return b;
        })(),
        (() => {
          const b = el('button.btn.xs', { text: 'Add to initiative' });
          b.addEventListener('click', () => {
            if (t.playerId) { S.addPlayerCombatant(t.playerId); }
            else if (t.monsterName) { const m = DM.data.monster(t.monsterName, t.source); if (m) S.addMonsterCombatant(m, 1); }
            UI.toast('<b>' + U.esc(t.name) + '</b> added to initiative');
          });
          return b;
        })(),
        (() => {
          const b = el('button.hp-btn', { title: 'Remove token', text: '×' });
          b.addEventListener('click', () => { S.removeMapToken(t.id); selected = null; V.refresh(); });
          return b;
        })()
      ]));
      const sizeRow = el('div.row', { style: { gap: '5px', marginTop: '10px', alignItems: 'center' } }, [
        el('span.small.dim', { text: 'Size' }),
        (() => { const b = el('button.qty-btn', { text: '−' }); b.addEventListener('click', () => { S.update(() => { t.size = U.clamp(t.size - 1, 1, 4); }); V.refresh(); }); return b; })(),
        el('span.mono.small', { text: t.size + '×' + t.size }),
        (() => { const b = el('button.qty-btn', { text: '+' }); b.addEventListener('click', () => { S.update(() => { t.size = U.clamp(t.size + 1, 1, 4); }); V.refresh(); }); return b; })()
      ]);
      sb.appendChild(sizeRow);
    } else {
      sb.appendChild(el('div.small.dim', { text: 'Click a token to select it. Drag tokens with the mouse. Turn on Measure to drag a distance line across the grid.' }));
      sb.appendChild(el('div.tip-box', { style: { marginTop: '10px' }, html: '<b>Drag tokens</b> to move them, drop one on the initiative bar to add it to the fight, or drag a combatant from the bar back onto the map. <b>Measure</b> reads the grid.' }));
    }
    selPanel.appendChild(sb);
    sideEl.appendChild(selPanel);

    // token list
    const lp = el('div.panel');
    lp.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Tokens' }), el('span.spacer'), el('span.small.dim', { text: map.tokens.length + ' on map' })]));
    const lb = el('div.panel-body');
    if (!map.tokens.length) lb.appendChild(el('div.small.dim', { text: 'No tokens yet. Use “Place party” or drag a monster here.' }));
    else {
      const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } });
      map.tokens.forEach(t => {
        const eff = S.mapTokenHp(t);
        const row = el('div.map-token-row' + (t.id === selected ? '.selected' : ''), {}, [
          el('span.map-dot', { style: { background: t.color || '#8c3a46' } }),
          el('span', { style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: t.name }),
          el('span.tiny-text.dim', { text: eff.hp + '/' + eff.maxHp })
        ]);
        row.addEventListener('click', () => select(t.id));
        list.appendChild(row);
      });
      lb.appendChild(list);
    }
    lp.appendChild(lb);
    sideEl.appendChild(lp);

    // legend / instructions
    const help = el('div.panel');
    help.appendChild(el('div.panel-head', {}, [el('h3', { text: 'Measuring' })]));
    help.appendChild(el('div.panel-body', {}, [
      el('div.small.muted', { text: 'Measure mode: click or drag from one cell to another. Distance uses 5 ft per square by default, with optional 5–10–5 diagonal counting.' }),
      el('div.row', { style: { gap: '5px', marginTop: '8px' } }, [
        el('span.chip.static', { text: 'Drag to move' }),
        el('span.chip.static', { text: 'Measure across cells' })
      ])
    ]));
    sideEl.appendChild(help);
  }

  function select(id) {
    selected = id;
    if (!surface) return;
    surface.querySelectorAll('.map-token').forEach(tok => tok.classList.toggle('selected', tok.dataset.token === id));
    renderSide();
  }

  function openToken(t) {
    if (t.playerId) {
      const p = S.player(t.playerId);
      if (!p) return;
      const sheet = (S.state.sheets || []).find(sh => sh.name === p.name);
      if (sheet) DM.views.sheets.open(sheet.id);
      else DM.views.sheets.createFromPlayer(p.id);
      return;
    }
    if (t.monsterName) UI.openMonster(t.monsterName, t.source);
  }

  function adjustToken(t, amount, kind) {
    if (t.playerId) S.adjustPlayerHp(t.playerId, amount, kind === 'damage');
    else S.update(() => {
      if (kind === 'damage') t.hp = U.clamp(t.hp - amount, 0, t.maxHp);
      else t.hp = U.clamp(t.hp + amount, 0, t.maxHp);
    });
    V.refresh();
  }

  // ---------------------------------------------------------------- add / remove
  function findFreeCell(size) {
    const map = S.state.map;
    size = size || 1;
    for (let y = 0; y <= map.rows - size; y++) {
      for (let x = 0; x <= map.cols - size; x++) {
        const busy = map.tokens.some(t => !(x + size <= t.x || x >= t.x + t.size || y + size <= t.y || y >= t.y + t.size));
        if (!busy) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  function monsterSize(m) {
    if (!m || !m.size) return 1;
    const s = String(m.size)[0];
    return s === 'L' ? 2 : s === 'H' ? 3 : s === 'G' ? 4 : 1;
  }

  function addCombatantToken(payload, cell) {
    const c = S.combatant(payload.combatantId);
    if (!c) return;
    const eff = S.effectiveCombatant(c);
    if (c.playerId) {
      const existing = S.state.map.tokens.find(t => t.playerId === c.playerId);
      if (existing) {
        S.moveMapToken(existing.id, cell.x, cell.y);
        selected = existing.id;
        V.refresh();
        UI.toast('Moved <b>' + U.esc(c.name) + '</b> on the map');
        return;
      }
      addPayloadToken({ type: 'player', playerId: c.playerId }, cell);
      return;
    }
    const existing = S.state.map.tokens.find(t => t.combatantId === c.id);
    if (existing) {
      S.moveMapToken(existing.id, cell.x, cell.y);
      selected = existing.id;
      V.refresh();
      UI.toast('Moved <b>' + U.esc(c.name) + '</b> on the map');
      return;
    }
    const m = c.monsterName ? DM.data.monster(c.monsterName, c.source) : null;
    const size = monsterSize(m);
    const pos = cell || findFreeCell(size);
    const tok = S.addMapToken({
      kind: 'monster', monsterName: c.monsterName, source: c.source, combatantId: c.id, name: c.name,
      x: pos.x, y: pos.y, size, hp: eff.hp, maxHp: eff.maxHp, ac: eff.ac, color: c.color
    });
    selected = tok.id;
    V.refresh();
    UI.toast('Placed <b>' + U.esc(c.name) + '</b> on the map');
  }

  function addPayloadToken(payload, cell) {
    if (!payload) return;
    if (payload.type === 'player') {
      const p = S.player(payload.playerId);
      if (!p) return;
      if (S.state.map.tokens.some(t => t.playerId === p.id)) { UI.toast(p.name + ' is already on the map'); return; }
      const pos = cell || findFreeCell(1);
      S.addMapToken({ kind: 'player', playerId: p.id, name: p.name, x: pos.x, y: pos.y, size: 1, hp: p.hp, maxHp: p.maxHp, ac: p.ac, color: p.color });
      UI.toast('Added <b>' + U.esc(p.name) + '</b> to the map');
      V.refresh();
      return;
    }
    if (payload.type === 'monster') {
      const m = DM.data.monster(payload.name, payload.source);
      if (!m) return;
      const size = monsterSize(m);
      const pos = cell || findFreeCell(size);
      S.addMapToken({
        kind: 'monster', monsterName: m.name, source: m.source, name: m.name,
        x: pos.x, y: pos.y, size, hp: S.monsterHp(m), maxHp: S.monsterHp(m), ac: S.monsterAc(m), color: '#7a2b33'
      });
      UI.toast('Added <b>' + U.esc(m.name) + '</b> to the map');
      V.refresh();
    }
  }

  function addAllParty() {
    const players = S.state.players.filter(p => p.hp > 0 && !(p.conditions || []).includes('Dead'));
    if (!players.length) { UI.toast('No living party members to place.'); return; }
    let added = 0;
    players.forEach(p => {
      if (S.state.map.tokens.some(t => t.playerId === p.id)) return;
      const pos = findFreeCell(1);
      S.addMapToken({ kind: 'player', playerId: p.id, name: p.name, x: pos.x, y: pos.y, size: 1, hp: p.hp, maxHp: p.maxHp, ac: p.ac, color: p.color });
      added++;
    });
    V.refresh();
    UI.toast(added ? 'Placed <b>' + added + '</b> party members' : 'The party is already on the map.');
  }

  function addTokenDialog() {
    const body = el('div');
    const search = el('input', { type: 'search', placeholder: 'Search monsters or add a party member…' });
    const results = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '330px', overflowY: 'auto', marginTop: '8px' } });
    body.appendChild(el('div.search-field', {}, [U.svg('search'), search]));
    body.appendChild(results);
    body.appendChild(el('div.small.dim', { style: { marginTop: '6px' }, text: 'Click a result to place it on the first free cells. Keep this open to add more.' }));

    const party = el('div.row.wrap', { style: { gap: '5px', marginTop: '8px' } }, S.state.players.map(p => {
      const b = el('button.chip', { text: p.name });
      b.addEventListener('click', () => addPayloadToken({ type: 'player', playerId: p.id }, null));
      return b;
    }));
    body.appendChild(el('div.label', { text: 'Party', style: { marginTop: '10px' } }));
    body.appendChild(party);

    function paint() {
      results.innerHTML = '';
      const q = search.value.trim();
      let list;
      if (!q) {
        list = ['Strahd von Zarovich', 'Vampire Spawn', 'Dire Wolf', 'Werewolf', 'Zombie', 'Skeleton', 'Ghoul', 'Wraith', 'Wolf', 'Swarm of Bats']
          .map(n => DM.data.monster(n)).filter(Boolean).slice(0, 10);
      } else {
        list = DM.search.query(q, { kind: 'monster', limit: 20 }).map(r => DM.data.monster(r.doc.ref.name, r.doc.ref.source)).filter(Boolean);
      }
      if (!list.length) { results.innerHTML = '<div class="pal-empty">No monsters match.</div>'; return; }
      list.forEach(m => {
        const row = el('div.result-row', {}, [
          el('div.result-glyph.monster', { text: U.crText(m.cr) }),
          el('div.result-main', {}, [
            el('div.result-name', {}, [m.name, el('span.tag', { text: 'CR ' + U.crText(m.cr) })]),
            el('div.result-meta', { text: m.source })
          ]),
          el('button.btn.xs.primary', { text: 'Place' })
        ]);
        row.addEventListener('click', () => addPayloadToken({ type: 'monster', name: m.name, source: m.source }, null));
        results.appendChild(row);
      });
    }
    search.addEventListener('input', U.debounce(paint, 100));
    paint();
    UI.modal({ title: 'Add a token', body, buttons: [{ label: 'Done', cls: 'primary', onClick: () => { UI.closeModal(); V.refresh(); } }] });
  }

  async function clearTokens() {
    if (!S.state.map.tokens.length) return;
    if (await UI.confirm({ title: 'Clear the map?', message: 'Removes every token from the battle map. Character sheets, party and notes are untouched.', confirm: 'Clear map', danger: true })) {
      S.clearMapTokens();
      selected = null;
      measure.start = measure.end = null;
      V.refresh();
    }
  }

  // ---------------------------------------------------------------- mount
  V.refresh = function () {
    if (DM.currentView !== 'grid' || !rootEl) return;
    const old = rootEl;
    const fresh = V.render();
    if (old.isConnected) old.replaceWith(fresh); else document.getElementById('main').appendChild(fresh);
    rootEl = fresh;
  };

  DM.bus.on('state', () => {
    if (DM.currentView !== 'grid') return;
    if (DM.ui.isDrawerOpen()) return;
    // External HP changes (from initiative/party) should update token bars.
    const active = document.activeElement;
    if (active && active.closest && (active.closest('.map-toolbar') || active.closest('.map-side'))) return;
    V.refresh();
  });
})();
