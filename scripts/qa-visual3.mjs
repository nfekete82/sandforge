/** Bounded local GPU A/B. Run AFTER one normal build; never starts AI games.
 * Baseline server must serve main's browser modules with the SAME built assets.
 * npm --prefix tests/browser install; BASELINE_URL=http://127.0.0.1:8104
 * CANDIDATE_URL=http://127.0.0.1:8103 node scripts/qa-visual3.mjs
 */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(new URL('../tests/browser/package.json',import.meta.url))('playwright');
const out=process.env.VISUAL3_OUTPUT??join(tmpdir(),'sandforge-visual3-qa');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],reports=process.env.VISUAL3_CANDIDATE_ONLY==='1'?
 [JSON.parse(readFileSync(out+'/report.json','utf8')).reports.find(r=>r.variant==='main')]:[];
const path='/webgl-preview.html?play=1&map=desert-strike&seed=9999&bastions=8&terrain=oasis&biome=desert&landscape=network&pause=1&perf=1&adaptive=0&post=1';
try{
 for(const [variant,base] of [['main',process.env.BASELINE_URL??'http://127.0.0.1:8104'],['visual3',process.env.CANDIDATE_URL??'http://127.0.0.1:8103']]){
  if(variant==='main'&&process.env.VISUAL3_CANDIDATE_ONLY==='1')continue;
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(variant+': '+String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(variant+': '+m.text());});
  await page.goto(base+path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{const a=window.__sandforgeWebGL;return a?.loaded&&a.desertArtReady&&a.authenticDesertReady;},null,{timeout:90000});
  const scene=await page.evaluate(variant=>{
   const a=window.__sandforgeWebGL,g=a.game,center=g.units.find(u=>u.owner===0);
   // Identical, paused medium army, using the existing public spawn/presenter.
   // No AI, orders, seed matrices or long simulation runs.
   for(let i=0;i<36;i++)g.spawn(0,{x:center.x+(i%9-4)*45,y:center.y+90+Math.floor(i/9)*55},i%6===0?'tank':i%5===0?'rover':'infantry');
   g.spatial.rebuild(g.units);g.updateVision();a.battlefield.sync(true);
   if(variant==='main'){
    // main's profiler normally counts only its LAST pass and excludes shadow
    // draws. Match the candidate's new whole-frame counters for a fair A/B.
    a.renderer.info.autoReset=false;const render=a.renderer.render.bind(a.renderer);
    a.renderer.render=(scene,camera)=>{if(scene===a.scene)a.renderer.info.reset();return render(scene,camera);};
   }
   document.getElementById('sf-webgl-performance')?.remove();
   const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {map:a.desertMapId,seed:g.seed,time:g.time,units:g.units.map(u=>[u.kind,u.owner,u.x,u.y]),
    camera:{position:a.camera.position.toArray(),target:a.controls.target.toArray(),zoom:a.camera.zoom},
    gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  },variant);
  await page.waitForFunction(()=>{const b=window.__sandforgeWebGL.battlefield;return !b.modelQueue.length&&!b.pending.size;},null,{timeout:60000});
  await page.waitForTimeout(4000);
  const metrics=await page.evaluate(()=>new Promise(resolve=>{
   const a=window.__sandforgeWebGL,frames=[],calls=[],triangles=[];let last=0;
   const sample=now=>{
    if(last){frames.push(now-last);calls.push(a.renderer.info.render.calls);triangles.push(a.renderer.info.render.triangles);}last=now;
    if(frames.length<300){requestAnimationFrame(sample);return;}
    const sorted=[...frames].sort((a,b)=>a-b),mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
    resolve({frames:frames.length,fps:1000/mean(frames),lowFps:1000/mean(sorted.slice(-Math.ceil(frames.length*.01))),
     frameP95:sorted[Math.ceil(frames.length*.95)-1],drawCalls:mean(calls),triangles:mean(triangles),
     geometryCount:a.renderer.info.memory.geometries,textureCount:a.renderer.info.memory.textures,
     post:a.visualPost?.snapshot()??null,lod:a.decorationLOD?.snapshot()??null});
   };requestAnimationFrame(sample);
  }));
  await page.screenshot({path:out+'/'+variant+'-desert-strike.png'});
  reports.push({variant,scene,metrics});console.log(JSON.stringify({variant,metrics}));
  if(variant==='visual3'){
   const smoke=await page.evaluate(async()=>{
    const a=window.__sandforgeWebGL;
    const before={geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures};
    const unit=a.game.units.find(u=>u.owner===0),entry=a.battlefield.units.get(unit.id);
    const point=entry.node.position.clone().project(a.camera),rect=a.renderer.domElement.getBoundingClientRect();
    const event={clientX:rect.left+(point.x+1)*rect.width/2,clientY:rect.top+(1-point.y)*rect.height/2};
    const selectedBefore=a.battlefield.friendlyAtPointer(event)?.entity.id;
    // Restore user zoom after each bounded transition. All render resources
    // must remain constant after the already-warmed post bypass variants.
    a.visualPost.setEnabled(false);await new Promise(r=>requestAnimationFrame(r));
    const selectedWithoutPost=a.battlefield.friendlyAtPointer(event)?.entity.id;
    a.visualPost.setEnabled(true);await new Promise(r=>requestAnimationFrame(r));
    const center=a.game.units.find(u=>u.owner===0);
    a.effects.blastAt(center.x,center.y,true);
    const lit=a.effects.blastLights.some(item=>item.light.intensity>0);
    a.setSimulationRunning(true);
    await new Promise(r=>setTimeout(r,1200));a.setSimulationRunning(false);
    return {before,after:{geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures},
     selectedBefore,selectedWithoutPost,explosionLightVisible:lit,clock:a.game.time,post:a.visualPost.snapshot()};
   });
   assert.equal(smoke.post.failed,false);assert.equal(smoke.explosionLightVisible,true);assert.ok(smoke.clock>0);
   assert.ok(smoke.selectedBefore!==undefined);assert.equal(smoke.selectedBefore,smoke.selectedWithoutPost);
   reports.at(-1).smoke=smoke;
   await page.screenshot({path:out+'/visual3-live-smoke.png'});
  }
  await page.close();
 }
 assert.deepEqual(reports[0].scene,reports[1].scene,'A/B scene, camera and GPU must match');
 assert.deepEqual(errors,[]);
}finally{
 writeFileSync(out+'/report.json',JSON.stringify({reports,errors},null,2)+'\n');await browser.close();
}
