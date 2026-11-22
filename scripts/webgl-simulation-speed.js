/** Real-time WebGL presentation stays at display refresh rate. Only the
 * authoritative fixed 50 ms simulation ticks are multiplied by game speed.
 * This preserves determinism, AI cadence, projectile collision and saves.
 *
 * Under severe frame drops, bounded catch-up deliberately favors stable
 * rendering over an unbounded physics spike. At 60 FPS x4 is 80 ticks/sec.
 */
export const SIMULATION_SPEEDS=Object.freeze([1,2,4]);
export const FIXED_GAME_TICK=.05;
export function normalizeSimulationSpeed(value){
 const number=Number(value);
 return SIMULATION_SPEEDS.includes(number)?number:1;
}
/** Pure budget computation; the caller runs each authoritative 50ms tick. */
export function simulationFrameBudget(accumulator,realDt,speed){
 const scale=normalizeSimulationSpeed(speed);
 const dt=Math.max(0,Math.min(.08,Number.isFinite(realDt)?realDt:0));
 const pending=Math.max(0,Math.min(
  (Number.isFinite(accumulator)?Math.max(0,accumulator):0)+dt*scale,
  Math.min(.65,scale*.2)));
 const maxSteps=Math.min(12,4*scale);
 const steps=Math.min(maxSteps,Math.floor((pending+1e-9)/FIXED_GAME_TICK));
 const remainder=Math.max(0,pending-steps*FIXED_GAME_TICK);
 return {steps,accumulator:remainder,visualDt:dt*scale,
  simulationDelta:steps*FIXED_GAME_TICK};
}
