import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {visualUnitScale,MODEL_HEIGHTS,calibratedScale} from '../scripts/webgl-scale.js';

test('authored tank is visibly larger than Humvee while infantry stays human-sized',()=>{
 assert.equal(visualUnitScale('tank'),1.16,
  'do not create a factory-door mismatch by enlarging the tank');
 assert.equal(visualUnitScale('rover'),1.04);
 const tankWidth=UNITS.tank.width*visualUnitScale('tank');
 const jeepWidth=UNITS.rover.width*visualUnitScale('rover');
 assert.ok(tankWidth>jeepWidth*1.30,
  'the tank must have a clearly larger silhouette than the Humvee');
 const soldierHeight=MODEL_HEIGHTS.infantry*visualUnitScale('infantry');
 const engineerHeight=MODEL_HEIGHTS.engineer*visualUnitScale('engineer');
 const tankHeight=MODEL_HEIGHTS.tank*visualUnitScale('tank');
 assert.ok(soldierHeight>=21&&soldierHeight<=24);
 assert.equal(engineerHeight,soldierHeight);
 assert.ok(tankHeight>=soldierHeight*2.1);
 assert.ok(visualUnitScale('heavy')<=visualUnitScale('infantry'));
 assert.equal(visualUnitScale('supply'),1.34,'do not resize supply vehicles');
 assert.equal(visualUnitScale('artillery'),1.42);
 assert.equal(visualUnitScale('scout'),1.34);
});

test('fallback and authored GLB use the same visual scale; no gameplay sizes changed',()=>{
 const src=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(src,/placeholder\.scale\.setScalar\(visualUnitScale\(entity\.kind\)\)/);
 assert.match(src,/\(type==='unit'\?visualUnitScale\(entry\.kind\):1\)/);
 assert.equal(UNITS.tank.width,90);
 assert.equal(UNITS.rover.width,76);
 assert.equal(UNITS.tank.radius,22);
 assert.equal(UNITS.rover.radius,18);
 assert.equal(calibratedScale('tank','unit',{x:100,y:42,z:130},90)>0,true);
});
