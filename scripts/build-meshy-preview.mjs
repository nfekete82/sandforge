#!/usr/bin/env node
/** Sandforge standalone Meshy factory preview.
 * Avoid the full game builder's external final-HQ/Barracks requirement.
 * Only author the 3D comparison viewer, real Meshy candidate and open
 * production factory. Works on a fresh Git worktree with npm ci.
 */
import {cpSync,existsSync,mkdirSync,statSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const base=resolve('dist');
const meshy=resolve('src/assets/reborn/buildings-3d/factory-meshy-optimized.glb');
const output=join(base,'src/assets/reborn/buildings-3d');
if(!existsSync(meshy)||statSync(meshy).size<20_000)
 throw new Error('Optimierte Meshy-Datei fehlt. Git-Branch feat/sandforge-meshy-factory-real-glb-20261120 aktualisieren und erneut starten.');
if(!existsSync('node_modules/three/build/three.module.js'))
 throw new Error('Three.js fehlt. Bitte zuerst npm ci ausführen.');

function copy(src,dest){
 mkdirSync(dirname(dest),{recursive:true});
 cpSync(src,dest);
}
mkdirSync(output,{recursive:true});
copy('webgl-meshy-factory.html',join(base,'webgl-meshy-factory.html'));
copy('scripts/webgl-meshy-factory-viewer.js',join(base,'webgl-meshy-factory-viewer.js'));
copy('scripts/webgl-meshy-factory-team.js',join(base,'webgl-meshy-factory-team.js'));
// The browser QA drives the *actual* live Sandforge production-gate
// presenter, not a mock. Stage its dependency modules without triggering
// the full game build's private HQ/Barracks GLB requirements.
for(const filename of readdirSync('scripts')){
 if(filename.endsWith('.js'))
  copy(join('scripts',filename),join(base,filename));
}
const threeFiles=[
 'build/three.module.js','build/three.core.js',
 'examples/jsm/loaders/GLTFLoader.js',
 'examples/jsm/controls/OrbitControls.js',
 'examples/jsm/utils/BufferGeometryUtils.js',
 'examples/jsm/utils/SkeletonUtils.js'
];
for(const path of threeFiles)copy('node_modules/three/'+path,
 join(base,'vendor/three/'+path.replace('build/','').replace('examples/jsm/','addons/')));
execFileSync(process.execPath,[
 'scripts/generate-factory-pbr.mjs',output
],{stdio:'inherit'});
for(const team of [0,1])copy(join(output,'factory-'+team+'.glb'),
 join(output,'factory-procedural-'+team+'.glb'));
execFileSync(process.execPath,[
 'scripts/prepare-meshy-factory.mjs',meshy,output
],{stdio:'inherit'});
for(const name of ['factory-0.glb','factory-1.glb','factory-procedural-0.glb','factory-procedural-1.glb']){
 const file=join(output,name);
 if(!existsSync(file)||statSync(file).size<20_000)
  throw new Error('3D-Vorschau GLB fehlt nach Export: '+name);
}
console.log('Meshy-Vorschau erstellt: dist/webgl-meshy-factory.html');
console.log('Start: PORT=8136 node scripts/serve.mjs');
