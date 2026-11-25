import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {ORDNANCE_TRAIL_SEGMENTS,ORDNANCE_VISUALS,
 ordnanceVisualKind,ordnanceVisualProfile,appendOrdnanceTrail}
 from '../scripts/webgl-ordnance-profile.js';

test('tank, six-tube artillery, infantry rocket and bomber have intentionally different visual signatures',()=>{
 assert.equal(ordnanceVisualKind({type:'antiArmor'},'tank'),'tank');
 assert.equal(ordnanceVisualKind({},'artillery'),'artillery');
 assert.equal(ordnanceVisualKind({type:'antiArmor'},'rocket'),'rocket');
 assert.equal(ordnanceVisualKind({type:'bomb'},'bomber'),'bomb');
 assert.equal(ordnanceVisualKind({},'rover'),'default');
 assert.ok(ORDNANCE_VISUALS.artillery.smokeSize>ORDNANCE_VISUALS.tank.smokeSize);
 assert.ok(ORDNANCE_VISUALS.artillery.exhaust>ORDNANCE_VISUALS.tank.exhaust);
 assert.ok(ORDNANCE_VISUALS.artillery.streak>ORDNANCE_VISUALS.tank.streak);
 assert.ok(ORDNANCE_VISUALS.bomb.impactScale>ORDNANCE_VISUALS.tank.impactScale);
 assert.equal(ordnanceVisualProfile({type:'bomb'},'tank'),ORDNANCE_VISUALS.bomb);
 assert.equal(ORDNANCE_VISUALS.bomb.muzzleFlash,0,'gravity bomb has no rocket muzzle flame');
});
test('flying-glow geometry has a strict per-projectile bound and ignores stationary subframes',()=>{
 let trail;
 for(let i=0;i<200;i++)
  trail=appendOrdnanceTrail(trail,new THREE.Vector3(i*8,0,0));
 assert.equal(trail.length,ORDNANCE_TRAIL_SEGMENTS);
 assert.equal(trail[0].x,199*8);
 assert.equal(trail.at(-1).x,(200-ORDNANCE_TRAIL_SEGMENTS)*8);
 const last=trail;
 appendOrdnanceTrail(trail,new THREE.Vector3(199*8+1,0,0));
 assert.equal(trail.length,ORDNANCE_TRAIL_SEGMENTS);
 assert.equal(trail,last);
});
test('all graphic missiles come from authoritative persisted Simulation.missiles, not fake damage',()=>{
 const fx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(fx,/this\.rocketStreaks=new THREE\.InstancedMesh/);
 assert.match(fx,/this\.bombNoses,this\.bombFinsA,this\.bombFinsB/);
 assert.match(fx,/this\.game\.missiles/);
 assert.match(fx,/this\.ordnanceKinds\.get\(blast\.id\)/);
 assert.match(fx,/this\.statsRocket\.visible=count/);
 assert.match(fx,/if\(!this\.game\.canSee\(0,\{x,y:z\}\)\)continue/);
 assert.match(fx,/this\.particle\(this\.smoke/);
 assert.match(fx,/const profile=ordnanceVisualProfile\(missile,sourceKind\)/);
 assert.match(fx,/const fires=budget\(light\?3:strong\?\(weaponKind==='bomb'\?14:11\):6\)/);
 assert.doesNotMatch(fx,/this\.game\.strike\(/);
 assert.doesNotMatch(sim,/rocketStreaks|bombFinsA|ORDNANCE_VISUALS/);
 assert.match(build,/cpSync\('scripts\/webgl-ordnance-profile\.js','dist\/webgl-ordnance-profile\.js'\)/);
 assert.ok(existsSync('dist/webgl-ordnance-profile.js'));
});
