/* Menu shell: no WebGL imports. The original Sandforge menu can open even
 * if WebGL2 or an optional 3D module is unavailable. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const query=new URLSearchParams(location.search);
 const savedKey='sandforge:webgl:v1';
 const optionKey='sandforge:webgl:options';
 const savedBiomeKey='sandforge:webgl:save-biome';
 const mapPresets=globalThis.SandforgeMapPresets;
 const selectedPreset=()=>mapPresets?.byId($('sf3d-map-preset').value)||null;
 const updateMapChoice=()=>{
  const p=selectedPreset();
  $('sf3d-random-controls').hidden=Boolean(p);
  $('sf3d-map-description').textContent=p
   ?p.subtitle+' · '+p.style+' — '+p.description
   :'Zufallskarte: Bastionen, Biom, Gelände und Seed selbst bestimmen.';
  // Presets are locked together: changing the scenery cannot silently
  // create a different map under the same named-map label.
  if(p){
   $('sf3d-map-size').value=String(p.bastions);
   $('sf3d-seed').value=String(p.seed);
   $('sf3d-biome').value=p.biome;
   $('sf3d-terrain').value=p.terrain;
   $('sf3d-landscape').value='network';
  }
  $('sf3d-new-status').textContent='';
 };

 const validBiome=value=>['desert','snow','jungle'].includes(value)?value:'desert';
 // The 3D game may run at / (release candidate) or /webgl-preview.html
 // (existing QA/deep links). Stay on the active entry during navigation.
 const gameRoute=()=>location.pathname==='/'||location.pathname==='/index.html'
  ?'/':'/webgl-preview.html';
 const modes={15:4,16:8,17:12,18:16,19:4,20:8,21:12,22:16,23:4,24:8,25:12,26:16};
 const menu=$('main-dialog'),newDialog=$('sf3d-new-dialog');
 const optionsDialog=$('sf3d-options-dialog'),pauseDialog=$('sf3d-pause-dialog');
 const status=$('sf3d-menu-status');
 const readSave=()=>{try{const raw=localStorage.getItem(savedKey);return raw?JSON.parse(raw):null;}catch{return null;}};
 const readOptions=()=>{try{return JSON.parse(localStorage.getItem(optionKey)||'{}');}catch{return {};}};
 const notify=(message)=>{status.textContent=message;};
 const volume=(key,fallback)=>Math.max(0,Math.min(100,
  Number.isFinite(Number(readOptions()[key]))&&readOptions()[key]!=null?
   Number(readOptions()[key]):fallback));
 const renderAudioSliders=()=>{
  const options=readOptions();
  for(const [id,key,defaultValue] of [
   ['sf3d-master-volume','masterVolume',85],
   ['sf3d-effects-volume','effectsVolume',85],
   ['sf3d-music-volume','musicVolume',22]
  ]){
   const value=options[key];
   $(id).value=String(value==null?defaultValue:Math.max(0,Math.min(100,Number(value))));
   $(id.replace('-volume','-value')).textContent=$(id).value+' %';
  }
  // The user's original cinematic MP3 is the default. Explicit mute or
  // previously saved musicEnabled=false remains fully respected.
  $('sf3d-music-enabled').checked=options.musicEnabled!==false;
  $('sf3d-engine-sounds').checked=options.engineSoundsEnabled!==false;
 };
 function applyLiveAudio(){
  const a=window.__sandforgeWebGL?.sound;
  for(const id of ['sf3d-master','sf3d-effects','sf3d-music']){
   const value=$(id+'-volume').value;
   $(id+'-value').textContent=value+' %';
  }
  if(!a)return;
  a.setVolume(Number($('sf3d-master-volume').value)/100);
  a.setEffectsVolume(Number($('sf3d-effects-volume').value)/100);
  a.setMusicVolume(Number($('sf3d-music-volume').value)/100);
  a.setMusicEnabled($('sf3d-music-enabled').checked);
  a.setEngineSoundsEnabled($('sf3d-engine-sounds').checked);
 }
 const running=()=>Boolean(window.__sandforgeWebGL?.simulationRunning);
 const changePause=(shouldRun,source='Taktische Pause')=>{
  // The actual simulation state is authoritative. Clicking a focused button
  // programmatically is not safe: the browser may fire its own Space click.
  const runtime=window.__sandforgeWebGL;
  if(typeof runtime?.setSimulationRunning==='function')
   runtime.setSimulationRunning(shouldRun,source);
  else if(running()!==shouldRun)$('simulation')?.click(); // pre-update compatibility
 };
 // Typed only in the tactical-pause modal. The gameplay listener in
 // webgl-preview.js uses the exact same Simulation.enableTestMode() entrypoint.
 // Handle the modal separately because it captures keyboard focus.
 const pauseCheat='iddqd';
 let pauseCheatProgress=0;
 let suppressSpaceRelease=false;
 const saved=readSave();
 const play=(count,seed,{resume=false,legacy=false,terrain='random',biome='desert',landscape='network',preset=null}={})=>{
  const params=new URLSearchParams({bastions:String(count),seed:String(seed>>>0),play:'1'});
  // Keep local A/B policy selection while navigating from the main menu.
  if(query.get('ai33')==='off'||query.get('ai33')==='adaptive')
   params.set('ai33',query.get('ai33'));
  if(query.get('ai35')==='off'||query.get('ai35')==='control')
   params.set('ai35',query.get('ai35'));
  if(query.get('ai36')==='off'||query.get('ai36')==='coordinated')
   params.set('ai36',query.get('ai36'));
  if(resume)params.set('resume','1');
  if(legacy)params.set('legacy','1');
  const options=readOptions();
  if(options.quality==='lite')params.set('lite','1');
  if(options.fog===false)params.set('fog','0');
  if(!resume&&!legacy){
   params.set('terrain',terrain);
   params.set('landscape',landscape==='curated'?'curated':landscape==='classic'?'classic':'network');
  }
  if(!legacy)params.set('biome',validBiome(biome));
  // Persist the authored-map identity in the URL, but the simulation
  // independently verifies all geometry fields before showing the label.
  const authored=mapPresets?.byId(preset);
  if(authored&&authored.seed===(seed>>>0)&&authored.bastions===count&&
   validBiome(biome)===authored.biome)params.set('preset',authored.id);
  location.assign(gameRoute()+'?'+params);
 };
 function continueSave(){
  const data=readSave(),bastions=data&&modes[data.mapVersion];
  if(!data||!bastions||!Number.isSafeInteger(data.seed)){
   notify('Kein kompatibler 3D-Spielstand gefunden.');return;
  }
  // Cosmetic biome metadata is stored separately: the validated game-save
  // schema and its deterministic gameplay state remain untouched.
  let visual=null;
  try{visual=JSON.parse(localStorage.getItem(savedBiomeKey)||'null');}catch{}
  const biome=visual?.seed===data.seed&&visual?.mapVersion===data.mapVersion
   ?validBiome(visual.biome):'desert';
  const p=mapPresets?.byId(visual?.preset);
  const savedPreset=p&&visual?.seed===data.seed&&
   p.mapVersion===data.mapVersion&&p.generatorVersion===data.generatorVersion&&
   p.terrain===data.terrainProfile&&p.biome===biome?p.id:null;
  play(bastions,data.seed,{resume:true,legacy:data.mapVersion<=18,biome,preset:savedPreset});
 }
 function randomSeed(){
  if(window.crypto?.getRandomValues){
   const a=new Uint32Array(1);window.crypto.getRandomValues(a);return a[0];
  }
  return Math.floor(Math.random()*4294967296)>>>0;
 }
 function openOptions(){
  const opts=readOptions();
  $('sf3d-quality').value=opts.quality==='lite'?'lite':'high';
  $('sf3d-fog').checked=opts.fog!==false;
  $('sf3d-sound').checked=opts.sound!==false;
  renderAudioSliders();
  optionsDialog.showModal();
 }
 function saveOptions(){
  try{
   localStorage.setItem(optionKey,JSON.stringify({
    quality:$('sf3d-quality').value,
    fog:$('sf3d-fog').checked,
    sound:$('sf3d-sound').checked,
    musicEnabled:$('sf3d-music-enabled').checked,
    engineSoundsEnabled:$('sf3d-engine-sounds').checked,
    masterVolume:Number($('sf3d-master-volume').value),
    effectsVolume:Number($('sf3d-effects-volume').value),
    musicVolume:Number($('sf3d-music-volume').value)
   }));
  }catch(error){console.warn('Could not save local graphics options:',error);}
  optionsDialog.close();
  const active=window.__sandforgeWebGL;
  if(active?.battlefield){
   const enabled=$('sf3d-fog').checked;
   active.battlefield.fogEnabled=enabled;
   active.battlefield.updateFog();
   const soundButton=$('sound');
   const shouldEnable=$('sf3d-sound').checked;
   soundButton.disabled=false;
   active.sound.setEnabled(shouldEnable);
   applyLiveAudio();
   soundButton.setAttribute('aria-pressed',String(shouldEnable));
   soundButton.textContent=shouldEnable?'Sound ausschalten':'Sound einschalten';
   soundButton.title=shouldEnable?'Audio freigegeben (Klick zum Ausschalten)':'Audio deaktiviert (Klick zum Einschalten)';
   if(shouldEnable)void active.sound.unlock().catch(error=>console.warn('WebAudio activation requires a gesture',error));
  }
  notify('Optionen gespeichert. Musiklautstärke und Sound wirken sofort.');
 }
 function openPause(){
  if(!window.__sandforgeWebGL?.loaded)return;
  if(pauseDialog.open)return;
  pauseCheatProgress=0;
  $('sf3d-pause-status').textContent='';
  // Even when a toolbar/old shortcut already paused the simulation,
  // opening this dialog must never preserve a stale paused state on resume.
  changePause(false,'Taktische Pause');
  pauseDialog.showModal();
 }
 function resumeGame(){
  if(!pauseDialog.open)return;
  pauseCheatProgress=0;
  pauseDialog.close();
  // "Spiel fortsetzen" is an explicit command, not a conditional toggle.
  // Always leave the game RUNNING regardless of its pre-dialog state.
  changePause(true,'Taktische Pause');
 }
 function goMain(){
  location.assign(gameRoute());
 }
 $('sf3d-map-preset').addEventListener('change',updateMapChoice);
 $('sf3d-new').addEventListener('click',()=>{
  $('sf3d-map-preset').value='staubkrone';
  const source=$('bastions');
  $('sf3d-map-size').value=source?.value??'8';
  $('sf3d-seed').value='';
  $('sf3d-terrain').value='random';
  $('sf3d-landscape').value='network';
  $('sf3d-biome').value='desert';
  updateMapChoice();
  newDialog.showModal();
 });
 $('sf3d-campaign').addEventListener('click',()=>{updateMapChoice();newDialog.showModal();});
 $('sf3d-continue').addEventListener('click',continueSave);
 $('sf3d-main-load').addEventListener('click',continueSave);
 $('sf3d-main-options').addEventListener('click',openOptions);
 $('sf3d-options-save').addEventListener('click',saveOptions);
 for(const id of ['sf3d-master-volume','sf3d-effects-volume','sf3d-music-volume']){
  $(id).addEventListener('input',applyLiveAudio);
 }
 $('sf3d-music-enabled').addEventListener('change',applyLiveAudio);
 $('sf3d-engine-sounds').addEventListener('change',applyLiveAudio);
 $('sf3d-audio-test').addEventListener('click',async()=>{
  const status=$('sf3d-audio-status');
  const runtime=window.__sandforgeWebGL;
  if(!runtime?.sound){
   status.textContent='Audio-Test erst innerhalb einer gestarteten Kampagne verfügbar.';
   return;
  }
  // Deliberate user gesture: browsers allow AudioContext.resume() here.
  const sound=runtime.sound;
  $('sf3d-sound').checked=true;
  sound.setEnabled(true);
  // The sound test obeys the user's three audio sliders and should not
  // suddenly turn the overall volume up to 85 percent.
  applyLiveAudio();
  try{
   await sound.unlock();
   if(sound.context?.state!=='running')throw new Error('AudioContext '+(sound.context?.state??'unbekannt'));
   sound.command();sound.select();
   status.textContent='Soundtest gespielt · AudioContext läuft · Lautstärke '+Math.round(sound.volume*100)+' %';
  }catch(error){
   status.textContent='Audio blockiert: '+String(error?.message??error);
   console.warn('Sandforge sound test failed:',error);
  }
 });
 $('sf3d-new-confirm').addEventListener('click',()=>{
  const preset=selectedPreset();
  if(preset){
   play(preset.bastions,preset.seed,{
    terrain:preset.terrain,biome:preset.biome,
    landscape:'curated',preset:preset.id
   });
   return;
  }
  const count=Number($('sf3d-map-size').value);
  const text=$('sf3d-seed').value.trim();
  const n=text.length?Number(text):randomSeed();
  if(!Number.isSafeInteger(n)||n<0||n>4294967295){
   $('sf3d-new-status').textContent='Seed muss zwischen 0 und 4294967295 liegen.';return;
  }
  play(count,n,{terrain:$('sf3d-terrain').value,biome:$('sf3d-biome').value,landscape:$('sf3d-landscape').value});
 });
 $('sf3d-pause-resume').addEventListener('click',resumeGame);
 $('sf3d-pause-save').addEventListener('click',()=>{
  const game=window.__sandforgeWebGL?.battlefield;
  const saved=game?.saveGame?.()===true;
  if(saved)try{
   localStorage.setItem(savedBiomeKey,JSON.stringify({
    seed:game.game.seed,mapVersion:game.world.mapVersion,
    biome:validBiome(window.__sandforgeWebGL?.biome),
    preset:window.__sandforgeWebGL?.mapPresetId??null
   }));
  }catch(error){console.warn('Biom-Einstellung konnte nicht gespeichert werden:',error);}
  $('sf3d-pause-status').textContent=saved
   ?'Kampagne lokal gespeichert.'
   :'Speichern fehlgeschlagen. Bitte Speicherplatz und Browser-Einstellungen prüfen.';
 });
 $('sf3d-pause-load').addEventListener('click',continueSave);
 $('sf3d-pause-options').addEventListener('click',openOptions);
 $('sf3d-pause-new').addEventListener('click',()=>{
  pauseDialog.close();updateMapChoice();newDialog.showModal();
 });
 $('sf3d-pause-main').addEventListener('click',goMain);
 for(const el of document.querySelectorAll('[data-sf3d-close]')){
  el.addEventListener('click',()=>el.closest('dialog')?.close());
 }
 menu.addEventListener('cancel',e=>e.preventDefault());
 pauseDialog.addEventListener('cancel',e=>{e.preventDefault();resumeGame();});
 pauseDialog.addEventListener('close',()=>{pauseCheatProgress=0;});
 document.addEventListener('keydown',e=>{
  // HTML confirmation is the active modal: never trigger tactical pause/ESC.
  if(document.getElementById('sf-confirm-dialog')?.open)return;
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||
   (e.target instanceof Element&&e.target.matches('input,select,textarea,[contenteditable]')))return;
  if(pauseDialog.open&&!menu.open&&!newDialog.open&&!optionsDialog.open){
   if(typeof e.key==='string'&&/^[a-z]$/i.test(e.key)){
    // Do not pan the camera or trigger normal game shortcuts behind the modal.
    e.preventDefault();e.stopImmediatePropagation();
    const key=e.key.toLowerCase();
    pauseCheatProgress=key===pauseCheat[pauseCheatProgress]
     ?pauseCheatProgress+1:key===pauseCheat[0]?1:0;
    if(pauseCheatProgress===pauseCheat.length){
     pauseCheatProgress=0;
     const active=window.__sandforgeWebGL,g=active?.game;
     if(active?.loaded&&g?.status==='playing'&&typeof g.enableTestMode==='function'){
      const activated=g.enableTestMode();
      active.battlefield?.drawInterface?.();
      $('sf3d-pause-status').textContent=activated
       ?'TESTMODUS AKTIV · ∞ Credits · Sofortbau, Produktion und Forschung'
       :'TESTMODUS BEREITS AKTIV · ∞ Credits';
     }
    }
    return;
   }
   // Every non-letter breaks the sequence, including unrelated shortcuts.
   pauseCheatProgress=0;
  }
  if(e.code==='Space'){
   if(menu.open||newDialog.open||optionsDialog.open)return;
   if(!window.__sandforgeWebGL?.loaded)return;
   // Own this keystroke end to end, including its native button keyup.
   // One keypress means ONE modal transition and ONE simulation transition.
   suppressSpaceRelease=true;
   e.preventDefault();e.stopImmediatePropagation();
   if(pauseDialog.open)resumeGame();
   else openPause();
   return;
  }
  if(e.code!=='Escape'||menu.open||newDialog.open||optionsDialog.open||pauseDialog.open)return;
  const field=window.__sandforgeWebGL?.battlefield;
  if(field&&(field.attackMode||field.buildKind))return;
  if(window.__sandforgeWebGL?.loaded){e.preventDefault();e.stopImmediatePropagation();openPause();}
 },true);
 // Space activates the currently focused <button> on keyup in browsers.
 // If the modal closes on keydown, that late native click could hit the
 // toolbar and pause again. Consume ONLY the release of our handled key.
 document.addEventListener('keyup',e=>{
  if(e.code!=='Space'||!suppressSpaceRelease)return;
  suppressSpaceRelease=false;
  e.preventDefault();
  e.stopImmediatePropagation();
 },true);
 window.addEventListener('blur',()=>{suppressSpaceRelease=false;});
 window.Sandforge3DMenu={openPause,goMain,continueSave,play,readSave,readOptions,gameRoute};
 const options=readOptions();
 updateMapChoice();
 $('sf3d-continue').hidden=!Boolean(saved&&modes[saved.mapVersion]);
 $('sf3d-main-load').disabled=!Boolean(saved&&modes[saved.mapVersion]);
 if(query.has('play')||query.has('bastions')||query.has('seed')||query.has('resume')){
  // Direct deep links from existing tests and bookmarks remain supported.
  const start=$('sf3d-boot');
  if(start)start.hidden=false;
  // Catch *static import failures* (including missing dependencies) instead
  // of leaving an empty viewport stuck at "Initialisiere".
  import('/webgl-preview.js').then(()=>{
   if(start)start.hidden=true;
  }).catch(error=>{
   console.error('Sandforge WebGL bootstrap failed:',error);
   const title=$('sf3d-fatal-title'),detail=$('sf3d-fatal-detail'),fatal=$('sf3d-fatal');
   title.textContent='3D-GRAFIK KONNTE NICHT STARTEN';
   detail.textContent=String(error?.message??error);
   fatal.hidden=false;
   if(start)start.hidden=true;
  });
 }else{
  menu.showModal();
  status.textContent='WEITE WÜSTE · 3D-KAMPAGNE';
 }
})();
