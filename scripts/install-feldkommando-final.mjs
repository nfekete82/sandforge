#!/usr/bin/env node
/** Install the reviewed, mechanically split Feldkommando Final binary. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const EXPECTED_SHA='d40dbb535d754a4ab0e0532214ff2b3ae92fb7b011f1222c9c6ac8c41bca1151';
const file=process.argv[2];
if(!file){
 console.error('Usage: npm run assets:feldkommando-final -- "/path/to/sandforge_feldkommando_final.glb"');
 process.exit(1);
}
const bytes=readFileSync(resolve(file));
if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||
   bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid glTF 2.0 binary');
const jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const names=new Set((gltf.nodes??[]).map(x=>x.name));
const clips=new Set((gltf.animations??[]).map(x=>x.name));
for(const name of ['SF_Feldkommando_Final','Door_Left_Pivot','Door_Right_Pivot',
 'Radar_Dish_Pivot'])if(!names.has(name))throw Error('Missing animated node: '+name);
for(const name of ['Doors_Open','Doors_Close','Doors_Cycle','Radar_Scan'])
 if(!clips.has(name))throw Error('Missing animation: '+name);
if((gltf.meshes??[]).length<5)throw Error('Unsplit source GLB: animated pieces are missing');
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==EXPECTED_SHA)throw Error('Wrong/unreviewed Feldkommando GLB (SHA256 '+hash+')');
const dir=join(dirname(fileURLToPath(import.meta.url)),'..','src','assets','reborn','buildings-3d');
mkdirSync(dir,{recursive:true});
const dst=join(dir,'sandforge_feldkommando_final.glb');
writeFileSync(dst,bytes);
console.log('Installed canonical Feldkommando Final: '+dst+' ('+bytes.length+' bytes, SHA256 '+hash+')');
