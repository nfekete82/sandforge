import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 SIMULATION_SPEEDS,FIXED_GAME_TICK,
 normalizeSimulationSpeed,simulationFrameBudget
} from '../scripts/webgl-simulation-speed.js';

test('the three intended fixed speed modes, invalid input falls back safely',()=>{
 assert.deepEqual(SIMULATION_SPEEDS,[1,2,4]);
 for(const value of [1,2,4])assert.equal(normalizeSimulationSpeed(String(value)),value);
 for(const bad of [-2,0,.5,8,Infinity,NaN,'fast',null])
  assert.equal(normalizeSimulationSpeed(bad),1);
 assert.equal(FIXED_GAME_TICK,.05);
});

function simulateFrames(speed,frames=600,fps=60){
 let accumulator=0,steps=0;
 for(let frame=0;frame<frames;frame++){
  const budget=simulationFrameBudget(accumulator,1/fps,speed);
  accumulator=budget.accumulator;steps+=budget.steps;
  assert.ok(budget.steps<=12,'never create an unbounded physics spike');
 }
 return {seconds:steps*.05,steps,accumulator};
}
test('1x/2x/4x genuinely accelerate authoritative gameplay, NOT just animation FPS',()=>{
 for(const multiplier of [1,2,4]){
  const actual=simulateFrames(multiplier);
  assert.ok(Math.abs(actual.seconds-10*multiplier)<.051,
   multiplier+'x must advance '+(10*multiplier)+' actual simulated seconds');
 }
});

test('simulation remains fixed-50ms deterministic across differing browser refresh rates',()=>{
 for(const speed of [1,2,4]){
  const at30=simulateFrames(speed,300,30);
  const at60=simulateFrames(speed,600,60);
  const at120=simulateFrames(speed,1200,120);
  assert.ok(Math.abs(at30.seconds-at60.seconds)<.051);
  assert.ok(Math.abs(at120.seconds-at60.seconds)<.051);
 }
});

test('even x4 avoids unlimited catch-up work on a frozen graphics frame',()=>{
 const budget=simulationFrameBudget(60,2,4);
 assert.ok(budget.steps<=12);
 assert.ok(budget.accumulator>=0&&budget.accumulator<.05);
 assert.ok(budget.visualDt<=.32,'visual delta is separately bounded');
 assert.equal(simulationFrameBudget(0,.016,1).visualDt,.016);
 assert.equal(simulationFrameBudget(0,.016,4).visualDt,.064);
});

test('authoritative physics: equivalent simulation time gives identical game state',()=>{
 // x4 must NOT call Simulation.step(.2). It executes 4 ordinary .05 ticks,
 // preserving AI purchase cadence, weapon cooldowns and save determinism.
 const first=new Simulation(2026,24);
 const second=new Simulation(2026,24);
 const unchangedAI=second.tactical.state;
 for(let frame=0,accumulator=0;frame<300;frame++){
  const b=simulationFrameBudget(accumulator,1/60,4);
  accumulator=b.accumulator;
  for(let j=0;j<b.steps;j++)first.step(.05);
 }
 for(let step=0;step<400;step++)second.step(.05);
 assert.equal(first.time,second.time);
 assert.deepEqual(first.save(),second.save());
 assert.ok(unchangedAI);
});

test('browser has selector, pause-independent scale and keeps camera at wall time',()=>{
 const html=readFileSync('webgl-preview.html','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(html,/id="simulation-speed"/);
 for(const speed of ['1','2','4'])
  assert.match(html,new RegExp('<option value="'+speed+'"'));
 assert.match(preview,/speedControl\.addEventListener\('change'/);
 assert.match(preview,/simulationFrameBudget\(accumulator,dt,simulationSpeed\)/);
 assert.match(preview,/for\(let i=0;i<budget\.steps;i\+\+\)\{game\.step\(\.05\);constructionRecovery\.tick\(\);\}/);
 assert.match(preview,/setSimulationRunning\(shouldRun/);
 assert.match(preview,/get simulationSpeed\(\)/);
 assert.match(preview,/stepCamera\(dt\);/);
 assert.match(preview,/battlefield\.sync\(false,visualDt/);
 assert.match(preview,/effects\.update\(visualDt,running,accumulator\)/);
 assert.match(build,/cpSync\('scripts\/webgl-simulation-speed\.js','dist\/webgl-simulation-speed\.js'\)/);
});
