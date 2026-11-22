import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const directory='src/assets/reborn/buildings-3d';
const kinds=['airfield','barracks','factory','generator','headquarters','bastion'];
const files=kinds.flatMap(kind=>(kind==='bastion'?[-1,0,1]:[0,1])
 .map(team=>kind+'-'+team+'.glb'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('normal build preserves every tracked building GLB byte for byte',()=>{
 for(const name of files){
  const path=join(directory,name);
  const original=execFileSync('git',['show','HEAD:'+path],{maxBuffer:64*1024*1024});
  assert.equal(digest(readFileSync(path)),digest(original),
   'npm run build changed a tracked source GLB: '+name);
  const output=join('dist',directory,name);
  assert.ok(existsSync(output),'missing packaged GLB '+name);
  const bytes=readFileSync(output);
  assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF');
  assert.equal(bytes.readUInt32LE(8),bytes.length);
 }
});

test('build routes PBR restoration and all procedural generators to dist',()=>{
 const src=readFileSync('scripts/build.mjs','utf8');
 assert.match(src,/const shippedBuildingDir='dist\/src\/assets\/reborn\/buildings-3d'/);
 assert.ok(src.indexOf("cpSync('src/assets', 'dist/src/assets'")<
  src.indexOf("['scripts/ensure-final-pbr-buildings.mjs',shippedBuildingDir]"));
 for(const generator of ['generate-bastion-radar','generate-factory-pbr',
  'generate-energy-core-pbr','generate-airfield-pbr']){
  assert.ok(src.includes("['scripts/"+generator+".mjs',shippedBuildingDir]"),
   generator+' must write only to dist');
 }
});
