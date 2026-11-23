import {RULES,distance,type Point,type Owner,type MapVersion} from './config.js';
import type {Territory} from './world.js';

/** Rules are symmetric for BLUE and RED. The older saved map generations keep
 * their original fixed eight-second, adjacent-only territory mechanics. */
export const dynamicTerritoryWarfare=(version:MapVersion):boolean=>version>=11;

/** On spacious WebGL maps the solid 116-unit-wide Bastion can make a soldier
 * standing visibly beside the tower fall just outside the old 95-unit ring.
 * The physical capture zone now extends to 125 units on v23+ only; older
 * maps and saves keep their original 95-unit rule unchanged. Same for both
 * factions; airborne recon drones still cannot capture. */
export const capturePresenceRadius=(version:MapVersion):number=>
 version>=23?125:RULES.captureRadius;

/** Any neutral or hostile bastion may be captured by either faction, regardless
 * of adjacent ownership. The simulation still enforces presence, contest and
 * the intact-enemy-HQ lock. Keep the original parameters for caller stability. */
export function canCaptureSector(
 _territories:readonly Territory[],sector:Territory,owner:number,
 _version:MapVersion,teamOf?:(owner:number)=>number
):boolean{
 if(!Number.isInteger(owner)||owner<0||owner>3||
    sector.owner===owner)return false;
 // Allied sites are never legal conquest targets in 2v2. The optional
 // callback is absent in historical 1v1 calls, so their behavior is
 // unchanged until the true multi-faction Simulation supplies a team map.
 if(teamOf&&sector.owner>=0&&teamOf(sector.owner)===teamOf(owner))
  return false;
 return true;
}

export interface TerritoryGuard extends Point {owner:Owner;hp:number;carrier?:number|null;kind?:string}
export interface TerritoryBattery extends Point {owner:Owner;hp:number;kind:string;buildRemaining?:number}
/** Only a truly exposed ENEMY sector is recaptured quickly. Nearby defenders
 * or a live turret in firing range preserve the full capture duration.
 * This authoritative physical rule does not feed enemy locations into AI. */
export function captureSeconds(input:{
 version:MapVersion;territory:Territory;attacker:Owner;units:readonly TerritoryGuard[];bases:readonly TerritoryBattery[];
}):number{
 const {version,territory:t,attacker,units,bases}=input;
 if(!dynamicTerritoryWarfare(version)||t.owner<0||t.owner===attacker)return RULES.captureTime;
 const defended=units.some(u=>u.owner===t.owner&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&distance(u,t.point)<260)
  ||bases.some(b=>b.owner===t.owner&&b.hp>0&&b.kind==='turret'
    &&(b.buildRemaining??0)<=0&&distance(b,t.point)<=RULES.turret.range+30);
 return defended?RULES.captureTime:5;
}

/** Observable sector counts, not hidden units/economy: the same two-sector
 * deficit threshold applies regardless of which faction is losing. */
export function comebackPressure(territories:readonly Territory[],owner:Owner):boolean{
 if(owner!==0&&owner!==1)return false;
 return territories.filter(t=>t.owner===1-owner).length-territories.filter(t=>t.owner===owner).length>=2;
}

export interface RaidOpportunity extends Point {id:number;owner:number;income:number;routeLength:number;routeRisk:number;protected:boolean;recentlyLost:boolean}
/** Objective ranking is public-income based, risk-first, and reproducible.
 * Dangerous towers and unseen threats never become attractive via income. */
export function chooseComebackOpportunity(fronts:readonly RaidOpportunity[]):RaidOpportunity|undefined{
 return fronts.filter(t=>t.owner===0&&!t.protected&&Number.isFinite(t.routeLength)
   &&t.routeLength>0&&Number.isFinite(t.routeRisk)&&t.routeRisk<8)
  .slice().sort((a,b)=>{
   const score=(t:RaidOpportunity)=>t.routeLength+t.routeRisk*125-t.income*18-(t.recentlyLost?300:0);
   return score(a)-score(b)||a.id-b.id;
  })[0];
}
