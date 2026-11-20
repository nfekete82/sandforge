import type {TerrainProfile,BattlefieldGeneratorVersion} from './battlefield-terrain.js';
import type {LandscapeKind} from './landscape-network.js';
import type {MapVersion} from './config.js';

/** Offline A/B-calibrated tactical doctrine for ONLY the four fixed
 * desert maps. Match the entire public map identity, never opponent data
 * or fogged unit positions. A modified/custom map inherits normal AI.
 * This is deterministic scenario tuning, NOT online learning.
 */
export interface DesertAIDoctrineMap {
 id:'desert-strike'|'broken-empire'|'burning-horizon'|'last-stronghold';
 seed:number;mapVersion:MapVersion;profile:TerrainProfile;
 kind:LandscapeKind;generatorVersion:BattlefieldGeneratorVersion;
 mode:'off'|'coordinated';
}
export const DESERT_AI_DOCTRINES:readonly DesertAIDoctrineMap[]=Object.freeze([
 Object.freeze({
  id:'desert-strike',seed:9999,mapVersion:24,profile:'oasis',
  kind:'open-basin',generatorVersion:5,mode:'off'
 }),
 Object.freeze({
  id:'broken-empire',seed:2026,mapVersion:25,profile:'rocky',
  kind:'broken-escarpment',generatorVersion:5,mode:'coordinated'
 }),
 Object.freeze({
  id:'burning-horizon',seed:1907,mapVersion:26,profile:'dunes',
  kind:'diagonal-ridge',generatorVersion:5,mode:'coordinated'
 }),
 Object.freeze({
  id:'last-stronghold',seed:314159,mapVersion:26,profile:'mixed',
  kind:'serpentine-canyon',generatorVersion:5,mode:'off'
 })
]);
export function selectDesertAIDoctrine(x:{
 seed:number;mapVersion:MapVersion;profile:TerrainProfile|undefined;
 kind:LandscapeKind|undefined;generatorVersion:BattlefieldGeneratorVersion;
}):DesertAIDoctrineMap|null{
 return DESERT_AI_DOCTRINES.find(p=>p.seed===x.seed&&
  p.mapVersion===x.mapVersion&&p.profile===x.profile&&
  p.kind===x.kind&&p.generatorVersion===x.generatorVersion)??null;
}
