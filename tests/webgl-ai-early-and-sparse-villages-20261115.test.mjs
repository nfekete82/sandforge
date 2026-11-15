import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {planDesertVillages} from '../scripts/webgl-desert-village.js';

for(const seed of [2988452066,3610769721,42102026,145110]){
 test('procedural 4-bastion AI builds HQ and its own paid economy on seed '+seed,()=>{
  const g=Simulation.campaign(seed,23);
  g.stageWebGLProduction=true;
  assert.equal(g.paused,false);
  let firstHQ=null,readyHQ=null,firstCore=null,firstBarracks=null;
  const startCredits=g.credits[1];
  for(let tick=0;tick<3000&&g.status==='playing';tick++){
   g.step(.05);
   const own=g.bases.filter(b=>b.owner===1&&b.hp>0);
   if(firstHQ===null&&own.some(b=>b.kind==='headquarters'))firstHQ=g.time;
   if(readyHQ===null&&own.some(b=>b.kind==='headquarters'&&b.buildRemaining<=0))readyHQ=g.time;
   if(firstCore===null&&own.some(b=>b.kind==='generator'))firstCore=g.time;
   if(firstBarracks===null&&own.some(b=>b.kind==='barracks'))firstBarracks=g.time;
   if(readyHQ!==null&&firstCore!==null&&firstBarracks!==null)break;
  }
  assert.ok(firstHQ!==null&&firstHQ<=12,
   'AI must start building its base promptly: '+JSON.stringify({seed,firstHQ,readyHQ,firstCore,firstBarracks}));
  assert.ok(readyHQ!==null&&readyHQ<=70,'AI HQ must actually finish');
  assert.ok(firstCore!==null&&firstCore<=85,'AI must build paid first economy core');
  assert.ok(firstBarracks!==null&&firstBarracks<=140,'AI must build barracks and not idle indefinitely');
  assert.ok(g.credits[1]>=0,'no invented AI currency');
  assert.ok(startCredits>0);
 });
 test('distant authored desert villages on seed '+seed+' cannot form tightly packed miniature houses',()=>{
  const g=Simulation.campaign(seed,23),v=planDesertVillages({world:g.world,terrain:g.world.generated,seed});
  assert.ok(v.length>=1&&v.length<=2,'at least one non-intrusive scenic hamlet');
  for(const hamlet of v){
   assert.equal(hamlet.houses.length,3);
   for(const house of hamlet.houses){
    assert.ok(house.width>=76&&house.height>=39,'lifelike building size');
    assert.ok(Math.hypot(house.x-hamlet.x,house.y-hamlet.y)>180,
     'houses distributed naturally, not touching a central plaza');
   }
   for(let i=0;i<hamlet.houses.length;i++)for(let j=i+1;j<hamlet.houses.length;j++)
    assert.ok(Math.hypot(hamlet.houses[i].x-hamlet.houses[j].x,
     hamlet.houses[i].y-hamlet.houses[j].y)>=225,'three real ruins remain far apart');
  }
 });
}
test('pause is explicitly user-driven and its UI states the reason, not a mysterious AI stop',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/game\.paused=false/);
 assert.match(preview,/running=query\.get\('pause'\)!=='1'/);
 assert.match(preview,/pauseSource=query\.get\('pause'\)==='1'\?'URL-Parameter pause=1'/);
 assert.match(preview,/pauseFromKeyboard\|\|event\?\.detail===0\?'Leertaste':'Pause-Schaltfläche'/);
 assert.match(preview,/pauseFromKeyboard=true;\$\('simulation'\)\.click\(\)/);
 assert.doesNotMatch(readFileSync('src/reborn/tactical-ai.ts','utf8'),/\.paused=true/);
});
