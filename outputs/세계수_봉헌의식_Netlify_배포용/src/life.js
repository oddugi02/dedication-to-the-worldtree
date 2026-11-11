import { biography } from './biography.js?v=3';

export const axes = ['감싸다','내밀다','버티다','받아들이다','뻗다','쌓다'];
export const colors = ['#d4a8cf','#b4c887','#d1b879','#8fc9b5','#c4a8d5','#95b9e0'];
const regions = [
  ['뿌리 아래로 물길이 갈라지는 곳', ['수로지기','뿌리 수리공','물 배분원']],
  ['어린 씨앗을 보살피는 발아장', ['씨앗 돌봄이','발아장 기록원','묘목 간병인']],
  ['높은 가지 사이로 아침빛이 들어오는 곳', ['빛 수집가','반사판 조율사','광량 기록원']],
  ['세계수의 그늘이 끝나는 외곽', ['생장지 탐사원','외곽 길지기','길 기록원']]
];
const twoSyllableNames = [
  '누아 누엘 누온 누린 누엔 누올 누벨 누람',
  '루아 루엘 루온 루린 루엔 루올 루벨 루람',
  '리아 리엘 리온 리엔 리올 리벨 리람 리운',
  '나엘 나온 나엔 나올 나벨 나람 나운 나루',
  '라엘 라온 라엔 라올 라벨 라람 라운 라누',
  '미엘 미온 미엔 미올 미벨 미람 미운 미루',
  '모엘 모온 모엔 모올 모벨 모람 모운 모루',
  '소엘 소온 소엔 소올 소벨 소람 소운 소루',
  '시엘 시온 시엔 시올 시벨 시람 시운 시루',
  '세엘 세온 세엔 세올 세벨 세람 세운 세루',
  '아엘 아온 아엔 아올 아벨 아람 아운 아루',
  '이엘 이온 이엔 이올 이벨 이람 이운 이루',
  '유엘 유온 유엔 유올 유벨 유람 유운 유루',
  '요엘 요온 요엔 요올 요벨 요람 요운 요루',
  '오엘 오온 오엔 오올 오벨 오람 오운 오루',
  '에린 에온 에누 에올 에벨 에람 에운 에루',
  '네린 네온 네누 네올 네벨 네람 네운 네루',
  '레린 레온 레누 레올 레벨 레람 레운 레루',
  '노린 노온 노엔 노올 노벨 노람 노운 노루',
  '로린 로온 로엔 로올 로벨 로람 로운 로루',
  '윤슬 르네 르온 르아 르엘 르엔 르운 르올',
  '여울 여온 여누 여올 여벨 여람 여운 여루',
].join(' ').split(' ');

const threeSyllableNames = [
  '아루엘','루미아','누아린','이오라','리오엘','세리온','에루아','나루엔','미오르','라누엘','소리엔','유라온','오르엘','리아누','모루아','아네르','누리엘','루아린','이르아','네루온','아리엘','요루엔','세루아','라미엘','오루나','에리온','르아나','미루엘','소아르','네리엘'
];
const names = [...twoSyllableNames,...threeSyllableNames];
const habits = [
  ['가까운 이들의 일을 들어주고 계절마다 안부를 살폈다', [1,.2,0,.3,0,.2]],
  ['남은 자원을 이웃과 나누고 처음 온 이에게 길을 알려주었다', [.2,1,0,.2,.2,.2]],
  ['어려운 계절마다 맡은 자리를 지키고 무너진 것을 다시 세웠다', [0,.2,1,0,.2,.5]],
  ['다른 구역을 오가며 익숙하지 않은 방식들을 배웠다', [.1,.1,.1,1,.5,.1]],
  ['지도에 없는 길을 살피고 새로운 일의 방법을 시험했다', [.1,.1,.2,.4,1,.2]],
  ['해가 뜨기 전 같은 순서로 일을 살피고 변화를 기록했다', [.1,0,.5,.2,0,1]]
];
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function elderSiblingTitle(personGender, siblingGender) {
  if (personGender === '여성') return siblingGender === '여성' ? '언니' : '오빠';
  if (personGender === '남성') return siblingGender === '여성' ? '누나' : '형';
  return siblingGender === '여성' ? '손위 자매' : '손위 형제';
}
export function life(seed, linkedName) {
  const rand = random(seed);
  const pick = items => items[Math.floor(rand() * items.length)];
  const region = Math.floor(rand() * regions.length);
  const [origin, jobs] = regions[region];
  const shortName = pick(twoSyllableNames);
  const generatedName = rand() < .22 ? pick(threeSyllableNames) : shortName;
  const name = linkedName ?? generatedName;
  const age = 55 + Math.floor(rand() * 52);
  const gender = pick(['여성','남성','논바이너리']);
  const job = pick(jobs);
  const start = 18 + Math.floor(rand() * 14);
  const turning = start + Math.floor((age - start) * .46);
  const intervals = [[5, start], [start, turning], [turning, age - 9], [age - 9, age]];
  const events = intervals.flatMap(([from, to]) =>
    habits.map(([text, weights], axis) => ({
      from, to, text, weights, axis, rate: .08 + rand() ** 2 * .76
    })));
  const available = names.filter(candidate => candidate !== name);
  const relative = pick(available);
  available.splice(available.indexOf(relative),1);
  const mentor = pick(available);
  available.splice(available.indexOf(mentor),1);
  const friend = pick(available);
  // Consume the same seeded draw as the former relation picker so biographies
  // remain stable, then derive a sibling's gender without advancing the stream.
  const familyKind = pick(['elderSibling','elderSibling','사촌','이모','할머니']);
  const relativeGender = ((seed >>> 5) & 1) === 0 ? '여성' : '남성';
  const relation = familyKind === 'elderSibling'
    ? elderSiblingTitle(gender, relativeGender)
    : familyKind;
  const relationships = [{name:relative,role:relation,gender:relativeGender},{name:mentor,role:'스승'},{name:friend,role:'동료'}];
  const chapters = biography({pick,region,origin,job,start,turning,age,relationships});
  events.push(...chapters);
  const totals = axes.map((_, axis) => events.reduce((sum, e) => sum + (e.to-e.from) * e.rate * e.weights[axis], 0));
  // Give help shown in the biography more weight than background habits.
  const helpAxis = 1;
  const narratedHelp = chapters.reduce((sum, chapter) => {
    return sum + (6 + 2 * (chapter.to - chapter.from) * chapter.rate) * chapter.weights[helpAxis];
  }, 0);
  totals[helpAxis] += narratedHelp;
  const evidence = axes.map((_, axis) => {
    const described = chapters.filter(chapter=>chapter.weights[axis]>0);
    const candidates = described.length ? described : events;
    return candidates.reduce((best, e) => {
      const impact = (e.to-e.from) * e.rate * e.weights[axis];
      return impact > best.impact ? {impact, text:e.text} : best;
    }, {impact:0,text:''}).text;
  });
  const story = chapters.map(chapter=>chapter.text);
  // Assign one low, three middle and two high stages by lifetime accumulation.
  const ranks = totals.map((_,axis)=>axis).sort((a,b)=>totals[a]-totals[b]);
  const growth = Array(axes.length);
  ranks.forEach((axis,rank) => {
    const progress = Math.max(0, Math.min(1, (totals[axis]-25)/57));
    const lower = rank===0 ? 0 : rank<4 ? 10 : 20;
    const span = lower===20 ? 10 : 9;
    const step = lower+Math.round(progress*span);
    growth[axis] = Math.max(totals[axis]>0?1:0,step)/10;
  });
  return {id: (seed >>> 0).toString(36), seed, name, age, gender, job, region: region + 1, story, events, growth, evidence, relationships, version: 7};
}
export function portions(repeat) {
  return [0,1,2].map(index => Math.max(0, Math.min(1, repeat - index)));
}
export function advance(stage, action) {
  return ['take','place','offer'][stage] === action && stage < 3 ? stage + 1 : stage;
}
export function archiveEntry(records, person, date, officiant = '') {
  if (records.some(record => record.person.id === person.id)) return records;
  return [{person: structuredClone(person), date, officiant: officiant.trim()}, ...records];
}
