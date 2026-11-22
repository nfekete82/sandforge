/** Static cinematic sunset preset. Render-only: terrain geometry, Fog of War,
 * gameplay visibility, AI and other biomes never change.
 *
 * Default on desert maps. Set ?lighting=day for the original midday
 * comparison. One directional shadow caster: no expensive new light passes.
 */
export const DESERT_GOLDEN_HOUR=Object.freeze({
 revision:'desert-golden-hour-pbr-v1',
 // 24-degree sun elevation gives long readable shadows without blocking HUD.
 sunOffset:Object.freeze([-920,490,680]),
 sunColor:'#ffcc94',
 sunIntensity:2.70,
 skyColor:'#ffe0b6',
 bounceColor:'#756675',
 hemisphereIntensity:1.34,
 fillColor:'#a9c2d8',
 fillIntensity:.54,
 // Golden airborne dust must not bleach out the black void outside the map.
 fogColor:'#30221a',
 fogDensity:.000055
});
export const desertGoldenHourEnabled=(biome,lighting)=>
 biome==='desert'&&lighting!=='day';
