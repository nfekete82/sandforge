import { RULES } from './config.js';

export type UnitKind='infantry'|'medic'|'engineer'|'heavy'|'rocket'|'rover'|'supply'|'tank'|'flamer'|'artillery'|'scout'|'bomber'|'drone';
export type BuildingKind='headquarters'|'barracks'|'factory'|'airfield'|'generator'|'turret'|'research'|'silo'|'interceptor'|'wall'|'wallGate'|'bunker';
/** Both factions may operate the same maximum number of recurring-income generators. */
export const MAX_GENERATORS_PER_FACTION=3;
export interface UnitSpec {
  name:string; group:'Infanterie'|'Fahrzeuge'|'Luftunterstützung'; cost:number; buildTime:number;
  hp:number; speed:number; sight:number; range:number; damage:number; cooldown:number; radius:number;
  producers:readonly BuildingKind[]; targetsAir?:boolean; flying:boolean; width:number; description:string;
}
const foot={...RULES.infantry,group:'Infanterie' as const,flying:false,width:38,producers:['barracks'] as readonly BuildingKind[]};
export const UNITS:Record<UnitKind,UnitSpec>={
 infantry:{...foot,name:'Infanteriesoldat',description:'Vielseitiger Schütze. Sichert Bastionen und hält die Front.'},
 medic:{...foot,name:'Sanitäter',cost:175,buildTime:8,hp:100,damage:4,range:110,cooldown:1.8,speed:105,description:'Versorgt eigene Infanterie im Umkreis von 70 M mit zusammen 12 LP/s. Langsame Selbstheilung nach einer Feuerpause.'},
 engineer:{...foot,producers:['headquarters'],name:'Pionier',cost:200,buildTime:7,hp:110,damage:8,range:145,cooldown:1.3,speed:105,description:'Pionier mit Schraubenschlüssel für Bau und Reparatur sowie einer leichten Pistole zur Selbstverteidigung. Repariert Fahrzeuge im Umkreis von 90 M mit 18 LP/s und Anlagen per Rechtsklick.'},
 heavy:{...foot,name:'Schwere Infanterie',cost:300,buildTime:9,hp:420,speed:78,damage:120,range:220,cooldown:1.15,width:44,producers:['barracks'],description:'Überlegener Infanteriekämpfer mit 420 LP und schwerem automatischem Gewehr. Gegen Panzerung verringerter Schaden.'},
 rocket:{...foot,name:'Raketenwerfer-Soldat',cost:375,buildTime:16,hp:110,speed:92,sight:465,range:365,damage:145,cooldown:4.1,radius:11,width:40,targetsAir:true,producers:['barracks'],description:'Getarnter Panzer- und Flugabwehrschütze mit gelenkter Schulterrakete. Stark gegen einzelne Fahrzeuge und Luftziele, aber langsame Nachladezeit, geringer Flächenschaden, verwundbar gegen MG und schwach gegen Infanterie.'},
 // Legacy kind retained for old-save validation, no active producer and no UI.
 supply:{name:'Nachschubtransporter (Legacy)',group:'Fahrzeuge',cost:275,buildTime:12,hp:260,speed:175,sight:310,range:0,damage:0,cooldown:1,radius:19,width:76,producers:[],flying:false,description:'Eingestellte Einheit; beim Laden alter Spielstände erstattet.'},
 rover:{name:'Humvee',group:'Fahrzeuge',cost:350,buildTime:11,hp:295,speed:235,sight:465,range:240,damage:13,cooldown:.68,radius:18,width:76,producers:['factory'],flying:false,description:'Schneller Humvee mit schwerem Dach-MG, animierten Geländereifen und vier Sitzplätzen. Eigene Infanterie per Rechtsklick einladen und am Ziel ausladen.'},
 tank:{name:'Kampfpanzer',group:'Fahrzeuge',cost:550,buildTime:18,hp:1000,speed:80,sight:390,range:300,damage:155,cooldown:2.35,targetsAir:false,radius:22,width:90,producers:['factory'],flying:false,description:'Schwerer Kampfpanzer mit 1.000 LP: gelenkte Panzerabwehrraketen gegen Fahrzeuge und Gebäude (300 M), unabhängiges starkes Dach-MG gegen Infanterie. Widerstandsfähig gegen normale Gewehre.'},
 flamer:{name:'Flammenpanzer',group:'Fahrzeuge',cost:500,buildTime:16,hp:760,speed:96,sight:345,range:160,damage:18,cooldown:.29,targetsAir:false,radius:21,width:90,producers:['factory'],flying:false,description:'Gepanzerter Nahkampf-Flammenpanzer. Verheerend gegen Infanterie und ungeschützte Gebäude auf kurze Distanz; schwach gegen Kampfpanzer und Luftziele.'},
 artillery:{name:'Raketenwerfer',group:'Fahrzeuge',cost:600,buildTime:18,hp:340,speed:65,sight:RULES.turret.sight+80,range:RULES.turret.range+80,damage:120,cooldown:3.8,targetsAir:false,radius:20,width:94,producers:['factory'],flying:false,description:'Schwerer 6×6-Raketenwerfer mit sechs Werferrohren. 680 M Reichweite und 830 M Sicht: bekämpft Bodenziele außerhalb der Turmreichweite.'},
 drone:{name:'R-01 Aufklärungsdrohne',group:'Luftunterstützung',cost:50,buildTime:4,hp:35,speed:680,sight:1120,range:0,damage:0,cooldown:1,radius:8,width:40,producers:['headquarters'],flying:true,description:'Extrem schnelle und günstige unbewaffnete Aufklärungsdrohne. Enthüllt große Bereiche der Karte; sehr zerbrechlich, kann keine Bastionen erobern.'},
 scout:{name:'Transporthelikopter',group:'Luftunterstützung',cost:600,buildTime:14,hp:360,speed:280,sight:780,range:225,damage:24,cooldown:.6,radius:20,width:106,producers:['airfield'],flying:true,description:'Schneller Transporthelikopter für zehn Infanteristen. Stärkeres defensives MG gegen Infanterie plus sechs leichte, einzeln abgefeuerte Selbstverteidigungsraketen (9 s Abstand). Raketen am Flugfeld für Credits nachladen. Einsteigen und Ausladen per Befehl.'},
 bomber:{name:'Bomber',group:'Luftunterstützung',cost:1000,buildTime:24,hp:700,speed:350,sight:680,range:300,damage:135,cooldown:4.8,targetsAir:false,radius:24,width:107,producers:['airfield'],flying:true,description:'Schneller Bomber: Anflug aufs Ziel, Bombe abwerfen und weiter Ausholbogen für den nächsten Angriff. Ohne Auftrag große Patrouillenkreise.'},
};
export interface BuildingSpec {name:string;cost:number;buildTime:number;hp:number;sight:number;radius:number;width:number;income:number;description:string}
export const BUILDINGS:Record<BuildingKind,BuildingSpec>={
 headquarters:{...RULES.headquarters,name:'Kommandozentrale',cost:300,buildTime:20,width:225,income:10,description:'Hauptquartier der Blauen Legion. Bildet Pioniere und R-01 Aufklärungsdrohnen aus und liefert 10 Credits alle 10 Sekunden. Die Heimat-Bastion liefert 50 Credits, weitere Bastionen 15 bis 35 Credits je Intervall.'},
 barracks:{name:'Kaserne',cost:200,buildTime:12,hp:800,sight:300,radius:53,width:158,income:0,description:'Bildet Infanterie, Sanitäter, schwere Infanterie und Raketenwerfer-Soldaten aus.'},
 factory:{name:'Fahrzeugfabrik',cost:350,buildTime:18,hp:1100,sight:310,radius:70,width:200,income:0,description:'Kompakte Fahrzeugfabrik für Humvees, Kampfpanzer, Flammenpanzer und Raketenwerfer. Beschädigte Fahrzeuge werden ausschließlich durch Pioniere direkt auf dem Schlachtfeld repariert.'},
 airfield:{name:'Flugfeld',cost:450,buildTime:22,hp:1200,sight:410,radius:91,width:218,income:0,description:'Kleines Feldflugfeld: ein Hangar links, kurze Landebahn direkt rechts und ein kleiner Tower. Bomber und Transporthelikopter können dort landen und für Credits reparieren.'},
 generator:{name:'Energiekern',cost:150,buildTime:9,hp:500,sight:230,radius:38,width:112,income:10,description:'Versorgt die Basis und liefert zusätzliche 10 Credits alle 10 Sekunden.'},
 wall:{name:'Sperrmauer',cost:75,buildTime:8,hp:750,sight:80,radius:24,width:108,income:0,description:'Massive, drehbare Betonsperre. Blockiert Infanterie und Fahrzeuge. Gegen Raketen und Panzerbeschuss zerstörbar.'},
 wallGate:{name:'Doppelt breites Stahltor',cost:210,buildTime:12,hp:900,sight:80,radius:24,width:218,income:0,description:'Stahl-Doppeltor in der Breite von zwei normalen Mauersegmenten. Eigene Einheiten passieren automatisch; Feinde werden blockiert. Alternativ zwei fertige eigene Sperrmauern für 60 Credits nachträglich umrüsten.'},
 bunker:{name:'Verteidigungsbunker',cost:650,buildTime:27,hp:1500,sight:470,radius:54,width:155,income:0,description:'Massiver PBR-Bunker mit fünf geschützten Infanterieplätzen. Eigene Soldaten per Rechtsklick einquartieren; sie feuern aus Schießscharten. Bei Zerstörung stirbt die gesamte Besatzung. Zum Verlassen Bunker anklicken und AUSSTEIGEN wählen.'},
 turret:{name:'Geschützturm',cost:300,buildTime:10,hp:650,sight:RULES.turret.sight,radius:30,width:72,income:0,description:`Automatische Fernverteidigung. ${RULES.turret.range} M Reichweite, ${RULES.turret.sight} M Sicht, ${RULES.turret.damage} Schaden.`},
 research:{name:'Forschungszentrum',cost:700,buildTime:48,hp:950,sight:350,radius:54,width:170,income:0,description:'Größeres Forschungszentrum mit Sand-Oliv-Tarnung, Radar, Sensoranlage und Dachtechnik. Erforscht neun Technologien in 35–90 Sekunden.'},
 silo:{name:'Langstrecken-Raketensilo',cost:5000,buildTime:100,hp:1900,sight:360,radius:91,width:265,income:0,description:'Strategische Rakete: 10 Minuten Ladezeit, 25 Sekunden Angriffswarnung und großer Einschlag. Maximal ein Silo pro Fraktion.'},
 interceptor:{name:'Raketenabwehr',cost:2500,buildTime:62,hp:1150,sight:420,radius:56,width:172,income:0,description:'Fängt strategische Langstreckenraketen im Umkreis von 920 M ab. Drei Abwehrraketen, danach für 650 Credits nachladen.'},
};
export const unitSpec=(u:{kind?:UnitKind}):UnitSpec=>UNITS[u.kind??'infantry'];
export const buildingSpec=(b:{kind?:BuildingKind}):BuildingSpec=>BUILDINGS[b.kind??'headquarters'];
export const unitKinds=Object.keys(UNITS).filter(kind=>kind!=='supply') as UnitKind[];
export const buildingKinds=Object.keys(BUILDINGS) as BuildingKind[];

export const canAttack=(u:{kind?:UnitKind},target:{kind?:UnitKind|BuildingKind;queue?:unknown}):boolean=>u.kind!=='drone'&&('queue' in target||unitSpec(u).targetsAir!==false||!unitSpec(target as {kind?:UnitKind}).flying);
/** Balanced separately from the anti-armor main gun; both are independent weapon clocks. */
export const TANK_MG={damage:18,cooldown:.55,range:230} as const;
/** Conventional small arms and roof MGs still excel against infantry.
 * Aircraft damage is 25% higher than the previous overly weak coefficients;
 * ground-armor, structure and specialist anti-air rocket tuning is unchanged. */
export const SMALL_ARMS_VS_ARMOR=Object.freeze({
 infantry:.16,medic:.12,engineer:.12,heavy:.20,rover:.17,scout:.18
});
export const SMALL_ARMS_VS_AIR=Object.freeze({
 infantry:.10,medic:.0875,engineer:.0875,heavy:.125,rover:.1125,scout:.15
});
export const weaponDamage=(u:{kind?:UnitKind},target:{kind?:UnitKind|BuildingKind;queue?:unknown}):number=>{
 const base=unitSpec(u).damage,building='queue' in target;
 const kind=u.kind??'infantry';
 if(kind==='flamer'){
  if(building)return base*.40;
  const enemy=unitSpec(target as {kind?:UnitKind});
  return base*(enemy.flying?0:enemy.group==='Fahrzeuge'?.18:1);
 }
 if(building&&(target.kind==='wall'||target.kind==='wallGate'))return base*(kind==='rocket'?1.35:kind==='artillery'?1.25:kind==='tank'?1:kind==='flamer'?.32:kind==='heavy'?.22:kind==='rover'?.16:.10);
 if(!building){
  const defender=unitSpec(target as {kind?:UnitKind});
  if(defender.flying&&kind in SMALL_ARMS_VS_AIR)
   return base*SMALL_ARMS_VS_AIR[kind as keyof typeof SMALL_ARMS_VS_AIR];
  if(defender.group==='Fahrzeuge'&&kind in SMALL_ARMS_VS_ARMOR)
   return base*SMALL_ARMS_VS_ARMOR[kind as keyof typeof SMALL_ARMS_VS_ARMOR];
 }
 // Maintain existing heavy-gun vs structure tuning and guided anti-armor
 // specialist strengths. Tank MG exclusively targets infantry.
 // Elite infantry is still tough and strong against foot soldiers, but
 // its 120-point burst used to delete a 100-HP rifleman instantly while the
 // 420-HP attacker survived several squads. Two landed volleys now matter.
 // Do not weaken its separately tuned armor, aircraft or building damage.
 return base*(kind==='heavy'&&building?.45:
  kind==='heavy'&&unitSpec(target as {kind?:UnitKind}).group==='Infanterie'?.75:
  kind==='rover'&&building?.35:
  kind==='rocket'&&building?.7:
  kind==='rocket'&&unitSpec(target as {kind?:UnitKind}).group==='Infanterie'?.10:
  kind==='rocket'&&unitSpec(target as {kind?:UnitKind}).flying?1.2:1);
};
/** Expected sustained DPS for a valid single target (before veteran bonuses).
 * Tank main gun intentionally does NOT fire at infantry; its MG does.
 */
export const combatDpsAgainst=(u:{kind?:UnitKind},target:{kind?:UnitKind|BuildingKind;queue?:unknown}):number=>
 u.kind==='tank'&& !('queue' in target)&&unitSpec(target as {kind?:UnitKind}).group==='Infanterie'
  ? TANK_MG.damage/TANK_MG.cooldown
  : weaponDamage(u,target)/unitSpec(u).cooldown;
