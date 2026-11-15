import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

const create=()=>new Simulation(2074,0,false,false);
test('iddqd activates unlimited credits while normal rules remain unchanged before activation',()=>{
 const g=create();
 assert.equal(g.testMode,false);
 const old=g.credits[0];
 g.enableTestMode();
 assert.equal(g.testMode,true);
 assert.ok(g.credits[0]>100_000_000);
 assert.equal(g.enableTestMode(),false,'repeated iddqd is idempotent');
 assert.equal(g.credits[0],1_000_000_000);
 const original=create();
 assert.equal(original.testMode,false);
 assert.equal(original.credits[0],old);
 assert.equal(g.save().testMode,undefined,'cheat not part of save schema');
});

test('activation instantly completes existing player buildings but not enemy buildings',()=>{
 const g=create();
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 const site={...hq,id:9099,kind:'barracks',hp:100,buildRemaining:10,queue:[],queueTypes:[],production:0};
 const enemy={...hq,id:9100,owner:1,kind:'factory',hp:100,buildRemaining:9,queue:[],queueTypes:[],production:0};
 g.bases.push(site,enemy);
 g.enableTestMode();
 assert.equal(site.buildRemaining,0);
 assert.equal(site.hp,BUILDINGS.barracks.hp);
 assert.equal(enemy.buildRemaining,9);
 assert.equal(enemy.hp,100);
});

test('new construction in cheat mode is complete immediately and keeps all normal site validation entrypoints',()=>{
 const g=create();
 const engineer=g.spawn(0,{x:g.world.size*.5,y:g.world.size*.5},'engineer');
 g.enableTestMode();
 const t=g.territories[0],p=t.polygon.reduce((acc,v)=>({x:acc.x+v.x/t.polygon.length,y:acc.y+v.y/t.polygon.length}),{x:0,y:0});
 // Only bypass terrain in this fixture; the regular build() still consults
 // buildError and still requires a real living pioneer.
 g.buildError=()=>null;
 const b=g.build(0,'wall',p,[engineer.id]);
 assert.ok(b);
 assert.equal(b.buildRemaining,0);
 assert.equal(b.hp,BUILDINGS.wall.hp);
 assert.equal(g.credits[0],1_000_000_000);
 assert.equal(g.save().bases.find(x=>x.id===b.id)?.buildRemaining,0);
});

test('training and research complete on the next simulation tick / immediately',()=>{
 const g=create();
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 g.bases.push({...hq,id:9110,kind:'research',hp:BUILDINGS.research.hp,buildRemaining:0,
  queue:[],queueTypes:[],production:0});
 g.enableTestMode();
 assert.equal(g.startResearch(0,'armor1'),true);
 assert.ok(g.research[0].completed.includes('armor1'));
 assert.equal(g.research[0].active,null);
 assert.equal(g.recruit(hq.id,'engineer'),true);
 assert.equal(hq.queue[0],UNITS.engineer.buildTime,'canonical saved queue duration');
 assert.equal(hq.production,hq.queue[0]);
 g.paused=false;g.aiClock=-1e8;g.tactical.plan=()=>{};
 g.step(.05);
 assert.equal(hq.queue.length,0,'engineer should be produced at the next tick');
 assert.ok(g.units.some(u=>u.owner===0&&u.kind==='engineer'));
 assert.equal(g.credits[0],1_000_000_000);
 assert.equal(Simulation.load(g.save()).testMode,false,'the reloaded game resumes normally');
});

test('WebGL listens for the full iddqd code outside inputs, with the infinity HUD',()=>{
 const code=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(code,/testCode==='iddqd'/);
 assert.match(code,/typing\(\)/);
 assert.match(code,/game\.enableTestMode\(\)/);
 assert.match(readFileSync('scripts/webgl-battlefield.js','utf8'),/g\.testMode\?'∞'/);
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 assert.match(menu,/const activated=g\.enableTestMode\(\)/);
 assert.doesNotMatch(menu,/credits\[0\]\s*\+=\s*1000/);
});
