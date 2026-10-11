import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarGeometry,avatarSVG,drawAvatarCanvas,defaultAvatar,parts,profileAvatar} from '../web/avatar.js';
import {actorAtlasData as source} from '../web/actor-atlas-data.js';

function raster(input={},options={}){
 const grid=Array.from({length:avatarGeometry.height},()=>Array(avatarGeometry.width).fill(null)),rects=[];
 drawAvatarCanvas({fillStyle:'',fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(grid[yy]?.[xx]!==undefined)grid[yy][xx]=this.fillStyle;}},input,0,0,{scale:1,...options});
 return {grid,rects};
}

test('shared reference sprite preserves grounding geometry and stored customization values',()=>{
 for(const [key,value] of Object.entries({width:48,height:64,anchorX:24,anchorY:63,walkFrames:8}))assert.equal(avatarGeometry[key],value);
 for(const [key,part] of Object.entries(parts))for(let value=0;value<part.options.length;value++)assert.equal(profileAvatar({[key]:value})[key],value);
 assert.equal(new Set(raster().grid.flat().filter(Boolean)).size>=16,true,'Pixel materials need multiple deliberate tones rather than larger flat blocks');
});

test('eight gait samples show four complete authored poses without replacing their heads',()=>{
 const sample={...defaultAvatar,hairStyle:11,shirtStyle:3,accessory:1};
 for(const facing of ['down','up','left','right']){
  const frames=Array.from({length:8},(_,walkFrame)=>raster(sample,{facing,walkFrame,walking:true}).grid);
  for(let phase=0;phase<8;phase++){
   const expected=source.frames.walk[facing][Math.floor(phase/2)].normalizedPixels.map(index=>index?source.palette[index]:null);
   assert.deepEqual(raster(defaultAvatar,{facing,walkFrame:phase,walking:true}).grid.flat(),expected,`${facing}/${phase}: whole source pose must remain intact`);
  }
  assert.equal(new Set(frames.map(frame=>JSON.stringify(frame))).size,4,`${facing}: four authored gait phases`);
  for(let phase=0;phase<8;phase+=2)assert.deepEqual(frames[phase],frames[phase+1],`${facing}: each authored frame occupies two movement samples`);
  assert.notDeepEqual(frames[0].slice(46),frames[4].slice(46),`${facing}: opposite planted feet must alternate`);
 }
});

test('phone and sitting compose in shared canvas and SVG without moving seated legs',()=>{
 const sample={hairStyle:6,shirtStyle:2,pantsStyle:1};
 const seated=raster(sample,{pose:'sit'}),seatedPhone=raster(sample,{pose:'sit',phoneOpen:true});
 assert.deepEqual(seatedPhone.grid.slice(50),seated.grid.slice(50));
 assert.notDeepEqual(seatedPhone.grid.slice(25,46),seated.grid.slice(25,46));
 assert.notEqual(avatarSVG(sample,false,{pose:'sit'}),avatarSVG(sample));
 assert.notEqual(avatarSVG(sample,false,{pose:'sit',phoneOpen:true}),avatarSVG(sample,false,{pose:'sit'}));
 assert.equal(avatarSVG(sample,true,{pose:'sit',phoneOpen:true}),avatarSVG({},true),'Juror imagery remains completely neutral');
});

test('independently authored left and right views stay distinct and malformed directions stay safe',()=>{
 const right=raster({hairStyle:7,shirtStyle:3,accessory:5},{facing:'right',walking:true,walkFrame:3}).grid;
 const left=raster({hairStyle:7,shirtStyle:3,accessory:5},{facing:'left',walking:true,walkFrame:3}).grid;
 assert.notDeepEqual(left,right);
 assert.notDeepEqual(left,right.map(row=>[...row].reverse()),'Supplied left art must not be replaced by a mirrored right view');
 assert.deepEqual(raster({},{facing:'unexpected'}).grid,raster().grid);
});

test('display scaling snaps both pixel edges so scanline artwork cannot develop hairline gaps',()=>{
 const rects=[];
 drawAvatarCanvas({fillStyle:'',fillRect(x,y,w,h){rects.push({x,y,w,h});}}, {},.25,.75,{scale:1.5});
 assert.ok(rects.length>100);
 for(const rect of rects)assert.ok(Object.values(rect).every(Number.isInteger),'Every drawn pixel edge must land on an integer canvas coordinate');
});

test('shoulders, sleeves and moving hands stay attached to the torso throughout the gait',()=>{
 for(const gender of [0,1])for(const facing of ['down','up','right','left'])for(let walkFrame=0;walkFrame<8;walkFrame++){
  const grid=raster({gender},{facing,walking:true,walkFrame}).grid,seen=new Set(),pending=[[avatarGeometry.anchorX,34]];
  while(pending.length){const [x,y]=pending.pop(),key=`${x},${y}`;if(seen.has(key)||y<25||y>=59||!grid[y]?.[x])continue;seen.add(key);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)pending.push([x+dx,y+dy]);}
  // A supplied running sleeve can reconnect below row45; follow its full drawn shape.
  for(let y=25;y<46;y++)for(let x=0;x<avatarGeometry.width;x++)if(grid[y][x])assert.ok(seen.has(`${x},${y}`),`${gender}/${facing}/${walkFrame}: detached limb or cuff at ${x},${y}`);
 }
});

const actionNames=['eat','drink','pick-litter','throw-litter','pet'];
test('world actions have four visible hand phases, a stable head and stationary feet in every facing',()=>{
 for(const action of actionNames)for(const facing of ['down','up','left','right']){
  const idle=raster({},{facing}).grid,frames=Array.from({length:4},(_,actionFrame)=>raster({},{action,actionFrame,facing,walking:true,walkFrame:3}).grid);
  assert.equal(new Set(frames.map(frame=>JSON.stringify(frame))).size,4,`${action}/${facing}: missing gesture phase`);
  for(const frame of frames){assert.deepEqual(frame.slice(0,18),idle.slice(0,18),`${action}/${facing}: crown and eyes must stay attached above mouth contact`);assert.deepEqual(frame.slice(59),idle.slice(59),`${action}/${facing}: gesture must not move the ground anchor`);}
 }
 assert.equal(new Set(actionNames.map(action=>avatarSVG({},false,{action,actionFrame:2}))).size,actionNames.length);
});

test('actions compose with sitting, phone orientation and original appearance while jury stays neutral',()=>{
 const input={gender:1,hairStyle:6,shirtStyle:2,outfit:4,headwear:3},idle=raster(input,{pose:'sit',phoneOpen:true,facing:'left'}).grid;
 for(const action of actionNames)for(let actionFrame=0;actionFrame<4;actionFrame++){
  const frame=raster(input,{pose:'sit',phoneOpen:true,action,actionFrame,facing:'left'}).grid;
  assert.deepEqual(frame.slice(50),idle.slice(50),`${action}: seated legs and feet changed`);
  assert.deepEqual(frame.slice(0,25),idle.slice(0,25),`${action}: phone-facing head changed`);
  assert.equal(avatarSVG(input,true,{pose:'sit',action,actionFrame,holding:'litter'}),avatarSVG({},true));
 }
 for(const action of actionNames)assert.equal(avatarSVG({},false,{pose:action,poseFrame:2}),avatarSVG({},false,{action,actionFrame:2}),`${action}: pose alias mismatch`);
});

test('picked litter stays visible in the hand while walking and cannot appear in headgear or jury',()=>{
 for(const facing of ['down','up','left','right'])for(let walkFrame=0;walkFrame<8;walkFrame++){
  const idle=raster({},{facing,walking:true,walkFrame}).grid,holding=raster({},{facing,walking:true,walkFrame,holding:'litter'}).grid;
  assert.notDeepEqual(holding,idle,`${facing}/${walkFrame}: held litter missing`);
  assert.deepEqual(holding.slice(0,25),idle.slice(0,25));assert.deepEqual(holding.slice(59),idle.slice(59));
 }
 assert.equal(avatarSVG({},true,{holding:'litter'}),avatarSVG({},true));
 assert.equal(avatarSVG({},false,{headOnly:true,holding:'litter',action:'pick-litter',actionFrame:2}),avatarSVG({},false,{headOnly:true}));
});

test('action pixels fit every saved costume and hands remain attached in both authored side views',()=>{
 for(const outfit of parts.outfit.options.keys())for(const facing of ['down','up','left','right'])for(const action of actionNames)for(let actionFrame=0;actionFrame<4;actionFrame++){
  const {rects}=raster({outfit,hairStyle:10,headwear:4},{facing,action,actionFrame,holding:'litter'});
  for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=avatarGeometry.width&&r.y+r.h<=64,`${outfit}/${facing}/${action}/${actionFrame}: action exceeds sprite envelope`);
 }
 for(const action of actionNames)for(let actionFrame=0;actionFrame<4;actionFrame++){
  for(const facing of ['right','left']){
   const grid=raster({},{facing,action,actionFrame}).grid,seen=new Set(),pending=[[avatarGeometry.anchorX,34]];
   while(pending.length){const [x,y]=pending.pop(),key=`${x},${y}`;if(seen.has(key)||y<20||y>=59||!grid[y]?.[x])continue;seen.add(key);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)pending.push([x+dx,y+dy]);}
   for(let y=25;y<46;y++)for(let x=0;x<avatarGeometry.width;x++)if(grid[y][x]===parts.skin.colors[defaultAvatar.skin])assert.ok(seen.has(`${x},${y}`),`${facing}/${action}/${actionFrame}: detached hand at ${x},${y}`);
  }
 }
 assert.equal(avatarSVG({},false,{action:'eat',actionFrame:99}),avatarSVG({},false,{action:'eat',actionFrame:3}));
 assert.equal(avatarSVG({},false,{action:'eat',actionFrame:NaN}),avatarSVG({},false,{action:'eat',actionFrame:0}));
});
