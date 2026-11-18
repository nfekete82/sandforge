import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {aiDebugAllowed,captureAiDebug} from '../scripts/webgl-ai-debug.js';

test('AI debug HUD is disabled outside developer preview unless explicitly opted-in',()=>{
 assert.equal(aiDebugAllowed({hostname:'localhost',search:''}),true);
 assert.equal(aiDebugAllowed({hostname:'127.0.0.1',search:''}),true);
 assert.equal(aiDebugAllowed({hostname:'[::1]',search:''}),true);
 assert.equal(aiDebugAllowed({hostname:'sandforge.example',search:''}),false);
 assert.equal(aiDebugAllowed({hostname:'sandforge.example',search:'?aiDebug=1'}),true);
 assert.equal(aiDebugAllowed({hostname:'sandforge.example',search:'?aiDebug=0'}),false);
});

test('AI debug telemetry reads actual game income, paid roster, production and territories',()=>{
 const g=new Simulation(2026,4);
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 assert.ok(hq);
 g.credits[1]=1234;
 const soldier=g.spawn(1,{x:hq.x+60,y:hq.y+65},'infantry');
 const tank=g.spawn(1,{x:hq.x+90,y:hq.y+80},'tank');
 g.tactical.state.phase='attack';
 g.tactical.state.group=[soldier.id,tank.id,999999];
 g.tactical.state.battle={
  version:1,withdrawals:[],fronts:[],reactions:0,retreats:0,
  squads:[{role:'defense',ids:[soldier.id],target:null,since:g.time}]
 };
 const sector=g.territories.find(t=>t.owner!==1);
 assert.ok(sector);
 g.tactical.state.commander={
  version:1,phase:'expansion',phaseSince:0,recon:[],survey:[],intel:[],aborted:0,
  mission:{kind:'capture',sector:sector.id,objective:null,
   x:sector.point.x,y:sector.point.y,since:g.time,progressAt:g.time,distance:100,hp:0}
 };
 hq.queueTypes=['engineer'];hq.queue=[7];hq.production=2;
 const s=captureAiDebug(g);
 assert.equal(s.credits,1234);
 assert.equal(s.income,g.income(1));
 assert.equal(s.phase,'attack');
 assert.equal(s.campaign,'expansion');
 assert.equal(s.mission.kind,'capture');
 assert.equal(s.mission.sector,sector.id);
 assert.equal(s.mission.owner,sector.owner);
 assert.equal(s.army,g.count(1));
 assert.equal(s.group,2,'only real owned living units are in the assault roster');
 assert.equal(s.defenders,1);
 assert.equal(s.buckets.vehicles>=1,true);
 assert.ok(s.production.some(p=>p.id===hq.id&&p.queue[0]==='engineer'));
 assert.equal(s.sectors.own,g.territories.filter(t=>t.owner===1).length);
 assert.equal(s.sectors.total,g.territories.length);
 const hp=g.units.map(u=>u.hp),credits=[...g.credits],orders=g.units.map(u=>structuredClone(u.orders));
 captureAiDebug(g);
 assert.deepEqual(g.units.map(u=>u.hp),hp);
 assert.deepEqual(g.credits,credits);
 assert.deepEqual(g.units.map(u=>u.orders),orders,'read-only dev dashboard cannot issue orders');
});

test('dashboard reacts to live sector ownership, not guessed preview/demo metrics',()=>{
 const g=new Simulation(2027,23);
 const initial=captureAiDebug(g);
 const territory=g.territories.find(t=>t.owner===-1);
 assert.ok(territory);
 territory.owner=1;
 const after=captureAiDebug(g);
 assert.equal(after.sectors.own,initial.sectors.own+1);
 assert.equal(after.sectors.neutral,initial.sectors.neutral-1);
});

test('F9 is wired once and gameplay keybinds and pure rendering remain intact',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(ui,/import \{createAiDebugOverlay\} from '\/webgl-ai-debug\.js'/);
 assert.match(ui,/this\.aiDebug=createAiDebugOverlay\(this\.game\)/);
 assert.match(ui,/this\.aiDebug\?\.update\(\)/);
 assert.match(ui,/if\(event\.code==='F9'&&!event\.repeat&&this\.aiDebug\)/);
 assert.match(ui,/event\.preventDefault\(\);this\.aiDebug\.toggle\(\);return;/);
 assert.equal((ui.match(/this\.aiDebug\.toggle\(\)/g)??[]).length,1);
 assert.match(build,/cpSync\('scripts\/webgl-ai-debug\.js','dist\/webgl-ai-debug\.js'\)/);
 assert.match(ui,/if\(event\.code==='KeyG'/,'return-to-base shortcut is unaffected');
 const dashboard=readFileSync('scripts/webgl-ai-debug.js','utf8');
 assert.match(dashboard,/#sf-ai-debug-overlay\[hidden\]/);
 assert.match(dashboard,/if\(node\.hidden\)return/,'hidden HUD does no rendering work');
 assert.doesNotMatch(dashboard,/\.step\(|\.spawn\(|\.command\(/,
  'read-only telemetry should never mutate the game simulation');
});
