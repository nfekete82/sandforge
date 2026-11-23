import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,unitKinds,weaponDamage} from '../dist/src/reborn/catalog.js';

const fixture=()=>{
 const game=new Simulation(2026,8,true);
 game.aiClock=-1e8;game.units=[];game.world.blocked.fill(0);game.world.opaque.fill(0);
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
 assert.equal(f.flying,false);
 assert.ok(f.range<UNITS.tank.range);
 assert.ok(weaponDamage({kind:'flamer'},{kind:'infantry'})>
  weaponDamage({kind:'flamer'},{kind:'tank'}));
 assert.equal(weaponDamage({kind:'flamer'},{kind:'scout'}),0);
 assert.ok(weaponDamage({kind:'flamer'},{kind:'barracks',queue:[]})>0);
});

test('flame tank: makes real flame shots and damages infantry, persists in a save',()=>{
 const game=fixture();
 const flamer=game.spawn(0,{x:1600,y:1600},'flamer');
 const enemy=game.spawn(1,{x:1700,y:1600},'infantry');
 enemy.cooldown=1e8;
 game.updateVision();
 let fired=false;
 for(let i=0;i<55;i++){
  game.step();
  fired ||= game.shots.some(shot=>shot.source===flamer.id&&shot.weapon==='flame');
 }
 assert.equal(fired,true,'dedicated flame shot comes from the flame tank');
 assert.ok(enemy.hp<UNITS.infantry.hp,'infantry loses HP in close range');
 const loaded=Simulation.load(game.save());
 assert.equal(loaded.units.find(unit=>unit.id===flamer.id)?.kind,'flamer');
});
