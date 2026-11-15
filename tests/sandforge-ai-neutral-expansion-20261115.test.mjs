import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

for(const seed of [2988452066,3610769721]){
 test('RED AI eventually captures a neutral bastion on 4-bastion seed '+seed,()=>{
  const game=Simulation.campaign(seed,23);
  game.stageWebGLProduction=true;
  const initiallyNeutral=new Set(game.territories.filter(t=>t.owner===-1).map(t=>t.id));
  let firstAttack=null,firstCapture=null;
  for(let tick=0;tick<7000&&game.status==='playing';tick++){
   game.step(.05);
   if(firstAttack===null&&game.tactical.state.phase==='attack')firstAttack=game.time;
   if(firstCapture===null&&game.territories.some(t=>initiallyNeutral.has(t.id)&&t.owner===1)){
    firstCapture=game.time;break;
   }
  }
  const ai=game.tactical.state;
  assert.ok(game.bases.some(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0),
   'AI must retain real infrastructure, not simulate fake reinforcements');
  assert.ok(firstAttack!==null,
   'AI should eventually move beyond gathering and issue a paid attack');
  assert.ok(firstAttack>=65,
   'opening garrison must be protected for at least 65 simulated seconds');
  assert.ok(firstCapture!==null,
   'AI must conquer an actually neutral bastion; diagnostics: '+
    JSON.stringify({seed,time:game.time,owners:game.territories.map(t=>t.owner),
     phase:ai.phase,mission:ai.commander?.mission,
     fighters:game.units.filter(u=>u.owner===1&&u.kind!=='engineer').length,
     credits:game.credits[1],aborted:ai.commander?.aborted}));
 });
}
