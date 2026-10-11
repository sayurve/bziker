import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarGeometry,drawAvatarCanvas,defaultAvatar,avatarRaster,avatarSVG,parts,profileAvatar} from '../web/avatar.js';
import {actorAtlasData as source} from '../web/actor-atlas-data.js';
import {actorHairData as hairSource} from '../web/actor-hair-data.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const raster=(input={},options={})=>{
 const grid=Array.from({length:avatarGeometry.height},()=>Array(avatarGeometry.width).fill(null));
 drawAvatarCanvas({fillStyle:'',fillRect(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(grid[yy]?.[xx]!==undefined)grid[yy][xx]=this.fillStyle;}},input,0,0,{scale:1,...options});
 return grid;
};
test('the complete source stride fits a48×64 grounded portrait with four authored poses in the existing eight-sample gait',()=>{
 assert.equal(avatarGeometry.width,48);assert.equal(avatarGeometry.height,64);
 assert.equal(avatarGeometry.anchorX,24);assert.equal(avatarGeometry.anchorY,63);
 assert.equal(avatarGeometry.walkFrames,8);
});
test('female is slightly shorter and has a narrower waist with the same grounded feet',()=>{
 const male=raster({...defaultAvatar,gender:0}),female=raster({...defaultAvatar,gender:1});
 const first=g=>g.findIndex(row=>row.some(Boolean)),last=g=>g.findLastIndex(row=>row.some(Boolean));
 assert.ok(first(female)>first(male),'Female crown should be slightly lower');
 assert.ok(first(female)-first(male)<=5,'The difference is small');
 assert.equal(last(female),last(male),'Ground contact must remain shared');
 const width=(g,y)=>g[y].filter(Boolean).length;
 assert.ok(width(female,40)<width(male,40),'Female waist should be visibly narrower');
});
test('all four canonical idle portraits retain every sampled pixel from the supplied image',()=>{
 for(const facing of source.directions){
  const expected=source.frames.idle[facing].normalizedPixels.map(i=>i?source.palette[i]:null);
  assert.deepEqual(avatarRaster(defaultAvatar,{facing}).grid,expected,`${facing}: source art changed`);
 }
});
test('both supplied original files are retained byte for byte with recorded hashes',()=>{
 for(const item of Object.values(source.sources)){
  const bytes=readFileSync(new URL('..'+item.url,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
 }
});
test('all sixteen complete supplied poses are reachable without an idle head transplant',()=>{
 for(const facing of source.directions)for(let index=0;index<4;index++){
  const animated=avatarRaster(defaultAvatar,{facing,walking:true,walkFrame:index*2}).grid;
  const expected=source.frames.walk[facing][index].normalizedPixels.map(i=>i?source.palette[i]:null);
  assert.deepEqual(animated,expected,`${facing}/${index}: supplied complete pose changed`);
  assert.deepEqual(avatarRaster(defaultAvatar,{facing,walking:true,walkFrame:index*2+1}).grid,expected,`${facing}/${index}: held source pose changed`);
 }
});
test('saved appearance IDs remain valid and sensitive nickname properties do not enter the sprite',()=>{
 for(const [key,p] of Object.entries(parts))for(let value=0;value<p.options.length;value++)assert.equal(profileAvatar({[key]:value})[key],value);
 assert.equal(avatarSVG({...defaultAvatar,nickname:'<script>'}),avatarSVG(defaultAvatar));
 assert.doesNotMatch(readFileSync(new URL('../web/avatar.js',import.meta.url),'utf8'),/contactSteps|function pixels|hairStamp/);
});
test('female movement uses complete discrete poses with slightly shorter stature and shared ground contact',()=>{
 const first=g=>Math.floor(g.findIndex(Boolean)/avatarGeometry.width);
 const last=g=>Math.floor(g.findLastIndex(Boolean)/avatarGeometry.width);
 for(const facing of source.directions){
  const femaleFrames=[];
  for(let walkFrame=0;walkFrame<8;walkFrame++){
   const male=avatarRaster(defaultAvatar,{facing,walking:true,walkFrame}).grid;
   const female=avatarRaster({...defaultAvatar,gender:1},{facing,walking:true,walkFrame}).grid;
   assert.ok(first(female)>first(male),`${facing}/${walkFrame}: female crown is slightly lower`);
   assert.ok(first(female)-first(male)<=4,`${facing}/${walkFrame}: female stature difference stays small`);
   assert.equal(last(female),last(male),`${facing}/${walkFrame}: grounded boots stay on the same baseline`);
   femaleFrames.push(female);
  }
  assert.equal(new Set(femaleFrames.map(frame=>JSON.stringify(frame))).size,4,`${facing}: four whole female poses are required`);
  for(let walkFrame=0;walkFrame<8;walkFrame+=2)assert.deepEqual(femaleFrames[walkFrame],femaleFrames[walkFrame+1]);
 }
});
test('hair-only variants preserve the approved eyes and keep shoulders connected',()=>{
 for(const gender of [0,1]){
  const base=avatarRaster({...defaultAvatar,gender},{facing:'down'}).grid;
  const offset=gender?5:0;
  for(let hairStyle=1;hairStyle<12;hairStyle++){
   const variant=avatarRaster({...defaultAvatar,gender,hairStyle},{facing:'down'}).grid;
   for(let y=16+offset;y<21+offset;y++)for(let x=16;x<=23;x++)assert.equal(variant[y*avatarGeometry.width+x+4],base[y*avatarGeometry.width+x+4],`eye/face ${gender}/${hairStyle}/${x}/${y}`);
   for(let y=28+offset;y<34+offset;y++)assert.ok(variant.slice(y*avatarGeometry.width+20,y*avatarGeometry.width+28).some(Boolean),'Neck and jacket must not float apart');
  }
 }
});
test('continuous action progress reuses rendered poses instead of allocating a bitmap for every timestamp',()=>{
 const sameA=avatarRaster(defaultAvatar,{action:'smoke',actionProgress:.04});
 const sameB=avatarRaster(defaultAvatar,{action:'smoke',actionProgress:.05});
 assert.equal(sameA,sameB,'Same visible phase reuses a raster object');
 const poses=new Set();for(let i=0;i<180;i++)poses.add(avatarRaster(defaultAvatar,{action:'smoke',actionProgress:i/180}));
 assert.ok(poses.size<=8,`${poses.size} cached poses exceed the eight authored smoke phases`);
});
test('the phone screen stays visible through seated and standing concurrent actions in every direction',()=>{
 for(const gender of [0,1])for(const facing of source.directions)for(const pose of ['idle','sit'])for(const action of ['eat','drink','smoke','throw-litter'])for(const actionProgress of [.04,.18,.32,.48,.66,.8,.9,.98]){
  const frame=avatarRaster({...defaultAvatar,gender},{facing,pose,phoneOpen:true,action,actionProgress});
  assert.ok(frame.grid.includes('#83b9cb'),`${gender}/${facing}/${pose}/${action}/${actionProgress}: phone screen is obscured`);
 }
});
test('long hair retains its own material when a costume or short sleeve is selected',()=>{
 const frame=hairSource.frames.long.down;
 for(const gender of [0,1]){
  const offset=gender?5:0,base=avatarRaster({...defaultAvatar,gender,hairStyle:6}).grid;
  for(const appearance of [{outfit:4},{shirtStyle:0}]){
   const changed=avatarRaster({...defaultAvatar,gender,hairStyle:6,...appearance}).grid;
   let compared=0;
   for(let y=25;y<40;y++)for(let x=0;x<40;x++)if(frame.hairMask[y*40+x]&&(x<13||x>27)&&base[(y+offset)*avatarGeometry.width+x+4]){
    assert.equal(changed[(y+offset)*avatarGeometry.width+x+4],base[(y+offset)*avatarGeometry.width+x+4],`Hair tip became clothing/skin at ${gender}/${x}/${y+offset}`);compared++;
   }
   assert.ok(compared>0,'Long strands must be observed outside the shoulders');
  }
 }
});
