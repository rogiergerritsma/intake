#!/usr/bin/env python3
"""Maakt index.html, version.js en stempelt de versie in sw.js. Draai na elke wijziging."""
import datetime, pathlib, re
root = pathlib.Path(__file__).parent
version = datetime.datetime.now().strftime('%Y%m%d%H%M')

index = '''<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>BW Intake</title>
<meta name="theme-color" content="#B47070">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="BW Intake">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="stylesheet" href="style.css">
</head><body>
<div class="wrap" id="app"></div>
<nav id="nav" hidden></nav>
<div id="cookie" role="region" aria-label="Cookies" hidden></div>
<script src="version.js"></script>
<script src="teksten.js"></script>
<script src="vendor/jspdf.umd.min.js"></script>
<script src="app.js"></script>
</body></html>
'''
(root / 'index.html').write_text(index)
(root / 'version.js').write_text(f"window.RONDGANG_VERSION='{version}';\n")
sw = (root / 'sw.js').read_text()
sw = re.sub(r"var V = 'rondgang-[^']*';", f"var V = 'rondgang-{version}';", sw)
(root / 'sw.js').write_text(sw)

# Cloudflare: alleen wat de site nodig heeft in dist/ zetten (geen worker/, README, .git e.d.).
import shutil
dist = root / 'dist'
if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()
for naam in ['index.html', 'app.js', 'teksten.js', 'version.js', 'sw.js', 'style.css', 'config.json',
             'manifest.webmanifest', 'logo.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', '_headers']:
    shutil.copy(root / naam, dist / naam)
shutil.copytree(root / 'fonts', dist / 'fonts')
shutil.copytree(root / 'vendor', dist / 'vendor')
print('gebouwd', version)
