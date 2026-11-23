import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,unitKinds,weaponDamage} from '../dist/src/reborn/catalog.js';

const fixture=()=>{
 const game=new Simulation(2026,8,true);
 game.aiClock=-1e8;game.units=[];game.world.blocked.fill(0);game.world.opaque.fill(0);
 game.stageWebGLProduction=true; // actual WebGL's 25% firearm miss-rule is enabled
 return game;
};

test('flame tank: factory-produced anti-infantry specialist, never anti-air',()=>{
 const f=UNITS.flamer;
 assert.ok(unitKinds.includes('flamer'));
 assert.equal(f.name,'Flammenpanzer');
 assert.deepEqual(f.producers,['factory']);
 assert.equal(f.cost,500);
 assert.equal(f.targetsAir,false);
 assert.equal(f.range,245,'flame jet and actual combat range must match');
 assert.equal(f.damage,60);
 assert.equal(f.cooldown,.25);
 assert.equal(f.flying,false);
 assert.ok(f.range<UNITS.tank.range);
 assert.ok(weaponDamage({kind:'flamer'},{kind:'infantry'})>
  weaponDamage({kind:'flamer'},{kind:'tank'})*10);
 assert.equal(weaponDamage({kind:'flamer'},{kind:'tank'}),4.8);
 assert.ok(weaponDamage({kind:'flamer'},{kind:'wall',queue:[]})<
  weaponDamage({kind:'flamer'},{kind:'infantry'})*.15);
 assert.equal(weaponDamage({kind:'flamer'},{kind:'scout'}),0);
 assert.ok(weaponDamage({kind:'flamer'},{kind:'barracks',queue:[]})>0);
});

test('flame tank: real flame shots are guaranteed hits, strong against infantry and survive saves',()=>{
 const game=fixture();
 const flamer=game.spawn(0,{x:1600,y:1600},'flamer');
 const enemy=game.spawn(1,{x:1700,y:1600},'infantry');
 enemy.cooldown=1e8;
 game.updateVision();
 const shots=[];
 for(let i=0;i<35;i++){
  game.step();
  for(const shot of game.shots)
   if(shot.source===flamer.id&&shot.weapon==='flame'&&!shots.includes(shot))shots.push(shot);
 }
 assert.ok(shots.length>=2,'multiple real flame shots');
 assert.ok(shots.every(shot=>shot.hit===true&&!shot.miss),
  'a visible, unblocked flame stream never randomly misses its target');
 assert.ok(shots.every(shot=>shot.groundTo?.x===enemy.x&&shot.groundTo?.y===enemy.y),
  'the heat jet is aimed at the actual infantry target');
 assert.ok(enemy.hp<=0,'regular infantry burns down very quickly');
 const loaded=Simulation.load(game.save());
 assert.equal(loaded.units.find(unit=>unit.id===flamer.id)?.kind,'flamer');
});
