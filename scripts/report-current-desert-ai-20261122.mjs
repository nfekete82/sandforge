/** Strict rollup of six current fixed desert maps x five paid BLUE policies. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const MAP_IDS=['desert-strike','broken-empire','burning-horizon',
 'last-stronghold','plateau-crossroads','mesa-highlands'];
export const REQUIRED_OPPONENTS=['guarded','contesting','bastion-rush',
 'fortified','mobile-defense'];

export function summarizeCurrentReports(reports){
 if(reports.length!==MAP_IDS.length)
  throw Error('Incomplete main benchmark: 6 map reports required');
 const all=[],mapRows=[];
 const round=(n,d=1)=>Number(n.toFixed(d));
 for(const id of MAP_IDS){
  const report=reports.find(r=>r.map===id);
  if(!report)throw Error('Missing report for '+id);
  if(!report.complete||report.completedRuns!==5||
     report.expectedRuns!==5||report.details?.length!==5)
   throw Error('Incomplete map '+id+' '+report.completedRuns+'/5');
  const opponents=report.details.map(d=>d.opponent).sort();
  if(JSON.stringify(opponents)!==JSON.stringify([...REQUIRED_OPPONENTS].sort()))
   throw Error('Opponent policies missing/duplicated on '+id);
  if(new Set(report.details.map(d=>d.initialStateHash)).size!==1)
   throw Error('Unequal starting state for '+id);
  if(report.details.some(d=>d.mapId!==id||
     d.generatorVersion!==report.generatorVersion||
     d.seed!==report.details[0].seed||d.mode!=='director'||
     !['win','loss','timeout'].includes(d.outcome)))
   throw Error('Wrong seed, generator, policy or outcome on '+id);
  all.push(...report.details);
  mapRows.push({map:id,version:report.generatorVersion,...report.summary});
 }
 if(all.length!==30)throw Error('Expected exactly 30 real matches');
 const n=all.length;
 const avg=k=>round(all.reduce((s,x)=>s+(Number(x[k])||0),0)/n,2);
 const total=k=>all.reduce((s,x)=>s+(Number(x[k])||0),0);
 const summary={
  matches:n,wins:all.filter(x=>x.outcome==='win').length,
  losses:all.filter(x=>x.outcome==='loss').length,
  timeouts:all.filter(x=>x.outcome==='timeout').length,
  hqDamaged:all.filter(x=>x.enemyHQDamaged).length,
  hqDestroyed:all.filter(x=>x.enemyHQDestroyed).length,
  meanNetCaptures:avg('netCaptures'),
  meanEnemyHQDamage:avg('enemyHQDamage'),
  meanAbortMissions:avg('abortedMissions'),
  meanStalledMissions:avg('stalledMissions'),
  meanVehicleStallSeconds:avg('vehicleStallSeconds'),
  airProduced:total('aircraftProduced'),
  droneProduced:all.reduce((n,x)=>n+(x.redProducedByKind?.drone??0),0),
  bomberProduced:all.reduce((n,x)=>n+(x.redProducedByKind?.bomber??0),0),
  totalBattleRetreats:total('battleRetreats'),
  totalRapidOrders:total('rapidUnitOrderChanges'),
  mapRows
 };
 const f=n=>Number(n??0).toFixed(1);
 const header=['# Sandforge: KI-Turnier auf aktuellem main (30 Partien)','',
  'Messaufbau: sechs echte Wuestenkarten, jeweils derselbe original Seed und',
  'Terrain-Generator v7/v10 gegen fuenf verschiedene bezahlte BLUE-Strategien.',
  'Beide Teams beginnen mit einem regulaeren HQ (Benchmark-Szenario,',
  'abweichend vom echten Kampagnenstart ohne HQ). Red hat keinen Fog-Cheat.',
  'Timeouts sind KEINE Siege. Headless-Benchmark, keine WebGL-FPS-Messung.','',
  '| Karte | Spiele | Siege | Niederlagen | Timeout | HQ getroffen | HQ zerstoert | Bastionen netto | Missionen abgebrochen | Fahrzeug-Stillstand s |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
 const rows=mapRows.map(r=>'| '+r.map+' | '+r.matches+' | '+r.wins+' | '+r.losses+
  ' | '+r.timeouts+' | '+r.hqDamaged+' | '+r.hqDestroyed+' | '+
  f(r.meanNetCaptures)+' | '+f(r.meanAbortedMissions)+' | '+
  f(r.meanVehicleStallSeconds)+' |');
 const findings=[
  '',
  '**Gesamt:** '+summary.wins+' Siege, '+summary.losses+' Niederlagen und '+
    summary.timeouts+' Zeitlimits / 30 Partien.',
  'HQ beschaedigt '+summary.hqDamaged+'x, zerstoert '+summary.hqDestroyed+'x.',
  'Durchschnittlich '+summary.meanAbortMissions+' abgebrochene Missionen, '+
    summary.meanStalledMissions+' gestallte Missionen pro Match.',
  'Durchschnittlich '+summary.meanVehicleStallSeconds+
    ' s Fahrzeug-Stillstand bei laufendem Bewegungsauftrag pro Match.',
  'Produzierte Bomber '+summary.bomberProduced+
    ', Aufklaerungsdrohnen '+summary.droneProduced+'.','',
  '## Messbasierte naechste Pruefpunkte',''
 ];
 if(summary.wins<=3)findings.push('- Endgame: wenige Siege trotz kompletter Partien.');
 if(summary.hqDamaged<10)findings.push('- HQ-Zugang: weniger als 10 Partien mit feindlichem HQ-Schaden.');
 if(summary.meanVehicleStallSeconds>30)findings.push('- Routen: auffaellige lange Fahrzeug-Stillstaende.');
 if(summary.meanAbortMissions>=2)findings.push('- Angriffskontinuitaet: viele abgebrochene Missionen.');
 if(summary.bomberProduced<10)findings.push('- Luftwaffe: selten produzierte Bomber.');
 findings.push('','Dies sind Messsignale, keine bewiesenen Fehlerursachen.',
  'A/B-Vergleiche verlangen identische Welt, Seeds, Gegner und Spieldauer.');
 return {summary,markdown:[...header,...rows,...findings].join('\n')+'\n'};
}
export function loadReports(dir){
 return MAP_IDS.map(id=>JSON.parse(readFileSync(join(dir,id+'.json'),'utf8')));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const dir=resolve(process.argv[2]??'reports');
 const output=resolve(process.argv[3]??'reports/aggregate');
 const result=summarizeCurrentReports(loadReports(dir));
 mkdirSync(output,{recursive:true});
 writeFileSync(join(output,'summary.md'),result.markdown);
 writeFileSync(join(output,'summary.json'),JSON.stringify(result.summary,null,2)+'\n');
 console.log(result.markdown);
}
