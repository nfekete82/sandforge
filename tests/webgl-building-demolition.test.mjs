import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {SandforgeBuildingCollapse,BUILDING_COLLAPSE_DURATION}
 from '../scripts/webgl-building-collapse.js';

const src=path=>readFileSync(path,'utf8');
const site=(id,owner=0,kind='generator',construction=0)=>({
 id,kind,owner,x:700,y:700,hp:260,buildRemaining:construction,
 territory:0,radius:38,queue:[.5],queueTypes:['engineer'],
 queueCosts:[150],production:0,cooldown:0,rally:{x:900,y:900}
});

test('demolition only removes owned buildings, releases collision and stops income',()=>{
 const g=new Simulation(2074,4);g.status='playing';
 const b=site(98764);g.bases.push(b);
 const before=g.credits[0],oldIncome=g.income(0);
 assert.ok(oldIncome>0);
 assert.equal(g.demolishBuilding(b.id,1),false,'enemy may not demolish ours');
 assert.equal(g.demolishBuilding(b.id,0),true);
 assert.ok(!g.bases.some(x=>x.id===b.id));
 assert.equal(g.credits[0],before,'no refund for completed structures');
 assert.equal(g.demolishBuilding(b.id,0),false,'idempotent removal');
 assert.equal(g.income(0),oldIncome-BUILDINGS.generator.income);
 assert.ok(g.notices.some(x=>x.includes('abgerissen')));
});

test('unfinished building cancellation keeps existing 75% refund, no new economy exploit',()=>{
 const g=new Simulation(2074,4);g.status='playing';
 const b=site(98765,0,'generator',3);
 g.bases.push(b);
 const before=g.credits[0];
 assert.equal(g.demolishBuilding(b.id,0),true);
 assert.equal(g.credits[0],before+Math.floor(BUILDINGS.generator.cost*.75));
 assert.ok(!g.bases.some(x=>x.id===b.id));
});

test('demolishing a busy factory clears staged releases and stale build orders',()=>{
 const g=new Simulation(2074,4);g.status='playing';
 const b=site(98766,0,'factory');g.bases.push(b);
 const actor=g.spawn(0,{x:1200,y:1200},'engineer');
 actor.orders=[{kind:'build',target:b.id,x:b.x,y:b.y}];
 actor.workingTarget=b.id;
 g.productionReleases.push({baseId:b.id,unitId:actor.id,kind:'engineer',
  owner:0,at:0,from:{x:700,y:700},to:{x:760,y:760}});
 assert.equal(g.demolishBuilding(b.id,0),true);
 assert.equal(g.productionReleases.filter(e=>e.baseId===b.id).length,0);
 assert.equal(actor.workingTarget,null);
 assert.ok(actor.orders.every(o=>o.target!==b.id));
 assert.ok(!g.obstacles().some(o=>o.id===b.id));
});

test('actual building snapshot collapses, produces debris and releases GPU ownership',()=>{
 const scene=new THREE.Scene(),entry=new THREE.Group();
 entry.position.set(25,12,45);scene.add(entry);
 const detail=new THREE.Group();entry.add(detail);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(22,18,22),
  new THREE.MeshStandardMaterial({color:'#9c9883',roughness:.91}));
 wall.name='ActualBuildingWall';detail.add(wall);
 scene.updateMatrixWorld(true);
 const collapse=new SandforgeBuildingCollapse(scene);
 const b=site(1234);
 assert.equal(collapse.spawn({node:entry,detail,kind:'generator'},b),true);
 assert.equal(collapse.effects.size,1);
 const fx=[...collapse.effects][0];
 const snapshot=fx.snapshot.copy;
 const copy=snapshot.getObjectByName('ActualBuildingWall');
 assert.ok(copy);
 assert.notEqual(copy.geometry,wall.geometry);
 assert.notEqual(copy.material,wall.material);
 assert.equal(fx.chunks.length,14);
 assert.equal(fx.ring.name,'DemolitionDustRing');
 assert.equal(snapshot.userData.nonPlayable,true);
 collapse.update(.15,false);
 assert.equal(fx.age,0,'tactical pause freezes destruction animation');
 collapse.update(.15,true);
 assert.ok(snapshot.scale.y<1);
 for(let i=0;i<16;i++)collapse.update(.15,true);
 assert.equal(collapse.effects.size,0,'fragments get cleaned after 1.65s');
 assert.ok(!scene.children.includes(snapshot));
 assert.ok(!scene.children.includes(fx.root));
 collapse.dispose();wall.geometry.dispose();wall.material.dispose();
});

test('selection HUD has only demolition for ordinary buildings, never for units or enemy bases',()=>{
 const html=src('scripts/webgl-classic-hud.js');
 const battle=src('scripts/webgl-battlefield.js');
 const sim=src('src/reborn/simulation.ts');
 const build=src('scripts/build.mjs');
 assert.match(html,/data-action="demolish"/);
 assert.match(battle,/const buildingSelected=Boolean\(base&&chosen\.length===0\)/);
 assert.match(battle,/const ownBuilding=Boolean\(buildingSelected&&base\.owner===0\)/);
 assert.match(battle,/button\.hidden=!ownBuilding/);
 assert.match(battle,/if\(action==='demolish'\)/);
 assert.match(battle,/this\.confirmDialog\.ask\(\{/);
 assert.doesNotMatch(battle,/window\.confirm\(/);
 assert.match(build,/webgl-confirm-dialog\.js/);
 assert.match(battle,/this\.game\.demolishBuilding\(baseId,0\)/);
 assert.match(battle,/this\.buildingCollapse\.spawn\(entry,current\)/);
 assert.match(battle,/this\.buildingCollapse\.update\(dt,active\)/);
 assert.match(sim,/demolishBuilding\(id:number,owner:Faction=0\)/);
 assert.match(build,/dist\/webgl-building-collapse\.js/);
});
