import test from 'node:test';
import assert from 'node:assert/strict';
import { life, portions, advance, archiveEntry, elderSiblingTitle } from '../src/life.js';
test('same seed produces the same life and six lifetime totals', () => {
  const record = life(105);
  assert.deepEqual(record, life(105));
  assert.equal(record.growth.length, 6);
  assert.ok(record.events.every(event => event.from <= event.to && event.to <= record.age));
  assert.notDeepEqual(record.growth, life(106).growth);
});
test('elder sibling titles match the life and sibling genders', () => {
  assert.equal(elderSiblingTitle('여성', '여성'), '언니');
  assert.equal(elderSiblingTitle('여성', '남성'), '오빠');
  assert.equal(elderSiblingTitle('남성', '여성'), '누나');
  assert.equal(elderSiblingTitle('남성', '남성'), '형');
  assert.equal(elderSiblingTitle('논바이너리', '여성'), '손위 자매');
  assert.equal(elderSiblingTitle('논바이너리', '남성'), '손위 형제');
});
test('generated elder sibling titles agree with each profile gender', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const person = life(seed);
    const family = person.relationships[0];
    if (['언니', '오빠', '누나', '형', '손위 자매', '손위 형제'].includes(family.role)) {
      assert.equal(family.role, elderSiblingTitle(person.gender, family.gender));
    }
  }
});
test('2.5 repetitions retain two complete motifs and half of the next', () => {
  assert.deepEqual(portions(2.5), [1, 1, .5]);
  assert.deepEqual(portions(2), [1, 1, 0]);
  assert.deepEqual(portions(3), [1, 1, 1]);
});
test('ritual advances only on the next action', () => {
  assert.equal(advance(0, 'offer'), 0);
  assert.equal(advance(0, 'take'), 1);
  assert.equal(advance(1, 'place'), 2);
  assert.equal(advance(2, 'offer'), 3);
  assert.equal(advance(3, 'offer'), 3);
});
test('archive keeps the original life and a single entry per offering', () => {
  const person = life(55);
  const records = archiveEntry([], person, '2026-11-10', '  이안  ');
  assert.equal(records[0].officiant, '이안');
  assert.deepEqual(archiveEntry(records, person, '2026-11-11', '미루'), records);
  assert.deepEqual(records[0].person, person);
  assert.notEqual(records[0].person, person);
});
test('new profiles name several distinct relationships tied to life events', () => {
  const person = life(105);
  assert.ok(person.relationships.length >= 3);
  assert.equal(new Set([person.name, ...person.relationships.map(x => x.name)]).size, 4);
  for (const relation of person.relationships) {
    assert.ok(person.story.some(line => line.includes(relation.name)));
    assert.ok(person.events.some(event => event.text.includes(relation.name)));
  }
  assert.ok(new Set(Array.from({length: 80}, (_, i) => life(i * 14071).story[2])).size > 45);
});

test('every new life has one low, three middle and two high growth values', () => {
  const profiles = Array.from({length:256},(_, index)=>life(Math.imul(index+1,0x9e3779b9)));
  for (const {growth} of profiles) {
    assert.equal(growth.filter(value=>value>=0 && value<1).length,1);
    assert.equal(growth.filter(value=>value>=1 && value<2).length,3);
    assert.equal(growth.filter(value=>value>=2 && value<=3).length,2);
    assert.ok(growth.every(value=>Number.isInteger(value*10)));
  }
});

test('a linked life uses the name in the original story and its own stable biography', () => {
  const original = life(105);
  const {name} = original.relationships[0];
  const linked = life(206, name);
  assert.equal(linked.name,name);
  assert.deepEqual(linked,life(206,name));
  assert.notDeepEqual(linked.story,original.story);
  assert.ok(linked.relationships.every(person=>person.name!==name));
});

test('life events vary even after removing names, roles and ages', () => {
  const profiles = Array.from({length:512}, (_,index)=>life(Math.imul(index+1,0x9e3779b9)));
  const variants = [new Set(),new Set(),new Set(),new Set()];
  for (const profile of profiles) {
    profile.story.forEach((line,index) => {
      let anonymized = line.replace(/\d+/g,'#');
      for (const {name,role} of profile.relationships) {
        anonymized = anonymized.replaceAll(name,'인물').replaceAll(role,'관계');
      }
      anonymized = anonymized.replace(/인물[와과]/g,'인물과');
      variants[index].add(anonymized);
    });
  }
  assert.ok(variants[0].size>=25, 'childhood must vary beyond family names');
  assert.ok(variants[2].size>=30, 'turning points must vary beyond names and ages');
  assert.ok(variants[3].size>=12, 'late-life outcomes must vary');
});

test('Arin’s repeated help contributes to 내밀다 and appears as its evidence', () => {
  const person = life(455801860);
  const help = person.events.find(event=>event.text.includes('곤란한 이에게 물부터 건네는'));
  assert.ok(help);
  assert.equal(help.weights[1],1);
  assert.ok(help.to-help.from>3);
  assert.ok(person.growth[1]>=2);
  assert.match(person.evidence[1],/물부터 건네는/);
});

test('seeded names draw from a varied pool of two- and three-syllable names', () => {
  const unique = new Set(Array.from({length:500},(_,index)=>life(Math.imul(index+1,0x9e3779b9)).name));
  assert.ok(unique.size>=150);
  assert.ok([...unique].every(name=>/^[가-힣]{2,3}$/.test(name)));
});
