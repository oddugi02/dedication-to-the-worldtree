import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {
  clampOrnamentRotation,
  modelFrameForPose,
  orthographicFrame,
  ornamentAssets,
  sourceImageRotations,
  ornamentViewerSettings,
  posesForGrowth,
  placements,
  removeFallbackOrnament
} from './ornament-models.js?v=9';

export { ornamentAssets, posesForGrowth } from './ornament-models.js?v=9';

const loader=new GLTFLoader();
const assetCache=new Map();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function asset(index) {
  if (!assetCache.has(index)) assetCache.set(index,loader.loadAsync('./public/assets/ornaments/'+ornamentAssets[index]+'?v=1'));
  return assetCache.get(index);
}

function setGrowth(object, fraction, axis, materials) {
  // Measure growth in the assembly's rest frame so it rotates with the model.
  object.updateMatrixWorld(true);
  const angle=THREE.MathUtils.degToRad(placements[axis].angle);
  const direction=new THREE.Vector2(Math.cos(angle),-Math.sin(angle));
  let minimum=Infinity,maximum=-Infinity;
  const point=new THREE.Vector3();
  if(fraction<1) object.traverse(node=>{
    if(!node.isMesh) return;
    const positions=node.geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
      const distance=point.x*direction.x+point.y*direction.y;
      minimum=Math.min(minimum,distance);
      maximum=Math.max(maximum,distance);
    }
  });
  const front=minimum+(maximum-minimum)*fraction;
  object.traverse(node => {
    if (!node.isMesh) return;
    const source=Array.isArray(node.material) ? node.material : [node.material];
    node.material=source.map(material => {
      const next=material.clone();
      next.transparent=false;
      next.opacity=1;
      next.depthWrite=true;
      if('transmission' in next) next.transmission=0;
      if(fraction<1) {
        const restMatrix=node.matrixWorld.clone();
        next.onBeforeCompile=shader=>{
          shader.uniforms.growthRestMatrix={value:restMatrix};
          shader.uniforms.growthDirection={value:direction};
          shader.uniforms.growthFront={value:front};
          shader.vertexShader='uniform mat4 growthRestMatrix;\nuniform vec2 growthDirection;\nvarying float growthDistance;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\ngrowthDistance = dot((growthRestMatrix * vec4(transformed, 1.0)).xy, growthDirection);');
          shader.fragmentShader='uniform float growthFront;\nvarying float growthDistance;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\nif (growthDistance > growthFront) discard;');
        };
        next.customProgramCacheKey=()=> 'ornament-opaque-growth-v1';
      }
      materials.add(next);
      return next;
    });
    if (node.material.length===1) [node.material]=node.material;
  });
}

function modelAt(asset, axis, record, order, materials) {
  const clone=new THREE.Group();
  const model=asset.scene.clone(true);
  model.rotation.z+=THREE.MathUtils.degToRad(sourceImageRotations[axis]);
  clone.add(model);
  const bounds=new THREE.Box3().setFromObject(clone);
  const center=bounds.getCenter(new THREE.Vector3());
  const size=bounds.getSize(new THREE.Vector3());
  clone.position.sub(center);
  const frame=modelFrameForPose(axis,record.pose,[size.x,size.y,size.z]);
  const source=new THREE.Group();
  source.scale.fromArray(frame.sourceScale);
  source.add(clone);
  const rotation=new THREE.Group();
  rotation.rotation.z=THREE.MathUtils.degToRad(frame.sourceRotation);
  rotation.add(source);
  const crop=new THREE.Group();
  crop.position.set(...frame.cropOffset,0);
  crop.scale.fromArray(frame.cropScale);
  crop.add(rotation);
  const group=new THREE.Group();
  group.position.set(frame.position[0],frame.position[1],axis*.015+order*.006);
  group.rotation.z=THREE.MathUtils.degToRad(frame.rotation);
  group.scale.fromArray(frame.scale);
  group.add(crop);
  setGrowth(group,record.fraction,axis,materials);
  return group;
}

export async function createOrnamentViewer(host, person) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.className='ornament-canvas';
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','3D 식물장식. 드래그하여 돌려보고, 스크롤하여 확대 또는 축소할 수 있습니다.');
  host.append(renderer.domElement);

  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-6,6,6,-6,.1,100);
  camera.position.set(0,0,30);
  camera.zoom=ornamentViewerSettings.initialZoom;
  scene.add(new THREE.HemisphereLight('#fff6df','#1a2118',2.2));
  const key=new THREE.DirectionalLight('#fff2cc',3.2);
  key.position.set(-3,4,7);
  const rim=new THREE.PointLight('#d7e5b4',4,20);
  rim.position.set(3,-1,5);
  scene.add(key,rim);
  const orbit=new THREE.Group();
  const assembly=new THREE.Group();
  orbit.add(assembly);
  scene.add(orbit);
  const materials=new Set();
  let yaw=0, pitch=0, targetYaw=yaw, targetPitch=pitch, targetZoom=ornamentViewerSettings.initialZoom;
  let dragging, frame=0, active=true;

  const resize=()=>{
    const {width,height}=host.getBoundingClientRect();
    renderer.setSize(Math.max(1,width),Math.max(1,height),false);
    const frame=orthographicFrame(216/20,204/20,Math.max(1,width)/Math.max(1,height));
    camera.left=-frame.width/2;
    camera.right=frame.width/2;
    camera.top=frame.height/2;
    camera.bottom=-frame.height/2;
    camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const render=()=>{
    if (!active) return;
    yaw+=(targetYaw-yaw)*.12;
    pitch+=(targetPitch-pitch)*.12;
    orbit.rotation.set(pitch,yaw,0);
    camera.zoom+=(targetZoom-camera.zoom)*.12;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    frame=requestAnimationFrame(render);
  };
  const down=event=>{
    dragging=[event.clientX,event.clientY];
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const move=event=>{
    if (!dragging) return;
    const rotation=clampOrnamentRotation(
      targetYaw+(event.clientX-dragging[0])*.009,
      targetPitch+(event.clientY-dragging[1])*.005
    );
    targetYaw=rotation.yaw;
    targetPitch=rotation.pitch;
    dragging=[event.clientX,event.clientY];
  };
  const up=()=>{dragging=null;};
  const wheel=event=>{
    event.preventDefault();
    targetZoom=clamp(
      targetZoom-event.deltaY*.0008,
      ornamentViewerSettings.minZoom,
      ornamentViewerSettings.maxZoom
    );
  };
  renderer.domElement.addEventListener('pointerdown',down);
  renderer.domElement.addEventListener('pointermove',move);
  for (const type of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.addEventListener(type,up);
  renderer.domElement.addEventListener('wheel',wheel,{passive:false});

  try {
    const models=await Promise.all(ornamentAssets.map((_,axis)=>asset(axis)));
    if (!active) return {dispose(){}};
    for (let axis=0;axis<models.length;axis++) {
      posesForGrowth(person.growth[axis],axis).forEach((record,order)=>assembly.add(modelAt(models[axis],axis,record,order,materials)));
    }
    removeFallbackOrnament(host);
    render();
  } catch(error) {
    renderer.domElement.remove();
    renderer.dispose();
    observer.disconnect();
    throw error;
  }
  return {dispose(){
    active=false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener('pointerdown',down);
    renderer.domElement.removeEventListener('pointermove',move);
    for (const type of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.removeEventListener(type,up);
    renderer.domElement.removeEventListener('wheel',wheel);
    for (const material of materials) material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }};
}
