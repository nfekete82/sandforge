#!/usr/bin/env node
/**
 * Reconcile the real FINAL PBR barracks and command-center GLBs before
 * Sandforge's normal build. Their 10–11 MiB binaries live in Nobby's existing
 * Mac test worktrees, not in Git; the Bastion branch otherwise shipped the
 * retired placeholder versions. Fail CLOSED rather than silently displaying
 * the old models. Never modify the two source worktrees.
 *
 * Source priority:
 *   1. Final combined PBR test worktree, if both factions are current.
 *   2. Original authored Barracks/HQ source worktrees, then reapply the
 *      three deterministic HQ upgrades to COPIES in a staging directory.
 *
 * Optional: SANDFORGE_COMBINED_PBR_SOURCE / SANDFORGE_BARRACKS_SOURCE /
 *           SANDFORGE_HQ_SOURCE override the three default paths.
 */
import {copyFileSync,existsSync,mkdtempSync,readFileSync,renameSync,rmSync,statSync} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd(),rel='src/assets/reborn/buildings-3d';
// Build passes dist/... as an explicit destination; the stand-alone asset
// repair command retains the historical default for authoring workflows.
const destination=resolve(process.argv[2]||join(root,rel));
const home=homedir();
const source=(env,defaultName)=>resolve(process.env[env]||join(home,'Projects',defaultName));
const combined=source('SANDFORGE_COMBINED_PBR_SOURCE','sandforge-pbr-gesamt-test');
const barracks=source('SANDFORGE_BARRACKS_SOURCE','sandforge-kaserne-prop-polish');
const hq=source('SANDFORGE_HQ_SOURCE','sandforge-hq-pbr');
const names=['barracks-0.glb','barracks-1.glb','headquarters-0.glb','headquarters-1.glb'];
const nodeNames=doc=>new Set(doc.nodes?.map(n=>n.name)||[]);
function glb(file){
 if(!existsSync(file)||statSync(file).size<1024)return null;
 try{
  const b=readFileSync(file);
  if(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||
     b.readUInt32LE(8)!==b.length||b.toString('ascii',16,20)!=='JSON')return null;
  return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 }catch{return null;}
}
function isFinal(file,kind){
 const doc=glb(file);if(!doc||doc.images?.length<10)return false;
 const names=nodeNames(doc);
 if(kind==='barracks'){
  return ['door_leaf_L','door_leaf_R','door_recess_back'].every(x=>names.has(x))&&
   [...names].some(x=>x.startsWith('sandbag_'))&&
   [...names].some(x=>x.startsWith('crate_'))&&
   [...names].some(x=>x.startsWith('radar_'));
 }
 return doc.meshes?.length===43&&
  doc.asset?.extras?.sandforgeHQRoofLayout==='centered-command-dome-roof-v4-canopy-20261116'&&
  doc.asset?.extras?.sandforgeHQVents==='flush-hq-vents-rear-v1-20261116'&&
  ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_Dome_Shell',
   'HQ_RearVent_Slats','HQ_Radar_01_LargeDish_Rotor',
   'HQ_Radar_02_PhasedArray_Rotor'].every(x=>names.has(x));
}
const kind=name=>name.startsWith('barracks')?'barracks':'headquarters';
const allGood=dir=>names.every(n=>isFinal(join(dir,n),kind(n)));
if(!existsSync(destination))throw Error('PBR asset folder missing: '+destination);
if(allGood(destination)){
 console.log('Final PBR barracks + command centers already installed (blue/red).');
 process.exit(0);
}
const stage=mkdtempSync(join(tmpdir(),'sandforge-final-pbr-'));
try{
 if(allGood(join(combined,rel))){
  console.log('Copying 4 final PBR GLBs from combined worktree: '+combined);
  for(const n of names)copyFileSync(join(combined,rel,n),join(stage,n));
 }else{
  console.log('Rebuilding final PBR buildings from authored worktrees.');
  for(const owner of [0,1]){
   const bp=join(barracks,rel,'barracks-'+owner+'.glb');
   const hp=join(hq,rel,'headquarters-'+owner+'.glb');
   if(!isFinal(bp,'barracks'))throw Error('Missing authored barracks: '+bp);
   const sourceDoc=glb(hp),sourceNames=sourceDoc&&nodeNames(sourceDoc);
   if(!sourceNames?.has('HQ_door_leaf_L')||!sourceNames?.has('HQ_Radar_01_LargeDish_Rotor'))
    throw Error('Missing original PBR command center: '+hp);
   copyFileSync(bp,join(stage,'barracks-'+owner+'.glb'));
   copyFileSync(hp,join(stage,'headquarters-'+owner+'.glb'));
  }
  for(const script of ['upgrade-hq-layout.mjs','upgrade-hq-vents.mjs','upgrade-hq-dome.mjs'])
   execFileSync(process.execPath,[join(root,'scripts',script),
    join(stage,'headquarters-0.glb'),join(stage,'headquarters-1.glb')],
   {cwd:root,stdio:'inherit'});
 }
 if(!allGood(stage))throw Error('Refusing to publish incomplete PBR assets: missing door meshes, radar, dome or vents.');
 // Keep four backup copies; publish only once ALL four staged files validate.
 const backup=join(stage,'backup');
 const {mkdirSync}=await import('node:fs');
 mkdirSync(backup);
 for(const n of names)if(existsSync(join(destination,n)))
  copyFileSync(join(destination,n),join(backup,n));
 try{
  for(const n of names){
   const temp=join(destination,n+'.new-pbr');
   copyFileSync(join(stage,n),temp);
   renameSync(temp,join(destination,n));
  }
 }catch(error){
  for(const n of names){
   const old=join(backup,n);
   if(existsSync(old))copyFileSync(old,join(destination,n));
   rmSync(join(destination,n+'.new-pbr'),{force:true});
  }
  throw error;
 }
 console.log('READY: final PBR barracks and HQ (both teams, giant dome, rear vents).');
}catch(error){
 console.error('Sandforge will NOT silently return to the old buildings.');
 console.error(error.message);
 console.error('Required local sources: '+combined+' OR '+barracks+' and '+hq);
 process.exitCode=1;
}finally{rmSync(stage,{recursive:true,force:true});}
