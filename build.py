#!/usr/bin/env python3
"""Maakt index.html, version.js en stempelt de versie in sw.js. Draai na elke wijziging."""
import datetime, pathlib, re
root = pathlib.Path(__file__).parent
version = datetime.datetime.now().strftime('%Y%m%d%H%M')

index = '''<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rondgang</title>
<meta name="theme-color" content="#B47070">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Rondgang">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="stylesheet" href="style.css">
<style>:root{color-scheme:light dark;padding-top:env(safe-area-inset-top,0px)}</style>
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
print('gebouwd', version)
