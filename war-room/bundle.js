#!/usr/bin/env node
'use strict';
// Fichier HTML autonome: node war-room/bundle.js [sortie.html]; avec --artifact, fragment pour l'outil Artifact.
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const art = process.argv.includes('--artifact');
const out = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || path.join(__dirname, 'war-room.single.html');
const html = r('index.html').replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + r('style.css') + '</style>')
  .replace('<script src="model.js"></script>', () => '<script>\n' + r('model.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>\n' + r('app.js') + '</script>');
if (art) {
  const body = r('index.html').split('<body>')[1].split('</body>')[0];
  const page = '<title>War Room</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">\n<style>\n' + r('style.css') + '</style>\n' + body.replace('<script src="model.js"></script>', () => '<script>\n' + r('model.js') + '</script>').replace('<script src="app.js"></script>', () => '<script>\n' + r('app.js') + '</script>');
  fs.writeFileSync(out, page);
} else fs.writeFileSync(out, html);
console.log(out);
