import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const files=process.argv.slice(2);
assert.equal(files.length,2,'usage: compare-ai-plan-spikes baseline.log candidate.log');
const parse=file=>readFileSync(file,'utf8').split('\n')
 .filter(line=>line.startsWith('AI_SPIKE ')).map(line=>JSON.parse(line.slice(9)));
const old=parse(files[0]),next=parse(files[1]);
assert.ok(old.length>0&&old.length===next.length,'equal nonempty runs');
const median=a=>{const x=[...a].sort((a,b)=>a-b);return x.length%2?x[x.length>>1]:(x[x.length/2-1]+x[x.length/2])/2;};
const groups=new Map();
for(let i=0;i<old.length;i++){
 const before=old[i],after=next[i];
 assert.equal(before.map,after.map);assert.equal(before.seed,after.seed);
 assert.equal(before.played,after.played);
 assert.deepEqual(before.state,after.state,'gameplay or fog decisions changed: '+before.map);
 const key=before.map,group=groups.get(key)??[];
 group.push({before,after});groups.set(key,group);
}
for(const [map,rows] of groups){
 const get=(which,key)=>median(rows.map(x=>x[which][key]));
 const data={map,repeats:rows.length,
  baseline:{pathCalls:get('before','pathCalls'),pathNodes:get('before','pathNodes'),
   pathMs:get('before','pathMs'),maxStepMs:get('before','maxStepMs')},
  candidate:{pathCalls:get('after','pathCalls'),pathNodes:get('after','pathNodes'),
   pathMs:get('after','pathMs'),maxStepMs:get('after','maxStepMs')},
  firstMacro:rows[0].before.profile.filter(x=>x.time>=3&&x.time<3.3),
  newMacro:rows[0].after.profile.filter(x=>x.time>=3&&x.time<3.3)};
 console.log('AI_SPIKE_AB '+JSON.stringify(data));
}
