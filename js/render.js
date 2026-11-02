/* 5etools-style content renderer: tags, entries, statblocks, spells, items */
(function () {
  'use strict';
  const U = DM.U;
  const R = {};
  DM.render = R;

  const esc = U.esc;

  // ---------------------------------------------------------------- inline tags
  function splitArgs(s) {
    const out = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (c === '|' && depth <= 0) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim());
  }

  const ABIL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const ATK = { mw: 'Melee Weapon Attack', rw: 'Ranged Weapon Attack', ms: 'Melee Spell Attack', rs: 'Ranged Spell Attack', m: 'Melee Attack', r: 'Ranged Attack' };
  const SIZES = U.SIZES;

  function rollChip(expr, label) {
    const shown = label || expr;
    return '<span class="chip-die" data-dice="' + esc(expr) + '" title="Roll ' + esc(expr) + '">' + inlineSafe(shown) + '</span>';
  }

  function inlineSafe(text) { return inline(text); }

  function ref(kind, name, display, extra) {
    const d = display && display !== '' ? display : name;
    return '<span class="ref-link ' + kind + '" data-ref-kind="' + kind + '" data-ref-name="' + esc(name) + '"' + (extra || '') + '>' + inline(d) + '</span>';
  }

  function inline(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    str = str.replace(/\{\{([^}]*)\}\}/g, '—').replace(/\{=[^}]*\}/g, '');
    // Use a local regex: inline() recurses through tag arguments, and a shared
    // global regex would leak lastIndex between recursion levels (infinite loop).
    const re = /\{@([a-zA-Z0-9_]+)(?:\s+([^}]*))?\}/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      out += esc(str.slice(last, m.index)).replace(/\n/g, '<br>');
      out += tag(m[1].toLowerCase(), splitArgs(m[2] || ''));
      last = m.index + m[0].length;
    }
    out += esc(str.slice(last)).replace(/\n/g, '<br>');
    return out;
  }
  R.inline = inline;

  function tag(type, a) {
    const arg = (i) => a[i] === undefined ? '' : a[i];
    switch (type) {
      case 'b': case 'bold': return '<b>' + inline(arg(0)) + '</b>';
      case 'i': case 'italic': return '<i>' + inline(arg(0)) + '</i>';
      case 's': case 'strike': case 'strikethrough': return '<s>' + inline(arg(0)) + '</s>';
      case 'u': case 'underline': return '<u>' + inline(arg(0)) + '</u>';
      case 'note': return '<span class="note">' + inline(arg(0)) + '</span>';
      case 'highlight': return '<span class="hl">' + inline(arg(0)) + '</span>';
      case 'atk': return '<b>' + arg(0).split(',').map(x => ATK[x.trim()] || x.trim()).join(' or ') + ':</b>';
      case 'h': return '<b>Hit: </b>';
      case 'hit': {
        const raw = String(arg(0));
        const n = raw.replace(/[^0-9-]/g, '');
        const disp = (raw.startsWith('+') || raw.startsWith('−') || raw.startsWith('-')) ? raw : (Number(n) >= 0 ? '+' + raw : raw);
        return '<span class="chip-die" data-dice="1d20' + (Number(n) >= 0 ? '+' + n : n) + '" title="Roll attack (d20' + (Number(n) >= 0 ? '+' + n : n) + ')"><b>' + esc(disp) + '</b></span>';
      }
      case 'dc': return '<b>DC ' + esc(arg(0)) + '</b>';
      case 'damage': case 'scaledamage': return rollChip(arg(0), arg(0));
      case 'dice': case 'scaledice': return rollChip(arg(0), arg(0));
      case 'd20': return '<b>d20</b>';
      case 'chance': return esc(arg(0)) + ' percent';
      case 'recharge': {
        const n = String(arg(0));
        return '<b>(Recharge ' + n + (n === '6' ? '' : '–6') + ')</b>';
      }
      case 'spell': return ref('spell', arg(0), arg(2) || arg(0));
      case 'item': return ref('item', arg(0), arg(2) || arg(0));
      case 'creature': return ref('creature', arg(0), arg(2) || arg(0), ' data-ref-source="' + esc(arg(1)) + '"');
      case 'condition': return ref('condition', arg(0), arg(1) || arg(0));
      case 'action': return ref('rule', arg(0), arg(1) || arg(0));
      case 'skill': return esc(arg(0 || 0));
      case 'sense': return esc(arg(0));
      case 'status': return esc(arg(0));
      case 'ability': return a[0].split(',').map(x => ABIL[x.trim().toLowerCase()] || x.trim()).join(' or ');
      case 'savingthrow': return 'DC ' + esc(arg(0)) + ' ' + (ABIL[String(arg(1)).toLowerCase()] || arg(1)) + ' saving throw';
      case 'book': return '<i>' + inline(arg(0)) + '</i>';
      case 'adventure': return inline(arg(0));
      case 'area': return '<span class="ref-link area" data-area="' + esc(arg(1)) + '">' + inline(arg(0)) + '</span>';
      case 'card': {
        const nm = arg(0);
        return '<span class="ref-link card" data-ref-kind="tarokka" data-ref-name="' + esc(nm) + '">' + inline(nm) + '</span>';
      }
      case 'deck': return inline(arg(0));
      case 'table': return '<span class="ref-link" data-ref-kind="table" data-ref-name="' + esc(arg(0)) + '">' + inline(arg(2) || arg(0)) + '</span>';
      case 'variantrule': case 'rule': return '<span class="ref-link" data-ref-kind="rule" data-ref-name="' + esc(arg(0)) + '">' + inline(arg(2) || arg(0)) + '</span>';
      case 'class': case 'classfeature': case 'subclassfeature': case 'race': case 'feat': case 'background':
      case 'deity': case 'object': case 'vehicle': case 'reward': case 'boon': case 'cult': case 'optfeature':
      case 'charoption': case 'itementry': case 'footnote': case 'quickref': case 'comic': case 'filter':
      case 'source': case '5etools': case 'link': return inline(arg(2) || arg(0));
      case 'url': return '<a href="' + esc(arg(0)) + '" target="_blank" rel="noopener">' + inline(arg(1) || arg(0)) + '</a>';
      case 'sup': return '<sup>' + inline(arg(0)) + '</sup>';
      case 'sub': return '<sub>' + inline(arg(0)) + '</sub>';
      case 'code': return '<code>' + esc(arg(0)) + '</code>';
      case 'noun': return inline(arg(0) || arg(1));
      default: return inline(a.length > 1 ? a[a.length - 1] : arg(0));
    }
  }

  // ---------------------------------------------------------------- entries
  R.entries = function (entries, opts) {
    opts = opts || {};
    if (entries === null || entries === undefined) return '';
    if (typeof entries === 'string') return '<p>' + inline(entries) + '</p>';
    if (Array.isArray(entries)) return entries.map(e => R.entries(e, opts)).join('');
    if (typeof entries !== 'object') return '<p>' + esc(String(entries)) + '</p>';
    const e = entries;
    const id = e.id ? ' id="sec-' + esc(e.id) + '"' : '';
    switch (e.type) {
      case 'entries':
        if (e.name) {
          const heading = opts.collapsible
            ? '<details class="section-details" open' + (e.id ? ' data-sec-id="' + esc(e.id) + '"' : '') + '><summary>' + inline(e.name) + '</summary>'
            : '';
          const inner = R.entries(e.entries, Object.assign({}, opts, { depth: (opts.depth || 0) + 1 }));
          if (opts.collapsible) return '<div class="entry-sec"' + (e.id ? ' id="sec-' + esc(e.id) + '"' : '') + '>' + heading + inner + '</details></div>';
          return '<div class="entry-sec"' + id + '><h4>' + inline(e.name) + '</h4>' + inner + '</div>';
        }
        return '<div class="entry-plain">' + R.entries(e.entries, opts) + '</div>';
      case 'section': {
        const inner = R.entries(e.entries, Object.assign({}, opts, { depth: (opts.depth || 0) + 1 }));
        const heading = '<h3 class="area-heading">' + inline(e.name) + '</h3>';
        if (opts.tocOnly) return '';
        return '<section class="entry-sec"' + id + '>' + heading + inner + '</section>';
      }
      case 'inset':
        return '<aside class="inset-box">' + (e.name ? '<div class="inset-title">' + inline(e.name) + '</div>' : '') + R.entries(e.entries, opts) + '</aside>';
      case 'insetReadaloud':
        return '<div class="readaloud">' + R.entries(e.entries, opts) + '</div>';
      case 'quote':
        return '<blockquote class="entry-quote">' + R.entries(e.entries, opts) + (e.by ? '<div class="cite">— ' + inline(e.by) + '</div>' : '') + '</blockquote>';
      case 'list': {
        const tagName = e.ordered ? 'ol' : 'ul';
        const items = (e.items || []).map(it => {
          if (typeof it === 'string') return '<li>' + inline(it) + '</li>';
          if (it.type === 'item' || it.type === 'itemSub') {
            return '<li>' + (it.name ? '<b>' + inline(it.name) + '.</b> ' : '') + R.entries(it.entries || it.entry || '', opts).replace(/^<p>|<\/p>$/g, '') + '</li>';
          }
          if (it.entries) return '<li>' + (it.name ? '<b>' + inline(it.name) + '.</b> ' : '') + R.entries(it.entries, opts).replace(/^<p>|<\/p>$/g, '') + '</li>';
          return '<li>' + inline(it) + '</li>';
        }).join('');
        return '<' + tagName + ' class="entry-list">' + items + '</' + tagName + '>';
      }
      case 'table': {
        const isRoll = e.colLabels && e.colLabels[0] && /^d(\d+)/i.exec(String(e.colLabels[0]));
        const die = isRoll ? parseInt(isRoll[1], 10) : 0;
        let rows = '';
        (e.rows || []).forEach(row => {
          if (!Array.isArray(row)) return;
          const first = row[0];
          let min = null, max = null;
          if (isRoll && (typeof first === 'string' || typeof first === 'number')) {
            const fm = String(first).replace(/[–—]/g, '-').match(/(\d+)\s*(?:-\s*(\d+))?/);
            if (fm) { min = parseInt(fm[1], 10); max = fm[2] ? parseInt(fm[2], 10) : min; }
          }
          rows += '<tr' + (min !== null ? ' data-roll-min="' + min + '" data-roll-max="' + max + '"' : '') + '>' +
            row.map(cell => {
              if (cell && typeof cell === 'object') {
                if (cell.type === 'cell') return '<td>' + R.entries(cell.entries || cell.entry || '', opts).replace(/^<p>|<\/p>$/g, '') + '</td>';
                if (cell.roll) return '<td>' + inline(cell.roll.roll || '') + '</td>';
                if (Array.isArray(cell)) return '<td>' + cell.map(c => inline(c)).join(' ') + '</td>';
                return '<td>' + inline(cell.entries || '') + '</td>';
              }
              return '<td>' + inline(cell) + '</td>';
            }).join('') + '</tr>';
        });
        const head = e.colLabels ? '<thead><tr>' + e.colLabels.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead>' : '';
        const btn = isRoll ? '<button class="btn xs table-roll" data-die="' + die + '" data-table-roll="1">🎲 Roll d' + die + '</button>' : '';
        return '<div class="table-wrap"' + (isRoll ? ' data-roll-table="1"' : '') + '>' + (btn || e.caption ? '<div class="table-cap"><span>' + inline(e.caption || e.name || '') + '</span>' + btn + '</div>' : '') +
          '<table class="entry-table">' + head + '<tbody>' + rows + '</tbody></table></div>';
      }
      case 'image': case 'gallery': {
        const items = e.type === 'gallery' ? (e.images || []) : [e];
        return items.map(img => {
          const cap = img.title || img.caption || e.title || e.name || '';
          const page = img.page || e.page || '';
          return '<figure class="img-note"><span class="img-ico">▣</span><figcaption>' + inline(cap || 'Illustration') + (page ? ' <span class="dim">(p. ' + esc(page) + ')</span>' : '') + '</figcaption></figure>';
        }).join('');
      }
      case 'statblock': {
        const nm = e.name || (e.tag ? e.tag.split('|')[0] : '');
        return '<div class="statblock-inline"><button class="btn xs" data-open-monster="' + esc(nm) + '" data-source="' + esc(e.source || '') + '">' + esc(nm) + '</button></div>';
      }
      case 'item': {
        const nm = e.name || '';
        return '<div class="item-inline"><button class="btn xs" data-open-item="' + esc(nm) + '">' + esc(nm) + '</button></div>';
      }
      case 'wrapper':
        return R.entries(e.wrappeds || e.entries || [], opts);
      case 'cell':
        return inline(e.entry || e.entries || '');
      case 'hr': return '<hr class="sb-rule thin">';
      case 'code': return '<pre class="code-block">' + esc(Array.isArray(e.pre) ? e.pre.join('\n') : (e.pre || '')) + '</pre>';
      case 'abilityDc': {
        const attrs = (e.attributes || []).map(x => ABIL[x] || x).join(', ');
        return '<p><b>' + (e.name || 'Spellcasting') + '.</b> Spell save DC = 8 + your proficiency bonus + your ' + attrs + ' modifier.</p>';
      }
      case 'abilityAttackMod': {
        const attrs = (e.attributes || []).map(x => ABIL[x] || x).join(', ');
        return '<p><b>' + (e.name || 'Spellcasting') + '.</b> Spell attack modifier = your proficiency bonus + your ' + attrs + ' modifier.</p>';
      }
      default:
        if (e.entries) return R.entries(e.entries, opts);
        if (e.items) return R.entries({ type: 'list', items: e.items }, opts);
        return '';
    }
  };

  // ---------------------------------------------------------------- helpers
  function joinList(v, sep) {
    if (!v) return '';
    if (!Array.isArray(v)) v = [v];
    return v.map(item => {
      if (typeof item === 'string') return inline(item);
      if (typeof item === 'number') return String(item);
      if (item && item.type === 'cell') return inline(item.entry || '');
      if (item && item.resist) return joinList(item.resist) + (item.note ? ' ' + item.note : '');
      if (item && item.immune) return joinList(item.immune) + (item.note ? ' ' + item.note : '');
      if (item && item.vulnerable) return joinList(item.vulnerable) + (item.note ? ' ' + item.note : '');
      if (item && item.special) return inline(item.special || '');
      return inline(String(item.entry || item.name || ''));
    }).join(sep || ', ');
  }
  R.joinList = joinList;

  function acText(ac) {
    if (ac === undefined || ac === null) return '—';
    if (typeof ac === 'number') return String(ac);
    if (!Array.isArray(ac)) ac = [ac];
    return ac.map(a => {
      if (typeof a === 'number') return String(a);
      if (typeof a === 'string') return a;
      let s = String(a.ac);
      if (a.from) s += ' (' + joinList(a.from).replace(/<\/?[^>]+>/g, '') + ')';
      else if (a.condition) s += ' ' + inline(a.condition);
      return s;
    }).join(', ');
  }

  function speedText(sp) {
    if (!sp) return '—';
    if (typeof sp === 'string') return inline(sp);
    const bits = [];
    const names = { walk: 'walk', fly: 'fly', swim: 'swim', climb: 'climb', burrow: 'burrow', hover: 'hover' };
    for (const k of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
      let v = sp[k];
      if (v === undefined || v === null || v === 0) continue;
      if (typeof v === 'object') {
        let s = v.number + ' ft.';
        if (v.condition) s += ' (' + inline(v.condition) + ')';
        bits.push(names[k] + ' ' + s);
      } else {
        bits.push((k === 'walk' ? '' : names[k] + ' ') + v + ' ft.' + (k === 'fly' && sp.hover ? ' (hover)' : ''));
      }
    }
    if (sp.hover && !sp.fly) bits.push('hover');
    return bits.join(', ') || '—';
  }

  function abilitiesLine(m) {
    const cols = [['str', 'STR'], ['dex', 'DEX'], ['con', 'CON'], ['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA']];
    return '<div class="sb-stats">' + cols.map(([k, label]) => {
      const score = m[k];
      if (score === undefined) return '';
      const save = m.save && m.save[k];
      return '<div class="sb-stat"><div class="k">' + label + '</div><div class="v">' + score + '</div><div class="m">' + U.modStr(score) + (save ? ' <b>(' + save + ')</b>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function traitBlock(t) {
    if (!t) return '';
    if (typeof t === 'string') return '<p class="sb-trait">' + inline(t) + '</p>';
    const entries = t.entries || t.entry || '';
    return '<div class="sb-trait"><b>' + inline(t.name || '') + '.</b> ' + R.entries(entries).replace(/^<p>|<\/p>$/g, '') + '</div>';
  }

  function spellcastingBlocks(sc) {
    if (!sc) return '';
    if (!Array.isArray(sc)) sc = [sc];
    return sc.map(block => {
      let out = '<div class="spellcasting-block"><div class="sc-name">' + inline(block.name || 'Spellcasting') + '.</div>';
      if (block.headerEntries) out += R.entries(block.headerEntries);
      if (block.will) out += '<div class="sc-level"><b>At will:</b> ' + block.will.map(s => ref('spell', cleanSpell(s), cleanSpell(s))).join(', ') + '</div>';
      if (block.daily) {
        for (const n of Object.keys(block.daily)) {
          out += '<div class="sc-level"><b>' + n + '/day each:</b> ' + (block.daily[n] || []).map(s => ref('spell', cleanSpell(s), cleanSpell(s))).join(', ') + '</div>';
        }
      }
      if (block.spells) {
        const names = { 0: 'Cantrips (at will)', 1: '1st level', 2: '2nd level', 3: '3rd level', 4: '4th level', 5: '5th level', 6: '6th level', 7: '7th level', 8: '8th level', 9: '9th level' };
        for (const lvl of Object.keys(block.spells)) {
          const lv = block.spells[lvl];
          const label = names[lvl] || (lvl + ' level');
          out += '<div class="sc-level"><b>' + label + (lv.slots ? ' (' + lv.slots + ' slots)' : '') + ':</b> ' +
            (lv.spells || []).map(s => { const nm = cleanSpell(s); return ref('spell', nm, nm); }).join(', ') + '</div>';
        }
      }
      if (block.footerEntries) out += R.entries(block.footerEntries);
      return out + '</div>';
    }).join('');
  }

  function cleanSpell(s) {
    // "{@spell fireball}" -> fireball
    return String(s || '').replace(/\{@[^ ]+ /, '').replace(/\}/g, '').split('|')[0];
  }

  function actionList(title, list, note, opts) {
    if (!list || !list.length) return '';
    if (!Array.isArray(list)) list = [list];
    let out = '<div class="sb-sec-title">' + title + '</div>';
    if (note) out += '<div class="sb-actions-note">' + inline(note) + '</div>';
    out += list.map(t => traitBlock(t)).join('');
    return out;
  }

  // ---------------------------------------------------------------- monster
  R.monster = function (m, opts) {
    if (!m) return '<p class="muted">Statblock not found.</p>';
    opts = opts || {};
    const type = m.type && typeof m.type === 'object' ? (m.type.type + (m.type.tags && m.type.tags.length ? ' (' + m.type.tags.join(', ') + ')' : '')) : (m.type || '');
    const size = (m.size || []).map(s => SIZES[s] || s).join(' ');
    const align = joinList(m.alignment).replace(/<\/?[^>]+>/g, '');
    let h = '<div class="statblock">';
    h += '<h2 class="sb-name">' + inline(m.name) + '</h2>';
    h += '<div class="sb-meta">' + esc([size, type, align].filter(Boolean).join(', ')) + '</div>';
    h += '<hr class="sb-rule">';
    h += '<div class="sb-line"><b>Armor Class</b> ' + esc(acText(m.ac)) + '</div>';
    if (m.hp) {
      h += '<div class="sb-line"><b>Hit Points</b> ' + esc(m.hp.average) + (m.hp.formula ? ' (' + esc(m.hp.formula) + ')' : '') + (m.hp.notes ? ' ' + inline(m.hp.notes) : '') + '</div>';
    }
    h += '<div class="sb-line"><b>Speed</b> ' + speedText(m.speed) + '</div>';
    h += '<hr class="sb-rule thin">';
    h += abilitiesLine(m);
    h += '<hr class="sb-rule thin">';
    if (m.save && Object.keys(m.save).length) h += '<div class="sb-line"><b>Saving Throws</b> ' + Object.entries(m.save).map(([k, v]) => (ABIL[k] || k) + ' ' + esc(v)).join(', ') + '</div>';
    if (m.skill && Object.keys(m.skill).length) h += '<div class="sb-line"><b>Skills</b> ' + Object.entries(m.skill).map(([k, v]) => k.charAt(0).toUpperCase() + k.slice(1) + ' ' + esc(v)).join(', ') + '</div>';
    if (m.resist) h += '<div class="sb-line"><b>Damage Resistances</b> ' + joinList(m.resist) + '</div>';
    if (m.immune) h += '<div class="sb-line"><b>Damage Immunities</b> ' + joinList(m.immune) + '</div>';
    if (m.vulnerable) h += '<div class="sb-line"><b>Damage Vulnerabilities</b> ' + joinList(m.vulnerable) + '</div>';
    if (m.conditionImmune) h += '<div class="sb-line"><b>Condition Immunities</b> ' + joinList(m.conditionImmune) + '</div>';
    if (m.senses) h += '<div class="sb-line"><b>Senses</b> ' + joinList(m.senses) + (m.passive ? ', passive Perception ' + esc(m.passive) : '') + '</div>';
    if (m.languages) h += '<div class="sb-line"><b>Languages</b> ' + joinList(m.languages) + '</div>';
    h += '<div class="sb-line"><b>Challenge</b> ' + esc(U.crText(m.cr)) + ' (' + (U.crToXp(m.cr) || 0).toLocaleString() + ' XP)' + (m.proficiencyBonus ? ' · Prof. +' + esc(m.proficiencyBonus) : '') + '</div>';
    h += '<hr class="sb-rule thin">';
    if (m.trait) h += m.trait.map(traitBlock).join('');
    if (m.spellcasting) h += spellcastingBlocks(m.spellcasting);
    h += actionList('Actions', m.action);
    h += actionList('Bonus Actions', m.bonus);
    h += actionList('Reactions', m.reaction);
    if (m.legendary) h += actionList('Legendary Actions', m.legendary, m.legendaryHeader ? null : 'Legendary actions can be used at the end of another creature’s turn. Only one legendary action option can be used at a time.');
    if (m.mythic) h += actionList('Mythic Actions', m.mythic);
    h += '</div>';
    return h;
  };

  R.monsterMeta = function (m) {
    const size = (m.size || []).map(s => SIZES[s] || s).join(' ');
    const type = m.type && typeof m.type === 'object' ? m.type.type : (m.type || '');
    return [size, type, 'CR ' + U.crText(m.cr)].filter(Boolean).join(' · ');
  };

  // ---------------------------------------------------------------- spell
  R.spell = function (sp) {
    if (!sp) return '<p class="muted">Spell not found.</p>';
    const lvl = Number(sp.level) === 0 ? 'Cantrip' : U.toRoman ? '' : '';
    const levelText = Number(sp.level) === 0 ? 'Cantrip' : (sp.level + (Number(sp.level) === 1 ? 'st' : Number(sp.level) === 2 ? 'nd' : Number(sp.level) === 3 ? 'rd' : 'th') + '-level');
    const school = sp.school ? (sp.school.charAt(0).toUpperCase() + sp.school.slice(1).toLowerCase()) : '';
    let h = '<div class="statblock spellblock">';
    h += '<h2 class="sb-name">' + inline(sp.name) + '</h2>';
    h += '<div class="sb-meta"><i>' + esc(levelText) + (school ? ' ' + esc(school.toLowerCase()) : '') + '</i>' + (sp.ritual ? ' <span class="tag gold">Ritual</span>' : '') + '</div>';
    h += '<hr class="sb-rule">';
    h += '<div class="sb-line"><b>Casting Time:</b> ' + (sp.time ? sp.time.map(t => esc(t.number) + ' ' + esc(t.unit)).join(', ') : '—') + '</div>';
    h += '<div class="sb-line"><b>Range:</b> ' + (sp.range ? (sp.range.type === 'point' ? esc(sp.range.distance.amount) + ' ' + esc(sp.range.distance.type) : (sp.range.type === 'special' ? 'Special' : esc(sp.range.type))) : '—') + '</div>';
    h += '<div class="sb-line"><b>Components:</b> ' + (sp.components ? [sp.components.v ? 'V' : '', sp.components.s ? 'S' : '', sp.components.m ? (typeof sp.components.m === 'string' ? 'M (' + inline(sp.components.m) + ')' : 'M') : ''].filter(Boolean).join(', ') : '—') + '</div>';
    h += '<div class="sb-line"><b>Duration:</b> ' + (sp.duration ? sp.duration.map(d => {
      if (d.type === 'instant') return 'Instantaneous';
      if (d.type === 'permanent') return 'Permanent';
      if (d.type === 'special') return 'Special';
      return (d.concentration ? 'Concentration, up to ' : '') + esc(d.duration ? d.duration.amount + ' ' + d.duration.type : '');
    }).join(', ') : '—') + '</div>';
    h += '<hr class="sb-rule thin">';
    h += R.entries(sp.entries);
    if (sp.entriesHigherLevel) {
      h += '<div class="sb-sec-title" style="font-size:13px">At Higher Levels</div>' + R.entries(sp.entriesHigherLevel);
    }
    if (sp.damageInflict && sp.damageInflict.length) h += '<div class="sb-line muted small" style="margin-top:10px"><b>Damage:</b> ' + sp.damageInflict.join(', ') + (sp.savingThrow ? ' · Save: ' + sp.savingThrow.join(', ') : '') + '</div>';
    h += '</div>';
    return h;
  };

  R.spellMeta = function (sp) {
    const school = sp.school ? sp.school.charAt(0).toUpperCase() + sp.school.slice(1) : '';
    return (Number(sp.level) === 0 ? 'Cantrip' : 'Level ' + sp.level) + ' · ' + school + (sp.ritual ? ' · Ritual' : '');
  };

  // ---------------------------------------------------------------- item
  function baseFor(item) {
    if (!item || !item.baseItem) return null;
    return DM.data.baseItem(item.baseItem);
  }

  function fillItemTokens(node, item) {
    if (node == null) return node;
    if (typeof node === 'string') {
      return node.replace(/\{=([a-zA-Z0-9_.]+)\}/g, (m, key) => {
        const v = item[key] != null ? item[key] : item[key.split('.').pop()];
        return v == null ? '' : String(v);
      });
    }
    if (Array.isArray(node)) return node.map(n => fillItemTokens(n, item));
    if (typeof node === 'object') {
      const out = {};
      for (const k in node) out[k] = fillItemTokens(node[k], item);
      return out;
    }
    return node;
  }

  R.item = function (item) {
    if (!item) return '<p class="muted">Item not found.</p>';
    const base = baseFor(item);
    const typeLabel = itemTypeLabel(item, base);    const meta = [];
    const rarity = item.rarity && item.rarity !== 'none' && item.rarity !== 'unknown' ? String(item.rarity) : '';
    if (rarity) meta.push(rarity);
    if (typeLabel) meta.push(typeLabel);
    let h = '<div class="statblock itemblock">';
    h += '<h2 class="sb-name">' + inline(item.name) + '</h2>';
    h += '<div class="sb-meta"><i>' + esc(meta.join(', ')) + (item.reqAttune ? ' (requires attunement' + (item.reqAttune !== true && item.reqAttune !== 'true' ? ' ' + inline(String(item.reqAttune)) : '') + ')' : '') + '</i></div>';
    h += '<hr class="sb-rule">';
    if (item.requiresText) h += '<div class="sb-line"><b>Base item:</b> ' + esc(item.requiresText) + '</div>';
    if (item.bonusWeapon) h += '<div class="sb-line"><b>Bonus:</b> ' + esc(item.bonusWeapon) + ' to attack and damage rolls</div>';
    if (item.bonusWeaponAttack) h += '<div class="sb-line"><b>Attack bonus:</b> ' + esc(item.bonusWeaponAttack) + '</div>';
    if (item.bonusAc) h += '<div class="sb-line"><b>AC bonus:</b> ' + esc(item.bonusAc) + '</div>';
    // weapon / armor stat line
    const w = item.dmg1 || (base && base.dmg1);
    if (w) {
      const dmg2 = item.dmg2 || (base && base.dmg2);
      const dtype = item.dmgType || (base && base.dmgType);
      h += '<div class="sb-line"><b>Damage:</b> ' + esc(w) + (dmg2 ? ' (' + esc(dmg2) + ' versatile)' : '') + (dtype ? ' ' + esc(dtype) : '') + '</div>';
      if (item.range || (base && base.range)) {
        const rg = item.range || base.range;
        h += '<div class="sb-line"><b>Range:</b> ' + esc(rg) + '</div>';
      }
      const props = item.property || (base && base.property);
      if (props && props.length) h += '<div class="sb-line"><b>Properties:</b> ' + props.map(p => propLabel(p)).join(', ') + '</div>';
    }
    if (item.ac || (base && base.ac)) {
      const ac = item.ac || base.ac;
      h += '<div class="sb-line"><b>Armor Class:</b> ' + esc(ac) + (item.strength ? ' · Str ' + item.strength : '') + (item.stealth ? ' · Stealth disadvantage' : '') + '</div>';
    }
    if (item.weight || (base && base.weight) || item.value != null || (base && base.value != null)) {
      const wt = item.weight != null ? item.weight : (base && base.weight);
      const val = item.value != null ? item.value : ((!item.rarity || item.rarity === 'none' || item.rarity === 'mundane') && base ? base.value : null);
      h += '<div class="sb-line"><b>Weight:</b> ' + (wt != null ? esc(wt) + ' lb.' : '—') + ' · <b>Value:</b> ' + (val != null ? gpText(val) : '—') + '</div>';
    }
    if (item.charges) h += '<div class="sb-line"><b>Charges:</b> ' + esc(item.charges) + (item.recharge ? ' (' + esc(item.recharge) + ')' : '') + '</div>';
    h += '<hr class="sb-rule thin">';
    if (base && base.entries) h += R.entries(fillItemTokens(base.entries, item));
    h += R.entries(fillItemTokens(item.entries || [], item));
    if (item.additionalEntries) h += R.entries(fillItemTokens(item.additionalEntries, item));
    if (base && base.additionalEntries) h += R.entries(fillItemTokens(base.additionalEntries, item));
    if (item.curse) h += '<div class="inset-box" style="border-color:rgba(189,42,53,.3)"><div class="inset-title" style="color:#e08d8d">Curse</div>' + R.entries(fillItemTokens(item.curse, item)) + '</div>';
    if (item.attachedSpells && item.attachedSpells.length) {
      h += '<div class="sb-line"><b>Spells:</b> ' + item.attachedSpells.map(s => ref('spell', cleanSpell(s), cleanSpell(s))).join(', ') + '</div>';
    }
    h += '</div>';
    return h;
  };

  R.itemMeta = function (item) {
    const base = baseFor(item);
    const bits = [];
    if (item.rarity && item.rarity !== 'none') bits.push(String(item.rarity));
    bits.push(itemTypeLabel(item, base));
    if (item.reqAttune) bits.push('attunement');
    return bits.filter(Boolean).join(' · ');
  };

  function itemTypeLabel(item, base) {
    let t = item.type || (base && base.type) || '';
    if (item.weaponCategory) t = (item.weaponCategory === 'martial' ? 'Martial' : 'Simple') + ' ' + (item.weaponCategory === 'martial' || item.weaponCategory === 'simple' ? 'Weapon' : '');
    else if (t) t = U.ITEM_TYPES[t] || t;
    if ((item.type === 'M' || item.type === 'R') && item.weaponCategory) t = item.weaponCategory.charAt(0).toUpperCase() + item.weaponCategory.slice(1) + ' Weapon';
    return t;
  }
  R.itemTypeLabel = itemTypeLabel;

  function propLabel(code) {
    return ({ '2H': 'Two-Handed', V: 'Versatile', L: 'Light', F: 'Finesse', T: 'Thrown', H: 'Heavy', R: 'Reach', A: 'Ammunition', LD: 'Loading', S: 'Special', AF: 'Ammunition', BF: 'Burst Fire', RL: 'Reload', CE: 'Special' })[code] || code;
  }

  function gpText(cp) {
    if (cp == null) return '—';
    if (cp >= 100) return (cp / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' gp';
    if (cp >= 10) return (cp / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' sp';
    return cp + ' cp';
  }
  R.gpText = gpText;

  // ---------------------------------------------------------------- simple summary
  R.summary = function (obj) {
    // create a plain-text summary for search
    function walk(node, out) {
      if (node == null) return out;
      if (typeof node === 'string') { out.push(node.replace(/\{@[^}]*\}/g, m => m.replace(/^\{@\w+\s*/, '').split('|')[0]).replace(/\{\{[^}]*\}\}/g, '').replace(/\{=[^}]*\}/g, '')); return out; }
      if (Array.isArray(node)) { node.forEach(n => walk(n, out)); return out; }
      if (typeof node === 'object') {
        if (node.name) out.push(node.name);
        if (node.entries) walk(node.entries, out);
        if (node.items) walk(node.items, out);
        if (node.rows) walk(node.rows, out);
        if (node.colLabels) walk(node.colLabels, out);
      }
      return out;
    }
    return walk(obj, []).join(' ').replace(/\s+/g, ' ').slice(0, 2000);
  };
})();
