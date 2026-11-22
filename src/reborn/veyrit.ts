import {distance, type Point} from './config.js';
import type {World, Territory} from './world.js';
import type {Simulation} from './simulation.js';
import {countIncome} from './match-statistics.js';

export interface VeyritField extends Point {
  id:number; amount:number; capacity:number;
}
export const VEYRIT_CARGO_CAPACITY=300;
export const VEYRIT_MINING_PER_SECOND=16;
export const VEYRIT_REGEN_PER_SECOND=1.8;
export const VEYRIT_FIELD_CAPACITY=4200;

/** Fixed, seeded and symmetrical field positions. Real World nearest() keeps
 * every deposit off cliffs, buildings, narrow ramps and Bastion footprints. */
export function createVeyritFields(world:World,territories:Territory[],seed:number):VeyritField[]{
  if(world.mapVersion<23)return [];
  const positions:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
    [.24,.27],[.76,.73],[.76,.27],[.24,.73],[.49,.34],[.51,.66]
  ];
  const reserved=territories.map(t=>({...t.point,radius:165}));
  const fields:VeyritField[]=[];
  for(const [id,[nx,ny]] of positions.entries()){
    const salt=(Math.imul(seed^(id*2654435761),1664525)>>>0)/4294967296;
    const p={x:world.size*(nx+(salt-.5)*.025),y:world.size*(ny+(salt-.5)*.025)};
    const candidate=world.nearest(p,[...reserved,...fields.map(f=>({...f,radius:155}))],[],undefined,28,.16);
    if(!candidate)continue;
    fields.push({id,...candidate,amount:VEYRIT_FIELD_CAPACITY,capacity:VEYRIT_FIELD_CAPACITY});
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
