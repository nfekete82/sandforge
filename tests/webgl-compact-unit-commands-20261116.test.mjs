import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {visibleFriendlyUnits,sameKindVisibleUnits} from '../scripts/webgl-double-click-select.js';
import {FIELD_UNIT_COMMANDS,returnBaseForUnit,orderReturnToBase}
 from '../scripts/webgl-unit-commands.js';

function arena(){
 const g=new Simulation(2026,4);
 g.units=[];g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 return g;
}
const step=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)g.step(.05);};

test('exactly STOPP, ZUR BASIS, ALLE in generic troop command toolbar',()=>{
 assert.deepEqual(FIELD_UNIT_COMMANDS,['stop','return-base','select-all']);
 const html=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const start=html.indexOf('<div class="commands" id="sf-command-buttons">');
 const end=html.indexOf('</div>',start);
 const markup=html.slice(start,end);
 const common=[...markup.matchAll(/<button data-action="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(common.slice(0,3),FIELD_UNIT_COMMANDS);
 assert.ok(!common.includes('select-engineer')&&!common.includes('attack')&&!common.includes('cancel'));
 const view=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(view,/else if\(chosen.length\)button.hidden=!FIELD_UNIT_COMMANDS.includes\(a\)/);
 assert.match(view,/if\(action==='select-all'\)this.selectVisibleFriendlyOnScreen\(\)/);
 assert.match(view,/this.game.stop\(units.map\(u=>u.id\),true,true\)/);
 assert.match(view,/const result=orderReturnToBase\(this.game,\[\.\.\.this.selected\]\)/);
 assert.match(view,/class="sf-passenger-unload-all" data-action="unload"/,
  'passengers still unload individually or together, outside troop toolbar');
 assert.ok(!markup.includes('data-action="unload"'));
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/cpSync\('scripts\/webgl-unit-commands.js','dist\/webgl-unit-commands.js'\)/);
});

test('ALLE selects only visible alive friendly units on current screen, not whole map',()=>{
 const units=[
  {id:1,kind:'infantry',owner:0,hp:100},
  {id:2,kind:'tank',owner:0,hp:300},
  {id:3,kind:'tank',owner:0,hp:300},
  {id:4,kind:'infantry',owner:1,hp:100},
  {id:5,kind:'infantry',owner:0,hp:0},
  {id:6,kind:'infantry',owner:0,hp:100,carrier:40},
  {id:7,kind:'medic',owner:0,hp:100},
  {id:8,kind:'rocket',owner:0,hp:100}
 ];
 const entries=new Map(units.map((u,i)=>[u.id,{
  node:{visible:u.id!==7,position:{
   x:i===2?1.2:i===7?.1:0,
   y:i===1?.2:0,z:0
  }}
 }]));
 const selected=visibleFriendlyUnits(units,entries,{
  project:node=>node.position,isVisible:(ndc,u)=>ndc.y<.1&&u.id!==8
 });
 assert.deepEqual(selected,[1]);
 const all=visibleFriendlyUnits(units,entries,{project:node=>node.position});
 assert.deepEqual(all,[1,2,8]);
 assert.deepEqual(sameKindVisibleUnits(units,entries,'tank',{
  project:node=>node.position
 }),[2]);
});

test('return-to-base picks the owned operational HQ, keeps per-unit paths and excludes cargo',()=>{
 const own={id:55,kind:'headquarters',owner:0,hp:1000,buildRemaining:0,x:500,y:600,radius:85};
 const enemy={id:56,kind:'headquarters',owner:1,hp:1000,buildRemaining:0,x:700,y:650,radius:85};
 const fallback={id:57,kind:'barracks',owner:0,hp:1000,buildRemaining:0,x:820,y:820,radius:55};
 const scout={id:1,owner:0,kind:'infantry',hp:95,x:1000,y:600};
 assert.equal(returnBaseForUnit(scout,[enemy,fallback,own]),own);
 assert.equal(returnBaseForUnit(scout,[enemy,fallback]),fallback);
 assert.equal(returnBaseForUnit(scout,[enemy]),null);
 const units=[scout,{...scout,id:2,kind:'tank',x:1100,y:600},
  {...scout,id:3,owner:1},
  {...scout,id:4,carrier:22}];
 const requests=[];
 const game={world:{size:1500},bases:[enemy,own,fallback],units,
  command(ids,order){requests.push({ids,order});return 1;}};
 const result=orderReturnToBase(game,[1,2,3,4]);
 assert.deepEqual(result,{accepted:2,missing:0});
 assert.equal(requests.length,2,'one safe marching route per selected unit');
 assert.ok(requests.every(r=>r.order.kind==='move'&&r.order.guardOnArrival));
 assert.ok(requests.every(r=>Math.hypot(r.order.x-own.x,r.order.y-own.y)>125));
 assert.notDeepEqual(requests[0].order,requests[1].order);
});

test('STOPP guards nearby visible enemy without moving/chasing, while legacy hold stays defensive-only',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
  red=g.spawn(1,{x:2000,y:2100},'heavy');
 red.cooldown=100;g.stop([red.id],true);
 const start={x:blue.x,y:blue.y};
 g.stop([blue.id],true,true);
 assert.equal(blue.hold,true);assert.equal(blue.guardArea,true);
 g.updateVision();
 const hp=red.hp;step(g,.8);
 assert.ok(red.hp<hp,'guard shoots visible enemy inside weapon range before taking damage');
 assert.deepEqual({x:blue.x,y:blue.y},start,'guard never pursues its target');
 red.x=2400;red.y=2100;g.updateVision();
 const before=red.hp;step(g,2.0);
 assert.equal(red.hp,before,'guard does not chase an opponent out of gun range');
 assert.deepEqual({x:blue.x,y:blue.y},start);
 assert.equal(g.command([blue.id],{kind:'move',x:2100,y:2400}),1);
 assert.equal(blue.hold,false);
 assert.equal(blue.guardArea,false,'new right-click command exits guard mode');
});

test('ZUR BASIS uses ordinary real movement and converts to area guard after reaching base',()=>{
 const g=arena(),hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 const blue=g.spawn(0,{x:hq.x+310,y:hq.y+25},'infantry');
 const res=orderReturnToBase(g,[blue.id]);
 assert.equal(res.accepted,1);
 assert.equal(blue.orders.length,1);
 assert.equal(blue.orders[0].guardOnArrival,true);
 assert.equal(blue.hold,false);
 // Actual routed movement, not teleport / instant-hold.
 const before={x:blue.x,y:blue.y};
 step(g,.25);
 assert.ok(Math.hypot(blue.x-before.x,blue.y-before.y)>1);
 for(let i=0;i<350&&blue.orders.length;i++)g.step(.05);
 assert.equal(blue.orders.length,0,'return movement reaches the safe HQ guard ring');
 assert.equal(blue.hold,true);
 assert.equal(blue.guardArea,true);
 const loaded=Simulation.load(g.save());
 const saved=loaded.units.find(u=>u.id===blue.id);
 assert.equal(saved.hold,true);
 assert.equal(saved.guardArea,true);
});
