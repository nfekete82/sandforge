# Feldkommando – Single-storey low-poly model (15 November 2026)

**Canonical active GLB (in repo):**
`src/assets/reborn/buildings-3d/sandforge_feldkommando_lowpoly_1geschoss.glb`

- Source is the one-floor desert HQ concept model approved in ChatGPT.
- 98,228 bytes, **3,842 triangles**, GLB 2.0, solid PBR material swatches
- Source SHA-256: `9510d83548e798a3daf42e139a5984255b33088ccda3cda7d761b1b920dea3b9`
- Single front entrance facing **+Z**, with two separate swinging door leaves
- Separate radar pivot, team banners, and roof flag
- No projected camouflage shader and no texture maps to swim as the building preview moves
- Animated by existing gameplay presenter: gate when pioneer exits, radar while operational
- Built-in / runtime-cloned cloth takes blue or red team color without repainting the roof or walls

## Routing and gameplay

`scripts/webgl-strategic-glb.js` maps both `headquarters.active` and
`headquarters.inactive` to this **one** GLB. The build ghost, the
completed gameplay structure and the HUD 3D thumbnail use that route.

`scripts/webgl-production-gates.js` uses `Gate_Left_Pivot` and
`Gate_Right_Pivot` and rotates their Y axes when the pioneer is released.
`finalHeadquartersExitRoute` routes the visible actor outside the real
15 × 11 meter envelope before turning behind the building.
The simulation owns spawning and unit state: no second actor or extra
entrance is generated.

`scripts/webgl-battlefield.js` rotates the authored `Radar_Pivot`.
No duplicate generated satellite, duplicate perimeter or scaffold poles.
The model has flat static materials, so `webgl-final-hq-finish.js`'s
former textured-HQ finishing pipeline is intentionally not applied.

`scripts/webgl-faction-accents.js` recolors only embedded flag/banner cloth,
not structural materials. Additional old oversized facade banners are skipped.

The Kaserne, Bastion, research, and legacy prototype assets stay untouched.
Old source GLBs are retained only for historical tests and fallback.

## Validate

```sh
npm ci
npm run build:3d
node --test tests/webgl-final-feldkommando.test.mjs \
  tests/webgl-production-gates.test.mjs \
  tests/webgl-feldkommando-mk2.test.mjs
PORT=8107 npm run dev
```

In a live 3D match, verify ghost = built HQ = HUD card, every rotated
placement, door opening and pioneer exit, radar rotation, team colors,
and stable materials while dragging the ghost. CI does not replace this
visual gameplay review.

This branch is the existing PR #294 against `develop`; do not merge
unless checks and a game/browser visual pass confirm the result.
