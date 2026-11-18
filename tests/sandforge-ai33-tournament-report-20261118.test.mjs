import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ai33TournamentReport,ai33Markdown} from '../scripts/ai33-tournament-report.mjs';

const maps=[24,25,26],seeds=Array.from({length:20},(_,i)=>2601+i);
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'sandforge-ai33-report-'));
 for(const map of maps)for(const phase of ['before','after']){
  const improved=phase==='after';
  const details=seeds.map((seed,i)=>({
   seed,mapVersion:map,mode:'director',opponent:'contesting',ai33Policy:improved?'adaptive':'off',
   initialStateHash:'identical-initial-world-'+map+'-'+seed,
   outcome:i===0&&!improved?'timeout':i<3&&improved?'win':i===0?'loss':'timeout',
   captures:improved?3:2,bastionControlSeconds:improved?500:400,
   firstOrganizedAttack:i===2?null:improved?120:140,
   abortedMissions:improved?1:2,battleRetreats:improved?1:3,
   redUnitsLost:improved?2:4,blueUnitsLost:improved?4:2,
   enemyHQDamage:improved?60:20,score:improved?50:30,
   timeline:[{credits:improved?175:200},{credits:improved?165:150}]
  }));
  const report={
   schemaVersion:1,label:phase+'-map-'+map,complete:true,completedRuns:20,
   expectedRuns:20,maps:[map],seeds,modes:['director'],opponent:'contesting',
   ai33Policy:improved?'adaptive':'off',
   requestedSeconds:900,timestep:.05,
   simulationSourceHash:'same-compiled-game',catalogSourceHash:'same-catalog',
   opponentSourceHash:'same-opponent',details
  };
  writeFileSync(join(dir,'arena-'+map+'-'+phase+'.json'),JSON.stringify(report));
 }
 return dir;
}
test('rejects mismatched starting worlds rather than claiming an unfair comparison',()=>{
 const dir=fixture();
 try{
  const filename=join(dir,'arena-25-after.json');
  const j=JSON.parse(readFileSync(filename,'utf8'));
  j.details[0].initialStateHash='different-start';
  writeFileSync(filename,JSON.stringify(j));
  assert.throws(()=>ai33TournamentReport(dir),/Different or unmatched playable starting worlds/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('requires exactly 20 paired seeds per map and 900 second observation windows',()=>{
 const dir=fixture();
 try{
  const filename=join(dir,'arena-26-before.json');
  const report=JSON.parse(readFileSync(filename,'utf8'));
  report.requestedSeconds=120;
  writeFileSync(filename,JSON.stringify(report));
  assert.throws(()=>ai33TournamentReport(dir),/Incompatible experiment setting: requestedSeconds/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('aggregates exactly 60 fair pairs; wins and timeouts are separate',()=>{
 const dir=fixture();
 try{
  const report=ai33TournamentReport(dir),md=ai33Markdown(report);
  assert.equal(report.matchedPairs,60);
  assert.equal(report.baseline.timeouts,60);
  assert.equal(report.candidate.wins,9);
  assert.equal(report.candidate.timeouts,51);
  assert.equal(report.aggregateDelta.captures,1);
  assert.equal(report.aggregateDelta.bastionControlSeconds,100);
  assert.equal(report.aggregateDelta.battleRetreats,-2);
  assert.equal(report.mapsByMap.length,3);
  assert.match(md,/Zeitlimits \(keine Niederlagen\)/);
  assert.match(md,/20 Seeds je Karte/);
  assert.match(md,/KI 3.2 gegen KI 3.3/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('AI 3.3 comparison rejects mismatched binary even with identical starting worlds',()=>{
 const dir=fixture();
 try{
  const file=join(dir,'arena-24-after.json');
  const r=JSON.parse(readFileSync(file,'utf8'));
  r.simulationSourceHash='altered-code';
  writeFileSync(file,JSON.stringify(r));
  assert.throws(()=>ai33TournamentReport(dir),/Different binaries/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('AI 3.3 comparison rejects mislabeled baseline/candidate policy',()=>{
 const dir=fixture();
 try{
  const file=join(dir,'arena-25-before.json');
  const r=JSON.parse(readFileSync(file,'utf8'));
  r.details[4].ai33Policy='adaptive';
  writeFileSync(file,JSON.stringify(r));
  assert.throws(()=>ai33TournamentReport(dir),/Invalid AI 3.2\/3.3 A\/B policy selection/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
