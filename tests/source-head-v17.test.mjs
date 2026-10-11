import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {loadSourceActor,sourceActorFrame} from '../web/source-actors.js';
import {avatarRaster,avatarSVG,headgearSVG,drawAvatarCanvas,defaultAvatar} from '../web/avatar.js';
import {catalogPartSVG} from '../web/profile-builder.js';
const require=createRequire(process.execPath),{createCanvas,loadImage}=require('@napi-rs/canvas');
for(const id of ['human-male','human-female'])await loadSourceActor(id,{createCanvas,loadImage:path=>loadImage(fileURLToPath(new URL('../'+path,import.meta.url)))});

test('loaded head and headwear previews use the native source atlas rather than the retired reference renderer',async()=>{
 for(const gender of [0,1]){
  const avatar={...defaultAvatar,gender},head=avatarRaster(avatar,{headOnly:true}),frame=sourceActorFrame(avatar);
  // The standing body is rebalanced to the running proportions. Head-only
  // previews still preserve the supplied portrait pixel for pixel, so their
  // independent reference must be the original atlas, not that body pose.
  const native=createCanvas(48,64).getContext('2d'),r=frame.rect;
  native.drawImage(await loadImage(fileURLToPath(new URL('../'+frame.atlas,import.meta.url))),r.x,r.y,r.w,r.h,0,0,48,64);
  const rgba=native.getImageData(0,0,48,64).data,full={grid:Array.from({length:48*64},(_,n)=>rgba[n*4+3]>127?'#'+Array.from(rgba.slice(n*4,n*4+3)).map(v=>v.toString(16).padStart(2,'0')).join(''):null)};
  assert.match(head.key,/^source-v17:/);assert.equal(head.width,48);assert.equal(head.height,40);assert.ok(head.runs.length);
  for(let y=frame.head.top;y<head.sourceCrop.chin;y++)for(let x=frame.head.left;x<=frame.head.right;x++)assert.equal(head.grid[(y+head.sourceCrop.offsetY)*head.width+x],full.grid[y*48+x],'the native face and hair must be copied, not reconstructed');
  // The supplied head box includes the neck and grey collar. Neither the
  // original collar nor its tint can survive in a head-only portrait.
  for(let y=head.sourceCrop.chin;y<=frame.head.bottom;y++)for(let x=frame.head.left;x<=frame.head.right;x++){
   const original=full.grid[y*48+x],cropped=head.grid[(y+head.sourceCrop.offsetY)*48+x];if(!original)continue;
   const rgb=[1,3,5].map(i=>parseInt(original.slice(i,i+2),16));
   if(rgb[0]>35&&Math.max(...rgb)-Math.min(...rgb)<22)assert.equal(cropped,null,'native collar survived head-only cropping');
   if(y>head.sourceCrop.chin&&Math.abs(x-(frame.head.left+frame.head.right)/2)<4.5)assert.equal(cropped,null,'neck survived head-only cropping');
  }
  for(const [x,y]of gender===0?[[18,23],[28,23],[17,25],[29,25]]:[[20,26],[27,26],[20,28],[27,28]])assert.equal(head.grid[(y+head.sourceCrop.offsetY)*48+x],null,'an approved native jacket collar pixel was included');
  for(let y=frame.head.bottom+head.sourceCrop.offsetY+1;y<head.height;y++)assert.ok(head.grid.slice(y*48,(y+1)*48).every(c=>c===null),'head-only contains shoulders or clothing');
  assert.match(headgearSVG({...avatar,headwear:2}),/data-art="source-v17"/);
  assert.match(catalogPartSVG('hairStyle',0,avatar),/data-art="source-v17"/);
 }
});
test('native headwear hides the entire face while retaining the headwear, custom hair colour and hairstyle',()=>{
 const withFace=avatarRaster(defaultAvatar,{headOnly:true}),withoutFace=avatarRaster(defaultAvatar,{headOnly:true,face:false});
 assert.notDeepEqual(withFace.grid,withoutFace.grid);assert.ok(withoutFace.grid.some(Boolean));
 const skinTone=c=>c&&parseInt(c.slice(1,3),16)>235&&parseInt(c.slice(1,3),16)-parseInt(c.slice(3,5),16)>26;
 assert.equal(withoutFace.grid.filter(skinTone).length,0,'headwear catalogue retained face pixels');
 const crop=withoutFace.sourceCrop;
 for(let y=17;y<=crop.chin;y++)for(let x=18;x<=30;x++)assert.equal(withoutFace.grid[(y+crop.offsetY)*48+x],null,'headwear thumbnail retained an eye, mouth or disconnected face outline');
 const sample={...defaultAvatar,headwear:1,hairColor:7};
 assert.notEqual(headgearSVG(sample),headgearSVG({...sample,hairColor:8}));
 assert.equal(headgearSVG(sample),headgearSVG({...sample,shirtStyle:3,shirtColor:2,pantsStyle:2,outfit:6,accessory:5}));
 assert.equal(new Set(Array.from({length:12},(_,hairStyle)=>avatarSVG({...defaultAvatar,hairStyle},false,{headOnly:true}))).size,12);
 for(let headwear=0;headwear<5;headwear++)assert.match(headgearSVG({headwear}),/data-art="source-v17"/);
});
test('native head-only canvas and SVG share exactly the same cropped pixels and jury remains anonymous',()=>{
 const avatar={...defaultAvatar,gender:1,hairStyle:7,hairColor:4,headwear:3},options={headOnly:true,face:false,scale:1};
 const c=createCanvas(48,40).getContext('2d');assert.equal(drawAvatarCanvas(c,avatar,0,0,options),true);
 const native=avatarRaster(avatar,options),pixels=c.getImageData(0,0,48,40).data;
 for(let n=0;n<native.grid.length;n++){
  const expected=native.grid[n];if(!expected){assert.equal(pixels[n*4+3],0);continue;}
  assert.equal('#'+Array.from(pixels.slice(n*4,n*4+3)).map(v=>v.toString(16).padStart(2,'0')).join(''),expected);
 }
 const jury=avatarSVG({},true);assert.match(jury,/data-art="source-v17"/);
 assert.equal(jury,avatarSVG({gender:1,hairStyle:11,skin:7,outfit:4,accessory:5},true,{pose:'phone',walking:true,facing:'left'}));
});
