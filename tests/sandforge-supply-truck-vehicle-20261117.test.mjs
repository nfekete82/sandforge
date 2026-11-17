import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ENGINE_KINDS,vehicleSoundMix} from '../dist/src/reborn/vehicle-soundscape.js';
import {radioProfile} from '../dist/src/reborn/unit-radio.js';
import {globalCatalogAvailability} from '../scripts/webgl-global-catalog.js';
import {vehicleDustEligible} from '../scripts/webgl-vehicle-dust.js';

const source=path=>readFileSync(path,'utf8');

test('supply truck is a vehicle across tracks, dust, diesel, radio and HUD',()=>{
 assert.equal(UNITS.supply.group,'Fahrzeuge');
 assert.deepEqual(UNITS.supply.producers,['headquarters']);
 const ground=source('scripts/webgl-ground-tracks.js');
 assert.match(ground,/const vehicle=\['rover','supply','tank','artillery'\]\.includes\(unit\.kind\)/);
 assert.match(ground,/treadFraction=\['rover','supply'\]\.includes\(kind\)/);
 const vfx=source('scripts/webgl-combat-vfx.js');
 assert.match(vfx,/const vehicleKinds=new Set\(\['tank','rover','supply','artillery'\]\)/);
 const driving={kind:'supply',moving:true,dx:8,dz:0,visible:true,
  biome:'desert',enabled:true,distanceToCamera:100,tick:3,id:0};
 assert.equal(vehicleDustEligible(driving),true);
 assert.equal(vehicleDustEligible({...driving,moving:false}),false);
 assert.equal(vehicleDustEligible({...driving,kind:'infantry'}),false);
 assert.ok(ENGINE_KINDS.includes('supply'));
 assert.equal(radioProfile('supply'),'crew');
 assert.match(source('scripts/webgl-battlefield.js'),/UNITS\[k\]\.group===category/);
 assert.match(source('scripts/webgl-battlefield.js'),/KOMMANDOZENTRALE · LOGISTIK/);
});
test('diesel only audible when physically moving within visible range',()=>{
 const moving={kind:'supply',owner:0,hp:260,id:203,x:300,y:280,
  previousX:294,previousY:280,moving:true};
 const sound=(u,visible=true)=>vehicleSoundMix({units:[u]},
  {x:280,y:280},()=>visible).supply;
 assert.ok(sound(moving).level>0);
 assert.equal(sound({...moving,previousX:moving.x}).level,0);
 assert.equal(sound(moving,false).level,0);
 assert.equal(sound({...moving,moving:false}).level,0);
});
test('completed HQ unlocks vehicle tab, but still produces the truck itself',()=>{
 const g=new Simulation(20261117,23);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 assert.equal(globalCatalogAvailability(g).vehicles,true);
 assert.equal(g.producer(0,'supply')?.id,hq.id);
 hq.buildRemaining=2;
 assert.equal(globalCatalogAvailability(g).vehicles,false);
 hq.buildRemaining=0;
 assert.equal(globalCatalogAvailability(g).vehicles,true);
});
