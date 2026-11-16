/** Single source of truth for painted team-identification colours.
 * Identical sRGB values are used by the GLB exporter, the battlefield,
 * HDR-independent flags/roof stripes, mini-map and HUD portraits.
 * Sand/khaki camouflage, neutral capture points and semantic UI colours
 * (health, orders, warning lights) deliberately stay independent.
 */
export const FACTION_BLUE='#2c6799';
export const FACTION_RED='#a64b43';
export const FACTION_PAINT=Object.freeze({0:FACTION_BLUE,1:FACTION_RED});
export function factionPaint(owner){return FACTION_PAINT[owner]??null;}
export function factionRgb8(owner){
 const hex=factionPaint(owner);
 if(!hex)return null;
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}
