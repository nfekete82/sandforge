/** Read-only endgame debrief. Records public Bastion ownership and our own
 * match statistics at <=1 sample per simulated second; no saves, network,
 * fog reads, setInterval, world mutation or performance-heavy DOM loops. */
export function createBattleDebrief(game,{resumed=false}={}){
 const start=Number.isFinite(game.time)?game.time:0;
 let last=start,previous=game.territories.map(t=>t.owner);
 const seconds=[0,0],captures=[0,0],lost=[0,0],peak=[0,0];
 const events=[];
 const count=()=>[
  game.territories.filter(t=>t.owner===0).length,
  game.territories.filter(t=>t.owner===1).length
 ];
 const first=count();peak[0]=first[0];peak[1]=first[1];
 function sample(force=false){
  const now=Number.isFinite(game.time)?game.time:last;
  if(now<last)return;
  const dt=now-last;
  if(!force&&dt<.95)return;
  // Hold time measures the previous known ownership over this interval.
  for(let i=0;i<2;i++)seconds[i]+=previous.filter(x=>x===i).length*dt;
  for(const [i,t] of game.territories.entries()){
   const owner=t.owner,before=previous[i];
   if(owner!==before){
    if(owner===0||owner===1){
     captures[owner]++;
     const name=typeof t.name==='string'?t.name:'Bastion '+(t.id+1);
     events.push({at:now,owner,sector:t.id,name,kind:'capture'});
    }
    if(before===0||before===1)lost[before]++;
   }
   previous[i]=owner;
  }
  if(events.length>80)events.splice(0,events.length-80);
  const owned=count();
  for(let i=0;i<2;i++)peak[i]=Math.max(peak[i],owned[i]);
  last=now;
 }
 function report(){
  sample(true);
  const owned=count(),duration=Math.max(0,last-start),total=game.territories.length;
  const factions=game.stats?.factions??[];
  const allies=[0,1].map(i=>({
   owned:owned[i],peak:peak[i],captures:captures[i],lost:lost[i],
   controlSeconds:seconds[i],share:total&&duration?seconds[i]/(total*duration):0,
   produced:factions[i]?.producedUnits??null,
   peakArmy:factions[i]?.peakArmy??null
  }));
  return {duration,total,neutral:total-owned[0]-owned[1],allies,
   resumed,events:events.slice(-6).reverse()};
 }
 return {sample,report};
}
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const perc=n=>Math.round(n*100)+' %';
export function battleDebriefCopy(report,status){
 const blue=report.allies[0],red=report.allies[1];
 return {
  label:'Gefechtsbilanz · '+blue.owned+'/'+report.total+' Bastionen',
  heading:status==='victory'?'Siegbilanz':'Gefechtsbilanz',
  facts:[
   ['Dauer',fmt(report.duration)],
   ['Bastionen am Ende',blue.owned+' blau · '+red.owned+' rot · '+report.neutral+' neutral'],
   ['Ø Gebietskontrolle',perc(blue.share)+' blau · '+perc(red.share)+' rot'],
   ['Erobert / verloren',blue.captures+' / '+blue.lost],
   ['Maximal gehalten',blue.peak+' von '+report.total],
   ['Produzierte Einheiten',blue.produced===null?'–':String(blue.produced)]
  ],
  events:report.events.map(e=>fmt(e.at)+' · '+e.name+' · '+(e.owner===0?'Blau':'Rot')),
  note:report.resumed?'Gebietskontrolle und Eroberungen seit dem Laden dieses Spielstands.':
   'Gebietskontrolle seit Beginn dieser Partie; erfasst im Sekundentakt.'
 };
}
/** Separate compact bottom-right panel, so the user's original large
 * victory artwork remains centred, unchanged and readable. */
export function installBattleDebrief(doc,game,{resumed=false}={}){
 const tracker=createBattleDebrief(game,{resumed});
 const root=doc.createElement('section');
 root.id='sf3d-battle-debrief';
 root.className='sf3d-battle-debrief';
 root.hidden=true;
 const trigger=doc.createElement('button');
 trigger.type='button';
 trigger.className='sf3d-debrief-toggle';
 trigger.setAttribute('aria-expanded','false');
 const details=doc.createElement('div');
 details.className='sf3d-debrief-details';details.hidden=true;
 const title=doc.createElement('strong');
 title.className='sf3d-debrief-title';
 const rows=doc.createElement('dl');rows.className='sf3d-debrief-facts';
 const eventsTitle=doc.createElement('strong');eventsTitle.textContent='Letzte Eroberungen';
 const events=doc.createElement('ol');events.className='sf3d-debrief-events';
 const note=doc.createElement('p');note.className='sf3d-debrief-note';
 details.append(title,rows,eventsTitle,events,note);
 root.append(trigger,details);doc.body.append(root);
 trigger.addEventListener('click',()=>{
  details.hidden=!details.hidden;
  trigger.setAttribute('aria-expanded',String(!details.hidden));
 });
 let lastStatus='playing';
 function render(status){
  if(status===lastStatus)return;
  lastStatus=status;
  if(status!=='victory'&&status!=='defeat'){
   root.hidden=true;details.hidden=true;trigger.setAttribute('aria-expanded','false');return;
  }
  const data=battleDebriefCopy(tracker.report(),status);
  root.hidden=false;trigger.textContent=data.label;
  title.textContent=data.heading;
  rows.replaceChildren();
  for(const [label,value] of data.facts){
   const dt=doc.createElement('dt'),dd=doc.createElement('dd');
   dt.textContent=label;dd.textContent=value;rows.append(dt,dd);
  }
  events.replaceChildren();
  for(const item of data.events){
   const li=doc.createElement('li');li.textContent=item;events.append(li);
  }
  eventsTitle.hidden=!data.events.length;
  note.textContent=data.note;
 }
 return {sample:()=>tracker.sample(),render,element:root,report:()=>tracker.report()};
}
