/* Six fixed desert maps. v8 is opt-in only for NEW matches of the five
 * original currently selected environments: connected highlands and dry valleys.
 * Historical v4/v5/v6 saves still load their original untouched terrain.
 * Mesa Highlands remains the tested v7 authored demonstration.
 */
(()=>{
 'use strict';
 const maps=Object.freeze([
  Object.freeze({
   id:'desert-strike',name:'Desert Strike',inspiration:'Tournament Desert',kind:'open-basin',
   bastions:8,mapVersion:24,seed:9999,terrain:'oasis',biome:'desert',generatorVersion:8,
   subtitle:'Dünenmeer · echte Hochflächen und breite Senken · 8 Bastionen',
   description:'Goldenes Dünenmeer: echter Sand mit Windrippeln, sanfte Hügel, freie Angriffswege und vereinzelte Oasenpalmen.'
  }),
  Object.freeze({
   id:'broken-empire',name:'Broken Empire',inspiration:'Fallen Empire',kind:'broken-escarpment',
   bastions:12,mapVersion:25,seed:2026,terrain:'rocky',biome:'desert',generatorVersion:8,
   subtitle:'Rote Sandsteinplateaus und befahrbare Pässe · 12 Bastionen',
   description:'Rote Felswüste mit realen Sandstein-PBR-Schichten, organisch modellierten Saguaro-Kakteen und taktischen Engpässen.'
  }),
  Object.freeze({
   id:'burning-horizon',name:'Burning Horizon',inspiration:'Twilight Flame',kind:'diagonal-ridge',
   bastions:16,mapVersion:26,seed:1907,terrain:'dunes',biome:'desert',generatorVersion:8,
   subtitle:'Mojave · weite Hochländer und trockene Täler · 16 Bastionen',
   description:'Helle kiesige Mojave-Wüste mit PBR-Boden und authentischen Joshua-Trees: viel Platz für Basisbau und Verteidigung.'
  }),
  Object.freeze({
   id:'last-stronghold',name:'Last Stronghold',inspiration:'Defcon 6',kind:'serpentine-canyon',
   bastions:16,mapVersion:26,seed:314159,terrain:'mixed',biome:'desert',generatorVersion:8,
   subtitle:'Badlands · erhöhte Festungen und Schluchten · 16 Bastionen',
   description:'Erodierte Badlands und echte Sediment-Sandsteinformationen, karge Trockenrinnen, drei Pässe und zentrale Bastionen.'
  }),
  Object.freeze({
   id:'plateau-crossroads',name:'Plateau Crossroads',
   inspiration:'handcrafted RTS plateau routes',kind:'plateau-crossroads',
   bastions:16,mapVersion:26,seed:260621,terrain:'rocky',biome:'desert',generatorVersion:8,
   subtitle:'Tafelberge, vier Pässe und echte Höhenstufen · 16 Bastionen',
   description:'Drei versetzte Sandsteinplateaus, sichtbare Talwege, offene Flanken und vier befestigbare Engstellen.'
  }),
  Object.freeze({
   id:'mesa-highlands',name:'Mesa Highlands',
   inspiration:'classic buildable highland RTS plateau',kind:'mesa-highlands',
   bastions:16,mapVersion:26,seed:271121,terrain:'rocky',biome:'desert',generatorVersion:7,
   subtitle:'Zwei bebaubare Hochplateaus · echte Zu-/Abfahrten',
   description:'Zwei echte erhöhte Bastionsplateaus mit bebaubarer Oberseite, senkrechten Sandsteinklippen und je einer Panzer-Zufahrtsrampe.'
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
