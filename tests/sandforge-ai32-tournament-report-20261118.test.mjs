import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tournamentReport,reportMarkdown} from '../scripts/ai32-tournament-report.mjs';

const maps=[24,25,26],seeds=Array.from({length:20},(_,i)=>2601+i);
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'sandforge-ai32-report-'));
 for(const map of maps)for(const phase of ['before','after']){
  const improved=phase==='after';
  const details=seeds.map((seed,i)=>({
   seed,mapVersion:map,mode:'director',opponent:'contesting',
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
   requestedSeconds:900,timestep:.05,
   simulationSourceHash:improved?'new-code':'old-code',catalogSourceHash:'same-catalog',
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
  assert.throws(()=>tournamentReport(dir),/Different or unmatched playable starting worlds/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('requires exactly 20 paired seeds per map and 900 second observation windows',()=>{
 const dir=fixture();
 try{
  const filename=join(dir,'arena-26-before.json');
  const report=JSON.parse(readFileSync(filename,'utf8'));
  report.requestedSeconds=120;
  writeFileSync(filename,JSON.stringify(report));
  assert.throws(()=>tournamentReport(dir),/Incompatible experiment setting: requestedSeconds/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('aggregates exactly 60 fair pairs; wins and timeouts are separate',()=>{
 const dir=fixture();
 try{
  const report=tournamentReport(dir),md=reportMarkdown(report);
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
 }finally{rmSync(dir,{recursive:true,force:true});}
});
