/* Four original desert archetypes with empirically selected route physics, pinned to
 * reproducible seeds and the existing premium desert WebGL renderer.
 * All keep original v4 art; v5 grades physical ramps only on maps where
 * measured AI pathing improved. Burning Horizon stays v4: v5 regressed.
 * No extra monuments, biome swap or procedural art rewrite.
 * One module shared between the standalone WebGL menu and Node QA.
 */
(()=>{
 'use strict';
 const maps=Object.freeze([
  Object.freeze({
   id:'desert-strike',name:'Desert Strike',inspiration:'Tournament Desert',kind:'open-basin',
   bastions:8,mapVersion:24,seed:9999,terrain:'oasis',biome:'desert',generatorVersion:5,
   subtitle:'Goldenes Dünenmeer · 8 Bastionen',
   description:'Goldenes Dünenmeer: echter Sand mit Windrippeln, sanfte Hügel, freie Angriffswege und vereinzelte Oasenpalmen.'
  }),
  Object.freeze({
   id:'broken-empire',name:'Broken Empire',inspiration:'Fallen Empire',kind:'broken-escarpment',
   bastions:12,mapVersion:25,seed:2026,terrain:'rocky',biome:'desert',generatorVersion:5,
   subtitle:'Rote Sonora-Felswüste · 12 Bastionen',
   description:'Rote Felswüste mit realen Sandstein-PBR-Schichten, organisch modellierten Saguaro-Kakteen und taktischen Engpässen.'
  }),
  Object.freeze({
   id:'burning-horizon',name:'Burning Horizon',inspiration:'Twilight Flame',kind:'diagonal-ridge',
   bastions:16,mapVersion:26,seed:1907,terrain:'dunes',biome:'desert',generatorVersion:4,
   subtitle:'Helle Mojave-Hochwüste · 16 Bastionen',
   description:'Helle kiesige Mojave-Wüste mit PBR-Boden und authentischen Joshua-Trees: viel Platz für Basisbau und Verteidigung.'
  }),
  Object.freeze({
   id:'last-stronghold',name:'Last Stronghold',inspiration:'Defcon 6',kind:'serpentine-canyon',
   bastions:16,mapVersion:26,seed:314159,terrain:'mixed',biome:'desert',generatorVersion:5,
   subtitle:'Rote Badlands-Schlucht · 16 Bastionen',
   description:'Erodierte Badlands und echte Sediment-Sandsteinformationen, karge Trockenrinnen, drei Pässe und zentrale Bastionen.'
  }),
  Object.freeze({
   id:'plateau-crossroads',name:'Plateau Crossroads',
   inspiration:'handcrafted RTS plateau routes',kind:'plateau-crossroads',
   bastions:16,mapVersion:26,seed:260621,terrain:'rocky',biome:'desert',generatorVersion:6,
   subtitle:'Tafelberge und vier Pässe · 16 Bastionen',
   description:'Drei versetzte Sandsteinplateaus, sichtbare Talwege, offene Flanken und vier befestigbare Engstellen.'
  })
 ]);
 const byId=id=>maps.find(map=>map.id===id)||null;
 const matches=(map,{seed,mapVersion,generatorVersion,terrain,biome,kind,bastions}={})=>
  Boolean(map&&seed===map.seed&&mapVersion===map.mapVersion&&
   generatorVersion===map.generatorVersion&&terrain===map.terrain&&
   biome===map.biome&&kind===map.kind&&bastions===map.bastions);
 const api=Object.freeze({maps,byId,matches});
 globalThis.SandforgeDesertMaps=api;
})();
