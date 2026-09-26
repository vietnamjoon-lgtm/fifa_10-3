import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ADDONS=['loaders/GLTFLoader.js','loaders/KTX2Loader.js','utils/SkeletonUtils.js','utils/BufferGeometryUtils.js','utils/WorkerPool.js','libs/ktx-parse.module.js','libs/zstddec.module.js','libs/meshopt_decoder.module.js','libs/basis/basis_transcoder.js','libs/basis/basis_transcoder.wasm','math/ColorSpaces.js'];
test('three r180 addons are vendored next to the core build',()=>{
 for(const f of ADDONS)assert.ok(fs.existsSync('vendor/three-addons/'+f),f);
 assert.match(fs.readFileSync('vendor/three.core.js','utf8'),/REVISION = '180'/);
 assert.match(fs.readFileSync('vendor/three-addons/VERSION','utf8'),/^0\.180\.0/);
});
