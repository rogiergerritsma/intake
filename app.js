(function () {
'use strict';

var FALLBACK = {
  naam: 'Bureau Wonen', plaats: '', accent: '#1f6b4f',
  ruimtes: ['Entree', 'Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Toilet', 'Zolder', 'Garage', 'Achtertuin', 'Voorgevel'],
  staat: ['Goed', 'Redelijk', 'Verouderd'],
  reden: ['Groter', 'Kleiner', 'Verhuizing werk', 'Scheiding', 'Erfenis', 'Senior', 'Anders'],
  timing: ['Zo snel mogelijk', 'Binnen 3 maanden', 'Na de zomer', 'Geen haast'],
  prijs: ['Dichtbij marktwaarde', 'Hoger verwacht', 'Onzeker'],
  bijzonderheden: ['Zonnepanelen', 'Overpad of recht van weg', 'Verbouwd', 'Erfpacht', 'VvE', 'Vochtplekken']
};
var OPHALEN = ['kadaster', 'bouwjaar', 'woonoppervlak', 'energielabel', 'woz'];

var CFG = FALLBACK, DB = null, MEM = { gesprekken: {}, fotos: {} };
var G = null, FOTOS = [], tab = 'start', cur = '', urls = {}, gen = null, busy = '';
var chipEls = {};

function $(s) { return document.querySelector(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function el(t, a, k) {
  var e = document.createElement(t);
  for (var i in (a || {})) {
    if (i === 'class') e.className = a[i];
    else if (i.slice(0, 2) === 'on') e.addEventListener(i.slice(2), a[i]);
    else if (a[i] !== false && a[i] != null) e.setAttribute(i, a[i]);
  }
  (k || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ---------- opslag: IndexedDB, met geheugen als noodoplossing ---------- */
function openDB() {
  return new Promise(function (res) {
    if (!window.indexedDB) return res(null);
    try {
      var r = indexedDB.open('rondgang', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore('gesprekken', { keyPath: 'id' });
        d.createObjectStore('fotos', { keyPath: 'id' }).createIndex('gesprek', 'gesprek');
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { res(null); };
    } catch (e) { res(null); }
  });
}
function tx(store, mode, fn) {
  return new Promise(function (res, rej) {
    var t = DB.transaction(store, mode), out = fn(t.objectStore(store));
    t.oncomplete = function () { res(out && out.result); };
    t.onerror = function () { rej(t.error); };
  });
}
function put(store, v) { if (!DB) { MEM[store][v.id] = v; return Promise.resolve(); } return tx(store, 'readwrite', function (s) { s.put(v); }); }
function allOf(store) { if (!DB) return Promise.resolve(Object.keys(MEM[store]).map(function (k) { return MEM[store][k]; })); return tx(store, 'readonly', function (s) { return s.getAll(); }); }
function fotosVan(id) { if (!DB) return allOf('fotos').then(function (a) { return a.filter(function (f) { return f.gesprek === id; }); }); return tx('fotos', 'readonly', function (s) { return s.index('gesprek').getAll(id); }); }
function del(store, id) { if (!DB) { delete MEM[store][id]; return Promise.resolve(); } return tx(store, 'readwrite', function (s) { s.delete(id); }); }
function delGesprek(id) { return fotosVan(id).then(function (fs) { return Promise.all(fs.map(function (f) { return del('fotos', f.id); })); }).then(function () { return del('gesprekken', id); }); }

var saveT;
function save() { gen = null; clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
function saveNow() { clearTimeout(saveT); if (G) { G.bijgewerkt = Date.now(); return put('gesprekken', G); } return Promise.resolve(); }

function nieuw() {
  return { id: uid(), gemaakt: Date.now(), bijgewerkt: Date.now(), adres: '', contact: '', reden: '', redenTekst: '',
    timing: '', prijs: '', prijsBedrag: '', bijz: [], opm: '', rooms: {}, nFotos: 0 };
}
function room(n) { return G.rooms[n] || (G.rooms[n] = { note: '', staat: '' }); }
function fotosIn(n) { return FOTOS.filter(function (f) { return f.ruimte === n; }); }
function urlOf(f) { return urls[f.id] || (urls[f.id] = URL.createObjectURL(f.blob)); }
function datum(t) { return new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }); }

/* ---------- kleine bouwstenen ---------- */
function chipGroup(opts, isOn, toggle, counts) {
  var box = el('div', { class: 'chips' });
  function paint() { [].forEach.call(box.children, function (b) { b.setAttribute('aria-pressed', isOn(b.dataset.v) ? 'true' : 'false'); }); }
  opts.forEach(function (o) {
    var n = el('span', { class: 'n' }, [counts ? counts(o) : '']);
    var b = el('button', { class: 'chip', type: 'button', 'data-v': o, 'aria-pressed': isOn(o) ? 'true' : 'false',
      onclick: function () { toggle(o); paint(); } }, [o, n]);
    if (counts) chipEls[o] = n;
    box.appendChild(b);
  });
  return box;
}
function toggleIn(arr, v) { var i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); }
function roomCount(n) { var r = G.rooms[n], c = fotosIn(n).length + (r && r.note ? 1 : 0); return c ? String(c) : ''; }
function refreshCounts() { Object.keys(chipEls).forEach(function (n) { chipEls[n].textContent = roomCount(n); }); }

function dictaat(ta) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var on = false, rec = null, msg = el('span', { class: 'hint', role: 'status' }, ['']);
  var btn = el('button', { class: 'btn small ghost', type: 'button', 'aria-pressed': 'false' }, ['Dicteer']);
  function stop() { on = false; btn.textContent = 'Dicteer'; btn.setAttribute('aria-pressed', 'false'); }
  btn.addEventListener('click', function () {
    if (on) { try { rec.stop(); } catch (e) {} return; }
    msg.textContent = '';
    try {
      rec = new SR(); rec.lang = 'nl-NL'; rec.continuous = true; rec.interimResults = false;
      rec.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) { ta.value = (ta.value ? ta.value + ' ' : '') + e.results[i][0].transcript.trim(); ta.dispatchEvent(new Event('input')); }
        }
      };
      rec.onerror = function (e) { msg.textContent = 'Dicteren lukt hier niet (' + (e.error || 'onbekend') + '). Gebruik de microfoon op je toetsenbord.'; };
      rec.onend = stop;
      rec.start(); on = true; btn.textContent = 'Stop'; btn.setAttribute('aria-pressed', 'true');
    } catch (e) { stop(); msg.textContent = 'Dicteren lukt hier niet. Gebruik de microfoon op je toetsenbord.'; }
  });
  return el('div', { class: 'row' }, [btn, msg]);
}

function shrink(file) {
  var make = function (bm) {
    var m = 1600, s = Math.min(1, m / Math.max(bm.width, bm.height)), w = Math.round(bm.width * s), h = Math.round(bm.height * s);
    var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bm, 0, 0, w, h);
    return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, w: w, h: h }); }, 'image/jpeg', 0.72); });
  };
  return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); }).then(make);
}

/* ---------- schermen ---------- */
function brand() {
  var l = [];
  if (CFG.logo) l.push(el('img', { src: CFG.logo, alt: CFG.naam }));
  l.push(el('span', { class: 'sub' }, [CFG.naam + (CFG.plaats ? ', ' + CFG.plaats : '')]));
  return el('div', { class: 'brand' }, l);
}

function home(app) {
  app.appendChild(el('header', {}, [el('h1', {}, ['Rondgang']), brand()]));
  var isIOS = /iPhone|iPad/.test(navigator.userAgent);
  if (isIOS && !navigator.standalone && lsGet('rondgang.hint') !== '1') {
    app.appendChild(el('div', { class: 'warn' }, [
      'Zet Rondgang op je beginscherm (deel-icoon, dan Zet op beginscherm). Zo bewaart je iPhone de gesprekken betrouwbaarder. ',
      el('button', { class: 'back', type: 'button', onclick: function () { lsSet('rondgang.hint', '1'); render(); } }, ['Begrepen'])]));
  }
  app.appendChild(el('button', { class: 'btn', type: 'button', id: 'nieuw', onclick: function () { G = nieuw(); FOTOS = []; tab = 'start'; cur = ''; gen = null; put('gesprekken', G); render(); } }, ['Nieuw gesprek']));
  var lijst = el('div', { class: 'list', id: 'lijst' });
  app.appendChild(lijst);
  allOf('gesprekken').then(function (a) {
    a.sort(function (x, y) { return y.bijgewerkt - x.bijgewerkt; });
    if (!a.length) { lijst.appendChild(el('p', { class: 'hint' }, ['Nog geen gesprekken. Alles wat je invult blijft op dit toestel.'])); return; }
    a.forEach(function (g) {
      var sure = false;
      var d = el('button', { class: 'btn small danger', type: 'button', 'aria-label': 'Verwijder gesprek' }, ['Verwijder']);
      d.addEventListener('click', function () {
        if (!sure) { sure = true; d.textContent = 'Zeker weten?'; return; }
        delGesprek(g.id).then(function () { render(); });
      });
      lijst.appendChild(el('div', { class: 'item' }, [
        el('button', { class: 'open', type: 'button', onclick: function () { openGesprek(g); } }, [
          el('b', {}, [g.adres || 'Zonder adres']),
          el('span', { class: 'hint' }, [datum(g.bijgewerkt) + ', ' + (g.nFotos || 0) + ' foto’s'])]),
        d]));
    });
  });
}

function openGesprek(g) {
  G = g; tab = 'start'; cur = ''; gen = null;
  fotosVan(g.id).then(function (fs) { FOTOS = fs; render(); });
}

function gesprekKop(app) {
  app.appendChild(el('button', { class: 'back', type: 'button', onclick: function () { saveNow().then(function () { G = null; render(); }); } }, ['‹ Gesprekken']));
  app.appendChild(el('header', {}, [el('h1', {}, ['Rondgang']), el('span', { class: 'sub' }, [G.adres || 'Nieuw gesprek'])]));
}

function vStart(app) {
  var adres = el('input', { type: 'text', id: 'adres', placeholder: 'Straat, nummer, plaats', autocomplete: 'off' }); adres.value = G.adres;
  adres.addEventListener('input', function () { G.adres = adres.value; var s = document.querySelector('header .sub'); if (s) s.textContent = G.adres || 'Nieuw gesprek'; save(); });
  var contact = el('input', { type: 'text', id: 'contact', placeholder: 'Naam verkoper', autocomplete: 'off' }); contact.value = G.contact;
  contact.addEventListener('input', function () { G.contact = contact.value; save(); });
  var rt = el('textarea', { id: 'redentekst', placeholder: 'Waarom verkopen ze? Typ, of dicteer.' }); rt.value = G.redenTekst || '';
  rt.addEventListener('input', function () { G.redenTekst = rt.value; save(); });
  var rc = chipGroup(CFG.reden, function (o) { return G.reden === o; }, function (o) { G.reden = (G.reden === o ? '' : o); save(); });
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, ['Het gesprek']),
    el('div', {}, [el('label', { for: 'adres' }, ['Adres']), adres]),
    el('div', {}, [el('label', { for: 'contact' }, ['Contactpersoon']), contact]),
    el('div', {}, [el('div', { class: 'lbl' }, ['Reden van verkoop']), rc]),
    el('div', {}, [el('label', { for: 'redentekst' }, ['Toelichting']), rt]),
    dictaat(rt),
    el('div', { class: 'auto' }, [el('b', {}, ['Hoef je niet te vragen. ']), 'Kadaster, bouwjaar, woonoppervlak, energielabel en WOZ komen uit openbare bronnen. Dat ophalen is nog niet gekoppeld.'])
  ]));
}

function vRondgang(app) {
  chipEls = {};
  var names = CFG.ruimtes.concat(Object.keys(G.rooms).filter(function (k) { return CFG.ruimtes.indexOf(k) < 0; }));
  var eigen = el('input', { type: 'text', id: 'eigen', placeholder: 'Andere ruimte, dan Enter' });
  eigen.addEventListener('keydown', function (e) { if (e.key === 'Enter' && eigen.value.trim()) { cur = eigen.value.trim(); room(cur); save(); render(); } });
  var picker = el('div', { class: 'chips' });
  names.forEach(function (n) {
    var c = el('span', { class: 'n' }, [roomCount(n)]); chipEls[n] = c;
    picker.appendChild(el('button', { class: 'chip', type: 'button', 'aria-pressed': cur === n ? 'true' : 'false',
      onclick: function () { cur = (cur === n ? '' : n); render(); } }, [n, c]));
  });
  app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'lbl' }, ['Waar ben je?']), picker, eigen]));
  if (!cur) return;

  var r = room(cur);
  function voegToe(files) {
    var fs = [].slice.call(files);
    busy = 'Foto’s verwerken…'; render();
    return fs.reduce(function (p, f) {
      return p.then(function () { return shrink(f); }).then(function (x) {
        var rec = { id: uid(), gesprek: G.id, ruimte: cur, blob: x.blob, w: x.w, h: x.h, t: Date.now() };
        FOTOS.push(rec); G.nFotos = FOTOS.length; return put('fotos', rec);
      }).catch(function () {});
    }, Promise.resolve()).then(function () { busy = ''; saveNow(); render(); });
  }
  var cam = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: '', id: 'cam' });
  var lib = el('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '', id: 'lib' });
  cam.addEventListener('change', function () { if (cam.files.length) voegToe(cam.files); });
  lib.addEventListener('change', function () { if (lib.files.length) voegToe(lib.files); });
  var fs = fotosIn(cur);
  var th = el('div', { class: 'thumbs' }, fs.map(function (f, i) {
    return el('div', { class: 'thumb' }, [
      el('img', { src: urlOf(f), alt: cur + ' foto ' + (i + 1) }),
      el('button', { type: 'button', 'aria-label': 'Verwijder foto', onclick: function () {
        FOTOS = FOTOS.filter(function (x) { return x.id !== f.id; }); G.nFotos = FOTOS.length;
        URL.revokeObjectURL(urls[f.id]); delete urls[f.id]; del('fotos', f.id); save(); render(); } }, ['×'])]);
  }));
  var ta = el('textarea', { id: 'note', placeholder: 'Eigen notitie bij deze ruimte. Typ, of dicteer.' }); ta.value = r.note;
  ta.addEventListener('input', function () { r.note = ta.value; save(); refreshCounts(); });
  var staat = chipGroup(CFG.staat, function (o) { return r.staat === o; }, function (o) { r.staat = (r.staat === o ? '' : o); save(); });
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, [cur]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', id: 'maak', onclick: function () { cam.click(); } }, ['Foto maken']),
      el('button', { class: 'btn ghost', type: 'button', onclick: function () { lib.click(); } }, ['Uit bibliotheek'])]),
    cam, lib,
    busy ? el('span', { class: 'hint', role: 'status' }, [busy]) : null,
    fs.length ? th : el('span', { class: 'hint' }, ['Nog geen foto.']),
    el('div', { class: 'lbl' }, ['Staat']), staat,
    el('label', { for: 'note' }, ['Notitie']), ta,
    dictaat(ta),
    el('span', { class: 'hint' }, ['Dicteer alleen je eigen notities. Neem het gesprek met de klant niet op zonder toestemming.'])
  ]));
}

function vAfronden(app) {
  function q(titel, opts, key) {
    return el('div', { class: 'card' }, [el('div', { class: 'lbl' }, [titel]),
      chipGroup(opts, function (o) { return G[key] === o; }, function (o) { G[key] = (G[key] === o ? '' : o); save(); })]);
  }
  var bed = el('input', { type: 'number', inputmode: 'numeric', id: 'bedrag', placeholder: 'Bedrag in euro (optioneel)' }); bed.value = G.prijsBedrag;
  bed.addEventListener('input', function () { G.prijsBedrag = bed.value; save(); });
  var op = el('textarea', { id: 'opm', placeholder: 'Overig, bijvoorbeeld wensen van de verkoper' }); op.value = G.opm;
  op.addEventListener('input', function () { G.opm = op.value; save(); });
  app.appendChild(q('Gewenste timing', CFG.timing, 'timing'));
  app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'lbl' }, ['Prijsverwachting verkoper']),
    chipGroup(CFG.prijs, function (o) { return G.prijs === o; }, function (o) { G.prijs = (G.prijs === o ? '' : o); save(); }), bed]));
  app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'lbl' }, ['Bijzonderheden (meerdere mogelijk)']),
    chipGroup(CFG.bijzonderheden, function (o) { return G.bijz.indexOf(o) >= 0; }, function (o) { toggleIn(G.bijz, o); save(); })]));
  app.appendChild(el('div', { class: 'card' }, [el('label', { for: 'opm' }, ['Opmerkingen']), op, dictaat(op)]));
}

/* ---------- rapport ---------- */
function roomList() {
  var names = CFG.ruimtes.concat(Object.keys(G.rooms).filter(function (k) { return CFG.ruimtes.indexOf(k) < 0; }));
  return names.filter(function (n) { var r = G.rooms[n]; return fotosIn(n).length || (r && (r.note || r.staat)); });
}
function payload() {
  return { versie: 1, bureau: CFG.naam, gesprek: G.id, gestart: new Date(G.gemaakt).toISOString(),
    adres: G.adres || null, contact: G.contact || null,
    verkoper: { reden: G.reden || null, reden_toelichting: G.redenTekst || null, timing: G.timing || null,
      prijsverwachting: G.prijs || null, prijsbedrag_eur: G.prijsBedrag ? Number(G.prijsBedrag) : null },
    bijzonderheden: G.bijz, opmerkingen: G.opm || null,
    ruimtes: roomList().map(function (n) { var r = G.rooms[n] || {}; return { ruimte: n, staat: r.staat || null, notitie: r.note || null, aantal_fotos: fotosIn(n).length }; }),
    op_te_halen: OPHALEN };
}
function bestandsnaam(ext) {
  var a = (G.adres || 'gesprek').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return 'Opname-' + a + '-' + new Date(G.gemaakt).toISOString().slice(0, 10) + '.' + ext;
}
function deel(blob, naam, type) {
  var f = new File([blob], naam, { type: type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    return navigator.share({ files: [f], title: naam }).catch(function (e) { if (e && e.name === 'AbortError') return; return download(blob, naam); });
  }
  return Promise.resolve(download(blob, naam));
}
function download(blob, naam) {
  if (window.claude && window.claude.use) {
    return window.claude.use('downloads').then(function (d) { return d ? d.save({ filename: naam, data: blob }) : anchor(blob, naam); }).catch(function () {});
  }
  return anchor(blob, naam);
}
function anchor(blob, naam) {
  var u = URL.createObjectURL(blob), a = el('a', { href: u, download: naam });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
}
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function clean(s) {
  return String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/…/g, '...').replace(/€/g, 'EUR').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '');
}
function toDataURL(b) { return new Promise(function (r) { var f = new FileReader(); f.onload = function () { r(f.result); }; f.readAsDataURL(b); }); }

function maakPdf() {
  var J = window.jspdf.jsPDF, d = new J({ unit: 'mm', format: 'a4', compress: true });
  var W = 210, H = 297, M = 18, CW = W - 2 * M, y = 0, ac = hex2rgb(CFG.accent), INK = [24, 35, 31], MUT = [91, 106, 100];
  function need(h) { if (y + h > H - 16) { d.addPage(); y = M; } }
  function txt(s, size, bold, color, gap) {
    d.setFont('helvetica', bold ? 'bold' : 'normal'); d.setFontSize(size); d.setTextColor.apply(d, color || INK);
    var lines = d.splitTextToSize(clean(s), CW), lh = size * 0.44;
    lines.forEach(function (l) { need(lh); d.text(l, M, y + size * 0.35); y += lh; });
    y += gap || 0;
  }
  function sec(t) { y += 3; need(14); txt(t.toUpperCase(), 9, true, ac, 1); d.setDrawColor(ac[0], ac[1], ac[2]); d.setLineWidth(0.3); d.line(M, y, W - M, y); y += 3; }
  function kv(k, v) { if (!v) return; txt(k, 8, true, MUT, 0); txt(v, 11, false, INK, 2.5); }

  d.setFillColor(ac[0], ac[1], ac[2]); d.rect(0, 0, W, 24, 'F');
  d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text(clean(CFG.naam), M, 15);
  d.setFont('helvetica', 'normal'); d.setFontSize(10); d.text('Opname verkoopgesprek', W - M, 15, { align: 'right' });
  y = 34;
  txt(G.adres || 'Adres onbekend', 20, true, INK, 1);
  txt(datum(G.gemaakt) + (G.contact ? '  |  ' + G.contact : ''), 10, false, MUT, 2);

  sec('Verkoper');
  kv('Reden van verkoop', [G.reden, G.redenTekst].filter(Boolean).join(': '));
  kv('Gewenste timing', G.timing);
  kv('Prijsverwachting', [G.prijs, G.prijsBedrag ? 'EUR ' + Number(G.prijsBedrag).toLocaleString('nl-NL') : ''].filter(Boolean).join(', '));
  if (G.bijz.length) kv('Bijzonderheden', G.bijz.join(', '));
  kv('Opmerkingen', G.opm);
  kv('Nog op te halen uit openbare bronnen', OPHALEN.join(', '));

  var chain = Promise.resolve();
  roomList().forEach(function (n) {
    chain = chain.then(function () {
      var r = G.rooms[n] || {}, fs = fotosIn(n);
      sec(n + (r.staat ? '  -  ' + r.staat : ''));
      if (r.note) txt(r.note, 11, false, INK, 2);
      var colW = (CW - 4) / 2, boxH = 62, col = 0;
      return fs.reduce(function (p, f) {
        return p.then(function () { return toDataURL(f.blob); }).then(function (u) {
          if (col === 0) need(boxH + 4);
          var s = Math.min(colW / f.w, boxH / f.h), iw = f.w * s, ih = f.h * s, x = M + col * (colW + 4);
          d.addImage(u, 'JPEG', x, y, iw, ih);
          col++; if (col === 2) { col = 0; y += boxH + 4; }
        });
      }, Promise.resolve()).then(function () { if (col !== 0) y += boxH + 4; });
    });
  });
  return chain.then(function () {
    var n = d.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      d.setPage(i); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(MUT[0], MUT[1], MUT[2]);
      d.text(clean(CFG.naam) + '  |  Rondgang', M, H - 8); d.text(i + ' / ' + n, W - M, H - 8, { align: 'right' });
    }
    return d.output('blob');
  });
}

function vRapport(app) {
  var p = payload(), nf = FOTOS.length;
  var dl = el('dl', { class: 'sum' }, [
    el('dt', {}, ['Adres']), el('dd', {}, [p.adres || 'Niet ingevuld']),
    el('dt', {}, ['Reden en timing']), el('dd', {}, [[p.verkoper.reden, p.verkoper.timing].filter(Boolean).join(', ') || 'Niet ingevuld']),
    el('dt', {}, ['Toelichting verkoper']), el('dd', {}, [p.verkoper.reden_toelichting || 'Geen']),
    el('dt', {}, ['Bijzonderheden']), el('dd', {}, [p.bijzonderheden.join(', ') || 'Geen']),
    el('dt', {}, ['Ruimtes']), el('dd', {}, [p.ruimtes.length + ' met inhoud, ' + nf + ' foto’s'])]);
  var status = el('span', { class: 'hint', role: 'status' }, ['']);
  var acties = el('div', { class: 'row' });
  if (gen) {
    acties.appendChild(el('button', { class: 'btn', type: 'button', id: 'deel', onclick: function () { deel(gen.blob, gen.naam, 'application/pdf'); } }, ['Deel rapport']));
    status.textContent = gen.naam + ' (' + Math.round(gen.blob.size / 1024) + ' kB) staat klaar.';
  }
  acties.appendChild(el('button', { class: gen ? 'btn ghost' : 'btn', type: 'button', id: 'pdf', onclick: function (e) {
    var b = e.currentTarget; b.disabled = true; b.textContent = 'Rapport maken…';
    saveNow().then(maakPdf).then(function (blob) { gen = { blob: blob, naam: bestandsnaam('pdf') }; render(); })
      .catch(function (err) { b.disabled = false; b.textContent = 'Maak rapport'; status.textContent = 'Rapport maken mislukte: ' + (err && err.message || err); });
  } }, [gen ? 'Maak opnieuw' : 'Maak rapport']));
  app.appendChild(el('div', { class: 'card' }, [el('h2', {}, ['Rapport']), dl, acties, status]));
  app.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'lbl' }, ['Gegevens voor de offerte']),
    el('span', { class: 'hint' }, ['Zonder foto’s. Hiermee maakt de offerte-stap straks zijn voorstel.']),
    el('button', { class: 'btn ghost', type: 'button', id: 'json', onclick: function () {
      deel(new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' }), bestandsnaam('json'), 'application/json'); } }, ['Deel gegevens (JSON)'])]));
}

function render() {
  var app = $('#app'), nav = $('#nav'); app.textContent = ''; nav.textContent = ''; chipEls = {};
  nav.hidden = !G;
  if (!G) { home(app); return; }
  gesprekKop(app);
  ({ start: vStart, rondgang: vRondgang, afronden: vAfronden, rapport: vRapport })[tab](app);
  [['start', 'Start'], ['rondgang', 'Rondgang'], ['afronden', 'Afronden'], ['rapport', 'Rapport']].forEach(function (t) {
    nav.appendChild(el('button', { type: 'button', 'aria-current': tab === t[0] ? 'page' : false,
      onclick: function () { saveNow(); tab = t[0]; render(); window.scrollTo(0, 0); } }, [t[1]]));
  });
}

/* ---------- start ---------- */
function lum(h) { var c = hex2rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function pasToe() {
  var r = document.documentElement.style;
  r.setProperty('--accent-base', CFG.accent);
  r.setProperty('--accent-ink-l', lum(CFG.accent) > 0.45 ? '#10201a' : '#ffffff');
  document.title = 'Rondgang';
}
function laadConfig() {
  var q = new URLSearchParams(location.search).get('config');
  if (q) lsSet('rondgang.config', q);
  var url = q || lsGet('rondgang.config') || 'config.json';
  return fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (c) { CFG = Object.assign({}, FALLBACK, c); })
    .catch(function () { CFG = FALLBACK; });
}

window.addEventListener('pagehide', function () { saveNow(); });
document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });

Promise.all([laadConfig(), openDB()]).then(function (r) {
  DB = r[1]; pasToe();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  render();
  if (!DB) $('#app').insertBefore(el('div', { class: 'warn' }, ['Opslaan op dit toestel is niet beschikbaar (privévenster?). Gesprekken verdwijnen als je de pagina sluit.']), $('#app').firstChild);
});
window.__rondgang = { get G() { return G; }, get CFG() { return CFG; } };
})();
