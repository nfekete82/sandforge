import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
const game=readFileSync('scripts/webgl-preview.js','utf8');
test('local 3D browser can compare the same world with --ai33 off/adaptive',()=>{
 assert.match(menu,/params\.set\('ai33',query\.get\('ai33'\)\)/);
 assert.match(game,/game\.tactical\.ai33Mode=query\.get\('ai33'\)/);
 assert.match(game,/query\.get\('ai33'\)==='off'/);
 assert.match(game,/query\.get\('ai33'\)==='adaptive'/);
 assert.match(menu,/query\.get\('ai33'\)==='off'/);
 assert.doesNotMatch(menu,/localStorage\.setItem\(['"]ai33/,'AI experiments never overwrite production saved state');
});
