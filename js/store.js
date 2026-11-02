/* Campaign state, persistence, 5etools data lookups */
(function () {
  'use strict';
  const U = DM.U;

  // ---------------------------------------------------------------- data
  const DND = window.DND_DATA || {};
  const Data = {};
  DM.data = Data;

  Data.monsters = (DND.monsters || []).filter(m => m && m.name);
  Data.items = (DND.items && DND.items.items) || [];
  Data.bases = (DND.items && DND.items.bases) || [];
  Data.itemTypes = (DND.items && DND.items.types) || [];
  Data.itemProps = (DND.items && DND.items.props) || [];
  Data.spells = (DND.spells || []).filter(s => s && s.name);
  Data.rules = DND.rules || { conditions: [], feats: [], actions: [], diseases: [] };
  Data.tarokka = DND.tarokka || { cards: [] };
  Data.cos = DND.cos || [];

  const norm = U.fuzzy.normalize;
  const srcKey = (s) => String(s || '').toLowerCase();

  const idx = {
    monsterKey: new Map(), monsterName: new Map(),
    itemKey: new Map(), itemName: new Map(),
    baseKey: new Map(), baseName: new Map(),
    spellKey: new Map(), spellName: new Map(),
    ruleName: new Map()
  };

  function push(map, key, obj) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(obj);
  }

  Data.monsters.forEach(m => {
    push(idx.monsterKey, norm(m.name) + '|' + srcKey(m.source), m);
    push(idx.monsterName, norm(m.name), m);
  });
  Data.items.forEach(i => {
    push(idx.itemKey, norm(i.name) + '|' + srcKey(i.source), i);
    push(idx.itemName, norm(i.name), i);
  });
  Data.bases.forEach(i => {
    push(idx.baseKey, norm(i.name) + '|' + srcKey(i.source), i);
    push(idx.baseName, norm(i.name), i);
  });
  Data.spells.forEach(s => {
    push(idx.spellKey, norm(s.name) + '|' + srcKey(s.source), s);
    push(idx.spellName, norm(s.name), s);
  });
  [...(Data.rules.conditions || []), ...(Data.rules.actions || []), ...(Data.rules.feats || [])].forEach(r => {
    if (!r || !r.name) return;
    push(idx.ruleName, norm(r.name), r);
  });

  function first(map, key) { const a = map.get(key); return a && a.length ? a[0] : null; }

  Data.monster = function (name, source) {
    const n = norm(name);
    const hb = (window.DM && DM.store && DM.store.state) ? DM.store.state.homebrew && DM.store.state.homebrew.monsters : null;
    if (hb) {
      const hit = hb.find(m => norm(m.name) === n && (!source || source === 'HB' || m.source === source));
      if (hit) return hit;
    }
    if (source) {
      const hit = first(idx.monsterKey, n + '|' + srcKey(source));
      if (hit) return hit;
    }
    const arr = idx.monsterName.get(n);
    if (!arr || !arr.length) return null;
    // Prefer adventure/NPC versions when no source is given and the name is an NPC.
    return arr[0];
  };
  Data.monstersByName = (name) => idx.monsterName.get(norm(name)) || [];

  Data.item = function (name, source) {
    const n = norm(name);
    const hb = (window.DM && DM.store && DM.store.state) ? DM.store.state.homebrew && DM.store.state.homebrew.items : null;
    if (hb) {
      const hit = hb.find(i => norm(i.name) === n && (!source || source === 'HB' || i.source === source));
      if (hit) return hit;
    }
    if (source) {
      const hit = first(idx.itemKey, n + '|' + srcKey(source));
      if (hit) return hit;
    }
    return first(idx.itemName, n);
  };
  Data.itemsByName = (name) => idx.itemName.get(norm(name)) || [];

  Data.baseItem = function (ref) {
    if (!ref) return null;
    const parts = String(ref).split('|');
    const n = norm(parts[0]);
    if (parts[1]) {
      const hit = first(idx.baseKey, n + '|' + srcKey(parts[1]));
      if (hit) return hit;
    }
    return first(idx.baseName, n);
  };

  Data.spell = function (name, source) {
    const n = norm(name);
    const hb = (window.DM && DM.store && DM.store.state) ? DM.store.state.homebrew && DM.store.state.homebrew.spells : null;
    if (hb) {
      const hit = hb.find(sp => norm(sp.name) === n && (!source || source === 'HB' || sp.source === source));
      if (hit) return hit;
    }
    if (source) {
      const hit = first(idx.spellKey, n + '|' + srcKey(source));
      if (hit) return hit;
    }
    return first(idx.spellName, n);
  };
  Data.spellsByName = (name) => idx.spellName.get(norm(name)) || [];

  Data.rule = function (name) { return first(idx.ruleName, norm(name)); };

  Data.sourceName = {
    PHB: 'Player’s Handbook', DMG: "Dungeon Master’s Guide", MM: 'Monster Manual', CoS: 'Adventure',
    XGE: "Xanathar’s Guide", TCE: "Tasha’s Cauldron", MPMM: 'Mordenkainen Presents', MTF: 'Mordenkainen’s Tome',
    VGM: 'Volo’s Guide', VRGR: "Van Richten’s Guide", EGW: 'Explorer’s Guide to Wildemount', ERLW: 'Eberron: Rising',
    GGR: "Guildmasters’ Guide", FTD: 'Fizban’s Treasury', SCC: 'Strixhaven', IDRotF: 'Icewind Dale', AI: 'Acquisitions Inc.',
    SKT: 'Storm King’s Thunder', ToA: 'Tomb of Annihilation', CoA: 'Call of the Netherdeep', BGDIA: 'Baldur’s Gate: Descent',
    WDMM: 'Dungeon of the Mad Mage', WDH: 'Waterdeep: Dragon Heist', CM: 'Candlekeep Mysteries', GoS: 'Ghosts of Saltmarsh',
    LMoP: 'Lost Mine of Phandelver', PotA: 'Princes of the Apocalypse', OotA: 'Out of the Abyss', HotDQ: 'Hoard of the Dragon Queen',
    RoT: 'Rise of Tiamat', IMR: 'Infernal Machine Rebuild', TftYP: 'Tales from the Yawning Portal', BMT: 'Book of Many Things',
    PaBTSO: 'Phandelver and Below', DSotDQ: 'Dragonlance: Shadow', FRAiF: 'Forgotten Realms Adventures', EFA: 'Eberron: Forge'
  };
  Data.sourceLabel = (s) => Data.sourceName[s] || s || 'Homebrew';

  Data.cosChapter = function (id) { return Data.cos.find(c => c.id === id) || null; };
  Data.cosChapterName = function (id) { const c = Data.cosChapter(id); return c ? c.name : ''; };

  // ---------------------------------------------------------------- bus
  const bus = {};
  const listeners = {};
  bus.on = function (evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); };
  };
  bus.emit = function (evt, payload) {
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  };
  DM.bus = bus;

  // ---------------------------------------------------------------- state
  const KEY = 'mbg.gamemaster.v1';
  const S = {};
  DM.store = S;

  S.storageOk = true;
  try {
    localStorage.setItem('__rl_test', '1');
    localStorage.removeItem('__rl_test');
  } catch (e) { S.storageOk = false; }

  function defaultState() {
    return {
      v: 1,
      campaign: {
        name: 'My Campaign',
        startDate: Date.now(),
        nextSession: ''
      },
      players: [],
      sheets: [],
      encounter: {
        id: U.uid('enc'),
        name: 'Untitled encounter',
        round: 0,
        turnIndex: -1,
        active: false,
        combatants: []
      },
      templates: [],
      homebrew: { monsters: [], items: [], spells: [] },
      favorites: { monster: [], item: [], spell: [], rule: [] },
      notes: [{
        id: U.uid('note'),
        title: 'Welcome, Game Master',
        body: '## DM screen\n\n- **Ctrl+K** searches every monster, item, spell, rule and adventure area.\n- Drag monsters or party members onto the initiative bar at the bottom.\n- The **Adventure** tab contains the full module text, a tarokka reading tool, and NPC statblocks.\n- Everything is saved in this browser automatically. Use Settings → Export to make a backup.',
        pinned: true,
        created: Date.now(),
        updated: Date.now()
      }],
      cos: {
        progress: {},
        notes: {},
        reading: null,
        activeChapter: '013'
      },
      settings: {
        theme: 'dark',
        navCollapsed: false,
        dockHidden: false,
        skipDead: true,
        confirmDelete: true,
        autoRollInitiative: true,
        showWelcome: true,
        lastView: 'dashboard',
        campaignArchiveVersion: 0,
        campaignPartyVersion: 0
      },
      session: { startedAt: null, accumulated: 0, running: false },
      map: {
        cols: 24, rows: 16, cell: 48, diagonal: 'simple',
        tokens: [], initialized: false
      },
      activity: {},
      recent: []
    };
  }

  function normalize(s) {
    const base = defaultState();
    s = s && typeof s === 'object' ? s : {};
    const out = Object.assign(base, s);
    out.campaign = Object.assign(base.campaign, s.campaign || {});
    out.encounter = Object.assign(base.encounter, s.encounter || {});
    out.homebrew = Object.assign(base.homebrew, s.homebrew || {});
    out.favorites = Object.assign(base.favorites, s.favorites || {});
    out.cos = Object.assign(base.cos, s.cos || {});
    out.settings = Object.assign(base.settings, s.settings || {});
    out.session = Object.assign(base.session, s.session || {});
    out.players = Array.isArray(s.players) ? s.players : [];
    out.sheets = Array.isArray(s.sheets) ? s.sheets : [];
    out.notes = Array.isArray(s.notes) && s.notes.length ? s.notes : base.notes;
    out.notes.forEach(n => {
      n.category = n.category || 'Campaign';
      n.tags = Array.isArray(n.tags) ? n.tags : [];
      n.pinned = !!n.pinned;
    });
    out.templates = Array.isArray(s.templates) ? s.templates : [];
    out.activity = s.activity || {};
    out.recent = Array.isArray(s.recent) ? s.recent : [];
    out.encounter.combatants = Array.isArray(out.encounter.combatants) ? out.encounter.combatants : [];
    out.players.forEach(p => normalizePlayer(p));
    out.sheets.forEach(sh => normalizeSheet(sh));
    out.encounter.combatants.forEach(c => normalizeCombatant(c));
    out.map = Object.assign({ cols: 24, rows: 16, cell: 48, diagonal: 'simple', tokens: [], initialized: false }, s.map || {});
    out.map.tokens = Array.isArray(out.map.tokens) ? out.map.tokens : [];
    out.map.tokens.forEach(t => normalizeMapToken(t));
    return out;
  }

  function normalizePlayer(p) {
    p.id = p.id || U.uid('pc');
    p.name = p.name || 'Unnamed adventurer';
    p.level = U.clamp(U.num(p.level, 1), 1, 20);
    p.ac = U.num(p.ac, 10);
    p.maxHp = Math.max(1, U.num(p.maxHp, 10));
    p.hp = U.clamp(U.num(p.hp, p.maxHp), 0, p.maxHp);
    p.tempHp = Math.max(0, U.num(p.tempHp, 0));
    p.initiativeBonus = p.initiativeBonus !== undefined ? U.num(p.initiativeBonus, 0) : U.mod(p.dex || 10);
    p.speed = p.speed || '30 ft.';
    p.stats = Object.assign({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, p.stats || {});
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => p.stats[k] = U.clamp(U.num(p.stats[k], 10), 1, 30));
    p.conditions = Array.isArray(p.conditions) ? p.conditions : [];
    p.inventory = Array.isArray(p.inventory) ? p.inventory : [];
    p.spellSlots = p.spellSlots && typeof p.spellSlots === 'object' ? p.spellSlots : {};
    p.deathSaves = Object.assign({ successes: 0, failures: 0 }, p.deathSaves || {});
    p.inspiration = !!p.inspiration;
    p.concentration = p.concentration || '';
    p.notes = p.notes || '';
    p.color = p.color || U.colorFor(p.name);
    p.emoji = p.emoji || '';
    return p;
  }
  S.normalizePlayer = normalizePlayer;

  function normalizeSheet(sh) {
    sh.id = sh.id || U.uid('sheet');
    sh.name = sh.name || 'New character';
    sh.level = U.clamp(U.num(sh.level, 1), 1, 20);
    sh.abilities = Object.assign({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, sh.abilities || {});
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => sh.abilities[k] = U.clamp(U.num(sh.abilities[k], 10), 1, 30));
    sh.saveProf = Object.assign({}, sh.saveProf || {});
    sh.skillProf = Object.assign({}, sh.skillProf || {});
    sh.attacks = Array.isArray(sh.attacks) ? sh.attacks : [];
    sh.spells = Object.assign({}, sh.spells || {});
    sh.hpMax = U.num(sh.hpMax, 10);
    sh.hpCurrent = U.num(sh.hpCurrent, sh.hpMax);
    sh.tempHp = U.num(sh.tempHp, 0);
    sh.ac = U.num(sh.ac, 10);
    sh.initiative = U.num(sh.initiative, U.mod(sh.abilities.dex));
    sh.createdAt = sh.createdAt || Date.now();
    sh.updatedAt = sh.updatedAt || sh.createdAt;
    return sh;
  }
  S.normalizeSheet = normalizeSheet;

  function normalizeCombatant(c) {
    c.id = c.id || U.uid('cmb');
    c.kind = c.kind || 'monster';
    c.hp = U.num(c.hp, 1);
    c.maxHp = Math.max(1, U.num(c.maxHp, c.hp || 1));
    c.tempHp = U.num(c.tempHp, 0);
    c.init = U.num(c.init, 0);
    c.conditions = Array.isArray(c.conditions) ? c.conditions : [];
    c.deathSaves = Object.assign({ successes: 0, failures: 0 }, c.deathSaves || {});
    c.notes = c.notes || '';
    c.hidden = !!c.hidden;
    c.concentration = c.concentration || '';
    return c;
  }
  S.normalizeCombatant = normalizeCombatant;

  function normalizeMapToken(t) {
    t.id = t.id || U.uid('token');
    t.name = t.name || 'Token';
    t.kind = t.kind || 'monster';
    t.combatantId = t.combatantId || null;
    t.x = U.num(t.x, 0);
    t.y = U.num(t.y, 0);
    t.size = U.clamp(U.num(t.size, 1), 1, 4);
    t.hp = U.num(t.hp, 1);
    t.maxHp = Math.max(1, U.num(t.maxHp, t.hp || 1));
    t.ac = U.num(t.ac, 10);
    t.color = t.color || U.colorFor(t.name);
    t.conditions = Array.isArray(t.conditions) ? t.conditions : [];
    return t;
  }
  S.normalizeMapToken = normalizeMapToken;


  // ---------------------------------------------------------------- load / save
  let state;
  try {
    const raw = S.storageOk ? localStorage.getItem(KEY) : null;
    state = raw ? normalize(JSON.parse(raw)) : defaultState();
  } catch (e) {
    console.warn('Could not load save, starting fresh.', e);
    state = defaultState();
  }
  S.state = state;
  S.get = () => state;

  let saveTimer;
  let lastSaveOk = true;
  S.save = function (immediate) {
    clearTimeout(saveTimer);
    const doSave = () => {
      const el = document.getElementById('saveState');
      if (el) el.classList.add('saving');
      try {
        if (!S.storageOk) throw new Error('localStorage unavailable');
        localStorage.setItem(KEY, JSON.stringify(state));
        if (el) {
          el.classList.remove('saving', 'error');
          el.querySelector('span').textContent = 'Saved';
          el.title = 'Saved ' + new Date().toLocaleTimeString();
        }
        lastSaveOk = true;
      } catch (e) {
        lastSaveOk = false;
        console.warn('Save failed', e);
        if (el) {
          el.classList.remove('saving');
          el.classList.add('error');
          el.querySelector('span').textContent = S.storageOk ? 'Save failed' : 'No storage';
          el.title = S.storageOk ? 'Storage full or blocked' : 'localStorage is blocked — export your data to keep it';
        }
      }
    };
    if (immediate) doSave(); else saveTimer = setTimeout(doSave, 250);
  };

  S.update = function (fn, opts) {
    fn(state);
    normalize(state);
    S.save();
    bus.emit('state', state);
    return state;
  };

  S.reset = function () {
    state = defaultState();
    state.settings.campaignArchiveVersion = DND.campaignArchiveVersion || 1;
    state.settings.campaignPartyVersion = DND.campaignPartyVersion || 1;
    S.state = state;
    S.save(true);
    bus.emit('state', state);
    return state;
  };

  S.exportJSON = function () {
    return JSON.stringify({ format: 'mbg-gamemaster-screen', version: 1, exported: new Date().toISOString(), state }, null, 2);
  };

  S.importJSON = function (text) {
    const parsed = JSON.parse(text);
    const incoming = parsed && parsed.state ? parsed.state : parsed;
    if (!incoming || typeof incoming !== 'object') throw new Error('Not a GameMaster Screen backup');
    state = normalize(incoming);
    S.state = state;
    S.save(true);
    bus.emit('state', state);
    return state;
  };

  // ---------------------------------------------------------------- campaign archive / Obsidian notes
  const bundledNotes = Array.isArray(DND.campaignNotes) ? DND.campaignNotes : [];
  const archiveVersion = DND.campaignArchiveVersion || 1;

  function ensureNoteFields(n) {
    n.id = n.id || U.uid('note');
    n.title = n.title || 'Untitled note';
    n.body = n.body || '';
    n.category = n.category || 'Campaign';
    n.tags = Array.isArray(n.tags) ? n.tags : [];
    n.pinned = !!n.pinned;
    n.created = n.created || Date.now();
    n.updated = n.updated || n.created;
    return n;
  }

  S.importArchive = function (force) {
    const known = new Set(state.notes.map(n => n.archiveId).filter(Boolean));
    let added = 0;
    bundledNotes.forEach(raw => {
      if (!raw || !raw.id) return;
      if (known.has(raw.id)) return;
      const n = ensureNoteFields(Object.assign({}, raw, { archiveId: raw.id, source: 'obsidian' }));
      state.notes.push(n);
      known.add(raw.id);
      added++;
    });
    state.settings.campaignArchiveVersion = archiveVersion;
    S.save(true);
    bus.emit('state', state);
    return added;
  };

  S.importNotes = function (notes, opts) {
    opts = opts || {};
    const known = new Set(state.notes.map(n => n.archiveId).filter(Boolean));
    let added = 0;
    S.update(s => {
      (notes || []).forEach(raw => {
        if (!raw || !raw.title) return;
        if (raw.archiveId && known.has(raw.archiveId)) return;
        const n = ensureNoteFields(Object.assign({}, raw, { archiveId: raw.archiveId || U.uid('obs'), source: 'obsidian' }));
        s.notes.push(n);
        if (n.archiveId) known.add(n.archiveId);
        added++;
      });
    });
    return added;
  };

  // Merge the bundled Obsidian archive on first load (and after an archive update).
  if (bundledNotes.length && state.settings.campaignArchiveVersion !== archiveVersion) {
    try { S.importArchive(false); } catch (e) { console.warn('Campaign archive import failed', e); }
  }

  // ---------------------------------------------------------------- actual campaign party
  const bundledParty = Array.isArray(DND.campaignParty) ? DND.campaignParty : [];
  const partyVersion = DND.campaignPartyVersion || 1;
  const DEMO_NAMES = new Set(['Sera Vane', 'Kaelen Dusk', 'Bram Ironfoot', 'Lyra Moonwhisper']);

  S.importCampaignParty = function (force) {
    if (!bundledParty.length) return 0;
    const hasDemoOnly = state.players.length > 0 && state.players.every(p => DEMO_NAMES.has(p.name));
    if (!force && state.players.length && !hasDemoOnly) {
      state.settings.campaignPartyVersion = partyVersion;
      S.save(true);
      return 0;
    }
    state.players = bundledParty.map(p => normalizePlayer(JSON.parse(JSON.stringify(p))));
    // Player-linked combatants no longer match the new IDs.
    state.encounter.combatants = state.encounter.combatants.filter(c => c.kind !== 'player');
    state.sheets = (state.sheets || []).filter(sh => !DEMO_NAMES.has(sh.name));
    state.map.tokens = [];
    state.map.initialized = false;
    state.settings.campaignPartyVersion = partyVersion;
    S.save(true);
    bus.emit('state', state);
    return state.players.length;
  };

  if (bundledParty.length && state.settings.campaignPartyVersion !== partyVersion) {
    const hasDemoOnly = state.players.length > 0 && state.players.every(p => DEMO_NAMES.has(p.name));
    if (!state.players.length || hasDemoOnly) {
      try { S.importCampaignParty(true); } catch (e) { console.warn('Campaign party import failed', e); }
    } else {
      state.settings.campaignPartyVersion = partyVersion;
      S.save(true);
    }
  }


  // ---------------------------------------------------------------- players
  S.newPlayer = function (partial) {
    const p = normalizePlayer(Object.assign({
      name: 'New adventurer',
      player: '',
      ancestry: '',
      className: '',
      level: 1,
      ac: 12,
      maxHp: 10,
      hp: 10,
      tempHp: 0,
      stats: { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      notes: '',
      inventory: [],
      conditions: [],
      spellSlots: {}
    }, partial || {}));
    p.hp = p.maxHp;
    return p;
  };

  S.player = (id) => state.players.find(p => p.id === id);

  // ---------------------------------------------------------------- character sheets
  S.newSheet = function (partial) {
    const sheet = normalizeSheet(Object.assign({
      name: 'New character',
      className: '',
      level: 1,
      background: '',
      ancestry: '',
      alignment: '',
      hpMax: 10,
      hpCurrent: 10,
      ac: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      attacks: [{ name: '', bonus: '', damage: '', notes: '' }],
      spells: {}
    }, partial || {}));
    sheet.updatedAt = Date.now();
    return sheet;
  };

  S.sheet = (id) => (state.sheets || []).find(s => s.id === id);

  S.addSheet = function (partial) {
    const sheet = S.newSheet(partial);
    sheet.id = sheet.id || U.uid('sheet');
    S.update(s => { s.sheets.push(sheet); });
    return sheet;
  };

  S.saveSheet = function (id, patch) {
    const sh = S.sheet(id);
    if (!sh) return null;
    S.update(() => {
      Object.assign(sh, patch);
      sh.updatedAt = Date.now();
      normalizeSheet(sh);
    });
    return sh;
  };

  S.deleteSheet = function (id) {
    S.update(s => { s.sheets = s.sheets.filter(x => x.id !== id); });
  };

  S.duplicateSheet = function (id) {
    const src = S.sheet(id);
    if (!src) return null;
    const copy = normalizeSheet(JSON.parse(JSON.stringify(src)));
    copy.id = U.uid('sheet');
    copy.name = src.name + ' (copy)';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    S.update(s => { s.sheets.push(copy); });
    return copy;
  };

  S.sheetFromPlayer = function (playerId) {
    const p = S.player(playerId);
    if (!p) return null;
    return S.addSheet({
      name: p.name,
      player: p.player || '',
      className: p.className || '',
      subclass: p.subclass || '',
      level: p.level,
      ancestry: p.ancestry || '',
      background: p.background || '',
      alignment: p.alignment || '',
      hpMax: p.maxHp,
      hpCurrent: p.hp,
      tempHp: p.tempHp,
      ac: p.ac,
      initiative: p.initiativeBonus,
      speed: p.speed || '30 ft.',
      hitDice: p.hitDice || '',
      abilities: Object.assign({}, p.stats),
      saveProf: Object.assign({}, p.saves || {}),
      skillProf: Object.assign({}, p.skills || {}),
      attacks: (p.attacks || []).map(a => Object.assign({}, a)),
      features: p.features || '',
      proficiencies: p.proficiencies || '',
      languages: p.languages || '',
      equipment: p.equipment || (p.inventory || []).map(i => i.name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', '),
      treasure: p.treasure || '',
      spellAbility: p.spellAbility || 'wis',
      spellSaveDC: p.spellSaveDC || '',
      spellAttack: p.spellAttack || '',
      spells: Object.assign({}, p.spells || {}),
      personality: p.personality || '',
      ideals: p.ideals || '',
      bonds: p.bonds || '',
      flaws: p.flaws || '',
      appearance: p.appearance || '',
      backstory: p.backstory || '',
      allies: p.allies || '',
      notes: p.sheetNotes || p.notes || ''
    });
  };


  S.addPlayer = function (partial) {
    const p = S.newPlayer(partial);
    S.update(s => { s.players.push(p); });
    return p;
  };

  S.removePlayer = function (id) {
    S.update(s => {
      s.players = s.players.filter(p => p.id !== id);
      s.encounter.combatants = s.encounter.combatants.filter(c => c.playerId !== id);
    });
  };

  S.adjustPlayerHp = function (id, delta, isDamage) {
    const p = S.player(id);
    if (!p) return;
    S.update(() => {
      if (isDamage) {
        let dmg = Math.max(0, Math.round(delta));
        if (p.tempHp > 0) {
          const absorbed = Math.min(p.tempHp, dmg);
          p.tempHp -= absorbed;
          dmg -= absorbed;
        }
        p.hp = U.clamp(p.hp - dmg, 0, p.maxHp);
        if (p.hp === 0) {
          p.deathSaves = p.deathSaves || { successes: 0, failures: 0 };
        }
      } else {
        p.hp = U.clamp(p.hp + Math.round(delta), 0, p.maxHp);
        if (p.hp > 0) p.deathSaves = { successes: 0, failures: 0 };
      }
    });
  };

  S.togglePlayerCondition = function (id, name) {
    const p = S.player(id);
    if (!p) return;
    const i = p.conditions.indexOf(name);
    S.update(() => { if (i >= 0) p.conditions.splice(i, 1); else p.conditions.push(name); });
  };

  // ---------------------------------------------------------------- encounter
  S.newCombatant = function (opts) {
    const c = normalizeCombatant(Object.assign({
      id: U.uid('cmb'),
      kind: 'monster',
      name: 'Combatant',
      ac: 10,
      hp: 1,
      maxHp: 1,
      init: 0,
      conditions: []
    }, opts || {}));
    return c;
  };

  S.addMonsterCombatant = function (monster, qty) {
    qty = Math.max(1, U.num(qty, 1));
    const added = [];
    for (let i = 0; i < qty; i++) {
      const c = S.newCombatant({
        kind: 'monster',
        monsterName: monster.name,
        source: monster.source,
        name: qty > 1 ? monster.name + ' ' + (i + 1) : monster.name,
        ac: monsterAc(monster),
        hp: monsterHp(monster),
        maxHp: monsterHp(monster),
        cr: monster.cr,
        xp: U.crToXp(monster.cr),
        init: state.settings.autoRollInitiative === false ? 0 : U.dice.evaluate('1d20').total + U.mod(monster.dex || 10),
        color: U.colorFor(monster.name)
      });
      added.push(c);
    }
    S.update(s => {
      s.encounter.combatants.push(...added);
      s.encounter.combatants.sort((a, b) => b.init - a.init);
      if (!s.encounter.active) { s.encounter.active = true; s.encounter.round = 1; s.encounter.turnIndex = -1; }
    });
    return added;
  };

  S.addPlayerCombatant = function (playerId) {
    if (state.encounter.combatants.some(c => c.playerId === playerId)) return null;
    const p = S.player(playerId);
    if (!p) return null;
    const c = S.newCombatant({
      kind: 'player',
      playerId,
      name: p.name,
      ac: p.ac,
      hp: p.hp,
      maxHp: p.maxHp,
      init: state.settings.autoRollInitiative === false ? 0 : U.dice.evaluate('1d20').total + U.num(p.initiativeBonus, U.mod(p.dex)),
      color: p.color
    });
    S.update(s => {
      s.encounter.combatants.push(c);
      s.encounter.combatants.sort((a, b) => b.init - a.init);
      if (!s.encounter.active) { s.encounter.active = true; s.encounter.round = 1; s.encounter.turnIndex = -1; }
    });
    return c;
  };

  // Add the creature represented by a map token to initiative. Player tokens
  // reuse the existing player combatant; monster tokens keep their current HP.
  S.addTokenCombatant = function (token) {
    if (!token) return null;
    if (token.playerId) {
      const c = S.addPlayerCombatant(token.playerId);
      const existing = c || state.encounter.combatants.find(x => x.playerId === token.playerId);
      if (existing) {
        S.update(s => {
          const mt = s.map.tokens.find(x => x.id === token.id);
          if (mt) mt.combatantId = existing.id;
        });
      }
      return c;
    }
    if (token.combatantId && S.combatant(token.combatantId)) return null;
    const m = token.monsterName ? Data.monster(token.monsterName, token.source) : null;
    const c = S.newCombatant({
      kind: 'monster',
      monsterName: token.monsterName || '',
      source: token.source || (m && m.source) || '',
      name: token.name,
      ac: U.num(token.ac, m ? monsterAc(m) : 10),
      hp: U.num(token.hp, m ? monsterHp(m) : 1),
      maxHp: Math.max(1, U.num(token.maxHp, token.hp || 1)),
      cr: m ? m.cr : token.cr,
      xp: m ? U.crToXp(m.cr) : token.xp,
      init: state.settings.autoRollInitiative === false ? 0 : U.dice.evaluate('1d20').total + U.mod((m && m.dex) || 10),
      color: token.color
    });
    S.update(s => {
      s.encounter.combatants.push(c);
      s.encounter.combatants.sort((a, b) => b.init - a.init);
      if (!s.encounter.active) { s.encounter.active = true; s.encounter.round = 1; s.encounter.turnIndex = -1; }
      const mt = s.map.tokens.find(x => x.id === token.id);
      if (mt) mt.combatantId = c.id;
    });
    return c;
  };

  function monsterAc(m) {
    const ac = m.ac;
    if (!ac) return 10;
    if (typeof ac === 'number') return ac;
    if (Array.isArray(ac)) {
      const a = ac[0];
      if (typeof a === 'number') return a;
      return a && a.ac != null ? Number(a.ac) : 10;
    }
    if (ac.ac != null) return Number(ac.ac);
    return 10;
  }
  function monsterHp(m) {
    if (!m.hp) return 1;
    if (typeof m.hp === 'number') return m.hp;
    return Number(m.hp.average) || 1;
  }
  S.monsterAc = monsterAc;
  S.monsterHp = monsterHp;

  S.combatant = (id) => state.encounter.combatants.find(c => c.id === id);

  S.removeCombatant = function (id) {
    S.update(s => {
      s.encounter.combatants = s.encounter.combatants.filter(c => c.id !== id);
      s.map.tokens.forEach(t => { if (t.combatantId === id) t.combatantId = null; });
      if (s.encounter.turnIndex >= s.encounter.combatants.length) s.encounter.turnIndex = s.encounter.combatants.length - 1;
    });
  };

  S.clearEncounter = function () {
    S.update(s => {
      s.encounter = { id: U.uid('enc'), name: 'Untitled encounter', round: 0, turnIndex: -1, active: false, combatants: [] };
      s.map.tokens.forEach(t => { t.combatantId = null; });
    });
  };

  S.effectiveCombatant = function (c) {
    if (c.playerId) {
      const p = S.player(c.playerId);
      if (p) return { hp: p.hp, maxHp: p.maxHp, tempHp: p.tempHp, ac: p.ac, conditions: p.conditions || [], concentration: p.concentration || '', deathSaves: p.deathSaves || { successes: 0, failures: 0 } };
    }
    return { hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp || 0, ac: c.ac, conditions: c.conditions || [], concentration: c.concentration || '', deathSaves: c.deathSaves || { successes: 0, failures: 0 } };
  };

  S.applyCombatantHp = function (id, amount, kind) {
    const c = S.combatant(id);
    if (!c) return;
    amount = Math.max(0, Math.round(Number(amount) || 0));
    if (!amount) return;
    if (c.playerId) {
      S.adjustPlayerHp(c.playerId, amount, kind === 'damage');
      return;
    }
    S.update(() => {
      if (kind === 'damage') {
        let dmg = amount;
        if (c.tempHp > 0) { const a = Math.min(c.tempHp, dmg); c.tempHp -= a; dmg -= a; }
        c.hp = U.clamp(c.hp - dmg, 0, c.maxHp);
      } else {
        c.hp = U.clamp(c.hp + amount, 0, c.maxHp);
      }
    });
  };

  S.toggleCombatantCondition = function (id, name) {
    const c = S.combatant(id);
    if (!c) return;
    if (c.playerId) { S.togglePlayerCondition(c.playerId, name); return; }
    const i = c.conditions.indexOf(name);
    S.update(() => { if (i >= 0) c.conditions.splice(i, 1); else c.conditions.push(name); });
  };

  S.setInitiative = function (id, value) {
    const c = S.combatant(id);
    if (!c) return;
    S.update(s => {
      c.init = U.num(value, 0);
      s.encounter.combatants.sort((a, b) => b.init - a.init);
    });
  };

  S.rollAllInitiative = function () {
    S.update(s => {
      s.encounter.combatants.forEach(c => {
        if (c.playerId) {
          const p = S.player(c.playerId);
          c.init = U.dice.evaluate('1d20').total + U.num(p ? p.initiativeBonus : 0, 0);
        } else {
          const m = c.monsterName ? Data.monster(c.monsterName, c.source) : null;
          c.init = U.dice.evaluate('1d20').total + (m ? U.mod(m.dex || 10) : 0);
        }
      });
      s.encounter.combatants.sort((a, b) => b.init - a.init);
      s.encounter.turnIndex = 0;
      s.encounter.active = true;
      s.encounter.round = Math.max(1, s.encounter.round || 1);
    });
  };

  S.rollCombatantInitiative = function (id) {
    const c = S.combatant(id);
    if (!c) return;
    let bonus = 0;
    if (c.playerId) { const p = S.player(c.playerId); bonus = p ? U.num(p.initiativeBonus, 0) : 0; }
    else { const m = c.monsterName ? Data.monster(c.monsterName, c.source) : null; bonus = m ? U.mod(m.dex || 10) : 0; }
    const r = U.dice.evaluate('1d20');
    S.update(s => {
      c.init = r.total + bonus;
      s.encounter.combatants.sort((a, b) => b.init - a.init);
    });
    return { total: r.total + bonus, bonus, roll: r.total };
  };

  S.nextTurn = function (dir) {
    dir = dir || 1;
    const enc = state.encounter;
    if (!enc.combatants.length) return;
    S.update(s => {
      const n = s.encounter.combatants.length;
      s.encounter.active = true;
      if (s.encounter.round === 0) s.encounter.round = 1;
      let idx = s.encounter.turnIndex;
      for (let step = 0; step < n * 2 + 2; step++) {
        idx += dir;
        if (idx >= n) { idx = 0; s.encounter.round += 1; }
        if (idx < 0) { idx = n - 1; s.encounter.round = Math.max(1, s.encounter.round - 1); }
        const c = s.encounter.combatants[idx];
        const eff = S.effectiveCombatant(c);
        if (s.settings.skipDead && !c.playerId && eff.hp <= 0 && s.encounter.combatants.some(x => x.playerId || S.effectiveCombatant(x).hp > 0)) continue;
        break;
      }
      s.encounter.turnIndex = idx;
    });
  };

  S.startEncounterFrom = function (name, monsters, opts) {
    opts = opts || {};
    const combatants = [];
    if (opts.includeParty) {
      state.players.forEach(p => {
        if (p.hp <= 0 || (p.conditions || []).includes('Dead')) return;
        combatants.push(S.newCombatant({
          kind: 'player', playerId: p.id, name: p.name, ac: p.ac, hp: p.hp, maxHp: p.maxHp,
          init: U.dice.evaluate('1d20').total + U.num(p.initiativeBonus, U.mod(p.dex)), color: p.color
        }));
      });
    }
    monsters.forEach(({ monster, qty }) => {
      for (let i = 0; i < (qty || 1); i++) {
        combatants.push(S.newCombatant({
          kind: 'monster', monsterName: monster.name, source: monster.source,
          name: (qty > 1 ? monster.name + ' ' + (i + 1) : monster.name),
          ac: monsterAc(monster), hp: monsterHp(monster), maxHp: monsterHp(monster),
          cr: monster.cr, xp: U.crToXp(monster.cr),
          init: U.dice.evaluate('1d20').total + U.mod(monster.dex || 10),
          color: U.colorFor(monster.name)
        }));
      }
    });
    S.update(s => {
      s.encounter = { id: U.uid('enc'), name: name || 'Encounter', round: 1, turnIndex: 0, active: true, combatants: combatants.sort((a, b) => b.init - a.init) };
    });
    return combatants;
  };

  S.saveTemplate = function (name, monsterList) {
    const t = { id: U.uid('tpl'), name: name || 'Encounter', monsters: monsterList, created: Date.now() };
    S.update(s => { s.templates.push(t); });
    return t;
  };

  S.xpSummary = function () {
    let xp = 0, n = 0;
    state.encounter.combatants.forEach(c => {
      if (c.kind === 'monster') { xp += U.crToXp(c.cr); n++; }
    });
    return { xp, n };
  };

  // ---------------------------------------------------------------- favourites / activity
  S.isFav = function (kind, id) {
    const arr = state.favorites[kind] || [];
    return arr.some(f => (typeof f === 'string' ? f : f.id) === id);
  };
  S.toggleFav = function (kind, ref) {
    const arr = state.favorites[kind] = state.favorites[kind] || [];
    const id = typeof ref === 'string' ? ref : ref.id || ref.name + '|' + ref.source;
    const i = arr.findIndex(f => (typeof f === 'string' ? f : f.id || f.name + '|' + f.source) === id);
    S.update(() => { if (i >= 0) arr.splice(i, 1); else arr.push(typeof ref === 'string' ? { id } : Object.assign({ id }, ref)); });
    return i < 0;
  };
  S.favoritesOf = function (kind) { return (state.favorites[kind] || []).slice(); };

  S.touch = function (kind, name) {
    const key = kind + ':' + name;
    state.activity[key] = (state.activity[key] || 0) + 1;
    state.recent = [{ kind, name, ts: Date.now() }, ...state.recent.filter(r => !(r.kind === kind && r.name === name))].slice(0, 24);
    S.save();
  };
  S.boostMap = function () {
    const out = {};
    for (const k in state.activity) {
      const [kind, ...rest] = k.split(':');
      const name = rest.join(':');
      out[kind + ':' + U.fuzzy.normalize(name)] = Math.min(40, state.activity[k] * 6);
    }
    return out;
  };

  // ---------------------------------------------------------------- notes
  S.addNote = function (partial) {
    const n = Object.assign({ id: U.uid('note'), title: 'New note', body: '', pinned: false, category: 'Campaign', tags: [], created: Date.now(), updated: Date.now() }, partial || {});
    S.update(s => { s.notes.unshift(n); });
    return n;
  };
  S.updateNote = function (id, patch) {
    const n = state.notes.find(x => x.id === id);
    if (!n) return;
    S.update(() => { Object.assign(n, patch, { updated: Date.now() }); });
  };
  S.deleteNote = function (id) {
    S.update(s => { s.notes = s.notes.filter(n => n.id !== id); });
  };

  // ---------------------------------------------------------------- cos
  S.cosProgress = function (chapterId) { return !!(state.cos.progress && state.cos.progress[chapterId]); };
  S.setCosProgress = function (chapterId, done) {
    S.update(s => { s.cos.progress[chapterId] = !!done; });
  };
  S.cosNote = function (chapterId) { return (state.cos.notes && state.cos.notes[chapterId]) || ''; };
  S.setCosNote = function (chapterId, text) {
    S.update(s => { s.cos.notes[chapterId] = text; });
  };

  S.saveReading = function (reading) {
    S.update(s => { s.cos.reading = reading; });
  };

  // ---------------------------------------------------------------- battle map
  S.mapTokenHp = function (t) {
    if (t.playerId) {
      const p = S.player(t.playerId);
      if (p) return { hp: p.hp, maxHp: p.maxHp, tempHp: p.tempHp, ac: p.ac, conditions: p.conditions || [] };
    }
    return { hp: t.hp, maxHp: t.maxHp, tempHp: t.tempHp || 0, ac: t.ac, conditions: t.conditions || [] };
  };

  S.addMapToken = function (opts) {
    const t = normalizeMapToken(Object.assign({}, opts));
    t.x = U.clamp(t.x, 0, Math.max(0, state.map.cols - t.size));
    t.y = U.clamp(t.y, 0, Math.max(0, state.map.rows - t.size));
    S.update(s => { s.map.tokens.push(t); });
    return t;
  };

  S.moveMapToken = function (id, x, y) {
    const t = state.map.tokens.find(x => x.id === id);
    if (!t) return;
    S.update(s => {
      t.x = U.clamp(x, 0, Math.max(0, s.map.cols - t.size));
      t.y = U.clamp(y, 0, Math.max(0, s.map.rows - t.size));
    });
  };

  S.removeMapToken = function (id) {
    S.update(s => { s.map.tokens = s.map.tokens.filter(t => t.id !== id); });
  };

  S.clearMapTokens = function () {
    S.update(s => { s.map.tokens = []; s.map.initialized = true; });
  };

  S.updateMap = function (patch) {
    S.update(s => { Object.assign(s.map, patch); });
  };

  // ---------------------------------------------------------------- session
  S.timerElapsed = function () {    const t = state.session;
    return t.accumulated + (t.running && t.startedAt ? Date.now() - t.startedAt : 0);
  };
  S.toggleTimer = function () {
    S.update(s => {
      const t = s.session;
      if (t.running) {
        t.accumulated += Date.now() - (t.startedAt || Date.now());
        t.running = false;
        t.startedAt = null;
      } else {
        t.running = true;
        t.startedAt = Date.now();
      }
    });
  };
  S.resetTimer = function () {
    S.update(s => { s.session = { startedAt: null, accumulated: 0, running: false }; });
  };
})();
