// Full research-center HUD: this is purely presentation. The authoritative
// Simulation.startResearch() continues to enforce prerequisites, credits,
// exclusivity, research timers and persistence for both factions.
export const RESEARCH_DECK_VERSION='research-command-center-v1-20261116';
export const RESEARCH_DECK_GROUPS=Object.freeze([
 Object.freeze({key:'armor',title:'PANZER & ANTRIEBE',subtitle:'Schutz · Mobilität',
  kinds:Object.freeze(['armor1','armor2','engines','tankArmor','tankMobility'])}),
 Object.freeze({key:'weapons',title:'WAFFENTECHNIK',subtitle:'Schaden · Reichweite',
  kinds:Object.freeze(['precision','rocketDevelopment'])}),
 Object.freeze({key:'tactics',title:'TRUPPEN & AUFKLÄRUNG',subtitle:'Infanterie · Sensorik',
  kinds:Object.freeze(['infantryTraining','radar'])})
]);
const esc=value=>String(value??'').replace(/[&<>"']/g,
 c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('de-DE').format(n);

export function researchDeckTechStatus(state,kind,upgrades,credits,online=true,playing=true){
 const spec=upgrades[kind];
 if(!spec)return {key:'invalid',label:'NICHT VERFÜGBAR',canStart:false,detail:'Unbekannte Technologie'};
 if(state.completed.includes(kind))
  return {key:'done',label:'ABGESCHLOSSEN',canStart:false,detail:'Dauerhaft erforscht'};
 if(state.active===kind)
  return {key:'active',label:'WIRD ERFORSCHT',canStart:false,
   detail:'Die Technologie wird gerade entwickelt'};
 if(!playing)
  return {key:'locked',label:'GEFECHT BEENDET',canStart:false,detail:'Forschung ist momentan nicht möglich'};
 if(!online)
  return {key:'locked',label:'LABOR OFFLINE',canStart:false,detail:'Ein fertiges Forschungszentrum wird benötigt'};
 if(spec.exclusive&&state.completed.some(k=>
  k!==kind&&upgrades[k]?.exclusive===spec.exclusive))
  return {key:'exclusive',label:'ALTERNATIVER PFAD',canStart:false,
   detail:'Durch die gewählte Panzer-Spezialisierung ausgeschlossen'};
 if(spec.requires&&!state.completed.includes(spec.requires))
  return {key:'prerequisite',label:'VORAUSSETZUNG',canStart:false,
   detail:'Zuerst erforschen: '+upgrades[spec.requires]?.name};
 if(state.active)
  return {key:'busy',label:'LABOR BELEGT',canStart:false,
   detail:'Zunächst die laufende Forschung abschließen'};
 if(credits<spec.cost)
  return {key:'funds',label:'ZU WENIG CREDITS',canStart:false,
   detail:'Es fehlen '+fmt(spec.cost-credits)+' Credits'};
 return {key:'ready',label:'FORSCHEN',canStart:true,detail:'Bereit zur Erforschung'};
}

/** Called once per scene lifecycle; update() only modifies text/classes.
 * Existing SVG pictograms stay mounted between Simulation's 20-Hz ticks,
 * preventing re-rasterization and flicker.
 */
export function createSandforgeResearchDeck({
 parent,upgrades,upgradeKinds,iconMarkup,onResearch
}){
 if(!parent||!upgrades||!upgradeKinds||typeof onResearch!=='function')
  throw new Error('Research deck requires HUD, upgrades and start handler');
 const all=new Set(upgradeKinds);
 const groups=RESEARCH_DECK_GROUPS.map(g=>({...g,kinds:g.kinds.filter(k=>all.has(k))}));
 const overlay=document.createElement('div');
 overlay.id='sf-research-overlay';
 overlay.className='sf-research-overlay';
 overlay.hidden=true;
 overlay.innerHTML=
  '<section class="sf-research-window" role="dialog" aria-modal="false" '+
  'aria-labelledby="sf-research-title" aria-label="Technologieforschung">'+
  '<header class="sf-research-header">'+
   '<div class="sf-research-header-title"><small>BLUE LEGION / TECHNISCHE ENTWICKLUNG</small>'+
    '<h2 id="sf-research-title">FORSCHUNGSZENTRUM</h2>'+
    '<p>FORSCHUNGSBAUM · 9 TECHNOLOGIEN · DIREKTE AUFRÜSTUNG</p></div>'+
   '<div class="sf-research-header-actions">'+
    '<div class="sf-research-completion"><strong data-sf-tech-count>0 / 9</strong>'+
    '<small>FREIGESCHALTET</small></div>'+
    '<button type="button" class="sf-research-close" data-sf-tech-close '+
     'aria-label="Forschungsmenü schließen" title="Forschungsmenü schließen">✕</button>'+
   '</div></header>'+
  '<div class="sf-research-activity">'+
   '<span class="sf-research-activity-label" data-sf-tech-active>FORSCHUNG BEREIT</span>'+
   '<div class="sf-research-activity-track" role="progressbar" aria-label="Forschungsfortschritt" '+
    'aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">'+
    '<span data-sf-tech-active-fill></span></div>'+
   '<span class="sf-research-activity-time" data-sf-tech-time>–</span>'+
   '<span class="sf-research-activity-credits" data-sf-tech-credits>0 ◆</span>'+
  '</div>'+
  '<div class="sf-research-workspace">'+
   '<div class="sf-research-techgroups" aria-label="Forschungsbereiche">'+
    groups.map(group=>
     '<section class="sf-research-category" data-sf-tech-category="'+esc(group.key)+'">'+
      '<div class="sf-research-category-heading"><strong>'+esc(group.title)+'</strong>'+
       '<small>'+esc(group.subtitle)+'</small></div>'+
      '<div class="sf-research-category-cards">'+group.kinds.map(kind=>{
       const tech=upgrades[kind];
       return '<button type="button" class="sf-research-upgrade" data-sf-tech-kind="'+esc(kind)+'" '+
        'aria-pressed="false" title="'+esc(tech.description)+'">'+
        '<span class="sf-research-upgrade-icon" aria-hidden="true">'+
         (iconMarkup?.(kind)??'◆')+'</span>'+
        '<span class="sf-research-upgrade-copy"><strong>'+esc(tech.name)+'</strong>'+
         '<small>'+fmt(tech.cost)+' ◆ · '+tech.seconds+' s</small>'+
         '<span class="sf-research-upgrade-state" data-sf-tech-status="'+esc(kind)+'">BEREIT</span>'+
        '</span><span class="sf-research-upgrade-progress"><i data-sf-tech-bar="'+esc(kind)+'"></i></span>'+
       '</button>';
      }).join('')+'</div></section>'
    ).join('')+
   '</div>'+
   '<aside class="sf-research-detail" aria-label="Technologiedetails">'+
    '<small class="sf-research-detail-eyebrow">TECHNOLOGIE · DETAIL</small>'+
    '<div class="sf-research-detail-icon" data-sf-tech-icon></div>'+
    '<h3 data-sf-tech-name>Technologie auswählen</h3>'+
    '<p class="sf-research-detail-description" data-sf-tech-description></p>'+
    '<dl class="sf-research-detail-stats">'+
     '<div><dt>KOSTEN</dt><dd data-sf-tech-cost>—</dd></div>'+
     '<div><dt>FORSCHUNGSZEIT</dt><dd data-sf-tech-duration>—</dd></div>'+
     '<div><dt>VORAUSSETZUNG</dt><dd data-sf-tech-requires>—</dd></div>'+
    '</dl>'+
    '<div class="sf-research-detail-state" data-sf-tech-reason>Technologie auswählen</div>'+
    '<button type="button" class="sf-research-start" data-sf-tech-start disabled>'+
     'FORSCHUNG STARTEN</button>'+
    '<small class="sf-research-detail-hint">Ein Forschungsprojekt gleichzeitig. Verbesserungen gelten für alle entsprechenden Einheiten.</small>'+
   '</aside>'+
  '</div>'+
  '</section>';
 parent.append(overlay);
 const q=selector=>overlay.querySelector(selector);
 const cards=new Map([...overlay.querySelectorAll('[data-sf-tech-kind]')]
  .map(btn=>[btn.dataset.sfTechKind,btn]));
 const progress=q('[data-sf-tech-active-fill]');
 const start=q('[data-sf-tech-start]');
 let selectedBaseId=null,dismissed=false,selectedKind=null,last=null;
 const hide=()=>{
  dismissed=true;overlay.hidden=true;
 };
 function display(){
  if(overlay.hidden||!last)return;
  const {state,credits,online,playing}=last;
  q('[data-sf-tech-count]').textContent=state.completed.length+' / '+upgradeKinds.length;
  q('[data-sf-tech-credits]').textContent=fmt(credits)+' ◆';
  const active=state.active?upgrades[state.active]:null;
  const pct=active?Math.max(0,Math.min(100,
   Math.round(100*(1-state.remaining/Math.max(.01,active.seconds))))):0;
  q('[data-sf-tech-active]').textContent=active?'AKTIVE FORSCHUNG · '+active.name:
   'FORSCHUNGSZENTRUM EINSATZBEREIT';
  q('[data-sf-tech-time]').textContent=active?Math.ceil(state.remaining)+' s':'BEREIT';
  progress.style.width=pct+'%';
  progress.parentElement.setAttribute('aria-valuenow',String(pct));
  for(const [kind,card] of cards){
   const status=researchDeckTechStatus(state,kind,upgrades,credits,online,playing);
   card.dataset.state=status.key;
   card.setAttribute('aria-pressed',String(kind===selectedKind));
   card.classList.toggle('is-selected',kind===selectedKind);
   card.querySelector('[data-sf-tech-status]').textContent=status.label;
   const bar=card.querySelector('[data-sf-tech-bar]');
   bar.style.width=status.key==='done'?'100%':status.key==='active'?pct+'%':'0%';
  }
  const kind=selectedKind&&upgrades[selectedKind]?selectedKind:upgradeKinds[0];
  const spec=upgrades[kind];
  const status=researchDeckTechStatus(state,kind,upgrades,credits,online,playing);
  selectedKind=kind;
  q('[data-sf-tech-icon]').innerHTML=iconMarkup?.(kind)??'◆';
  q('[data-sf-tech-name]').textContent=spec.name;
  q('[data-sf-tech-description]').textContent=spec.description;
  q('[data-sf-tech-cost]').textContent=fmt(spec.cost)+' Credits';
  q('[data-sf-tech-duration]').textContent=spec.seconds+' Sekunden';
  q('[data-sf-tech-requires]').textContent=spec.requires?
   upgrades[spec.requires].name:spec.exclusive?
    'Alternativer Panzerpfad':'Keine';
  q('[data-sf-tech-reason]').textContent=status.detail;
  q('[data-sf-tech-reason]').dataset.state=status.key;
  start.disabled=!status.canStart;
  start.textContent=status.canStart?'ERFORSCHEN · '+fmt(spec.cost)+' ◆':status.label;
  start.dataset.sfTechKind=kind;
 }
 overlay.addEventListener('click',event=>{
  // Do not forward menu button clicks to combat/placement/HUD commands.
  event.stopPropagation();
  if(event.target===overlay||event.target.closest('[data-sf-tech-close]')){
   hide();return;
  }
  const card=event.target.closest('[data-sf-tech-kind]');
  if(card){selectedKind=card.dataset.sfTechKind;display();return;}
  if(event.target.closest('[data-sf-tech-start]')&&selectedKind){
   const status=researchDeckTechStatus(last.state,selectedKind,upgrades,
    last.credits,last.online,last.playing);
   if(status.canStart)onResearch(selectedKind);
  }
 });
 return {
  root:overlay,
  update({base,state,credits,online,playing=true}){
   const id=base?.kind==='research'&&base.owner===0&&base.hp>0&&
    base.buildRemaining<=0?base.id:null;
   if(id!==selectedBaseId){
    selectedBaseId=id;dismissed=false;
    selectedKind=state?.active??upgradeKinds.find(k=>
     !state?.completed.includes(k))??upgradeKinds[0];
   }
   last={state,credits,online,playing};
   overlay.hidden=id===null||dismissed;
   if(!overlay.hidden)display();
  },
  close:hide,
  get open(){return !overlay.hidden;},
  get selectedKind(){return selectedKind;}
 };
}
