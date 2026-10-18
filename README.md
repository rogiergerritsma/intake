# Intake

Een leuk, gratis initiatief van Rogier Gerritsma (makelaar, Abcoude). Open source onder de MIT-licentie, zie `LICENSE`.

Intake-app voor het verkoopgesprek. Losse bestanden, geen server nodig: alle gegevens blijven op het toestel.

- `index.html`, `app.js`, `style.css`: de app
- `config.json`: instellingen per makelaar (naam, kleur, ruimtes, chips)
- `sw.js`: offline-werking (versie wordt door `build.py` bijgewerkt)
- `build.py`: draai `python3 build.py` na elke wijziging, dan pusht Plesk de nieuwe versie door
