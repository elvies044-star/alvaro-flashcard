// Jalankan: node tests/part_groups.test.mjs
import assert from 'node:assert/strict';
import { partGroups } from '../src/partGroups.js';

const deck = (id, zh, idn = 'x', extra = {}) => ({ id, zh, idn, color: '#000000', ...extra });

const [g] = partGroups([deck('all', 'novice'), deck('p10', 'novice part 10'), deck('p2', 'novice part 2')]);
assert.equal(g.parent.id, 'all');
assert.deepEqual(g.parts.map((d) => d.id), ['p2', 'p10']); // urut angka, bukan teks

assert.equal(partGroups([deck('a', 'novice part 1')]).length, 0); // satu part tetap kartu biasa
assert.equal(partGroups([deck('a', 'n part 1', 'x'), deck('b', 'n part 2', 'y')]).length, 0); // arti beda
assert.equal(partGroups([deck('a', 'tocfl novice', 'alvaro ec part 2')]).length, 0); // "part" di arti diabaikan
assert.equal(partGroups([deck('a', 'n part 1', 'x', { hskLevel: 1 }), deck('b', 'n part 2', 'x', { speak: true })]).length, 0);

const words = partGroups([deck('kk10', '动词'), deck('kk2', '动词'), deck('ks1', '形容词'), deck('kkx', 'lain'), deck('kk', 'lain')]);
assert.deepEqual(words.map((w) => w.key), ['kk']); // ks hanya satu part, kkx dan kk bukan part
assert.deepEqual(words[0].parts.map((d) => d.id), ['kk2', 'kk10']);
assert.equal(words[0].icon, 'barbell');
console.log('ok');
