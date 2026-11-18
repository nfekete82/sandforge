import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {packageWebGL,pinWebGLPaths} from '../scripts/uberspace/webgl-package.mjs';

const RELEASE='v-20261118t120000z-e536c327a389-abcd99';
const COMMIT='e536c327a3899d85d0ab165e900624cf983bf8af';
const prefix='/releases/'+RELEASE+'/';
const fixtures=[
 'index.html','classic.html','webgl-preview.js','webgl-title-menu.js',
 'webgl-battlefield.js','webgl-recon-drone.js','webgl-classic-hud.css',
 'style.css','retro-desert.css',
 'vendor/three/three.module.js','vendor/three/three.core.js',
 'src/reborn/simulation.js','src/reborn/main.js',
 'src/assets/reborn/buildings-3d/barracks-0.glb',
 'src/assets/reborn/buildings-3d/barracks-1.glb',
 'src/assets/reborn/buildings-3d/headquarters-0.glb',
 'src/assets/reborn/buildings-3d/headquarters-1.glb',
 'src/assets/reborn/buildings-3d/bastion-0.glb',
 'src/assets/reborn/buildings-3d/factory-0.glb',
 'src/assets/reborn/buildings-3d/airfield-0.glb'
];
const html='<html><head><script type="importmap">{"imports":{"three":"/vendor/three/three.module.js"}}</script>'+
 '<link rel="stylesheet" href="/webgl-classic-hud.css"><a href="/classic.html">Fallback</a></head>'+
 '<body><div id="stage"></div><script defer src="/webgl-title-menu.js"></script></body></html>';
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'sandforge-webgl-deploy-'));
 for(const file of fixtures){
  const p=path.join(root,'dist',file);await mkdir(path.dirname(p),{recursive:true});
  let body='export const alive=true;';
  if(file==='index.html')body=html;
  else if(file==='classic.html')body='<script type="module" src="/src/reborn/main.js"></script>';
  else if(file==='webgl-title-menu.js')body="import('/webgl-preview.js');";
  else if(file==='webgl-preview.js')body="import {alive} from '/src/reborn/simulation.js'; export {alive};";
  else if(file.endsWith('.css'))body='url("/src/assets/reborn/sand.png")';
  else if(file.endsWith('.glb')){
   const bytes=Buffer.alloc(22000);bytes.write('glTF',0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
   body=bytes;
  }
  await writeFile(p,body);
 }
 const retired=path.join(root,'dist/src/assets/reborn/supply-pbr/cache.glb');
 await mkdir(path.dirname(retired),{recursive:true});await writeFile(retired,Buffer.alloc(30000));
 const dev=path.join(root,'dist/model-3d.html');
 await writeFile(dev,'<h1>Do not publish</h1>');
 return root;
}

test('WebGL deploy pins only release assets without changing the root navigation',()=>{
 const src='import "/webgl-preview.js"; const model="/src/assets/reborn/model.glb";'+
  'const home="/"; const cdn="https://example.com/x"; url(/vendor/three/three.module.js)';
 const pinned=pinWebGLPaths(src,RELEASE);
 assert.ok(pinned.includes(prefix+'webgl-preview.js'));
 assert.ok(pinned.includes(prefix+'src/assets/reborn/model.glb'));
 assert.ok(pinned.includes(prefix+'vendor/three/three.module.js'));
 assert.ok(pinned.includes('const home="/"'));
 assert.ok(pinned.includes('https://example.com/x'));
});
test('package contains immutable WebGL imports, terrain and PBR but never supply depots or dev pages',async()=>{
 const root=await fixture(),output=path.join(root,'release');
 try{
  const r=await packageWebGL({root,output,release:RELEASE,commit:COMMIT,branch:'test'});
  assert.equal(r.manifest.renderer,'webgl');
  assert.equal(r.manifest.commit,COMMIT);
  assert.ok(r.manifest.files['webgl-recon-drone.js']);
  assert.ok(r.manifest.files['src/assets/reborn/buildings-3d/headquarters-0.glb']);
  assert.equal(r.manifest.files['src/assets/reborn/supply-pbr/cache.glb'],undefined);
  assert.equal(r.manifest.files['model-3d.html'],undefined);
  assert.ok((await readFile(path.join(output,'index.html'),'utf8')).includes(prefix+'webgl-title-menu.js'));
  assert.ok((await readFile(path.join(output,'webgl-title-menu.js'),'utf8')).includes(prefix+'webgl-preview.js'));
  assert.ok((await readFile(path.join(output,'classic.html'),'utf8')).includes(prefix+'src/reborn/main.js'));
  assert.ok(r.manifestSHA256.length===64);
  assert.equal(JSON.parse(await readFile(path.join(output,'deployment.json'),'utf8')).renderer,'webgl');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('refuses a missing local HQ PBR model before any remote upload',async()=>{
 const root=await fixture(),output=path.join(root,'release');
 try{
  await rm(path.join(root,'dist/src/assets/reborn/buildings-3d/headquarters-0.glb'));
  await assert.rejects(packageWebGL({root,output,release:RELEASE,commit:COMMIT,branch:'test'}),/Incomplete WebGL/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('does not publish Canvas as the main WebGL entry',async()=>{
 const root=await fixture(),output=path.join(root,'release');
 try{
  await writeFile(path.join(root,'dist/index.html'),'<canvas id="world"></canvas>');
  await assert.rejects(packageWebGL({root,output,release:RELEASE,commit:COMMIT,branch:'test'}),/Refusing to publish Canvas/);
 }finally{await rm(root,{recursive:true,force:true});}
});
