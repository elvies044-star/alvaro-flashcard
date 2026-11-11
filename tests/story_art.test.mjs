// Jalankan: node tests/story_art.test.mjs
import assert from 'node:assert/strict';
import { shelfOf, storyArt } from '../src/storyArt.js';

assert.deepEqual([1, 2, 3, 4, 5, 6].map(shelfOf), [0, 0, 1, 1, 2, 2]);
assert.match(storyArt({ id: 'story_b1' }, 'cover'), /art-b1/);
assert.equal(storyArt({ id: 'baru' }, 'cover'), storyArt({ id: 'baru' }, 'cover')); // warna cover tetap
assert.match(storyArt({ id: 'baru' }, 'banner'), /viewBox="0 60 400 150"/);
console.log('ok');
