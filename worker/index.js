// Intake - energielabel-proxy (Cloudflare Worker)
// Houdt de EP-Online API-sleutel (RVO) uit de app. De sleutel staat alleen als geheim EP_KEY in Cloudflare.
// Geeft per adres alleen het energielabel en een paar basisgegevens terug. Geen logging van adressen.

const API = 'https://public.ep-online.nl/api/v5/PandEnergielabel/';
const TOEGESTAAN = ['https://intake.bureau-wonen.nl'];

function cors(origin) {
  const ok = TOEGESTAAN.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : TOEGESTAAN[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(obj, status, origin, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(origin), extra || {}),
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return json({ fout: 'methode niet toegestaan' }, 405, origin);
    if (!TOEGESTAAN.includes(origin)) return json({ fout: 'niet toegestaan' }, 403, origin);

    const u = new URL(request.url);
    if (u.pathname !== '/label') return json({ fout: 'niet gevonden' }, 404, origin);

    const bag = (u.searchParams.get('bag') || '').trim();
    const postcode = (u.searchParams.get('postcode') || '').toUpperCase().replace(/\s/g, '');
    const huisnummer = (u.searchParams.get('huisnummer') || '').trim();
    const huisletter = (u.searchParams.get('huisletter') || '').trim();
    const toevoeging = (u.searchParams.get('toevoeging') || '').trim();

    let url;
    if (/^[0-9]{16}$/.test(bag)) {
      url = API + 'AdresseerbaarObject/' + bag;
    } else if (/^[1-9][0-9]{3}[A-Z]{2}$/.test(postcode) && /^[1-9][0-9]{0,4}$/.test(huisnummer)) {
      url = API + 'Adres?postcode=' + postcode + '&huisnummer=' + huisnummer;
      if (/^[a-zA-Z]$/.test(huisletter)) url += '&huisletter=' + huisletter;
      if (/^[a-zA-Z0-9]{4}$/.test(toevoeging)) url += '&huisnummertoevoeging=' + toevoeging;
    } else {
      return json({ fout: 'ongeldige invoer' }, 400, origin);
    }

    // 24 uur cache per adres (zonder sleutel in de cache-sleutel)
    const cache = caches.default;
    const cacheKey = new Request('https://cache.intake.invalid/' + encodeURIComponent(url));
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, { status: hit.status, headers: Object.assign({}, Object.fromEntries(hit.headers), cors(origin)) });

    let r;
    try {
      r = await fetch(url, { headers: { Authorization: env.EP_KEY, Accept: 'application/json' } });
    } catch (e) {
      return json({ fout: 'EP-Online niet bereikbaar' }, 502, origin);
    }
    if (r.status === 404) {
      const leeg = json({ label: null, bron: 'EP-Online (RVO)' }, 200, origin, { 'Cache-Control': 'public, max-age=86400' });
      ctx.waitUntil(cache.put(cacheKey, leeg.clone()));
      return leeg;
    }
    if (!r.ok) return json({ fout: 'EP-Online gaf status ' + r.status }, 502, origin);

    const lijst = await r.json();
    const nu = Date.now();
    const geldig = (Array.isArray(lijst) ? lijst : []).filter(function (x) { return x.Energieklasse && (!x.Geldig_tot || Date.parse(x.Geldig_tot) >= nu); });
    geldig.sort(function (a, b) { return Date.parse(b.Registratiedatum || 0) - Date.parse(a.Registratiedatum || 0); });
    const p = geldig[0];
    const uit = p
      ? { label: p.Energieklasse, geldig_tot: p.Geldig_tot || null, registratiedatum: p.Registratiedatum || null, opnamedatum: p.Opnamedatum || null,
          gebouwtype: p.Gebouwtype || null, bouwjaar: p.Bouwjaar || null, gebruiksoppervlakte: p.Gebruiksoppervlakte_thermische_zone || null, bron: 'EP-Online (RVO)' }
      : { label: null, bron: 'EP-Online (RVO)' };
    const res = json(uit, 200, origin, { 'Cache-Control': 'public, max-age=86400' });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
