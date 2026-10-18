# Energielabel-proxy

Cloudflare Worker die de EP-Online API-sleutel (RVO) verbergt. De app vraagt `GET /label?bag=<id>` of `?postcode=..&huisnummer=..` en krijgt alleen het label terug.

- De sleutel staat als geheim `EP_KEY` in Cloudflare, nooit in deze repo.
- Alleen verzoeken vanuit intake.bureau-wonen.nl (en het oude rondgang.bureau-wonen.nl) worden beantwoord.
- Antwoorden worden 24 uur gecachet. 404 van EP-Online betekent: geen label geregistreerd.
- Uitrollen: `cd worker && npx wrangler deploy`. Sleutel instellen: `npx wrangler secret put EP_KEY`.
