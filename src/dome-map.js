import * as THREE from 'three';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';

const anchors = {
  tree:[0,.35,0],
  'region-1':[-2.55,.15,1.55],
  'region-2':[2.5,.15,1.45],
  'region-3':[2.45,.15,-1.55],
  'region-4':[-2.5,.15,-1.5]
};

function cloudTexture() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(128,128,8,128,128,124);
  gradient.addColorStop(0,'rgba(218,226,211,.7)');
  gradient.addColorStop(.42,'rgba(185,198,184,.34)');
  gradient.addColorStop(1,'rgba(142,155,146,0)');
  context.fillStyle=gradient;
  context.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export async function createDomeMap(host, callbacks={}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.append(renderer.domElement);

  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2('#aeb9ad',.027);
  scene.add(new THREE.HemisphereLight('#f7f0d9','#273027',2.7));
  const key=new THREE.DirectionalLight('#fff0c8',3.4);
  key.position.set(-4,9,5);
  scene.add(key);
  const rim=new THREE.DirectionalLight('#a8d8c7',1.5);
  rim.position.set(5,4,-6);
  scene.add(rim);

  const camera=new THREE.PerspectiveCamera(38,1,.02,100);
  const root=new THREE.Group();
  scene.add(root);
  const texture=cloudTexture();
  const clouds=[];
  for(let index=0;index<18;index++){
    const angle=index/18*Math.PI*2;
    const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.28,depthWrite:false}));
    cloud.position.set(Math.cos(angle)*(4.5+(index%3)*.35),.3+(index%4)*.16,Math.sin(angle)*(3.3+(index%2)*.28));
    cloud.scale.set(3.3+(index%4)*.45,1.45+(index%3)*.28,1);
    scene.add(cloud);clouds.push(cloud);
  }

  let disposed=false,raf=0,modelRoot;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const projected=new THREE.Vector3();
  const resize=()=>{
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize',resize);resize();

  try{
    const asset=await new GLTFLoader().loadAsync('./public/assets/dome-map.glb?v=1');
    if(disposed) return {dispose(){}};
    modelRoot=asset.scene;
    const box=new THREE.Box3().setFromObject(modelRoot);
    const center=box.getCenter(new THREE.Vector3());
    const size=box.getSize(new THREE.Vector3());
    const scale=7.2/Math.max(size.x,size.z,size.y*2.2);
    modelRoot.position.copy(center).multiplyScalar(-scale);
    modelRoot.scale.setScalar(scale);
    modelRoot.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=false;object.receiveShadow=false;
      object.material.roughness=Math.max(.22,object.material.roughness ?? .5);
      object.material.envMapIntensity=.7;
    });
    root.add(modelRoot);
    camera.position.set(0,7.7,7.6);
    camera.lookAt(0,0,0);
    callbacks.ready?.();
  }catch(error){
    callbacks.error?.(error);
  }

  const clock=new THREE.Clock();
  const render=()=>{
    if(disposed)return;
    raf=requestAnimationFrame(render);
    const time=clock.getElapsedTime();
    if(!reduced.matches){
      root.position.y=Math.sin(time*.55)*.045;
      clouds.forEach((cloud,index)=>cloud.position.y+=Math.sin(time*.22+index)*.00018);
    }
    const points={};
    for(const [key,coords] of Object.entries(anchors)){
      projected.set(...coords).add(root.position).project(camera);
      points[key]=[(projected.x+1)/2,(1-projected.y)/2];
    }
    callbacks.project?.(points);
    renderer.render(scene,camera);
  };
  render();

  return {dispose(){
    if(disposed)return;
    disposed=true;cancelAnimationFrame(raf);removeEventListener('resize',resize);
    root.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of [].concat(object.material)){material.map?.dispose();material.normalMap?.dispose();material.metalnessMap?.dispose();material.dispose();}}});
    for(const cloud of clouds)cloud.material.dispose();
    texture.dispose();renderer.dispose();renderer.domElement.remove();
  }};
}
