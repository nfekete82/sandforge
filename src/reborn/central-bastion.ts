import {campaignLayout, distance, type Owner} from './config.js';
import type {World, Territory} from './world.js';

export const CENTRAL_HOLD_SECONDS = 15 * 60;
export interface CentralHold { owner: Owner; seconds: number }

/** One neutral middle objective is an existing real, capturable Bastion.
 * Reusing a sector preserves minimap, navigation, fog, AI and save geometry. */
export function designateCentralBastion(world:World, territories:Territory[]):number|null {
  if(world.mapVersion<23)return null; // Preserve existing classic campaigns and fixtures.
  const center={x:world.size/2,y:world.size/2};
  const home=new Set(campaignLayout(world.mapVersion,world.seed).headquarters);
  const central=territories.filter(t=>!home.has(t.id)&&t.owner===-1)
    .sort((a,b)=>distance(a.point,center)-distance(b.point,center)||a.id-b.id)[0];
  if(!central)return null;
  // A clear, driveable middle plateau is preferred; leave authored sectors in
  // place if the actual centre is inaccessible or intersects another Bastion.
  const clear=world.clearSite(center,66);
  if(clear&&distance(clear,center)<=320&&territories.every(t=>t.id===central.id||distance(t.point,clear)>270)){
    central.point=clear;
  }
  central.name='Zentralbastion';
  central.income=Math.max(central.income,40);
  return central.id;
}

/** No timer runs while neutral or under active capture pressure. The full
 * fifteen-minute clock resets whenever ownership changes. */
export function advanceCentralHold(hold:CentralHold,owner:Owner,contested:boolean,dt:number):CentralHold{
  if(owner!==hold.owner)return {owner,seconds:0};
  if(owner===-1||contested||dt<=0)return hold;
  return {owner,seconds:Math.min(CENTRAL_HOLD_SECONDS,hold.seconds+dt)};
}
