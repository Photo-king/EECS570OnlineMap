import { bindMapGestures } from './gestures.mjs';
import { floors } from './map-data.js';
import { layers, projectToCampus } from './registration.mjs';
import { validPosition, isWithinMap, pointInPolygon, polygonBounds, fitIndoorView } from './positioning.mjs';
// Development-only controls: disabled in the shared site. No URL override.
const ENABLE_LOCATION_DEBUG = false;
const $ = s => document.querySelector(s), viewport=$('#viewport'), scene=$('#scene');
$('#toggle-coordinates').hidden=!ENABLE_LOCATION_DEBUG;
$('#coordinate-body').hidden=!ENABLE_LOCATION_DEBUG;
$('#coordinate-body').inert=!ENABLE_LOCATION_DEBUG;
for(const control of $('#test-form').querySelectorAll('input,button')) control.disabled=!ENABLE_LOCATION_DEBUG;
let floor=floors[0], scale=1, minScale=.1, tx=0, ty=0;
let watchId=null, position=null, expiry=null, watchGeneration=0, mode='gps', lastFixFailed=false;
function indoorBounds(){return polygonBounds(layers.get(floor.id==='union'?'first':floor.id).polygon);}
function fittedView(){
  if(floor.id!=='union')return fitIndoorView(indoorBounds(),viewport.clientWidth,viewport.clientHeight);
  const padding=window.innerWidth<=600?8:16;
  const scale=Math.min((viewport.clientWidth-padding*2)/floor.width,(viewport.clientHeight-padding*2)/floor.height);
  return {scale,tx:(viewport.clientWidth-floor.width*scale)/2,ty:(viewport.clientHeight-floor.height*scale)/2};
}
function transform(){
  const fitted=fittedView();
  minScale=fitted.scale;scale=Math.max(minScale,scale);
  // At minimum zoom always restore the complete, centered floor plan.
  if(scale<=minScale*(1+1e-8)){scale=minScale;tx=fitted.tx;ty=fitted.ty;}
  const activeScene=floor.id==='union'?$('#overview-scene'):scene;
  activeScene.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
  scene.style.setProperty('--inverse-scale',1/scale);$('#zoom-value').textContent=Math.round(scale/minScale*100)+'%';
}
function fit(){const view=fittedView();({scale,tx,ty}=view);transform();}
function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2){
  const next=Math.max(minScale,Math.min(Math.max(20,minScale),scale*factor));
  tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;transform();
}
function status(message){$('#location-status').textContent=message;}
function worldPosition(){return position&&projectToCampus(position);}
function renderPosition(){
  const marker=$('#user-position');marker.hidden=true;$('#center-location').disabled=true;
  $('#source-label').textContent=mode==='test'?'MANUAL TEST · WGS84':'LIVE GPS · WGS84';
  $('#source-label').classList.toggle('test-source',mode==='test');
  $('#marker-label').textContent=mode==='test'?'Test':'You';marker.classList.toggle('test-position',mode==='test');
  $('#resume-gps').hidden=mode!=='test';
  if(!position)return;
  $('#latitude').textContent=position.latitude.toFixed(8);$('#longitude').textContent=position.longitude.toFixed(8);
  $('#accuracy').textContent=mode==='test'?'Test input':`±${Math.round(position.accuracy)} m`;
  $('#updated').textContent=new Date(position.timestamp).toLocaleTimeString();$('#copy-coordinates').disabled=false;
  if(floor.id==='union')return;
  const p=worldPosition(),stale=mode!=='test'&&(lastFixFailed||Date.now()-position.timestamp>30000);
  marker.classList.toggle('stale',stale);
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)){status('Waiting for a valid position…');return;}
  // Render every valid fix. The viewport clips off-screen dots, not the building bounds.
  marker.style.left=p.x+'px';marker.style.top=p.y+'px';marker.hidden=false;$('#center-location').disabled=false;
  const polygon=layers.get(floor.id==='union'?'first':floor.id).polygon;
  const inside=pointInPolygon(p,polygon);
  marker.setAttribute('aria-label',`${mode==='test'?'Test position':'Your location'} · ${inside?'inside building':'outside building'}`);
  if(stale){status('Last known position · waiting for a fresh GPS fix…');return;}
  status(ENABLE_LOCATION_DEBUG
    ? `${mode==='test'?'TEST · ':''}${inside?'Inside Dental & Kellogg':'Outside building outline'} · ${floor.name} · ±${Math.round(position.accuracy)} m`
    : `Location active · ${floor.name}`);
}
function renderReference(){
  const content=$('#reference-content');
  if(floor.id==='union'){
    content.innerHTML='<h3>Dental & Kellogg</h3><p>The green outline marks the building. Choose G, 1 or 2 to explore a floor plan.</p><h3>Choose a destination</h3><ul><li>Ground · Café 32, Sindecuse Atrium, Kellogg Auditorium, G360 SIM Lab</li><li>First · Check-in, Orthodontics, McCauley clinics, room 1033</li><li>Second · Pediatrics, Oral Surgery, DFA, Grad Restorative</li></ul><p>North is up.</p><details><summary>Original 3D reference</summary><img src="Mapsv1.0/Dental_Kellog_Union.png" alt="Original three-floor reference diagram"></details>';
  }else{
    content.innerHTML=`<h3>${floor.name} · destinations & notes</h3><img src="public/maps/${floor.id}-notes.svg" alt="${floor.name} destination directory and museum exhibit notes"><h3>Map key & area colors</h3><img src="public/maps/first-key.svg" alt="Elevator, stairs, restroom and area color key"><p>Blue: your location. Gray: last known position.</p>`;
  }
}
function renderFloor(){
  endDrag();
  const overview=floor.id==='union';
  $('main').classList.toggle('overview',overview);
  viewport.classList.toggle('ground-floor',floor.id==='ground');
  $('#overview-view').hidden=!overview;
  $('#scene').hidden=overview;
  $('#floor-title').textContent=floor.name;$('#map-label').textContent=floor.id==='union'?'BUILDING OVERVIEW':`DENTAL & KELLOGG · ${floor.name.toUpperCase()}`;
  $('#empty').hidden=true;const image=$('#map');image.hidden=floor.id==='union';
  if(floor.id!=='union'){image.src=floor.buildingMap;image.alt=`${floor.name}, Dental & Kellogg`;image.style.transform=`matrix(${layers.get(floor.id).matrix.join(',')})`;}
  $('#floors').replaceChildren(...floors.map(f=>{const b=document.createElement('button');b.className='floor'+(f.id===floor.id?' active':'');b.setAttribute('aria-pressed',String(f.id===floor.id));b.innerHTML=`<strong>${f.label}</strong><span>${f.name}<small>${f.id==='union'?'Building & levels':'Dental & Kellogg'}</small></span>`;b.onclick=()=>selectFloor(f.id);return b;}));
  renderReference();renderPosition();fit();
}
function selectFloor(id,updateUrl=true){floor=floors.find(f=>f.id===id)||floors[0];if(updateUrl){const u=new URL(location.href);u.searchParams.set('level',floor.id);history.replaceState(null,'',u);}renderFloor();}
function clearWatch(){watchGeneration++;if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;clearTimeout(expiry);}
function resetReadout(){for(const id of ['latitude','longitude','accuracy','updated'])$('#'+id).textContent='—';$('#copy-coordinates').disabled=true;$('#center-location').disabled=true;$('#user-position').hidden=true;}
function stopLocation(message){clearWatch();position=null;lastFixFailed=false;resetReadout();status(message);}
function startLocation(){
  if(watchId!==null)return;
  mode='gps';position=null;lastFixFailed=false;resetReadout();renderPosition();
  if(!window.isSecureContext){status('Location requires HTTPS or localhost.');return;}
  if(!navigator.geolocation){status('This browser does not support location.');return;}
  const generation=++watchGeneration;status('Waiting for location permission and a GPS fix…');
  watchId=navigator.geolocation.watchPosition(result=>{
    if(generation!==watchGeneration||mode!=='gps')return;
    const next={latitude:result.coords.latitude,longitude:result.coords.longitude,accuracy:result.coords.accuracy,timestamp:result.timestamp};
    if(!validPosition(next)||!Number.isFinite(next.timestamp)){lastFixFailed=true;renderPosition();status('Invalid GPS fix. Waiting for the next update…');return;}
    position=next;lastFixFailed=false;renderPosition();clearTimeout(expiry);expiry=setTimeout(renderPosition,Math.max(0,30001-(Date.now()-position.timestamp)));
  },error=>{
    if(generation!==watchGeneration||mode!=='gps')return;
    if(error.code===1){stopLocation('Location permission denied. Allow access in browser settings, then try again.');return;}
    lastFixFailed=true;renderPosition();status(position?'GPS temporarily unavailable. Showing the last known position; retrying…':'Waiting for a GPS fix; retrying automatically…');
  },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}
$('#test-form').onsubmit=e=>{
  e.preventDefault();if(!ENABLE_LOCATION_DEBUG)return;const lat=$('#test-latitude').value.trim(),lon=$('#test-longitude').value.trim();
  const test={latitude:Number(lat),longitude:Number(lon),accuracy:0,timestamp:Date.now()};
  if(!lat||!lon||!validPosition(test)){$('#test-error').textContent='Enter latitude −90 to 90 and longitude −180 to 180.';return;}
  clearWatch();mode='test';position=test;lastFixFailed=false;$('#test-error').textContent='';renderPosition();
  if(isWithinMap(worldPosition(),indoorBounds()))$('#center-location').click();
};
$('#resume-gps').onclick=()=>{if(ENABLE_LOCATION_DEBUG)startLocation();};
$('#center-location').onclick=()=>{const p=worldPosition();if(!p)return;scale=Math.max(scale,minScale*1.25);tx=viewport.clientWidth/2-p.x*scale;ty=viewport.clientHeight/2-p.y*scale;transform();};
$('#toggle-coordinates').onclick=()=>{if(!ENABLE_LOCATION_DEBUG)return;const hidden=!$('#coordinate-body').hidden;$('#coordinate-body').hidden=hidden;$('#toggle-coordinates').setAttribute('aria-expanded',String(!hidden));$('#toggle-coordinates').textContent=hidden?'Coordinates ▾':'Coordinates ▴';requestAnimationFrame(fit);};
async function copy(text,message){try{await navigator.clipboard.writeText(text);$('#announcement').textContent=message;}catch{window.prompt(message,text);}}
$('#copy-coordinates').onclick=()=>ENABLE_LOCATION_DEBUG&&position&&copy(`${position.latitude.toFixed(8)}, ${position.longitude.toFixed(8)}`,'Coordinates copied');
$('#share').onclick=()=>{const u=new URL(location.href);u.searchParams.set('level',floor.id);copy(u.href,'Level link copied');};
viewport.addEventListener('wheel',e=>{if(e.target.closest('#map-reference'))return;e.preventDefault();const r=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
const gestures=bindMapGestures(viewport,{
  getView:()=>({scale,tx,ty,minScale,maxScale:Math.max(20,minScale)}),
  setView:view=>{({scale,tx,ty}=view);transform();},
});
function endDrag(){gestures.cancel();}
$('#plus').onclick=()=>zoom(1.25);$('#minus').onclick=()=>zoom(.8);$('#fit').onclick=fit;
for(const id of ['map','overview-map']){$('#'+id).onerror=()=>$('#empty').hidden=false;}
window.addEventListener('resize',fit);window.addEventListener('popstate',()=>selectFloor(new URL(location.href).searchParams.get('level'),false));window.addEventListener('pagehide',()=>clearWatch());
// References start collapsed to leave room for the map; their state survives floor changes.
$('#map-reference').open=false;
if(window.innerHeight<=500){$('#coordinate-body').hidden=true;$('#toggle-coordinates').setAttribute('aria-expanded','false');$('#toggle-coordinates').textContent='Coordinates ▾';}
selectFloor(new URL(location.href).searchParams.get('level'),false);
// Request browser permission on entry, including the static overview homepage.
startLocation();
window.addEventListener('pageshow',event=>{if(event.persisted&&mode==='gps')startLocation();});
