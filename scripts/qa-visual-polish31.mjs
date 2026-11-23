/** Deterministic A/B: origin/main's five renderer modules, same built GLBs,
 * maps, camera, simulation ticks and GPU. Does not alter repository assets.
 * Run after npm run build with a local server at POLISH31_URL.
 */
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(new URL('../tests/browser/package.json',import.meta.url))('playwright');
const out=process.env.POLISH31_OUTPUT??'/private/tmp/sandforge-polish31-qa';mkdirSync(out,{recursive:true});
const base=process.env.POLISH31_URL??'http://127.0.0.1:8113';
const ref=process.env.POLISH31_BASE_REF??'origin/main';
const modules=['webgl-battlefield','webgl-actor-presentation','webgl-building-pbr','webgl-building-shading','webgl-combat-vfx'];
const original=new Map(modules.map(name=>[name+'.js',execFileSync('git',['show',ref+':scripts/'+name+'.js'],{encoding:'utf8'})]));
const frames=Number(process.env.POLISH31_FRAMES??300);
assert.ok(Number.isInteger(frames)&&frames>=60&&frames%3===0,'Use at least 60 frames, divisible by three');
const profile=process.env.POLISH31_PROFILE==='1';
const variants=(process.env.POLISH31_VARIANTS??'before,after').split(',');
assert.ok(variants.every(v=>['before','submitted','after'].includes(v)),'Unknown comparison variant');
const submitted=variants.includes('submitted')?new Map(
 [...modules,'webgl-vehicle-polish','webgl-particle-finish'].map(name=>
  [name+'.js',execFileSync('git',['show','8512c9e8:scripts/'+name+'.js'],{encoding:'utf8'})])):null;
const browser=await chromium.launch({
 channel:process.env.POLISH31_CHANNEL??'chrome',headless:true
});
const stress=process.env.POLISH31_STRESS==='1';
const actorCount=stress?48:12,enemyCount=stress?12:4;
const variantTimeout=Number(process.env.POLISH31_VARIANT_TIMEOUT_MS??720000);
assert.ok(Number.isFinite(variantTimeout)&&variantTimeout>=120000,
 'Invalid POLISH31_VARIANT_TIMEOUT_MS');
const timeBound=(promise,label)=>{
 let timer;
 return Promise.race([
  promise,
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(
   Error('POLISH31_TIMEOUT '+label+' after '+variantTimeout+'ms')),variantTimeout);})
 ]).finally(()=>clearTimeout(timer));
};
const reports=[],errors=[];
const maps=[['desert-strike',9999,8,'oasis'],['broken-empire',2026,12,'rocky'],['burning-horizon',1907,16,'dunes']];
try{
 for(const [map,seed,bastions,terrain] of maps){
  if(process.env.POLISH31_MAP&&process.env.POLISH31_MAP!==map)continue;
  if(process.env.POLISH31_MAPS&&!process.env.POLISH31_MAPS.split(',').includes(map))continue;
  for(const [trial,variant] of variants.entries()){
   if(process.env.POLISH31_VARIANT&&process.env.POLISH31_VARIANT!==variant)continue;
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,
    ...(process.env.POLISH31_VIDEO==='1'?{recordVideo:{dir:out+'/video',size:{width:1440,height:900}}}:{})});
   console.log('POLISH31_STAGE '+JSON.stringify({map,variant,stress,stage:'page-open',frames,trial}));
   page.on('pageerror',e=>errors.push({map,variant,message:e.message}));
   page.on('console',m=>{
    if(m.text().startsWith('POLISH31_PROGRESS '))console.log(m.text());
    if(m.type()==='error'&&/WebGL|shader|VALIDATE_STATUS/.test(m.text()))
     errors.push({map,variant,message:m.text()});
   });
   if(variant==='before'||variant==='submitted')await page.route('**/webgl-*.js',route=>{
    const body=(variant==='submitted'?submitted:original).get(new URL(route.request().url()).pathname.slice(1));
    return body?route.fulfill({contentType:'text/javascript',body}):route.continue();
   });
   await page.goto(base+`/webgl-preview.html?play=1&map=${map}&seed=${seed}&bastions=${bastions}&terrain=${terrain}&biome=desert&landscape=network&pause=1&perf=1&adaptive=0&post=${process.env.POLISH31_POST??0}`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{const a=window.__sandforgeWebGL;return a?.loaded&&a.authenticDesertReady&&a.desertArtReady;},null,{timeout:120000});
   console.log('POLISH31_STAGE '+JSON.stringify({map,variant,stage:'scene-ready'}));
   const scene=await timeBound(page.evaluate(async({stress,actorCount,enemyCount})=>{
    const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
    a.renderer.setAnimationLoop(null);
    const {BUILDINGS}=await import('/src/reborn/catalog.js');
    const home=g.units.find(u=>u.owner===0),x=home.x,y=home.y;
    // A bounded fixture uses real models and simulation entities. Buildings
    // and movement are deliberately identical across both renderer variants.
    for(const [i,kind] of ['headquarters','barracks','factory'].entries()){
     const spec=BUILDINGS[kind];
     g.bases.push({id:9800+i,owner:0,kind,x:x-270+i*270,y:y-200,hp:spec.hp,
      territory:home.territory??0,radius:spec.radius,queue:[],queueTypes:[],production:0,
      buildRemaining:0,cooldown:0,rally:null});
    }
    const actors=[];
    // Normal graphics A/B uses the original 12+4 fixture unchanged.
    // Stress A/B uses 48 friendly and 12 enemy REAL model-backed vehicles,
    // including the same physical collisions, shots, AI and VFX on both sides.
    for(let i=0;i<actorCount;i++){
     const u=g.spawn(0,stress
      ?{x:x-250+(i%8)*88,y:y+80+Math.floor(i/8)*100}
      :{x:x-240+(i%6)*92,y:y+85+Math.floor(i/6)*115},
      i%3===0?'tank':i%3===1?'rover':'artillery');
     u.guardArea=true;actors.push(u.id);
    }
    // The stress variant introduces a genuine second armored line.
    for(let i=0;i<enemyCount;i++){
     const u=g.spawn(1,stress
      ?{x:x-190+(i%6)*118,y:y+470+Math.floor(i/6)*116}
      :{x:x-190+i*125,y:y+430},'tank');
     u.guardArea=true;
    }
    g.spatial.rebuild(g.units);g.updateVision();b.sync(true,0,false,1);
    // A second camera makes normal RTS zoom and optional close inspection
    // reproducible. Default strategic zoom is kept at .59.
    const target=a.controls.target.clone();target.x=x-g.world.size/2+50;target.z=y-g.world.size/2+20;
    target.y=a.heightAt(x,y)+42;
    const offset=a.camera.position.clone().sub(a.controls.target);
    a.controls.target.copy(target);a.camera.position.copy(target).add(offset);
    a.camera.zoom=.59;a.camera.updateProjectionMatrix();a.controls.update();
    a.scene.getObjectByName('sf-webgl-performance')?.removeFromParent();
    document.getElementById('sf-webgl-performance')?.remove();
    globalThis.__polish31Actors=actors;
    const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {seed:g.seed,map:a.desertMapId,actors:actors.length,
     camera:{position:a.camera.position.toArray(),target:a.controls.target.toArray(),zoom:a.camera.zoom},
     gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
   },{stress,actorCount,enemyCount}),map+'/'+variant+'/scene-setup');
   console.log('POLISH31_STAGE '+JSON.stringify({map,variant,stage:'models-loading'}));
   await page.waitForFunction(()=>{const b=window.__sandforgeWebGL.battlefield;return !b.loadingCount&&!b.modelQueue.length&&!b.pending.size;},null,{timeout:120000});
   console.log('POLISH31_STAGE '+JSON.stringify({map,variant,stage:'models-ready'}));
   await page.evaluate(()=>{
    const a=window.__sandforgeWebGL;a.battlefield.sync(true,0,false,1);
    a.renderer.info.reset();a.visualPost.render(a.scene,a.camera);
   });
   await page.screenshot({path:`${out}/${map}-${variant}-rts.png`});
   const metrics=await timeBound(page.evaluate(async({frames,profile,stress})=>{
    const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
    const ids=globalThis.__polish31Actors;
    const movers=g.units.filter(u=>ids.includes(u.id)).slice(0,stress?24:6);
    for(const u of movers)g.command([u.id],{kind:'move',x:u.x+210,y:u.y+80});
    const initialDetails=ids.filter(id=>b.units.get(id)?.detail).length;
    const stats=[],poses=[],shotsBefore=b.presentation.stats.shots;
    const raw=profile?new Float64Array(frames*16):null,longTasks=[];
    const observer=profile?new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push([e.startTime,e.duration]);}):null;
    observer?.observe({entryTypes:['longtask']});
    const render=()=>{a.renderer.info.reset();a.visualPost.render(a.scene,a.camera);};
    // Warm all visible PBR/particle shader variants before recording costs.
    const centre=movers[0];a.effects.blastAt(centre.x+170,centre.y+70,true);
    for(let i=0;i<45;i++){a.effects.update(1/60,true);render();await new Promise(r=>requestAnimationFrame(r));}
    const samples=[];let last=performance.now();
    let lastAi=g.aiPlanCompletedAt,lastVision=g.visionCompletedAt;
    for(let i=0;i<frames;i++){
     if(i%120===0)console.info('POLISH31_PROGRESS '+JSON.stringify({
      frame:i,frames,stress,simTime:Number(g.time.toFixed(2)),
      vehicleCount:g.units.filter(u=>u.owner===0||u.owner===1).length
     }));
     await new Promise(r=>requestAnimationFrame(r));
     const now=performance.now();samples.push(now-last);last=now;
     if(profile){g.resetSquadProfile?.();g.world.resetPathProfile?.();}
     const start=performance.now();
     if(i%3===0){g.beginRenderFrame();try{g.step(.05);}finally{g.endRenderFrame();}}
     const simEnd=performance.now();
     b.sync(false,1/60,true,(i%3)/3);const syncEnd=performance.now();
     a.effects.update(1/60,true,(i%3)/60);const fxEnd=performance.now();
     if(i%(stress?30:60)===0)for(let j=0;j<(stress?12:3);j++)a.effects.blastAt(centre.x+120+(j%6)*85,centre.y+170+Math.floor(j/6)*90,true);
     const synced=performance.now();render();const end=performance.now();
     if(raw){const k=i*16;
      raw[k]=now;raw[k+1]=samples.at(-1);raw[k+2]=simEnd-start;raw[k+3]=syncEnd-simEnd;
      raw[k+4]=fxEnd-syncEnd;raw[k+5]=synced-fxEnd;raw[k+6]=end-synced;
      raw[k+7]=performance.memory?.usedJSHeapSize??0;let particles=0;for(const pool of a.effects.pools)particles+=pool.particles.length;raw[k+8]=particles;
      raw[k+9]=a.renderer.info.render.calls;raw[k+10]=a.renderer.info.render.triangles;raw[k+11]=end-now;raw[k+12]=g.time;
      raw[k+13]=g.aiPlanCompletedAt!==lastAi?(g.aiPlanDurationMs??0):0;
      raw[k+14]=g.visionCompletedAt!==lastVision?(g.visionDurationMs??0):0;
      raw[k+15]=g.world.pathCostMs??0;
      lastAi=g.aiPlanCompletedAt;lastVision=g.visionCompletedAt;
     }
     if(i>30)stats.push({work:end-start,simulation:simEnd-start,presentation:synced-simEnd,render:end-synced,calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles});
     if(i%6===0){const u=movers[0],e=b.units.get(u.id);poses.push({frame:i,x:u.x,y:u.y,hull:u.hullAngle,renderYaw:e.node.rotation.y,pitch:e.node.rotation.x,barrel:e.tankRig?.gun?.position.toArray(),shots:b.presentation.stats.shots});}
    }
    const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
    const sorted=samples.slice(31).sort((a,b)=>a-b);
    const metric=key=>mean(stats.map(x=>x[key]));
    observer?.disconnect();
    const geometry=a.renderer.info.memory.geometries,textures=a.renderer.info.memory.textures;
    return {
     ...(raw?{profile:{columns:['startedAt','intervalMs','simulationMs','syncMs','effectsMs','emissionMs','renderMs','heapBytes','particles','calls','triangles','workMs','clock','aiMs','visionMs','pathMs'],
      frames:Array.from({length:frames},(_,i)=>Array.from(raw.subarray(i*16,(i+1)*16))),longTasks}}:{}),
     fps:1000/mean(sorted),lowFps:1000/mean(sorted.slice(-Math.ceil(sorted.length*.01))),
     frameP95:sorted[Math.ceil(sorted.length*.95)-1],workMs:metric('work'),simulationMs:metric('simulation'),presentationMs:metric('presentation'),renderMs:metric('render'),
     drawCalls:metric('calls'),triangles:metric('triangles'),geometries:geometry,textures,
     heapMB:performance.memory?.usedJSHeapSize/1048576,initialDetails,shots:b.presentation.stats.shots-shotsBefore,
     poses,simulation:g.units.map(u=>[u.id,u.kind,u.x,u.y,u.hp]),clock:g.time,
     actualDetails:ids.filter(id=>b.units.get(id)?.detail).length,
     particleCap:a.effects.pools.map(p=>({mode:p.mode,max:p.max,count:p.mesh.count})),
     post:a.visualPost.snapshot(),glError:a.renderer.getContext().getError()};
   },{frames,profile,stress}),map+'/'+variant+'/600-frames');
   console.log('POLISH31_STAGE '+JSON.stringify({map,variant,stage:'metrics-done',workMs:metrics.workMs}));
   await page.screenshot({path:`${out}/${map}-${variant}-combat.png`});
   reports.push({map,variant,trial,stress,actorCount,enemyCount,scene,metrics});
   writeFileSync(out+'/report.json',JSON.stringify({baseRef:ref,reports,errors},null,2)+'\n');
   console.log(JSON.stringify({map,variant,...Object.fromEntries(Object.entries(metrics).filter(([k])=>!['poses','simulation','particleCap','profile'].includes(k)))}));
   const video=page.video();await page.close();
   if(video)renameSync(await video.path(),`${out}/${map}-${variant}-animation.webm`);
  }
 }
 for(const map of maps.map(m=>m[0])){
  const peers=reports.filter(r=>r.map===map),reference=peers[0];
  for(const peer of peers){
   assert.deepEqual(reference.scene,peer.scene,'same map, camera and GPU');
   assert.deepEqual(reference.metrics.simulation,peer.metrics.simulation,'presentation cannot change simulation');
   assert.equal(peer.metrics.initialDetails,actorCount,'all real vehicle GLBs loaded');
   assert.equal(peer.metrics.glError,0);
   assert.ok(peer.metrics.shots>0,'real combat animation verified');
   assert.equal(peer.metrics.actualDetails<=actorCount,true,'bounded vehicle details');
  }
 }
 assert.deepEqual(errors,[]);
}finally{
 writeFileSync(out+'/report.json',JSON.stringify({baseRef:ref,reports,errors},null,2)+'\n');
 await browser.close();
}
