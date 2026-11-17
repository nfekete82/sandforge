#!/usr/bin/env node
/** Matched KI 3.1 vs KI 3.2 tournament: strict reproducibility checks.
 * The original arena code runs both versions against the SAME scripted BLUE
 * opponent, without changing red economy, vision or unit stats.
 * Only the compiled Simulation module is swapped between runs.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compareArenaReports} from './ai-test-arena-compare.mjs';

const MAPS=[24,25,26],EXPECTED_SEEDS=20;
const round=n=>Math.round(n*1000)/1000;
const mean=(rows,metric)=>{
 const nums=rows.map(r=>r[metric]).filter(n=>typeof n==='number'&&Number.isFinite(n));
 return nums.length?round(nums.reduce((a,b)=>a+b,0)/nums.length):null;
};
const counts=rs=>({
 wins:rs.filter(x=>x.outcome==='win').length,
 losses:rs.filter(x=>x.outcome==='loss').length,
 timeouts:rs.filter(x=>x.outcome==='timeout').length
});
const timelineCredits=r=>r.timeline?.length?round(r.timeline.reduce((n,t)=>n+t.credits,0)/r.timeline.length):null;
const stat=(rs)=>({
 ...counts(rs),matches:rs.length,
 meanCaptures:mean(rs,'captures'),
 meanBastionSeconds:mean(rs,'bastionControlSeconds'),
 meanFirstAttack:mean(rs,'firstOrganizedAttack'),
 firstAttackObserved:rs.filter(r=>Number.isFinite(r.firstOrganizedAttack)).length,
 meanMissionAborts:mean(rs,'abortedMissions'),
 meanRetreats:mean(rs,'battleRetreats'),
 meanRedLosses:mean(rs,'redUnitsLost'),
 meanBlueLosses:mean(rs,'blueUnitsLost'),
 meanHQDamage:mean(rs,'enemyHQDamage'),
 meanSpareCredits:mean(rs.map(r=>({credits:timelineCredits(r)})),'credits'),
 meanScore:mean(rs,'score')
});
const fmt=x=>x===null?'–':typeof x==='number'?Number(x.toFixed(2)).toLocaleString('de-DE'):String(x);
const delta=(a,b)=>a===null||b===null?null:round(b-a);
const allSame=(rows,key)=>rows.every(r=>r[key]===rows[0][key]);

export function tournamentReport(folder){
 const maps=[],before=[],after=[],pairs=[];
 for(const map of MAPS){
  const read=phase=>JSON.parse(readFileSync(join(folder,'arena-'+map+'-'+phase+'.json'),'utf8'));
  const old=read('before'),next=read('after');
  const cmp=compareArenaReports(old,next);
  for(const r of [old,next]){
   if(r.details.length!==EXPECTED_SEEDS||r.modes.length!==1||r.modes[0]!=='director'||
      r.maps.length!==1||r.maps[0]!==map||r.seeds.length!==EXPECTED_SEEDS||
      r.opponent!=='contesting'||r.requestedSeconds!==900||r.timestep!==.05)
    throw Error('Invalid experiment design for map '+map);
   if(new Set(r.seeds).size!==EXPECTED_SEEDS||
      r.details.some(d=>d.mode!=='director'||d.mapVersion!==map||
       !['win','loss','timeout'].includes(d.outcome)))
    throw Error('Invalid results for map '+map);
  }
  if(cmp.pairs!==EXPECTED_SEEDS||cmp.worldMismatches.length||cmp.unmatchedBefore||cmp.unmatchedAfter)
   throw Error('Paired initial worlds do not match: '+map);
  maps.push({map,before:stat(old.details),after:stat(next.details),
   matched:cmp.pairs,extraWins:cmp.extraWins,meanScoreDelta:cmp.meanScoreDelta,
   meanCaptureDelta:cmp.meanCaptureDelta,meanAbortedMissionsDelta:cmp.meanAbortedMissionsDelta,
   worldMismatches:cmp.worldMismatches});
  before.push(...old.details);after.push(...next.details);pairs.push(...cmp.perMatch);
 }
 const baseline={...stat(before),simulationCodeHashes:MAPS.map(map=>
   JSON.parse(readFileSync(join(folder,'arena-'+map+'-before.json'),'utf8')).simulationSourceHash)};
 const candidate={...stat(after),simulationCodeHashes:MAPS.map(map=>
   JSON.parse(readFileSync(join(folder,'arena-'+map+'-after.json'),'utf8')).simulationSourceHash)};
 if(!allSame(before,'opponent')||!allSame(after,'opponent'))throw Error('Opponent differs within report');
 if(new Set(baseline.simulationCodeHashes).size!==1||
    new Set(candidate.simulationCodeHashes).size!==1)
  throw Error('Inconsistent simulation hash across maps');
 const summary={
  schema:1,design:'paired same seed/map, identical visible start worlds and scripted BLUE opponent',
  maps:MAPS,seedsPerMap:EXPECTED_SEEDS,secondsPerMatch:900,opponent:'contesting',
  mode:'director',runsPerVersion:before.length,matchedPairs:pairs.length,
  baseline,candidate,extraWins:candidate.wins-baseline.wins,mapsByMap:maps,
  aggregateDelta:{
   captures:delta(baseline.meanCaptures,candidate.meanCaptures),
   bastionControlSeconds:delta(baseline.meanBastionSeconds,candidate.meanBastionSeconds),
   firstOrganizedAttack:delta(baseline.meanFirstAttack,candidate.meanFirstAttack),
   battleRetreats:delta(baseline.meanRetreats,candidate.meanRetreats),
   abortedMissions:delta(baseline.meanMissionAborts,candidate.meanMissionAborts),
   redLosses:delta(baseline.meanRedLosses,candidate.meanRedLosses),
   blueLosses:delta(baseline.meanBlueLosses,candidate.meanBlueLosses),
   score:delta(baseline.meanScore,candidate.meanScore)
  },matches:pairs
 };
 return summary;
}

export function reportMarkdown(r){
 const s=['# Sandforge — KI 3.1 gegen KI 3.2','',
  '## Versuchsaufbau','',
  '**'+r.matchedPairs+' gepaarte Startwelten**, 20 Seeds je Karte (8/12/16 Bastionen), '+r.secondsPerMatch+' Simulationssekunden pro Partie.',
  'Beide Varianten verwenden denselben aktuellen Arena-Auswerter, denselben bezahlten BLUE-Gegner (contesting), gleiche Seeds, '+ 
  'gleiche Startwelt, identische Zeitschritte und Einheitenkosten. Die alte KI stammt aus einem festen Git-Commit vor KI 3.2.',
  'Die Resultate sind **Headless-KI gegen einen geskripteten Gegner**, keine garantierte Siegquote gegen Spieler.',
  '',
  '| Kennzahl | KI 3.1 | KI 3.2 | Differenz (3.2 − 3.1) |',
  '|---|---:|---:|---:|'];
 const entries=[
  ['Siege','wins'],['Niederlagen','losses'],['Zeitlimits (keine Niederlagen)','timeouts'],
  ['Ø eroberte Bastionen','meanCaptures'],['Ø Bastionen-Kontrollzeit (s)','meanBastionSeconds'],
  ['Ø erster organisierter Angriff (s)','meanFirstAttack'],
  ['Ø Rückzüge','meanRetreats'],['Ø Missionsabbrüche','meanMissionAborts'],
  ['Ø eigene Verluste','meanRedLosses'],['Ø gegnerische Verluste','meanBlueLosses'],
  ['Ø verbleibende Credits in Zeitproben','meanSpareCredits'],
  ['Ø HQ-Schaden','meanHQDamage'],['Ø Score','meanScore']
 ];
 for(const [name,key] of entries)
  s.push('| '+name+' | '+fmt(r.baseline[key])+' | '+fmt(r.candidate[key])+
   ' | '+fmt(delta(r.baseline[key],r.candidate[key]))+' |');
 s.push('','**Früher Angriff beobachtet:** '+r.baseline.firstAttackObserved+' / '+r.runsPerVersion+
  ' vorher und '+r.candidate.firstAttackObserved+' / '+r.runsPerVersion+' nachher. '+
  'Die Durchschnittszeiten dieser Zeile sind deshalb nur bedingt gepaart.', '',
  '## Karte für Karte','','| Bastionen | Vergleichspaare | Siege alt | Siege neu | Zeitlimits alt | Zeitlimits neu | Ø zusätzliche Eroberungen | Ø Score-Δ |',
  '|---|---:|---:|---:|---:|---:|---:|---:|');
 for(const x of r.mapsByMap)s.push('| '+(x.map===24?8:x.map===25?12:16)+' | '+x.matched+
  ' | '+x.before.wins+' | '+x.after.wins+' | '+x.before.timeouts+' | '+x.after.timeouts+
  ' | '+fmt(x.meanCaptureDelta)+' | '+fmt(x.meanScoreDelta)+' |');
 s.push('','## Interpretation','',
  'Zeitlimits zählen weder als Sieg noch als Niederlage. Score, Angriffsgeschwindigkeit und Bastionen-Kontrolle sind zusätzliche, nicht gleichbedeutende Qualitätsmaße. '+
  'Eine kleine Differenz bei 20 Seeds pro Kartengröße belegt allein keine statistisch gesicherte Überlegenheit.',
  'Eine KI-Regel ist erst dann sinnvoll, wenn sie in vollständigen Gefechten wiederholt hilft und keine regressiven Einzelfälle produziert.',
  '','**Quellcode-Fingerprints:** alt `'+r.baseline.simulationCodeHashes[0].slice(0,16)+
  '`, neu `'+r.candidate.simulationCodeHashes[0].slice(0,16)+'`.','');
 return s.join('\n');
}
const main=()=>{
 const [folder,output]=process.argv.slice(2);
 if(!folder||!output)throw Error('Usage: node scripts/ai32-tournament-report.mjs REPORT_DIR OUT.md');
 const r=tournamentReport(resolve(folder)),dst=resolve(output);
 mkdirSync(dirname(dst),{recursive:true});
 writeFileSync(dst,reportMarkdown(r)+'\n');
 writeFileSync(dst.replace(/\.md$/i,'.json'),JSON.stringify(r,null,2)+'\n');
 console.log(reportMarkdown(r));
};
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{main();}catch(error){console.error(error.stack??error);process.exitCode=1;}
}
