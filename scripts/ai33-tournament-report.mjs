#!/usr/bin/env node
/** 3.2 -> 3.3 comparison in the EXACT SAME compiled codebase.
 * Strictly reject differing source hashes or modes, never treat a timeout
 * as a loss, and keep every paired seed for downstream inspection.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tournamentReport,reportMarkdown} from './ai32-tournament-report.mjs';

export function ai33TournamentReport(dir){
 for(const map of [24,25,26]){
  const old=JSON.parse(readFileSync(join(dir,'arena-'+map+'-before.json'),'utf8'));
  const next=JSON.parse(readFileSync(join(dir,'arena-'+map+'-after.json'),'utf8'));
  // Unlike 3.1 vs 3.2, this is a genuine same-binary policy ablation.
  if(old.simulationSourceHash!==next.simulationSourceHash||
     old.catalogSourceHash!==next.catalogSourceHash||
     old.opponentSourceHash!==next.opponentSourceHash)
   throw Error('Different binaries, unit balance or opponents: map '+map);
  if(old.ai33Policy!=='off'||next.ai33Policy!=='adaptive'||
     old.details.some(r=>r.ai33Policy!=='off')||
     next.details.some(r=>r.ai33Policy!=='adaptive'))
   throw Error('Invalid AI 3.2/3.3 A/B policy selection: map '+map);
 }
 return tournamentReport(dir); // additionally verifies all 60 paired worlds
}
export function ai33Markdown(report){
 return reportMarkdown(report)
  .replaceAll('KI 3.2','KI 3.3').replaceAll('KI 3.1','KI 3.2')
  .replace('Die alte KI stammt aus einem festen Git-Commit vor KI 3.3.',
   '**Beide Varianten sind dieselbe kompilierte Simulation.** Nur der Laufzeit-Schalter `--ai33 off|adaptive` unterscheidet die KI-Entscheidungen.')
  .replace('Die alte KI stammt aus einem festen Git-Commit vor KI 3.2.',
   'Beide Varianten sind dieselbe kompilierte Simulation; nur der ablatierte KI-3.3-Policy-Schalter unterscheidet sich.');
}
function main(){
 const [dir,file]=process.argv.slice(2);
 if(!dir||!file)throw Error('Usage: node scripts/ai33-tournament-report.mjs DIR OUT.md');
 const report=ai33TournamentReport(resolve(dir)),output=resolve(file);
 mkdirSync(dirname(output),{recursive:true});
 const md=ai33Markdown(report)+'\n';
 writeFileSync(output,md);
 writeFileSync(output.replace(/\.md$/i,'.json'),JSON.stringify(report,null,2)+'\n');
 console.log(md);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{main();}catch(e){console.error(e.stack??e);process.exitCode=1;}
}
