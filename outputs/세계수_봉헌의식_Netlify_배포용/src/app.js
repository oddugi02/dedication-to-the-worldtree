import {particle} from './biography.js?v=3';
import {life, axes, advance, archiveEntry} from './life.js?v=15';
import {ornament, axisButtons} from './ornament.js?v=6';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const backdrop = document.querySelector('#backdrop');
const archiveKey = 'world-tree:archive:1';
const scenes = ['descent','core','ascent','rebirth'];
const sessionKey = 'world-tree:checkpoint:1';
const entryPrefix = archiveKey + ':';
let records = [];
let checkpoint = read(sessionKey, null);
let view, person, stage = 0, segment = 0, people = [], world, enginePromise, retry;
let storageFailed = false;
let ambient;
let captionTimer;
const html = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { storageFailed = true; }
}
function loadArchive() {
  const merged = new Map(records.map(item => [item.person.id,item]));
  try {
    const previous = read(archiveKey, []);
    for (const item of Array.isArray(previous) ? previous : []) {
      if (item?.person?.id) merged.set(item.person.id,item);
    }
    for (let index=0; index<localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(entryPrefix)) continue;
      const entry = read(key,null);
      if (entry?.person?.id) merged.set(entry.person.id,entry);
    }
  } catch { storageFailed = true; }
  records = [...merged.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function notice(message = '') {
  status.textContent = storageFailed ? '브라우저에 기록을 저장할 수 없습니다. ' + message : message;
}
function remember() {
  checkpoint = {person,stage,segment};
  save(sessionKey, checkpoint);
}
const button = (action, text, cls = 'quiet') => '<button type="button" class="'+cls+'" data-action="'+action+'">'+text+'</button>';
const meta = p => '제'+html(p.region)+'구역 · '+html(p.job)+' · '+html(p.gender)+' · 향년 '+html(p.age)+'세';
function story(profile) {
  const names = new Map((profile.relationships ?? []).flatMap(({name},index)=>{
    if (!/^[가-힣]{1,30}$/.test(name)) return [];
    const seed = (profile.seed ^ Math.imul(index+1,0x9e3779b9)) >>> 0;
    const query = new URLSearchParams({life:seed,name});
    return [[name,'./?'+query]];
  }));
  const matcher = names.size ? new RegExp('(?<![가-힣])('+[...names.keys()].sort((a,b)=>b.length-a.length).join('|')+')','g') : null;
  const lines = profile.story.map(line=>{
    const parts = matcher ? line.split(matcher) : [line];
    return '<p>'+parts.map((part,index)=>index%2===0
      ? html(part)
      : '<a class="life-link" href="'+html(names.get(part))+'">'+html(part)+'</a>').join('')+'</p>';
  });
  return '<div class="story">'+lines.join('')+'</div>';
}

function linkedLife(query) {
  const name = query.get('name') ?? '';
  const rawSeed = query.get('life') ?? '';
  const seed = Number(rawSeed);
  if (!/^\d{1,10}$/.test(rawSeed) || seed>0xffffffff || !/^[가-힣]{1,30}$/.test(name)) {
    lives();
    return;
  }
  const profile = life(seed,name);
  const back = history.state?.linkedLife
    ? button('back-life','이전 생애로')
    : button('lives','인물 목록');
  show('linked-life','<section class="layout">'+heading('등장인물의 삶',html(profile.name))+
    '<p class="meta">'+meta(profile)+'</p>'+story(profile)+actions(back)+'</section>');
  document.title=profile.name+'의 삶 · 세계수 봉헌의식';
}

const heading = (n,title) => '<p class="index">'+n+'</p><h1>'+title+'</h1>';
const actions = (...items) => '<div class="actions">'+items.join('')+'</div>';
function list(items, selected, action) {
  return '<div class="list">'+items.map((p,i)=>'<button type="button" data-action="'+action+'" data-index="'+i+'" aria-pressed="'+(p.id===selected?.id)+'"><strong>'+html(p.name)+'</strong><small>'+meta(p)+'</small></button>').join('')+'</div>';
}
async function toggleAmbient() {
  if(ambient) {
    const context = ambient;
    ambient = null;
    await context.close();
    return false;
  }
  const context = new AudioContext();
  await context.resume();
  const sample = context.createBuffer(1, context.sampleRate*3, context.sampleRate);
  const data = sample.getChannelData(0);
  let last = 0;
  for(let i=0;i<data.length;i++) {
    last = last*.94+(Math.random()*2-1)*.06;
    data[i] = last*Math.min(1,i/250,(data.length-1-i)/250);
  }
  const source = context.createBufferSource();
  source.buffer=sample;
  source.loop=true;
  const filter=context.createBiquadFilter();
  filter.type='lowpass';
  filter.frequency.value=370;
  const gain=context.createGain();
  gain.gain.value=.16;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  ambient=context;
  return true;
}
function show(next, body, {scene=false, background='tree', focus=true} = {}) {
  clearTimeout(captionTimer);
  if(ambient && next!=='journey') {
    void ambient.close();
    ambient=null;
  }
  view = next;
  document.body.dataset.view = next;
  document.body.className = [next==='archive'?'archive':'', ['lives','ornament','linked-life'].includes(next)?'interior':'', scene?'scene-3d':''].filter(Boolean).join(' ');
  backdrop.style.backgroundImage = 'url("./public/assets/'+background+'.webp")';
  app.innerHTML = body;
  app.setAttribute('aria-busy',String(next==='loading' || (next==='altar' && !scene)));
  document.querySelector('#archive-link').setAttribute('aria-current',next==='archive'?'page':'false');
  document.title = next==='archive'?'봉헌 기록 · 세계수 봉헌의식':'세계수 봉헌의식';
  if (focus) {
    const title = app.querySelector('h1,h2');
    if (title) { title.tabIndex=-1; title.focus({preventScroll:true}); }
    scrollTo(0,0);
  }
}
const ornamentPhotos = new Map();

function loadOrnamentPhoto(source) {
  if (!ornamentPhotos.has(source)) {
    const pending = fetch(source).then(async response => {
      if (!response.ok) throw new Error('장식 이미지 요청 실패: ' + response.status);
      const url = URL.createObjectURL(await response.blob());
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return url;
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
    }).catch(error => {
      ornamentPhotos.delete(source);
      throw error;
    });
    ornamentPhotos.set(source, pending);
  }
  return ornamentPhotos.get(source);
}

async function draw(record, rings=true) {
  const node = app.querySelector('[data-ornament]');
  if (!node) return;
  const template = document.createElement('template');
  template.innerHTML = ornament(record,rings);
  const images = [...template.content.querySelectorAll('image')];
  node.setAttribute('aria-busy','true');
  try {
    await Promise.all(images.map(async image => {
      const url = await loadOrnamentPhoto(image.getAttribute('href'));
      image.setAttribute('href', url);
    }));
    if (node.isConnected) node.replaceChildren(template.content);
  } catch {
    if (node.isConnected) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'quiet';
      retry.textContent = '장식 이미지 다시 불러오기';
      retry.addEventListener('click', () => {
        retry.disabled = true;
        void draw(record, rings);
      });
      node.replaceChildren(retry);
    }
  } finally {
    node.removeAttribute('aria-busy');
  }
}
const altarSurfaces = new WeakMap();

function altarSurface(record) {
  if (!altarSurfaces.has(record)) {
    const pending = (async () => {
      const template = document.createElement('template');
      template.innerHTML = ornament(record,false);
      const svg = template.content.firstElementChild;
      svg.setAttribute('width','864');
      svg.setAttribute('height','816');
      const sources = new Map();
      await Promise.all([...svg.querySelectorAll('image')].map(async image => {
        const source = image.getAttribute('href');
        if (!sources.has(source)) {
          sources.set(source,loadOrnamentPhoto(source).then(async url => {
            const blob = await (await fetch(url)).blob();
            return new Promise((resolve,reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
          }));
        }
        image.setAttribute('href',await sources.get(source));
      }));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image,0,0);
        return canvas;
      } finally {
        URL.revokeObjectURL(url);
      }
    })().catch(error => {
      altarSurfaces.delete(record);
      throw error;
    });
    altarSurfaces.set(record,pending);
  }
  return altarSurfaces.get(record);
}

const axisInfo = profile => '<div class="axes" aria-label="동작별 성장값과 기록">'+axisButtons(profile.growth)+'</div><p class="evidence" aria-live="polite">동작을 선택해 관련 기록을 확인하세요.</p>';

function home() {
  world?.stop();
  show('home','<section class="hero"><div class="hero-copy"><p class="index">01 / 세계수 앞</p><h1>세계수<br>봉헌의식</h1><p class="description">한 사람의 삶이 식물장식으로 남았습니다. 그 장식을 세계수에 봉헌합니다.</p>'+actions(button('lives','삶 살펴보기 <span aria-hidden="true">→</span>','primary'),checkpoint?.person?button('resume','이어서 체험하기'):'')+'</div><div class="hero-bottom"><span>세계수 앞 제단</span><span>인물 선택 · 장식 봉헌 · 환생</span></div></section>');
}
function generate() {
  const batch = new Map();
  while (batch.size<6) {
    for (const seed of crypto.getRandomValues(new Uint32Array(6-batch.size))) {
      const profile = life(seed);
      if (!batch.has(profile.name)) batch.set(profile.name,profile);
    }
  }
  people = [...batch.values()];
}
function lives(index=0, focus=true) {
  world?.stop();
  if (!people.length) generate();
  person = people[index];
  stage = segment = 0;
  show('lives','<section class="layout">'+heading('02 / 인생 선택','봉헌할 삶')+'<p class="lede">한 사람을 선택해, 장식에 남은 삶을 살펴보세요.</p><div class="two-columns"><div>'+list(people,person,'person')+button('shuffle','다른 인물 보기')+'</div><article class="detail"><h2>'+html(person.name)+'</h2><p class="meta">'+meta(person)+'</p>'+story(person)+button('ornament','이 삶의 장식 보기','primary')+'</article></div></section>',{focus});
  if (!focus) app.querySelector('[data-index="'+index+'"]')?.focus({preventScroll:true});
}
function design() {
  show('ornament','<section class="layout">'+heading('03 / 식물장식',html(person.name)+'의 식물장식')+'<div class="two-columns ornament-layout"><article class="detail"><p class="meta">'+meta(person)+'</p><p>삶에 쌓인 여섯 동작이 나이테를 따라 자랐습니다.</p>'+axisInfo(person)+actions(button('altar','제단으로','primary'),button('back','인물 목록'))+'</article><figure data-ornament></figure></div></section>');
  draw(person);
}
function altar(ready=false, focus=true) {
  const phases = [['take','장식 집기','장식을 눌러 집으세요.'],['place','제단에 놓기','제단 중앙의 원형 홈에 장식을 놓으세요.'],['offer','봉헌하기','관리자 이름을 입력하고 봉헌하기를 누르세요.']];
  const [action,label,copy] = phases[Math.min(stage,2)];
  const name = app.querySelector('#officiant-name')?.value ?? '';
  const form = stage===2
    ? '<form id="offering-form" class="officiant-form"><label for="officiant-name">봉헌자 이름</label><div><span>관리자</span><input id="officiant-name" name="officiant" type="text" required autocomplete="name" maxlength="40" placeholder="이름 입력" value="'+html(name)+'"><button type="submit" class="offer-button" disabled>'+label+'</button></div></form>'
    : '';
  const controlMarkup = stage===2
    ? '<div class="altar-target placed"><div data-ornament></div></div>'
    : '<button type="button" data-action="'+action+'" '+(ready?'':'disabled')+' class="altar-target '+(stage===1?'held':'')+'"><div data-ornament></div><span>'+(ready?label:'제단 준비 중')+'</span></button>';

  show('altar','<section class="altar-ritual" aria-label="봉헌 제단">'+controlMarkup+'<div class="scene-overlay"><p class="index">04 / 봉헌 제단 · '+(stage+1)+' / 3</p><h2>'+html(person.name)+'의 장식</h2><p>'+copy+'</p>'+form+actions(button('back','인물 목록'))+'</div></section>',{scene:ready,background:'altar',focus});
  if (!focus) app.querySelector(stage===2?'#officiant-name':'.altar-target')?.focus({preventScroll:true});
  const control = app.querySelector('.altar-target');
  const record = person;
  if (ready && stage>0) {
    const {x,y} = world.altarAnchor();
    control.style.setProperty('--recess-x',x+'vw');
    control.style.setProperty('--recess-y',y+'vh');
  }
  if (ready && stage===2) {
    const submit = app.querySelector('.offer-button');
    submit.disabled = true;
    const enableOffer = () => { submit.disabled = false; };
    void altarSurface(record).then(surface => {
      if (!control.isConnected || view!=='altar' || stage!==2) return;
      if (world.place(surface,enableOffer)) {
        control.classList.add('in-recess');
      } else {
        enableOffer();
        void draw(record,false);
      }
    }).catch(() => {
      if (control.isConnected) {
        enableOffer();
        void draw(record,false);
      }
    });
  } else {
    void draw(record,false);
  }
}
function errorView() {
  show('error','<section class="layout"><h1>공간을 열 수 없습니다</h1><p class="lede">3D 자료를 다시 불러와 보세요. 완료한 봉헌은 기록에서 열 수 있습니다.</p>'+actions(button('retry','다시 시도','primary'),'<a class="quiet" href="./?page=archive">봉헌 기록</a>',button('home','처음으로'))+'</section>');
  notice();
}
async function engine() {
  enginePromise ??= import('./scene.js?v=13').then(({createWorld}) => {
    world = createWorld(document.querySelector('#world'),{
      ready(){ if (view==='altar' && stage<3) { notice(); altar(true,false); } },
      loading(name){ const index=scenes.indexOf(name); if(index>=0)segment=index; notice('다음 공간을 불러오는 중입니다.'); },
      assetProgress(loaded,total){
        const message='공간 준비 중 · '+loaded+' / '+total;
        const count=app.querySelector('.loading-count');
        if(count) {count.textContent=message;notice();}
        else if(view==='altar') notice(message);
      },
      scene(step,index){ segment=index; remember(); notice(); journey(step,index); },
      progress(value){ const bar=app.querySelector('.journey-progress'); if(bar)bar.value=Math.min(1,value); },
      error:errorView,
      done(){ checkpoint=null; save(sessionKey,null); ending(); }
    });
    return world;
  }).catch(error => {enginePromise=null;throw error;});
  return enginePromise;
}
async function enterAltar() {
  retry = enterAltar;
  remember(); altar(); notice('제단을 불러오는 중입니다.');
  try { const w=await engine(); if(view==='altar')await w.altar(); }
  catch { if(view==='altar')errorView(); }
}
async function startJourney() {
  retry = startJourney;
  const record = person;
  const chapter = segment;
  const wasAtAltar = view==='altar' && document.body.classList.contains('scene-3d');
  show('loading','<section class="scene-overlay loading-state"><h2>세계수 안으로</h2><p>잠시 후 장식의 시점으로 이동합니다.</p><p class="loading-count" role="status">공간을 준비하고 있습니다.</p></section>',{scene:wasAtAltar,background:'altar'});
  try {
    const w=await engine();
    const surface=chapter===0 ? await altarSurface(record) : undefined;
    if(view==='loading' && person===record) w.start(record,chapter,surface);
  } catch {
    if(view==='loading' && person===record)errorView();
  }
}
function ritual(action, officiant='') {
  if(view!=='altar'||(action==='offer'&&!officiant))return;
  const next = advance(stage,action);
  if(next===stage)return;
  const ready = document.body.classList.contains('scene-3d');
  if(!ready || (action==='offer' && app.querySelector('.offer-button')?.disabled))return;
  stage=next;
  if(stage<3){remember();altar(ready,false);return;}
  loadArchive();
  records=archiveEntry(records,person,new Date().toISOString(),officiant);
  save(entryPrefix+person.id,records.find(entry=>entry.person.id===person.id));
  remember();
  void startJourney();
}
function journey(step,index) {
  const chapters=['하강','핵','상승','환생'];
  show('journey','<section class="scene-overlay journey-panel"><div class="journey-heading"><h2>'+step.label+'</h2><button type="button" class="quiet" data-action="caption" aria-expanded="true" aria-controls="scene-description">설명 닫기</button></div><div id="scene-description" class="scene-description"><p>'+step.copy+'</p><p class="look-hint">드래그 또는 방향키로 둘러보기</p></div><div class="journey-controls">'+button('pause','일시정지')+button('look','정면 보기')+button('reduce',world.reduced?'움직임 완화 켜짐':'움직임 완화')+button('audio',ambient?'환경음 끄기':'환경음 켜기')+'</div><div class="journey-track" aria-label="여정 단계">'+chapters.map((label,i)=>'<span '+(i===index?'aria-current="step"':'')+'>'+label+'</span>').join('')+'</div><progress class="journey-progress" max="1" value="0" aria-label="전체 여정 진행"></progress></section>',{scene:true,background:step.name});
  if(!world.reduced)captionTimer=setTimeout(()=>setCaption(false),6500);
}
function setCaption(open) {
  const control=app.querySelector('[data-action="caption"]');
  const description=app.querySelector('#scene-description');
  if(!control || !description)return;
  description.hidden=!open;
  control.setAttribute('aria-expanded',String(open));
  control.textContent=open?'설명 닫기':'장면 설명';
}
function ending() {
  const name = person.name;
  const seconds = 3600 + (person.seed >>> 0) % (6 * 3600);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2,'0');
  const remainder = String(seconds % 60).padStart(2,'0');
  const differentiation = hours+'시간 '+minutes+'분 '+remainder+'초';
  show('ending','<section class="scene-overlay"><p class="index">08 / 세계수 밖</p><h2>환생</h2><p>'+html(name)+'의 장식이 봉헌된 뒤 '+html(particle(name,'가','이'))+' 새로운 씨앗으로 환생했습니다. 약 '+differentiation+' 이후에 분화합니다.</p>'+actions('<a class="primary" href="./?page=archive#'+html(person.id)+'">봉헌한 삶 다시 보기</a>',button('lives','다른 삶 봉헌하기'))+'</section>',{scene:true,background:'rebirth'});
}
function archive(index,focus=true) {
  world?.stop();
  const selected = records[index]?.person.id ?? location.hash.slice(1);
  loadArchive();
  const record = records.find(item=>item.person.id===selected) ?? records[0];
  const detail = record ? '<div class="two-columns"><div>'+list(records.map(item=>item.person),record.person,'record')+'</div><article class="detail"><h2>'+html(record.person.name)+'</h2><p class="meta">'+meta(record.person)+'</p><p class="meta">봉헌일 '+html(new Date(record.date).toLocaleDateString('ko-KR'))+'</p><p class="meta">봉헌자: '+(record.officiant?'관리자 '+html(record.officiant):'미기록')+'</p>'+'<div class="archive-ornament" data-ornament></div>'+axisInfo(record.person)+story(record.person)+'</article></div>' : '<div class="empty"><h2>아직 봉헌한 삶이 없습니다</h2><p class="lede">첫 봉헌을 마치면 생애와 식물장식이 여기에 남습니다.</p>'+actions('<a class="primary" href="./#lives">봉헌할 삶 살펴보기</a>')+'</div>';
  show('archive','<section class="layout">'+heading('세계수 앞 제단','봉헌 기록')+'<p class="lede">이 기기에서 봉헌한 인물의 생애와 식물장식입니다.</p>'+detail+'</section>',{focus});
  if(record){person=record.person;draw(person);}
  if(!focus)app.querySelector('[data-index="'+index+'"]')?.focus({preventScroll:true});
}
function openLifes() {
  history.pushState(null,'','./#lives');
  lives();
}
function openArchive() {
  history.pushState(null,'','./?page=archive');
  archive();
}
function resume() {
  if (!checkpoint?.person)return;
  ({person,stage,segment}=checkpoint);
  if(stage===3)void startJourney();
  else void enterAltar();
}
app.addEventListener('submit',event=>{
  if(event.target.id!=='offering-form')return;
  event.preventDefault();
  const input = event.target.elements.officiant;
  const name = input.value.trim();
  if(!name) {
    input.value = '';
    input.reportValidity();
    return;
  }
  ritual('offer',name);
});
app.addEventListener('click',event=>{
  const link = event.target.closest('a.life-link');
  if(link && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    history.pushState({linkedLife:true},'',link.href);
    openLocation();
    return;
  }
  const axis=event.target.closest('[data-axis]');
  if(axis){
    for(const item of app.querySelectorAll('[data-axis]'))item.setAttribute('aria-pressed',String(item===axis));
    const index=Number(axis.dataset.axis);
    app.querySelector('.evidence').textContent=axes[index]+' · '+person.evidence[index];
    return;
  }
  const control=event.target.closest('[data-action]');
  if(!control)return;
  const action=control.dataset.action, index=Number(control.dataset.index);
  switch(action){
    case 'lives':openLifes();break;
    case 'shuffle':generate();lives();break;
    case 'person':lives(index,false);break;
    case 'ornament':design();break;
    case 'altar':void enterAltar();break;
    case 'take':case 'place':ritual(action);break;
    case 'resume':resume();break;
    case 'back-life':history.back();break;
    case 'back':lives(Math.max(0,people.findIndex(p=>p.id===person.id)));break;
    case 'record':history.replaceState(null,'','#'+records[index].person.id);archive(index,false);break;
    case 'audio':
      control.disabled=true;
      void toggleAmbient().then(on=>{control.textContent=on?'환경음 끄기':'환경음 켜기';}).catch(()=>notice('환경음을 재생할 수 없습니다.')).finally(()=>{control.disabled=false;});
      break;
    case 'pause':control.textContent=world.pause()?'다시 이동':'일시정지';break;
    case 'caption':clearTimeout(captionTimer);setCaption(control.getAttribute('aria-expanded')!=='true');break;
    case 'look':world.resetLook();break;
    case 'reduce':control.textContent=world.reduce()?'움직임 완화 켜짐':'움직임 완화';break;
    case 'retry':void retry?.();break;
    case 'home':home();break;
  }
});
document.querySelector('#ritual-link').addEventListener('click',event=>{event.preventDefault();openLifes();});
document.querySelector('#archive-link').addEventListener('click',event=>{event.preventDefault();openArchive();});
function openLocation(){
  const query = new URLSearchParams(location.search);
  if(query.has('life')) linkedLife(query);
  else if(query.get('page')==='archive') archive();
  else if(location.hash==='#lives' && (people.length || !checkpoint?.person)) {
    lives(Math.max(0,people.findIndex(item=>item.id===person?.id)));
  }
  else home();
}
addEventListener('popstate',openLocation);
addEventListener('storage',event=>{ if(event.key?.startsWith(entryPrefix)&&view==='archive')archive(undefined,false); });
openLocation();
