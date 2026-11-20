/* The four ORIGINAL landscape archetypes with graded driving passes (v5), pinned to
 * reproducible seeds and the existing premium desert WebGL renderer.
 * Same v4 art and mountain footprints; v5 grades only physical vehicle passes.
 * No extra monuments, biome swap or procedural art rewrite.
 * One module shared between the standalone WebGL menu and Node QA.
 */
(()=>{
 'use strict';
 const maps=Object.freeze([
  Object.freeze({
   id:'desert-strike',name:'Desert Strike',inspiration:'Tournament Desert',kind:'open-basin',
   bastions:8,mapVersion:24,seed:9999,terrain:'oasis',biome:'desert',generatorVersion:5,
   subtitle:'Offenes Gelände · 8 Bastionen',
   description:'Offenes Gelände, sanfte Hügel und mehrere Angriffswege. Schnelle Expansion und klassische Panzeroffensiven.'
  }),
  Object.freeze({
   id:'broken-empire',name:'Broken Empire',inspiration:'Fallen Empire',kind:'broken-escarpment',
   bastions:12,mapVersion:25,seed:2026,terrain:'rocky',biome:'desert',generatorVersion:5,
   subtitle:'Felsen und Engpässe · 12 Bastionen',
   description:'Engpässe, Felsen und taktische Höhenzüge. Verteidigen, einigeln und den Durchbruch erzwingen.'
  }),
  Object.freeze({
   id:'burning-horizon',name:'Burning Horizon',inspiration:'Twilight Flame',kind:'diagonal-ridge',
   bastions:16,mapVersion:26,seed:1907,terrain:'dunes',biome:'desert',generatorVersion:5,
   subtitle:'Große Wüste · 16 Bastionen',
   description:'Große Karte mit viel Platz für Basisbau und Verteidigung. Diagonale Höhenzüge ermöglichen zusätzliche Flankenwege.'
  }),
  Object.freeze({
   id:'last-stronghold',name:'Last Stronghold',inspiration:'Defcon 6',kind:'serpentine-canyon',
   bastions:16,mapVersion:26,seed:314159,terrain:'mixed',biome:'desert',generatorVersion:5,
   subtitle:'Mehrfrontengefecht · 16 Bastionen',
   description:'Mehrere Zugänge, zentrale Bastionen und intensive Gefechte. Drei Pässe verbinden die großen Fronten.'
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
