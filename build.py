#!/usr/bin/env python3
"""Maakt index.html (zelfstandige app), sw.js (met versie) en artifact/ (proefversie) uit de bronbestanden."""
import datetime, pathlib, shutil
root = pathlib.Path(__file__).parent
version = datetime.datetime.now().strftime('%Y%m%d%H%M')

fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&display=swap">'
body = '''<div class="wrap" id="app"></div>
<nav id="nav" hidden></nav>
<script src="vendor/jspdf.umd.min.js"></script>
<script src="app.js"></script>'''

index = f'''<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rondgang</title>
<meta name="theme-color" content="#1f6b4f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Rondgang">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
{fonts}
<link rel="stylesheet" href="style.css">
<style>:root{{color-scheme:light dark;padding-top:env(safe-area-inset-top,0px)}}</style>
</head><body>
{body}
</body></html>
'''
(root / 'index.html').write_text(index)

sw = (root / 'sw.js').read_text()
import re
sw = re.sub(r"var V = 'rondgang-[^']*';", f"var V = 'rondgang-{version}';", sw)
(root / 'sw.js').write_text(sw)

# proefversie als artifact: alleen de inhoud, zonder doctype/head
art = root / 'artifact'
shutil.rmtree(art, ignore_errors=True)
(art / 'vendor').mkdir(parents=True)
page = f'''<title>Rondgang</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<link rel="stylesheet" href="style.css">
{body}
'''
(art / 'rondgang.html').write_text(page)
for f in ['style.css', 'app.js', 'config.json']:
    shutil.copy(root / f, art / f)
shutil.copy(root / 'vendor/jspdf.umd.min.js', art / 'vendor/jspdf.umd.min.js')
print('gebouwd', version)
