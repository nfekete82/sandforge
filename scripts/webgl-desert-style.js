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
 authoredSandVertexBlend:.83,
 mesa:'#d4bd9b',
 mesaShade:'#ad9675',
 looseStones:Object.freeze(['#d3b99b','#bba383','#dec6a8']),
 riverPebbles:Object.freeze(['#d5b697','#bda185','#d9c0a0','#af9275']),
 riverPebbleBase:'#e1cdb1',
 roadDust:'#b9a38a',
 roadRuts:'#aa987f',
 buriedRoad:'#968676',
 blownRoadDust:'#ba8d57',
 sceneDebris:'#c6aa8d',
 rubbleLight:'#d8bc9f',
 rubbleDark:'#b99d80',
 // Distinct material identity is retained; only decorative adobe/plaster,
 // road-dust/roof parts are slightly harmonized with the surrounding dunes.
 ruinedPlaster:'#c8b091',
 ruinBlend:.12
});
