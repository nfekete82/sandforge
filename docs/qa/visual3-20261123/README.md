# Smart LOD / optional Visual 3.0 — 23 November 2026

## Result and scope

Render-only branch based on current remote `main`, `85f46f68720d711a75cb556593434b5597e15bd3`.
The original checkout and its thirteen uncommitted GLBs were not modified.
Build-generated GLBs in the isolated worktree were restored after testing;
no model binaries, simulation, AI, pathfinding, collisions or saves are changed.

- Smart LOD preserves original geometry near the camera. It clusters existing
  vertices once at asset load, retaining original UV/normal attributes, material
  groups and PBR materials. Instances, transforms and textures are shared.
  Whole-batch geometry swaps add **zero draw calls**. A 200 ms update period,
  64/32 CSS-pixel thresholds and 15% hysteresis avoid zoom oscillation. The
  orthographic camera uses projected size, not its misleading dolly distance;
  a conservative nearest-batch bound supports perspective cameras too.
- Only decorative sandstone, legacy scatter/wash stones and eligible village
  parts register. Every eligible material must have albedo, normal and roughness
  maps. Sparse/unsuitable geometry stays original. Palms, cacti, units, buildings,
  important silhouettes, cliffs, plateau meshes and ramps are not simplified.
  Village batches now use their already computed instanced frustum bounds.
- Optional post: linear HDR scene/depth, explicitly selected light mask sharing
  scene depth, two quarter-size separable blurs, combined four-pair depth AO,
  edge-directed AA, neutral grade and output. No normal render pass, luminance
  selection of bright sand, extra gamma correction or PBR shader repainting.
  ACES/exposure and sRGB run once at output. Existing construction overlay stays
  last; selection still raycasts the original scene. The original fog alpha
  also blacks out the bloom mask. Render targets survive toggles and zoom;
  only canvas/DPR resizing resizes targets. Failures fall back to direct rendering.
- Full postprocessing is **opt-in (`post=1`)** because the measured medium-army
  cost below is too high for a default. Lite mode bypasses it. Default LOD and
  culling still operate when post is off.
- Reuses the reviewed #467 adaptive controller, its fixed 90-frame samples,
  slow restore and two persistent, shadow-free explosion lights. The light
  visibility check is corrected for orthographic RTS cameras. No battle-time
  light/material/geometry/texture creation was added. Existing particle pools
  are retained. Critical flashes, sparks, flames and selection remain intact.

Quality reduction order: full post → AA/grade only → direct rendering →
25% fewer secondary particles → 50% fewer → decorative LOD/shadow budget →
85% resolution → 72% resolution. Sustained >24 ms samples require two evaluations
and a 5 s cooldown. Recovery requires five <17 ms evaluations and 12 s. Paused,
hidden, suspended-tab frames and isolated hitches do not trigger changes.
The controller measures sustained frame pressure, not GPU timer queries; it
cannot prove a slowdown is GPU-bound. No simulation or AI tick changes.

## Measured final A/B

Chrome headless, ANGLE Metal / **Apple M5 Max**, 1280×800, DPR 1, RTS zoom **0.59**.
Same Desert Strike / seed 9999, camera and scene state (hash in JSON), 40 total
actors, paused simulation, adaptive off, four seconds of warmup, **300 frames
per variant**. `main` uses its original browser modules and the exact same built
assets/compiled gameplay as the candidate; no second build was needed.
Counters include all scene, shadow, mask and output draws in both variants.

| Metric | main | Visual 3.0, full optional post |
| --- | ---: | ---: |
| Average FPS | 60.00 | 41.76 |
| 1% low FPS | 59.52 | 22.51 |
| p95 frame time | 16.8 ms | 33.4 ms |
| Draw calls / frame, including shadows | 9,866 | 9,870 |
| Submitted triangles / frame, including repeated passes | 3,020,936 | 3,116,728 |
| GPU geometries | 1,142 | 1,127 |
| GPU textures | 224 | 227 |

**This is not an FPS improvement.** Full post is disabled by default as a result.
The small initial four-actor full-post smoke reached about 60 FPS. Neither that
sample nor this paused medium army establishes stable 60 FPS in a large live
battle. Earlier exploratory/correction samples varied (32.6/27.8 FPS and one
60 FPS candidate sample); they are not used to claim a speedup. The final pair
above is the recorded comparison, not a best-of series. No further tuning runs.

Desert Strike intentionally has no decorative sandstone instances, so its LOD
batch count is zero. A separate short real-asset check on **Broken Empire**
verified **1,083,355 → 512,470** sandstone triangles at normal zoom (−52.7%),
one existing instanced batch in both cases. Zoom 1.5/3.5 restores the original;
0.46/0.59 uses medium geometry. These are batch triangle counts, not whole-frame
counts or an FPS benchmark. Collision arrays, instance matrices and material
identity were unchanged. No primitive stand-ins were introduced.

## Validation and visible quality

- One `npm run build`: successful. Final directly copied browser-module changes
  also passed syntax/startup graph checks (230 modules) and the browser run.
- 20 relevant tests passed: 6 adaptive controller; 6 LOD/post; 4 existing PBR props;
  4 existing VFX/startup-packaging checks. The two shipped-file checks initially
  ran before build output existed and passed after that same build completed.
  No legacy suite, AI tournament, seed matrix or long simulation was run.
- Final Desert Strike browser A/B + 1.25 s live smoke: no page/shader errors;
  visible pooled explosion light; selection returned entity 1 with and without
  post; toggle/live smoke retained 1,127 geometries and 227 textures.
- Normal RTS screenshots were inspected: terrain textures, faction colors,
  silhouettes and HUD stay readable; subtle contact shading/edge filtering;
  no broad brown material overlays or bright sand bloom. The HDR post path
  makes the existing unlit fog overlay appear somewhat lighter than bypass.
  This is another reason to retain explicit opt-in pending art review.

[main at normal zoom](main-desert-strike.png) ·
[full optional post at normal zoom](visual3-desert-strike.png) ·
[real sandstone LOD at normal zoom](broken-empire-lod.png) ·
[measurements and smoke assertions](measurements.json)

## Reproduction

After one normal build, serve the candidate and a baseline using main's original
browser modules with **identical generated assets and compiled gameplay**.
Install the existing browser test dependencies with `npm --prefix tests/browser install`.

```sh
BASELINE_URL=http://127.0.0.1:8104 CANDIDATE_URL=http://127.0.0.1:8103 node scripts/qa-visual3.mjs
```

The bounded runner prints metrics and writes screenshots/JSON to the OS temp
directory (`VISUAL3_OUTPUT` overrides it). It asserts equal scene/camera/GPU state,
selection invariance, pooled light visibility and absence of browser errors.
No new build or AI simulation benchmark is started by the runner.

Runtime flags: `post=1` opts into full post; `post=0` bypasses; `lod=0` retains
original decoration geometry; `adaptive=0` freezes quality for A/B; `perf=1`
enables the existing profiler. Console diagnostics: `visualPost.snapshot()`,
`decorationLOD.snapshot()` and `visualQuality.snapshot()` on `__sandforgeWebGL`.

## Reviewed existing work and external concepts

- [#467](https://github.com/nfekete82/sandforge/pull/467): open draft. Reused its
  controller, secondary-particle thinning, pooled lights and tests, then extended
  ordering and orthographic visibility. This PR supersedes its rendering scope;
  do not merge both unchanged. No blind cherry-pick of untested branches.
- [#468](https://github.com/nfekete82/sandforge/pull/468),
  [#472](https://github.com/nfekete82/sandforge/pull/472),
  [#473](https://github.com/nfekete82/sandforge/pull/473): reviewed status/scope;
  independent navigation/AI work, not imported or modified.
- [Ironvale `src/16_post.js`](https://github.com/SharpWizard/ironvale/blob/main/src/16_post.js):
  paired depth samples, consolidated grading, retained targets and fallback.
  Implemented independently for Three r180 and Sandforge's orthographic camera;
  its perspective-only depth formula, sRGBEncoding and broad bright-pass bloom
  were deliberately not copied.
- [Dustfall `src/world.js`](https://github.com/webKing021/dustfall/blob/main/src/world.js)
  and [main](https://github.com/webKing021/dustfall/blob/main/src/main.js):
  paced LOD, preserved instancing, asymmetric scale recovery. Existing #467
  adaptation was retained instead of adding another controller.
- [MOTHLIGHT `mothlight/src/main.js`](https://github.com/hahaliu1029/fable5.2demo/blob/main/mothlight/src/main.js):
  explicit scene/bloom/grade/output order. Its composer/pass chain and
  unilateral quality drop were unnecessary here.
- [Operation Ironhold](https://github.com/StarKnightt/operation-ironhold/blob/main/index.html):
  instanced static geometry, fixed effect pools, reduced-size bloom. No new
  particle engine or per-effect resources were imported.
- [Neon `postfx.js`](https://github.com/drsamonline/neon-engine/blob/main/postfx.js)
  and [particles.js](https://github.com/drsamonline/neon-engine/blob/main/particles.js):
  reusable targets, separable glow blur and bounded GPU particles. Existing
  Sandforge particle pools, shadow budgets and frame scheduler remain in use.
