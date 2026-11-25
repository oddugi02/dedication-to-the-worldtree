import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from './meshoptimizer/meshopt_simplifier.js';

await MeshoptSimplifier.ready;
const sourceRoot = '..';
const output = 'public/assets';
const sourceDir = fs.readdirSync(sourceRoot).find(name => name.normalize().includes('glb파일'));
const models = new Map([
  ['1-1세계수.glb', 'tree'], ['1-2배경.glb', 'grounds'], ['2봉헌제단_발전.glb', 'altar'],
  ['3하강터널.glb', 'descent'], ['4에너지 핵.glb', 'core'], ['5다시 올라가는 터널.glb', 'ascent'],
  ['제단 → 하강 터널 | 뿌리 입구 | 추가.glb', 'root-entry'],
  ['상승 터널 → 바깥 | 수피가 벌어진 출구 | 추가.glb', 'bark-exit'],
  ['환생 씨앗 - 열린 껍질.glb', 'seed-shell'],
  ['제단 단상.glb', 'altar-pedestal']
]);
const requested = process.argv.slice(2);

for (const file of fs.readdirSync(path.join(sourceRoot, sourceDir))) {
  const model = models.get(file.normalize());
  if (!model || (requested.length && !requested.includes(model))) continue;
  const source = fs.readFileSync(path.join(sourceRoot, sourceDir, file));
  const jsonSize = source.readUInt32LE(12);
  const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonSize));
  const binary = source.subarray(28 + jsonSize);
  const primitive = gltf.meshes[0].primitives[0];
  const fields = [primitive.attributes.POSITION, primitive.attributes.NORMAL, primitive.attributes.TEXCOORD_0, primitive.indices];
  const viewBytes = id => {
    const view = gltf.bufferViews[id];
    return binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  };
  const accessorBytes = id => viewBytes(gltf.accessors[id].bufferView).subarray(gltf.accessors[id].byteOffset ?? 0);
  const floats = id => new Float32Array(Uint8Array.from(accessorBytes(id)).buffer);
  const pos = floats(fields[0]);
  const normals = floats(fields[1]);
  const uv = floats(fields[2]);
  const indices = new Uint32Array(Uint8Array.from(accessorBytes(fields[3])).buffer);
  const [simplified] = MeshoptSimplifier.simplifyWithAttributes(indices, pos, 3, uv, 2, [1, 1], null, 285000, .025, ['Permissive']);
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const chunks = [];
  const views = [];
  let offset = 0;
  function append(bytes, target) {
    views.push({buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? {target} : {})});
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    chunks.push(bytes, padding);
    offset += bytes.length + padding.length;
    return views.length - 1;
  }
  const accessors = [];
  for (const [j, array] of [pos, normals, uv].entries()) {
    const size = j === 2 ? 2 : 3;
    const compact = new Float32Array(count * size);
    for (let k = 0; k < remap.length; k++) {
      if (remap[k] === 0xffffffff) continue;
      compact.set(array.subarray(k * size, (k + 1) * size), remap[k] * size);
    }
    accessors.push({...gltf.accessors[fields[j]], byteOffset: 0, count, bufferView: append(Buffer.from(compact.buffer), 34962)});
  }
  accessors.push({bufferView: append(Buffer.from(simplified.buffer, simplified.byteOffset, simplified.byteLength), 34963), count: simplified.length, componentType: 5125, type: 'SCALAR'});
  primitive.attributes = {POSITION: 0, NORMAL: 1, TEXCOORD_0: 2};
  primitive.indices = 3;
  for (const image of gltf.images) image.bufferView = append(viewBytes(image.bufferView));
  gltf.accessors = accessors;
  gltf.bufferViews = views;
  gltf.buffers = [{byteLength: offset}];
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + offset, 8);
  header.writeUInt32LE(json.length, 12);
  header.write('JSON', 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path.join(output, model + '.glb'), Buffer.concat([header, json, binHeader, ...chunks]));
  console.log(model, simplified.length / 3, (offset / 1048576).toFixed(1) + ' MiB');
}
