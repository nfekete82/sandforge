/**
 * Single source of truth for visual hit points in the optional 3D renderer.
 * Uses the same authoritative HP / catalog maximum as classic Sandforge.
 * Neither function mutates simulation data.
 */
export const healthFraction=(hp,maxHp)=>{
 const value=Number(hp),max=Number(maxHp);
 if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return 0;
 return Math.min(1,Math.max(0,value/max));
};
export const healthColor=fraction=>{
 const f=Math.min(1,Math.max(0,Number(fraction)||0));
 return f>.7?'#24e568':f>.4?'#f6d44b':f>.2?'#f29a36':'#ed5146';
};


/** Non-intrusive RTS HP visibility. Fog/occlusion is handled by the scene
 * before this pure render policy; a hidden enemy must never leak its bar.
 * 'all' remains an explicit player override and does not change gameplay.
 */
export function showHealthBar({mode='smart',visible=true,selected=false,
 fraction=1,combatActive=false}={}){
 if(!visible)return false;
 if(mode==='off')return false;
 if(mode==='all')return true;
 if(mode==='selected')return !!selected;
 if(mode==='damaged')return !!selected||fraction<.999;
 // Default: do not flood a fully healthy marching army with blue/green bars.
 return !!selected||fraction<.999||!!combatActive;
}
