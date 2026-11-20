import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const seed=824836862;
const scenario=new Simulation(seed,26,false,false,undefined,4);
const world=scenario.world;
const ridge=world.generated?.ridges?.[0];
const from={x:5663,y:4757};
const enemyHQ=scenario.bases.find(b=>b.owner===0&&b.kind==='headquarters');
const p=(kind,ramp)=>{
 const clearance=Math.max(0,UNITS[kind].radius-10);
 const slope=kind==='tank'?.215:kind==='artillery'?.185:.195;
 const center=ridgeHeightAtX(ridge,ramp.x);
 const side=Math.sign(from.y-ridgeHeightAtX(ridge,from.x));
 const offset=ridge.width*.5+210;
 const near={x:ramp.x,y:center+side*offset};
 const far={x:ramp.x,y:center-side*offset};
 const route=(a,b)=>world.path(a,b,[],clearance,undefined,false,false,false,slope);
 return {near,far,route,clearance,slope};
};
test('terrain still provides the original actual v4 serpentine canyon',()=>{
 assert.ok(ridge&&ridge.ramps.length>=2);
 assert.ok(enemyHQ&&enemyHQ.hp>0);
 assert.equal(world.generatorVersion,4);
});
for(const kind of ['rover','tank','artillery'])test(
 `the eastern canyon road is physically traversable by a paid ${kind}`,()=>{
 const ramp=ridge.ramps.at(-1);
 const gate=p(kind,ramp);
 const toEntry=gate.route(from,gate.near);
 const across=gate.route(gate.near,gate.far);
 assert.ok(toEntry.length,`no route to east ramp for ${kind}`);
 assert.ok(across.length,`a drawn canyon ramp is still impassable for ${kind}`);
 assert.ok(Math.hypot(across.at(-1).x-gate.far.x,
  across.at(-1).y-gate.far.y)<world.cell*1.4);
 assert.ok(world.groundVehicleSlopeSafe(
  {x:ramp.x,y:ridgeHeightAtX(ridge,ramp.x)},gate.slope,gate.clearance+10));
});
test('the ramp fix does not turn all cliffs into drivable terrain',()=>{
 const ramp=ridge.ramps.at(-1);
 const farFromPass=ridge.spine.filter(p=>ridge.ramps.every(g=>
  Math.abs(p.x-g.x)>g.width*.8));
 assert.ok(farFromPass.length>0);
 assert.ok(farFromPass.some(point=>!world.walkable(point,[],8)));
});
