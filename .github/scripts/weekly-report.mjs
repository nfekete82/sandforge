/** Sandforge recurring AI benchmark: strict fairness checks and ranked markdown.
 * This measures matches against the SAME scripted BLUE opponent, not direct PvP. */
import fs from 'node:fs';
import path from 'node:path';
const maps={24:8,25:12,26:16},names=['ai32','ai33','ai34','ai35'];
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const rnd=n=>Number(n.toFixed(3));
const fmt=n=>(100*n).toFixed(1)+'%';
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
export function analyze(dir){
 const table={};let expectedSeeds=null,horizon=null;
 for(const map of Object.keys(maps)){
  for(const name of names){
   const filename=path.join(dir,name+'-map'+map+'.json');
   const report=JSON.parse(fs.readFileSync(filename,'utf8'));
   assert(report.complete&&report.completedRuns===report.expectedRuns&&report.completedRuns>0,'Partial match '+filename);
   assert(report.maps?.length===1&&report.maps[0]===Number(map)&&report.modes?.join()==='director'&&report.opponent==='contesting','Invalid match settings '+filename);
   const details=report.details;
   assert(details.length===report.completedRuns,'Missing results '+filename);
   const seeds=details.map(d=>d.seed).sort((a,b)=>a-b);
   assert(new Set(seeds).size===seeds.length,'Duplicate seeds '+filename);
   if(expectedSeeds===null)expectedSeeds=JSON.stringify(seeds);
   assert(expectedSeeds===JSON.stringify(seeds),'Unpaired seeds '+filename);
   if(horizon===null)horizon=report.requestedSeconds;
   assert(horizon===report.requestedSeconds,'Different time horizon '+filename);
   for(const d of details){
    assert(d.mapVersion===Number(map)&&d.mode==='director'&&d.opponent==='contesting'&&d.requestedSeconds===horizon&&d.initialStateHash,'Wrong game identity '+filename);
    assert(d.ai33Policy===(name==='ai32'?'off':'adaptive'),'Wrong AI policy '+filename);
    if(name==='ai35')assert(d.ai35Policy==='control','Wrong AI 3.5 policy '+filename);
    assert(['win','loss','timeout'].includes(d.outcome)&&d.elapsedSeconds>0&&Number.isFinite(d.bastionControlSeconds)&&Number.isFinite(d.redSectors)&&Number.isFinite(d.territoriesLost)&&Number.isFinite(d.redUnitsLost),'Missing metrics '+filename);
    assert(d.redSectors>=0&&d.redSectors<=maps[map],'Impossible territory count '+filename);
   }
   table[name+':'+map]=details;
  }
  const old=new Map(table['ai32:'+map].map(d=>[d.seed,d.initialStateHash]));
  for(const name of names.slice(1))for(const d of table[name+':'+map])
   assert(old.get(d.seed)===d.initialStateHash,'Different initial world '+name+' map '+map+' seed '+d.seed);
 }
 const ranking=names.map(name=>{
  const details=Object.entries(maps).flatMap(([map,size])=>table[name+':'+map].map(d=>({
   ...d,share:d.bastionControlSeconds/(d.elapsedSeconds*size),held:d.redSectors/size
  })));
  return {name,games:details.length,wins:details.filter(d=>d.outcome==='win').length,
   losses:details.filter(d=>d.outcome==='loss').length,timeouts:details.filter(d=>d.outcome==='timeout').length,
   control:rnd(avg(details.map(d=>d.share))),held:rnd(avg(details.map(d=>d.held))),
   lost:rnd(avg(details.map(d=>d.territoriesLost))),casualties:rnd(avg(details.map(d=>d.redUnitsLost))),
   perMap:Object.entries(maps).map(([map,size])=>{
    const all=details.filter(d=>d.mapVersion===Number(map));
    return {map:Number(map),size,wins:all.filter(d=>d.outcome==='win').length,
     control:rnd(avg(all.map(d=>d.share))),held:rnd(avg(all.map(d=>d.held))),
     lost:rnd(avg(all.map(d=>d.territoriesLost)))};
   })};
 }).sort((a,b)=>b.wins-a.wins||b.control-a.control||b.held-a.held);
 const changes=[];
 for(const [older,newer] of [['ai32','ai33'],['ai33','ai34'],['ai34','ai35']])for(const [map,size] of Object.entries(maps)){
  const old=new Map(table[older+':'+map].map(d=>[d.seed,d]));
  const diffs=table[newer+':'+map].map(d=>{
   const a=old.get(d.seed);
   return d.bastionControlSeconds/(d.elapsedSeconds*size)-a.bastionControlSeconds/(a.elapsedSeconds*size);
  });
  changes.push({older,newer,map:Number(map),size,controlDelta:rnd(avg(diffs)),better:diffs.filter(d=>d>.001).length,worse:diffs.filter(d=>d<-.001).length,equal:diffs.filter(d=>Math.abs(d)<=.001).length});
 }
 return {generatedAt:new Date().toISOString(),seeds:JSON.parse(expectedSeeds),horizon,opponent:'contesting',ranking,changes,
  disclaimer:'Provisional, small seed count. Same scripted BLUE opponent per AI version; not direct AI-vs-AI. Timeouts do not count as wins.'};
}
export function markdown(r){
 const lines=['# Sandforge — wöchentliches KI-Turnier','',
  '**'+r.generatedAt+'** · '+r.seeds.length+' identische Seeds je Kartengröße · '+r.horizon+' Simulationssekunden · geskripteter BLAUER Gegner',
  '', '**Vorläufige Rangliste** – kleine Stichprobe; kein direktes KI-gegen-KI-Duell. Timeouts zählen nicht als Sieg.','',
  '| KI | Siege | Niederlagen | Zeitlimit | Bastionen-Kontrolle | Schlussbesitz | Bastionen verloren Ø | Einheiten verloren Ø |',
  '|---|---:|---:|---:|---:|---:|---:|---:|'];
 for(const a of r.ranking)lines.push('| '+a.name.toUpperCase()+' | '+a.wins+'/'+a.games+' | '+a.losses+' | '+a.timeouts+' | '+fmt(a.control)+' | '+fmt(a.held)+' | '+a.lost+' | '+a.casualties+' |');
 lines.push('','## Getrennt nach Kartengröße','',
  '| Karte | KI | Siege | Kontrolle | Schlussbesitz | Bastionen verloren Ø |',
  '|---|---|---:|---:|---:|---:|');
 for(const size of [8,12,16])for(const name of names){
  const a=r.ranking.find(x=>x.name===name).perMap.find(x=>x.size===size);
  lines.push('| '+size+' Bastionen | '+name.toUpperCase()+' | '+a.wins+'/'+r.seeds.length+' | '+fmt(a.control)+' | '+fmt(a.held)+' | '+a.lost+' |');
 }
 lines.push('','## Paarweiser Fortschritt (identische Seeds)','',
  '| Vergleich | Karte | Kontrolle Δ (Prozentpunkte) | Besser / Schlechter / Gleich |',
  '|---|---:|---:|---:|');
 for(const a of r.changes)lines.push('| '+a.newer.toUpperCase()+' vs '+a.older.toUpperCase()+' | '+a.size+' | '+(100*a.controlDelta).toFixed(1)+' | '+a.better+' / '+a.worse+' / '+a.equal+' |');
 lines.push('','**Priorisierung:** Erst Siege, dann der nach Kartengröße und Spieldauer normalisierte Bastionen-Kontrollanteil, danach der Schlussbesitz. Verglichen werden drei KIs gegen den gleichen geskripteten Gegner, mit exakt gleichem Startzustand. Kein automatisches Merge oder Live-Deployment.','');
 return lines.join('\n');
}
if(process.argv[1]&&process.argv[1].endsWith('weekly-report.mjs')){
 const dir=process.argv[2]||'reports',out=process.argv[3]||'out';
 const r=analyze(dir);fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'leaderboard.json'),JSON.stringify(r,null,2)+'\n');
 fs.writeFileSync(path.join(out,'leaderboard.md'),markdown(r));
 console.log(markdown(r));
}