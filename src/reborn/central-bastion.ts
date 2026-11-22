import {campaignLayout, type Owner} from './config.js';
import type {World, Territory} from './world.js';

export const CENTRAL_HOLD_SECONDS = 15 * 60;
export interface CentralHold { owner: Owner; seconds: number }

/** The modern Veyrit mode has ONE capturable Bastion. Keep the old sector
 * polygons for construction zoning / home ownership, but not physical towers.
 * Set its map coordinate to the true geometric centre on all modern maps. */
export function designateCentralBastion(world:World, territories:Territory[]):number|null {
  if(world.mapVersion<23)return null;
  const center={x:world.size/2,y:world.size/2};
  const home=new Set(campaignLayout(world.mapVersion,world.seed).headquarters);
  const central=territories.filter(t=>!home.has(t.id)&&t.owner===-1)
    .sort((a,b)=>{
      const d=(p:typeof a)=>Math.hypot(p.point.x-center.x,p.point.y-center.y);
      return d(a)-d(b)||a.id-b.id;
    })[0];
  if(!central)return null;
  for(const t of territories)t.isBastion=t.id===central.id;
  central.point=center;
  central.name='Zentralbastion';
  central.income=40;
  return central.id;
}

/** In the 15-minute hold mode a contested Bastion pauses its clock.
 * Loss resets both the owner and the recorded time. */
export function advanceCentralHold(hold:CentralHold,owner:Owner,contested:boolean,dt:number):CentralHold{
  if(owner!==hold.owner)return {owner,seconds:0};
  if(owner===-1||contested||dt<=0)return hold;
  return {owner,seconds:Math.min(CENTRAL_HOLD_SECONDS,hold.seconds+dt)};
}
