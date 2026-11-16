#!/usr/bin/env node
'use strict';
// Produit un fichier HTML autonome: node war-room/bundle.js [sortie.html]
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const out = process.argv[2] || path.join(__dirname, 'war-room.single.html');
const html = r('index.html').replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + r('style.css') + '</style>')
  .replace('<script src="model.js"></script>', () => '<script>\n' + r('model.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>\n' + r('app.js') + '</script>');
fs.writeFileSync(out, html);
console.log(out);
