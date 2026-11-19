/**
 * KI3.6 micro policy for an already launched, paid offensive.
 * Never interpret cumulative historical reinforcements as soldiers that
 * must all remain alive in the same assault: that inflated launchSize can
 * force a pointless full-column recall after a successful fight.
 *
 * Hold only a REAL surviving combat screen. No invisible enemy knowledge,
 * extra units or changes to losses, credits, physics or save data.
 */
export function preserveAI36Assault(input:{
 survivingGround:number; healthyGround:number; armedGround:number;
 currentlyFighting:boolean; visibleGunPosition:boolean;
 availableSiege:number; nearbyPaidReinforcements:number;
}):boolean{
 const x=input;
 if(x.survivingGround<3||x.healthyGround<2)return false;
 if(x.armedGround===0&&x.survivingGround<5)return false;
 // Never hold unsupported riflemen against a known fortified turret.
 if(x.visibleGunPosition&&x.availableSiege===0)return false;
 // Need either ongoing contact, a credible own heavy screen, or actual
 // reinforcements already near the front. Not a remote purchase order.
 return x.currentlyFighting&&x.armedGround>=1||
   x.armedGround>=2||
   x.nearbyPaidReinforcements>=2;
}

/** Reinforcements can join a moving battle before its army-sized staging
 * position is reached, but only if they are physically nearby, healthy and
 * belong to a real currently committed formation. This affects no saves.
 */
export function ai36JoinActiveFront(input:{
 distance:number;hpFraction:number;isGroundCombatant:boolean;
 frontInContact:boolean;frontSize:number;knownGunPresent:boolean;
}):boolean{
 const x=input;
 if(!x.isGroundCombatant||x.hpFraction<.35||x.frontSize<2)return false;
 // Preserve old 330m proximity rule outside observed firefights. While
 // fighting, let a paid reinforcement attach within 440m so it attacks
 // instead of circling the staging marker three more seconds.
 const radius=x.frontInContact&&!x.knownGunPresent?440:330;
 return x.distance<radius;
}
