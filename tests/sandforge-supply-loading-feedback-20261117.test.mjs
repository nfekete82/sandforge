import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPLY_PICKUP_SECONDS,SUPPLY_UNLOAD_SECONDS,supplyOperationProgress}
 from '../dist/src/reborn/supply-logistics.js';

const source=path=>readFileSync(path,'utf8');

test('loading/unloading progress follows authoritative job.clock (not renderer time)',()=>{
 assert.deepEqual(supplyOperationProgress({phase:'loading',clock:0}),
  {mode:'loading',fraction:0});
 assert.deepEqual(supplyOperationProgress({phase:'loading',clock:SUPPLY_PICKUP_SECONDS*.5}),
  {mode:'loading',fraction:.5});
 assert.deepEqual(supplyOperationProgress({phase:'loading',clock:999}),
  {mode:'loading',fraction:1});
 assert.deepEqual(supplyOperationProgress({phase:'unloading',clock:SUPPLY_UNLOAD_SECONDS*.5}),
  {mode:'unloading',fraction:.5});
 for(const phase of ['seek','to-cache','to-hq','idle']){
  assert.equal(supplyOperationProgress({phase,clock:.5}),null);
 }
 assert.equal(supplyOperationProgress(undefined),null);
 assert.deepEqual(supplyOperationProgress({phase:'loading',clock:-100}),
  {mode:'loading',fraction:0});
});
test('truck loader shows temporary visible crate operation sign and bar',()=>{
 const visual=source('scripts/webgl-supply-logistics.js');
 const battlefield=source('scripts/webgl-battlefield.js');
 assert.match(visual,/LÄDT KISTEN/);
 assert.match(visual,/ENTLÄDT/);
 assert.match(visual,/SF_SupplyLoadingIndicator/);
 assert.match(visual,/progress\.fraction/);
 assert.match(visual,/supplyOperationProgress\(job\)/);
 assert.match(battlefield,/updateSupplyLoadingIndicator\(entry,u\.supply\)/);
 assert.match(battlefield,/animateSupplyTruckRig/);
 assert.match(visual,/ctx\.fillRect\(29,27,43,39\)/);
});
test('no gear-shaped radial tread cubes; military wheels use rounded caps and flush patterned tyres',()=>{
 const model=source('scripts/generate-supply-pbr.mjs');
 assert.match(model,/function tyreBand\(/);
 assert.match(model,/cylinderX\('rubber',12\.2,9\.4,pivot,28\)/);
 assert.match(model,/cylinderX\('hub',5\.5,12\.1,pivot,24\)/);
 assert.match(model,/const segments=28,half=width\/2-\.8/);
 assert.doesNotMatch(model,/box\('black',\[0,Math\.sin\(ang\)\*14\.4/);
 assert.match(model,/SF_Supply_Wheel_/);
});
test('depot is an OPEN stockyard, roof cannot occlude the disappearing pallet groups',()=>{
 const model=source('scripts/generate-supply-pbr.mjs');
 assert.match(model,/OPEN STORAGE COURTYARD/);
 assert.match(model,/const group=node\('SF_DepotStock_'/);
 assert.match(model,/const x=side\*\(48\+slot\*18\)/);
 assert.doesNotMatch(model,/box\('edge',\[0,69,-75\],\[204,8,159\]\)/);
 assert.doesNotMatch(model,/box\('camo',\[0,78,12\],\[191,7,105\]\)/);
 const visual=source('scripts/webgl-supply-logistics.js');
 assert.match(visual,/const count=Math\.ceil\(stocks\.length\*fraction\)/);
 assert.match(visual,/root\.visible=true/);
 assert.match(visual,/stocks\.forEach\(\(stock,i\)=>\{stock\.visible=i<count;\}\)/);
});
