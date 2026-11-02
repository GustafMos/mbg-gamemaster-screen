/* MBG's GameMaster Screen — utilities, dice math, fuzzy matching */
window.DM = window.DM || {};
(function () {
  'use strict';
  const U = {};
  DM.U = U;

  // ---------------------------------------------------------------- DOM
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.el = function (tag, attrs, children) {
    const parts = String(tag).split(/([.#])/);
    const name = parts.shift() || 'div';
    const e = document.createElement(name);
    let cls = '';
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i] === '.') cls += ' ' + parts[i + 1];
      else if (parts[i] === '#') e.id = parts[i + 1];
    }
    if (cls) e.className = cls.trim();
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
      children = attrs; attrs = null;
    }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className += ' ' + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') e.value = v;
        else if (k === 'checked' || k === 'selected' || k === 'disabled') e[k] = !!v;
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children !== null && children !== undefined) {
      if (!Array.isArray(children)) children = [children];
      for (const c of children.flat(3)) {
        if (c === null || c === undefined || c === false) continue;
        e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return e;
  };

  U.svg = function (id, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    if (cls) s.setAttribute('class', cls);
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#i-' + id);
    s.appendChild(use);
    return s;
  };

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  };

  U.debounce = function (fn, ms) {
    let t;
    const d = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
    d.cancel = () => clearTimeout(t);
    d.flush = (...args) => { clearTimeout(t); fn.apply(null, args); };
    return d;
  };

  U.throttle = function (fn, ms) {
    let last = 0, timer;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, args); }
      else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, ms - (now - last)); }
    };
  };

  U.clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  U.num = (v, fallback) => { const n = parseInt(v, 10); return isNaN(n) ? (fallback || 0) : n; };
  U.deepClone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  U.mod = (score) => Math.floor((Number(score || 10) - 10) / 2);
  U.modStr = (score) => { const m = U.mod(score); return (m >= 0 ? '+' : '') + m; };
  U.pad2 = (n) => String(n).padStart(2, '0');
  U.fmtDuration = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h + ':' + U.pad2(m) + ':' + U.pad2(sec);
  };
  U.fmtClock = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + U.pad2(sec);
  };
  U.fmtDate = function (ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  U.fmtRelative = function (ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  };
  U.initials = function (name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };
  U.possessive = (s) => /s$/i.test(s) ? s + "'" : s + "'s";

  const PALETTE = ['#8c3a46', '#6d4d82', '#4d6d82', '#4d825f', '#82694d', '#7a4d5c', '#4d5a82', '#78613f'];
  U.colorFor = function (str) {
    let h = 0;
    str = String(str || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };
  U.escAttr = U.esc;

  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  U.range = (n) => Array.from({ length: n }, (_, i) => i);

  // ---------------------------------------------------------------- dice
  const D = {};
  U.dice = D;

  U.rollDie = (sides) => 1 + Math.floor(Math.random() * sides);

  D.evaluate = function (expr, opts) {
    opts = opts || {};
    const adv = opts.adv || 0; // 1 advantage, -1 disadvantage
    let src = String(expr || '1d20').toLowerCase().replace(/\s+/g, '').replace(/−/g, '-');
    if (!src) src = '1d20';
    const terms = [];
    let total = 0;
    let crit = false;
    let fumble = false;
    let keptD20 = null;
    const re = /([+-]?)(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?|([+-]?)(\d+(?:\.\d+)?)/g;
    let m, consumed = 0;
    while ((m = re.exec(src))) {
      consumed += m[0].length;
      if (m[3]) {
        const sign = m[1] === '-' ? -1 : 1;
        const count = Math.min(100, Math.max(1, parseInt(m[2] || '1', 10)));
        const sides = Math.min(1000, Math.max(1, parseInt(m[3], 10)));
        let rolls = [];
        for (let i = 0; i < count; i++) rolls.push(U.rollDie(sides));
        let keepN = count;
        if (m[4]) keepN = Math.min(count, parseInt(m[4], 10));
        if (m[5]) keepN = Math.min(count, parseInt(m[5], 10));
        let kept = rolls.slice();
        if (keepN < count) {
          const sorted = rolls.slice().sort((a, b) => b - a);
          kept = m[5] ? sorted.slice(-keepN) : sorted.slice(0, keepN);
        }
        if (sides === 20 && count === 1 && adv !== 0) {
          const a = rolls[0], b = U.rollDie(20);
          rolls = [a, b];
          kept = [adv > 0 ? Math.max(a, b) : Math.min(a, b)];
          crit = kept[0] === 20;
          fumble = kept[0] === 1;
          keptD20 = kept[0];
        }
        const subtotal = kept.reduce((x, y) => x + y, 0) * sign;
        total += subtotal;
        terms.push({ sign, count, sides, rolls, kept, subtotal, dropped: rolls.length > kept.length });
      } else if (m[7]) {
        const sign = m[6] === '-' ? -1 : 1;
        const val = parseFloat(m[7]) * sign;
        total += val;
        terms.push({ sign, flat: val, value: Math.abs(val) });
      }
    }
    if (!terms.length) return D.evaluate('1d20', opts);
    const label = terms.map(t => {
      if (t.flat !== undefined) return (t.sign < 0 ? '−' : '+') + Math.abs(t.flat);
      return (t.sign < 0 ? '−' : '') + t.count + 'd' + t.sides + (t.dropped ? ' [' + t.rolls.join(', ') + ' → ' + t.kept.join(', ') + ']' : '');
    }).join(' ');
    const detail = terms.map(t => {
      if (t.flat !== undefined) return (t.sign < 0 ? '−' : '+') + Math.abs(t.flat);
      return (t.sign < 0 ? '−' : '') + t.count + 'd' + t.sides + ' [' + t.rolls.join(', ') + ']';
    }).join(' ');
    return { total: Math.round(total), terms, detail, label, crit, fumble, d20: keptD20, expr: src };
  };

  D.roll = function (expr, opts) { return D.evaluate(expr, opts); };

  // A natural d20 check with modifier
  D.check = function (mod, opts) {
    const r = D.evaluate('1d20', opts);
    const m = Number(mod) || 0;
    r.total += m;
    r.mod = m;
    return r;
  };

  // ---------------------------------------------------------------- fuzzy
  const F = {};
  U.fuzzy = F;

  F.normalize = function (s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  F.tokens = (s) => F.normalize(s).split(' ').filter(Boolean);

  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'from', 'at', 'by', 'is', 'it',
    'that', 'this', 'these', 'those', 'there', 'their', 'my', 'me', 'i', 'you', 'your', 'we', 'our', 'some', 'any',
    'something', 'anything', 'thing', 'things', 'which', 'who', 'whom', 'what', 'when', 'where', 'how', 'why',
    'are', 'was', 'were', 'be', 'been', 'being', 'as', 'so', 'can', 'could', 'would', 'should', 'will', 'do', 'does',
    'like', 'similar', 'kind', 'sort', 'type', 'need', 'want', 'looking', 'find', 'give', 'get', 'make', 'let', 'please']);
  F.stem = function (w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 5) return w.slice(0, -3) + 'y';
    if (w.endsWith('sses')) return w.slice(0, -2);
    if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 6) return w.slice(0, -3);
    if (w.endsWith('ed') && w.length > 5) return w.slice(0, -2);
    return w;
  };
  F.contentTokens = function (s) {
    return F.tokens(s).filter(t => !STOP.has(t)).map(F.stem);
  };

  F.lev = function (a, b, max) {
    a = a || ''; b = b || '';
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > (max || 99)) return 99;
    let prev = new Array(bl + 1), cur = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j]);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (max && rowMin > max) return 99;
      const t = prev; prev = cur; cur = t;
    }
    return prev[bl];
  };

  F.trigrams = function (s) {
    s = ' ' + F.normalize(s) + ' ';
    const set = new Map();
    for (let i = 0; i < s.length - 2; i++) {
      const g = s.slice(i, i + 3);
      set.set(g, (set.get(g) || 0) + 1);
    }
    return set;
  };
  F.diceSimilarity = function (a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const [g, n] of a) if (b.has(g)) inter += Math.min(n, b.get(g));
    let total = 0;
    for (const n of a.values()) total += n;
    for (const n of b.values()) total += n;
    return (2 * inter) / total;
  };

  // Synonym expansion for vague / natural-language searching.
  F.SYNONYMS = {
    sword: ['blade', 'longsword', 'greatsword', 'shortsword', 'scimitar', 'rapier', 'sabre'],
    blade: ['sword', 'dagger', 'scimitar', 'axe'],
    weapon: ['sword', 'axe', 'mace', 'spear', 'bow', 'dagger', 'crossbow', 'hammer', 'flail'],
    armor: ['mail', 'plate', 'leather', 'shield', 'chain', 'scale'],
    shield: ['buckler', 'aegis'],
    heal: ['cure', 'healing', 'restore', 'restoration', 'revivify', 'regenerate', 'potion'],
    healing: ['cure', 'heal', 'restore', 'restoration', 'potion'],
    revive: ['resurrection', 'raise dead', 'revivify', 'resurrect'],
    resurrect: ['resurrection', 'raise dead', 'revivify'],
    fire: ['flame', 'flaming', 'burning', 'inferno', 'heat', 'ember', 'immolation', 'fiery', 'blazing'],
    flame: ['fire', 'burning', 'flaming', 'fiery'],
    fiery: ['fire', 'flame', 'flaming', 'burning', 'blazing'],
    burning: ['fire', 'flame', 'fiery', 'blazing'],
    ice: ['cold', 'frost', 'frozen', 'winter', 'snow', 'icy', 'frosty'],
    icy: ['ice', 'cold', 'frost', 'frozen'],
    cold: ['ice', 'frost', 'frozen', 'winter'],
    lightning: ['shock', 'thunder', 'storm', 'electric'],
    thunder: ['lightning', 'sonic', 'storm'],
    poison: ['venom', 'toxic', 'toxin'],
    acid: ['corrosive', 'caustic'],
    necrotic: ['death', 'necro', 'shadow', 'undead', 'wither'],
    radiant: ['holy', 'divine', 'light', 'sun'],
    undead: ['zombie', 'skeleton', 'vampire', 'ghost', 'lich', 'wight', 'revenant', 'specter', 'ghoul', 'wraith', 'mummy'],
    vampire: ['strahd', 'vampiric', 'undead', 'spawn'],
    werewolf: ['lycanthrope', 'wolf', 'werewolf'],
    wolf: ['werewolf', 'dire wolf', 'worg'],
    boss: ['legendary', 'dragon', 'demon', 'devil', 'giant', 'titan'],
    monster: ['creature', 'beast', 'fiend', 'aberration'],
    creature: ['monster', 'beast'],
    invisible: ['invisibility', 'hidden', 'stealth', 'unseen'],
    invisibility: ['invisible', 'hidden'],
    darkness: ['dark', 'shadow', 'black', 'night'],
    dark: ['darkness', 'shadow', 'necrotic'],
    light: ['radiant', 'lantern', 'torch', 'daylight', 'sun'],
    fly: ['flying', 'wing', 'wings', 'levitate', 'flight'],
    flying: ['fly', 'wings', 'levitate'],
    speed: ['haste', 'boots', 'dash', 'swift', 'expeditious'],
    slow: ['slowed', 'restrain', 'hold'],
    strength: ['gauntlets', 'giant', 'belt', 'might', 'power'],
    giant: ['ogre', 'troll', 'hill giant', 'stone giant', 'frost giant', 'fire giant'],
    dragon: ['wyrm', 'wyvern', 'drake', 'dragonborn'],
    demon: ['fiend', 'abyss', 'demonic', 'devil'],
    devil: ['fiend', 'infernal', 'hell', 'demon'],
    wizard: ['mage', 'warlock', 'sorcerer', 'arcanist', 'spellcaster'],
    spellcaster: ['wizard', 'mage', 'sorcerer', 'warlock', 'cleric', 'druid'],
    rogue: ['thief', 'assassin', 'stealth', 'sneak'],
    thief: ['rogue', 'steal', 'pickpocket'],
    stealth: ['hidden', 'sneak', 'invisibility'],
    potion: ['elixir', 'draught', 'brew', 'philter'],
    elixir: ['potion', 'draught'],
    scroll: ['spell scroll', 'parchment'],
    wand: ['rod', 'staff', 'scepter'],
    staff: ['wand', 'rod', 'quarterstaff'],
    ring: ['band', 'signet'],
    cloak: ['cape', 'mantle', 'cloak'],
    boots: ['shoes', 'footwear'],
    bag: ['haversack', 'pouch', 'satchel', 'backpack'],
    rope: ['cord', 'twine'],
    trap: ['hazard', 'pitfall', 'snare'],
    curse: ['cursed', 'hex', 'malediction', 'affliction'],
    fear: ['frightened', 'fearful', 'terror', 'dread'],
    charm: ['charmed', 'dominate', 'bewitch'],
    paralysis: ['paralyzed', 'hold', 'stun'],
    stun: ['stunned', 'paralyzed', 'incapacitated'],
    summon: ['conjure', 'summoning', 'call'],
    conjure: ['summon', 'conjuration'],
    teleport: ['misty step', 'dimension door', 'blink', 'portal'],
    detect: ['detection', 'sense', 'reveal', 'divination'],
    disguise: ['disguise self', 'illusion', 'polymorph'],
    polymorph: ['shapechange', 'transform', 'beast shape'],
    zombie: ['undead', 'ghoul', 'corpse'],
    skeleton: ['undead', 'bones'],
    ghost: ['specter', 'wraith', 'spirit', 'haunt'],
    raven: ['crow', 'bird', 'wereraven'],
    crow: ['raven', 'bird'],
    rat: ['vermin', 'swarm'],
    spider: ['arachnid', 'web', 'drider'],
    goblin: ['goblinoid', 'hobgoblin', 'bugbear'],
    orc: ['orcish', 'half-orc', 'goblinoid'],
    troll: ['regeneration', 'giant'],
    lich: ['undead', 'necromancer', 'skeleton'],
    mummy: ['undead', 'bandage'],
    hag: ['witch', 'crone', 'coven'],
    witch: ['hag', 'warlock', 'sorceress'],
    strahd: ['vampire', 'barovia', 'darklord'],
    barovia: ['strahd', 'vistani'],
    vistani: ['barovia', 'tarokka', 'gypsy'],
    tarokka: ['fortune', 'prophecy', 'card', 'vistani'],
    castle: ['keep', 'fortress'],
    forest: ['woods', 'woodland', 'grove'],
    mountain: ['peak', 'summit', 'ridge'],
    dungeon: ['crypt', 'catacomb', 'tomb'],
    tomb: ['crypt', 'grave', 'catacomb'],
    treasure: ['loot', 'hoard', 'riches', 'reward'],
    loot: ['treasure', 'hoard'],
    shop: ['merchant', 'trader', 'market'],
    npc: ['commoner', 'noble', 'guard', 'villager'],
    guard: ['soldier', 'watchman', 'sentinel'],
    soldier: ['guard', 'warrior', 'fighter'],
    assassin: ['rogue', 'killer', 'murderer'],
    bossfight: ['legendary', 'strahd'],
    random: ['table', 'roll', 'encounter'],
    weather: ['rain', 'storm', 'fog', 'snow'],
    fog: ['mist', 'mists', 'cloud'],
    mist: ['fog', 'mists', 'barovia']
  };
  F.expandToken = function (t) {
    const out = [t];
    const syn = F.SYNONYMS[t];
    if (syn) for (const s of syn) out.push(...F.tokens(s));
    return out;
  };

  // Score one doc against parsed query.
  // doc: {name, text, hayTokens:Set, nameTokens:Set, trigrams:Map}
  F.scoreDoc = function (doc, q, opts) {
    opts = opts || {};
    const name = doc.nameNorm;
    let score = 0;
    const matched = [];
    if (!q.tokens.length) return 0;
    let allInName = true, anyInName = false;
    let qpos = 0;

    for (const token of q.tokens) {
      const variants = F.expandToken(token);
      let best = 0, bestVia = null;
      // exact / prefix in name
      for (const v of variants) {
        if (!v) continue;
        if (name === v) { best = Math.max(best, 1000); bestVia = v; }
        else if (name.startsWith(v + ' ') || name.startsWith(v)) { best = Math.max(best, 720); bestVia = v; }
        else {
          const idx = name.indexOf(v);
          if (idx >= 0) { best = Math.max(best, 540 - Math.min(120, idx * 6)); bestVia = v; }
        }
        // token-level prefix in name
        if (doc.nameTokens.has(v)) { best = Math.max(best, 460); bestVia = v; }
        if (doc.nameTokens.has(F.stem(v))) { best = Math.max(best, 430); bestVia = v; }
      }
      // fuzzy token match against name tokens
      if (best < 400) {
        const max = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
        if (max) {
          for (const nt of doc.nameTokens) {
            if (Math.abs(nt.length - token.length) > max) continue;
            const d = F.lev(nt, token, max);
            if (d <= max) { best = Math.max(best, 380 - d * 60); bestVia = nt; break; }
          }
        }
      }
      // body tokens
      if (best < 300) {
        for (const v of variants) {
          if (!v) continue;
          if (doc.hayTokens.has(v)) { best = Math.max(best, 220); bestVia = v; break; }
          if (doc.hayTokens.has(F.stem(v))) { best = Math.max(best, 190); bestVia = v; break; }
        }
      }
      // typo tolerance in body (cheap: only for longer words)
      if (best < 120 && token.length >= 5) {
        for (const ht of doc.hayTokens) {
          if (Math.abs(ht.length - token.length) > 1) continue;
          if (F.lev(ht, token, 1) <= 1) { best = 120; bestVia = ht; break; }
        }
      }
      if (!best && !q.optional) {
        // whole-phrase substring fallback
        if (q.phrase && (name.includes(q.phrase) || doc.textNorm.includes(q.phrase))) best = 160;
        else return -1;
      }
      if (doc.nameTokens.has(token) || name.includes(token)) anyInName = true;
      if (best < 180) allInName = false;
      score += best;
      if (bestVia) matched.push(bestVia);
      qpos++;
    }

    if (q.phrase) {
      if (name === q.phrase) score += 500;
      else if (name.includes(q.phrase)) score += 260;
      else if (doc.textNorm.includes(q.phrase)) score += 60;
    }
    if (allInName && anyInName) score += 120;
    // trigram name similarity
    const sim = F.diceSimilarity(doc.trigrams, q.trigrams);
    score += sim * 130;
    // kind preference
    if (opts.kind && doc.kind === opts.kind) score += 45;
    // slight preference for shorter names (better exact-ish matches)
    score -= Math.min(30, name.length / 8);
    // already-used / favourite boost
    if (opts.boost && opts.boost[doc.id]) score += opts.boost[doc.id];
    return { score, matched };
  };

  // ---------------------------------------------------------------- 5e tables
  U.CR_XP = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100,
    '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400,
    '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000,
    '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000,
    '27': 105000, '28': 120000, '29': 135000, '30': 155000
  };
  U.crToXp = function (cr) {
    if (cr === undefined || cr === null) return 0;
    const key = String(cr).trim();
    if (U.CR_XP[key] !== undefined) return U.CR_XP[key];
    const n = parseFloat(key);
    if (isNaN(n)) return 0;
    return U.CR_XP[String(n)] || 0;
  };
  U.crLabel = function (cr) {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25) return '1/4';
    if (cr === 0.5) return '1/2';
    return String(cr);
  };
  U.crValue = function (cr) {
    if (typeof cr === 'number') return cr;
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    const n = parseFloat(cr);
    return isNaN(n) ? 0 : n;
  };

  U.XP_THRESHOLDS = [
    [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500],
    [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
    [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500],
    [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200],
    [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]
  ];
  U.thresholdsFor = function (level) {
    return U.XP_THRESHOLDS[U.clamp(level, 1, 20) - 1];
  };
  U.encounterMultiplier = function (n) {
    if (n <= 1) return 1;
    if (n === 2) return 1.5;
    if (n <= 6) return 2;
    if (n <= 10) return 2.5;
    if (n <= 14) return 3;
    return 4;
  };
  U.difficultyFor = function (adjusted, thresholds) {
    if (adjusted >= thresholds[3]) return 'deadly';
    if (adjusted >= thresholds[2]) return 'hard';
    if (adjusted >= thresholds[1]) return 'medium';
    if (adjusted >= thresholds[0]) return 'easy';
    return 'trivial';
  };

  // entries: [{cr, qty}]  partyLevels: [3,3,2,...]
  U.encounterMath = function (entries, partyLevels) {
    const levels = (partyLevels && partyLevels.length) ? partyLevels : [1];
    const thresholds = levels.reduce((acc, lv) => {
      const t = U.thresholdsFor(lv);
      return [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2], acc[3] + t[3]];
    }, [0, 0, 0, 0]);
    let rawXp = 0, count = 0;
    (entries || []).forEach(e => {
      const q = Math.max(0, U.num(e.qty, 0));
      rawXp += U.crToXp(e.cr) * q;
      count += q;
    });
    let mult = U.encounterMultiplier(count);
    if (levels.length < 3) mult = Math.min(5, mult * 1.5);
    else if (levels.length > 5) mult = Math.max(0.5, mult * 0.5);
    const adjusted = Math.round(rawXp * mult);
    return {
      rawXp, adjusted, count, multiplier: mult, thresholds,
      verdict: U.difficultyFor(adjusted, thresholds)
    };
  };

  // ---------------------------------------------------------------- 5e constants
  U.CONDITIONS = [
    { name: 'Blinded', desc: 'Can’t see, auto-fails sight checks, attacks against it have advantage, its attacks have disadvantage.' },
    { name: 'Charmed', desc: 'Can’t attack the charmer, charmer has advantage on social checks with it.' },
    { name: 'Deafened', desc: 'Can’t hear, auto-fails hearing checks.' },
    { name: 'Exhaustion', desc: 'Levels 1–6: disadvantage on checks, speed halved, hp max halved, death at 6.' },
    { name: 'Frightened', desc: 'Disadvantage on checks/attacks while source is in sight; can’t willingly move closer.' },
    { name: 'Grappled', desc: 'Speed 0. Ends if grappler is incapacitated or moved away.' },
    { name: 'Incapacitated', desc: 'Can’t take actions, bonus actions, or reactions.' },
    { name: 'Invisible', desc: 'Unseen; attacks against it have disadvantage, its attacks have advantage.' },
    { name: 'Paralyzed', desc: 'Incapacitated, can’t move, auto-fails Str/Dex saves; hits within 5 ft. are crits.' },
    { name: 'Petrified', desc: 'Transformed to stone, incapacitated, unaware; resistance to all damage.' },
    { name: 'Poisoned', desc: 'Disadvantage on attack rolls and ability checks.' },
    { name: 'Prone', desc: 'Can only crawl; melee attacks against it have advantage, ranged disadvantage.' },
    { name: 'Restrained', desc: 'Speed 0; attacks against it have advantage, its attacks/saves have disadvantage.' },
    { name: 'Stunned', desc: 'Incapacitated, can’t move, auto-fails Str/Dex saves; attacks against it have advantage.' },
    { name: 'Unconscious', desc: 'Incapacitated, drops prone, unaware; hits within 5 ft. are crits.' }
  ];
  U.CONDITION_NAMES = U.CONDITIONS.map(c => c.name);

  U.SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
  U.SIZES = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
  U.SIZE_ORDER = ['T', 'S', 'M', 'L', 'H', 'G'];
  U.ALIGNMENTS = { L: 'Lawful', N: 'Neutral', C: 'Chaotic', G: 'Good', E: 'Evil', U: 'Unaligned', A: 'Any', Any: 'Any' };
  U.ITEM_TYPES = {
    A: 'Ammunition', AF: 'Ammunition', AT: 'Artisan’s Tools', FD: 'Food & Drink', G: 'Gear', GS: 'Gaming Set',
    GV: 'Gear', HA: 'Heavy Armor', INS: 'Instrument', LA: 'Light Armor', MA: 'Medium Armor', M: 'Melee Weapon',
    MNT: 'Mount', OTH: 'Other', P: 'Potion', R: 'Ranged Weapon', RG: 'Ring', S: 'Shield', SC: 'Scroll',
    SCF: 'Spellcasting Focus', SHP: 'Ship', T: 'Tool', TB: 'Trade Bar', TG: 'Trade Good', VEH: 'Vehicle',
    WD: 'Wand', W: 'Wondrous Item', $: 'Treasure', EXP: 'Explosive', MAR: 'Martial Weapon', SIM: 'Simple Weapon',
    INS: 'Instrument', MUS: 'Instrument'
  };
  U.RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies'];
  U.RARITY_CLASS = { common: '', uncommon: 'green', rare: 'blue', 'very rare': 'purple', legendary: 'gold', artifact: 'accent' };
  U.DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

  U.ENVIRONMENTS = [
    'arctic', 'coastal', 'desert', 'forest', 'grassland', 'hill', 'mountain', 'swamp', 'underdark', 'urban', 'underwater'
  ];

  // Format CR from strings like "1/2" or number
  U.crText = (cr) => {
    if (cr === undefined || cr === null) return '—';
    return String(cr) === '0.125' ? '1/8' : String(cr) === '0.25' ? '1/4' : String(cr) === '0.5' ? '1/2' : String(cr);
  };

  U.plural = (n, one, many) => n === 1 ? one : (many || one + 's');

  U.toRoman = function (n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  };
})();
