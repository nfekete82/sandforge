/** Read-only tactical telemetry for the developer WebGL preview.
 * NO mutations of Simulation or TacticalAI, and NO intervals / fixed tick
 * cost while the panel is hidden. Can be opened on localhost or explicitly
 * with ?aiDebug=1. Values are actual runtime state, not HUD estimates.
 */
const asNumber=(value)=>Number.isFinite(value)?value:0;
const number=value=>Math.round(asNumber(value)).toLocaleString('de-DE');
const unitIsAlive=u=>u.hp>0&&!u.carrier;
export function aiDebugAllowed(loc){
 const host=loc?.hostname??'';
 return host==='localhost'||host==='127.0.0.1'||host==='[::1]'||
  new URLSearchParams(loc?.search??'').get('aiDebug')==='1';
}
export function captureAiDebug(game){
 const state=game.tactical?.state??{};
 const campaign=state.commander??{};
 const mission=campaign.mission??null;
 const battle=state.battle??{};
 const units=game.units.filter(u=>u.owner===1&&unitIsAlive(u));
 const buckets={infantry:0,vehicles:0,air:0};
 for(const u of units){
  if(['scout','bomber'].includes(u.kind))buckets.air++;
  else if(['rover','tank','artillery'].includes(u.kind))buckets.vehicles++;
  else buckets.infantry++;
 }
 const own=game.territories.filter(t=>t.owner===1).length;
 const hostile=game.territories.filter(t=>t.owner===0).length;
 const neutral=game.territories.length-own-hostile;
 const bases=game.bases.filter(b=>b.owner===1&&b.hp>0&&b.buildRemaining<=0);
 const production=bases.filter(b=>Array.isArray(b.queueTypes)&&b.queueTypes.length)
  .map(b=>({id:b.id,kind:b.kind,queue:[...b.queueTypes],progress:asNumber(b.production)}))
  .sort((a,b)=>a.id-b.id);
 const defenders=battle.squads?.filter(q=>q.role==='defense').flatMap(q=>q.ids)??[];
 const raiders=battle.squads?.filter(q=>q.role==='raid').flatMap(q=>q.ids)??[];
 const known=new Set(units.map(u=>u.id));
 const activeIds=ids=>[...new Set(ids??[])].filter(id=>known.has(id));
 const missionSector=mission?game.territories.find(t=>t.id===mission.sector):null;
 const gameTime=asNumber(game.time);
 return {
  time:gameTime,status:game.status,
  phase:state.phase??'–',
  campaign:campaign.phase??'–',
  mission:mission?{
   kind:mission.kind,sector:mission.sector,
   name:missionSector?.name??'Sektor '+(mission.sector+1),
   owner:missionSector?.owner??null,
   objective:mission.objective??null,
   age:Math.max(0,gameTime-asNumber(mission.since))
  }:null,
  credits:asNumber(game.credits?.[1]),
  income:asNumber(typeof game.income==='function'?game.income(1):0),
  army:units.length,buckets,
  group:activeIds(state.group).length,
  defenders:activeIds(defenders).length,
  raiders:activeIds(raiders).length,
  sectors:{own,hostile,neutral,total:game.territories.length},
  production,
  visibleEnemies:game.units.filter(u=>u.owner===0&&unitIsAlive(u)&&
   typeof game.canSee==='function'&&game.canSee(1,u)).length,
  diagnostics:{
   stance:battle.assessment?.stance??'–',
   failedFronts:battle.fronts?.filter(f=>f.until>gameTime).length??0,
   waveLaunches:asNumber(game.tactical?.diagnostics?.waveLaunches),
   raids:asNumber(game.tactical?.diagnostics?.secondaryRaids),
   lastChoice:game.tactical?.diagnostics?.last?.choice??'–',
   lastReason:game.tactical?.diagnostics?.last?.reason??'–'
  }
 };
}
const css=`
#sf-ai-debug-overlay{position:fixed;top:62px;right:16px;z-index:85;width:min(352px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;background:#111923f5;color:#e6eced;border:1px solid #53727a;box-shadow:0 12px 44px #000b;backdrop-filter:blur(12px);border-radius:10px;font:12px/1.48 system-ui,Arial,sans-serif;box-sizing:border-box;pointer-events:auto;}
#sf-ai-debug-overlay[hidden]{display:none!important;}
#sf-ai-debug-overlay *{box-sizing:border-box;}
#sf-ai-debug-overlay header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 13px;background:#162432;border-bottom:1px solid #435663;z-index:1;}
#sf-ai-debug-overlay strong{font-weight:700;color:#edeeec;letter-spacing:.035em;}
#sf-ai-debug-overlay .aid-tools{display:flex;gap:7px}
#sf-ai-debug-overlay button{border:1px solid #536672;border-radius:5px;background:#273746;color:#cbdce1;padding:3px 7px;font:inherit;cursor:pointer;}
#sf-ai-debug-overlay button:hover{background:#395265;}
#sf-ai-debug-overlay .aid-main{padding:12px 13px 14px;display:grid;gap:11px;}
#sf-ai-debug-overlay .aid-eyebrow{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ab0bc;margin-bottom:4px;}
#sf-ai-debug-overlay .aid-objective{font-size:15px;font-weight:700;color:#efdaa5;}
#sf-ai-debug-overlay .aid-caption{color:#c0d0d4;font-size:11px;}
#sf-ai-debug-overlay .aid-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
#sf-ai-debug-overlay .aid-card{background:#1c2a36;border:1px solid #304956;border-radius:6px;padding:8px 7px;}
#sf-ai-debug-overlay .aid-value{font-size:17px;color:#f2f4f2;font-weight:750;font-variant-numeric:tabular-nums;}
#sf-ai-debug-overlay .aid-label{color:#9eb5be;font-size:10px;}
#sf-ai-debug-overlay .aid-bar{height:8px;display:flex;border-radius:8px;background:#3b4651;overflow:hidden;}
#sf-ai-debug-overlay .aid-bar span{height:100%;display:block;}
#sf-ai-debug-overlay .aid-line{display:flex;justify-content:space-between;gap:10px;margin:3px 0;color:#b8cbd1;}
#sf-ai-debug-overlay .aid-line b{color:#f1f3f2;font-weight:650;text-align:right;}
#sf-ai-debug-overlay .aid-production{max-height:130px;overflow:auto;}
#sf-ai-debug-overlay .aid-empty{color:#99a8af;font-style:italic;}
#sf-ai-debug-overlay .aid-footer{font-size:10px;color:#829da8;border-top:1px solid #344956;padding-top:8px;}
`;
export function createAiDebugOverlay(game,loc=location,doc=document){
 if(!aiDebugAllowed(loc))return null;
 if(!doc.getElementById('sf-ai-debug-style')){
  const style=doc.createElement('style');style.id='sf-ai-debug-style';style.textContent=css;
  doc.head.appendChild(style);
 }
 const node=doc.createElement('aside');
 node.id='sf-ai-debug-overlay';node.hidden=true;
 node.setAttribute('aria-label','Sandforge KI-Debug-Dashboard');
 node.innerHTML=`<header><strong>KI-STRATEGIE <span style="color:#72c6be">· LIVE</span></strong><span class="aid-tools"><button type="button" data-action="copy" title="Aktuellen KI-Zustand als JSON kopieren">JSON</button><button type="button" data-action="close" aria-label="KI-Debug-Dashboard schließen">✕</button></span></header>
 <div class="aid-main">
 <section><div class="aid-eyebrow">Aktuelles Ziel</div><div class="aid-objective" data-field="objective"></div><div class="aid-caption" data-field="objectiveSub"></div></section>
 <div class="aid-cards"><div class="aid-card"><div class="aid-label">KI-Truppen</div><div class="aid-value" data-field="army"></div></div>
 <div class="aid-card"><div class="aid-label">Bastionen</div><div class="aid-value" data-field="sectors"></div></div>
 <div class="aid-card"><div class="aid-label">Credits</div><div class="aid-value" data-field="credits"></div></div></div>
 <section><div class="aid-eyebrow">Bastionskontrolle <span data-field="time"></span></div>
 <div class="aid-bar"><span data-fill="red" style="background:#bc5c55"></span><span data-fill="blue" style="background:#4a9ac4"></span><span data-fill="neutral" style="background:#b9a57c"></span></div>
 <div class="aid-line"><span>Rot / Blau / Neutral</span><b data-field="sectorsDetail"></b></div></section>
 <section><div class="aid-eyebrow">Kampfgruppen</div>
 <div class="aid-line"><span>Phase / Strategie</span><b data-field="phase"></b></div>
 <div class="aid-line"><span>Angriffsgruppe</span><b data-field="group"></b></div>
 <div class="aid-line"><span>Lokale Verteidigung</span><b data-field="defenders"></b></div>
 <div class="aid-line"><span>Nebenangriff</span><b data-field="raiders"></b></div>
 <div class="aid-line"><span>Infanterie / Fahrzeuge / Luft</span><b data-field="soldiers"></b></div>
 <div class="aid-line"><span>Credits pro 10 s</span><b data-field="income"></b></div></section>
 <section><div class="aid-eyebrow">KI-Entscheidungen</div>
 <div class="aid-line"><span>Kampfeinschätzung</span><b data-field="stance"></b></div>
 <div class="aid-line"><span>Sichtbare Gegner</span><b data-field="visible"></b></div>
 <div class="aid-line"><span>Rückschläge / Angriffswellen</span><b data-field="fronts"></b></div>
 <div class="aid-line"><span>Entscheidung</span><b data-field="choice"></b></div>
 <div class="aid-caption" data-field="reason"></div></section>
 <section><div class="aid-eyebrow">Laufende Produktion</div><div class="aid-production" data-field="production"></div></section>
 <div class="aid-footer">F9 ein-/ausblenden · Nur Entwickleransicht · KI-Daten unverändert</div>
 </div>`;
 doc.body.appendChild(node);
 const field=name=>node.querySelector('[data-field="'+name+'"]');
 const set=(name,value)=>{const element=field(name);if(element)element.textContent=String(value)};
 let last=0;
 const update=(force=false)=>{
  if(node.hidden)return;
  const now=typeof performance==='undefined'?Date.now():performance.now();
  if(!force&&now-last<650)return;
  last=now;
  const s=captureAiDebug(game),m=s.mission;
  set('objective',m?
   (m.kind==='capture'?'Bastion erobern':m.kind==='structure'?'Hindernis zerstören':'Gegner aufspüren'):
   'Kein aktiver Auftrag');
  set('objectiveSub',m?`${m.name} · ${Math.round(m.age)} s im Auftrag${m.objective===null?'':' · Ziel #'+m.objective}`:
   'KI plant den nächsten Schritt');
  set('time','· '+Math.floor(s.time/60)+':'+String(Math.floor(s.time%60)).padStart(2,'0'));
  set('phase',s.phase+' / '+s.campaign);
  set('army',number(s.army));set('group',number(s.group));
  set('defenders',number(s.defenders));set('raiders',number(s.raiders));
  set('credits',number(s.credits));set('income',number(s.income));
  set('sectors',s.sectors.own+' / '+s.sectors.total);
  set('sectorsDetail',s.sectors.own+' / '+s.sectors.hostile+' / '+s.sectors.neutral);
  set('soldiers',s.buckets.infantry+' / '+s.buckets.vehicles+' / '+s.buckets.air);
  set('visible',s.visibleEnemies);set('stance',s.diagnostics.stance);
  set('fronts',s.diagnostics.failedFronts+' / '+s.diagnostics.waveLaunches);
  set('choice',s.diagnostics.lastChoice);set('reason',s.diagnostics.lastReason);
  for(const [key,count] of [['red',s.sectors.own],['blue',s.sectors.hostile],['neutral',s.sectors.neutral]]){
   const bar=node.querySelector('[data-fill="'+key+'"]');
   if(bar)bar.style.width=(s.sectors.total?count*100/s.sectors.total:0)+'%';
  }
  const production=field('production');
  production.replaceChildren();
  if(!s.production.length){
   const empty=doc.createElement('div');empty.className='aid-empty';
   empty.textContent='Keine laufenden Produktionsaufträge';production.append(empty);
  }else for(const entry of s.production){
   const line=doc.createElement('div');line.className='aid-line';
   const label=doc.createElement('span');label.textContent=entry.kind+' #'+entry.id;
   const value=doc.createElement('b');value.textContent=entry.queue.join(' · ');
   line.append(label,value);production.append(line);
  }
 };
 const toggle=()=>{
  node.hidden=!node.hidden;
  if(!node.hidden)update(true);
  return !node.hidden;
 };
 node.addEventListener('click',event=>{
  const action=event.target?.closest?.('button')?.dataset.action;
  if(action==='close'){node.hidden=true;return;}
  if(action==='copy') {
   const snapshot=JSON.stringify(captureAiDebug(game),null,2);
   if(navigator.clipboard?.writeText)navigator.clipboard.writeText(snapshot).catch(()=>{});
  }
 });
 return {node,toggle,update,get visible(){return !node.hidden},destroy(){node.remove()}};
}
