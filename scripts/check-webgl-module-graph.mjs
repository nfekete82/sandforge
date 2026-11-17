/** Static browser ESM dependency audit.
 * The app's Node test suite imports Simulation but not its /webgl-preview.js
 * browser module graph. A missing copied file silently broke 3D boot while
 * hundreds of simulation tests passed. Parse every shipped module *without
 * evaluating it* and verify its complete import graph is in dist.
 *
 * Run: node --experimental-vm-modules scripts/check-webgl-module-graph.mjs
 */
import {SourceTextModule} from 'node:vm';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,relative,sep,extname} from 'node:path';

const output=resolve('dist');
const rootModules=['/webgl-preview.js','/webgl-title-menu.js'];
const visited=new Set();
const errors=[];
function modulePath(spec,from){
 if(spec==='three')return resolve(output,'vendor/three/three.module.js');
 if(spec.startsWith('three/addons/'))
  return resolve(output,'vendor/three/addons',spec.slice('three/addons/'.length));
 if(spec.startsWith('/'))return resolve(output,'.'+spec);
 if(spec.startsWith('./')||spec.startsWith('../'))
  return resolve(dirname(from),spec);
 errors.push('Unbekannter Browser-Import "'+spec+'" in '+relative(output,from));
 return null;
}
function visit(file,origin){
 const display=relative(output,file);
 if(!file.startsWith(output+sep)){
  errors.push('Import verlässt dist/: '+display+' (via '+origin+')');return;
 }
 if(visited.has(file))return;
 visited.add(file);
 if(!existsSync(file)){
  errors.push('Fehlendes Browser-Modul: /'+display+' (importiert von '+origin+')');return;
 }
 if(extname(file)!=='.js'){
  errors.push('Import ist kein ES-JavaScript: /'+display+' (via '+origin+')');return;
 }
 let mod;
 try{
  mod=new SourceTextModule(readFileSync(file,'utf8'),{identifier:file});
 }catch(e){
  errors.push('Ungültiges Browser-JavaScript: /'+display+' – '+e.message+' (via '+origin+')');
  return;
 }
 for(const spec of mod.dependencySpecifiers){
  const dependency=modulePath(spec,file);
  if(dependency)visit(dependency,'/'+display);
 }
}
if(typeof SourceTextModule!=='function'){
 console.error('SourceTextModule fehlt: mit --experimental-vm-modules starten.');
 process.exit(2);
}
for(const entry of rootModules)visit(modulePath(entry,'browser index'),'/index.html');
if(errors.length){
 for(const error of errors)console.error('✗ '+error);
 console.error('WebGL-Startprüfung fehlgeschlagen ('+errors.length+' Module).');
 process.exitCode=1;
}else{
 console.log('WebGL-Startprüfung OK: '+visited.size+
  ' vollständige und syntaktisch gültige ES-Module.');
}
