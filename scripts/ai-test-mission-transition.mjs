/**
 * Benchmark-only classification. A live 3D army can switch between the HQ
 * and a blocking turret in the SAME sector without cancelling its active
 * battle. Call it a retarget, never an abort. True regroup, unit collapse,
 * different-sector missions and new battle waves remain actual aborts.
 */
export function classifyMissionTransition(previous,next){
 if(!previous||!next)return 'aborted';
 return next.phase==='attack'&&
  next.groupId===previous.groupId&&
  next.target===previous.target&&
  next.objective!==previous.objective
   ?'retargeted':'aborted';
}
