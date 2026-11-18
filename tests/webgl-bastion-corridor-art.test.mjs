import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('WebGL renders no permanent tyre marks leading from one Bastion to another',()=>{
 const preview=read('scripts/webgl-preview.js');
 assert.doesNotMatch(preview,/function sandRoads\s*\(/,
  'the discontinued parallel-tyre-mark artwork should be deleted');
 assert.doesNotMatch(preview,/\bsandRoads\s*\(/,
  'never draw corridor stripes at map creation');
 assert.doesNotMatch(preview,/for\s*\(const\s*\[a,b\]\s*of\s*terrain\.corridors\)/,
  'no corridor-based instanced line meshes in the 3D desert');
});

test('real navigation corridors and Bastion sector links remain untouched',()=>{
 const generator=read('src/reborn/world-generation.ts');
 assert.match(generator,/const corridors:\[Point,Point\]\[\]=\[\]/);
 assert.match(generator,/sites\.forEach\(\(p,i\)=>/);
 assert.match(generator,/corridors\.push\(\[p,sites\[i\+1\]\]\)/);
 assert.match(generator,/corridors\.push\(\[p,sites\[i\+cols\]\]\)/);
 assert.match(generator,/corridors\.some\(\(\[a,b\]\)=>segmentDistance/);
 const runtime=read('scripts/webgl-battlefield.js');
 assert.match(runtime,/createBastions\(\)/);
 assert.match(runtime,/updateBastionCaptureBar\(/);
});

test('actual vehicle and infantry tracks may still appear when units move',()=>{
 const preview=read('scripts/webgl-preview.js');
 const motion=read('scripts/webgl-ground-tracks.js');
 assert.match(preview,/SandforgeGroundTracks/);
 assert.match(preview,/groundTracks\.capture\(\)/);
 assert.match(preview,/groundTracks\.update\(/);
 assert.match(motion,/visual-moving-vehicle-tracks/);
 assert.match(motion,/visual-moving-footprints/);
});
