import {floors} from './map-data.js';
import {footprints} from './map-footprints.js';
import {axisAlignedMatrix,composeMatrices,applyMatrix,projectPosition} from './positioning.mjs';
export const referenceFloor=floors.find(f=>f.id==='first');
// Indoor-only world uses the original First-floor SVG coordinates.
export const campusMatrix=[1,0,0,1,0,0];
// Each plan registers to a common building frame, without any shear or rotation.
export const layers=new Map(floors.filter(f=>f.id!=='union').map(f=>{
  const local=f.id==='first'?[1,0,0,1,0,0]:axisAlignedMatrix(f.anchors.map(a=>({from:a,to:referenceFloor.anchors.find(p=>p.id===a.id)})));
  const matrix=composeMatrices(campusMatrix,local);
  return [f.id,{matrix,polygon:footprints[f.id].map(p=>applyMatrix(matrix,p))}];
}));
export function projectToCampus(position) {
  const point=projectPosition(position,referenceFloor.anchors);
  return point?applyMatrix(campusMatrix,point):null;
}
