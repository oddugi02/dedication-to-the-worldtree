import { axes, colors } from './life.js?v=4';
import { placements } from './ornament-placements.js?v=2';

let uid = 0;

function photo(axis, layout, pose) {
  const [x,y,scale,turn] = pose;
  const [width,height] = layout.size;
  const sprite = layout.sprite;
  const [left,top,cropWidth,cropHeight] = sprite.crop;
  const transform = 'translate('+x+' '+y+') rotate('+turn+') scale('+scale+') '+
    'translate('+(-width/2)+' '+(-height/2)+') scale('+(width/cropWidth)+' '+(height/cropHeight)+') '+
    'translate('+(-left)+' '+(-top)+') rotate('+sprite.angle+')'+(sprite.flip?' scale(-1 1)':'');
  return '<image href="./public/assets/gloss-'+axis+'.webp" x="'+(-sprite.width/2)+'" y="'+(-sprite.height/2)+
    '" width="'+sprite.width+'" height="'+sprite.height+'" transform="'+transform+'"/>';
}

function partialPhoto(axis, layout, level, fraction, id) {
  const pose = layout.levels[level][level];
  const [start,end] = layout.growthBounds[level];
  const length = end-start;
  const front = start+length*fraction;
  const feather = Math.min(2,length*fraction,length*(1-fraction));
  const gradient = id+'-edge';
  return '<defs><linearGradient id="'+gradient+'" gradientUnits="userSpaceOnUse" x1="'+(front-feather)+'" x2="'+front+'" y1="0" y2="0">'+
    '<stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>'+
    '<mask id="'+id+'" maskUnits="userSpaceOnUse" x="-180" y="-180" width="360" height="360">'+
    '<rect x="-250" y="-250" width="'+(250+front)+'" height="500" fill="url(#'+gradient+')" transform="rotate('+layout.angle+')"/>'+
    '</mask></defs><g mask="url(#'+id+')">'+photo(axis,layout,pose)+'</g>';
}

function axisGrowth(value, axis, id) {
  const amount = Math.max(0,Math.min(3,Number(value)||0));
  const level = Math.floor(amount);
  const fraction = amount-level;
  const layout = placements[axis];
  const previous = level ? layout.levels[level-1] : [];
  if (!fraction) return previous.map(pose=>photo(axis,layout,pose)).join('');
  const complete = layout.levels[level].slice(0,level).map(pose=>photo(axis,layout,pose)).join('');
  return complete+partialPhoto(axis,layout,level,fraction,id);
}

export function ornament(person, rings = true) {
  const id = 'ornament-' + ++uid;
  const grid = rings
    ? '<g fill="none" stroke="#cdd5a9" opacity=".24" stroke-width=".55">' +
      [16,29,42,55,68,81].map(r => '<circle r="'+r+'"/>').join('') +
      [30,90,150].map(angle => '<path d="M-104 0H104" transform="rotate('+angle+')"/>').join('') +
      '</g>'
    : '';
  return '<svg class="ornament" xmlns="http://www.w3.org/2000/svg" viewBox="-108 -102 216 204" role="img" aria-label="광택 사진을 원본 성장 방향에 맞춰 조합한 식물장식">'+
    grid+axes.map((_,axis)=>axisGrowth(person.growth[axis],axis,id+'-'+axis)).join('')+'</svg>';
}

export function axisButtons(growth) {
  return axes.map((axis,i) => {
    const level = Number.isFinite(growth?.[i])
      ? '<span class="axis-level">'+growth[i].toFixed(1)+'</span>'
      : '';
    return '<button type="button" data-axis="'+i+'" style="--axis:'+colors[i]+'" aria-pressed="false">'+axis+level+'</button>';
  }).join('');
}
