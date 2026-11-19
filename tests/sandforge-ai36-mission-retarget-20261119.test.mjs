import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMissionTransition} from '../scripts/ai-test-mission-transition.mjs';
import {maintainAI36FrontOnRetarget} from '../dist/src/reborn/ai36-assault-continuity.js';
import {readFileSync} from 'node:fs';

const old={phase:'attack',groupId:7,target:3,objective:1000};

test('changing HQ 1000 to blocking turret 1006 in the same battle is a retarget, not an army abort',()=>{
 const next={...old,objective:1006};
 assert.equal(classifyMissionTransition(old,next),'retargeted');
 assert.equal(classifyMissionTransition(next,old),'retargeted');
});

test('real collapse, regrouping and different attack waves remain genuine aborts',()=>{
 for(const next of [
  {...old,phase:'regroup',objective:1006},
  {...old,groupId:8,objective:1006},
  {...old,target:4,objective:1006},
  {...old,phase:'gather'},
 ]){
  assert.equal(classifyMissionTransition(old,next),'aborted',JSON.stringify(next));
 }
 assert.equal(classifyMissionTransition(old,{...old}), 'aborted',
  'a no-op has no transition and is never passed to the classifier');
});

test('AI3.6 preserves a safe genuine nearby retarget without clearing rally',()=>{
 const scenario={sameSector:true,oldKind:'structure',newKind:'structure',
  objectiveDistance:420,observedObjective:true,activeAssault:true,
  livingAttackers:8,recentLosses:0};
 assert.equal(maintainAI36FrontOnRetarget(scenario),true);
 assert.equal(maintainAI36FrontOnRetarget({...scenario,
  observedObjective:false}),false);
 assert.equal(maintainAI36FrontOnRetarget({...scenario,
  recentLosses:3}),false);
});

test('arena counts aborts and objective retargets in distinct output fields',()=>{
 const script=readFileSync('scripts/benchmark-reborn-ai.mjs','utf8');
 assert.match(script,/retargetedMissions:0/);
 assert.match(script,/classifyMissionTransition\(mission,s\)/);
 assert.match(script,/reason==='retargeted'\)metrics\.retargetedMissions\+\+/);
});
