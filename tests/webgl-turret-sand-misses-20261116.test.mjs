import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNIT_MISS_CHANCE,unitShotMisses}
 from '../dist/src/reborn/unit-accuracy.js';
import {calibratedScale,visualBuildingScale,visualUnitScale,TURRET_VISUAL_SCALE,
 MODEL_HEIGHTS} from '../scripts/webgl-scale.js';

test('turret bursts for both factions miss the sand 25% of the time without damage',()=>{
 assert.equal(UNIT_MISS_CHANCE,.25);
 for(const owner of [0,1]){
  const game=new Simulation(20261116+owner,4);
  game.stageWebGLProduction=true;
  const target=game.spawn(owner===0?1:0,{x:1320,y:1300},'infantry');
  assert.ok(target);
  const tower={id:81000+owner,kind:'turret',owner,x:1090,y:1110,hp:1000,
   radius:48,queue:[],buildRemaining:0,
   burst:{target:target.id,remaining:4,index:0,at:0}};
  let hits=0,misses=0;
  for(let i=0;i<240;i++){
   game.time=i*.05;
   tower.burst.index=i%4;
   const before=target.hp,previousShots=game.shots.length;
   game.damage(tower,target,.05,'turret',{x:tower.x+8,y:tower.y},i%2);
   assert.equal(game.shots.length,previousShots+1);
   const shot=game.shots.at(-1);
   assert.equal(shot.weapon,'turret');
   assert.equal(shot.source,tower.id);
   assert.equal(shot.barrel,i%2);
   assert.equal(shot.projected,true,'the tracer comes from a fixed defensive tower');
   const expected=unitShotMisses(game.seed,tower.id,target.id,game.time,211+i%4);
   assert.equal(Boolean(shot.miss),expected,'four burst shots have separate deterministic rolls');
   if(shot.miss){
    misses++;
    assert.equal(shot.hit,false);
    assert.equal(target.hp,before,'a miss cannot damage the unit');
    assert.equal(shot.impactElevation,0,'missed shell hits sand, not target height');
    assert.deepEqual(shot.groundTo,shot.to);
    assert.ok(Math.hypot(shot.to.x-target.x,shot.to.y-target.y)>25,
     'miss must impact outside the target footprint');
   }else{
    hits++;
    assert.equal(shot.hit,true);
    assert.ok(target.hp<before);
   }
  }
  assert.ok(misses>=42&&misses<=78,
   'turret miss rate must remain around 25%: '+misses+' / 240');
  assert.equal(hits+misses,240);
  assert.equal(game.save().shots,undefined,'transient miss visuals never alter save format');
 }
});

test('older non-WebGL sessions preserve their original turret hit behavior',()=>{
 const game=new Simulation(1044,4);
 game.stageWebGLProduction=false;
 const target=game.spawn(1,{x:1360,y:1310},'infantry');
 const turret={id:82511,kind:'turret',owner:0,x:1110,y:1110,
  hp:1000,queue:[],radius:40,buildRemaining:0,burst:{index:0}};
 game.time=5;
 const before=target.hp;
 game.damage(turret,target,.05,'turret',{x:1110,y:1110},0);
 assert.ok(target.hp<before);
 assert.equal(game.shots.at(-1)?.hit,true);
 assert.equal(game.shots.at(-1)?.miss,undefined);
});

test('defensive misses use visible sand dents and dust, not explosion or extra GPU geometry',()=>{
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(sim,/unitShooter\|\|weapon==='turret'/);
 assert.match(sim,/missedGroundPoint\(from,target,targetRadius,this.world.size/);
 assert.match(vfx,/if\(shot\.miss\)\{\s*this\.sandMissAt\(shot\)/);
 assert.match(vfx,/if\(!this\.game\.canSee\(0,point\)\)return/);
 assert.match(vfx,/const towerRound=shot\.weapon==='turret'/);
 assert.match(vfx,/this\.placeScorch\(point\.x,point\.y,towerRound\?/);
 assert.match(vfx,/for\(let i=0;i<\(towerRound\?7:5\);i\+\+\)/);
 assert.match(battle,/this\.heightAt\(shot\.to\.x,shot\.to\.y\)\+\(shot\.miss\?2:27\)/);
});

test('defensive turret shrinks 12% in gameplay, fallback and build ghost only',()=>{
 assert.equal(TURRET_VISUAL_SCALE,.88);
 assert.equal(visualBuildingScale('turret'),.88);
 assert.equal(visualBuildingScale('headquarters'),.92);
 assert.equal(visualBuildingScale('barracks'),1.10);
 assert.equal(visualUnitScale('infantry'),.38,
  'soldier stature follows the independently calibrated infantry scale');
 const bounds={x:110,y:100,z:92},width=120;
 const oldTurret=Math.min(width/110,MODEL_HEIGHTS.turret/100);
 const newTurret=calibratedScale('turret','building',bounds,width);
 assert.ok(Math.abs(newTurret-oldTurret*.88)<1e-10,
  'authored turret must shrink AFTER GLB width/height normalization');
 assert.equal(calibratedScale('barracks','building',bounds,width),
  Math.min(width/110,MODEL_HEIGHTS.barracks/100)*1.10,
  'barracks use their own recorded visual calibration');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(battle,/if\(type==='building'&&\['turret','factory','headquarters','barracks'\]\.includes\(kind\)\)\s*group\.scale\.setScalar\(visualBuildingScale\(kind\)\)/,
  'lite fallback and placement ghost must match the 88% authored turret');
 assert.match(battle,/const scale=calibratedScale\(entry\.kind,type,dims,desired\)/,
  'completed GLB must use the shared normalization scale');
 assert.match(battle,/const scale=calibratedScale\(kind,'building',size,spec\.width\)/,
  'construction ghost GLB must use the same visual scaling');
 // Range, tower radius, selection and turret simulation are authoritative
 // in the gameplay catalog, not modified by any of these presentation paths.
 const scaleSrc=readFileSync('scripts/webgl-scale.js','utf8');
 assert.match(scaleSrc,/Do NOT change BUILDINGS\.turret radius\/width or weapon range/);
});
