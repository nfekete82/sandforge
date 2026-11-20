#!/usr/bin/env node
/** Import the six completed Meshy GLB assets directly into a local Sandforge
 * worktree. Uses temporary signed model links stored in the matching one-off
 * GitHub import workflow. This writes only to the current source directory;
 * no simulation state, existing 3D assets or Git branches are modified. */
import {readFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
const kinds=['barracks','airfield','bastion','bunker','headquarters','generator'];
const workflow=readFileSync('.github/workflows/meshy-structures-import-20261121.yml','utf8');
const dir='src/assets/reborn/buildings-3d/meshy-structures';
mkdirSync(dir,{recursive:true});
for(const kind of kinds){
 const name='SF_'+kind.toUpperCase()+'_URL';
 const match=workflow.match(new RegExp('^\\s*'+name+':\\s*("[^\\n]+")\\s*$','m'));
 if(!match)throw new Error('Meshy import URL missing for '+kind);
 const url=JSON.parse(match[1]);
 if(!url.startsWith('https://assets.meshy.ai/'))
  throw new Error('Unexpected model asset host: '+kind);
 const response=await fetch(url,{signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw new Error(kind+' Meshy link HTTP '+response.status+
  ' (signed link expired; obtain a fresh download URL from Meshy)');
 const file=Buffer.from(await response.arrayBuffer());
 if(file.length<50000||file.length>90_000_000||file.toString('ascii',0,4)!=='glTF'||
   file.readUInt32LE(4)!==2||file.readUInt32LE(8)!==file.length)
   throw new Error('Invalid Meshy glTF binary for '+kind);
 const jsonLen=file.readUInt32LE(12),doc=JSON.parse(file.toString('utf8',20,20+jsonLen));
 if(!doc.meshes?.length||!doc.materials?.length)
   throw new Error('Meshy '+kind+' missing mesh/materials');
 const output=join(dir,kind+'.glb');
 writeFileSync(output,file);
 console.log(kind+': '+statSync(output).size+' bytes installed');
}
console.log('Meshy PBR models are in place. Run npm run build to enable all six.');
