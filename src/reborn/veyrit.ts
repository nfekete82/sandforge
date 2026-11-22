import {distance, type Point} from './config.js';
import type {World, Territory} from './world.js';
import type {Simulation} from './simulation.js';
import {countIncome} from './match-statistics.js';

export interface VeyritField extends Point {
  id:number; amount:number; capacity:number;
  /** Approximate visual spread, in world units. Deposits are traversable. */
  radius?:number;
}
export const VEYRIT_CARGO_CAPACITY=300;
export const VEYRIT_MINING_PER_SECOND=16;
export const VEYRIT_REGEN_PER_SECOND=1.8;
export const VEYRIT_FIELD_CAPACITY=6800;

/** Each former Bastion sector in modern maps becomes a broad mineral field.
 * The old polygons survive only as invisible construction/fog/AI partitions.
 * No crystals are placed over the actual central Bastion or starting HQs. */
export function createVeyritFields(
  world:World,territories:Territory[],seed:number,
  headquarters:readonly Point[]=[]
):VeyritField[]{
  if(world.mapVersion<23)return [];
  const central=territories.find(t=>t.isBastion===true);
  const restricted=[
    ...(central?[{...central.point,radius:260}]:[]),
    ...headquarters.map(p=>({...p,radius:345}))
  ];
  const fields:VeyritField[]=[];
  for(const t of territories){
    if(t.isBastion)continue;
    const salt=Math.imul((seed^Math.imul(t.id+19,0x9e3779b1))>>>0,1664525)>>>0;
    const radius=180+(salt%59);
    const nearest=world.nearest(t.point,[
      ...restricted,...fields.map(f=>({x:f.x,y:f.y,radius:(f.radius??200)*1.4}))
    ],[],undefined,18,.24);
    if(!nearest)continue; // Never create an inaccessible/mountain-embedded field.
    fields.push({id:t.id,x:nearest.x,y:nearest.y,
      radius,amount:VEYRIT_FIELD_CAPACITY,capacity:VEYRIT_FIELD_CAPACITY});
  }
  return fields;
}

/** Fixed-tick, fully physical collection: no income without a living,
 * completed refinery, an actual harvester reaching a deposit and a return trip.
 * Manual player move orders take precedence until they finish. */
export function advanceVeyrit(game:Simulation,dt:number):void {
  if(dt<=0||!game.veyritFields.length)return;
  for(const f of game.veyritFields)f.amount=Math.min(f.capacity,f.amount+dt*VEYRIT_REGEN_PER_SECOND);
  for(const u of game.units){
    if(u.kind!=='harvester'||u.hp<=0||u.carrier||u.hold)continue;
    const refineries=game.bases.filter(b=>b.owner===u.owner&&b.kind==='refinery'&&b.hp>0&&b.buildRemaining<=0);
    if(!refineries.length)continue;
    if(u.harvestMode==='manual'&&u.orders.length)continue;
    const refinery=refineries.sort((a,b)=>distance(a,u)-distance(b,u)||a.id-b.id)[0];
    let cargo=Math.max(0,Math.min(VEYRIT_CARGO_CAPACITY,u.harvestCargo??0));
    if(u.harvestMode==='manual')u.harvestMode=cargo>0?'return':'mine';
    if(cargo>=VEYRIT_CARGO_CAPACITY)u.harvestMode='return';
    let field=game.veyritFields.find(f=>f.id===u.harvestField&&f.amount>1);
    if(!field&&cargo<VEYRIT_CARGO_CAPACITY&&u.harvestMode!=='return'){
      field=[...game.veyritFields].filter(f=>f.amount>5)
        .sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id)[0];
      u.harvestField=field?.id;
    }
    if(!field&&cargo>0)u.harvestMode='return';
    if(u.harvestMode==='return'){
      // The normal collision-aware move order stops outside the refinery.
      if(distance(u,refinery)<refinery.radius+92){
        const delivered=Math.floor(cargo);
        if(delivered>0){
          game.credits[u.owner]+=delivered;
          countIncome(game.stats,u.owner,delivered);
        }
        u.harvestCargo=cargo=0;
        u.harvestMode='mine';
        u.harvestProgress=0;
        u.harvestField=undefined;
        u.orders=[];u.path=[];u.repath=0;
      }else if(!u.orders.length){
        game.command([u.id],{kind:'move',x:refinery.x,y:refinery.y});
        u.harvestMode='return';
      }
      continue;
    }
    if(!field){u.harvestMode='mine';continue;}
    if(distance(u,field)<100){
      if(u.orders.length){u.orders=[];u.path=[];u.repath=0;}
      const mined=Math.min(field.amount,VEYRIT_CARGO_CAPACITY-cargo,dt*VEYRIT_MINING_PER_SECOND);
      field.amount-=mined;cargo+=mined;u.harvestCargo=cargo;
      u.harvestProgress=(u.harvestProgress??0)+dt;
      if(cargo>=VEYRIT_CARGO_CAPACITY-0.001||field.amount<=0.001){
        u.harvestMode='return';u.harvestProgress=0;
      }
    }else if(!u.orders.length){
      game.command([u.id],{kind:'move',x:field.x,y:field.y});
      u.harvestMode='mine';
    }
  }
}
