import test from 'node:test';
import assert from 'node:assert/strict';
import * as effects from '../web/action-effects.js';
import {drawAvatarCanvas,avatarSVG,parts,avatarGeometry} from '../web/avatar.js';

function raster(options={},input={}){
 const grid=Array.from({length:avatarGeometry.height},()=>Array(avatarGeometry.width).fill(null)),rects=[];
 drawAvatarCanvas({fillStyle:'',fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(grid[yy]?.[xx]!==undefined)grid[yy][xx]=this.fillStyle;}},input,0,0,{scale:1,...options});
 return {grid,rects};
}
const effect=(type,duration=3)=>({id:type,type,started_at:100,duration,x:180,y:220});
test('cigarette is a server-timed sequence with retrieval, contact pause, exhale and lowering',()=>{
 assert.equal(typeof effects.actionPoseState,'function');
 const samples=[.04,.18,.32,.48,.66,.80,.90,.98].map(p=>effects.actionPoseState('smoke',p));
 assert.deepEqual(samples.map(s=>s.stage),['retrieve','raise','inhale','hold','exhale','lower','rest','finish']);
 const active=effects.actionEffectState(effect('smoke',8),104);
 assert.equal(active.stage,'hold');assert.equal(active.progress,.5);
 assert.equal(effects.actionEffectState(effect('smoke',8),108),null);
 for(const state of samples)assert.ok(Number.isInteger(state.poseFrame));
});
test('food and drink hold at the mouth before lowering; pickup bends before it holds; throw releases',()=>{
 assert.equal(typeof effects.actionPoseState,'function');
 assert.equal(effects.actionPoseState('eat',.55).stage,'chew');
 assert.equal(effects.actionPoseState('drink',.55).stage,'sip-hold');
 assert.equal(effects.actionPoseState('pick-litter',.3).stage,'crouch');
 assert.equal(effects.actionPoseState('pick-litter',.8).stage,'hold');
 assert.equal(effects.actionPoseState('throw-litter',.5).stage,'flight');
 assert.equal(effects.actionPoseState('unknown',.5),null);
});
test('smoking uses distinct attached arm poses and one fixed ground anchor, including a seat and phone',()=>{
 const samples=[.04,.18,.32,.48,.66,.80,.90,.98];
 for(const facing of ['down','up','right','left']){
  const frames=samples.map(actionProgress=>raster({action:'smoke',actionProgress,facing}).grid);
  assert.ok(new Set(frames.map(grid=>JSON.stringify(grid))).size>=7);
  const neutral=raster({facing}).grid;
  for(const frame of frames)assert.deepEqual(frame.slice(59),neutral.slice(59));
 }
 const sitting=raster({pose:'sit',phoneOpen:true,facing:'left'}).grid;
 for(const actionProgress of samples){
  const frame=raster({pose:'sit',phoneOpen:true,facing:'left',action:'smoke',actionProgress}).grid;
  assert.deepEqual(frame.slice(50),sitting.slice(50));
  assert.ok(frame.slice(35,44).some(row=>row.slice(22,28).includes('#83b9cb')),'The phone remains visible in the supporting hand');
 }
 assert.equal(avatarSVG({outfit:5},true,{action:'smoke',actionProgress:.6}),avatarSVG({},true));
});
test('pickup has articulated knee and upper body poses while feet remain planted and held paper persists',()=>{
 const idle=raster({facing:'right'}).grid,crouch=raster({facing:'right',action:'pick-litter',actionProgress:.3}).grid;
 assert.notDeepEqual(crouch.slice(25,59),idle.slice(25,59));
 assert.notDeepEqual(crouch.slice(0,25),idle.slice(0,25),'The head follows the drawn bend');
 assert.deepEqual(crouch.slice(59),idle.slice(59),'The real foot anchor stays on the ground');
 const held=raster({facing:'right',action:'pick-litter',actionProgress:.85}).rects;
 assert.ok(held.some(r=>r.color==='#f6f3e7'&&r.y>=30));
});
test('throw flight starts at the releasing hand and lands at the actual target rather than the sprite edge',()=>{
 assert.equal(typeof effects.actionFlight,'function');
 const action=effect('throw-litter'),actor={x:80,y:200,facing:'right'};
 assert.equal(effects.actionFlight(action,actor,100.2),null);
 const start=effects.actionFlight(action,actor,100+3*.4),middle=effects.actionFlight(action,actor,100+3*.575),end=effects.actionFlight(action,actor,100+3*.75);
 assert.ok(start&&middle&&end);assert.ok(start.x<actor.x+25&&start.x>actor.x);
 assert.ok(middle.x>start.x&&middle.x<end.x);
 assert.ok(middle.y<Math.min(start.y,end.y),'Paper has a short visible arc');
 assert.equal(end.x,action.x);assert.equal(end.y,action.y-34);
 assert.equal(effects.actionFlight(action,actor,102.8),null);
 assert.equal(effects.actionFlight(action,actor,101.5,true),null);
});
test('all continuous action poses fit every saved costume and preserve integer pixel drawing',()=>{
 for(const action of ['smoke','eat','drink','pick-litter','throw-litter','pet'])for(const outfit of parts.outfit.options.keys())for(const facing of ['down','up','right','left'])for(const actionProgress of [.04,.18,.32,.48,.66,.80,.90,.98]){
  const {rects}=raster({action,actionProgress,facing},{outfit,hairStyle:10,headwear:4});
  for(const r of rects)assert.ok(Number.isInteger(r.x)&&Number.isInteger(r.y)&&r.x>=0&&r.y>=0&&r.x+r.w<=avatarGeometry.width&&r.y+r.h<=64);
 }
});
test('malformed timeline keys and progress cannot expose object properties or start a pose',()=>{
 assert.equal(effects.actionPoseState('constructor',.5),null);
 assert.equal(effects.actionPoseState('toString',.5),null);
 assert.equal(effects.actionPoseState('eat',NaN),null);
 assert.equal(effects.actionPoseState('drink',Infinity),null);
 assert.equal(effects.actionPoseState('eat',-1).stage,'retrieve');
 assert.equal(effects.actionPoseState('eat',1).stage,'finish');
});
test('flying paper draws one coherent pixel cluster and mirrors the release origin',()=>{
 const shapes=[],context={fillStyle:'',fillRect(x,y,w,h){shapes.push({x,y,w,h,color:this.fillStyle});}},action=effect('throw-litter');
 const right=effects.actionFlight(action,{x:80,y:200,facing:'right'},101.2),left=effects.actionFlight(action,{x:80,y:200,facing:'left'},101.2);
 assert.ok(Math.abs((right.x-80)-(80-left.x))<1e-8);
 effects.drawActionFlight(context,action,{x:80,y:200,facing:'right'},101.5);
 assert.ok(shapes.length>3);
 for(const shape of shapes)assert.ok([shape.x,shape.y,shape.w,shape.h].every(Number.isInteger));
 const before=shapes.length;effects.drawActionFlight(context,action,{x:80,y:200,facing:'right'},101.5,true);assert.equal(shapes.length,before);
 assert.equal(effects.actionFlight(action,{x:NaN,y:200},101.5),null);
});
