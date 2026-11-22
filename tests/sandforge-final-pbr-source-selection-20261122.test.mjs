import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('playable builds prefer current style PBR source and never silently ship placeholders',()=>{
 const ensure=readFileSync('scripts/ensure-final-pbr-buildings.mjs','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(ensure,/sandforge-style-test/);
 assert.match(ensure,/sandforge-pbr-gesamt-test/);
 assert.match(ensure,/combinedCandidates\.find\(dir=>allGood\(join\(dir,rel\)\)\)/);
 assert.match(ensure,/if\(!allGood\(stage\)\)throw Error/);
 assert.match(build,/SANDFORGE_COMBINED_PBR_SOURCE/);
 assert.match(build,/SANDFORGE_ALLOW_PLACEHOLDER_BUILDINGS==='1'/);
 assert.match(build,/process\.env\.CI==='true'/);
 assert.match(build,/if\(!allowFallback\)throw new Error/);
 assert.ok(!build.includes("Using tracked pre-Meshy GLBs instead."),
  'never silently downgrade HQ and barracks in the normal playable build');
 assert.match(build,/\['scripts\/ensure-final-pbr-buildings\.mjs',shippedBuildingDir\]/);
 assert.ok(build.indexOf("cpSync('src/assets', 'dist/src/assets'")<
  build.indexOf("['scripts/ensure-final-pbr-buildings.mjs',shippedBuildingDir]"));
});
