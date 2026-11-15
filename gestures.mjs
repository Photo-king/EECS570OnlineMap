// Screen-space view math shared by indoor plans and the original overview.
export function pinchView(start, origin, center, ratio, minScale, maxScale) {
  const scale=Math.max(minScale,Math.min(maxScale,start.scale*ratio));
  const actualRatio=scale/start.scale;
  return {scale,tx:center.x-(origin.x-start.tx)*actualRatio,ty:center.y-(origin.y-start.ty)*actualRatio};
}

export function bindMapGestures(viewport,{getView,setView}) {
  const points=new Map();let baseline=null;
  const local=e=>{const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const pair=()=>{const [a,b]=[...points.values()];return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y)};};
  function rebase(){baseline=points.size?{view:{...getView()},point:[...points.values()][0],pair:points.size===2?pair():null}:null;}
  function cancel(){const ids=[...points.keys()];points.clear();baseline=null;viewport.classList.remove('dragging');for(const id of ids)if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,details,input,a')||(e.pointerType==='mouse'&&e.button!==0)||points.size>=2)return;
    points.set(e.pointerId,local(e));viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');rebase();
  });
  viewport.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId)||!baseline)return;
    points.set(e.pointerId,local(e));
    if(points.size===2){const current=pair(),view=getView();setView(pinchView(baseline.view,baseline.pair.center,current.center,current.distance/Math.max(1,baseline.pair.distance),view.minScale,view.maxScale));}
    else{const p=points.get(e.pointerId);setView({...baseline.view,tx:baseline.view.tx+p.x-baseline.point.x,ty:baseline.view.ty+p.y-baseline.point.y});}
  });
  function end(e){if(!points.delete(e.pointerId))return;rebase();if(!points.size)viewport.classList.remove('dragging');}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,end);
  return {cancel};
}
