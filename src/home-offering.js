// Manually traced from the 860 × 484 reference of tree.webp.
const treePath=[
  'M418 -5 C421 40 411 65 398 87 C388 111 372 126 355 116',
  'C327 97 304 87 276 84 C327 101 351 127 361 165 C372 192 336 186 308 190',
  'C217 190 120 202 49 230 C142 207 238 203 301 206',
  'C347 206 380 226 399 255 C416 283 420 295 401 311',
  'C374 337 335 350 277 360 C235 369 199 382 177 403',
  'C220 386 270 378 334 369 C373 363 400 347 409 346',
  'C397 379 368 406 355 428 C375 417 406 392 422 383',
  'C444 386 466 410 482 442 C495 455 511 461 531 463',
  'C512 445 493 411 472 384 C493 393 527 419 552 455',
  'C546 427 526 399 497 374 C535 381 573 398 604 408',
  'C575 384 528 366 500 351 C481 342 465 328 472 312',
  'C479 292 495 279 518 270 C562 253 601 223 613 192',
  'C590 228 545 257 505 260 C469 271 497 227 522 207',
  'C564 172 633 172 700 174 L864 179 L864 165',
  'C793 160 736 167 689 161 C664 145 635 123 612 117',
  'C577 102 556 85 539 63 C550 94 579 111 601 129',
  'C613 153 570 170 536 177 C514 181 508 165 513 147',
  'C522 107 541 78 545 42 L541 -5 L536 -5',
  'C547 49 530 80 506 92 C474 86 446 57 434 33 C429 15 428 4 426 -5 Z'
].join(' ');

const sparklePoints=[
  [425,73],[387,119],[456,108],[475,147],[362,146],[502,165],
  [307,182],[554,185],[394,196],[443,186],[337,226],[482,220],
  [292,244],[538,241],[378,265],[471,279],[397,309],[455,316],
  [348,339],[505,342],[415,358],[460,381],[370,392],[554,383]
];

export function homeOfferingMarkup() {
  const sparkles=sparklePoints.map(([x,y],index)=>{
    const radius=[1.3,2.4,1.8,3.2][index%4]*1.5;
    const drift=(x-430)*.16;
    const delay=(index*7%13)*.055;
    return `<g transform="translate(${x} ${y})"><path class="home-tree-spark" style="--spark-delay:${delay}s;--spark-drift:${drift}px"
      d="M0 -${radius*2} Q.45 -.45 ${radius} 0 Q.45 .45 0 ${radius*2} Q-.45 .45 -${radius} 0 Q-.45 -.45 0 -${radius*2}Z"/></g>`;
  }).join('');
  return `<div class="home-tree-frame" aria-hidden="true">
    <svg class="home-tree-target" viewBox="0 0 860 484" width="860" height="484">
    <defs>
      <linearGradient id="home-tree-outline" x1="0" y1="1" x2="1" y2="0">
        <stop stop-color="white" stop-opacity=".15"/><stop offset=".52" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity=".18"/>
      </linearGradient>
      <linearGradient id="home-tree-light" x1="0" y1="1" x2="0" y2="0">
        <stop stop-color="white" stop-opacity="0"/><stop offset=".48" stop-color="#fff7c2"/><stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="home-tree-cut"><path d="${treePath}"/></clipPath>
    </defs>
    <path class="home-tree-silhouette" d="${treePath}" vector-effect="non-scaling-stroke"/>
    <g clip-path="url(#home-tree-cut)"><rect class="home-tree-light" x="0" y="0" width="100%" height="38%" fill="url(#home-tree-light)"/></g>
    <g class="home-tree-sparkles">${sparkles}</g>
  </svg></div>`;
}

export function mountHomeOffering(intro) {
  const wheel=intro.querySelector('.intro-wheel');
  const button=intro.querySelector('.home-offer');
  const tree=intro.querySelector('.home-tree-silhouette');
  const feedback=intro.querySelector('.home-offer-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const controller=new AbortController();
  const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:controller.signal});
  let drag, timer;
  const state=name=>{intro.dataset.offering=name;};
  const blocking=()=>['flow','complete'].includes(intro.dataset.offering);
  const reset=()=>{
    wheel.style.removeProperty('--drag-x');
    wheel.style.removeProperty('--drag-y');
    state('');
    feedback.textContent='';
    button.removeAttribute('aria-disabled');
  };
  const inside=(x,y)=>{
    const matrix=tree.getScreenCTM();
    return matrix && tree.isPointInFill(new DOMPoint(x,y).matrixTransform(matrix.inverse()));
  };
  function complete() {
    state('flow');
    button.setAttribute('aria-disabled','true');
    timer=setTimeout(()=>{
      state('complete');
      feedback.textContent='봉헌 완료';
      timer=setTimeout(reset,3000);
    },reduced.matches?0:1700);
  }
  listen(button,'pointerenter',()=>{if (!drag && !blocking()) state('ready');});
  listen(button,'pointerleave',()=>{if (!drag && !blocking()) state('');});
  listen(button,'focus',()=>{if (!blocking()) state('ready');});
  listen(button,'blur',()=>{if (!drag && !blocking()) state('');});
  listen(button,'pointerdown',event=>{
    if (blocking() || event.button!==0 || drag) return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
    state('dragging');
  });
  listen(button,'pointermove',event=>{
    if (drag?.id!==event.pointerId) return;
    wheel.style.setProperty('--drag-x',`${event.clientX-drag.x}px`);
    wheel.style.setProperty('--drag-y',`${event.clientY-drag.y}px`);
    state(inside(event.clientX,event.clientY)?'over':'dragging');
  });
  listen(button,'pointerup',event=>{
    if (drag?.id!==event.pointerId) return;
    drag=null;
    if (inside(event.clientX,event.clientY)) complete();
    else reset();
  });
  for (const type of ['pointercancel','lostpointercapture']) listen(button,type,event=>{
    if (drag?.id!==event.pointerId) return;
    drag=null;
    reset();
  });
  listen(button,'click',event=>{
    if (event.detail===0 && !blocking()) complete();
  });
  return ()=>{
    clearTimeout(timer);
    controller.abort();
  };
}
