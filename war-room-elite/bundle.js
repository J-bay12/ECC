#!/usr/bin/env node
'use strict';
// Fragment pour l'outil Artifact: node war-room-elite/bundle.js [sortie.html]
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const out = process.argv[2] || path.join(__dirname, 'war-room-elite.artifact.html');
const html = r('index.html').replace('/*STYLE*/', () => r('style.css')).replace('/*I18N*/', () => r('i18n.js')).replace('/*ENGINE*/', () => r('engine.js')).replace('/*OPT*/', () => r('optimizer.js')).replace('/*INTEL*/', () => r('intel.js')).replace('/*APP*/', () => r('app.js'));
fs.writeFileSync(out, html); console.log(out, html.length);
