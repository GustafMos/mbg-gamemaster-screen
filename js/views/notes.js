/* Campaign notes with a light markdown preview */
(function () {
  'use strict';
  const U = DM.U, el = U.el, S = DM.store, UI = DM.ui;
  const V = {};
  DM.views = DM.views || {};
  DM.views.notes = V;

  V.selected = null;
  V.preview = false;
  V.query = '';
  V.category = 'all';

  V.render = function () {
    const st = S.state;
    if (!st.notes.length) { V.selected = null; }
    else if (!V.selected || !st.notes.find(n => n.id === V.selected)) {
      const preferred = st.notes.find(n => n.pinned && /^Current State/i.test(n.title)) ||
        st.notes.find(n => n.pinned) || st.notes[0];
      V.selected = preferred.id;
    }
    const root = el('div.view.notes-view');
    root.appendChild(el('div.page-head', {}, [
      el('div', {}, [
        el('div.eyebrow', { text: 'Campaign journal' }),
        el('h1', { text: 'Notes & secrets' }),
        el('p', { text: 'Your Obsidian archive, current campaign state, prep and session logs. Markdown-ish formatting, autosaved, searchable from the global palette.' })
      ]),
      el('div.head-actions', {}, [
        (() => { const b = el('button.btn.sm', {}, [U.svg('upload'), el('span', { text: 'Import Obsidian' })]); b.title = 'Import a folder of Markdown notes'; b.addEventListener('click', () => DM.obsidian.pickFolder()); return b; })(),
        (() => { const b = el('button.btn.primary', {}, [U.svg('plus'), el('span', { text: 'New note' })]); b.addEventListener('click', () => V.newNote()); return b; })()
      ])
    ]));

    if (!st.notes.length) {
      root.appendChild(el('div.empty', {}, [
        el('div.em-icon', { text: '📜' }),
        el('h3', { text: 'The page is blank' }),
        el('p', { text: 'Write down what the party did, who they angered, and which of Strahd’s spies is following them. You can also import an Obsidian folder.' }),
        (() => { const b = el('button.btn.primary', { text: 'Write the first note' }); b.addEventListener('click', () => V.newNote()); return b; })()
      ]));
      return root;
    }

    // category chips
    const cats = Array.from(new Set(st.notes.map(n => n.category || 'Campaign')));
    const order = ['Campaign', 'Sessions', 'Adventurers', 'NPCs', 'Locations', 'Items', 'Monsters'];
    cats.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    const catRow = el('div.kind-tabs', { style: { marginBottom: '12px' } });
    const addCat = (id, label, count) => {
      const b = el('button.kind-tab' + (V.category === id ? '.on' : ''), { text: label + (count != null ? ' ' + count : '') });
      b.addEventListener('click', () => { V.category = id; V.rerender(); });
      catRow.appendChild(b);
    };
    addCat('all', 'All', st.notes.length);
    cats.forEach(c => addCat(c, c, st.notes.filter(n => (n.category || 'Campaign') === c).length));
    root.appendChild(catRow);

    const layout = el('div.notes-layout');

    // list
    const listPanel = el('div.panel');
    const listHead = el('div.panel-head', {}, [
      el('div.search-field', { style: { flex: '1' } }, [
        U.svg('search'),
        (() => {
          const inp = el('input', { type: 'search', placeholder: 'Filter notes…', value: V.query });
          inp.addEventListener('input', U.debounce(() => { V.query = inp.value; paintList(); }, 100));
          return inp;
        })()
      ])
    ]);
    listPanel.appendChild(listHead);
    const listEl = el('div.note-list');
    listPanel.appendChild(listEl);
    layout.appendChild(listPanel);

    // editor
    const editorPanel = el('div.panel.note-editor');
    const selected = st.notes.find(n => n.id === V.selected) || st.notes[0];
    if (V._lastSelected !== selected.id) {
      V.preview = !!selected.archiveId;
      V._lastSelected = selected.id;
    }
    const toolbar = el('div.note-toolbar');
    const titleInput = el('input', { type: 'text', value: selected.title, placeholder: 'Note title', style: { flex: '1', fontSize: '18px', fontFamily: 'var(--serif)', fontWeight: '700', border: '0', background: 'transparent', padding: '4px 0' } });
    toolbar.appendChild(titleInput);
    const pinBtn = el('button.icon-btn.sm', { title: selected.pinned ? 'Unpin' : 'Pin to dashboard', html: '<svg><use href="#i-star"/></svg>' });
    pinBtn.style.color = selected.pinned ? 'var(--gold)' : '';
    toolbar.appendChild(pinBtn);
    const previewBtn = el('button.icon-btn.sm', { title: 'Preview', html: '<svg><use href="#i-book"/></svg>' });
    toolbar.appendChild(previewBtn);
    const delBtn = el('button.icon-btn.sm', { title: 'Delete note', html: '<svg><use href="#i-trash"/></svg>' });
    toolbar.appendChild(delBtn);
    editorPanel.appendChild(toolbar);

    const metaRow = el('div.row.wrap', { style: { gap: '4px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--line)' } }, [
      el('span.tag.gold', { text: selected.category || 'Campaign' }),
      ...(selected.tags || []).slice(0, 6).map(t => el('span.tag', { text: '#' + t })),
      selected.path ? el('span.tiny-text.dim', { style: { marginLeft: 'auto' }, text: selected.path }) : (selected.archiveId ? el('span.tiny-text.dim', { style: { marginLeft: 'auto' }, text: 'Obsidian archive' }) : null)
    ]);
    editorPanel.appendChild(metaRow);

    const bodyWrap = el('div');
    const textarea = el('textarea', { placeholder: '## Session notes\n\n- The party met **Strahd** at the crossroads…' });
    textarea.value = selected.body || '';
    bodyWrap.appendChild(textarea);
    const preview = el('div.note-body-preview');
    bodyWrap.appendChild(preview);
    editorPanel.appendChild(bodyWrap);
    const foot = el('div.row', { style: { marginTop: '10px', justifyContent: 'space-between' } }, [
      el('span.small.dim', { id: 'noteWordCount', text: wordCount(selected.body) }),
      el('span.small.dim', { text: 'Saved automatically · edits are local to this browser' })
    ]);
    editorPanel.appendChild(foot);
    layout.appendChild(editorPanel);
    root.appendChild(layout);

    function showMode() {
      textarea.style.display = V.preview ? 'none' : '';
      preview.style.display = V.preview ? '' : 'none';
      previewBtn.title = V.preview ? 'Edit note' : 'Preview';
      if (V.preview) preview.innerHTML = md(selected.body || '');
      previewBtn.style.color = V.preview ? 'var(--gold)' : '';
    }
    showMode();

    const save = U.debounce(() => {
      S.updateNote(selected.id, { title: titleInput.value || 'Untitled note', body: textarea.value });
      const wc = document.getElementById('noteWordCount');
      if (wc) wc.textContent = wordCount(textarea.value);
      paintList();
    }, 380);

    titleInput.addEventListener('input', save);
    textarea.addEventListener('input', save);
    titleInput.addEventListener('change', () => { S.updateNote(selected.id, { title: titleInput.value || 'Untitled note' }); paintList(); });

    pinBtn.addEventListener('click', () => {
      S.updateNote(selected.id, { pinned: !selected.pinned });
      pinBtn.style.color = selected.pinned ? 'var(--gold)' : '';
      pinBtn.title = selected.pinned ? 'Unpin' : 'Pin to dashboard';
      paintList();
    });
    previewBtn.addEventListener('click', () => { V.preview = !V.preview; showMode(); });
    delBtn.addEventListener('click', async () => {
      if (await UI.confirm({ title: 'Delete note?', message: '“' + selected.title + '” will be gone. This cannot be undone.', confirm: 'Delete', danger: true })) {
        S.deleteNote(selected.id);
        V.selected = null;
        const main = document.getElementById('main');
        if (main) { main.innerHTML = ''; main.appendChild(V.render()); }
        UI.closeDrawer();
      }
    });

    function paintList() {
      listEl.innerHTML = '';
      const q = V.query.trim().toLowerCase();
      const list = S.state.notes.filter(n => (V.category === 'all' || (n.category || 'Campaign') === V.category) && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q)))
        .slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
      if (!list.length) { listEl.innerHTML = '<div class="pal-empty">No notes match.</div>'; return; }
      list.forEach(n => {
        const item = el('div.note-item' + (n.id === V.selected ? '.active' : ''), {}, [
          el('div.nt', {}, [n.pinned ? '★ ' : '', n.title || 'Untitled']),
          el('div.nd', { text: (n.body || '').replace(/[#*_>`]/g, '').slice(0, 70) || 'Empty' }),
          el('div.row', { style: { gap: '4px', marginTop: '3px', alignItems: 'center' } }, [
            el('span.tiny-text.dim', { text: n.category || 'Campaign' }),
            ...(n.tags || []).slice(0, 2).map(t => el('span.tiny-text.dim', { text: '#' + t })),
            el('span.tiny-text.dim', { style: { marginLeft: 'auto' }, text: U.fmtRelative(n.updated) })
          ])
        ]);
        item.addEventListener('click', () => { V.open(n.id); });
        listEl.appendChild(item);
      });
    }
    paintList();
    return root;
  };

  V.rerender = function () {
    if (DM.currentView !== 'notes') return;
    const main = document.getElementById('main');
    const scroll = main.scrollTop;
    main.innerHTML = '';
    main.appendChild(V.render());
    main.scrollTop = scroll;
  };

  V.newNote = function () {
    const n = S.addNote({ title: 'Session notes', body: '', category: V.category === 'all' ? 'Campaign' : V.category, tags: [] });
    V.selected = n.id;
    DM.navigate('notes');
    setTimeout(() => { const i = document.querySelector('.note-editor input'); if (i) { i.focus(); i.select(); } }, 80);
  };

  V.open = function (id) {
    const n = S.state.notes.find(x => x.id === id);
    if (n && V.category !== 'all' && (n.category || 'Campaign') !== V.category) V.category = 'all';
    V.selected = id;
    if (DM.currentView !== 'notes') DM.navigate('notes');
    else V.rerender();
  };

  function wordCount(text) {
    const n = (String(text || '').trim().match(/\S+/g) || []).length;
    return n + ' word' + (n === 1 ? '' : 's');
  }

  // Small, safe markdown subset.
  function md(text) {
    const esc = U.esc;
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    let out = '', inList = false, inQuote = false, inCode = false;
    const closeList = () => { if (inList) { out += '</ul>'; inList = false; } };
    const closeQuote = () => { if (inQuote) { out += '</blockquote>'; inQuote = false; } };
    for (let line of lines) {
      if (/^```/.test(line)) {
        if (inCode) { out += '</code></pre>'; inCode = false; }
        else { closeList(); closeQuote(); out += '<pre><code>'; inCode = true; }
        continue;
      }
      if (inCode) { out += esc(line) + '\n'; continue; }
      if (/^\s*$/.test(line)) { closeList(); closeQuote(); continue; }
      if (/^###\s+/.test(line)) { closeList(); closeQuote(); out += '<h3>' + inline(line.replace(/^###\s+/, '')) + '</h3>'; continue; }
      if (/^##\s+/.test(line)) { closeList(); closeQuote(); out += '<h2>' + inline(line.replace(/^##\s+/, '')) + '</h2>'; continue; }
      if (/^#\s+/.test(line)) { closeList(); closeQuote(); out += '<h2>' + inline(line.replace(/^#\s+/, '')) + '</h2>'; continue; }
      if (/^&gt;\s?/.test(esc(line)) || /^>\s?/.test(line)) { closeList(); if (!inQuote) { out += '<blockquote>'; inQuote = true; } out += '<p>' + inline(line.replace(/^>\s?/, '')) + '</p>'; continue; }
      if (/^\s*[-*]\s+/.test(line)) { closeQuote(); if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>'; continue; }
      if (/^\s*\d+\.\s+/.test(line)) { closeQuote(); if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + inline(line.replace(/^\s*\d+\.\s+/, '')) + '</li>'; continue; }
      if (/^---+$/.test(line.trim())) { closeList(); closeQuote(); out += '<hr>'; continue; }
      closeList(); closeQuote();
      out += '<p>' + inline(line) + '</p>';
    }
    if (inList) out += '</ul>';
    if (inQuote) out += '</blockquote>';
    if (inCode) out += '</code></pre>';
    return out;
  }

  function inline(s) {
    let out = U.esc(s);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
  }
})();
