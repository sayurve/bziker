import test from 'node:test';
import assert from 'node:assert/strict';
import * as avatar from '../web/avatar.js';
import {actorAtlasData as source} from '../web/actor-atlas-data.js';
function draw(input={},options={}){
 const rects=[],grid=Array.from({length:avatar.avatarGeometry.height},()=>Array(avatar.avatarGeometry.width).fill(null));
 avatar.drawAvatarCanvas({fillStyle:'',fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(grid[yy]?.[xx]!==undefined)grid[yy][xx]=this.fillStyle;}},input,0,0,{scale:1,...options});
 return {rects,grid};
}
test('compact shared sprite exports its grounding geometry and preserves saved outfit IDs',()=>{
 for(const [key,value] of Object.entries({width:48,height:64,anchorX:24,anchorY:63,walkFrames:8}))assert.equal(avatar.avatarGeometry[key],value);
 assert.match(avatar.avatarSVG({}),/viewBox="0 0 48 64"/);
 assert.equal(avatar.parts.outfit.options.length,7);
 for(let outfit=0;outfit<7;outfit++)assert.equal(avatar.profileAvatar({outfit}).outfit,outfit);
});
test('eight movement samples hold four complete authored poses in their source order',()=>{
 const input={hairStyle:11,accessory:1,shirtStyle:3},frames=Array.from({length:8},(_,walkFrame)=>draw(input,{walkFrame,walking:true}));
 assert.equal(new Set(frames.map(frame=>JSON.stringify(frame.grid))).size,4);
 for(let phase=0;phase<8;phase+=2)assert.deepEqual(frames[phase].grid,frames[phase+1].grid);
 for(let phase=0;phase<8;phase++){
  const expected=source.frames.walk.down[Math.floor(phase/2)].normalizedPixels.map(index=>index?source.palette[index]:null);
  assert.deepEqual(draw({}, {walkFrame:phase,walking:true}).grid.flat(),expected,`Phase ${phase} must show the complete supplied pose, including its own head`);
 }
 assert.notDeepEqual(frames[0].grid.slice(50),frames[4].grid.slice(50),'Opposite contact phases must swap leading feet');
});
test('phone is a chest overlay with a camera-facing head and does not release a seat',()=>{
 const plain=draw({},{pose:'sit'}),phone=draw({},{pose:'sit',phoneOpen:true});
 assert.notDeepEqual(phone.grid,plain.grid,'Phone overlay must be visible while sitting');
 assert.deepEqual(phone.grid.slice(50),plain.grid.slice(50),'Phone must preserve bent legs and grounded feet');
 for(const facing of ['down','up','left','right'])assert.deepEqual(draw({hairStyle:5},{pose:'sit',phoneOpen:true,facing}).grid.slice(0,25),draw({hairStyle:5},{pose:'sit',phoneOpen:true,facing:'down'}).grid.slice(0,25));
 const phoneBlue='#83b9cb';const device=draw({},{phoneOpen:true}).rects.filter(r=>r.color===phoneBlue);
 assert.ok(device.length>0&&device.every(r=>r.y>=27&&r.y+r.h<=36&&r.x>=22&&r.x+r.w<=28),'Screen stays at upper chest between both hands');
});
test('poses, all directions and phone overlays remain inside64px and jury ignores every personal layer',()=>{
 const generic=draw({},{generic:true});
 for(const facing of ['down','up','left','right'])for(const pose of ['idle','sit','smoke'])for(const phoneOpen of [false,true]){
  for(const r of draw({outfit:6,hairStyle:10,headwear:4},{facing,pose,phoneOpen,walkFrame:7,walking:true}).rects)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=avatar.avatarGeometry.width&&r.y+r.h<=64);
 }
 for(const pose of ['idle','sit','smoke','phone'])assert.deepEqual(draw({gender:1,outfit:5,hairStyle:11},{generic:true,pose,phoneOpen:true}).rects,generic.rects);
});
