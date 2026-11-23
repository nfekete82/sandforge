/** Summarize opt-in frame profiling. Each RAF interval is compared with the
 * PRECEDING frame's work; AI/vision timings are nested inside simulation. */
import {readFileSync,writeFileSync} from 'node:fs';
const report=JSON.parse(readFileSync(process.argv[2],'utf8'));
const median=values=>{
 const v=[...values].sort((a,b)=>a-b),mid=Math.floor(v.length/2);
 return v.length%2?v[mid]:(v[mid-1]+v[mid])/2;
};
const stats=values=>{
 const v=[...values].sort((a,b)=>a-b),q=p=>v[Math.ceil(v.length*p)-1]??0;
 return {mean:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),p95:q(.95),p99:q(.99),max:v.at(-1)??0};
};
const runs=report.reports.map(run=>{
 const {columns,frames,longTasks}=run.metrics.profile;
 const index=key=>columns.indexOf(key),value=(row,key)=>index(key)<0?null:row[index(key)];
 const measured=frames.slice(31);
 const phases=['simulationMs','syncMs','effectsMs','emissionMs','renderMs','workMs'];
 const slowest=frames.map((row,i)=>({row,i})).slice(31)
  .sort((a,b)=>value(b.row,'intervalMs')-value(a.row,'intervalMs')).slice(0,6)
  .map(({row,i})=>{
   const previous=frames[i-1];
   const prior=Object.fromEntries(phases.map(key=>[key,value(previous,key)]));
   return {frame:i,clock:value(previous,'clock'),intervalMs:value(row,'intervalMs'),
    previousWork:prior,aiMs:value(previous,'aiMs'),visionMs:value(previous,'visionMs'),
    heapDeltaMiB:(value(row,'heapBytes')-value(previous,'heapBytes'))/1048576,
    particles:value(previous,'particles')};
  });
 return {map:run.map,variant:run.variant,trial:run.trial,frames:measured.length,
  softwareRendererBench:!!run.softwareQA,
  viewport:(run.screenWidth??1440)+'x'+(run.screenHeight??900),
  fps:run.metrics.fps,lowFps:run.metrics.lowFps,
  intervals:stats(measured.map(row=>value(row,'intervalMs'))),
  phases:Object.fromEntries(phases.map(key=>[key,stats(measured.map(row=>value(row,key)))])),
  over25ms:measured.filter(row=>value(row,'intervalMs')>25).length,
  longTasks,slowest,drawCalls:run.metrics.drawCalls,triangles:run.metrics.triangles};
});
const groups=[...new Set(runs.map(r=>r.map+'|'+r.variant))].map(key=>{
 const [map,variant]=key.split('|'),g=runs.filter(r=>r.map===map&&r.variant===variant);
 return {map,variant,runs:g.length,softwareRendererBench:g[0].softwareRendererBench,
  viewport:g[0].viewport,
  fpsMedian:g[0].softwareRendererBench?null:median(g.map(r=>r.fps)),
  lowFpsMedian:g[0].softwareRendererBench?null:median(g.map(r=>r.lowFps)),
  workMsMedian:median(g.map(r=>r.phases.workMs.mean)),
  syncMsMedian:median(g.map(r=>r.phases.syncMs.mean)),effectsMsMedian:median(g.map(r=>r.phases.effectsMs.mean))};
});
const result={note:'In softwareQA mode RAF intervals are disabled and FPS/1%-lows are intentionally omitted. CPU work values on SwiftShader are not native GPU speed. In ordinary RAF mode intervals reflect preceding-frame work; AI and vision timings are nested. Heap changes do not prove GC causality.',groups,runs};
const json=JSON.stringify(result,null,2)+'\n';
if(process.argv[3])writeFileSync(process.argv[3],json);else process.stdout.write(json);
