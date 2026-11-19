import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {SCOUT_ROCKETS,scoutRocketReady,scoutRocketDamage} from '../dist/src/reborn/scout-rockets.js';
import {attachScoutRocketPods,detachScoutRocketPods} from '../scripts/webgl-scout-rocket-pods.js';
import {ordnanceVisualKind,ordnanceVisualProfile} from '../scripts/webgl-ordnance-profile.js';

function setup(){
 const game=new Simulation(2026,24);
 const origin=game.units.find(u=>u.owner===0);
 assert.ok(origin);
 const source={x:origin.x,y:origin.y};
 const helicopter=game.spawn(0,source,'scout');
 const target=game.spawn(1,{x:origin.x+85,y:origin.y},'rover');
 game.visible[0].fill(1);
 game.spatial.rebuild(game.units);
 return {game,helicopter,target};
}

test('Transportheli is +27% faster while MG and passenger capacity stay unchanged',()=>{
 assert.equal(UNITS.scout.speed,280);
 assert.equal(UNITS.scout.damage,18);
 assert.equal(UNITS.scout.cooldown,.6);
 assert.equal(UNITS.scout.range,200);
 assert.ok(UNITS.scout.speed<UNITS.bomber.speed);
 assert.equal(SCOUT_ROCKETS.maxAmmo,6);
 assert.equal(SCOUT_ROCKETS.cooldown,9);
});

test('light rockets have small, infantry/structure-attenuated ground splash',()=>{
 const at0=scoutRocketDamage({kind:'rover'},SCOUT_ROCKETS.damage,0);
 const infantry=scoutRocketDamage({kind:'infantry'},SCOUT_ROCKETS.damage,0);
 const structure=scoutRocketDamage({kind:'headquarters',queue:[]},SCOUT_ROCKETS.damage,0);
 assert.equal(at0,40);assert.equal(infantry,22);assert.equal(structure,12);
 assert.equal(scoutRocketDamage({kind:'bomber'},40,0),0);
 assert.equal(scoutRocketDamage({kind:'rover'},40,SCOUT_ROCKETS.blastRadius+1),0);
});

test('one true projectile, separate cooldown, six paid shots, no invisible instant damage',()=>{
 const {game,helicopter,target}=setup();
 const hp=target.hp;
 game.fireScoutRocket(helicopter,target);
 assert.equal(game.missiles.length,1);
 assert.equal(game.missiles[0].type,'scoutRocket');
 assert.ok(game.missiles[0].impactAt>game.time);
 assert.equal(target.hp,hp);
 assert.equal(helicopter.rocketAmmo,5);
 assert.equal(helicopter.rocketCooldown,9);
 assert.equal(helicopter.cooldown,0,'the MG keeps its own independent clock');
 game.fireScoutRocket(helicopter,target);
 assert.equal(game.missiles.length,1,'cooldown prevents firing again immediately');
 for(let i=0;i<5;i++){
  helicopter.rocketCooldown=0;
  game.fireScoutRocket(helicopter,target);
 }
 assert.equal(helicopter.rocketAmmo,0);
 assert.equal(game.missiles.length,6);
 helicopter.rocketCooldown=0;
 game.fireScoutRocket(helicopter,target);
 assert.equal(game.missiles.length,6,'ammunition is finite');
});

test('occasional defensive fire during movement does not cancel transport orders',()=>{
 const {game,helicopter,target}=setup();
 const goal={kind:'move',x:helicopter.x+150,y:helicopter.y+200};
 helicopter.orders=[goal];
 game.fireScoutRocket(helicopter,undefined);
 assert.equal(game.missiles.length,1);
 assert.equal(helicopter.orders[0],goal);
 assert.equal(game.missiles[0].to.x,target.x);
 assert.equal(game.missiles[0].to.y,target.y);
});

test('no rockets while landing, without visibility or against aircraft',()=>{
 const {game,helicopter,target}=setup();
 helicopter.transport={phase:'landing'};
 assert.equal(scoutRocketReady(helicopter,85,target),false);
 helicopter.transport=undefined;
 game.visible[0].fill(0);
 game.fireScoutRocket(helicopter,target);
 assert.equal(game.missiles.length,0);
 game.visible[0].fill(1);
 const aircraft=game.spawn(1,{x:helicopter.x+35,y:helicopter.y},'bomber');
 game.fireScoutRocket(helicopter,aircraft);
 assert.equal(game.missiles.length,0);
});

test('full-HP helicopter can dock and restock six rockets at 12 credits each',()=>{
 const {game,helicopter}=setup();
 const base=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(base);
 base.kind='airfield';base.buildRemaining=0;
 helicopter.rocketAmmo=0;
 const before=game.credits[0]=250;
 assert.equal(game.requestAirfieldRepair([helicopter.id]),1);
 assert.equal(helicopter.airfieldService?.phase,'approach');
 helicopter.airfieldService.phase='repair';
 game.advanceAirfieldService(helicopter,.05);
 assert.equal(helicopter.rocketAmmo,6);
 assert.equal(helicopter.airfieldService?.phase,'ready');
 assert.equal(game.credits[0],before-6*SCOUT_ROCKETS.rearmCost);
});

test('ammo, separate clock and in-flight rockets round-trip in v2 saves',()=>{
 const {game,helicopter,target}=setup();
 game.fireScoutRocket(helicopter,target);
 const saved=game.save();
 assert.equal(saved.units.find(u=>u.id===helicopter.id)?.rocketAmmo,5);
 assert.equal(saved.missiles.at(-1)?.type,'scoutRocket');
 const restored=Simulation.load(saved);
 assert.equal(restored.units.find(u=>u.id===helicopter.id)?.rocketAmmo,5);
 assert.equal(restored.units.find(u=>u.id===helicopter.id)?.rocketCooldown,9);
 assert.equal(restored.missiles.at(-1)?.type,'scoutRocket');
});

test('two visual rocket pods attach to real actor and release only owned meshes',()=>{
 const actor={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(actor);
 assert.equal(actor.scoutRocketMuzzles?.length,2);
 assert.equal(actor.node.children.length,1);
 assert.ok(actor.scoutRocketPods.getObjectByName('ScoutRocketMuzzle_0'));
 detachScoutRocketPods(actor);
 assert.equal(actor.node.children.length,0);
 assert.equal(actor.scoutRocketMuzzles,undefined);
});

test('small rocket profile is distinct from artillery and bombing impact',()=>{
 const missile={type:'scoutRocket'};
 assert.equal(ordnanceVisualKind(missile,'scout'),'scoutRocket');
 assert.ok(ordnanceVisualProfile(missile,'scout').body<ordnanceVisualProfile({},'artillery').body);
 assert.ok(ordnanceVisualProfile(missile,'scout').impactScale<.6);
});
