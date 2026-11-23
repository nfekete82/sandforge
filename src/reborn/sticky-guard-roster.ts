/** Stable allocation of already PAID garrison members.
 * The ranked candidates are derived from the current real fighters and
 * visible defensive needs. Existing eligible guards keep their mission
 * instead of being replaced just because they walked away from home.
 * There are no hidden opponents, new units, serialized fields or timers.
 */
export function stickyGuardRoster(
 rankedEligible:readonly number[],previous:ReadonlySet<number>,requested:number
):Set<number>{
 const unique=[...new Set(rankedEligible)];
 const goal=Math.max(0,Math.min(unique.length,Math.floor(requested)||0));
 return new Set([
  ...unique.filter(id=>previous.has(id)),
  ...unique.filter(id=>!previous.has(id))
 ].slice(0,goal));
}
