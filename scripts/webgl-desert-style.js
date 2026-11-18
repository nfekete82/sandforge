/** Single source of truth for authored/procedural DESERT SCENERY.
 * Never tint gameplay building GLBs, team-colored actors or UI here.
 * Terrain, landscape rocks, ruined-settlement rubble and sand tracks share
 * these pigment values, while their normal/roughness textures stay independent.
 * No additional overlay / post-process passes or runtime draw calls.
 */
export const DESERT_SCENIC_STYLE=Object.freeze({
 revision:'subtle-pale-wind-dunes-v3-20261116',
 terrainMaterial:'#eee0c9',
 duneBase:'#ddc6a5',
 duneHighlight:'#eee0be',
 wornStone:'#b4a48d',
 drySediment:'#c2b49d',
 warmLift:'#e7d9bd',
 warmLiftStrength:.09,
 // The authored photograph supplies most of the pigment; retain only a light
 // neutral vertex shade to preserve terrain height transitions.
 authoredSandVertex:'#ffffff',
 authoredSandVertexBlend:.76,
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
