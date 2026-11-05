# BW Intake

Een leuk, gratis initiatief van Rogier Gerritsma (makelaar, Abcoude). Open source onder de MIT-licentie, zie `LICENSE`.

BW Intake-app voor het verkoopgesprek. Losse bestanden, geen server nodig: alle gegevens blijven op het toestel.

- `index.html`, `app.js`, `style.css`: de app
- `config.json`: instellingen per makelaar (naam, kleur, ruimtes, chips)
- `sw.js`: offline-werking (versie wordt door `build.py` bijgewerkt)
- `build.py`: draai `python3 build.py` na elke wijziging (stempelt de versie, maakt `dist/`). Cloudflare draait dit zelf bij elke push naar `main` en zet de site live.
- `_headers`: security headers voor Cloudflare (CSP, HSTS e.d.), vervangt `.htaccess` (alleen nog nodig zolang de site op Plesk draait). Dezelfde uitleg als hieronder geldt: security headers (CSP, HSTS, X-Frame-Options e.d.). De CSP staat alleen de eigen site, PDOK, de energielabel-proxy en Google Analytics toe. Geen inline `<style>`/`<script>` of `style=`-attributen gebruiken. Een `config.json` of logo op een andere host (via `?config=`), of een nieuwe API, moet eerst in de CSP worden toegevoegd.
