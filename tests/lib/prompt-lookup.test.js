'use strict';
const assert = require('assert');
const { parseCsv, search } = require('../../scripts/super-claude/prompt-lookup');

const rows = parseCsv('act,prompt,for_devs,type,contributor\nLinux Terminal,"act as a ""terminal"",\nok",TRUE,TEXT,x\nChef,cook food,FALSE,TEXT,y\n');
assert.strictEqual(rows.length, 3);
assert.strictEqual(rows[1][1], 'act as a "terminal",\nok');
assert.strictEqual(search(rows, ['terminal'], false)[0].act, 'Linux Terminal');
assert.strictEqual(search(rows, ['cook'], true).length, 0);
console.log('prompt-lookup: ok');
