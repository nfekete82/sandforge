/** Sandforge's original command HUD skin reused by the independent WebGL renderer.
 * Reuses /style.css and /retro-desert.css; no second stylesheet or divergent
 * menu layout required. The existing interactive elements are physically moved,
 * so their click handlers and accessibility identifiers remain intact. */
export function installClassicHud(){
 const oldHeader=document.querySelector('.header');
 const oldFooter=document.querySelector('.footer');
 const panel=document.createElement('div');
 panel.className='sf-rts';
 panel.id='sf-classic-root';
 panel.innerHTML=`
<header class="top hud frame" aria-label="Sandforge Ressourcen">
 <a class="wordmark" href="/" title="Zur klassischen Sandforge-Version">
  <img class="sandforge-logo sandforge-hud-logo" src="/src/assets/reborn/sandforge-logo-transparent.webp" alt="Sandforge: Bastion Wars" decoding="async">
 </a>
 <div class="resources">
  <span id="sf-stats" class="sf-assist-stats">Credits / Kapazität</span>
  <div class="credit-resource"><span class="credit-cube" aria-hidden="true">◆</span><div><strong id="sf-credits">500</strong><small><span id="sf-income">+35</span> / 10 S</small></div></div>
  <div class="capacity-resource"><span aria-hidden="true">♙</span><strong id="sf-capacity">2 <em>/ 48</em></strong></div>
 </div>
</header>
<nav class="tools hud frame sf-tools" id="sf-tools" aria-label="Spielmenü"></nav>
<aside id="sidebar" aria-label="Radar, Einheiten und Produktion">
 <section class="radar hud frame" aria-label="Minikarte">
  <span class="compass west">W</span><span class="compass east">E</span>
  <canvas id="sf-map" width="224" height="224" aria-label="Minikarte – Klicken verschiebt die Kamera"></canvas>
  <div class="radar-caption"><span id="sf-exploration">WÜSTENFRONT / 3D</span><button type="button" class="sf-sector-shortcut" data-action="sectors" title="Sektorenübersicht öffnen"><span id="sf-sectors">0 SEKTOREN</span></button></div>
 </section>
 <section class="catalog hud frame" aria-label="Einheiten und Gebäude">
  <nav class="catalog-tabs" id="sf-tabs" aria-label="Katalog">
   <button data-tab="buildings" aria-pressed="true">GEBÄUDE</button>
   <button data-tab="infantry" aria-pressed="false" hidden>INFANTERIE</button>
   <button data-tab="vehicles" aria-pressed="false" hidden>FAHRZEUGE</button>
   <button data-tab="aircraft" aria-pressed="false" hidden>FLUGZEUGE</button>
  </nav>
  <div class="catalog-scroll" id="sf-actions" aria-label="Einheiten, Gebäude und Territorien"></div>
  <section class="production hud frame sf-production-panel" id="sf-production" aria-label="Produktion und Warteschlange">
   <div class="sf-production-heading">
    <strong>PRODUKTION</strong>
    <span id="sf-queue-count">0 AUFTRÄGE</span>
   </div>
   <div class="sf-production-slots" id="sf-queue-slots" role="list" aria-label="Produktionsaufträge">
    <div class="sf-production-empty">Noch keine Produktion aktiv</div>
   </div>
   <div class="sf-production-progressline">
    <div class="production-track" role="progressbar" aria-label="Aktuelle Produktion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="sf-progress"></i></div>
    <span id="sf-queue-time">--:--</span>
   </div>
   <div class="queue-info"><span id="sf-queue">WARTESCHLANGE LEER</span></div>
   <div id="sf-building-status" class="sf-building-status" hidden></div>
  </section>
  <div id="sf-catalog-detail">Pioniere errichten Produktionsgebäude. Fertige Gebäude schalten Einheiten frei.</div>
 </section>
</aside>
<section class="command hud frame sf-command" id="sf-selection-panel" aria-label="Auswahl und Befehle">
 <div class="selection">
  <div class="portrait"><img id="sf-portrait" src="/src/assets/reborn/headquarters.png" alt="">
   <div id="sf-squad-portrait" class="sf-squad-portrait" role="img" aria-label="Ausgewählter Trupp" hidden>
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <span class="sf-squad-count" aria-hidden="true"></span>
   </div>
  </div>
  <div class="selection-copy" id="sf-selection"><small>BLAUE LEGION</small><strong>Keine Auswahl</strong></div>
 </div>
 <div class="command-group">
  <div class="section-label">KOMMANDOS</div>
  <div class="commands" id="sf-command-buttons">
   <button data-action="stop" title="Stellung halten und Gegner im Waffenradius automatisch bekämpfen (X)">STOPP</button>
   <button data-action="return-base" title="Zur eigenen Basis marschieren und dort Stellung halten (G)">ZUR BASIS</button>
   <button data-action="select-all" title="Alle sichtbaren eigenen Einheiten auf diesem Bildschirm auswählen (H)">ALLE</button>
   <button data-action="rally" id="sf-rally" title="Sammelpunkt für neue Einheiten setzen" hidden>SAMMELPUNKT</button>
   <button data-action="demolish" title="Eigenes Gebäude abreißen (nicht rückgängig)" hidden>ABREISSEN</button>
   <button data-action="missile-target" id="sf-strategic-fire" title="Langstreckenrakete: Ziel auf der Karte markieren" hidden>RAKETE STARTEN</button>
   <button data-action="interceptor-rearm" id="sf-interceptor-rearm" title="Drei Abwehrraketen für 650 Credits nachladen" hidden>ABWEHR LADEN</button>
  </div>
 </div>
</section>
<div class="sf-notice" id="sf-message" role="status" aria-live="polite"></div>
<div class="sf-game-settings hud frame" id="sf-settings">
 <div class="sf-settings-header"><div class="section-label">3D SCHLACHTFELD</div><button type="button" id="sf-settings-close" class="sf-settings-close" aria-label="Menü schließen">✕</button></div><div id="sf-settings-fields"></div>
</div>
<div class="sf-debug" id="sf-debug"><span id="sf-debug-status"></span><span id="sf-debug-error"></span></div>
`;
 document.body.append(panel);
 // Small consistent 14px tactical pictograms to the LEFT of labels.
 // SVGs are decorative; retain the actual button text, title, tabindex,
 // data-action, shortcuts and existing click listeners unchanged.
 const hudPaths={
  buildings:'<path d="M3 21V8l9-5 9 5v13H3Z"/><path d="M9 21v-9h6v9M3 10h18"/>',
  infantry:'<circle cx="12" cy="6" r="3"/><path d="M5 21v-4c0-4 3-7 7-7s7 3 7 7v4M8 21v-5m8 5v-5"/>',
  vehicles:'<path d="M3 10h16l2 5v4h-3m-12 0H3v-9Zm4-6h8l3 6H4l3-6Z"/><circle cx="8" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  aircraft:'<path d="m3 13 8-2V3a1 1 0 0 1 2 0v8l8 2v3l-8-2v4l3 2v2l-4-1-4 1v-2l3-2v-4l-8 2v-3Z"/>',
  'select-engineer':'<path d="m14 7 4-4 3 3-4 4M13 11l-8 8a2 2 0 0 0 3 3l8-8"/><path d="m13 11-3-3-3 1-2-2 3-4 4 1 1 4"/>',
  'select-all':'<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3"/><path d="M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
  attack:'<path d="m4 20 6-6m-5-8 13 13m-1-15L4 17m1 4 4-4m6-9 5-5 1 4-5 5"/>',
  rally:'<path d="M5 22V3m0 1c5-3 8 3 15 0v11c-6 3-10-3-15 0"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
  'return-base':'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/><path d="M9 7H3m0 0 2-2m-2 2 2 2"/>',
  demolish:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v7m4-7v7"/>',
  unload:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
  'missile-target':'<path d="M12 2c3 3 5 6 5 11v3H7v-3c0-5 2-8 5-11Z"/><path d="M7 11 4 15v4l3-2m10-6 3 4v4l-3-2M10 21v-3m4 3v-3"/>',
  'interceptor-rearm':'<path d="m12 2 8 3v6c0 5-3 8-8 11-5-3-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  cancel:'<path d="m5 5 14 14M19 5 5 19"/>'
 };
 const addHudIcon=(button,kind)=>{
  const shape=hudPaths[kind];
  if(!button||!shape||button.querySelector('.sf-hud-label-icon'))return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','1.65');
  svg.setAttribute('stroke-linecap','round');
  svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('sf-hud-label-icon');
  svg.innerHTML=shape;
  button.prepend(svg);
 };
 panel.querySelectorAll('#sf-tabs button[data-tab]').forEach(button=>
  addHudIcon(button,button.dataset.tab));
 panel.querySelectorAll('#sf-command-buttons button[data-action]').forEach(button=>
  addHudIcon(button,button.dataset.action));
 // One full-width tactical dock. Move the existing nodes rather than
 // cloning them, preserving all click/keyboard handlers and accessible IDs.
 const dock=panel.querySelector('#sidebar');
 dock.append(panel.querySelector('#sf-production'));
 dock.append(panel.querySelector('#sf-selection-panel'));
 dock.setAttribute('aria-label','Minikarte, Einheiten, Gebäude, Forschung, Produktion und Befehle');
 const tools=panel.querySelector('#sf-tools');
 const move=(id,parent)=>{
  const el=document.getElementById(id);if(!el)throw new Error('Missing existing WebGL control '+id);
  parent.append(el);return el;
 };
 const action=(id,label,tooltip)=>{
  const el=move(id,tools);el.title=tooltip;el.setAttribute('aria-label',label);
  el.classList.add('sf-tool-button');return el;
 };
 const makeAction=(action,label,icon)=>{
  const button=document.createElement('button');button.type='button';
  button.dataset.action=action;button.title=label;button.setAttribute('aria-label',label);
  button.textContent=icon;button.className='sf-tool-button';tools.append(button);
 };
 makeAction('save','Spiel speichern','▣');
 makeAction('load','Spielstand laden','⇧');
 makeAction('fog','Nebel des Krieges umschalten','◉');
 makeAction('health','Lebensbalken umschalten','♥');
 makeAction('menu','Spielmenü öffnen (Esc)','☰');
 action('rotate-left','Kamera links drehen','Kamera links drehen (Q)');
 action('rotate-right','Kamera rechts drehen','Kamera rechts drehen (E)');
 action('home','Kamera zur Basis','Ansicht zurücksetzen');
 action('sound','Sound ein- oder ausschalten','Audio');
 action('simulation','Simulation pausieren oder starten','Pause (Leertaste)');
 // The original footer is hidden when this compact RTS HUD mounts. Move
 // the REAL labeled tempo selector beside Pause instead of leaving it
 // invisible in that footer. Reparenting retains its existing change handler.
 const speedSelect=document.getElementById('simulation-speed');
 const speedLabel=speedSelect?.closest('label');
 if(speedLabel){
  speedLabel.classList.add('sf-tool-speed');
  speedLabel.title='Spieltempo für Einheiten, Produktion, Kampf und KI';
  tools.append(speedLabel);
 }
 const clock=move('clock',tools),fps=move('fps',tools);
 clock.classList.add('sf-clock');fps.classList.add('sf-fps');
 const settings=panel.querySelector('#sf-settings-fields');
 const row=document.createElement('div');row.className='sf-settings-row';
 for(const id of ['bastions','seed','load'])move(id,row);
 settings.append(row);
 const settingsButton=document.createElement('button');
 settingsButton.type='button';settingsButton.className='sf-tool-button';
 settingsButton.textContent='⚙';settingsButton.title='Kartengröße und Seed';
 settingsButton.setAttribute('aria-label','Karteneinstellungen anzeigen');
 tools.insertBefore(settingsButton,tools.firstChild);
 const closeSettings=()=>{
  panel.classList.remove('sf-settings-open');
  settingsButton.setAttribute('aria-expanded','false');
 };
 const openSettings=()=>{
  panel.classList.add('sf-settings-open');
  settingsButton.setAttribute('aria-expanded','true');
 };
 settingsButton.addEventListener('click',()=>{
  if(panel.classList.contains('sf-settings-open'))closeSettings();
  else openSettings();
 });
 panel.querySelector('#sf-settings-close')?.addEventListener('click',closeSettings);
 window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!panel.classList.contains('sf-settings-open'))
   return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closeSettings();
 },true);
 const status=move('status',panel.querySelector('#sf-debug-status'));
 const error=move('error',panel.querySelector('#sf-debug-error'));
 status.classList.add('sf-status');error.classList.add('sf-error');
 if(oldHeader)oldHeader.hidden=true;
 if(oldFooter)oldFooter.hidden=true;
 panel.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  panel.querySelectorAll('[data-tab]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.dataset.tab=button.dataset.tab;
  panel.dispatchEvent(new CustomEvent('sandforge-tabchange',{detail:{tab:button.dataset.tab}}));
 }));
 panel.dataset.tab='buildings';
 return panel;
}
