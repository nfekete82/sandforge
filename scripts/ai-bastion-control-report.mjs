#!/usr/bin/env node
/** Strict A/B analysis of CONTROL, not only how many flags were captured.
 * Same playable worlds, same budgeted opponent, same troop catalog;
 * the old code is compiled separately from a specified Git revision.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {compareArenaReports} from './ai-test-arena-compare.mjs';

const [beforeName,afterName,destination]=process.argv.slice(2);
if(!beforeName||!afterName||!destination)
 throw Error('Usage: node scripts/ai-bastion-control-report.mjs OLD.json NEW.json REPORT.md');
const before=JSON.parse(readFileSync(resolve(beforeName),'utf8'));
const after=JSON.parse(readFileSync(resolve(afterName),'utf8'));
const compared=compareArenaReports(before,after);
const key=d=>[d.mapVersion,d.seed,d.mode].join(':');
const old=new Map(before.details.map(d=>[key(d),d]));
const pairs=after.details.map(b=>({a:old.get(key(b)),b}))
 .sort((x,y)=>x.b.mapVersion-y.b.mapVersion||x.b.seed-y.b.seed);
if(pairs.some(p=>!p.a||p.a.initialStateHash!==p.b.initialStateHash))throw Error('Unequal playable world');
if(pairs.some(p=>!['bastionControlSeconds','exposedFrontierSeconds','guardedFrontierSeconds','bastionRecaptures'].every(x=>Number.isFinite(p.a[x])&&Number.isFinite(p.b[x]))))
 throw Error('Missing physical territory-control measurements');
const avg=(fn)=>pairs.reduce((n,p)=>n+fn(p),0)/pairs.length;
const fmt=x=>Number(x.toFixed(2)).toLocaleString('de-DE');
const rate=(d)=>d.exposedFrontierSeconds>0?100*d.guardedFrontierSeconds/d.exposedFrontierSeconds:100;
const hold=(d)=>d.elapsedSeconds>0?d.bastionControlSeconds/d.elapsedSeconds:0;
const lines=[
 '# Sandforge – echter 10-Minuten-Bastionstest', '',
 '**'+pairs.length+' identische Karten-/Seed-Paare**, simulierter 20-Hz-Spielablauf. '+
 'Beide Varianten verwenden dieselben Waffen, Preise, Karten, Gegner und Startressourcen. '+
 'Nur der für diese Prüfung angegebene KI-Wachtruppen-Algorithmus unterscheidet sich.',
 '',
 '| Kennzahl (Durchschnitt) | Vorher | Nachher | Δ |',
 '|---|---:|---:|---:|'
];
const metric=(label,fn)=>lines.push('| '+label+' | '+fmt(avg(p=>fn(p.a)))+
 ' | '+fmt(avg(p=>fn(p.b)))+' | '+fmt(avg(p=>fn(p.b)-fn(p.a)))+' |');
metric('Bastionen im Zeitmittel',hold);
metric('Bastionen-Kontrollzeit (Bastion-Sekunden)',d=>d.bastionControlSeconds);
metric('Abgedeckte Frontbastionen (%, je Match)',rate);
metric('Bastionen am Ende',d=>d.redSectors);
metric('Bastionen erobert (brutto)',d=>d.captures);
metric('Bastionen vom Gegner zurückgeholt',d=>d.bastionRecaptures);
metric('Eigene Bastionen verloren',d=>d.territoriesLost);
metric('Lebende Einheiten Maximum',d=>d.peakArmy);
metric('Eigene Einheitentode',d=>d.redUnitsLost);
metric('Organisierte Angriffsmissionen',d=>d.missionCount);
metric('Ausgaben für bezahlte Einheiten',d=>d.paidRecruitCredits);
metric('Siege (Anteil)',d=>d.win?100:0);
lines.push('','## Einzelszenarien','',
 '| Karte | Seed | Ø Bastionen alt / neu | Frontdeckung alt / neu | Endstand alt / neu | Rückeroberungen alt / neu | Verluste alt / neu |',
 '|---|---:|---:|---:|---:|---:|---:|');
for(const {a,b} of pairs)lines.push('| '+a.mapVersion+' | '+a.seed+
 ' | '+fmt(hold(a))+' / '+fmt(hold(b))+
 ' | '+fmt(rate(a))+' / '+fmt(rate(b))+' %'+
 ' | '+a.redSectors+' / '+b.redSectors+
 ' | '+a.bastionRecaptures+' / '+b.bastionRecaptures+
 ' | '+a.redUnitsLost+' / '+b.redUnitsLost+' |');
lines.push('','## Interpretation','',
 '- Ein Sieg/Timeout ist kein Proxy für Bastionen-Kontrolle: kontrollierte Bastion-Sekunden sind das primäre Kriterium.',
 '- Frontdeckung bezieht sich auf öffentlich eigene Bastionen mit mindestens einem nicht transportierten echten Kampftrupp in 185 Einheiten Entfernung; Messintervall 1 s.',
 '- Bei vorzeitig beendetem Gefecht wird die durchschnittliche Bastionenzahl durch tatsächliche Laufzeit statt nominelle 600 s geteilt.',
 '- Alle Ergebnisse beschreiben diesen budgetierten Skriptgegner, keine menschliche Spielstärke.',
 '- Startweltvergleich: '+compared.pairs+' von '+pairs.length+' identisch; gepaarte Score-Differenz '+compared.meanScoreDelta+'.','');
const report=lines.join('\n');
mkdirSync(dirname(resolve(destination)),{recursive:true});
writeFileSync(resolve(destination),report);
console.log(report);
