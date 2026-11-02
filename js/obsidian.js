/* Obsidian vault import: Markdown files -> campaign notes */
(function () {
  'use strict';
  const U = DM.U;
  const O = {};
  DM.obsidian = O;

  function stripFrontmatter(text) {
    return String(text || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  }

  function parseMarkdown(text, fileName, relativePath, updated) {
    let raw = stripFrontmatter(text).replace(/\r\n/g, '\n');
    raw = raw.replace(/%%[\s\S]*?%%/g, '');
    raw = raw.replace(/!\[\[[^\]]*\]\]/g, '');
    raw = raw.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]/g, '$2');
    raw = raw.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]/g, '$1');

    const tags = [];
    const bodyLines = [];
    raw.split('\n').forEach(line => {
      if (/^\s*(#[A-Za-z][\w/-]*\s*)+$/.test(line)) {
        (line.match(/#([A-Za-z][\w/-]*)/g) || []).forEach(t => {
          const tag = t.slice(1);
          if (!tags.includes(tag)) tags.push(tag);
        });
      } else bodyLines.push(line);
    });
    raw = bodyLines.join('\n');

    raw = raw.replace(/^[ \t]*>[ \t]*\[!([^\]]+)\][ \t]*/gm, '> **$1**  ');
    raw = raw.replace(/^[ \t]*>[ \t]*>[ \t]?/gm, '> ');
    raw = raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    let title = String(fileName || 'Untitled').replace(/\.(md|markdown)$/i, '');
    const h1 = /^#\s+(.+?)\s*$/m.exec(raw);
    if (h1) {
      title = h1[1].trim();
      raw = raw.slice(0, h1.index) + raw.slice(h1.index + h1[0].length);
      raw = raw.replace(/^\n+/, '');
    }

    const rel = String(relativePath || fileName || title);
    const segs = rel.split(/[\\/]/);
    const knownCat = segs.find(s => ['Sessions', 'Adventurers', 'NPCs', 'Locations', 'Items', 'Monsters'].includes(s));
    const category = knownCat || 'Campaign';
    const archiveId = 'obsidian:' + rel.toLowerCase().replace(/[\\/]+/g, '-').replace(/[^a-z0-9.\-]+/g, '-').replace(/^-+|-+$/g, '');
    const ts = updated || Date.now();

    return {
      id: archiveId,
      archiveId,
      title: title || 'Untitled note',
      body: raw,
      category,
      tags,
      path: rel,
      pinned: false,
      source: 'obsidian',
      created: ts,
      updated: ts
    };
  }
  O.parseMarkdown = parseMarkdown;

  function fileToNote(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(parseMarkdown(String(reader.result || ''), file.name, file.webkitRelativePath || file.name, file.lastModified)); }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(reader.error || new Error('Could not read ' + file.name));
      reader.readAsText(file);
    });
  }
  O.fileToNote = fileToNote;

  O.pickFolder = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.accept = '.md,.markdown,text/markdown';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []).filter(f => /\.(md|markdown)$/i.test(f.name));
      input.remove();
      if (!files.length) return;
      DM.ui.toast('Reading ' + files.length + ' Markdown files…');
      const parsed = [];
      for (const f of files) {
        try { parsed.push(await fileToNote(f)); } catch (e) { console.warn(e); }
      }
      const added = DM.store.importNotes(parsed);
      DM.ui.toast('Imported <b>' + added + '</b> new note' + (added === 1 ? '' : 's') + ' from Obsidian' + (added < parsed.length ? ' (' + (parsed.length - added) + ' already present)' : '') + '.');
      if (DM.currentView === 'notes') DM.views.notes.rerender();
      DM.ui.renderNav();
    });
    input.click();
  };
})();
