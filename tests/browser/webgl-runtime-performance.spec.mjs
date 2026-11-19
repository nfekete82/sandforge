import {test,expect} from '@playwright/test';

test('WebGL 4× medium-sized fight remains live, leak-bounded and exception-free',async({page})=>{
 test.setTimeout(150000);
 const pageErrors=[],failedAssets=[];
 page.on('pageerror',error=>pageErrors.push(String(error)));
 page.on('response',response=>{
  if(response.status()>=400&&/\.js(?:\?|$)/.test(response.url()))
   failedAssets.push(response.url()+' '+response.status());
 });
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1&perf=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,
  {timeout:100000});
 const before=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game;
  if(!a.performance?.enabled)throw new Error('Performance sampler did not initialize');
  const owns=[0,1].map(owner=>g.units.find(u=>u.owner===owner&&u.hp>0)||
   g.bases.find(b=>b.owner===owner&&b.hp>0));
  if(!owns[0]||!owns[1])throw new Error('Initial armies missing');
  // Additional real simulation actors and pathfinding; LITE geometry avoids
  // making software CI rendering a GPU model-loading benchmark.
  for(let owner=0;owner<=1;owner++)for(let i=0;i<22;i++){
   const center=owns[owner],dx=(i%6-2.5)*29,dy=(Math.floor(i/6)-2)*31;
   g.spawn(owner,{x:Math.max(50,Math.min(g.world.size-50,center.x+dx)),
    y:Math.max(50,Math.min(g.world.size-50,center.y+dy))},i%6===0?'rover':'infantry');
  }
  g.spatial.rebuild(g.units);
  a.battlefield.sync(true);
  a.setSimulationSpeed(4);
  a.setSimulationRunning(true);
  return {time:g.time,actors:a.battlefield.units.size};
 });
 await page.waitForTimeout(5500);
 const report=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,p=a.performance.snapshot();
  return {...p,activeSpeed:a.simulationSpeed,
   running:a.simulationRunning,
   hitches:a.performance.spikeHistory().slice(-5)};
 });
 console.log('WEBGL_4X_PERFORMANCE '+JSON.stringify({
  fps:report.fps,frameP95:report.frameP95,lowFps:report.lowFps,
  simulationP95:report.simP95,pathP95:report.pathWorkP95,
  maxPathMs:report.maxPathCallMs,syncP95:report.syncP95,
  renderP95:report.renderP95,heapMB:report.jsHeapMB,
  textures:report.textures,geometries:report.geometries,
  actors:report.actors3d,sceneChildren:report.sceneChildren,
  hitchCount:report.hitchCount,clock:report.clock,hitches:report.hitches
 }));
 expect(report.activeSpeed).toBe(4);
 expect(report.running).toBe(true);
 expect(report.clock).toBeGreaterThan(before.time+.3);
 expect(report.actors3d).toBeGreaterThanOrEqual(30);
 expect(Number.isFinite(report.frameP95)).toBe(true);
 expect(report.frameP95).toBeGreaterThan(0);
 expect(report.drawCalls).toBeGreaterThan(0);
 expect(report.geometries).toBeGreaterThan(0);
 expect(report.textures).toBeLessThan(2500);
 expect(pageErrors).toEqual([]);
 expect(failedAssets).toEqual([]);
});
