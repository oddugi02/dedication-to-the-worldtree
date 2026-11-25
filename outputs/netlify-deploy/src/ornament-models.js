import { placements } from './ornament-placements.js?v=2';

export const ornamentAssets = ['embrace.glb','offer.glb','endure.glb','accept.glb','reach.glb','accumulate.glb'];
export const ornamentViewerSettings = Object.freeze({initialZoom:1.5,minZoom:1,maxZoom:1.8});
export const ornamentSpokeAngles = [90,30,-30,-90,-150,150];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function posesForGrowth(value, axis) {
  const amount=clamp(Number(value)||0,0,3);
  if (!amount) return [];
  const level=Math.ceil(amount)-1;
  const poses=placements[axis].levels[level] ?? [];
  const fraction=Number((amount-level).toFixed(2));
  return poses.map((pose,index)=>({pose,opacity:index===poses.length-1 && fraction<1 ? fraction : 1}));
}

export function modelFrameForPose(axis, pose, sourceSize) {
  const layout=placements[axis];
  const [x,y,amount,rotation]=pose;
  const [sourceWidth,sourceHeight]=sourceSize.map(value=>Math.max(.0001,Number(value)||0));
  const scaleX=(layout.size[0]/20*amount)/sourceWidth;
  const scaleY=(layout.size[1]/20*amount)/sourceHeight;
  const uniformScale=Math.min(scaleX,scaleY);
  const radius=Math.hypot(x,y)/20;
  const spoke=ornamentSpokeAngles[axis];
  const spokeRadians=spoke*Math.PI/180;
  const originalAngle=Math.atan2(y,x)*180/Math.PI;
  return {
    position:[Math.cos(spokeRadians)*radius,-Math.sin(spokeRadians)*radius],
    scale:[uniformScale,uniformScale,uniformScale],
    rotation:layout.sprite.angle+rotation+spoke-originalAngle
  };
}

export function orthographicFrame(referenceWidth, referenceHeight, aspect, padding=1.18) {
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
