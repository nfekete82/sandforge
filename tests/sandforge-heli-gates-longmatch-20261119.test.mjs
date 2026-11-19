import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BUILDINGS,buildingKinds,weaponDamage} from '../dist/src/reborn/catalog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {isWallLike,isPassableFriendlyGate,navigableBasesForFaction,WALL_GATE_UPGRADE_COST,
 wallColliderSamples,wallTerrainPlacementError} from '../dist/src/reborn/defensive-wall.js';
import {infantryStructureColliders} from '../dist/src/reborn/infantry-structure-collision.js';
import {vehicleStructureColliders} from '../dist/src/reborn/vehicle-structure-collision.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';
import {scoutRocketPodMount,attachScoutRocketPods,detachScoutRocketPods} from '../scripts/webgl-scout-rocket-pods.js';
import {createStrategicBuilding,isStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

const wallSite=(owner,kind='wall')=>({
 id:90001,owner,kind,hp:650,buildRemaining:0,x:1000,y:1000,
 facing:0,radius:24,territory:0,queue:[],queueTypes:[],production:0,
 cooldown:0,rally:null
});
const destroy=(model)=>model.traverse(o=>{
 if(o.isMesh){o.geometry?.dispose();
  for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();}
});

test('a real paid gate is a separately buildable/destructible wall-footprint type',()=>{
 assert.ok(buildingKinds.includes('wallGate'));
 assert.ok(isStrategicBuilding('wallGate'));
 assert.ok(isWallLike('wallGate')&&isWallLike('wall'));
 assert.equal(BUILDINGS.wallGate.cost,135);
 assert.equal(WALL_GATE_UPGRADE_COST,60);
 assert.ok(BUILDINGS.wallGate.hp<BUILDINGS.wall.hp);
 assert.ok(weaponDamage({kind:'rocket'},{kind:'wallGate',queue:[]})>
  weaponDamage({kind:'infantry'},{kind:'wallGate',queue:[]})*4);
 assert.equal(sitesVisuallyOverlap('wallGate',{x:1000,y:1000},0,
  'wall',{x:1109,y:1000},0),false,'gate can join existing wall ends');
 assert.equal(sitesVisuallyOverlap('wallGate',{x:1000,y:1000},0,
  'wall',{x:1060,y:1000},0),true);
});

test('only a finished OWN gate is navigable; an enemy gate remains physically solid',()=>{
 const own=wallSite(0,'wallGate'),enemy=wallSite(1,'wallGate');
 enemy.id++;enemy.x=1450;
 const work=wallSite(0,'wallGate');work.id=90003;work.x=1800;work.buildRemaining=3;
 assert.ok(isPassableFriendlyGate(own,0));
 assert.equal(isPassableFriendlyGate(own,1),false);
 assert.equal(isPassableFriendlyGate(work,0),false);
 const sites=[own,enemy,work,wallSite(0)];
 const blue=navigableBasesForFaction(sites,0),red=navigableBasesForFaction(sites,1);
 assert.ok(!blue.includes(own)&&blue.includes(enemy)&&blue.includes(work));
 assert.ok(!red.includes(enemy)&&red.includes(own)&&red.includes(work));
 assert.equal(vehicleStructureColliders([enemy]).length,3);
 assert.equal(infantryStructureColliders([enemy]).length,3);
 assert.deepEqual(wallColliderSamples(own).map(c=>c.radius),[24,24,24]);
 // The gate arrays themselves are the authority; no unrelated x/y test.
});

test('upgrade preserves wall identity, position, owner and facing and charges real credits',()=>{
 const g=new Simulation(2026,24);
 const wall=wallSite(0);wall.facing=2;
 g.bases.push(wall);g.credits[0]=120;
 assert.equal(g.convertWallToGate(0,wall.id),true);
 assert.equal(wall.kind,'wallGate');assert.equal(wall.facing,2);
 assert.equal(wall.x,1000);assert.equal(wall.y,1000);
 assert.equal(g.credits[0],60);
 assert.ok(wall.hp<BUILDINGS.wallGate.hp&&wall.hp>0);
 assert.ok(!g.navigationBases(0).includes(wall));
 assert.ok(g.navigationBases(1).includes(wall));
 assert.equal(g.convertWallToGate(0,wall.id),false,'no double conversion');
 const enemy=wallSite(1);enemy.id++;
 g.bases.push(enemy);
 assert.equal(g.convertWallToGate(0,enemy.id),false,'never upgrade enemy wall');
 const locked=wallSite(0);locked.id=90003;locked.buildRemaining=4;
 g.bases.push(locked);
 assert.equal(g.convertWallToGate(0,locked.id),false,'unfinished wall stays wall');
});

test('own troops can cross a completed gate, enemies cannot even when it visually opens',()=>{
 const g=new Simulation(2026,24);
 g.world.blocked.fill(0);
 const site=wallSite(0,'wallGate');
 g.bases.push(site);
 const approach={x:site.x,y:site.y-85},destination={x:site.x,y:site.y+85};
 // Runtime's actual player/nav collision lists use faction-specific bases.
 const friendly=infantryStructureColliders(g.navigationBases(0));
 const hostile=infantryStructureColliders(g.navigationBases(1));
 assert.ok(g.world.line(approach,destination,friendly));
 assert.ok(!g.world.line(approach,destination,hostile));
 const enemyGate=wallSite(1,'wallGate');enemyGate.x=1650;enemyGate.id++;
 g.bases.push(enemyGate);
 assert.equal(g.navigationBases(0).includes(enemyGate),true);
 assert.equal(g.navigationBases(1).includes(enemyGate),false);
});

test('gate placement inherits the old wall protection against rock and cliffs',()=>{
 const g=new Simulation(2026,24);
 g.world.blocked.fill(0);
 g.world.terrainSlope=()=>.39;
 g.world.terrainHeight=x=>x*.39;
 const candidate={x:g.world.size*.6,y:g.world.size*.45};
 assert.equal(wallTerrainPlacementError(g.world,candidate,0),null);
 const rock={x:candidate.x+9,y:candidate.y};
 g.world.blocked[g.world.index(rock)]=1;
 assert.match(wallTerrainPlacementError(g.world,candidate,0),/Felsen|Bergwand/);
});

test('real 3D wall has one merged barbed-wire mesh and gate has moveable leaves',()=>{
 const wall=createStrategicBuilding('wall',0),gate=createStrategicBuilding('wallGate',0);
 assert.ok(wall.getObjectByName('WallArmoredPanel'));
 const wire=wall.getObjectByName('Wall_3D_BarbedWire_Coils');
 assert.ok(wire?.isMesh);
 assert.equal(wire.userData.barbedWire,true);
 assert.ok(wire.geometry.attributes.position.count<20000);
 const doors=gate.userData.gateLeaves;
 assert.ok(Array.isArray(doors)&&doors.length===2);
 assert.ok(doors.every(leaf=>leaf.isGroup));
 assert.ok(doors[0].position.x<0&&doors[1].position.x>0);
 const gateWire=gate.getObjectByName('Wall_3D_BarbedWire_Coils');
 assert.ok(gateWire?.isMesh);
 const xs=gateWire.geometry.attributes.position;
 for(let i=0;i<xs.count;i++)
  assert.ok(Math.abs(xs.getX(i))>40,'no barbed wire across passable gate center');
 doors[0].rotation.y=-1.3;doors[1].rotation.y=1.3;
 assert.notEqual(doors[0].rotation.y,doors[1].rotation.y);
 destroy(wall);destroy(gate);
});

test('helicopter pods are a matched mirrored pair; tail rotor pivots closer to the fin',()=>{
 const left=scoutRocketPodMount(-1),right=scoutRocketPodMount(1);
 assert.ok(left.x<0&&right.x>0&&right.x<Math.abs(left.x));
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 const pods=entry.scoutRocketPods.children;
 assert.equal(pods.length,2);
 assert.equal(pods[0].scale.x,-1);
 assert.equal(pods[1].scale.x,1);
 assert.equal(pods[0].children.length,pods[1].children.length);
 assert.deepEqual(entry.scoutRocketMuzzles.map(m=>m.position.z),[8.3,8.3]);
 detachScoutRocketPods(entry);
 assert.equal(entry.scoutRocketPods,undefined);
 const author=readFileSync('scripts/animation/transport-helicopter.js','utf8');
 assert.match(author,/tail\.position\.set\(-\.33,5\.42,-7\.62\)/);
 const runtime=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(runtime,/rotor\.position\.z=-7\.62/);
});

test('500-second VFX hotspot no longer allocates particle and emitter arrays on each render frame',()=>{
 const source=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 assert.match(source,/this\.pools=\[this\.smoke/);
 assert.match(source,/const particles=pool\.particles/);
 assert.match(source,/particles\.length=k/);
 assert.doesNotMatch(source,/pool\.particles=alive/);
 assert.doesNotMatch(source,/this\.shocks=this\.shocks\.filter/);
 assert.doesNotMatch(source,/if\(!units\.some\(u=>u\.id===id/);
 assert.match(source,/if\(emitted>=6\)continue/);
 const renderer=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(renderer,/data-action="gate-upgrade"/);
 assert.match(renderer,/gate\.userData\?\.gateLeaves|userData\?\.gateLeaves/);
});
