import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from '../project-web/scripts/meshoptimizer/meshopt_simplifier.js';

const [source,destination,rawTarget='90000'] = process.argv.slice(2);
const target = Number(rawTarget);
if (!source || !destination || !Number.isFinite(target)) throw new Error('Usage: node simplify-ornament-glb.mjs source.glb destination.glb 90000');

await MeshoptSimplifier.ready;
const input=fs.readFileSync(source);
if (input.toString('ascii',0,4)!=='glTF') throw new Error('Expected a GLB file.');
const jsonSize=input.readUInt32LE(12);
const gltf=JSON.parse(input.toString('utf8',20,20+jsonSize));
const binary=input.subarray(28+jsonSize);
const primitive=gltf.meshes?.[0]?.primitives?.[0];
if (!primitive || gltf.meshes.length!==1 || gltf.meshes[0].primitives.length!==1) throw new Error('Expected one mesh with one primitive.');

const sourceView = id => {
  const view=gltf.bufferViews[id];
  const start=view.byteOffset ?? 0;
  return binary.subarray(start,start+view.byteLength);
};
const sourceAccessor = id => {
  const accessor=gltf.accessors[id];
  const view=sourceView(accessor.bufferView);
  return view.subarray(accessor.byteOffset ?? 0);
};
const floats = id => new Float32Array(Uint8Array.from(sourceAccessor(id)).buffer);
const positionId=primitive.attributes.POSITION;
const normalId=primitive.attributes.NORMAL;
const uvId=primitive.attributes.TEXCOORD_0;
const indexId=primitive.indices;
if ([positionId,normalId,uvId,indexId].some(id=>id===undefined)) throw new Error('Expected position, normal, UV and indexed geometry.');
const position=floats(positionId);
const normal=floats(normalId);
const uv=floats(uvId);
const indices=new Uint32Array(Uint8Array.from(sourceAccessor(indexId)).buffer);
const [simplified]=MeshoptSimplifier.simplifyWithAttributes(indices,position,3,uv,2,[1,1],null,target*3,.025,['Permissive']);
const [remap,count]=MeshoptSimplifier.compactMesh(simplified);
const views=[];
const chunks=[];
let offset=0;
function append(bytes,targetType) {
  const padding=Buffer.alloc((4-bytes.length%4)%4);
  views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(targetType?{target:targetType}:{})});
  chunks.push(bytes,padding);
  offset+=bytes.length+padding.length;
  return views.length-1;
}
function compact(sourceArray,size) {
  const next=new Float32Array(count*size);
  for (let index=0;index<remap.length;index++) if (remap[index]!==0xffffffff) next.set(sourceArray.subarray(index*size,index*size+size),remap[index]*size);
  return next;
}
const accessors=[];
for (const [id,size] of [[positionId,3],[normalId,3],[uvId,2]]) {
  const next=compact(floats(id),size);
  accessors.push({...gltf.accessors[id],bufferView:append(Buffer.from(next.buffer),34962),byteOffset:0,count});
}
accessors.push({bufferView:append(Buffer.from(simplified.buffer,simplified.byteOffset,simplified.byteLength),34963),byteOffset:0,count:simplified.length,componentType:5125,type:'SCALAR'});
primitive.attributes={POSITION:0,NORMAL:1,TEXCOORD_0:2};
primitive.indices=3;
for (const image of gltf.images ?? []) image.bufferView=append(sourceView(image.bufferView));
gltf.accessors=accessors;
gltf.bufferViews=views;
gltf.buffers=[{byteLength:offset}];
let json=Buffer.from(JSON.stringify(gltf));
json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);
header.write('glTF');
header.writeUInt32LE(2,4);
header.writeUInt32LE(28+json.length+offset,8);
header.writeUInt32LE(json.length,12);
header.write('JSON',16);
const binHeader=Buffer.alloc(8);
binHeader.writeUInt32LE(offset);
binHeader.write('BIN\0',4);
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,Buffer.concat([header,json,binHeader,...chunks]));
console.log(`${path.basename(source)}: ${(indices.length/3).toFixed(0)} -> ${(simplified.length/3).toFixed(0)} triangles; ${input.length} -> ${28+json.length+offset} bytes`);
