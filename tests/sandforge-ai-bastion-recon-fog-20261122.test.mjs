import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 bastionReconRequired,bastionReconVantage,
 BASTION_RECON_MAX_WAIT,BASTION_RECON_AIR_SCOUT_GRACE
} from '../dist/src/reborn/ai-bastion-recon.js';

const situation={
 mapVersion:23,kind:'capture',owner:0,visible:false,explored:false,
 continuing:false,time:120,missionSince:100
};

test('public Bastion positions do not authorize a blind major attack',()=>{
 assert.equal(bastionReconRequired(situation),true);
 assert.equal(bastionReconRequired({...situation,owner:-1}),false,
  'neutral expansion stays immediate');
 assert.equal(bastionReconRequired({...situation,owner:1}),false);
 assert.equal(bastionReconRequired({...situation,explored:true}),false);
 assert.equal(bastionReconRequired({...situation,visible:true}),false);
 assert.equal(bastionReconRequired({...situation,continuing:true}),false,
  'do not recall an already fighting paid squad');
 assert.equal(bastionReconRequired({...situation,kind:'structure'}),false,
  'known buildings have independent observation/intelligence checks');
 assert.equal(bastionReconRequired({...situation,mapVersion:11}),false);
 assert.equal(bastionReconRequired({...situation,
  time:situation.missionSince+BASTION_RECON_MAX_WAIT}),false,
  'no permanent stall if no scout can reach the target');
 assert.ok(BASTION_RECON_AIR_SCOUT_GRACE>0&&
  BASTION_RECON_AIR_SCOUT_GRACE<BASTION_RECON_MAX_WAIT);
});

test('a scout selects an actual safe, reachable observation post',()=>{
 const x={from:{x:100,y:300},target:{x:850,y:300},sight:520,
  walkable:()=>true,reachable:()=>true,danger:()=>0};
 const p=bastionReconVantage(x);
 assert.ok(p);
 assert.ok(Math.hypot(p.x-x.target.x,p.y-x.target.y)<x.sight,
  'real paid unit must be able to reveal the Bastion with its sight');
 assert.ok(p.x<x.target.x,'approach from the scout side');
 assert.equal(bastionReconVantage({...x,reachable:()=>false}),undefined,
  'never claim an A* route when no route exists');
 assert.equal(bastionReconVantage({...x,walkable:()=>false}),undefined);
 assert.equal(bastionReconVantage({...x,danger:()=>10}),undefined,
  'currently known danger must exclude the vantage');
 const rotate=bastionReconVantage({...x,
  walkable:p=>Math.abs(p.y-x.target.y)>40});
 assert.ok(rotate&&Math.abs(rotate.y-x.target.y)>40,
  'try alternative angles around a blocked cliff');
});

test('fog persists even when public map provides every Bastion location',()=>{
 const g=Simulation.campaign(2988452066,23);
 assert.equal(g.territories.length,4);
 const red=g.units.find(u=>u.owner===1);
 assert.ok(red);
 const far=[...g.territories].sort((a,b)=>
  Math.hypot(b.point.x-red.x,b.point.y-red.y)-
  Math.hypot(a.point.x-red.x,a.point.y-red.y))[0];
 assert.ok(far,'Bastion position exists in public map data');
 assert.equal(g.canSee(1,far.point),false,
  'a public Bastion location must not grant vision');
 assert.equal(g.hasExplored(1,far.point),false,
  'visibility cannot be inferred from a coordinate alone');
});

test('actual mainline AI checks exploration and keeps neutral rush ungated',()=>{
 const tactical=readFileSync('src/reborn/tactical-ai.ts','utf8');
 const commander=readFileSync('src/reborn/campaign-commander.ts','utf8');
 assert.match(tactical,/bastionReconRequired\(\{/);
 assert.match(tactical,/bastionReconVantage\(\{/);
 assert.match(tactical,/g\.world\.path\(scout!,p,blockers,5\)/);
 assert.match(tactical,/stageForSiege\(post\?scout\?\.id:undefined\)/);
 assert.match(tactical,/t\.owner===-1\|\|\s*counter&&t\.owner===0&&g\.hasExplored\(1,t\.point\)/);
 assert.match(commander,/const surveyed=t\.owner===-1\|\|g\.world\.mapVersion<23\|\|g\.hasExplored\(1,t\.point\)/);
});
