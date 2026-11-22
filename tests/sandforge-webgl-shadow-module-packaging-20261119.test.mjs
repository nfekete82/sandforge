import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=resolve('.');
const source=resolve('scripts/check-webgl-module-graph.mjs');
const run=(folder)=>spawnSync(process.execPath,[
 '--no-warnings','--experimental-vm-modules',source
],{cwd:folder,encoding:'utf8'});

test('the shipped 3D build includes the shader-shadow optimization module',()=>{
 const file='dist/webgl-shadow-budget.js';
 assert.ok(existsSync(file),'missing dist/webgl-shadow-budget.js causes 3D start to fail');
 const battlefield=readFileSync('dist/webgl-battlefield.js','utf8');
 assert.match(battlefield,/from\s+['"]\/webgl-shadow-budget\.js['"]/,
  'runtime battlefield should actually import shipped shadow optimization');
 assert.equal(readFileSync(file,'utf8'),
  readFileSync('scripts/webgl-shadow-budget.js','utf8'),
  'must copy current source module, not an outdated artifact');
 const result=run(cwd);
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.match(result.stdout,/WebGL-Startprüfung OK:/);
});

test('headless startup audit rejects a missing transitive browser module',()=>{
 const temp=mkdtempSync(join(tmpdir(),'sandforge-module-audit-'));
 try{
  const dist=join(temp,'dist');
  mkdirSync(dist);
  writeFileSync(join(dist,'webgl-title-menu.js'),'export const menu=true;\n');
  writeFileSync(join(dist,'webgl-preview.js'),
   "import './webgl-shadow-budget.js';\nexport const boot=true;\n");
  const missing=run(temp);
  assert.notEqual(missing.status,0,'missing transitive import MUST fail the build');
  assert.match(missing.stderr,/Fehlendes Browser-Modul: \/webgl-shadow-budget\.js/);
  writeFileSync(join(dist,'webgl-shadow-budget.js'),
   'export function limitModelShadowCasters(){}\n');
  const fixed=run(temp);
  assert.equal(fixed.status,0,fixed.stderr||fixed.stdout);
  assert.match(fixed.stdout,/3 vollständige/);
 }finally{
  rmSync(temp,{recursive:true,force:true});
 }
});
