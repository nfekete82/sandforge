/* The four ORIGINAL generator-v4 Sandforge landscapes, pinned to
 * reproducible seeds and the existing premium desert WebGL renderer.
 * No v5 terrain, additional monuments, biome swap or procedural art rewrite.
 * One module shared between the standalone WebGL menu and Node QA.
 */
(()=>{
 'use strict';
 const maps=Object.freeze([
  Object.freeze({
   id:'duenenmeer',name:'Weites Dünenmeer',kind:'open-basin',
   bastions:8,mapVersion:24,seed:9999,terrain:'oasis',biome:'desert',generatorVersion:4,
   subtitle:'Offene Wüste · 8 Bastionen',
   description:'Weite Dünen, Oasen und freie Angriffswege. Klassischer Basisbau und schnelle Panzeroffensiven.'
  }),
  Object.freeze({
   id:'felsdurchbruch',name:'Felsdurchbruch',kind:'broken-escarpment',
   bastions:12,mapVersion:25,seed:2026,terrain:'rocky',biome:'desert',generatorVersion:4,
   subtitle:'Felsige Wüste · 12 Bastionen',
   description:'Ein mächtiger Felskamm mit einem Engpass: verteidigen, einigeln und den Durchbruch erzwingen.'
  }),
  Object.freeze({
   id:'diagonalkamm',name:'Diagonalkamm',kind:'diagonal-ridge',
   bastions:12,mapVersion:25,seed:1907,terrain:'dunes',biome:'desert',generatorVersion:4,
   subtitle:'Dünen und Gebirge · 12 Bastionen',
   description:'Diagonale Höhenzüge mit zwei Passwegen. Raum für Verteidigung und überraschende Flankenwechsel.'
  }),
  Object.freeze({
   id:'schlangenpass',name:'Schlangenpass',kind:'serpentine-canyon',
   bastions:16,mapVersion:26,seed:314159,terrain:'mixed',biome:'desert',generatorVersion:4,
   subtitle:'Schluchtenwüste · 16 Bastionen',
   description:'Eine gewundene Schlucht mit drei Pässen: lange Gefechte, große Armeen und Kontrolle der Bastionen.'
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
