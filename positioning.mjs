const finite = Number.isFinite;
export function validPosition(p) {
  return p && finite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    finite(p.longitude) && Math.abs(p.longitude) <= 180 && finite(p.accuracy) && p.accuracy >= 0;
}
// Centered least-squares affine fit. Extra anchors reduce dependence on a single pick.
export function projectPosition(position, anchors) {
  if (!validPosition(position) || !Array.isArray(anchors) || anchors.length < 3) return null;
  if (!anchors.every(a => validPosition({ ...a, accuracy: 0 }) && finite(a.x) && finite(a.y))) return null;
  const mean = key => anchors.reduce((sum, a) => sum + a[key], 0) / anchors.length;
  const lat = mean('latitude'), lon = mean('longitude'), x = mean('x'), y = mean('y');
  // Normalize degrees for numerical stability with small building-scale differences.
  const rows = anchors.map(a => ({ u: (a.longitude-lon)*1e5, v: (a.latitude-lat)*1e5, x: a.x-x, y: a.y-y }));
  let uu=0, uv=0, vv=0, ux=0, vx=0, uy=0, vy=0;
  for (const r of rows) {
    uu+=r.u*r.u; uv+=r.u*r.v; vv+=r.v*r.v;
    ux+=r.u*r.x; vx+=r.v*r.x; uy+=r.u*r.y; vy+=r.v*r.y;
  }
  const det = uu*vv-uv*uv;
  if (uu*vv === 0 || det <= 1e-12*uu*vv) return null;
  const u = (position.longitude-lon)*1e5, v = (position.latitude-lat)*1e5;
  return {
    x: x + u*(vv*ux-uv*vx)/det + v*(uu*vx-uv*ux)/det,
    y: y + u*(vv*uy-uv*vy)/det + v*(uu*vy-uv*uy)/det,
  };
}

export function isWithinMap(point, bounds) {
  return !!point && !!bounds && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

// CSS/SVG affine matrix mapping source x/y into target x/y.
export function affineMatrix(pairs) {
  const anchors = pairs.map(p => ({longitude:p.from.x/1e5, latitude:p.from.y/1e5, ...p.to}));
  const at = (x,y) => projectPosition({longitude:x/1e5,latitude:y/1e5,accuracy:0},anchors);
  const o=at(0,0), x=at(1,0), y=at(0,1);
  if (!o || !x || !y) return null;
  return [x.x-o.x,x.y-o.y,y.x-o.x,y.y-o.y,o.x,o.y];
}
export function applyMatrix(m,p) { return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}; }
export function pointInPolygon(p,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if(((a.y>p.y)!==(b.y>p.y)) && p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

// North-up registration: independent axis scales and translation only.
// Zero off-diagonal terms preserve horizontal/vertical walls and right angles.
export function axisAlignedMatrix(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2 || !pairs.every(p =>
    [p.from.x,p.from.y,p.to.x,p.to.y].every(Number.isFinite))) return null;
  const mean = (side,key) => pairs.reduce((sum,p)=>sum+p[side][key],0)/pairs.length;
  const fx=mean('from','x'), fy=mean('from','y'), tx=mean('to','x'), ty=mean('to','y');
  let xx=0,yy=0,xt=0,yt=0;
  for (const p of pairs) {const x=p.from.x-fx,y=p.from.y-fy;xx+=x*x;yy+=y*y;xt+=x*(p.to.x-tx);yt+=y*(p.to.y-ty);}
  if (xx<=0 || yy<=0 || xt<=0 || yt<=0) return null;
  const sx=xt/xx,sy=yt/yy;
  return [sx,0,0,sy,tx-sx*fx,ty-sy*fy];
}
export function composeMatrices(a,b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function polygonBounds(points) {
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  return {left,right,top,bottom,width:right-left,height:bottom-top,x:(left+right)/2,y:(top+bottom)/2};
}
export function constrainView(view,width,height,mapWidth,mapHeight) {
  const minScale=Math.max(width/mapWidth,height/mapHeight);
  const scale=Math.max(minScale,view.scale);
  return {scale,minScale,tx:Math.max(width-mapWidth*scale,Math.min(0,view.tx)),ty:Math.max(height-mapHeight*scale,Math.min(0,view.ty))};
}

// Contain the complete indoor footprint, with space for fixed map controls.
export function fitIndoorView(bounds,width,height) {
  const padX=Math.min(24,width*.06),padY=Math.min(70,height*.16);
  const scale=Math.min((width-2*padX)/bounds.width,(height-2*padY)/bounds.height);
  return {scale,tx:width/2-bounds.x*scale,ty:height/2-bounds.y*scale};
}
