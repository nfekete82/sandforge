import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';

function sectorAssault({hqDestroyed=false}={}){
 const game=new Simulation(2026);
 game.units=[];
 game.credits[1]=0;
 game.aiClock=-1e8;
 // Keep these tests about physical capture; never allow an AI production
 // order or an unrelated enemy pursuit to change the result.
 game.tactical.plan=()=>{};
 const enemyHQ=game.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(enemyHQ);
 const sector=game.territories[enemyHQ.territory];
 assert.equal(sector.owner,1);
 if(hqDestroyed)enemyHQ.hp=0;
 const capturer=game.spawn(0,{...sector.point},'infantry');
 const survivor=game.spawn(1,{x:300,y:300},'infantry');
 game.stop([capturer.id,survivor.id],true);
 return {game,sector,enemyHQ,capturer,survivor};
}
function advance(game,seconds){
 for(let i=0;i<Math.ceil(seconds/RULES.tick);i++)game.step();
}

test('an intact enemy command center prevents capturing its Bastion sector',()=>{
 const {game,sector,enemyHQ}=sectorAssault();
 advance(game,RULES.captureTime+2);
 assert.equal(sector.owner,1);
 assert.equal(sector.progress,0);
 assert.equal(enemyHQ.owner,1);
 assert.ok(enemyHQ.hp>0);
 assert.equal(game.status,'playing');
});

test('Bastion capture never transfers or resurrects a destroyed enemy command center',()=>{
 const {game,sector,enemyHQ,survivor}=sectorAssault({hqDestroyed:true});
 const originalId=enemyHQ.id;
 advance(game,RULES.captureTime+2);
 assert.equal(sector.owner,0,'Bastion changes control normally');
 assert.equal(sector.progress,0);
 assert.equal(enemyHQ.owner,1,'headquarters remains an enemy structure');
 assert.equal(enemyHQ.hp,0,'destroyed headquarters stays destroyed');
 assert.equal(game.bases.filter(b=>b.id===originalId).length,1,
  'capture must not create a second or restored headquarters');
 assert.equal(game.status,'playing','one enemy survivor prevents victory');
 const loaded=Simulation.load(game.save());
 const restored=loaded.bases.find(b=>b.id===originalId);
 assert.equal(loaded.territories[sector.id].owner,0);
 assert.equal(restored.owner,1);
 assert.equal(restored.hp,0,'save/load must not revive captured HQ');
 survivor.hp=0;
 game.step();
 assert.equal(game.status,'victory','only actual remaining enemy assets count');
 assert.equal(enemyHQ.owner,1);
 assert.equal(enemyHQ.hp,0);
});
