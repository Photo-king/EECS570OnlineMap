import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPosition, validPosition } from '../positioning.mjs';
const anchors = [
  { latitude: 42, longitude: -83, x: 100, y: 200 },
  { latitude: 42, longitude: -82.999, x: 500, y: 300 },
  { latitude: 42.001, longitude: -83, x: 200, y: 700 },
];
test('projects rotated/skewed calibration and midpoint', () => {
  for (const a of anchors) {
    const p = projectPosition({ ...a, accuracy: 5 }, anchors);
    assert.ok(Math.abs(p.x-a.x)<1e-6 && Math.abs(p.y-a.y)<1e-6);
  }
  const p = projectPosition({ latitude:42.0005, longitude:-82.9995, accuracy:5 }, anchors);
  assert.ok(Math.abs(p.x-350)<1e-6 && Math.abs(p.y-500)<1e-6);
});
test('rejects missing, degenerate calibration and invalid fixes', () => {
  assert.equal(projectPosition({ ...anchors[0], accuracy:5 }, []), null);
  assert.equal(projectPosition({ ...anchors[0], accuracy:5 }, [anchors[0], anchors[0], anchors[2]]), null);
  assert.equal(validPosition({latitude:91,longitude:0,accuracy:1}), false);
  assert.equal(validPosition({latitude:42,longitude:NaN,accuracy:1}), false);
});
test('uses extra anchors in a least-squares fit', () => {
  const fourth = {latitude:42.001, longitude:-82.999, x:600, y:800};
  const exact = projectPosition({...fourth,accuracy:1}, [...anchors,fourth]);
  assert.ok(Math.abs(exact.x-600)<1e-6 && Math.abs(exact.y-800)<1e-6);
  const noisy = projectPosition({...fourth,accuracy:1}, [...anchors,{...fourth,x:604}]);
  assert.ok(Math.abs(noisy.x-603)<1e-6);
});
test('First-floor five-point calibration agrees with supplied corners', async () => {
  const {floors} = await import('../map-data.js');
  const first = floors.find(f=>f.id==='first');
  for (const a of first.anchors) {
    const p = projectPosition({...a,accuracy:5},first.anchors);
    assert.ok(Math.hypot(p.x-a.x,p.y-a.y)<5);
  }
  assert.equal(floors.find(f=>f.id==='ground').anchors.length,4);
});

test('shared corners project onto every level and map extent excludes remote fixes', async () => {
  const {floors} = await import('../map-data.js');
  const {isWithinMap} = await import('../positioning.mjs');
  for (const floor of floors.filter(f=>f.id!=='union')) {
    for (const anchor of floor.anchors) {
      const projected = projectPosition({...anchor,accuracy:5},floor.anchors);
      assert.ok(Math.hypot(projected.x-anchor.x,projected.y-anchor.y)<6);
      assert.ok(isWithinMap(projected,floor.bounds));
    }
    assert.equal(isWithinMap(projectPosition({latitude:42.3,longitude:-83.8,accuracy:5},floor.anchors),floor.bounds),false);
  }
});
test('affine registration preserves rotation, scale and translation', async () => {
  const {affineMatrix,applyMatrix,pointInPolygon}=await import('../positioning.mjs');
  const from=[{x:0,y:0},{x:100,y:0},{x:0,y:100},{x:100,y:100}];
  const target=p=>({x:12+2*p.x-.5*p.y,y:30+.5*p.x+2*p.y});
  const matrix=affineMatrix(from.map(p=>({from:p,to:target(p)})));
  const actual=applyMatrix(matrix,{x:23,y:48}),expected=target({x:23,y:48});
  assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8);
  assert.ok(pointInPolygon({x:1,y:1},[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]));
  assert.equal(pointInPolygon({x:3,y:1},[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]),false);
});
test('north-up registration cannot shear or rotate floor walls',async()=>{
  const {layers,campusMatrix,projectToCampus,referenceFloor}=await import('../registration.mjs');
  const {applyMatrix}=await import('../positioning.mjs');
  for(const {matrix} of layers.values()){
    assert.equal(matrix[1],0);assert.equal(matrix[2],0);
    assert.ok(matrix[0]>0&&matrix[3]>0);
    const origin=applyMatrix(matrix,{x:0,y:0}),horizontal=applyMatrix(matrix,{x:100,y:0}),vertical=applyMatrix(matrix,{x:0,y:100});
    assert.equal(horizontal.y,origin.y);assert.equal(vertical.x,origin.x);
  }
  for(const a of referenceFloor.anchors){
    const projected=projectToCampus({...a,accuracy:0});
    const expected=applyMatrix(campusMatrix,projectPosition({...a,accuracy:0},referenceFloor.anchors));
    assert.deepEqual(projected,expected);
  }
});
test('indoor-only world preserves the original reference plan',async()=>{
  const {campusMatrix}=await import('../registration.mjs');
  assert.deepEqual(campusMatrix,[1,0,0,1,0,0]);
});
test('minimum zoom and pan bounds always cover desktop and phone viewports',async()=>{
  const {constrainView}=await import('../positioning.mjs');
  for(const [width,height] of [[1195,739],[390,453],[649,231],[1800,400],[320,700]]){
    for(const scale of [.01,.2,1,3])for(const tx of [-1e6,0,1e6])for(const ty of [-1e6,0,1e6]){
      const v=constrainView({scale,tx,ty},width,height,1842,1208);
      assert.equal(v.minScale,Math.max(width/1842,height/1208));
      assert.ok(v.tx<=1e-8&&v.ty<=1e-8);
      assert.ok(v.tx+1842*v.scale>=width-1e-8);
      assert.ok(v.ty+1208*v.scale>=height-1e-8);
    }
  }
});

test('minimum indoor zoom contains the entire floor on each device',async()=>{
  const {fitIndoorView,polygonBounds}=await import('../positioning.mjs');
  const {layers}=await import('../registration.mjs');
  for(const {polygon} of layers.values())for(const [w,h] of [[1195,739],[390,453],[649,231]]){
    const box=polygonBounds(polygon),v=fitIndoorView(box,w,h);
    assert.ok(box.left*v.scale+v.tx>=0&&box.right*v.scale+v.tx<=w);
    assert.ok(box.top*v.scale+v.ty>=0&&box.bottom*v.scale+v.ty<=h);
  }
});
