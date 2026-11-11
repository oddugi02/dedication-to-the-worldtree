import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { colors } from './life.js';

const base = './public/assets/';
const route = [
  {name:'descent', seconds:35, label:'하강 터널', copy:'봉헌한 장식의 빛을 따라 세계수의 뿌리 안으로 내려갑니다.'},
  {name:'core', seconds:25, label:'에너지 핵', copy:'장식에 쌓인 동작이 빛으로 흘러들어 세계수의 에너지가 됩니다.'},
  {name:'ascent', seconds:35, label:'상승 터널', copy:'빛이 흐르는 길을 따라 세계수 밖으로 올라갑니다.'},
  {name:'rebirth', seconds:25, label:'환생', copy:'씨앗의 틈이 열리고, 세계수의 빛이 들어옵니다.'}
];
export { route };
const total = route.reduce((sum, step) => sum + step.seconds, 0);
const loader = new GLTFLoader();
const assets = new Map();

function model(name) {
  if (!assets.has(name)) assets.set(name, loader.loadAsync(base+name+'.glb').catch(error => {
    assets.delete(name);
    throw error;
  }));
  return assets.get(name);
}
function scaled(asset, scale, position, rotation = 0) {
  const object = asset.scene.clone();
  object.scale.setScalar(scale);
  object.position.set(...position);
  object.rotation.y = rotation;
  return object;
}

// Dissolve the outer strips of generated slabs into the existing atmosphere.
function softenedModel(asset, scale, position, feather = .18) {
  const model = scaled(asset,scale,position);
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox;
    const bounds = new THREE.Vector4(min.x,min.y,max.x-min.x,max.y-min.y);
    const material = mesh.material.clone();
    material.transparent = true;
    material.onBeforeCompile = shader => {
      shader.uniforms.edgeBounds = {value:bounds};
      shader.uniforms.edgeFeather = {value:feather};
      shader.vertexShader = 'varying vec2 modelXY;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\nmodelXY=position.xy;'
      );
      shader.fragmentShader = 'uniform vec4 edgeBounds;\nuniform float edgeFeather;\nvarying vec2 modelXY;\n'+shader.fragmentShader.replace(
        '#include <alphatest_fragment>',`
          vec2 xy=(modelXY-edgeBounds.xy)/max(edgeBounds.zw,vec2(.001));
          vec2 border=min(xy,1.-xy);
          diffuseColor.a *= smoothstep(.015,edgeFeather,min(border.x,border.y));
          if(diffuseColor.a < .015) discard;
          #include <alphatest_fragment>
        `
      );
    };
    mesh.material=material;
  });
  return model;
}

const journeySpeed = 2;

// Each shot stays in front of its original mesh. The blackout hides the handoff.
const shots = [
  {chapter:0, seconds:5, from:[0,3.7,6], to:[0,3.9,4.55], aim:[0,1.85,-.65]},
  {chapter:0, seconds:5, from:[0,2.4,11], to:[0,1.8,8.2], aim:[0,1.5,0]},
  {chapter:0, seconds:25, from:[0,2.55,10.7], to:[0,2.55,6.8], aim:[0,2.55,0]},
  {chapter:1, seconds:25, from:[0,-3.65,-18.8], to:[0,-3.65,-19.65], aim:[0,-3.65,-26.1], zoom:1.5},
  {chapter:2, seconds:28, from:[0,3.2,11], to:[0,5.5,4.8], aim:[0,4.05,0], aimTo:[0,6.2,0], zoom:1.4},
  {chapter:2, seconds:7, from:[0,2.6,10], to:[0,2.6,7.5], aim:[0,2.6,0]},
  {chapter:3, seconds:25, from:[0,-.5,-58], to:[0,.8,-68], aim:[0,2,-73]}
];

const pedestalPosition = [0,1.38,-.4];
const pedestalScale = 2.45;
const recessCenter = new THREE.Vector3(0,1.845,-.4);
const overheadAim = recessCenter.clone().add(new THREE.Vector3(0,0,-.035));

function altarRecess(group, asset, surface) {
  const pedestal = scaled(asset,pedestalScale,pedestalPosition);
  pedestal.updateMatrixWorld(true);
  group.add(pedestal);

  const geometry = new THREE.PlaneGeometry(1,.95,12,12);
  geometry.rotateX(-Math.PI/2);
  const vertices = geometry.attributes.position;
  const down = new THREE.Vector3(0,-1,0);
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  for (let i=0;i<vertices.count;i++) {
    origin.set(recessCenter.x+vertices.getX(i),3,recessCenter.z+vertices.getZ(i));
    ray.set(origin,down);
    const hit = ray.intersectObject(pedestal,true)[0];
    const height = hit ? hit.point.y : recessCenter.y;
    vertices.setY(i,height-recessCenter.y+.014);
  }
  geometry.computeVertexNormals();

  const texture = new THREE.Texture(surface ?? undefined);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = Boolean(surface);
  const ornament = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})
  );
  ornament.position.copy(recessCenter);
  ornament.visible = Boolean(surface);
  group.add(ornament);
  return {ornament};
}

const energyCurves = [
  [recessCenter.clone().add(new THREE.Vector3(0,.03,0)).toArray(),[-.25,2.3,-1.3],[.22,2.75,-2.6],[0,3.5,-3.9]],
  [[0,2.9,7.8],[.14,2.25,5.3],[-.28,1.45,3.8],[0,1.02,2.9]],
  [[0,2.95,9.5],[.42,2.48,7.35],[-.22,1.8,5.6],[0,1.15,3.65]],
  [[0,-3.35,-22],[.3,-2.7,-23],[-.28,-2.75,-25],[0,-3,-26.1]]
].map(points=>new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point))));

function splitShell(asset) {
  const source = asset.scene.getObjectByProperty('isMesh',true);
  const points = source.geometry.attributes.position;
  const indices = source.geometry.index.array;
  const halves = [[],[]];
  for (let i=0;i<indices.length;i+=3) {
    const x = points.getX(indices[i])+points.getX(indices[i+1])+points.getX(indices[i+2]);
    halves[x<0?0:1].push(indices[i],indices[i+1],indices[i+2]);
  }
  return halves.map((faces,index) => {
    const geometry = source.geometry.clone();
    geometry.setIndex(faces);
    const mesh = new THREE.Mesh(geometry,source.material);
    mesh.scale.setScalar(4);
    mesh.position.set(index ? -.55 : .55,-2.4,-58.8);
    return mesh;
  });
}

const glowPixels = new Uint8Array(32*32*4);
for(let y=0;y<32;y++){
  for(let x=0;x<32;x++){
    const index=(y*32+x)*4;
    const radius=Math.hypot(x-15.5,y-15.5)/15.5;
    glowPixels.set([255,255,255,Math.round(255*Math.max(0,1-radius)**1.75)],index);
  }
}
const glow = new THREE.DataTexture(glowPixels,32,32);
glow.magFilter = THREE.LinearFilter;
glow.minFilter = THREE.LinearFilter;
glow.needsUpdate = true;

function dust(count, seed, palette, span) {
  let value = seed;
  const rand = () => ((value = (Math.imul(1664525,value)+1013904223)>>>0)/4294967296);
  const pts = [], hues = [];
  for(let i=0;i<count;i++){
    pts.push((rand()-.5)*span, (rand()-.5)*span*.55, (rand()-.5)*span);
    const c=new THREE.Color(palette[i%palette.length]);hues.push(c.r,c.g,c.b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(hues,3));
  return new THREE.Points(geo,new THREE.PointsMaterial({size:.082,map:glow,vertexColors:true,transparent:true,opacity:.76,depthWrite:false,blending:THREE.AdditiveBlending}));
}

const shotAtmospheres = ['altar','descent','descent','core','ascent','ascent','rebirth'];
const atmosphereColors = {
  altar:'#453d2c', descent:'#302d22', core:'#46362d', ascent:'#464031', rebirth:'#494938'
};

function makeAtmosphere() {
  const geometry = new THREE.SphereGeometry(105,32,20);
  const material = new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthTest:false,
    depthWrite:false,
    uniforms:{
      backdrop:{value:null},
      ready:{value:0},
      haze:{value:new THREE.Color()},
      aspect:{value:16/9}
    },
    vertexShader:`
      varying vec3 direction;
      void main() {
        direction=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:`
      uniform sampler2D backdrop;
      uniform vec3 haze;
      uniform float ready;
      uniform float aspect;
      varying vec3 direction;
      void main() {
        vec3 ray=normalize(direction);
        vec2 field=ray.xy/(max(.18,-ray.z)*vec2(aspect,1.));
        vec2 uv=clamp(.5+field*.48,.045,.955);
        vec2 blur=vec2(.026,.036);
        vec3 detail=texture2D(backdrop,uv).rgb*.24;
        detail+=.19*(texture2D(backdrop,uv+vec2(blur.x,0.)).rgb
                    +texture2D(backdrop,uv-vec2(blur.x,0.)).rgb
                    +texture2D(backdrop,uv+vec2(0.,blur.y)).rgb
                    +texture2D(backdrop,uv-vec2(0.,blur.y)).rgb);
        float edge=smoothstep(.48,1.12,max(abs(field.x),abs(field.y)));
        float light=smoothstep(-.8,.65,ray.y);
        vec3 air=haze*(.58+light*.52);
        float amount=(1.-edge)*smoothstep(.08,.45,-ray.z)*ready*.58;
        gl_FragColor=vec4(mix(air,detail*.5,amount),1.);
        #include <colorspace_fragment>
      }
    `
  });
  const dome = new THREE.Mesh(geometry,material);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  return dome;
}

export function createWorld(host, callbacks) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label','3D 장면. 방향키나 드래그로 둘러보기');
  const fade = document.createElement('div');
  fade.className = 'journey-fade';
  fade.setAttribute('aria-hidden','true');
  host.append(renderer.domElement,fade);
  const camera = new THREE.PerspectiveCamera(53,1,.035,140);
  const scene = new THREE.Scene();
  const stage = new THREE.Group();
  scene.add(stage,new THREE.HemisphereLight('#f6e8c3','#3a392a',2.2));
  const key = new THREE.DirectionalLight('#f7deb0',2.4);
  key.position.set(-2,8,10);
  scene.add(key);
  scene.background = new THREE.Color('#181e17');
  scene.fog = new THREE.FogExp2('#252c21',.029);
  const atmosphere = makeAtmosphere();
  scene.add(atmosphere);
  const atmosphereTextures = new Map();
  const textureLoader = new THREE.TextureLoader();
  const backdropRotation = new THREE.Matrix4();

  function setAtmosphere(index) {
    const name=shotAtmospheres[index];
    const {uniforms}=atmosphere.material;
    if (!atmosphereTextures.has(name)) {
      const texture=textureLoader.load(base+name+'.webp');
      texture.colorSpace=THREE.SRGBColorSpace;
      atmosphereTextures.set(name,texture);
    }
    uniforms.backdrop.value=atmosphereTextures.get(name);
    uniforms.haze.value.set(atmosphereColors[name]);
    scene.fog.color.copy(uniforms.haze.value);
    const {from,aim}=shots[index];
    backdropRotation.lookAt(new THREE.Vector3(...from),new THREE.Vector3(...aim),camera.up);
    atmosphere.quaternion.setFromRotationMatrix(backdropRotation);
  }
  const target = new THREE.Vector3();
  const movingAim = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const offset = new THREE.Quaternion();
  const euler = new THREE.Euler(0,0,0,'YXZ');
  let mode = '', shotIndex = 0, elapsed = 0, last = 0, raf = 0, token = 0;
  let paused = false, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0, pitch = 0, drag, busy = false, groups = [], particles, coreLight, shells = [];
  const softenedMaterials = [];
  let person, energy, energyHead, receptacle;
  const mote = new THREE.Vector3();
  const altarAim = new THREE.Vector3();
  const overheadPosition = new THREE.Vector3();
  let closeupStart, closeupTime = 0, openingView;

  function framePedestal() {
    overheadPosition.set(recessCenter.x,recessCenter.y+Math.max(1.42,1.04/camera.aspect),recessCenter.z+.055);
  }

  function resize() {
    renderer.setSize(host.clientWidth,host.clientHeight,false);
    camera.aspect = host.clientWidth/Math.max(1,host.clientHeight);
    camera.updateProjectionMatrix();
    framePedestal();
    if (mode==='altar' && closeupStart && closeupTime>=1) {
      camera.position.copy(overheadPosition);
      camera.lookAt(overheadAim);
    }
  }
  addEventListener('resize', resize);
  resize();

  function look(x,y) {
    const enclosed = shotIndex>=1 && shotIndex<=5;
    const maxYaw = enclosed ? .18 : Math.PI;
    const maxPitch = enclosed ? .13 : 1.18;
    yaw = THREE.MathUtils.clamp(yaw+x,-maxYaw,maxYaw);
    pitch = THREE.MathUtils.clamp(pitch+y,-maxPitch,maxPitch);
  }
  renderer.domElement.addEventListener('pointerdown', e => {
    if (mode !== 'journey') return;
    drag = [e.clientX,e.clientY];
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!drag) return;
    look((drag[0]-e.clientX)*.004,(drag[1]-e.clientY)*.004);
    drag = [e.clientX,e.clientY];
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) {
    renderer.domElement.addEventListener(name,()=>{drag=null;});
  }
  renderer.domElement.addEventListener('keydown',e=>{
    const dirs={ArrowLeft:[.12,0],ArrowRight:[-.12,0],ArrowUp:[0,.09],ArrowDown:[0,-.09]};
    if(mode==='journey'&&dirs[e.key]) { e.preventDefault();look(...dirs[e.key]); }
  });

  function clearStage() {
    fade.style.opacity = 0;
    closeupStart=null;
    for (const material of softenedMaterials.splice(0)) material.dispose();
    for (const object of [particles,energy,...Object.values(receptacle ?? {})]) {
      if (!object) continue;
      object.geometry.dispose();
      if (object.material.map && object.material.map !== glow) object.material.map.dispose();
      object.material.dispose();
    }
    for (const object of shells) object.traverse(mesh => {
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    stage.clear();
    energyHead?.material.dispose();
    groups=[]; shells=[];
    particles=coreLight=energy=energyHead=receptacle=null;
  }
  function render() {
    if(!mode) return;
    atmosphere.position.copy(camera.position);
    const {uniforms}=atmosphere.material;
    uniforms.ready.value=uniforms.backdrop.value?.image ? 1 : 0;
    renderer.render(scene,camera);
  }
  function tick(time) {
    raf=requestAnimationFrame(tick);
    const dt=Math.min(.075,(time-last)/1000 || 0);
    last=time;
    if (!mode || busy) return;
    if(mode==='altar' && closeupStart && closeupTime<1) {
      closeupTime = Math.min(1,closeupTime+dt/1.65);
      const settle = THREE.MathUtils.smoothstep(closeupTime,.12,1);
      const lift = Math.sin(Math.PI*closeupTime)*.92;
      const mesh = receptacle.ornament;
      mesh.position.copy(recessCenter);
      mesh.position.y += .26*(1-settle)+lift;
      mesh.position.z += 1.05*(1-settle);
      mesh.rotation.x = 1.02*(1-settle);
      mesh.scale.setScalar(1+.65*(1-settle));
      mesh.material.opacity = THREE.MathUtils.smoothstep(closeupTime,0,.13);

      const blend = THREE.MathUtils.smoothstep(closeupTime,.28,1);
      camera.position.copy(closeupStart.position).lerp(overheadPosition,blend);
      altarAim.copy(closeupStart.aim).lerp(overheadAim,blend);
      camera.lookAt(altarAim);
      if (closeupTime===1) closeupStart.onSettled();
    }
    if(mode==='journey'){
      const shot = shots[shotIndex];
      const progress = Math.min(1,elapsed/shot.seconds);
      const travel = reduced ? .5 : shotIndex<3 ? progress**1.65
        : shotIndex===4 ? progress**1.35 : THREE.MathUtils.smoothstep(progress,0,1);
      pos.fromArray(shot.from);
      target.fromArray(shot.to);
      pos.lerp(target,travel);
      target.fromArray(shot.aim);
      if (shot.aimTo) target.lerp(movingAim.fromArray(shot.aimTo),travel);
      if(shotIndex===0) {
        const lift = reduced ? 1 : THREE.MathUtils.smoothstep(progress,0,.82);
        pos.fromArray(shot.to).lerp(openingView.position,1-lift);
        target.lerp(openingView.aim,1-lift);
      }
      const enclosed = shotIndex>=1 && shotIndex<=5;
      const closeup = shotIndex===0 ? THREE.MathUtils.smoothstep(progress,.12,.82) : 1;
      const zoom = enclosed
        ? (shot.zoom ?? [1,1.75,2.15,1.95,2.15,1.8][shotIndex])*Math.max(1,camera.aspect/1.65)
        : 1+(shotIndex===0?.08:.14)*closeup;
      if(Math.abs(camera.zoom-zoom)>.0005) {
        camera.zoom=zoom;
        camera.updateProjectionMatrix();
      }
      const fadeSeconds = reduced ? .6 : 1.15;
      const fadeIn = shotIndex===0 ? 0 : 1-THREE.MathUtils.smoothstep(elapsed,0,fadeSeconds);
      const fadeOut = shotIndex<shots.length-1
        ? THREE.MathUtils.smoothstep(elapsed,shot.seconds-fadeSeconds,shot.seconds)
        : 0;
      fade.style.opacity=Math.max(fadeIn,fadeOut);
      const curve = energyCurves[shotIndex];
      energy.visible = energyHead.visible = Boolean(curve);
      if(curve) {
        const flow = shotIndex===3
          ? THREE.MathUtils.smoothstep(elapsed,0,5.5)
          : THREE.MathUtils.clamp((progress-.12)/.88,0,1)**1.65;
        const absorb = shotIndex===3 ? THREE.MathUtils.smoothstep(elapsed,4.2,6.1) : 0;
        const light = THREE.MathUtils.smoothstep(progress,0,shotIndex===0?.22:.07)*(1-absorb);
        const stream = energy.geometry.attributes.position;
        curve.getPointAt(flow,energyHead.position);
        energyHead.material.opacity=.92*light;
        energyHead.scale.setScalar(.45 + .28*flow);
        energy.material.opacity=.88*light;
        for(let i=0;i<stream.count;i++){
          const tail=(i/stream.count)*.48;
          curve.getPointAt(Math.max(0,flow-tail),mote);
          const spread=(.018+tail*.46)*(1-absorb);
          const angle=i*2.4+elapsed*2;
          stream.setXYZ(i,mote.x+Math.cos(angle)*spread,mote.y+Math.sin(angle)*spread,mote.z);
        }
        stream.needsUpdate=true;
        if(shotIndex===0 && receptacle){
          receptacle.ornament.material.opacity=1-THREE.MathUtils.smoothstep(progress,.2,.78);
        }
        if(shotIndex===3){
          const flare = THREE.MathUtils.smoothstep(elapsed,3.8,5.1)
            * (1-THREE.MathUtils.smoothstep(elapsed,5.4,8));
          coreLight.intensity=flare*12;
        }
      }
      const open = shot.chapter===3 ? THREE.MathUtils.smoothstep(progress,.12,.64) : 0;
      shells.forEach((shell,index) => {
        const side = index===0 ? -1 : 1;
        shell.position.x=side*(open*3-.55);
        shell.rotation.y=side*open*.9;
      });
      camera.position.copy(pos);
      camera.lookAt(target);
      orientation.copy(camera.quaternion);
      offset.setFromEuler(euler.set(pitch,yaw,0,'YXZ'));
      camera.quaternion.copy(orientation).multiply(offset);
      particles.position.z=pos.z;
      particles.position.y=pos.y;
      callbacks.progress((shots.slice(0,shotIndex).reduce((sum,entry)=>sum+entry.seconds,0)+elapsed)/total);
      if(!paused && !document.hidden) elapsed += dt*journeySpeed;
      if(elapsed>=shot.seconds){
        if(shotIndex+1===shots.length){mode='end';callbacks.done();}
        else enterShot(shotIndex+1);
      }
    }
    render();
  }
  raf=requestAnimationFrame(tick);

  async function load(names, current) {
    busy=true;
    try {
      let loaded=0;
      callbacks.assetProgress?.(0,names.length);
      const result=await Promise.all(names.map(async name=>{
        const asset=await model(name);
        if(current===token)callbacks.assetProgress?.(++loaded,names.length);
        return asset;
      }));
      return current===token ? result : null;
    } catch(error){
      if(current===token){ busy=false;mode='';callbacks.error(error); }
      return null;
    }
  }
  const journeyModels = ['altar','root-entry','descent','core','ascent','bark-exit','tree','grounds','seed-shell','altar-pedestal'];

  function enterShot(index, initial = false) {
    const previous = shots[shotIndex].chapter;
    shotIndex=index;
    look(0,0);
    elapsed=0;
    groups.forEach((group,i)=>{ group.visible=i===index; });
    setAtmosphere(index);
    fade.style.opacity=index===0 ? 0 : 1;
    const chapter = shots[index].chapter;
    if(initial || chapter!==previous) callbacks.scene(route[chapter],chapter);
  }

  async function buildJourney(index, surface) {
    const current=++token;
    callbacks.loading(route[index].name);
    const data=await load(journeyModels,current);
    if(!data) return;
    const [altar,entry,descent,core,ascent,exit,tree,grounds,seed,pedestal]=data;
    clearStage();
    shells = splitShell(seed);
    groups = shots.map(()=>new THREE.Group());
    groups[0].add(scaled(altar,14,[0,-.25,-1]));
    receptacle=altarRecess(groups[0],pedestal,surface);
    const chamberModels = [
      [entry,13,[0,-.65,0]],
      [descent,15,[0,-.8,0]],
      [core,13,[0,-6.9,-30]],
      [ascent,15,[0,-.8,0]],
      [exit,13,[0,-.65,0]]
    ];
    chamberModels.forEach(([asset,scale,position],index) => {
      const chamber=softenedModel(asset,scale,position,index===2 || index===3 ? .06 : .18);
      chamber.traverse(mesh => { if (mesh.isMesh) softenedMaterials.push(mesh.material); });
      groups[index+1].add(chamber);
    });
    groups[6].add(scaled(tree,16,[0,-1.1,-70]),scaled(grounds,20,[0,-2.9,-72]),...shells);
    stage.add(...groups);
    coreLight=new THREE.PointLight('#ffe3aa',0,8,2);
    coreLight.position.set(0,-3,-26.1);
    energy=dust(220,person.seed,['#fff2bc','#ffd17b','#fff9e6'],1);
    energy.frustumCulled=false;
    energy.material.size=.13;
    const palette=colors.map((color,i)=>new THREE.Color(color).multiplyScalar(.45+person.growth[i]/4));
    particles=dust(570,person.seed,palette,22);
    energyHead=new THREE.Sprite(new THREE.SpriteMaterial({
      map:glow,color:'#ffe6a0',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
    }));
    energyHead.visible=energy.visible=false;
    groups[3].add(coreLight);
    stage.add(particles,energy,energyHead);
    mode='journey';
    busy=false;
    enterShot(shots.findIndex(shot=>shot.chapter===index),true);
  }
  return {
    async altar(){
      const current=++token;
      const data=await load(['altar','altar-pedestal'],current);
      if(!data) return;
      clearStage();
      stage.add(scaled(data[0],14,[0,-.25,-1]));
      receptacle=altarRecess(stage,data[1]);
      camera.zoom=1;
      camera.updateProjectionMatrix();
      setAtmosphere(0);
      camera.position.fromArray(shots[0].from);
      altarAim.fromArray(shots[0].aim);
      camera.lookAt(altarAim);
      mode='altar';busy=false;render();
      callbacks.ready();
      void Promise.all(journeyModels.map(model)).catch(()=>{});
    },
    place(surface, onSettled) {
      if(mode!=='altar' || !receptacle) return false;
      const mesh = receptacle.ornament;
      mesh.material.map.image = surface;
      mesh.material.map.needsUpdate = true;
      mesh.visible = true;
      if (!closeupStart) {
        closeupStart={position:camera.position.clone(),aim:altarAim.clone(),onSettled};
        closeupTime=reduced ? 1 : 0;
        if (reduced) {
          camera.position.copy(overheadPosition);
          altarAim.copy(overheadAim);
          camera.lookAt(altarAim);
          onSettled();
        } else {
          mesh.position.set(recessCenter.x,recessCenter.y+.26,recessCenter.z+1.05);
          mesh.rotation.x=1.02;
          mesh.scale.setScalar(1.65);
          mesh.material.opacity=0;
        }
      } else if (closeupTime===1) {
        onSettled();
      } else {
        closeupStart.onSettled=onSettled;
      }
      render();
      return true;
    },
    altarAnchor() {
      camera.updateMatrixWorld();
      const screen=recessCenter.clone().project(camera);
      return {x:(screen.x+1)*50,y:(1-screen.y)*50};
    },
    start(record,index=0,surface){
      openingView=mode==='altar'
        ? {position:camera.position.clone(),aim:altarAim.clone()}
        : {position:overheadPosition.clone(),aim:overheadAim.clone()};
      person=record;paused=false;yaw=pitch=0;
      void buildJourney(route[index] ? index : 0,surface);
    },
    stop(){token++;mode='';busy=false;drag=null;clearStage();},
    pause(){paused=!paused;return paused;},
    reduce(){reduced=!reduced;return reduced;},
    get reduced(){return reduced;},
    resetLook(){yaw=pitch=0;renderer.domElement.focus();},
    dispose(){cancelAnimationFrame(raf);removeEventListener('resize',resize);clearStage();atmosphere.geometry.dispose();atmosphere.material.dispose();for(const texture of atmosphereTextures.values()) texture.dispose();renderer.dispose();renderer.domElement.remove();fade.remove();}
  };
}
