import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';

const [source, destination, rawLimit = '2048'] = process.argv.slice(2);
const limit = Number(rawLimit);

if (!source || !destination || !Number.isFinite(limit)) {
  throw new Error('Usage: node resize-glb-textures.mjs input.glb output.glb 2048');
}

const align4 = value => (value + 3) & ~3;
const input = readFileSync(source);

if (input.toString('ascii', 0, 4) !== 'glTF' || input.readUInt32LE(4) !== 2) {
  throw new Error(`${source} is not a glTF 2.0 binary file.`);
}

let cursor = 12;
let document;
let binary;
while (cursor < input.length) {
  const length = input.readUInt32LE(cursor);
  const type = input.readUInt32LE(cursor + 4);
  const data = input.subarray(cursor + 8, cursor + 8 + length);
  if (type === 0x4e4f534a) {
    document = JSON.parse(data.toString('utf8').replace(/[\u0000 ]+$/, ''));
  } else if (type === 0x004e4942) {
    binary = data;
  }
  cursor += 8 + length;
}

if (!document || !binary || document.buffers?.length !== 1) {
  throw new Error(`${source} does not contain one embedded binary buffer.`);
}

const scratch = mkdtempSync(join(tmpdir(), 'world-tree-glb-'));
const replacements = new Map();

try {
  for (const [imageIndex, image] of (document.images ?? []).entries()) {
    if (image.bufferView === undefined || !['image/jpeg', 'image/png'].includes(image.mimeType)) continue;
    const view = document.bufferViews[image.bufferView];
    const extension = image.mimeType === 'image/png' ? '.png' : '.jpg';
    const extracted = join(scratch, `image-${imageIndex}${extension}`);
    const resized = join(scratch, `image-${imageIndex}-resized${extension}`);
    const start = view.byteOffset ?? 0;
    writeFileSync(extracted, binary.subarray(start, start + view.byteLength));

    const details = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', extracted], { encoding: 'utf8' });
    const width = Number(details.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
    const height = Number(details.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
    if (Math.max(width, height) <= limit) continue;

    const args = ['-Z', String(limit), extracted, '--out', resized];
    if (image.mimeType === 'image/jpeg') args.unshift('-s', 'formatOptions', '82');
    execFileSync('/usr/bin/sips', args, { stdio: 'ignore' });
    replacements.set(image.bufferView, readFileSync(resized));
  }

  const chunks = [];
  let binaryLength = 0;
  for (const [viewIndex, view] of document.bufferViews.entries()) {
    binaryLength = align4(binaryLength);
    const originalStart = view.byteOffset ?? 0;
    const bytes = replacements.get(viewIndex) ?? binary.subarray(originalStart, originalStart + view.byteLength);
    view.byteOffset = binaryLength;
    view.byteLength = bytes.length;
    chunks.push({ offset: binaryLength, bytes });
    binaryLength += bytes.length;
  }

  const packedBinaryLength = align4(binaryLength);
  const packedBinary = Buffer.alloc(packedBinaryLength);
  for (const chunk of chunks) chunk.bytes.copy(packedBinary, chunk.offset);
  document.buffers[0].byteLength = binaryLength;

  const jsonBytes = Buffer.from(JSON.stringify(document));
  const packedJsonLength = align4(jsonBytes.length);
  const packedJson = Buffer.alloc(packedJsonLength, 0x20);
  jsonBytes.copy(packedJson);

  const totalLength = 12 + 8 + packedJson.length + 8 + packedBinary.length;
  const output = Buffer.alloc(totalLength);
  output.write('glTF', 0, 4, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(packedJson.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  packedJson.copy(output, 20);
  const binaryHeader = 20 + packedJson.length;
  output.writeUInt32LE(packedBinary.length, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  packedBinary.copy(output, binaryHeader + 8);

  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, output);
  console.log(`${source}: ${input.length} -> ${output.length} bytes; ${replacements.size} texture(s) resized`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
