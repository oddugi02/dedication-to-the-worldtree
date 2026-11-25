const clamp = value => Math.max(-1,Math.min(1,value));

export function homeMotionTarget(x, y, box = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return {x:0,y:0};
  const width = Math.max(1,Number(box.width) || 1);
  const height = Math.max(1,Number(box.height) || 1);
  return {
    x: clamp((x / width) * 2 - 1),
    y: clamp((y / height) * 2 - 1)
  };
}

export function createHomeMotion(element) {
  const enabled = element && matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!enabled) return {dispose(){}};

  let target = {x:0,y:0};
  let current = {x:0,y:0};
  let frame = 0;
  const apply = () => {
    current.x += (target.x-current.x)*.085;
    current.y += (target.y-current.y)*.085;
    document.documentElement.style.setProperty('--parallax-x',current.x.toFixed(4));
    document.documentElement.style.setProperty('--parallax-y',current.y.toFixed(4));
    document.documentElement.style.setProperty('--parallax-magnitude',Math.min(1,Math.hypot(current.x,current.y)).toFixed(4));
    document.documentElement.style.setProperty('--parallax-tilt-x',(-current.y*.8).toFixed(4));
    document.documentElement.style.setProperty('--parallax-tilt-y',(current.x*.8).toFixed(4));
    if (Math.abs(target.x-current.x)+Math.abs(target.y-current.y)>.001) frame=requestAnimationFrame(apply);
    else frame=0;
  };
  const update = event => {
    const box=element.getBoundingClientRect();
    target=homeMotionTarget(event.clientX-box.left,event.clientY-box.top,box);
    if (!frame) frame=requestAnimationFrame(apply);
  };
  const reset = () => {
    target={x:0,y:0};
    if (!frame) frame=requestAnimationFrame(apply);
  };
  element.addEventListener('pointermove',update,{passive:true});
  element.addEventListener('pointerleave',reset,{passive:true});
  return {dispose(){
    cancelAnimationFrame(frame);
    element.removeEventListener('pointermove',update);
    element.removeEventListener('pointerleave',reset);
    for (const name of ['--parallax-x','--parallax-y','--parallax-magnitude','--parallax-tilt-x','--parallax-tilt-y']) document.documentElement.style.removeProperty(name);
  }};
}
