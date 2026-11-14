# Sandforge Feldkommando Final (14 November 2026)

Canonical user-supplied building: `Sandforge_Feldkommando(2).glb` (3,487,004 bytes, source SHA256
`149d2fcbde58f5a5c6393faf3d869ee67f6be1f6809a6adc34ea119853bbb93a`).

The **source upload was a single static triangle mesh** with no animation clips.
The reviewed converted asset `sandforge_feldkommando_final.glb` has:

- preserved 2048² original albedo texture, UVs and normals
- four real animated clips: `Doors_Open`, `Doors_Close`, `Doors_Cycle`, `Radar_Scan`
- independently movable left and right leaves of its *one* front entrance (+Z)
- independent radar bowl pivot (Y-up), original roof and shell retained
- dark recessed interior behind the removed original door triangles
- separate placeholder gate-anchor names only for compatibility; **no extra fence geometry**
- the same URL for live game, placement preview and HUD 3D portrait

Authoritative binary SHA256:
`d40dbb535d754a4ab0e0532214ff2b3ae92fb7b011f1222c9c6ac8c41bca1151`.

## Install

Download the converted `sandforge_feldkommando_final.glb` from this chat, then from the matching feature branch run:

```sh
npm run assets:feldkommando-final -- "$HOME/Downloads/sandforge_feldkommando_final.glb"
npm run build
node --test tests/webgl-final-feldkommando.test.mjs
```

The binary is *not* in this text-only GitHub PR until the developer adds it with `git add src/assets/reborn/buildings-3d/sandforge_feldkommando_final.glb` and pushes a commit. Until then the old HQ3 fallback remains as an error recovery measure, not the preferred building.

**QA limitations:** Rigging/GLB structure and GLB rendering in an independent software preview were checked; a real in-game Chromium playtest, all four rotations, pioneer emergence, shadows, HUD render, final CI and FPS profiling still require verification with the binary in the checked-out repo. Do not claim release-ready before those pass.

Legacy MK2 source is not deleted because the current barracks and tests still rely on some historical geometry; the runtime headquarters route chooses only this final path when installed.

## 14 November follow-up: user's actual desert camouflage and screenshot fixes

The field command source **remains** the single canonical animated GLB checked in
at `src/assets/reborn/buildings-3d/sandforge_feldkommando_final.glb`.
Do **not** replace the rigged binary with the unrigged source upload.

- `scripts/webgl-final-hq-finish.js` embeds a palette-indexed, reduced copy
  of the user's attached beige/brown desert-camouflage reference (48×34,
  eight original image colours). A triplanar fragment shader composites
  the supplied pattern with the original authored texture while preserving
  blue insignia and shadows. Game, build preview, 3D portrait, and gallery
  all call `applyStrategicGlbFinish` to use this shared finish.
- Completes the existing rotating dish with two thin feed support struts
  and a feedhorn, parented to `Radar_Dish_Pivot`. No second dish is added.
- The user screenshot's two tall black posts came from
  `createBuildingYard()` > `addSiteDecor()` > `securityLamp()`,
  not the build-placement guide. The final HQ skips those lamps only.
  The barracks and other yard props remain unchanged.
- The final HQ placement preview keeps the real material colours rather
  than the earlier half-opacity aqua/green tint. The ordinary placement
  validity ring stays available.
- A selected pioneer hides its ground selection circle only while
  `productionMotion` stages its exit through the HQ door. The selection
  ring returns when the staged rollout ends.
- `tests/webgl-final-hq-polish.test.mjs` checks camouflage pixels,
  correct scope of lamp removal, radar feed, idempotency, shader injection
  and production selection ring.

No simulation, collisions, build costs or save serialization changed.
