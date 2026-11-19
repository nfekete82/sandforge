import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WRECK_LIFETIME_SECONDS,WRECK_LIFETIMES,WRECK_CAP,WRECK_CAP_LITE,
 CRASH_CAP,CRASH_LIFETIME_SECONDS,wreckDurationFor,wreckSmokeFraction,
 isWreckableUnit,addWreckRecord,advanceWreckRecords,wreckSink
} from '../scripts/webgl-wreck-lifecycle.js';
import {
 aircraftCrashPose,crashDurationFor,CRASH_HELICOPTER_SECONDS,CRASH_BOMBER_SECONDS
} from '../scripts/webgl-aircraft-effects.js';

test('all vehicles use capped, distinct smoke/wreck lifetimes and never become game collision',()=>{
 assert.equal(WRECK_LIFETIME_SECONDS,28);
 assert.equal(WRECK_CAP,24);assert.equal(WRECK_CAP_LITE,12);
 assert.equal(wreckDurationFor('tank'),35);
 assert.equal(wreckDurationFor('artillery'),32);
 assert.equal(wreckDurationFor('rover'),21);
 assert.equal(wreckDurationFor('supply'),18);
 assert.equal(wreckDurationFor('bomber'),35);
 assert.ok(isWreckableUnit('supply'));
 const wrecks=[];
 for(let i=0;i<700;i++)addWreckRecord(wrecks,{
  kind:i%2?'tank':'supply',x:i,y:150,angle:i
 },WRECK_CAP_LITE);
 assert.equal(wrecks.length,WRECK_CAP_LITE);
 assert.equal(wrecks[0].x,700-WRECK_CAP_LITE);
 const sample=wrecks.at(-1);
 assert.equal(wreckSmokeFraction(sample),1);
 advanceWreckRecords(wrecks,3);
 assert.ok(wreckSmokeFraction(sample)>0&&wreckSmokeFraction(sample)<1);
 advanceWreckRecords(wrecks,35);
 assert.equal(wrecks.length,0);
 assert.equal(wreckSink({age:33,ttl:35})>0,true);
 assert.equal(addWreckRecord(wrecks,{kind:'infantry',x:8,y:8}),false);
 assert.equal(addWreckRecord(wrecks,{kind:'bomber',x:Infinity,y:8}),false);
});

test('helicopter descends with spiral while bomber follows a longer falling arc',()=>{
 assert.equal(CRASH_CAP,6);
 assert.equal(CRASH_LIFETIME_SECONDS,CRASH_HELICOPTER_SECONDS);
 assert.ok(CRASH_BOMBER_SECONDS<CRASH_HELICOPTER_SECONDS);
 for(const kind of ['scout','bomber']){
  const duration=crashDurationFor(kind);
  const origin={x:1100,y:1350},heading=.62;
  const start=aircraftCrashPose(kind,origin,heading,0,duration);
  const mid=aircraftCrashPose(kind,origin,heading,duration*.5,duration);
  const end=aircraftCrashPose(kind,origin,heading,duration,duration);
  assert.deepEqual({x:start.x,y:start.y,lift:start.lift},{...origin,lift:1});
  assert.equal(end.lift,0);
  assert.ok(mid.lift>0&&mid.lift<1);
  assert.ok(Math.hypot(end.x-origin.x,end.y-origin.y)>
   Math.hypot(mid.x-origin.x,mid.y-origin.y));
  assert.ok(Number.isFinite(mid.bank)&&Number.isFinite(mid.pitch));
  assert.deepEqual(aircraftCrashPose(kind,origin,heading,duration*.5,duration),mid,
   'cosmetic crash does not use gameplay RNG');
 }
 const origin={x:1400,y:1400};
 const heli=aircraftCrashPose('scout',origin,0,CRASH_HELICOPTER_SECONDS*.5,CRASH_HELICOPTER_SECONDS);
 const bomber=aircraftCrashPose('bomber',origin,0,CRASH_BOMBER_SECONDS*.5,CRASH_BOMBER_SECONDS);
 assert.ok(Math.abs(heli.y-origin.y)>8,'helis spiral sideways');
 assert.ok(bomber.x>heli.x,'bombers coast farther before hitting sand');
});

test('fallen infantry uses real PBR actor materials, fades smoothly and disposes clones',()=>{
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(actor,/this\.remnantSeconds=9/);
 assert.match(actor,/this\.remnantFadeSeconds=2\.1/);
 assert.match(actor,/this\.maxRemnants=28/);
 assert.match(actor,/material\.clone\(\)/);
 assert.match(actor,/material\.opacity=opacity\*alpha/);
 assert.match(actor,/this\.removeRemnant\(r\)/);
 assert.match(actor,/for\(const owned of r\.ownedOriginals/);
 assert.match(actor,/entry\.node\.remove\(detail\)/);
 assert.doesNotMatch(actor,/new THREE\.BoxGeometry\([^\n]*death/);
});

test('real shots add restrained muzzle haze, pooled wreck embers and ground-only end impact',()=>{
 const source=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 for(const feature of [
  'muzzleAt(shot){','this.muzzleAt(shot);',
  'this.wreckSmokeClock+=dt;',
  'wreckSmokeFraction(wreck)',
  'aircraftCrashPose(c.kind,',
  'duration:crashDurationFor(u.kind)',
  'this.addWreck({...c,x,y:z});',
  'this.particle(this.sparks',
  'this.particle(this.dust',
  'this.particle(this.flames'
 ])assert.ok(source.includes(feature),'missing VFX '+feature);
 assert.match(source,/this\.game\.canSee\(0,p\)/,'muzzle effects honor player fog');
 assert.match(source,/smoked<4/,'limit active wreck emitters');
 assert.match(source,/this\.crashes\.length>=CRASH_CAP/,'limit active crash actors');
 assert.match(source,/advanceWreckRecords\(this\.wrecks,dt\)/);
 for(const forbidden of ['this.game.step(','.recruit(','.build('])
  assert.ok(!source.includes(forbidden),'visuals must not change game simulation');
});
