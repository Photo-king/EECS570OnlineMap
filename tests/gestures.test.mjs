import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pinchView} from '../gestures.mjs';
test('pinch preserves the geographic point under the moving finger midpoint',()=>{
  const start={scale:.5,tx:-100,ty:20},origin={x:150,y:200},center={x:170,y:220};
  const next=pinchView(start,origin,center,2,.2,20);
  assert.equal(next.scale,1);
  assert.equal((origin.x-start.tx)/start.scale,(center.x-next.tx)/next.scale);
  assert.equal((origin.y-start.ty)/start.scale,(center.y-next.ty)/next.scale);
});
test('pinch clamps both scale limits without changing the anchor',()=>{
  const start={scale:1,tx:20,ty:30},origin={x:100,y:100};
  for(const [ratio,expected] of [[.001,.5],[100,4]]){
    const next=pinchView(start,origin,origin,ratio,.5,4);
    assert.equal(next.scale,expected);
    assert.equal((origin.x-next.tx)/next.scale,80);
    assert.equal((origin.y-next.ty)/next.scale,70);
  }
});
