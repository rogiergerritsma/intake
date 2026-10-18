(function () {
'use strict';

var FALLBACK = {
  naam: '', plaats: '', analytics: { ga: '' }, accent: '#B47070', logo: '',
  ruimtes: ['Entree', 'Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Toilet', 'Zolder', 'Garage', 'Achtertuin', 'Voorgevel'],
  staat: ['Goed', 'Redelijk', 'Verouderd'],
  reden: ['Groter', 'Kleiner', 'Verhuizing werk', 'Scheiding', 'Erfenis', 'Senior', 'Anders'],
  woningtypes: { Woonhuis: { soort: ['Eengezinswoning', 'Villa'], bouwvorm: ['Tussen', 'Hoek', 'Vrijstaand'] }, Appartement: { soort: ['Benedenwoning', 'Bovenwoning'], bouwvorm: [] }, Parkeergelegenheid: {}, Bouwgrond: {}, Overig: {} },
  timing: ['Zo snel mogelijk', 'Binnen 3 maanden', 'In overleg', 'Geen haast'],
  prijs: ['Dichtbij marktwaarde', 'Hoger verwacht', 'Onzeker'],
  bijzonderheden: [{ naam: 'Zonnepanelen', aantal: 'panelen' }, 'Overpad of recht van weg', 'Verbouwd', 'Erfpacht', 'VvE', 'Vochtplekken']
};
var OPHALEN = ['woz'];
var FUNDAMENT = 'https://bureau-fundament.nl/';
var FUNDERING = { A: 'geen risico', B: 'licht risico', C: 'verhoogd risico of onzekerheid', D: 'hoog risico', E: 'vastgesteld probleem' };
var LABELS = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
var MAIL = 'mail@bureau-wonen.nl', REPO = 'https://github.com/rogiergerritsma/intake';

var CFG = FALLBACK, DB = null, MEM = { gesprekken: {}, fotos: {} };
var G = null, FOTOS = [], tab = 'start', cur = '', urls = {}, gen = null, busy = '', stopDictaat = null, logoCache = null;
var chipEls = {}, menu = '', bagTok = 0;

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


function icoon(paden) {
  var ns = 'http://www.w3.org/2000/svg', v = document.createElementNS(ns, 'svg');
  v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('width', '20'); v.setAttribute('height', '20'); v.setAttribute('aria-hidden', 'true');
  v.setAttribute('fill', 'none'); v.setAttribute('stroke', 'currentColor'); v.setAttribute('stroke-width', '1.8'); v.setAttribute('stroke-linecap', 'round'); v.setAttribute('stroke-linejoin', 'round');
  paden.forEach(function (d) { var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); v.appendChild(p); });
  return v;
}
function opnemer() { return (lsGet('rg_opnemer') || '').trim(); }
function kantoor() { return (lsGet('rg_kantoor') || CFG.naam || '').trim(); }

/* ---------- meten (alleen na toestemming) ---------- */
function gaId() { return (CFG.analytics && CFG.analytics.ga) || ''; }
function keuze() { return lsGet('rg_cookiekeuze'); }
function laadGA() {
  if (!gaId() || keuze() !== 'ja' || window.__gaLoaded) return;
  window.__gaLoaded = 1; window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', gaId(), { allow_google_signals: false, allow_ad_personalization_signals: false, content_group: 'intake' });
  document.head.appendChild(el('script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId()) }));
}
/* Alleen gebruik van de app, nooit wat er is ingevuld. */
function track(naam, par) { if (window.gtag && keuze() === 'ja') window.gtag('event', naam, par || {}); }
function wisGaCookies() {
  var h = location.hostname.split('.'), doms = [''];
  for (var i = 0; i < h.length - 1; i++) doms.push('; domain=.' + h.slice(i).join('.'));
  document.cookie.split(';').forEach(function (c) {
    var n = c.split('=')[0].trim();
    if (/^_ga/.test(n)) doms.forEach(function (d) { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d; });
  });
}
function zetKeuze(v) {
  var was = keuze();
  if (v) lsSet('rg_cookiekeuze', v); else { try { localStorage.removeItem('rg_cookiekeuze'); } catch (e) {} }
  if (was === 'ja' && v !== 'ja') { wisGaCookies(); location.reload(); return; }
  if (v === 'ja') laadGA();
  paintCookie(); if (menu === 'cookies') render();
}
function paintCookie() {
  var c = $('#cookie'); if (!c) return;
  c.textContent = '';
  var tonen = gaId() && !keuze();
  c.hidden = !tonen; c.className = (G && !menu) ? 'metnav' : '';
  if (!tonen) return;
  c.appendChild(el('p', {}, ['Mogen we met Google Analytics meten hoe bezoekers deze site gebruiken? Zo zien we wat werkt. ',
    el('button', { class: 'link', type: 'button', onclick: function () { menu = 'privacy'; render(); window.scrollTo(0, 0); } }, ['Privacyverklaring'])]));
  c.appendChild(el('div', { class: 'row' }, [
    el('button', { class: 'btn small', type: 'button', id: 'ck-ja', onclick: function () { zetKeuze('ja'); } }, ['Prima']),
    el('button', { class: 'btn small', type: 'button', id: 'ck-nee', onclick: function () { zetKeuze('nee'); } }, ['Liever niet'])]));
}

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
  return { id: uid(), gemaakt: Date.now(), bijgewerkt: Date.now(), adres: '', contact: '', reden: [], redenTekst: '', aantallen: {},
    timing: '', prijs: '', prijsBedrag: '', bijz: [], opm: '', rooms: {}, nFotos: 0, bag: null, fundering: '', energielabel: '', woning: nieuwWoning(), install: nieuwInstall(), gebouw: { bouwjaar: '', oppervlakte: '' } };
}
function maatInfo(key) {
  var w = G.gebouw ? G.gebouw[key] : '', o = G.bag && G.bag[key] ? G.bag[key] : null;
  var bron = !w ? null : (o == null ? 'handmatig' : (String(w) === String(o) ? 'bag' : 'aangepast'));
  return { waarde: w ? Number(w) : null, bag: o, bron: bron };
}
function maatTekst(key, eenheid) {
  var m = maatInfo(key); if (!m.waarde) return '';
  var t = m.waarde + (eenheid ? ' ' + eenheid : '');
  if (m.bron === 'aangepast') return t + ' (aangepast door makelaar, BAG: ' + m.bag + (eenheid ? ' ' + eenheid : '') + ')';
  if (m.bron === 'handmatig') return t + ' (handmatig ingevuld, niet uit BAG)';
  return t + ' (BAG)';
}
function maatJson(key) { var m = maatInfo(key); return m.waarde ? { waarde: m.waarde, bron: m.bron, bag_waarde: m.bag } : null; }
function nieuwInstall() { return { verwarming: [], afgifte: [], warmwater: [], ketelBouwjaar: '' }; }
function nieuwWoning() {
  return { hoofd: '', soort: '', bouwvorm: '', nieuwbouw: false, aanbouw: false, verdiepingen: '', oprit: '', parkeren: [] };
}
function bn(b) { return typeof b === 'string' ? b : b.naam; }
function bAantal(b) { return typeof b === 'object' && b.aantal ? b.aantal : ''; }
function room(n) { return G.rooms[n] || (G.rooms[n] = { note: '', staat: '', kenm: [] }); }
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
function roomCount(n) { var r = G.rooms[n], c = fotosIn(n).length + (r && (r.note || (r.kenm && r.kenm.length)) ? 1 : 0); return c ? String(c) : ''; }
function refreshCounts() { Object.keys(chipEls).forEach(function (n) { chipEls[n].textContent = roomCount(n); }); }


/* ---------- adres-tool: PDOK Locatieserver + BAG (gratis, zonder sleutel) ---------- */
var PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/';
var BAGWFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
function jget(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }); }
function zoekAdres(q) {
  return jget(PDOK + 'suggest?rows=5&fq=type:adres&q=' + encodeURIComponent(q)).then(function (j) { return (j.response && j.response.docs) || []; });
}
function haalBag(sug) {
  var fl = 'weergavenaam,postcode,woonplaatsnaam,gemeentenaam,centroide_ll,adresseerbaarobject_id';
  return jget(PDOK + 'lookup?id=' + encodeURIComponent(sug.id) + '&fl=' + fl).then(function (j) {
    var d = j.response && j.response.docs && j.response.docs[0];
    if (!d) throw new Error('geen adres');
    var out = { adres: d.weergavenaam, postcode: d.postcode || null, plaats: d.woonplaatsnaam || null, gemeente: d.gemeentenaam || null,
      lat: null, lon: null, bouwjaar: null, oppervlakte: null, gebruiksdoel: null, datum: new Date().toISOString().slice(0, 10) };
    var m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(d.centroide_ll || '');
    if (m) { out.lon = Number(m[1]); out.lat = Number(m[2]); }
    if (!d.adresseerbaarobject_id) return out;
    var f = '<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>' + d.adresseerbaarobject_id + '</Literal></PropertyIsEqualTo></Filter>';
    return jget(BAGWFS + '?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:verblijfsobject&outputFormat=application/json&count=5&filter=' + encodeURIComponent(f))
      .then(function (w) {
        var fs = (w.features || []).map(function (x) { return x.properties || {}; });
        var pr = fs.filter(function (x) { return /in gebruik/i.test(x.status || ''); })[0] || fs[0];
        if (pr) {
          if (pr.bouwjaar > 0) out.bouwjaar = pr.bouwjaar;
          if (pr.oppervlakte > 0 && pr.oppervlakte < 99999) out.oppervlakte = pr.oppervlakte;
          out.gebruiksdoel = [].concat(pr.gebruiksdoel || []).join(', ') || null;
        }
        return out;
      }).catch(function () { return out; });
  });
}

function dictaat(ta) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var want = false, rec = null, leeg = 0, msg = el('span', { class: 'hint', role: 'status' }, ['']);
  var btn = el('button', { class: 'btn small ghost', type: 'button', 'aria-pressed': 'false' }, ['Dicteer']);
  function ui(aan) { btn.textContent = aan ? 'Stop' : 'Dicteer'; btn.setAttribute('aria-pressed', aan ? 'true' : 'false'); msg.textContent = aan ? 'Luistert\u2026' : ''; }
  function stop() { want = false; ui(false); try { rec && rec.stop(); } catch (e) {} if (stopDictaat === stop) stopDictaat = null; }
  function start() {
    rec = new SR(); rec.lang = 'nl-NL'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = function (e) {
      leeg = 0;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { ta.value = (ta.value ? ta.value + ' ' : '') + e.results[i][0].transcript.trim(); ta.dispatchEvent(new Event('input')); }
      }
    };
    rec.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want = false; ui(false); msg.textContent = 'Dicteren lukt hier niet (' + (e.error || 'onbekend') + '). Gebruik de microfoon op uw toetsenbord.';
    };
    /* iOS stopt de herkenning zelf na een pauze: zolang je niet op Stop drukt, starten we opnieuw. */
    rec.onend = function () {
      if (want && leeg < 6) { leeg++; setTimeout(function () { if (want) { try { start(); } catch (e) { stop(); } } }, 300); }
      else if (want) { stop(); msg.textContent = 'Gestopt na een lange stilte.'; }
    };
    rec.start();
  }
  btn.addEventListener('click', function () {
    if (want) { stop(); return; }
    if (stopDictaat) stopDictaat();
    try { want = true; leeg = 0; ui(true); stopDictaat = stop; start(); }
    catch (e) { stop(); msg.textContent = 'Dicteren lukt hier niet. Gebruik de microfoon op uw toetsenbord.'; }
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
function infoKnop() {
  return el('button', { class: 'iconbtn', type: 'button', id: 'info', 'aria-label': 'Info en menu', onclick: function () { saveNow(); menu = 'menu'; render(); window.scrollTo(0, 0); } },
    [icoon(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 7.5v.01']), 'Info']);
}
function titel() {
  var k = [];
  if (CFG.logo) k.push(el('img', { src: CFG.logo, alt: '' }));
  k.push(el('h1', {}, ['Intake']));
  return el('div', { class: 'title' }, k);
}

function home(app) {
  app.appendChild(el('header', {}, [titel(), infoKnop()]));
  var isIOS = /iPhone|iPad/.test(navigator.userAgent);
  if (isIOS && !navigator.standalone && lsGet('rondgang.hint') !== '1') {
    app.appendChild(el('div', { class: 'warn' }, [
      'Zet Intake op uw beginscherm (deel-icoon, dan Zet op beginscherm). Zo bewaart uw iPhone de gesprekken betrouwbaarder. ',
      el('button', { class: 'back', type: 'button', onclick: function () { lsSet('rondgang.hint', '1'); render(); } }, ['Begrepen'])]));
  }
  app.appendChild(el('div', { class: 'card intro' }, [
    el('h2', {}, ['Snel vastleggen tijdens het verkoopgesprek']),
    el('p', {}, ['Foto’s, notities en dictaat per ruimte, plus de wensen van de verkoper. Daarna maakt u een PDF-rapport waarmee u een goede offerte maakt, omdat u precies weet hoe het huis was.']),
    el('p', { class: 'hint' }, ['Gratis. Alles blijft op uw toestel. ', el('button', { class: 'link', type: 'button', onclick: function () { menu = 'over'; render(); window.scrollTo(0, 0); } }, ['Meer over Rondgang'])])]));
  app.appendChild(el('button', { class: 'btn', type: 'button', id: 'nieuw', onclick: function () { G = nieuw(); FOTOS = []; tab = 'start'; cur = ''; gen = null; put('gesprekken', G); track('gesprek_gestart'); render(); } }, ['Nieuw gesprek']));
  var lijst = el('div', { class: 'list', id: 'lijst' });
  app.appendChild(lijst);
  app.appendChild(el('div', { class: 'foot' }, [
    el('button', { class: 'link', type: 'button', onclick: function () { menu = 'privacy'; render(); window.scrollTo(0, 0); } }, ['Privacyverklaring']),
    gaId() ? el('button', { class: 'link', type: 'button', onclick: function () { menu = 'cookies'; render(); window.scrollTo(0, 0); } }, ['Cookie-instellingen']) : null]));
  if (window.RONDGANG_VERSION) app.appendChild(el('div', { class: 'ver' }, ['versie ' + window.RONDGANG_VERSION]));
  allOf('gesprekken').then(function (a) {
    a.sort(function (x, y) { return y.bijgewerkt - x.bijgewerkt; });
    if (!a.length) { lijst.appendChild(el('p', { class: 'hint' }, ['Nog geen gesprekken. Alles wat u invult blijft op dit toestel.'])); return; }
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
  if (typeof G.reden === 'string') G.reden = G.reden ? [G.reden] : [];
  if (!G.reden) G.reden = [];
  if (!G.aantallen) G.aantallen = {};
  if (!G.woning) G.woning = nieuwWoning();
  if (!G.install) G.install = nieuwInstall();
  if (!G.gebouw) G.gebouw = { bouwjaar: G.bag && G.bag.bouwjaar ? String(G.bag.bouwjaar) : '', oppervlakte: G.bag && G.bag.oppervlakte ? String(G.bag.oppervlakte) : '' };
  fotosVan(g.id).then(function (fs) { FOTOS = fs; render(); });
}

function gesprekKop(app) {
  app.appendChild(el('button', { class: 'back', type: 'button', onclick: function () { saveNow().then(function () { G = null; render(); }); } }, ['‹ Gesprekken']));
  app.appendChild(el('header', {}, [titel(), infoKnop()]));
  app.appendChild(el('div', { class: 'sub', id: 'adres-sub' }, [G.adres || 'Nieuw gesprek']));
}

function vStart(app) {
  var adres = el('input', { type: 'text', id: 'adres', placeholder: 'Straat, nummer, plaats', autocomplete: 'off', autocapitalize: 'words',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'sug' }); adres.value = G.adres;
  var sug = el('div', { class: 'sug', id: 'sug', role: 'listbox', hidden: '' });
  var bagBox = el('div', { class: 'auto', id: 'bag', hidden: '' }), bagMsg = '';
  var maatBox = el('div', { class: 'stack', id: 'maat' }), maatEls = {};
  function paintMaat() {
    [['bouwjaar', ''], ['oppervlakte', 'm²']].forEach(function (k) {
      var m = maatInfo(k[0]), st = maatEls[k[0]].st, inp = maatEls[k[0]].inp;
      if (document.activeElement !== inp) inp.value = G.gebouw[k[0]] || '';
      st.textContent = ''; st.className = 'hint' + (m.bron === 'aangepast' ? ' aangepast' : '');
      if (m.bron === 'aangepast') {
        st.appendChild(document.createTextNode('Aangepast door u. BAG: ' + m.bag + (k[1] ? ' ' + k[1] : '') + '. Dit staat zo in het rapport. '));
        st.appendChild(el('button', { class: 'link', type: 'button', onclick: function () { G.gebouw[k[0]] = String(m.bag); save(); paintMaat(); } }, ['Terug naar BAG']));
      } else if (m.bron === 'handmatig') st.textContent = 'Handmatig ingevuld, niet uit BAG. Dit staat zo in het rapport.';
      else if (m.bron === 'bag') st.textContent = 'Uit BAG. Pas aan als dit niet klopt.';
      else st.textContent = 'Nog niet bekend. Vul zelf in als u het weet.';
    });
  }
  [['bouwjaar', 'Bouwjaar', '4'], ['oppervlakte', 'Gebruiksoppervlakte (m²)', '5']].forEach(function (k) {
    var inp = el('input', { type: 'text', inputmode: 'numeric', id: 'maat-' + k[0], maxlength: k[2], autocomplete: 'off' }), st = el('span', { class: 'hint', role: 'status' });
    inp.addEventListener('input', function () { G.gebouw[k[0]] = inp.value.replace(/[^0-9]/g, ''); save(); paintMaat(); });
    maatEls[k[0]] = { inp: inp, st: st };
    maatBox.appendChild(el('div', {}, [el('label', { for: 'maat-' + k[0] }, [k[1]]), inp, st]));
  });
  var timer = null;
  function sluit() { sug.hidden = true; sug.textContent = ''; adres.setAttribute('aria-expanded', 'false'); }
  function paintBag() {
    bagBox.textContent = '';
    var b = G.bag;
    if (!b && !bagMsg) { bagBox.hidden = true; return; }
    bagBox.hidden = false;
    if (bagMsg) { bagBox.appendChild(el('span', {}, [bagMsg])); }
    if (!b) return;
    bagBox.appendChild(el('b', {}, ['Uit openbare bronnen (BAG). ']));
    var regels = [['Postcode en plaats', [b.postcode, b.plaats].filter(Boolean).join(' ')], ['Gebruiksdoel', b.gebruiksdoel]]
      .filter(function (r) { return r[1]; });
    var dl = el('dl', { class: 'sum bagdl' }, []);
    regels.forEach(function (r) { dl.appendChild(el('dt', {}, [r[0]])); dl.appendChild(el('dd', {}, [String(r[1])])); });
    bagBox.appendChild(dl);
    bagBox.appendChild(el('span', { class: 'hint' }, ['Controleer dit zelf. Bouwjaar en oppervlakte kunt u hieronder aanpassen. Energielabel en WOZ-waarde haalt u nog zelf op.']));
  }
  function kies(d) {
    sluit(); adres.value = d.weergavenaam; G.adres = d.weergavenaam; G.bag = null; G.gebouw = { bouwjaar: '', oppervlakte: '' }; bagMsg = 'Gegevens ophalen…'; paintBag(); paintMaat();
    var sub = document.getElementById('adres-sub'); if (sub) sub.textContent = G.adres;
    var my = ++bagTok; save(); track('adres_gekozen');
    haalBag(d).then(function (b) { if (my !== bagTok || !G) return; G.bag = b; G.gebouw = { bouwjaar: b.bouwjaar ? String(b.bouwjaar) : '', oppervlakte: b.oppervlakte ? String(b.oppervlakte) : '' }; bagMsg = ''; save(); paintBag(); paintMaat(); })
      .catch(function () { if (my !== bagTok) return; bagMsg = 'Ophalen lukte niet. U kunt het adres gewoon zelf invullen.'; paintBag(); });
  }
  adres.addEventListener('input', function () {
    G.adres = adres.value;
    if (G.bag && G.bag.adres !== adres.value) { G.bag = null; bagMsg = ''; bagTok++; paintBag(); }
    var sub = document.getElementById('adres-sub'); if (sub) sub.textContent = G.adres || 'Nieuw gesprek'; save();
    clearTimeout(timer);
    var q = adres.value.trim();
    if (q.length < 3) { sluit(); return; }
    timer = setTimeout(function () {
      zoekAdres(q).then(function (docs) {
        if (adres.value.trim() !== q) return;
        sug.textContent = '';
        docs.forEach(function (d) { sug.appendChild(el('button', { type: 'button', role: 'option', onclick: function () { kies(d); } }, [d.weergavenaam])); });
        sug.hidden = !docs.length; adres.setAttribute('aria-expanded', docs.length ? 'true' : 'false');
      }).catch(sluit);
    }, 250);
  });
  paintBag(); paintMaat();
  var contact = el('input', { type: 'text', id: 'contact', placeholder: 'Naam verkoper', autocomplete: 'off' }); contact.value = G.contact;
  contact.addEventListener('input', function () { G.contact = contact.value; save(); });
  var rt = el('textarea', { id: 'redentekst', placeholder: 'Waarom verkopen ze? Typ, of dicteer.' }); rt.value = G.redenTekst || '';
  rt.addEventListener('input', function () { G.redenTekst = rt.value; save(); });
  var rc = chipGroup(CFG.reden, function (o) { return G.reden.indexOf(o) >= 0; }, function (o) { toggleIn(G.reden, o); save(); });
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, ['Het gesprek']),
    el('div', { class: 'adresveld' }, [el('label', { for: 'adres' }, ['Adres']), adres, sug]),
    bagBox,
    maatBox,
    el('div', {}, [el('label', { for: 'contact' }, ['Contactpersoon']), contact]),
    el('div', {}, [el('div', { class: 'lbl' }, ['Reden(en) van verkoop']), rc]),
    el('div', {}, [el('label', { for: 'redentekst' }, ['Toelichting']), rt]),
    dictaat(rt)
  ]));
  var W = G.woning, typeBox = el('div', { class: 'stack', id: 'woningtype' });
  function jaNee(sleutel, titel) {
    return el('div', {}, [el('div', { class: 'lbl' }, [titel]),
      chipGroup(['Ja', 'Nee'], function (o) { return W[sleutel] === o; }, function (o) { W[sleutel] = (W[sleutel] === o ? '' : o); save(); })]);
  }
  function paintType() {
    typeBox.textContent = '';
    var T = CFG.woningtypes || {}, sub = T[W.hoofd] || {};
    typeBox.appendChild(el('div', {}, [el('div', { class: 'lbl' }, ['Soort object']),
      chipGroup(Object.keys(T), function (o) { return W.hoofd === o; }, function (o) {
        if (W.hoofd === o) W.hoofd = ''; else { W.hoofd = o; }
        W.soort = ''; W.bouwvorm = ''; save(); paintType(); })]));
    if (sub.soort && sub.soort.length) typeBox.appendChild(el('div', {}, [el('div', { class: 'lbl' }, ['Soort ' + W.hoofd.toLowerCase()]),
      chipGroup(sub.soort, function (o) { return W.soort === o; }, function (o) { W.soort = (W.soort === o ? '' : o); save(); })]));
    if (sub.bouwvorm && sub.bouwvorm.length) typeBox.appendChild(el('div', {}, [el('div', { class: 'lbl' }, ['Bouwvorm']),
      chipGroup(sub.bouwvorm, function (o) { return W.bouwvorm === o; }, function (o) { W.bouwvorm = (W.bouwvorm === o ? '' : o); save(); })]));
    typeBox.appendChild(el('div', {}, [el('div', { class: 'lbl' }, ['Status']),
      chipGroup(['Nieuwbouw', 'In aanbouw'], function (o) { return o === 'Nieuwbouw' ? W.nieuwbouw : W.aanbouw; }, function (o) {
        if (o === 'Nieuwbouw') W.nieuwbouw = !W.nieuwbouw; else W.aanbouw = !W.aanbouw; save(); })]));
  }
  paintType();
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, ['Type woning']),
    typeBox,
    el('div', {}, [el('div', { class: 'lbl' }, ['Aantal verdiepingen']),
      chipGroup(['1', '2', '3', '4', '5 of meer'], function (o) { return W.verdiepingen === o; }, function (o) { W.verdiepingen = (W.verdiepingen === o ? '' : o); save(); })]),
    jaNee('oprit', 'Oprit'),
    el('div', {}, [el('div', { class: 'lbl' }, ['Parkeren']),
      chipGroup(['Openbaar', 'Eigen terrein'], function (o) { return W.parkeren.indexOf(o) >= 0; }, function (o) { toggleIn(W.parkeren, o); save(); })]),
    el('span', { class: 'hint' }, ['Dezelfde indeling als in Kolibri en Funda.'])
  ]));
  var fundBox = el('div', { class: 'warn', id: 'fundwarn', hidden: '' });
  function paintFund() {
    var k = G.fundering; fundBox.textContent = '';
    var hoog = k === 'D' || k === 'E';
    fundBox.hidden = !hoog;
    if (!hoog) return;
    fundBox.appendChild(el('b', {}, ['Funderingscode ' + k + '. ']));
    fundBox.appendChild(document.createTextNode('Bij deze klasse volgt in principe aanvullend onderzoek, en daar lopen transacties vaak op vast. Bureau Fundament neemt de regie over het funderingsdossier. '));
    fundBox.appendChild(el('a', { class: 'link', id: 'fundlink', href: FUNDAMENT, target: '_blank', rel: 'noopener', onclick: function () { track('fundament_klik', { locatie: 'klasse_' + k }); } }, ['bureau-fundament.nl']));
  }
  var fk = chipGroup(['A', 'B', 'C', 'D', 'E', 'Onbekend'], function (o) { return G.fundering === o; }, function (o) { G.fundering = (G.fundering === o ? '' : o); save(); paintFund(); });
  var el2 = chipGroup(LABELS, function (o) { return G.energielabel === o; }, function (o) { G.energielabel = (G.energielabel === o ? '' : o); save(); });
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, ['Fundering en energie']),
    el('div', {}, [el('div', { class: 'lbl' }, ['Funderingsrisicoklasse']), fk]),
    el('span', { class: 'hint' }, ['A geen risico, B licht, C verhoogd of onzeker, D hoog, E vastgesteld probleem. Staat in het KCAF-rapport, het taxatierapport of de advertentie.']),
    fundBox,
    el('div', {}, [el('div', { class: 'lbl' }, ['Energielabel']), el2]),
    el('span', { class: 'hint' }, ['Voorlopig vult u dit zelf in. Later haalt Intake het automatisch op.'])
  ]));
  paintFund();
  var I = G.install, IC = CFG.installaties || {};
  function ig(titel, key) { return el('div', {}, [el('div', { class: 'lbl' }, [titel]),
    chipGroup(IC[key] || [], function (o) { return I[key].indexOf(o) >= 0; }, function (o) { toggleIn(I[key], o); save(); })]); }
  var kb = el('input', { type: 'text', inputmode: 'numeric', id: 'ketelbj', placeholder: 'Bijvoorbeeld 2012', maxlength: '4' }); kb.value = I.ketelBouwjaar || '';
  kb.addEventListener('input', function () { I.ketelBouwjaar = kb.value.replace(/[^0-9]/g, ''); save(); });
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, ['Verwarming en warm water']),
    ig('Verwarming', 'verwarming'), ig('Afgifte', 'afgifte'), ig('Warm water', 'warmwater'),
    el('label', { for: 'ketelbj' }, ['Bouwjaar ketel of warmtepomp']), kb,
    el('span', { class: 'hint' }, ['Meerdere antwoorden mogelijk. Het bouwjaar staat meestal op het typeplaatje.'])
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
  app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'lbl' }, ['Waar bent u?']), picker, eigen]));
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
  if (!r.kenm) r.kenm = [];
  var kl = (CFG.kenmerken || {})[cur];
  var kenm = kl && kl.length ? el('div', {}, [el('div', { class: 'lbl' }, ['Kenmerken']),
    chipGroup(kl, function (o) { return r.kenm.indexOf(o) >= 0; }, function (o) { toggleIn(r.kenm, o); save(); refreshCounts(); })]) : null;
  app.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, [cur]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', id: 'maak', onclick: function () { cam.click(); } }, ['Foto maken']),
      el('button', { class: 'btn ghost', type: 'button', onclick: function () { lib.click(); } }, ['Uit bibliotheek'])]),
    cam, lib,
    busy ? el('span', { class: 'hint', role: 'status' }, [busy]) : null,
    fs.length ? th : el('span', { class: 'hint' }, ['Nog geen foto.']),
    el('div', { class: 'lbl' }, ['Staat']), staat,
    kenm,
    el('label', { for: 'note' }, ['Notitie']), ta,
    dictaat(ta),
    el('span', { class: 'hint' }, ['Dicteer alleen uw eigen notities. Neem het gesprek niet op zonder toestemming.'])
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
  var aantalBox = el('div', { class: 'stack' });
  function paintAantal() {
    aantalBox.textContent = '';
    CFG.bijzonderheden.forEach(function (b) {
      var n = bn(b), u = bAantal(b);
      if (!u || G.bijz.indexOf(n) < 0) return;
      var inp = el('input', { type: 'number', inputmode: 'numeric', min: '0', id: 'aantal-' + n, placeholder: 'Aantal' });
      inp.value = G.aantallen[n] || '';
      inp.addEventListener('input', function () { G.aantallen[n] = inp.value; save(); });
      aantalBox.appendChild(el('div', { class: 'inline' }, [el('label', { for: 'aantal-' + n }, [n + ', aantal ' + u]), inp]));
    });
  }
  paintAantal();
  app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'lbl' }, ['Bijzonderheden (meerdere mogelijk)']),
    chipGroup(CFG.bijzonderheden.map(bn), function (o) { return G.bijz.indexOf(o) >= 0; }, function (o) { toggleIn(G.bijz, o); save(); paintAantal(); }), aantalBox]));
  app.appendChild(el('div', { class: 'card' }, [el('label', { for: 'opm' }, ['Opmerkingen']), op, dictaat(op)]));
}

/* ---------- rapport ---------- */
function roomList() {
  var names = CFG.ruimtes.concat(Object.keys(G.rooms).filter(function (k) { return CFG.ruimtes.indexOf(k) < 0; }));
  return names.filter(function (n) { var r = G.rooms[n]; return fotosIn(n).length || (r && (r.note || r.staat || (r.kenm && r.kenm.length))); });
}
function payload() {
  return { versie: 5, bureau: kantoor() || null, opgenomen_door: opnemer() || null, gesprek: G.id, gestart: new Date(G.gemaakt).toISOString(),
    adres: G.adres || null, contact: G.contact || null,
    verkoper: { reden: G.reden, reden_toelichting: G.redenTekst || null, timing: G.timing || null,
      prijsverwachting: G.prijs || null, prijsbedrag_eur: G.prijsBedrag ? Number(G.prijsBedrag) : null },
    bijzonderheden: G.bijz.map(function (n) { var v = G.aantallen[n]; return { naam: n, aantal: v ? Number(v) : null }; }), opmerkingen: G.opm || null,
    ruimtes: roomList().map(function (n) { var r = G.rooms[n] || {}; return { ruimte: n, staat: r.staat || null, kenmerken: r.kenm && r.kenm.length ? r.kenm : null, notitie: r.note || null, aantal_fotos: fotosIn(n).length }; }),
    woning: { soort_object: G.woning.hoofd || null, soort: G.woning.soort || null, bouwvorm: G.woning.bouwvorm || null, nieuwbouw: G.woning.nieuwbouw, in_aanbouw: G.woning.aanbouw,
      verdiepingen: G.woning.verdiepingen || null, oprit: G.woning.oprit || null, parkeren: G.woning.parkeren },
    installaties: { verwarming: G.install.verwarming, afgifte: G.install.afgifte, warm_water: G.install.warmwater, bouwjaar_installatie: G.install.ketelBouwjaar ? Number(G.install.ketelBouwjaar) : null },
    fundering: G.fundering ? { klasse: G.fundering, toelichting: FUNDERING[G.fundering] || null } : null, energielabel: G.energielabel || null,
    gebouw: { bouwjaar: maatJson('bouwjaar'), gebruiksoppervlakte_m2: maatJson('oppervlakte') },
    openbare_bronnen: G.bag ? { bron: 'BAG via PDOK', opgehaald: G.bag.datum, postcode: G.bag.postcode, plaats: G.bag.plaats, gemeente: G.bag.gemeente,
      bouwjaar: G.bag.bouwjaar, gebruiksoppervlakte_m2: G.bag.oppervlakte, gebruiksdoel: G.bag.gebruiksdoel, lat: G.bag.lat, lon: G.bag.lon } : null,
    op_te_halen: OPHALEN };
}
function typeTekst() {
  var W = G.woning || {};
  return [W.hoofd, W.soort, W.bouwvorm].filter(Boolean).join(', ') + (W.nieuwbouw ? ', nieuwbouw' : '') + (W.aanbouw ? ', in aanbouw' : '');
}
function bijzTekst() {
  return G.bijz.map(function (n) {
    var b = CFG.bijzonderheden.filter(function (x) { return bn(x) === n; })[0], v = G.aantallen[n];
    return n + (v && b ? ' (' + v + ' ' + (bAantal(b) || '') + ')' : '');
  }).join(', ');
}
function bestandsnaam(ext) {
  var a = (G.adres || 'gesprek').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return 'Intake-' + a + '-' + new Date(G.gemaakt).toISOString().slice(0, 10) + '.' + ext;
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

function laadLogo() {
  if (!CFG.logo) return Promise.resolve(null);
  if (logoCache) return Promise.resolve(logoCache);
  return fetch(CFG.logo).then(function (r) { return r.blob(); }).then(toDataURL).then(function (u) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { logoCache = { url: u, w: im.naturalWidth, h: im.naturalHeight }; res(logoCache); };
      im.onerror = function () { res(null); }; im.src = u;
    });
  }).catch(function () { return null; });
}
function maakPdf() { return laadLogo().then(bouwPdf); }
function bouwPdf(logo) {
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

  d.setFillColor(243, 235, 228); d.rect(0, 0, W, 28, 'F');
  d.setFillColor(ac[0], ac[1], ac[2]); d.rect(0, 28, W, 0.6, 'F');
  var tx = M;
  if (logo) { var lh = 20, lw = lh * logo.w / logo.h; d.addImage(logo.url, 'PNG', M, 4, lw, lh); tx = M + lw + 5; }
  var kn = kantoor();
  d.setTextColor(INK[0], INK[1], INK[2]); d.setFont('helvetica', 'bold'); d.setFontSize(15);
  if (kn) {
    d.text(clean(kn).toUpperCase(), tx, 14);
    d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(MUT[0], MUT[1], MUT[2]); d.text('INTAKE VERKOOPGESPREK', tx, 20, { charSpace: 0.8 });
  } else { d.text('INTAKE VERKOOPGESPREK', tx, 17, { charSpace: 0.8 }); }
  y = 40;
  txt(G.adres || 'Adres onbekend', 20, true, INK, 1);
  txt(datum(G.gemaakt) + (G.contact ? '  |  ' + G.contact : ''), 10, false, MUT, opnemer() ? 1 : 2);
  if (opnemer()) txt('Opgenomen door ' + clean(opnemer()), 10, false, MUT, 2);

  sec('Verkoper');
  kv('Reden van verkoop', G.reden.join(', '));
  kv('Toelichting', G.redenTekst);
  kv('Gewenste timing', G.timing);
  kv('Prijsverwachting', [G.prijs, G.prijsBedrag ? 'EUR ' + Number(G.prijsBedrag).toLocaleString('nl-NL') : ''].filter(Boolean).join(', '));
  if (G.bijz.length) kv('Bijzonderheden', bijzTekst());
  kv('Opmerkingen', G.opm);
  if (G.bag) {
    sec('Uit openbare bronnen (BAG)');
    kv('Postcode en plaats', [G.bag.postcode, G.bag.plaats].filter(Boolean).join(' '));
    kv('Gebruiksdoel', G.bag.gebruiksdoel);
    kv('Opgehaald op', G.bag.datum);
  }
  sec('Woning');
  kv('Type', typeTekst().replace(/^, /, ''));
  kv('Bouwjaar', maatTekst('bouwjaar', ''));
  kv('Gebruiksoppervlakte', maatTekst('oppervlakte', 'm2'));
  kv('Aantal verdiepingen', G.woning.verdiepingen);
  kv('Oprit', G.woning.oprit);
  kv('Parkeren', G.woning.parkeren.join(' en ').toLowerCase());
  kv('Funderingsrisicoklasse', G.fundering ? G.fundering + (FUNDERING[G.fundering] ? ' (' + FUNDERING[G.fundering] + ')' : '') : '');
  if (G.fundering === 'D' || G.fundering === 'E') kv('Aandachtspunt', 'Bij deze klasse volgt in principe aanvullend funderingsonderzoek. Zie ' + FUNDAMENT.replace('https://', '').replace(/\/$/, '') + ' voor regie over het funderingsdossier.');
  kv('Energielabel', G.energielabel);
  kv('Verwarming', G.install.verwarming.join(', '));
  kv('Afgifte', G.install.afgifte.join(', '));
  kv('Warm water', G.install.warmwater.join(', '));
  kv('Bouwjaar installatie', G.install.ketelBouwjaar);
  kv('Nog zelf op te halen', G.energielabel ? 'WOZ-waarde' : 'energielabel, WOZ-waarde');

  var chain = Promise.resolve();
  roomList().forEach(function (n) {
    chain = chain.then(function () {
      var r = G.rooms[n] || {}, fs = fotosIn(n);
      sec(n + (r.staat ? '  -  ' + r.staat : ''));
      if (r.kenm && r.kenm.length) txt(r.kenm.join(', '), 10, false, MUT, 1.5);
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
      d.text('Gemaakt met Intake, een gratis initiatief van Bureau Wonen  |  bureau-wonen.nl  |  ' + MAIL, M, H - 8); d.text(i + ' / ' + n, W - M, H - 8, { align: 'right' });
    }
    return d.output('blob');
  });
}

function vRapport(app) {
  var p = payload(), nf = FOTOS.length;
  var dl = el('dl', { class: 'sum' }, [
    el('dt', {}, ['Adres']), el('dd', {}, [p.adres || 'Niet ingevuld']),
    G.gebouw && (G.gebouw.bouwjaar || G.gebouw.oppervlakte) ? el('dt', {}, ['Bouwjaar en oppervlakte']) : null,
    G.gebouw && (G.gebouw.bouwjaar || G.gebouw.oppervlakte) ? el('dd', {}, [[maatInfo('bouwjaar').waarde, maatInfo('oppervlakte').waarde ? maatInfo('oppervlakte').waarde + ' m²' : ''].filter(Boolean).join(', ') + (maatInfo('bouwjaar').bron === 'aangepast' || maatInfo('oppervlakte').bron === 'aangepast' ? ' (aangepast t.o.v. BAG)' : '')]) : null,
    typeTekst() ? el('dt', {}, ['Type woning']) : null, typeTekst() ? el('dd', {}, [typeTekst().replace(/^, /, '')]) : null,
    G.fundering ? el('dt', {}, ['Fundering']) : null, G.fundering ? el('dd', {}, ['Klasse ' + G.fundering + (FUNDERING[G.fundering] ? ', ' + FUNDERING[G.fundering] : '')]) : null,
    el('dt', {}, ['Reden en timing']), el('dd', {}, [p.verkoper.reden.concat(p.verkoper.timing ? [p.verkoper.timing] : []).join(', ') || 'Niet ingevuld']),
    el('dt', {}, ['Toelichting verkoper']), el('dd', {}, [p.verkoper.reden_toelichting || 'Geen']),
    el('dt', {}, ['Bijzonderheden']), el('dd', {}, [bijzTekst() || 'Geen']),
    el('dt', {}, ['Ruimtes']), el('dd', {}, [p.ruimtes.length + ' met inhoud, ' + nf + ' foto’s'])]);
  var status = el('span', { class: 'hint', role: 'status' }, ['']);
  var acties = el('div', { class: 'row' });
  if (gen) {
    acties.appendChild(el('button', { class: 'btn', type: 'button', id: 'deel', onclick: function () { track('rapport_gedeeld'); deel(gen.blob, gen.naam, 'application/pdf'); } }, ['Deel rapport']));
    status.textContent = gen.naam + ' (' + Math.round(gen.blob.size / 1024) + ' kB) staat klaar.';
  }
  acties.appendChild(el('button', { class: gen ? 'btn ghost' : 'btn', type: 'button', id: 'pdf', onclick: function (e) {
    var b = e.currentTarget; b.disabled = true; b.textContent = 'Rapport maken…';
    saveNow().then(maakPdf).then(function (blob) { gen = { blob: blob, naam: bestandsnaam('pdf') }; track('rapport_gemaakt'); render(); })
      .catch(function (err) { b.disabled = false; b.textContent = 'Maak rapport'; status.textContent = 'Rapport maken mislukte: ' + (err && err.message || err); });
  } }, [gen ? 'Maak opnieuw' : 'Maak rapport']));
  app.appendChild(el('div', { class: 'card' }, [el('h2', {}, ['Rapport']), dl, acties, status]));
}


/* ---------- menu en info ---------- */
function prose(secties) {
  var k = [];
  secties.forEach(function (x) {
    k.push(el('h3', {}, [x.k]));
    x.p.forEach(function (t) { k.push(el('p', {}, [t])); });
  });
  return el('div', { class: 'prose' }, k);
}
function jsonVan(g) {
  var oG = G, oF = FOTOS;
  return fotosVan(g.id).then(function (fs) {
    G = g; FOTOS = fs;
    if (typeof G.reden === 'string') G.reden = G.reden ? [G.reden] : [];
    G.reden = G.reden || []; G.aantallen = G.aantallen || {}; G.bijz = G.bijz || []; G.woning = G.woning || nieuwWoning(); G.install = G.install || nieuwInstall(); G.gebouw = G.gebouw || { bouwjaar: '', oppervlakte: '' };
    try { return JSON.stringify(payload(), null, 2); } finally { G = oG; FOTOS = oF; }
  });
}
function menuPagina(app) {
  var terug = menu === 'menu' ? '' : 'menu';
  app.appendChild(el('button', { class: 'back', type: 'button', id: 'terug', onclick: function () { menu = terug; render(); window.scrollTo(0, 0); } }, [menu === 'menu' ? '‹ Terug' : '‹ Menu']));
  function kop(t) { app.appendChild(el('header', {}, [el('h1', {}, [t])])); }
  if (menu === 'menu') {
    kop('Menu');
    var items = [['over', 'Over Intake', 'Wat het is en waarom'], ['instellingen', 'Instellingen', 'Uw naam en kantoor in het rapport'],
      ['export', 'Gegevens exporteren', 'JSON-bestand per gesprek'], ['privacy', 'Privacyverklaring', ''], gaId() ? ['cookies', 'Cookie-instellingen', ''] : null].filter(Boolean);
    app.appendChild(el('div', { class: 'list' }, items.map(function (i) {
      return el('button', { class: 'menuitem', type: 'button', id: 'm-' + i[0], onclick: function () { menu = i[0]; render(); window.scrollTo(0, 0); } },
        [el('span', {}, [el('b', {}, [i[1]]), i[2] ? el('span', { class: 'hint' }, [i[2]]) : null]), icoon(['M9 6l6 6-6 6'])]);
    })));
    if (window.RONDGANG_VERSION) app.appendChild(el('div', { class: 'ver' }, ['versie ' + window.RONDGANG_VERSION]));
  } else if (menu === 'over') {
    kop('Over Intake');
    var T = window.RG_TEKST.over;
    app.appendChild(el('div', { class: 'card' }, [prose(T.slice(0, 2))]));
    app.appendChild(el('div', { class: 'card' }, [prose(T.slice(2))]));
    var mailStatus = el('span', { class: 'hint', role: 'status' }, ['']);
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, ['Gebruikt u Intake?']),
      el('p', {}, ['Vindt u het leuk en handig? Stuur dan een mail en laat weten dat u het gebruikt. Dat is fijn om te weten, en uw ideeën zijn welkom.']),
      el('p', { class: 'mailadres' }, [MAIL]),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn', id: 'mail', href: 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Ik gebruik Intake'), onclick: function () { track('mail_klik', { locatie: 'over' }); } }, ['Stuur een mail']),
        el('button', { class: 'btn ghost', type: 'button', id: 'kopieer', onclick: function () {
          track('mail_klik', { locatie: 'kopieer' });
          var ok = function () { mailStatus.textContent = 'Adres gekopieerd.'; }, nee = function () { mailStatus.textContent = 'Kopiëren lukte niet. Selecteer het adres hierboven.'; };
          try { navigator.clipboard.writeText(MAIL).then(ok, nee); } catch (e) { nee(); }
        } }, ['Kopieer adres'])]),
      mailStatus]));
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, ['Wie maakt dit']),
      el('p', {}, ['Intake is gemaakt door Rogier Gerritsma, makelaar in Abcoude, als leuk initiatief. De code is open source (MIT) en staat op GitHub.']),
      el('a', { class: 'btn ghost', href: REPO, target: '_blank', rel: 'noopener' }, ['Bekijk de code'])]));
  } else if (menu === 'instellingen') {
    kop('Instellingen');
    var kn = el('input', { type: 'text', id: 'kantoor', placeholder: 'Bijvoorbeeld uw kantoornaam', autocomplete: 'organization' }); kn.value = lsGet('rg_kantoor') || '';
    kn.addEventListener('input', function () { lsSet('rg_kantoor', kn.value); gen = null; });
    var on = el('input', { type: 'text', id: 'opnemer', placeholder: 'Uw naam als makelaar/opnemer', autocomplete: 'name' }); on.value = lsGet('rg_opnemer') || '';
    on.addEventListener('input', function () { lsSet('rg_opnemer', on.value); gen = null; });
    app.appendChild(el('div', { class: 'card' }, [
      el('label', { for: 'opnemer' }, ['Uw naam (makelaar/opnemer)']), on,
      el('span', { class: 'hint' }, ['Staat in het rapport als "Opgenomen door". Laat leeg als u dit niet wilt.']),
      el('label', { for: 'kantoor' }, ['Naam kantoor']), kn,
      el('span', { class: 'hint' }, ['Staat in de kop van uw PDF-rapport. Laat leeg als u dit niet wilt. Beide namen blijven op uw toestel.'])]));
  } else if (menu === 'export') {
    kop('Gegevens exporteren');
    var box = el('div', { class: 'list' });
    app.appendChild(el('div', { class: 'card' }, [
      el('p', {}, ['Een JSON-bestand met de ingevulde gegevens van een gesprek, zonder foto’s. Handig als u de gegevens in een ander systeem wilt gebruiken, bijvoorbeeld voor uw offerte.']), box]));
    allOf('gesprekken').then(function (a) {
      a.sort(function (x, y) { return y.bijgewerkt - x.bijgewerkt; });
      if (!a.length) { box.appendChild(el('p', { class: 'hint' }, ['Nog geen gesprekken.'])); return; }
      a.forEach(function (g) {
        box.appendChild(el('div', { class: 'item' }, [
          el('div', { class: 'open static' }, [el('b', {}, [g.adres || 'Zonder adres']), el('span', { class: 'hint' }, [datum(g.bijgewerkt)])]),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () {
            track('json_gedeeld');
            jsonVan(g).then(function (t) { var tmp = G; G = g; var nm = bestandsnaam('json'); G = tmp; return deel(new Blob([t], { type: 'application/json' }), nm, 'application/json'); });
          } }, ['Deel JSON'])]));
      });
    });
  } else if (menu === 'privacy') {
    kop('Privacyverklaring');
    app.appendChild(el('div', { class: 'card' }, [prose(window.RG_TEKST.privacy), el('span', { class: 'hint' }, ['Versie van ' + window.RG_TEKST.versie + '.'])]));
  } else if (menu === 'cookies') {
    kop('Cookie-instellingen');
    var k = keuze();
    app.appendChild(el('div', { class: 'card' }, [
      el('p', {}, ['Intake meet met Google Analytics hoe de app wordt gebruikt, alleen als u dat goed vindt. We meten nooit wat u invult.']),
      el('p', {}, [el('b', {}, ['Uw keuze nu: ']), k === 'ja' ? 'meten staat aan' : k === 'nee' ? 'meten staat uit' : 'nog geen keuze']),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', type: 'button', id: 'ck-ja', onclick: function () { zetKeuze('ja'); } }, ['Prima']),
        el('button', { class: 'btn', type: 'button', id: 'ck-nee', onclick: function () { zetKeuze('nee'); } }, ['Liever niet'])]),
      el('button', { class: 'btn ghost', type: 'button', id: 'ck-wis', onclick: function () { zetKeuze(null); } }, ['Mijn cookiekeuze wissen'])]));
  }
}

function render() {
  if (stopDictaat) stopDictaat();
  var app = $('#app'), nav = $('#nav'); app.textContent = ''; nav.textContent = ''; chipEls = {};
  nav.hidden = !G || !!menu;
  app.className = 'wrap' + (G && !menu && (tab === 'rondgang' || tab === 'afronden') ? ' twee' : '');
  paintCookie();
  if (menu) { menuPagina(app); return; }
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
  document.title = 'Intake';
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
  DB = r[1]; pasToe(); laadGA();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  render();
  if (!DB) $('#app').insertBefore(el('div', { class: 'warn' }, ['Opslaan op dit toestel is niet beschikbaar (privévenster?). Gesprekken verdwijnen als u de pagina sluit.']), $('#app').firstChild);
});
window.__rondgang = { get G() { return G; }, get CFG() { return CFG; } };
})();
