/* Gogo Guardians family comments.
   Comments are saved in a Google Sheet through a small Google Apps Script web app.
   ENDPOINT is the web app link (ends in /exec). Until it is set, the old note form is used. */
(function () {
  var ENDPOINT = '';
  var KEY = 'emerald';
  var FALLBACK = 'https://form.jotform.com/263087088389069';
  try { var t = localStorage.getItem('gg_endpoint'); if (t) ENDPOINT = t; } catch (e) {}

  var path = location.pathname;
  var PAGE = /^\/(read|book)/.test(path) ? 'read' : /^\/play/.test(path) ? 'play' : 'home';
  var ALL = {};            // spot -> [comments]
  var loaded = false, listeners = [];

  /* ---------- styles ---------- */
  var css = '' +
  '.ggc-box{font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#efe6cf;background:#10163c;border:1.5px solid #b9862c;border-radius:14px;padding:14px 14px 12px;margin:10px 0 18px;text-align:left;text-indent:0;box-shadow:0 8px 24px #0007}' +
  '.ggc-box h5{margin:0 0 8px;font:700 13px/1.3 Georgia,serif;letter-spacing:.08em;text-transform:uppercase;color:#f0c96a}' +
  '.ggc-box p{text-indent:0!important}.ggc-box .q{font-style:italic;color:#c9bf9f;margin:-2px 0 10px;font-size:14px}' +
  '.ggc-list{display:grid;gap:8px;margin:0 0 10px}' +
  '.ggc-c{background:#1a2152;border-radius:10px;padding:8px 11px}' +
  '.ggc-c b{color:#f0c96a;font-weight:700}.ggc-c time{color:#9aa0bf;font-size:12px;margin-left:6px}' +
  '.ggc-c p{margin:3px 0 0!important;text-indent:0!important;font-size:15px!important;line-height:1.45!important;white-space:pre-wrap;color:#efe6cf}' +
  '.ggc-empty{color:#a9adc6;font-size:14px;margin:0 0 10px}' +
  '.ggc-form{display:grid;gap:8px}' +
  '.ggc-form input,.ggc-form textarea{font:16px system-ui,sans-serif;color:#fff6dc;background:#0a0f2a;border:1px solid #4a5290;border-radius:9px;padding:9px 11px;width:100%;box-sizing:border-box}' +
  '.ggc-form textarea{min-height:76px;resize:vertical}' +
  '.ggc-form input:focus,.ggc-form textarea:focus{outline:2px solid #e6bd62;outline-offset:1px}' +
  '.ggc-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
  '.ggc-post{font:800 15px system-ui,sans-serif;color:#1e1202;background:linear-gradient(#f3cf78,#a86e1e);border:0;border-radius:999px;padding:9px 20px;cursor:pointer}' +
  '.ggc-post:disabled{opacity:.6;cursor:wait}' +
  '.ggc-x{font:600 14px system-ui,sans-serif;color:#d9cfae;background:none;border:1px solid #4a5290;border-radius:999px;padding:8px 14px;cursor:pointer}' +
  '.ggc-msg{font-size:13px;color:#ffb3bd}.ggc-msg.ok{color:#9be0b0}' +
  '.ggc-btn{font:700 13px system-ui,sans-serif;color:#7a5214;background:#fff8e8;border:1px solid #d9b97a;border-radius:999px;padding:6px 13px;margin-top:8px;cursor:pointer;text-indent:0}' +
  '.ggc-btn:hover,.ggc-btn:focus-visible{background:#f6e7c4;outline:none}' +
  '.ggc-btn.dark{color:#f6d27a;background:#141a46;border-color:#b9862c}' +
  '.ggc-n{display:inline-block;min-width:18px;margin-left:6px;padding:0 6px;border-radius:999px;background:#b9862c;color:#1e1202;font-size:12px;line-height:18px;text-align:center}' +
  '.ggc-chip{display:inline-flex;align-items:center;gap:3px;margin-left:6px;vertical-align:2px;font:700 12px system-ui,sans-serif;color:#7a5214;background:#f6e7c4;border:1px solid #d9b97a;border-radius:999px;padding:1px 8px;cursor:pointer;text-indent:0}' +
  '.ggc-pen{position:absolute;left:-36px;top:2px;width:28px;height:28px;padding:0;border-radius:50%;border:1px solid #d9b97a;background:#fff8e8;color:#7a5214;font:700 14px system-ui,sans-serif;cursor:pointer;opacity:0;transition:opacity .15s;text-indent:0}' +
  '.chap p:hover>.ggc-pen,.ggc-pen:focus-visible{opacity:1}' +
  '@media (max-width:820px){.ggc-pen{display:none}}' +
  '#ggc-sel{position:absolute;z-index:70;background:#7a5214;color:#fff8e6;border:0;border-radius:999px;padding:9px 15px;font:700 14px system-ui,sans-serif;box-shadow:0 6px 18px #0006;cursor:pointer}' +
  '.ggc-fab{position:fixed;left:max(12px,env(safe-area-inset-left,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:60;font:800 14px system-ui,sans-serif;color:#1e1202;background:linear-gradient(#f3cf78,#a86e1e);padding:10px 15px;border-radius:999px;border:0;cursor:pointer;box-shadow:0 4px 14px #000a}' +
  '.ggc-drawer{position:fixed;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:61;max-width:440px;max-height:min(78vh,620px);overflow:auto}' +
  '.ggc-drawer .ggc-box{margin:0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- helpers ---------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function myName() { try { return localStorage.getItem('gg_name') || ''; } catch (e) { return ''; } }
  function when(t) {
    var d = new Date(t); if (isNaN(d)) return '';
    var s = (Date.now() - d) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function count(spot) { return (ALL[spot] || []).length; }
  function onLoad(fn) { if (loaded) fn(); else listeners.push(fn); }

  function load() {
    fetch(ENDPOINT + '?page=' + PAGE, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        ALL = {};
        (rows || []).forEach(function (c) { (ALL[c.spot] = ALL[c.spot] || []).push(c); });
        Object.keys(ALL).forEach(function (k) { ALL[k].sort(function (a, b) { return a.t - b.t; }); });
      })
      .catch(function () {})
      .then(function () { loaded = true; listeners.splice(0).forEach(function (f) { f(); }); });
  }

  function send(c) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: KEY, page: PAGE, spot: c.spot, where: c.where, name: c.name, text: c.text, quote: c.quote || '' })
    }).then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error('not saved'); return j; });
  }

  /* ---------- the comment box ---------- */
  var openBox = null;
  function renderList(list, spot) {
    list.innerHTML = '';
    var cs = ALL[spot] || [];
    if (!cs.length) { list.appendChild(el('p', 'ggc-empty', loaded ? 'No notes here yet. Be the first.' : 'Loading notes...')); return; }
    cs.forEach(function (c) {
      var d = el('div', 'ggc-c');
      d.appendChild(el('b', '', c.name || 'Family'));
      var tm = el('time', '', when(c.t)); d.appendChild(tm);
      d.appendChild(el('p', '', c.text));
      list.appendChild(d);
    });
  }

  function makeBox(o, onClose) {
    var box = el('div', 'ggc-box'); box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Notes on ' + o.where);
    box.appendChild(el('h5', '', 'Notes on ' + o.where));
    if (o.quote) box.appendChild(el('p', 'q', '“' + o.quote.slice(0, 160) + (o.quote.length > 160 ? '...' : '') + '”'));
    var list = el('div', 'ggc-list'); box.appendChild(list); renderList(list, o.spot);
    onLoad(function () { renderList(list, o.spot); });
    var f = el('form', 'ggc-form'); f.setAttribute('autocomplete', 'off');
    var nm = el('input'); nm.placeholder = 'Your name'; nm.maxLength = 40; nm.value = myName(); nm.setAttribute('aria-label', 'Your name');
    var tx = el('textarea'); tx.placeholder = 'What do you think? Funny, confusing, too long, your favorite part...'; tx.maxLength = 2000; tx.setAttribute('aria-label', 'Your note');
    var row = el('div', 'ggc-row');
    var post = el('button', 'ggc-post', 'Post note'); post.type = 'submit';
    var x = el('button', 'ggc-x', 'Close'); x.type = 'button';
    var msg = el('span', 'ggc-msg'); msg.setAttribute('aria-live', 'polite');
    row.appendChild(post); row.appendChild(x); row.appendChild(msg);
    f.appendChild(nm); f.appendChild(tx); f.appendChild(row); box.appendChild(f);
    x.onclick = function () { onClose(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      var name = nm.value.trim(), text = tx.value.trim();
      if (!name) { msg.className = 'ggc-msg'; msg.textContent = 'Please add your name.'; nm.focus(); return; }
      if (!text) { msg.className = 'ggc-msg'; msg.textContent = 'Write a note first.'; tx.focus(); return; }
      try { localStorage.setItem('gg_name', name); } catch (er) {}
      post.disabled = true; msg.className = 'ggc-msg'; msg.textContent = 'Saving...';
      var c = { spot: o.spot, where: o.where, name: name, text: text, quote: o.quote };
      send(c).then(function () {
        c.t = Date.now(); (ALL[o.spot] = ALL[o.spot] || []).push(c);
        renderList(list, o.spot); tx.value = ''; msg.className = 'ggc-msg ok'; msg.textContent = 'Saved. Thank you!';
        refreshCounts();
      }).catch(function () {
        msg.className = 'ggc-msg'; msg.textContent = 'Could not save. Check your internet and try again.';
      }).then(function () { post.disabled = false; });
    };
    setTimeout(function () { (nm.value ? tx : nm).focus({ preventScroll: true }); }, 30);
    return box;
  }

  // inline: the box opens right under the spot
  function openInline(after, o) {
    if (!ENDPOINT) { window.open(FALLBACK, '_blank', 'noopener'); return; }
    if (openBox && openBox.spot === o.spot) { closeInline(); return; }
    closeInline();
    var box = makeBox(o, closeInline);
    after.insertAdjacentElement('afterend', box);
    openBox = { spot: o.spot, el: box };
    var r = box.getBoundingClientRect();
    if (r.bottom > innerHeight || r.top < 60) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function closeInline() { if (openBox) { openBox.el.remove(); openBox = null; } }

  // drawer: a floating panel (home page and game)
  var drawer = null;
  function openDrawer(o) {
    if (!ENDPOINT) { window.open(FALLBACK, '_blank', 'noopener'); return; }
    closeDrawer();
    drawer = el('div', 'ggc-drawer');
    drawer.appendChild(makeBox(o, closeDrawer));
    document.body.appendChild(drawer);
  }
  function closeDrawer() { if (drawer) { drawer.remove(); drawer = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); closeInline(); } });

  /* ---------- counts on buttons ---------- */
  var counted = []; // {btn, spot, kind}
  function setCount(btn, n) {
    var b = btn.querySelector('.ggc-n');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = el('span', 'ggc-n'); btn.appendChild(b); }
    b.textContent = n;
  }
  function refreshCounts() {
    counted.forEach(function (c) {
      var n = count(c.spot);
      if (c.kind === 'chip') {
        if (n) { c.btn.hidden = false; c.btn.textContent = '💬 ' + n; } else c.btn.hidden = true;
      } else setCount(c.btn, n);
    });
  }

  window.GGC = { open: openDrawer, inline: openInline, page: PAGE, on: !!ENDPOINT };

  /* ---------- reading copy ---------- */
  function setupRead() {
    var book = document.getElementById('book');
    // cover
    var cover = document.querySelector('a.cover');
    if (cover) {
      var cb = el('button', 'ggc-btn dark', '💬 Comment on the cover'); cb.type = 'button';
      var wrap = el('div'); wrap.style.cssText = 'max-width:760px;margin:6px auto 0;text-align:center';
      wrap.appendChild(cb); cover.insertAdjacentElement('afterend', wrap);
      cb.onclick = function () { openInline(wrap, { spot: 'cover', where: 'the cover' }); };
      counted.push({ btn: cb, spot: 'cover' });
    }
    // chapter names
    function chapName(sec) {
      var l = sec.querySelector('.ch-label'), t = sec.querySelector('.ch-title');
      var a = (l && l.textContent.trim()) || '', b = (t && t.textContent.trim()) || '';
      if (/^Chapter/.test(a)) return a; if (sec.id === 'preface') return 'the Preface';
      if (sec.id === 'prologue') return 'the Prologue'; if (sec.classList.contains('ded')) return 'the dedication';
      return b || a || 'the book';
    }
    // pictures
    document.querySelectorAll('figure.pic').forEach(function (fig) {
      var old = fig.querySelector('.picbtn'); if (old) old.remove();
      var sec = fig.closest('section'); var n = (fig.id || '').replace('pic-', '');
      var spot = fig.id || ('pic-' + Math.random());
      var b = el('button', 'ggc-btn', '💬 Comment on this picture'); b.type = 'button';
      fig.appendChild(b);
      var where = 'picture ' + n + (sec ? ' (' + chapName(sec) + ')' : '');
      b.onclick = function () { openInline(fig, { spot: spot, where: where }); };
      counted.push({ btn: b, spot: spot });
    });
    // paragraphs + end-of-chapter button
    document.querySelectorAll('section.chap').forEach(function (sec) {
      var sid = sec.id || 'dedication';
      var ps = sec.querySelectorAll(':scope > p:not(.orn)');
      ps.forEach(function (p, i) {
        var spot = sid + '/p' + (i + 1);
        var where = chapName(sec) + ', paragraph ' + (i + 1);
        var quote = p.textContent.trim();
        var o = { spot: spot, where: where, quote: quote };
        var pen = el('button', 'ggc-pen', '✎'); pen.type = 'button';
        pen.title = 'Comment on this paragraph'; pen.setAttribute('aria-label', 'Comment on this paragraph');
        pen.onclick = function () { openInline(p, o); };
        p.insertBefore(pen, p.firstChild);
        var chip = el('button', 'ggc-chip'); chip.type = 'button'; chip.hidden = true;
        chip.setAttribute('aria-label', 'See notes on this paragraph');
        chip.onclick = function () { openInline(p, o); };
        p.appendChild(chip);
        counted.push({ btn: chip, spot: spot, kind: 'chip' });
      });
      var cb = el('button', 'ggc-btn', '💬 Comment on ' + chapName(sec).replace(/^the /, 'the ')); cb.type = 'button';
      var w = el('div'); w.style.cssText = 'text-align:center;margin:8px 0 0';
      w.appendChild(cb); sec.appendChild(w);
      cb.onclick = function () { openInline(w, { spot: sid, where: chapName(sec) }); };
      counted.push({ btn: cb, spot: sid });
    });
    // select words -> Comment
    var sb = el('button', '', '💬 Comment'); sb.id = 'ggc-sel'; sb.type = 'button'; sb.hidden = true;
    document.body.appendChild(sb);
    var selO = null;
    function place() {
      var s = getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) { sb.hidden = true; return; }
      var r = s.getRangeAt(0), node = r.commonAncestorContainer;
      if (!book.contains(node)) { sb.hidden = true; return; }
      var p = (node.nodeType === 1 ? node : node.parentNode).closest('p'); var sec = (p || node.parentNode).closest('section');
      if (!p || !sec) { sb.hidden = true; return; }
      var ps = [].slice.call(sec.querySelectorAll(':scope > p:not(.orn)')); var i = ps.indexOf(p);
      selO = { p: p, spot: (sec.id || 'dedication') + '/p' + (i + 1), where: chapName(sec) + ', paragraph ' + (i + 1), quote: s.toString().trim() };
      var rc = r.getBoundingClientRect();
      sb.style.top = (rc.bottom + scrollY + 8) + 'px';
      sb.style.left = Math.max(8, Math.min(document.documentElement.clientWidth - 130, rc.left + scrollX + rc.width / 2 - 55)) + 'px';
      sb.hidden = false;
    }
    document.addEventListener('selectionchange', function () { clearTimeout(place.t); place.t = setTimeout(place, 250); });
    sb.addEventListener('mousedown', function (e) { e.preventDefault(); });
    sb.onclick = function () { if (selO) openInline(selO.p, selO); sb.hidden = true; };
  }

  /* ---------- home page and game: one floating button ---------- */
  function setupFab(spot, where) {
    var old = document.querySelector('a.note, a[href*="jotform"].ggc-replace'); if (old) old.remove();
    var b = el('button', 'ggc-fab', '💬 Comments'); b.type = 'button';
    b.onclick = function () { drawer ? closeDrawer() : openDrawer({ spot: spot, where: where }); };
    document.body.appendChild(b);
    counted.push({ btn: b, spot: spot });
  }

  function start() {
    if (!ENDPOINT) return;               // not switched on yet: keep the old note links
    if (PAGE === 'read') setupRead();
    else if (PAGE === 'play') setupFab('game', 'the game');
    else setupFab('home', 'the home page');
    if (PAGE === 'read') { document.querySelectorAll('a[href*="jotform"]').forEach(function (a) { a.remove(); }); var h = document.getElementById('howto'); if (h) h.innerHTML = '<b>Family preview.</b> Tap <b>\uD83D\uDCAC Comment</b> under the cover, any picture or the end of any chapter. You can also select any words and tap <b>Comment</b>. Your note shows right there, and everyone in the family can see it.'; }
    else document.querySelectorAll('a[href*="jotform"]').forEach(function (a) {
      a.removeAttribute('target'); a.innerHTML = '&#128172; Comments';
      a.href = '#';
      a.onclick = function (e) { e.preventDefault(); openDrawer(PAGE === 'play' ? { spot: 'game', where: 'the game' } : { spot: PAGE, where: 'this page' }); };
    });
    load(); onLoad(refreshCounts);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
