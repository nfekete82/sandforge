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
