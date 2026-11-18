import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyze,markdown} from './weekly-report.mjs';
const maps=[[24,8],[25,12],[26,16]],variants=['ai32','ai33','ai34','ai35','ai36'];
function setup(){
 const dir=mkdtempSync(join(tmpdir(),'sandforge-leaderboard-'));
 for(const [map,size] of maps)for(const variant of variants){
  const weight=Number(variant.slice(2))-32;
  const details=[2026,2027].map(seed=>({
   mapVersion:map,seed,mode:'director',opponent:'contesting',
   ai33Policy:variant==='ai32'?'off':'adaptive',ai35Policy:['ai35','ai36'].includes(variant)?'control':undefined,
   ai36Policy:variant==='ai36'?'coordinated':undefined,requestedSeconds:420,
   initialStateHash:'initial-'+map+'-'+seed,elapsedSeconds:420,
   outcome:weight===2?'win':'timeout',redSectors:1+weight,
   bastionControlSeconds:(.2+.1*weight)*420*size,
   territoriesLost:3-weight,redUnitsLost:10-weight,captures:2+weight,
   bastionRecaptures:weight
  }));
  writeFileSync(join(dir,variant+'-map'+map+'.json'),JSON.stringify({
   complete:true,expectedRuns:2,completedRuns:2,maps:[map],
   modes:['director'],opponent:'contesting',requestedSeconds:420,details
  }));
 }
 return dir;
}
test('ranks better Bastion control, never counts timeout as win',()=>{
 const dir=setup();try{
  const data=analyze(dir);
  assert.deepEqual(data.ranking.map(x=>x.name),['ai34','ai36','ai35','ai33','ai32']);
  assert.equal(data.ranking[0].wins,6);
  assert.equal(data.ranking[4].wins,0);
  assert.equal(data.ranking[4].timeouts,6);
  assert.equal(data.changes.length,12);
  assert.match(markdown(data),/Vorläufige/);
  assert.match(markdown(data),/gleichen geskripteten Gegner/);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('rejects unfair cross-version start states',()=>{
 const dir=setup();try{
  const file=join(dir,'ai34-map26.json'),data=JSON.parse(readFileSync(file));
  data.details[0].initialStateHash='wrong-start';writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>analyze(dir),/Different initial world/);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('refuses incomplete matches rather than inventing a winner',()=>{
 const dir=setup();try{
  const file=join(dir,'ai33-map24.json'),data=JSON.parse(readFileSync(file));
  data.complete=false;writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>analyze(dir),/Partial match/);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('refuses an incorrectly labeled 3.2 mode',()=>{
 const dir=setup();try{
  const file=join(dir,'ai32-map24.json'),data=JSON.parse(readFileSync(file));
  data.details[0].ai33Policy='adaptive';writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>analyze(dir),/Wrong AI policy/);
 }finally{rmSync(dir,{force:true,recursive:true});}
});