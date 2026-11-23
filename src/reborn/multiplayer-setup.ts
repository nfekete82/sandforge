/**
 * Multiplayer setup contract, independent of the currently two-sided engine.
 *
 * IMPORTANT: This is a pure, tested LOBBY/SPAWN PLANNER – NOT multiplayer
 * simulation support. The game must not expose these options until
 * Simulation, fog, AI instances, victory and saves accept 3/4 factions.
 *
 * Stable 1v1 data stays byte-for-byte compatible with campaignLayout.
 * Only public map layout, player count and the supplied seed are read.
 */
import {campaignLayout,mapLayout,type MapVersion} from './config.js';

export type PlayerCount=2|3|4;
export type MatchMode='free-for-all'|'two-versus-two';
export type PlayerId=0|1|2|3;
export type TeamId=0|1|2|3;
export interface MatchSlot {
 player:PlayerId;
 controller:'human'|'ai';
 team:TeamId;
 startSector:number;
}
export interface MatchSetup {
 version:MapVersion;
 seed:number;
 playerCount:PlayerCount;
 mode:MatchMode;
 slots:readonly MatchSlot[];
}

/** All maps with four public start corners. Two-sided historical maps can
 * always be played 1v1; >=3 players are limited to the modern 8+ Bastion
 * maps until those actual fields are supported by the simulation. */
export function multiplayerStartSupported(version:MapVersion):boolean{
 return version>=24&&version<=26;
}
function validateSeed(seed:number):void{
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)
  throw Error('Multiplayer seed must be a 32-bit unsigned integer');
}
function rotated<T>(values:readonly T[],shift:number):T[]{
 return values.map((_,i)=>values[(i+shift)%values.length]);
}
function cornerSectors(columns:number,rows:number):[number,number,number,number]{
 const last=columns*rows-1;
 // Clockwise corners: NW, NE, SE, SW.
 return [0,columns-1,last,columns*(rows-1)];
}
export function planMultiplayerSetup(options:{
 version:MapVersion;seed:number;
 playerCount:PlayerCount;mode?:MatchMode
}):MatchSetup{
 const {version,seed,playerCount}=options,mode=options.mode??'free-for-all';
 validateSeed(seed);
 if(![2,3,4].includes(playerCount))
  throw Error('Supported human + AI match sizes are 2, 3 and 4 players');
 if(mode!=='free-for-all'&&mode!=='two-versus-two')
  throw Error('Unknown team mode');
 if(mode==='two-versus-two'&&playerCount!==4)
  throw Error('2v2 requires exactly 4 players');
 if(playerCount>2&&!multiplayerStartSupported(version))
  throw Error('3-4 players require an 8, 12 or 16 Bastion modern battlefield');
 const layout=campaignLayout(version,seed);
 if(playerCount===2){
  return {version,seed,playerCount,mode,
   slots:layout.headquarters.map((startSector,player)=>({
    player:player as PlayerId,controller:player===0?'human' as const:'ai' as const,
    team:player as TeamId,startSector
   }))};
 }
 const {columns,rows}=mapLayout(version);
 const corners=cornerSectors(columns,rows);
 // Deterministic rotation of the starting compass; opening two-sided
 // orientation remains strictly untouched. 3 players use 3 distinct corners.
 const orientation=((seed>>>0)^(seed>>>8)^(seed>>>16))&3;
 const selected=rotated(corners,orientation);
 let sectors:number[];
 let teams:TeamId[];
 if(mode==='two-versus-two'){
  // Four-column desert maps are often much wider than they are high.
  // Put teammates on the SAME short west/east edge, not across the long
  // north/south side. Seed only swaps the two sides or player order.
  const west=[corners[0],corners[3]];
  const east=[corners[1],corners[2]];
  const first=orientation>=2?east:west;
  const second=orientation>=2?west:east;
  sectors=orientation%2===0?
   [...first,...second]:[first[1],first[0],second[1],second[0]];
  teams=[0,0,1,1];
 }else if(playerCount===3){
  // Spread the three controllers over three different distant corners.
  sectors=[selected[0],selected[2],selected[1]];
  teams=[0,1,2];
 }else{
  sectors=[selected[0],selected[2],selected[1],selected[3]];
  teams=[0,1,2,3];
 }
 const slots=sectors.map((startSector,player)=>({
  player:player as PlayerId,
  controller:player===0?'human' as const:'ai' as const,
  team:teams[player],
  startSector
 }));
 if(new Set(sectors).size!==playerCount)
  throw Error('Multiplayer start locations must be unique');
 return {version,seed,playerCount,mode,slots};
}

/** Only team membership grants friendly fire immunity or shared victory.
 * A player must never be assumed allied just because the map is FFA. */
export function areTeammates(setup:MatchSetup,a:PlayerId,b:PlayerId):boolean{
 const first=setup.slots.find(s=>s.player===a);
 const second=setup.slots.find(s=>s.player===b);
 if(!first||!second)throw Error('Unknown player slot');
 return first.team===second.team;
}
