import {axes} from './life.js?v=16';
import {ornament} from './ornament.js?v=10';

const instructions = [
  '양손에 깍지를 끼고 손바닥을 붙이세요.',
  '손가락을 붙인 채 한 손을 살짝 아래로 내미세요.',
  '손가락과 손바닥 사이에 틈이 없도록 주먹을 쥐세요.',
  '두 손바닥을 오목하게 펴고 안쪽 손날을 맞대세요.',
  '한 손을 아래로 내밀고 손가락을 모두 벌리세요.',
  '두 손의 손등을 위로 향하게 하고 한 손을 다른 손 위에 포개세요.'
];
const runtime = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const model = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function describe(hand) {
  const size = Math.max(.001,distance(hand[0],hand[9]),distance(hand[5],hand[17]));
  const straight = [8,12,16,20].map(tip =>
    distance(hand[tip],hand[tip-3]) > 1.27 * distance(hand[tip-1],hand[tip-3]));
  const spread = [8,12,16].reduce((sum,tip)=>sum+distance(hand[tip],hand[tip+4]),0)/size;
  return {hand,size,center:hand[9],open:straight.filter(Boolean).length,spread,down:hand[12].y>hand[0].y+.12*size};
}

export function matchesGesture(axis, landmarks) {
  const [a,b] = landmarks.map(describe);
  if (!a) return false;
  if (axis===2) return !b && a.open===0;
  if (axis===1 || axis===4) return !b && a.open>=3 && a.down && (axis===1 ? a.spread<.82 : a.spread>=.82);
  if (!b) return false;
  const size = Math.max(a.size,b.size);
  const separation = distance(a.center,b.center)/size;
  if (axis===0) return separation<.75 && a.open+b.open<=4;
  if (axis===3) {
    const edge = Math.min(distance(a.hand[17],b.hand[17]),distance(a.hand[5],b.hand[5]))/size;
    return edge<.62 && a.open>=2 && b.open>=2;
  }
  const ax = a.center.x-a.hand[0].x, ay = a.center.y-a.hand[0].y;
  const bx = b.center.x-b.hand[0].x, by = b.center.y-b.hand[0].y;
  return separation<.85 && a.open>=3 && b.open>=3 &&
    (ax*bx+ay*by) > .5*Math.hypot(ax,ay)*Math.hypot(bx,by);
}

export function openOfferingGestures(dialog, person, complete) {
  const steps = person.growth.flatMap((value,axis)=>value>0?[{axis,value}]:[]);
  if (!steps.length) { complete(); return; }
  dialog.innerHTML = `<div class="gesture-preview"><div class="gesture-light"></div></div>
    <div class="gesture-controls"><h2 id="gesture-title"></h2><p class="gesture-instruction"></p>
    <div class="gesture-images"><img alt=""><video hidden muted playsinline aria-label="내 카메라 미리보기"></video></div>
    <progress max="1" value="0" aria-label="현재 손동작 진행"></progress>
    <p class="gesture-status" role="status">손이 모두 화면에 들어오도록 맞춰 주세요.</p>
    <div class="actions"><button type="button" class="primary gesture-camera">카메라 켜기</button>
    <button type="button" class="quiet gesture-hold">버튼 길게 누르기로 진행</button>
    <button type="button" class="quiet gesture-close">닫기</button></div></div>`;
  dialog.showModal();
  const find = selector => dialog.querySelector(selector);
  const status = find('.gesture-status'), video = find('video');
  const camera = find('.gesture-camera'), hold = find('.gesture-hold');
  const progress = find('progress'), light = find('.gesture-light');
  const growth = person.growth.map(()=>0);
  let index=0, held=0, last=0, lastSample=0, lastFrame=-1, frame=0, drawing=0;
  let detector, stream, closed=false, valid=false, pressed=false, mode='idle';

  function releaseCamera() {
    stream?.getTracks().forEach(track=>track.stop());
    stream=undefined;
    video.srcObject=null;
    video.hidden=true;
    detector?.close();
    detector=undefined;
  }
  function cleanup() {
    if (closed) return;
    closed=true;
    cancelAnimationFrame(frame);
    releaseCamera();
    if (dialog.open) dialog.close();
  }
  function draw() {
    light.innerHTML = ornament({...person,growth},false);
  }
  function guide() {
    const {axis,value} = steps[index];
    find('h2').textContent = axes[axis];
    find('.gesture-instruction').textContent = instructions[axis];
    const illustration = find('img');
    illustration.alt = axes[axis] + ' 손동작 일러스트';
    illustration.src = './public/assets/gesture-'+axis+'.svg';
    progress.value=0;
    status.textContent = (index+1)+' / '+steps.length+' · '+(value*2).toFixed(1)+'초';
  }
  function tick(now) {
    if (closed) return;
    const elapsed=Math.min(75,now-last);
    last=now;
    if (mode==='camera' && video.readyState>=2 && now-lastSample>=65 && video.currentTime!==lastFrame) {
      try {
        lastSample=now;
        lastFrame=video.currentTime;
        valid=matchesGesture(steps[index].axis,detector.detectForVideo(video,now).landmarks);
      } catch {
        releaseCamera();
        mode='idle';
        camera.disabled=false;
        status.textContent='카메라 인식이 중단됐습니다. 다시 연결하거나 버튼으로 진행하세요.';
      }
    }
    if (!document.hidden && (mode==='hold' ? pressed : mode==='camera' && valid && now-lastSample<230)) {
      const {axis,value}=steps[index];
      held+=elapsed;
      const fraction=Math.min(1,held/(value*2000));
      progress.value=fraction;
      growth[axis]=value*fraction;
      if (fraction===1 || now-drawing>85) { draw(); drawing=now; }
      if (fraction===1) {
        if (++index===steps.length) {
          cleanup();
          complete();
          return;
        }
        held=0;
        pressed=valid=false;
        guide();
      }
    }
    frame=requestAnimationFrame(tick);
  }
  camera.onclick=async()=>{
    camera.disabled=true;
    hold.disabled=true;
    mode='loading';
    status.textContent='손동작 인식을 준비하고 있습니다.';
    try {
      const {FilesetResolver,HandLandmarker}=await import(runtime+'/vision_bundle.mjs');
      if(closed) return;
      const files=await FilesetResolver.forVisionTasks(runtime+'/wasm');
      if(closed) return;
      const tracker=await HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:model},runningMode:'VIDEO',numHands:2
      });
      if(closed){tracker.close();return;}
      detector=tracker;
      const input=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:480},height:{ideal:360}}});
      if(closed){input.getTracks().forEach(track=>track.stop());return;}
      stream=input;
      video.srcObject=stream;
      await video.play();
      if(closed) return;
      video.hidden=false;
      mode='camera';
      guide();
    } catch {
      if(closed) return;
      releaseCamera();
      mode='idle';
      camera.disabled=false;
      status.textContent='카메라를 연결하지 못했습니다. 버튼을 길게 눌러 진행할 수 있습니다.';
    } finally {
      if(!closed) hold.disabled=false;
    }
  };
  function beginHold() {
    if (mode==='hold') return;
    releaseCamera();
    mode='hold';
    camera.disabled=false;
    hold.textContent='길게 누르기';
    guide();
  }
  hold.onclick=beginHold;
  hold.onpointerdown=event=>{
    if(mode!=='hold' || event.button!==0)return;
    hold.setPointerCapture(event.pointerId);
    pressed=true;
  };
  hold.onpointerup=hold.onlostpointercapture=hold.onpointercancel=()=>{pressed=false;};
  hold.onkeydown=event=>{
    if(mode==='hold' && [' ','Enter'].includes(event.key)) {
      event.preventDefault();
      if(!event.repeat) pressed=true;
    }
  };
  hold.onkeyup=event=>{if([' ','Enter'].includes(event.key))pressed=false;};
  hold.onblur=()=>{pressed=false;};
  find('.gesture-close').onclick=cleanup;
  dialog.oncancel=event=>{event.preventDefault();cleanup();};
  guide();
  frame=requestAnimationFrame(tick);
  return cleanup;
}
