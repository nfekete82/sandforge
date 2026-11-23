import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {raisedMesaRouteWaypoint} from '../dist/src/reborn/raised-mesas.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('physical Desert Strike tank routing enters and exits central mesa only via actual ramps',()=>{
 const map=globalThis.SandforgeDesertMaps.byId('desert-strike');
 const world=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion).world;
 const mesa=world.generated.plateaus.find(m=>m.siteIndex===-1);
 assert.ok(mesa);
 const radius=Math.max(0,UNITS.tank.radius-10);
 const valid=p=>world.walkable(p,[],radius)&&world.groundVehicleSlopeSafe(p,.215,radius+10);
 const left={x:mesa.center.x-mesa.rampEnd-180,y:mesa.center.y};
 const right={x:mesa.center.x+mesa.rampEnd+180,y:mesa.center.y};
 const summit={x:mesa.center.x,y:mesa.center.y};
 const entry=raisedMesaRouteWaypoint(left,summit,[mesa],valid);
 assert.ok(entry,'approach to central plateau must find a real vehicle ramp');
 assert.ok(entry.x<mesa.center.x-mesa.topRadius);
 assert.ok(valid(entry));
 const next=raisedMesaRouteWaypoint(entry,summit,[mesa],valid);
 assert.ok(next,'from ramp mouth, tank must advance onto the summit');
 assert.ok(length(next,summit)<length(entry,summit));
 const route=world.path(entry,next,[],radius,undefined,false,false,false,.215);
 assert.ok(route.length,'physical tank cannot actually ascend selected ramp');
 assert.ok(length(route.at(-1),next)<world.cell*1.5);
 assert.equal(raisedMesaRouteWaypoint(next,summit,[mesa],valid),undefined,
  'completed ramp crossing must not restart at the outer entrance');
 const out=raisedMesaRouteWaypoint(summit,right,[mesa],valid);
 assert.ok(out&&out.x>mesa.center.x,'exit must face the destination');
 const outer=raisedMesaRouteWaypoint(out,right,[mesa],valid);
 assert.ok(outer&&outer.x>out.x,'tank must descend the same real ramp');
 assert.equal(raisedMesaRouteWaypoint(outer,right,[mesa],valid),undefined,
  'after exiting the cliff ring, the original destination resumes');
});
test('mesa waypoints never invent a ramp or divert unrelated paths',()=>{
 const mesa={center:{x:3000,y:3000},topRadius:760,footRadius:970,
  rampEnd:2010,rampWidth:470,height:180,
  direction:{x:1,y:0},ramps:[{x:1,y:0},{x:-1,y:0}],
  siteIndex:-1,seed:9999};
 const start={x:700,y:3000},top={x:3000,y:3000};
 assert.equal(raisedMesaRouteWaypoint(start,top,[mesa],()=>false),undefined);
 assert.equal(raisedMesaRouteWaypoint({x:600,y:1000},{x:800,y:1000},[mesa],()=>true),undefined);
});
