/** Single source of truth for authored/procedural DESERT SCENERY.
 * Never tint gameplay building GLBs, team-colored actors or UI here.
 * Terrain, landscape rocks, ruined-settlement rubble and sand tracks share
 * these pigment values, while their normal/roughness textures stay independent.
 * No additional overlay / post-process passes or runtime draw calls.
 */
export const DESERT_SCENIC_STYLE=Object.freeze({
 revision:'unified-golden-desert-v1-20261115',
 terrainMaterial:'#f2e1c7',
 duneBase:'#d9bb92',
 duneHighlight:'#ebd4b1',
 wornStone:'#ad9679',
 drySediment:'#bda78a',
 warmLift:'#ead2a6',
 warmLiftStrength:.12,
 // The authored photograph supplies most of the pigment; retain only a light
 // neutral vertex shade to preserve terrain height transitions.
 authoredSandVertex:'#ffffff',
 authoredSandVertexBlend:.90,
 mesa:'#c6b091',
 mesaShade:'#806c57',
 looseStones:Object.freeze(['#ccb091','#9e8267','#e1c19c']),
 riverPebbles:Object.freeze(['#c8a47a','#917454','#d7b48b','#7f674d']),
 riverPebbleBase:'#ead5b9',
 roadDust:'#b9a38a',
 roadRuts:'#aa987f',
 buriedRoad:'#968676',
 blownRoadDust:'#ba8d57',
 sceneDebris:'#b69a7c',
 rubbleLight:'#debe98',
 rubbleDark:'#aa8e70',
 // Distinct material identity is retained; only decorative adobe/plaster,
 // road-dust/roof parts are slightly harmonized with the surrounding dunes.
 ruinedPlaster:'#c8b091',
 ruinBlend:.12
});
