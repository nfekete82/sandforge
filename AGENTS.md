# Sandforge contributor notes

## Required quality bar for new visible 3D assets

- Use actual UV-mapped **Base Color/Albedo, Normal and Roughness textures** on **every visible, texturable material**, including small props, boxes, sandbags, fabric, brackets, antennas, roofs, walls, fences and metal parts. Do not rely on plain `MeshStandardMaterial({color})` as the finished surface.
- Small unlit helpers, invisible collision/selection geometry, emissive lights and HUD UI graphics are exceptions.
- Bake these textures into the GLB wherever possible; if geometry is assembled at runtime, use reusable deterministic PBR `DataTexture` maps with mipmaps and sensible material scale.
- Avoid repainting authored GLB PBR surfaces with world-space desert/camouflage shader overrides. Existing correct PBR maps should remain visible in normal gameplay and moving construction ghosts.
- Reuse shared texture sets and materials to avoid unnecessary draw calls and GPU memory use. Ensure UVs, normal attributes, color space (sRGB for albedo), roughness, and shadows are correct.
- Verify the asset at **normal Sandforge RTS camera zoom**, not only in a close-up viewer. Run existing tests; add a test ensuring no untextured visible material ships with new assets.
- Preserve existing collision, gameplay, pathfinding and animations unless the task explicitly includes them.

Detailed examples and the current barracks texture implementation: `docs/ASSET_TEXTURING.md`, `scripts/webgl-barracks-prop-materials.js`, `tests/webgl-barracks-props.test.mjs`.
