#!/usr/bin/env node
/** Reproducible live early Bastion contest with FULL 20-Hz simulation.
 * Both branches run the same script, terrain seeds, paid BLUE opponent,
 * HQ-building rules and simulated time. This is a short early-game A/B,
 * NOT a proxy for 15-minute wins or a fabricated combat score. */
import './webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {blueBastionRush} from './benchmark-ai-opponent.mjs';

const ids=(process.env.OPENING_MAPS??'desert-strike,broken-empire')
 .split(',').map(v=>v.trim()).filter(Boolean);
const seconds=Number(process.env.OPENING_SECONDS??135);
if(!Number.isFinite(seconds)||seconds<=0||seconds>1200)throw Error('Bad OPENING_SECONDS');

function paidBlueHQ(g){
 if(!g.needsHeadquarters(0))return;
 const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 if(!worker)return;
 const home=g.startRegions[0].center;
 for(const radius of [0,85,155,215,280,340])
  for(let k=0;k<24;k++){
   const a=k*Math.PI/12,point={
    x:home.x+Math.cos(a)*radius,y:home.y+Math.sin(a)*radius};
   if(!g.buildError(0,'headquarters',point)&&
      g.build(0,'headquarters',point,[worker.id]))return;
  }
}
for(const mapRef of ids){
 const [id,customSeed]=mapRef.split('@');
 const map=globalThis.SandforgeDesertMaps.byId(id);
 if(!map)throw Error('Unknown map '+id);
 const seed=customSeed===undefined?map.seed:Number(customSeed);
 if(!Number.isSafeInteger(seed)||seed<0)throw Error('Bad custom seed '+mapRef);
 const g=Simulation.campaign(seed,map.mapVersion,map.terrain,map.generatorVersion);
 g.tactical.mode='director';
 let paths=0,firstRedCapture=null,firstRedFight=null,firstRedOrder=null;
 const path=g.world.path.bind(g.world);
 g.world.path=(...args)=>{paths++;return path(...args);};
 let redCaptures=0,blueCaptures=0,prev=new Map(g.territories.map(t=>[t.id,t.owner]));
 let previousHp=new Map(g.units.map(u=>[u.id,{owner:u.owner,hp:u.hp}]));
 for(let i=0;i<seconds*20&&g.status==='playing';i++){
  if(i%60===0){paidBlueHQ(g);blueBastionRush(g);}
  g.step(.05);
  const redOrdered=g.units.some(u=>u.owner===1&&u.hp>0&&u.orders[0]?.kind==='attackMove');
  if(redOrdered&&firstRedOrder===null)firstRedOrder=Number(g.time.toFixed(2));
  for(const t of g.territories){
   const old=prev.get(t.id);
   if(t.owner!==old){
    if(t.owner===1){redCaptures++;firstRedCapture??=Number(g.time.toFixed(2));}
    if(t.owner===0)blueCaptures++;
    prev.set(t.id,t.owner);
   }
  }
  // A genuine HP loss on BLUE ground combat units indicates RED ground
  // combat (not drone-only shot noise), without reading hidden target state
  // to influence the tactical AI.
  if(firstRedFight===null)for(const u of g.units){
   const old=previousHp.get(u.id);
   if(u.owner===0&&old?.owner===0&&u.kind!=='drone'&&u.hp<old.hp){
    const nearRed=g.units.some(v=>v.owner===1&&v.hp>0&&!v.carrier&&
      !['drone','scout','bomber'].includes(v.kind)&&
      Math.hypot(v.x-u.x,v.y-u.y)<900);
    if(nearRed){firstRedFight=Number(g.time.toFixed(2));break;}
   }
  }
  previousHp=new Map(g.units.map(u=>[u.id,{owner:u.owner,hp:u.hp}]));
 }
 const result={map:id,seed,seconds,
  played:Number(g.time.toFixed(2)),status:g.status,
  redOwned:g.territories.filter(t=>t.owner===1).length,
  blueOwned:g.territories.filter(t=>t.owner===0).length,
  redCaptures,blueCaptures,firstRedCapture,firstRedFight,firstRedOrder,
  redUnits:g.units.filter(u=>u.owner===1&&u.hp>0).length,
  blueUnits:g.units.filter(u=>u.owner===0&&u.hp>0).length,
  redInfantry:g.units.filter(u=>u.owner===1&&u.kind==='infantry'&&u.hp>0).length,
  redVehicles:g.units.filter(u=>u.owner===1&&['tank','rover','artillery'].includes(u.kind)&&u.hp>0).length,
  totalPathRequests:paths,
  bluePaidHQ:g.bases.some(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0)};
 console.log('OPENING_MATCH '+JSON.stringify(result));
}
