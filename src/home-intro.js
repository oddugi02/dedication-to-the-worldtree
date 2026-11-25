import {axes} from './life.js?v=16';
import {introSilhouettes} from './ornament.js?v=9';
import {createIntroRenderer} from './ornament-viewer.js?v=11';
import {homeOfferingMarkup, mountHomeOffering} from './home-offering.js?v=4';

const directions=[60,0,-60,-120,180,120];
const point=(angle,radius)=>{
  const radians=angle*Math.PI/180;
  return [Math.cos(radians)*radius,Math.sin(radians)*radius];
};

export function homeIntroMarkup() {
  const buttons=directions.map((angle,axis)=>{
    const [x,y]=point(angle,33);
    const corners=[point(angle-30,100),point(angle+30,100)];
    const polygon=['50% 50%',...corners.map(([a,b])=>`${50+a/0.8}% ${50+b/0.8}%`)].join(',');
    return `<button type="button" data-intro-axis="${axis}" aria-label="${axes[axis]} 장식"
      style="--sector:polygon(${polygon});--label-x:${50+x/0.8}%;--label-y:${50+y/0.8}%"><span>${axes[axis]}</span></button>`;
  }).join('');
  return `<div class="home-intro">${homeOfferingMarkup()}<div class="intro-wheel">
    <svg class="intro-graph" viewBox="-40 -40 80 80" aria-hidden="true">
      <defs><filter id="intro-monochrome" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -.2126 -.7152 -.0722 1 0"/>
      </filter></defs>
      ${introSilhouettes()}
    </svg>
    <div class="intro-models" aria-hidden="true"></div>
    ${buttons}
    <button type="button" class="home-offer" aria-label="세계수에 봉헌하기"><span>세계수에 봉헌하기</span></button>
  </div><p class="home-offer-status" role="status"></p></div>`;
}

function spreadInk(sector, originX, originY) {
  const ink=sector.firstElementChild;
  const {width,height}=sector.getBoundingClientRect();
  const extent=Math.hypot(width,height)*1.6;
  const shape=radius=>`polygon(${Array.from({length:72},(_,i)=>{
    const angle=i*Math.PI/36;
    const uneven=1+.18*Math.sin(angle*7)+.12*Math.cos(angle*11)+.06*Math.sin(angle*23);
    return `${originX+radius*uneven*Math.cos(angle)}px ${originY+radius*uneven*Math.sin(angle)}px`;
  }).join(',')})`;
  const frames=matchMedia('(prefers-reduced-motion: reduce)').matches
    ? [{opacity:0},{opacity:1}]
    : [
        {clipPath:shape(2),opacity:0},
        {clipPath:shape(extent*.16),opacity:.32,offset:.45},
        {clipPath:shape(extent*.43),opacity:.68,offset:.77},
        {clipPath:shape(extent),opacity:1}
      ];
  const animation=ink.animate(frames,{duration:2000,easing:'linear',fill:'both'});
  sector.classList.add('is-sharp');
  return animation.finished.then(()=>animation.cancel()).catch(()=>{});
}

export function mountHomeIntro(hero, onComplete, alreadyComplete=false) {
  const intro=hero.querySelector('.home-intro');
  const masthead=document.querySelector('.masthead');
  const copy=hero.querySelector('.hero-copy');
  const footer=hero.querySelector('.hero-bottom');
  const body=document.body;
  const backdrop=document.querySelector('#backdrop');
  const sectors=alreadyComplete?[]:directions.map(angle=>{
    const sector=document.createElement('div');
    sector.className='intro-sharp-sector';
    // Intersect two feathered half-planes through the center of the screen.
    sector.style.maskImage=[angle+150,angle+30]
      .map(direction=>`linear-gradient(${direction}deg,transparent calc(50% - 8px),black calc(50% + 8px))`)
      .join(',');
    sector.append(document.createElement('div'));
    backdrop.append(sector);
    return sector;
  });
  let renderer, finished=0, active=true;
  masthead.inert=copy.inert=footer.inert=!alreadyComplete;
  body.classList.add(alreadyComplete?'home-awakened':'home-awakening');
  const offerButton=intro.querySelector('.home-offer');
  offerButton.hidden=!alreadyComplete;
  const disposeOffering=mountHomeOffering(intro);

  function onClick(event) {
    const button=event.target.closest('[data-intro-axis]');
    if (!button || button.getAttribute('aria-disabled')==='true') return;
    const sector=sectors[Number(button.dataset.introAxis)];
    const frame=sector.getBoundingClientRect();
    const [x,y]=point(directions[Number(button.dataset.introAxis)],Math.min(frame.width,frame.height)*.13);
    const ink=spreadInk(sector,
      event.detail?event.clientX-frame.left:frame.width/2+x,
      event.detail?event.clientY-frame.top:frame.height/2+y);
    void reveal(button,ink);
  }

  async function reveal(button,ink) {
    const axis=Number(button.dataset.introAxis);
    button.setAttribute('aria-disabled','true');
    button.setAttribute('aria-busy','true');
    const silhouette=intro.querySelector(`[data-intro-motif="${axis}"]`);
    try {
      renderer ??= createIntroRenderer(intro.querySelector('.intro-models'));
      await renderer.reveal(axis);
      if (!active) return;
      silhouette.classList.add('is-model');
    } catch {
      if (!active) return;
      silhouette.classList.add('is-photo');
    }
    button.removeAttribute('aria-busy');
    button.classList.add('is-revealed');
    await ink;
    if (!active) return;
    finished++;
    if (!alreadyComplete && finished===axes.length) {
      body.classList.remove('home-awakening');
      body.classList.add('home-awakened');
      const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:2000;
      completionTimer=setTimeout(()=>{
        masthead.inert=copy.inert=footer.inert=false;
        offerButton.hidden=false;
        hero.querySelector('h1').tabIndex=-1;
        hero.querySelector('h1').focus({preventScroll:true});
        onComplete();
      },delay);
    }
  }
  let completionTimer;
  intro.addEventListener('click',onClick);
  if (alreadyComplete) intro.querySelectorAll('[data-intro-axis]').forEach(button=>void reveal(button));
  return {dispose(){
    active=false;
    clearTimeout(completionTimer);
    intro.removeEventListener('click',onClick);
    renderer?.dispose();
    disposeOffering();
    masthead.inert=copy.inert=footer.inert=false;
    for (const sector of sectors) sector.remove();
    body.classList.remove('home-awakening','home-awakened');
  }};
}
