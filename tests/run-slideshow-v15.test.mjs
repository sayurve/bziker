import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarRaster,defaultAvatar,avatarGeometry} from '../web/avatar.js';
import {actorAtlasData as atlas} from '../web/actor-atlas-data.js';

test('running displays each complete supplied frame without an idle-head transplant',()=>{
 for(const facing of atlas.directions)for(let frame=0;frame<4;frame++){
  const expected=atlas.frames.walk[facing][frame].normalizedPixels.map(i=>i?atlas.palette[i]:null);
  const actual=avatarRaster(defaultAvatar,{facing,walking:true,walkFrame:frame*2});
  assert.deepEqual(actual.grid,expected,`${facing}/${frame}: display the whole authored frame`);
 }
});
test('running is exactly a four-image slideshow with no generated intermediate pose',()=>{
 for(const facing of atlas.directions){
  const frames=Array.from({length:8},(_,walkFrame)=>avatarRaster(defaultAvatar,{facing,walking:true,walkFrame}));
  for(let frame=0;frame<4;frame++)assert.equal(frames[frame*2],frames[frame*2+1]);
  assert.equal(new Set(frames).size,4);
  assert.equal(avatarRaster(defaultAvatar,{facing,walking:true,walkFrame:8}),frames[0]);
 }
});
test('all supplied run frames share a uniform scale and have room for the full stride',()=>{
 const frames=atlas.directions.flatMap(d=>atlas.frames.walk[d]);
 assert.equal(new Set(frames.map(f=>f.scale.x)).size,1,'Do not resize each frame separately');
 for(const f of frames){
  assert.equal(f.scale.x,f.scale.y,'Never stretch only the legs');
  const left=avatarGeometry.anchorX+(f.opaqueBounds.x-f.sourceAnchor.x)*f.scale.x;
  const right=left+f.opaqueBounds.w*f.scale.x;
  assert.ok(left>=0&&right<=avatarGeometry.width,`${f.id}: stride is clipped`);
  assert.equal(f.normalizedPixels.findLastIndex(Boolean)/avatarGeometry.width|0,62,'Common ground contact');
 }
});
test('transparent frame padding never samples a neighbouring character in the source sheet',()=>{
 for(const kind of ['idle','walk'])for(const facing of atlas.directions)for(const f of kind==='idle'?[atlas.frames.idle[facing]]:atlas.frames.walk[facing]){
  for(let y=0;y<avatarGeometry.height;y++)for(let x=0;x<avatarGeometry.width;x++){
   if(!f.normalizedPixels[y*avatarGeometry.width+x])continue;
   const sx=Math.floor(f.sourceAnchor.x+(x+.5-avatarGeometry.anchorX)/f.scale.x),sy=Math.floor(f.sourceAnchor.y+(y+.5-avatarGeometry.anchorY)/f.scale.y),c=f.sourceCell;
   assert.ok(sx>=c.x&&sx<c.x+c.w&&sy>=c.y&&sy<c.y+c.h,`${f.id}: a neighbouring sprite leaked into the padding`);
  }
 }
});
