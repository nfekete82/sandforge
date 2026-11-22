# Sandforge integration · 22 November 2026

## Integrated game systems
- Human infantry (rifle, medic, engineer, heavy MG, rocket); role equipment,
  skinned movement/stances and accurate 3D HUD portraits.
- Desert Strike pale sandstone cliff renderer, physical central four-approach
  plateau, two-way accessible highlands and preserved old map versions.
- Direct-click Bastion selection and tier-2 double-income paid upgrade.
- Latest combined PBR buildings, existing airfield/factory, bomber, helicopter,
  vehicle pathing, AI and terrain work from the 22 November test branch.
- All five original `main`-only weekly AI ranking/reporting files.

## Merge resolution
The old `main` and new game branch had diverged at
`276e0e051532219949bf94b1dbeb978da6c1b5f1`. The integration merge
`bcdee9f16381b8717baae1f35200857c85da6113` has both lineages as
parents, choosing the current tested gameplay code while retaining all
1,844 files from historical `main`. All preserved default-branch
`.github` files and README/CODEX files were verified byte-identical,
apart from the main-only AI tournament files separately copied into the
integration branch.

## Validation
[Unified integration check](https://github.com/nfekete82/sandforge/actions/runs/45023546187):
successful TypeScript/asset build, human soldier 3D + portrait tests,
Bastion upgrade and saves, rock faces + tank climbs, map-v7/v8/v9/v10
compatibility, and default-branch weekly AI ranking tests.

The following pre-existing historical tests do **not** currently describe
the latest game and remain red on the integration merge run. Do not
misrepresent the full legacy CI as green:
- [Legacy AI 3.0](https://github.com/nfekete82/sandforge/actions/runs/45023718800):
  `reborn-combat-missions` expects older mission pursuit/medic semantics
  and `reborn-commander` expects older HQ attack priorities.
- [Legacy capture regression](https://github.com/nfekete82/sandforge/actions/runs/45023718771):
  `reborn.test` expects victory to remain pending after enemy HQ removal,
  and an earlier capture/economy implementation.
- [Legacy repair bay and WebGL source checks](https://github.com/nfekete82/sandforge/actions/runs/45023718725):
  old factory-door, input-handling and terrain-grading assertions expect
  source/GLB shapes that have been superseded by the newer WebGL versions.

These are tracked for separate test modernization/functional triage.
The release-specific tests are additive; no test was disabled to hide the
failures.
