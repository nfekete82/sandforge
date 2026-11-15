import * as THREE from 'three';

/** Model-locked desert materials for the single-storey Feldkommando.
 * The source GLB has neither UV coordinates nor image textures. Per-face UVs
 * are derived from SOURCE-LOCAL positions; moving construction ghosts cannot
 * shift camouflage. Source GLB, all other buildings and gameplay stay intact.
 */
export const LOWPOLY_HQ_DESERT_FINISH = 'lowpoly-hq-desert-camo-v1';

const swatches = Object.freeze({
  sand_wall: ['camo', '#ffffff', .95, 0],
  sand_brick: ['camo', '#ffffff', .94, 0],
  sand_base: ['stone', '#b39770', .96, 0],
  sand_trim: ['stone', '#dcc39b', .96, 0],
  sand_light: ['stone', '#cdb18a', .96, 0],
  sand_shade: ['stone', '#a88b66', .96, 0],
  concrete: ['stone', '#ae9270', .96, 0],
  concrete_light: ['stone', '#c3a884', .96, 0],
  roof_wood: ['roof', '#ffffff', .94, 0],
  roof_alt: ['roof', '#ffffff', .94, 0],
  roof_cap: ['roof', '#ffffff', .92, 0],
  roof_high: ['roof', '#ffffff', .92, 0],
  roof_line: [null, '#614c36', .84, .12],
  door_wood: ['door', '#ffffff', .91, 0],
  door_plank: ['door', '#ffffff', .91, 0],
  door_edge: [null, '#393c32', .72, .34],
  steel: [null, '#4c5044', .70, .40],
  metal_light: [null, '#817960', .78, .25],
  shadow: [null, '#35372d', .96, 0],
  dish_inner: [null, '#bca580', .77, .16],
  dish_outer: [null, '#827b65', .77, .23],
  green_dark: [null, '#3e4a2e', .92, 0],
  green: [null, '#566b3c', .90, 0],
  green_light: [null, '#7b8351', .90, 0],
  glass: [null, '#31545e', .26, .16],
  glass_light: [null, '#507987', .25, .12],
  glass_dark: [null, '#213b42', .25, .16]
});

const repeat = (n, length) => ((n % length) + length) % length;
const hash = (x, y, seed) => {
  let h = Math.imul(x + seed * 17, 374761393) + Math.imul(y - seed * 19, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = x => x * x * (3 - 2 * x);
function periodicNoise(x, y, period, seed) {
  const ax = Math.floor(x), ay = Math.floor(y), tx = smooth(x - ax), ty = smooth(y - ay);
  const a = hash(repeat(ax, period), repeat(ay, period), seed);
  const b = hash(repeat(ax + 1, period), repeat(ay, period), seed);
  const c = hash(repeat(ax, period), repeat(ay + 1, period), seed);
  const d = hash(repeat(ax + 1, period), repeat(ay + 1, period), seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const camoColors = ['#c9aa78', '#b79565', '#94764f', '#77734a', '#b5a080'].map(rgb);
const clamp255 = n => Math.max(0, Math.min(255, Math.round(n)));
const textures = new Map();

/** Four deterministic 256x256 tileable sRGB PBR color atlases. */
export function lowpolyHqTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  if (!['camo', 'stone', 'roof', 'door'].includes(kind)) return null;
  const size = 256, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const coarse = periodicNoise(u * 6, v * 6, 6, 11);
    const medium = periodicNoise(u * 14, v * 14, 14, 29);
    const fine = periodicNoise(u * 44, v * 44, 44, 41);
    const speck = hash(x, y, 51) - .5;
    let base, variation;
    if (kind === 'camo') {
      const patches = coarse * .70 + medium * .25 + fine * .05;
      const index = patches > .685 ? 3 : patches > .565 ? 2 : patches < .31 ? 0 :
        patches < .39 ? 4 : 1;
      base = camoColors[index];
      variation = (fine - .5) * 21 + speck * 12;
    } else if (kind === 'stone') {
      base = [217, 188, 146];
      variation = (coarse - .5) * 25 + (fine - .5) * 17 + speck * 13;
      if (fine > .83) variation -= 14;
    } else {
      const grainAxis = kind === 'roof' ? v : u;
      const stripes = Math.sin(grainAxis * 92 + 4.5 * coarse + 2.0 * medium);
      base = kind === 'roof' ? [153, 111, 73] : [114, 76, 48];
      variation = stripes * 9 + (coarse - .5) * 25 + speck * 8;
    }
    const i = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++)
      pixels[i + channel] = clamp255(base[channel] + variation);
    pixels[i + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.name = 'SF_HQ_' + kind + '_model_locked';
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  map.needsUpdate = true;
  textures.set(kind, map);
  return map;
}

/** Per-face local UVs. Duplicating box corners prevents side/roof UV seams. */
function supplyFixedLocalUV(mesh, kind) {
  const original = mesh.geometry;
  if (!original?.getAttribute('position')) return;
  const geometry = original.index ? original.toNonIndexed() : original.clone();
  const pos = geometry.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const tileMetres = { camo: 6.2, stone: 2.8, roof: 2.1, door: 2.0 }[kind];
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    const normal = new THREE.Vector3().subVectors(b, a).cross(
      new THREE.Vector3().subVectors(c, a)).normalize();
    const horizontal = kind === 'roof' || Math.abs(normal.y) > .55;
    const sideX = Math.abs(normal.x) > Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
      uv[j * 2] = (horizontal ? x : sideX ? z : x) / tileMetres;
      uv[j * 2 + 1] = (horizontal ? z : y) / tileMetres;
    }
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  mesh.geometry = geometry;
}

/** Idempotent HQ-only processing for battlefield, building preview, HUD and gallery. */
export function applyLowpolyFeldkommandoFinish(root) {
  if (!root?.getObjectByName?.('Gate_Left_Pivot') ||
      !root.getObjectByName('Radar_Pivot') || root.userData?.sfLowpolyDesertFinish) return false;
  const materialCache = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const style = source => {
      if (!source?.isMeshStandardMaterial) return source;
      if (materialCache.has(source)) return materialCache.get(source);
      const recipe = swatches[source.name];
      if (!recipe) { materialCache.set(source, source); return source; }
      const [mapKind, color, roughness, metalness] = recipe;
      const material = source.clone();
      material.color.set(color);
      material.roughness = roughness;
      material.metalness = metalness;
      material.emissive.set('#000000');
      material.emissiveIntensity = 0;
      if (mapKind) material.map = lowpolyHqTexture(mapKind);
      material.userData = { ...material.userData,
        sandforgeLowpolyHQFinish: LOWPOLY_HQ_DESERT_FINISH,
        sandforgePreserveHQDesertTextures: true };
      material.needsUpdate = true;
      materialCache.set(source, material);
      return material;
    };
    const source = mesh.material;
    mesh.material = Array.isArray(source) ? source.map(style) : style(source);
    const mapKind = (Array.isArray(source) ? source : [source])
      .map(s => swatches[s?.name]?.[0]).find(Boolean);
    if (mapKind) supplyFixedLocalUV(mesh, mapKind);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  root.userData = {...root.userData, sfLowpolyDesertFinish: LOWPOLY_HQ_DESERT_FINISH};
  return true;
}
