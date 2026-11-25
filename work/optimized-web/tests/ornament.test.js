import test from 'node:test';
import assert from 'node:assert/strict';
import { ornament } from '../src/ornament.js';

test('growth keeps actual glossy photographs as the only ornament surfaces', () => {
  const svg=ornament({growth:[2.5,1,0,0,0,0]},false);
  assert.equal((svg.match(/gloss-0.webp/g) ?? []).length,3);
  assert.equal((svg.match(/gloss-1.webp/g) ?? []).length,1);
  assert.equal((svg.match(/<mask /g) ?? []).length,1);
  assert.doesNotMatch(svg,/<use |<clipPath |<canvas|<polygon|gloss-2\.webp/);
});

test('complete stages preserve the motif count and original six positions', () => {
  const svg=ornament({growth:[1,1,1,1,1,1]},false);
  for(let axis=0;axis<6;axis++) assert.equal((svg.match(new RegExp('gloss-'+axis+'\\.webp','g')) ?? []).length,1);
  assert.match(svg,/translate\(7.75 11.5\)/);
  assert.match(svg,/translate\(-11.75 11.5\)/);
  assert.doesNotMatch(svg,/<mask |<use /);
});

test('each motion button shows its own growth to one decimal place', async () => {
  const { axisButtons } = await import('../src/ornament.js');
  const buttons = axisButtons([1,1.1,1.2,2.3,2.7,3]);
  const labels = [...buttons.matchAll(/class="axis-level">([\d.]+)</g)].map(match=>match[1]);
  assert.deepEqual(labels,['1.0','1.1','1.2','2.3','2.7','3.0']);
});

test('2.8 uses all the final stage photo positions and masks only the third repetition', () => {
  const full = ornament({growth:[3,0,0,0,0,0]},false);
  const partial = ornament({growth:[2.8,0,0,0,0,0]},false);
  const photos = svg=>svg.match(/<image [^>]+\/>/g);
  assert.deepEqual(photos(partial),photos(full));
  assert.equal((partial.match(/<mask /g) ?? []).length,1);
  assert.match(partial,/<g mask="url\(#[^)]+\)"><image [^>]+\/><\/g>/);
});
