/* Versioned, hand-curated tactical maps. Keep exact geometry reproducible:
 * same seed + map version + terrain profile + generator => identical battlefield.
 * Data only; runs as a classic browser script AND a Node side-effect import.
 * Avoid reusing an ID when changing map topology: saves/AI reports depend on it.
 */
(()=>{
 'use strict';
 const list=Object.freeze([
  Object.freeze({
   id:'staubkrone',name:'Staubkrone',subtitle:'Die offene Wüstenarena',
   bastions:8,seed:9999,biome:'desert',terrain:'oasis',landscape:'network',
   generatorVersion:4,archetype:'open-basin',mapVersion:24,
   style:'Offene Expansion · Oasen halten · schnelle Flanken',
   description:'Weite Sichtlinien und eine umkämpfte Mitte. Ideal für schnellen Basisbau, Panzerverbände und Angriffe über mehrere Fronten.',
   training:'Expansion, Wirtschaft, Einheitenmix und Angriffstempo'
  }),
  Object.freeze({
   id:'frostpforte',name:'Frostpforte',subtitle:'Die Festung am Nordgrat',
   bastions:12,seed:2026,biome:'snow',terrain:'rocky',landscape:'network',
   generatorVersion:4,archetype:'broken-escarpment',mapVersion:25,
   style:'Engpass · Türme und Mauern · Belagerung',
   description:'Ein langer Gebirgskamm teilt das Schlachtfeld. Kontrolliere den Durchbruch und sichere deine Nachschub- und Angriffsrouten.',
   training:'Chokepoint-Kontrolle, Belagerung, Verteidigung und Routenplanung'
  }),
  Object.freeze({
   id:'schlangenfeste',name:'Schlangenfeste',subtitle:'Drei Wege zum gegnerischen HQ',
   bastions:16,seed:314159,biome:'jungle',terrain:'mixed',landscape:'network',
   generatorVersion:4,archetype:'serpentine-canyon',mapVersion:26,
   style:'Drei Bergpässe · Flankenwechsel · große Armeen',
   description:'Eine gewundene Bergkette mit drei Übergängen. Halte Bastionen und verlagere deine Offensive rechtzeitig zwischen den Fronten.',
   training:'Strategische Passwahl, Mehrfrontenangriff und Langzeitentscheidung'
  })
 ]);
 const byId=id=>list.find(p=>p.id===id)||null;
 // A user-provided preset query must never mislabel a custom map or an old
 // save. Metadata is only shown if the authoritative simulation agrees.
 const matches=(p,{seed,bastions,mapVersion,generatorVersion,terrain,biome}={})=>
  Boolean(p&&seed===p.seed&&bastions===p.bastions&&
   mapVersion===p.mapVersion&&generatorVersion===p.generatorVersion&&
   terrain===p.terrain&&biome===p.biome);
 const api=Object.freeze({list,byId,matches});
 globalThis.SandforgeMapPresets=api;
})();
