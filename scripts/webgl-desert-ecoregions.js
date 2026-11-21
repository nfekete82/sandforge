/** Four ORIGINAL Sandforge battlegrounds, four real-world desert art directions.
 * Render-only: selected by the authenticated fixed map id/seed, never changes
 * movement, simulation, map generation, campaign saves or road geometry.
 * Color and textures are different; not a recolored green primitive.
 */
export const DESERT_ECOREGIONS=Object.freeze({
 'desert-strike':Object.freeze({
  id:'desert-strike',key:'erg',title:'Goldenes Dünenmeer',
  geography:'Sahara / arabische Sandwüste',
  terrainSource:'sandforge-sand-wind-photographic',
  ground:null,
  palette:Object.freeze({sand:'#eee0c9',highlight:'#f6e7cc',stone:'#cdb593',wash:'#d8c19e'}),
  uvMeters:740,rocks:0,saguaro:0,joshua:0,
  // Existing authored oasis/date palm landscape is retained.
  description:'Offene goldene Dünen und vereinzelte Oasenpalmen, kaum Vegetation.'
 }),
 'broken-empire':Object.freeze({
  id:'broken-empire',key:'sonoran',title:'Rote Felswüste',
  geography:'Sonora / Arizona',
  terrainSource:'polyhaven-red-sand-cc0',
  ground:Object.freeze({
   base:'/src/assets/reborn/terrain/desert-sonoran-albedo.webp',
   normal:'/src/assets/reborn/terrain/desert-sonoran-normal.webp',
   rough:'/src/assets/reborn/terrain/desert-sonoran-rough.webp'
  }),
  palette:Object.freeze({sand:'#e4cbb7',highlight:'#f2d4b8',stone:'#c48c75',wash:'#d5af95'}),
  uvMeters:550,rocks:35,saguaro:22,joshua:0,
  description:'Rötlich verwitterte Sandsteine, geschichtete Felsen und gerippte Saguaro-Kakteen.'
 }),
 'burning-horizon':Object.freeze({
  id:'burning-horizon',key:'mojave',title:'Helle Hochwüste',
  geography:'Mojave / Joshua-Tree-Hochland',
  terrainSource:'polyhaven-sandy-gravel-cc0',
  ground:Object.freeze({
   base:'/src/assets/reborn/terrain/desert-mojave-albedo.webp',
   normal:'/src/assets/reborn/terrain/desert-mojave-normal.webp',
   rough:'/src/assets/reborn/terrain/desert-mojave-rough.webp'
  }),
  palette:Object.freeze({sand:'#e3dace',highlight:'#f1e5d6',stone:'#b5a392',wash:'#c9b9a7'}),
  uvMeters:480,rocks:12,saguaro:0,joshua:26,
  description:'Heller kiesiger Wüstenboden, knorrige Joshua-Trees und weite Verteidigungsflächen.'
 }),
 'last-stronghold':Object.freeze({
  id:'last-stronghold',key:'badlands',title:'Erodierte Schluchtenwüste',
  geography:'Colorado Plateau / Badlands',
  terrainSource:'polyhaven-rock-ground-cc0',
  ground:Object.freeze({
   base:'/src/assets/reborn/terrain/desert-badlands-albedo.webp',
   normal:'/src/assets/reborn/terrain/desert-badlands-normal.webp',
   rough:'/src/assets/reborn/terrain/desert-badlands-rough.webp'
  }),
  palette:Object.freeze({sand:'#dec2ac',highlight:'#e9cbb1',stone:'#b87f63',wash:'#c9a489'}),
  uvMeters:420,rocks:54,saguaro:0,joshua:0,
  description:'Geschichtete rote Schluchten, felsige Trockenrinnen und nahezu vegetationslose Hochflächen.'
 }),
 'plateau-crossroads':Object.freeze({
  id:'plateau-crossroads',key:'plateau',title:'Tafelberg-Schluchtwüste',
  geography:'Arizona / Colorado Plateau',
  terrainSource:'polyhaven-rock-ground-cc0',
  ground:Object.freeze({
   base:'/src/assets/reborn/terrain/desert-badlands-albedo.webp',
   normal:'/src/assets/reborn/terrain/desert-badlands-normal.webp',
   rough:'/src/assets/reborn/terrain/desert-badlands-rough.webp'
  }),
  palette:Object.freeze({sand:'#d8b894',highlight:'#e9cfad',stone:'#b58d69',wash:'#ae8b6a'}),
  uvMeters:440,rocks:24,saguaro:0,joshua:0,
  description:'Drei geschichtete Hochplateaus mit echten Pässen und erdigen Talwegen.'
 })
});
export const DESERT_MODEL_FILES=Object.freeze({
 saguaro:'/src/assets/reborn/desert-ecoregions/saguaro-pbr.glb',
 sandstone:'/src/assets/reborn/desert-ecoregions/sandstone-pbr.glb',
 joshua:'/src/assets/reborn/desert-ecoregions/joshua-tree-pbr.glb'
});
export const DESERT_MODEL_TARGET_HEIGHT=Object.freeze({
 saguaro:96,sandstone:42,joshua:102
});
export function desertEcoregion(mapId){
 return DESERT_ECOREGIONS[mapId]??null;
}
