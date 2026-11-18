/** Historic supply-truck save payloads only.
 * New Sandforge campaigns cannot create supply units, warehouses or payouts.
 * Keep this small validator so old v2 save files can be safely imported,
 * refunded and upgraded without changing their old data layout.
 */
import type {Point} from './config.js';

export const SUPPLY_RESTOCK_INTERVAL=15;
export type SupplyPhase='seek'|'to-cache'|'loading'|'to-hq'|'unloading'|'idle';
export interface SupplyCache extends Point {
 id:number;
 remaining:number;
 capacity:number;
 lastPickupAt?:number;
 restockClock?:number;
}
export interface SupplyJob {
 auto:boolean;
 phase:SupplyPhase;
 cacheId:number|null;
 cargo:number;
 clock:number;
 preferred?:number|null;
 destination?:Point;
}
export function validSupplyJob(job:SupplyJob|undefined,kind:string,size:number):boolean {
 if(job===undefined)return true;
 const validPoint=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=0&&p.y>=0&&p.x<=size&&p.y<=size;
 return kind==='supply'&&job&&typeof job.auto==='boolean'&&
  ['seek','to-cache','loading','to-hq','unloading','idle'].includes(job.phase)&&
  (job.cacheId===null||Number.isSafeInteger(job.cacheId)&&job.cacheId>=0&&job.cacheId<16)&&
  (job.preferred===undefined||job.preferred===null||
   Number.isSafeInteger(job.preferred)&&job.preferred>=0&&job.preferred<16)&&
  Number.isSafeInteger(job.cargo)&&job.cargo>=0&&job.cargo<=45&&
  Number.isFinite(job.clock)&&job.clock>=0&&job.clock<10000&&
  (job.destination===undefined||validPoint(job.destination));
}
