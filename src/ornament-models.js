import { placements } from './ornament-placements.js?v=2';

export const ornamentAssets = ['embrace.glb','offer.glb','endure.glb','accept.glb','reach.glb','accumulate.glb'];
// These supplied GLBs were generated from already-rotated source pictures.
export const sourceImageRotations = [75,0,115,0,90,0];
export const ornamentViewerSettings = Object.freeze({initialZoom:1,minZoom:.75,maxZoom:1.5});
export const ornamentSpokeAngles = [90,30,-30,-90,-150,150];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function posesForGrowth(value, axis) {
  const amount=clamp(Number(value)||0,0,3);
  if (!amount) return [];
  const level=Math.ceil(amount)-1;
  const poses=placements[axis].levels[level] ?? [];
  const fraction=Number((amount-level).toFixed(2));
  return poses.map((pose,index)=>({pose,opacity:1,fraction:index===poses.length-1 ? fraction : 1}));
}

export function modelFrameForPose(axis, pose, sourceSize) {
  const layout=placements[axis];
  const [x,y,amount,rotation]=pose;
  const [sourceWidth,sourceHeight]=sourceSize.map(value=>Math.max(.0001,Number(value)||0));
  const {sprite}=layout;
  const [left,top,cropWidth,cropHeight]=sprite.crop;
  const sx=layout.size[0]/cropWidth;
  const sy=layout.size[1]/cropHeight;
  return {
    position:[x/20,-y/20],
    scale:[amount/20,amount/20,amount/20],
    rotation:-rotation,
    cropOffset:[-layout.size[0]/2-left*sx,layout.size[1]/2+top*sy],
    cropScale:[sx,sy,Math.sqrt(sx*sy)],
    sourceRotation:-sprite.angle,
    sourceScale:[sprite.width/sourceWidth,sprite.height/sourceHeight,Math.sqrt(sprite.width/sourceWidth*sprite.height/sourceHeight)]
  };
}

export function orthographicFrame(referenceWidth, referenceHeight, aspect, padding=1) {
  const ratio=Math.max(.01,Number(aspect)||1);
  const minimumWidth=Math.max(.01,Number(referenceWidth)||0)*padding;
  const minimumHeight=Math.max(.01,Number(referenceHeight)||0)*padding;
  const height=Math.max(minimumHeight,minimumWidth/ratio);
  return {width:height*ratio,height};
}

export function clampOrnamentRotation(yaw, pitch) {
  return {
    yaw:Number(yaw)||0,
    pitch:clamp(Number(pitch)||0,-.45,.45)
  };
}

export function removeFallbackOrnament(host) {
  host.querySelector('[data-ornament]')?.remove();
  host.dataset.state='ready';
}

export { placements };
