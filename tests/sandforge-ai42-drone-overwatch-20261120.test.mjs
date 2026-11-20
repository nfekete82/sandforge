import test from 'node:test';
import assert from 'node:assert/strict';
import {ai42DroneOverwatchPoint} from '../dist/src/reborn/ai36-air-support.js';
test('paid R-01 maintains HQ sight outside known turret range',()=>{
 const x={home:{x:6800,y:6800},hq:{x:1250,y:1100},
  size:7600,sight:1120,guns:[{x:1100,y:1450,range:495}]};
 const p=ai42DroneOverwatchPoint(x);
 assert.ok(p);
 const d=Math.hypot(p.x-x.hq.x,p.y-x.hq.y);
 assert.ok(d<980&&d>800);
 for(const gun of x.guns)
  assert.ok(Math.hypot(p.x-gun.x,p.y-gun.y)>gun.range+139);
});
test('drone rejects unsafe or too-short sight positions',()=>{
 const x={home:{x:6800,y:6800},hq:{x:1250,y:1100},
  size:7600,sight:1120,guns:[{x:1250,y:1100,range:1000}]};
 assert.equal(ai42DroneOverwatchPoint(x),undefined);
 assert.equal(ai42DroneOverwatchPoint({...x,guns:[],sight:280}),undefined);
});
