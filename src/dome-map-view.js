const regionButton = region => '<button type="button" class="offering-link dome-region" data-action="region-'+region+'" data-region="'+region+'" data-marker="region-'+region+'"><span class="label">제'+region+'구역</span><span class="arrow" aria-hidden="true"></span></button>';

export function domeMapMarkup(loader = '') {
  return '<section class="dome-map" aria-label="플로렘 구역 도면">'+
    '<div class="dome-map-canvas" data-dome-map></div>'+
    '<div class="dome-map-haze" aria-hidden="true"></div>'+
    '<div class="dome-map-markers">'+
      '<span class="dome-world-tree" data-marker="tree">세계수</span>'+
      [1,2,3,4].map(regionButton).join('')+
    '</div>'+
    '<div class="dome-map-status" data-map-status role="status">'+loader+'</div>'+
  '</section>';
}

export function mapRegionFromAction(action) {
  const match = /^region-([1-4])$/.exec(action ?? '');
  return match ? Number(match[1]) : undefined;
}

export function markerStyles(points) {
  return Object.fromEntries(Object.entries(points).map(([key,[x,y]]) => [key,{
    left: Math.max(4,Math.min(96,x*100))+'%',
    top: Math.max(4,Math.min(96,y*100))+'%'
  }]));
}

