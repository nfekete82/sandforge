import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KEYSTONE_HQ_URL,prepareKeystoneHQ,updateKeystoneHQLOD} from '../scripts/webgl-keystone-hq.js';

test('keystone preview points to an ignored local GLB, not a committed game asset',()=>{
 assert.match(KEYSTONE_HQ_URL,/local-keystone\/A_hq_KEYSTONE\.glb$/);
});

test('keystone LODs never render simultaneously',()=>{
 const lods=[0,1,2].map(i=>({name:'LOD'+i,visible:true}));
 const scene={userData:{},getObjectByName:name=>lods.find(x=>x.name===name)};
 assert.equal(prepareKeystoneHQ(scene),scene);
 assert.deepEqual(lods.map(x=>x.visible),[true,false,false]);
 assert.equal(updateKeystoneHQLOD(scene,900),1);
 assert.deepEqual(lods.map(x=>x.visible),[false,true,false]);
 assert.equal(updateKeystoneHQLOD(scene,2100),2);
 assert.deepEqual(lods.map(x=>x.visible),[false,false,true]);
 assert.equal(updateKeystoneHQLOD(scene,100),0);
 assert.deepEqual(lods.map(x=>x.visible),[true,false,false]);
});

test('missing Keystone LOD0 fails loudly',()=>{
 assert.throws(()=>prepareKeystoneHQ({userData:{},getObjectByName:()=>null}),/LOD0/);
});

test('keystone flag survives menu navigation and map reload, but stays opt-in',()=>{
 const menu=readFileSync(new URL('../scripts/webgl-title-menu.js',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../scripts/webgl-preview.js',import.meta.url),'utf8');
 assert.match(menu,/if\(query\.get\('keystone'\)==='1'\)params\.set\('keystone','1'\)/);
 assert.match(menu,/const suffix=query\.get\('keystone'\)==='1'\?'\?keystone=1':''/);
 assert.match(preview,/if\(query\.get\('keystone'\)==='1'\)q\.set\('keystone','1'\)/);
});
