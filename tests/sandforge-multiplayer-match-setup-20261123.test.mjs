import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignLayout,mapLayout} from '../dist/src/reborn/config.js';
import {
 planMultiplayerSetup,multiplayerStartSupported,areTeammates
} from '../dist/src/reborn/multiplayer-setup.js';

for(const version of [0,15,18,23,24,25,26]){
 for(const seed of [0,1,4101,4102,1907,314159,4294967295]){
  test(`existing two-player campaign remains identical (map ${version}, seed ${seed})`,()=>{
   const m=planMultiplayerSetup({version,seed,playerCount:2});
   assert.deepEqual(m.slots.map(s=>s.startSector),
    campaignLayout(version,seed).headquarters);
   assert.deepEqual(m.slots.map(s=>s.controller),['human','ai']);
   assert.deepEqual(m.slots.map(s=>s.team),[0,1]);
  });
 }
}
for(const version of [24,25,26]){
 for(const players of [3,4]){
  for(const seed of [4101,4102,4103,4104,1907,2026]){
   test(`real 4-corner spawns map=${version} players=${players} seed=${seed}`,()=>{
    const opts={version,seed,playerCount:players};
    const a=planMultiplayerSetup(opts);
    const b=planMultiplayerSetup(opts);
    assert.deepEqual(a,b,'replay setup must be deterministic');
    assert.equal(a.slots.length,players);
    assert.deepEqual(a.slots.map(x=>x.player),
     [...Array(players)].map((_,i)=>i));
    assert.deepEqual(a.slots.map(x=>x.controller),
     ['human',...Array(players-1).fill('ai')]);
    assert.equal(new Set(a.slots.map(s=>s.startSector)).size,players);
    assert.equal(new Set(a.slots.map(s=>s.team)).size,players);
    const {columns,rows}=mapLayout(version);
    const corners=[0,columns-1,columns*(rows-1),columns*rows-1];
    for(const s of a.slots)assert.ok(corners.includes(s.startSector));
    for(const s of a.slots)for(const t of a.slots)
     assert.equal(areTeammates(a,s.player,t.player),s.player===t.player);
   });
  }
 }
}
test('2v2 groups human with one allied bot and two independent hostile bots',()=>{
 for(const version of [24,25,26])for(const seed of [0,4101,4102,4103]){
  const s=planMultiplayerSetup({version,seed,playerCount:4,mode:'two-versus-two'});
  assert.deepEqual(s.slots.map(p=>p.team),[0,0,1,1]);
  assert.ok(areTeammates(s,0,1));
  assert.ok(areTeammates(s,2,3));
  assert.equal(areTeammates(s,0,2),false);
  const {columns,rows}=mapLayout(version);
  const coords=sector=>({x:sector%columns,y:Math.floor(sector/columns)});
  const [human,ally,enemyA,enemyB]=s.slots.map(p=>coords(p.startSector));
  const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  assert.ok(near(human,ally)<near(human,enemyB));
  assert.ok(near(enemyA,enemyB)<near(enemyA,human));
 }
});
test('small and old maps reject 3 and 4 players instead of unsafe overlapping bases',()=>{
 for(const version of [0,1,7,15,19,20,21,22,23]){
  assert.equal(multiplayerStartSupported(version),false);
  for(const n of [3,4])assert.throws(()=>
   planMultiplayerSetup({version,seed:4102,playerCount:n}),/8, 12 or 16 Bastion/);
 }
});
test('invalid presets and seeds never silently become 1v1',()=>{
 assert.throws(()=>planMultiplayerSetup({version:24,seed:-1,playerCount:4}),/32-bit/);
 assert.throws(()=>planMultiplayerSetup({version:24,seed:2.5,playerCount:3}),/32-bit/);
 assert.throws(()=>planMultiplayerSetup({version:24,seed:4102,playerCount:5}),/match sizes/);
 assert.throws(()=>planMultiplayerSetup({version:24,seed:4102,playerCount:3,mode:'two-versus-two'}),/exactly 4/);
 assert.throws(()=>planMultiplayerSetup({version:24,seed:4102,playerCount:3,mode:'other'}),/team mode/);
});
