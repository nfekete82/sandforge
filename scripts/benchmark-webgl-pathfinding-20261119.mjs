/** Repeatable same-runner WebGL physics path benchmark.
 * Usage: node scripts/benchmark-webgl-pathfinding-20261119.mjs dist output.json
 * The baseline branch can be compiled in a separate worktree; the benchmark
 * itself always comes from this branch, ensuring exactly identical workloads.
 */
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const dir=resolve(process.argv[2]??'dist');
const destination=process.argv[3];
const load=relative=>import(pathToFileURL(resolve(dir,relative)).href);
const [{World},{RULES}]=await Promise.all([
 load('src/reborn/world.js'),load('src/reborn/config.js')
]);
const world=new World(2026,3);
world.blocked.fill(0);world.opaque.fill(0);world.components.fill(0);
const cell=world.cell,grid=RULES.grid;
// A solid rock face requires going around a legal pass rather than taking
// a cheap straight segment; move endpoints each request to stress A* state.
for(let y=65;y<180;y++)world.blocked[y*grid+118]=1;
const cases=Array.from({length:18},(_,i)=>({
 from:{x:(37+(i%6)+.5)*cell,y:(106+(i%11)+.5)*cell},
 to:{x:(188-(i%5)+.5)*cell,y:(118+(i%9)+.5)*cell}
}));
for(let i=0;i<2;i++)world.path(cases[i].from,cases[i].to,[],6,undefined,false,true,false);
const samples=[],results=[];
for(const sample of cases){
 const start=performance.now();
 const path=world.path(sample.from,sample.to,[],6,undefined,false,true,false);
 samples.push(performance.now()-start);
 results.push(path.map(p=>[Math.round(p.x*1e3)/1e3,Math.round(p.y*1e3)/1e3]));
 if(!path.length)throw Error('Unexpected missing path in scripted steep-rock routing fixture');
}
const ordered=[...samples].sort((a,b)=>a-b);
const ms=samples.reduce((a,b)=>a+b,0);
const report={
 runtime:process.version,queries:cases.length,
 totalMs:Number(ms.toFixed(3)),
 p50Ms:Number(ordered[Math.floor(ordered.length*.5)].toFixed(3)),
 p95Ms:Number(ordered[Math.ceil(ordered.length*.95)-1].toFixed(3)),
 maxMs:Number(ordered.at(-1).toFixed(3)),
 routeHash:createHash('sha256').update(JSON.stringify(results)).digest('hex'),
 steps:results.map(x=>x.length),
 worldGrid:grid
};
if(destination)writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
