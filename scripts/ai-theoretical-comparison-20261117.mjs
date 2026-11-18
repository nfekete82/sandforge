#!/usr/bin/env node
/** Compare matched real Sandforge headless matches, at 5/10/15 minutes.
 * Only the four Director policy modules should differ between runs.
 * The existing arena validates the actual complete simulation, not guesses.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {compareArenaReports} from './ai-test-arena-compare.mjs';

const [beforeFile,afterFile,outFile]=process.argv.slice(2);
if(!beforeFile||!afterFile||!outFile)
 throw Error('Usage: node scripts/ai-theoretical-comparison-20261117.mjs BEFORE.json AFTER.json SUMMARY.md');
const old=JSON.parse(readFileSync(resolve(beforeFile),'utf8'));
const next=JSON.parse(readFileSync(resolve(afterFile),'utf8'));
const diff=compareArenaReports(old,next);
const fmt=x=>x===null||x===undefined?'–':Number.isFinite(x)?Number(x.toFixed(1)).toLocaleString('de-DE'):String(x);
const avg=(rows,key)=>rows.length?rows.reduce((s,r)=>s+(typeof key==='function'?key(r):r[key]),0)/rows.length:null;
const sum=(x)=>Object.values(x??{}).reduce((a,b)=>a+Number(b),0);
const groups=arr=>new Map(arr.map(x=>[[x.mapVersion,x.seed,x.mode].join(':'),x]));
const oldMap=groups(old.details),newMap=groups(next.details);
const pairs=[];
for(const [id,a] of oldMap){
 const b=newMap.get(id);
 if(!b||a.initialStateHash!==b.initialStateHash)
  throw Error('Mismatched seed or playable world: '+id);
 pairs.push({id,a,b});
}
if(pairs.length!==old.expectedRuns)throw Error('Missing paired samples');
const row=(name,fn)=>'| '+name+' | '+fmt(avg(pairs,x=>fn(x.a)))+' | '+fmt(avg(pairs,x=>fn(x.b)))+' | '+fmt(avg(pairs,x=>fn(x.b)-fn(x.a)))+' |';
const lines=[
 '# SANDFORGE – echte KI-A/B-Vergleiche, Version 17.11.2026','',
 '**Versuchsaufbau:** '+pairs.length+' identische (Karte, Seed)-Paare, Modus '+old.modes.join(', ')+
 ', jeweils '+old.requestedSeconds+' Sekunden Limit. Gegner: derselbe budgetierte '+old.opponent+
 '-Verteidiger. Alte KI = vier frühere Director-Module, neue KI = aktueller Integrationsstand. '+
 'Restliche Simulation, Karten, Einheitenwerte, Preise, Genauigkeit und KI-Gegner sind identisch.','',
 '**Methodik:** Ein Seed ist kein repräsentatives Turnierergebnis. Zeitlimits sind keine Siege. '+
 'Die gegnerische Verteidigung ist ein reproduzierbarer Skriptgegner, nicht ein menschlicher Spieler. '+
 'Eine Partie kann vor den geplanten 15 Minuten enden. Kein reines Vorhersagemodell, sondern simulierte 20-Hz-Schritte.','',
 '| Gesamtergebnis | Vorher Ø | Nachher Ø | Differenz Ø |',
 '|---|---:|---:|---:|',
 row('Max. gleichzeitig lebende KI-Einheiten',x=>x.peakArmy),
 row('Produzierte KI-Einheiten',x=>sum(x.redProducedByKind)),
 row('Produzierte Panzer und Artillerie',x=>(x.redProducedByKind?.tank??0)+(x.redProducedByKind?.artillery??0)),
 row('Ausgegebene Credits für Truppen',x=>x.paidRecruitCredits),
 row('Organisierte Angriffe (Missionen)',x=>x.missionCount),
 row('Aktive Angriffszeit (Sek.)',x=>x.attackingSeconds),
 row('Eroberte Bastionen (brutto)',x=>x.captures),
 row('Gegnerische Einheitenverluste',x=>x.blueUnitsLost),
 row('Eigene Einheitenverluste',x=>x.redUnitsLost),
 row('Schaden an gegnerischen Gebäuden',x=>x.enemyBuildingDamage),
 row('Gegnerisches HQ: Schaden',x=>x.enemyHQDamage),
 row('Produktive Fabrikzeit (Sek.)',x=>x.productiveFactorySeconds),
 row('Mehrere Produzenten parallel (Sek.)',x=>x.parallelProductionSeconds),
 '',
 '## Entwicklung nach 5, 10 und 15 Minuten','',
 'Beobachtungen stammen direkt aus den aufgezeichneten 30-Sekunden-Timelines. '+
 'Bei vorzeitigem Spielende wird ein späterer Wert nicht hochgerechnet.','',
 '| Zeitpunkt | Messung | Vorher Ø | Nachher Ø | Paarabdeckung |',
 '|---|---|---:|---:|---:|'
];
for(const minute of [5,10,15]){
 const at=minute*60;
 const eligible=pairs.map(({a,b})=>{
  const aRow=a.timeline.filter(t=>t.at>=at-30&&t.at<=at).at(-1);
  const bRow=b.timeline.filter(t=>t.at>=at-30&&t.at<=at).at(-1);
  return aRow&&bRow?{a:aRow,b:bRow}:null;
 }).filter(Boolean);
 const table=[
  ['Lebende KI-Einheiten',x=>x.redUnits],
  ['Produzierte Truppen kumuliert',x=>sum(x.produced)],
  ['Kontrollierte Bastionen',x=>x.sectors],
  ['Credits auf dem Konto',x=>x.credits]
 ];
 for(const [label,fn] of table){
  lines.push('| '+minute+' Minuten | '+label+' | '+fmt(avg(eligible,x=>fn(x.a)))+
   ' | '+fmt(avg(eligible,x=>fn(x.b)))+' | '+eligible.length+' / '+pairs.length+' |');
 }
 if(!eligible.length)lines.push('| '+minute+' Minuten | Keine vollständigen Paar-Timelines | – | – | 0 / '+pairs.length+' |');
}
const wins=pairs.filter(x=>x.a.win).length,newWins=pairs.filter(x=>x.b.win).length;
const losses=pairs.filter(x=>x.a.loss).length,newLosses=pairs.filter(x=>x.b.loss).length;
lines.push('','## Gefechtsausgänge','',
 '| | Alte KI | Neue KI |','|---|---:|---:|',
 '| Siege | '+wins+' | '+newWins+' |',
 '| Niederlagen | '+losses+' | '+newLosses+' |',
 '| Zeitlimit ohne Sieg | '+(pairs.length-wins-losses)+' | '+(pairs.length-newWins-newLosses)+' |',
 '',
 '## Pro Seed/Karte','',
 '| Karte | Seed | Erste organisierte Offensive alt/neu | Maximale Truppen alt/neu | Eroberungen alt/neu | Feind-HQ-Schaden alt/neu | Resultat alt/neu |',
 '|---|---:|---:|---:|---:|---:|---|');
for(const x of pairs)
 lines.push('| '+x.a.mapVersion+' | '+x.a.seed+' | '+
  fmt(x.a.firstOrganizedAttack)+' / '+fmt(x.b.firstOrganizedAttack)+' s | '+
  x.a.peakArmy+' / '+x.b.peakArmy+' | '+x.a.captures+' / '+x.b.captures+' | '+
  fmt(x.a.enemyHQDamage)+' / '+fmt(x.b.enemyHQDamage)+' | '+
  x.a.outcome+' / '+x.b.outcome+' |');
lines.push('','## Validierung','',
 '- '+pairs.length+' von '+pairs.length+' Paaren mit identischen initialStateHash.',
 '- Gleiche katalogSourceHash: '+(old.catalogSourceHash===next.catalogSourceHash),
 '- Gleiche opponentSourceHash: '+(old.opponentSourceHash===next.opponentSourceHash),
 '- Mean score delta (neue minus alte KI): '+fmt(diff.meanScoreDelta)+'.',
 '- Die Ergebnisse ersetzen keine umfassende 20+ Seeds / verschiedene Gegner / realen PvP-Spiele.',
 '');
const markdown=lines.join('\n');
mkdirSync(dirname(resolve(outFile)),{recursive:true});
writeFileSync(resolve(outFile),markdown);
console.log(markdown);
