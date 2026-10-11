import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const moduleUrl=new URL('../web/source-actors.js',import.meta.url);
const dataUrl=new URL('../web/source-actors-data.js',import.meta.url);
const api=async()=>{assert.ok(existsSync(moduleUrl),'The saved Bziker sprites must have a runtime player');return import(moduleUrl);};
const manifest=async()=>{assert.ok(existsSync(dataUrl),'All source animation keys need an imported manifest');return (await import(dataUrl)).sourceActorsData;};

test('the imported actor catalog retains all 22 entities and 374 original base actions',async()=>{
 const d=await manifest();assert.equal(Object.keys(d.actors).length,22);assert.equal(Object.values(d.actors).reduce((n,a)=>n+Object.keys(a.actions).length,0),374);
 assert.equal(d.rootMotion,false);assert.equal(d.coverage.source_motion_revision,3);
 for(const actor of Object.values(d.actors))for(const action of Object.values(actor.actions)){
  assert.equal(action.frames.length,4);assert.ok(action.timeline.length>0);assert.ok(action.sourceKey);assert.ok(action.frames.every(f=>f.w>0&&f.h>0));
  assert.ok(action.frames.every(f=>Number.isFinite(f.sourceScale)));assert.equal(new Set(action.frames.map(f=>f.sourceScale)).size,1,'one cycle cannot rescale the actor between its four phases');
 }
 assert.equal(Object.keys(d.daily).length,168);assert.equal(Object.keys(d.scenarios).length,532);assert.equal(Object.keys(d.gestures).length,160);
 for(const row of d.coverage.requested)assert.ok(row.sourceKeys.length>0,`${row.action} was silently dropped`);
});

test('whole walking frames advance by discrete source order without moving the feet anchor',async()=>{
 const a=await api(),frames=Array.from({length:8},(_,walkFrame)=>a.sourceActorFrame({gender:0},{walking:true,walkFrame,facing:'left'}));
 assert.equal(new Set(frames.map(f=>f.frameIndex)).size,4);
 for(let n=0;n<8;n+=2){assert.equal(frames[n].frameIndex,frames[n+1].frameIndex);assert.deepEqual(frames[n].anchor,[24,63]);assert.deepEqual(frames[n].offset,[0,0]);}
 for(const facing of ['down','right','up','left'])assert.match(a.sourceActorFrame({}, {walking:true,facing}).sourceKey,/Ходьба/);
 assert.match(a.sourceActorFrame({}, {walking:true,running:true,facing:'right'}).sourceKey,/Бег/);
});

test('phone and food select seated source cycles without dropping the sitting context',async()=>{
 const a=await api();
 for(const gender of [0,1])for(const facing of ['down','right','up','left']){
  const phone=a.sourceActorFrame({gender},{pose:'sit',phoneOpen:true,facing});assert.match(phone.id,/-phone-seated-/);assert.equal(phone.context,'seated');assert.deepEqual(phone.offset,[0,0]);
  for(const action of ['eat','drink','smoke']){const f=a.sourceActorFrame({gender},{pose:'sit',action,facing,actionProgress:.5});assert.equal(f.context,'seated');assert.ok(f.hand||f.embeddedProps);}
  for(const action of ['eat','drink','smoke'])assert.equal(a.sourceActorFrame({gender},{pose:'sit',action,facing,phoneOpen:true,actionProgress:.5}).secondaryProp,'phone');
 }
 for(const action of ['pick-litter','throw-litter','pet','fish','boat'])assert.ok(a.sourceActorFrame({}, {action,actionProgress:.5}),action);
});

test('animals use deterministic actual breeds and source gait frames at the existing world coordinate',async()=>{
 const a=await api(),d=await manifest();
 for(const kind of ['cat','dog'])for(const id of ['park-'+kind,'owned-'+kind,'plaza-'+kind]){
  const p={kind,id,x:30,y:40,facing:'right',walking:true,walk_frame:2},f=a.sourceAnimalFrame(p,null,false,10);assert.equal(d.actors[f.actorId].kind,kind);assert.equal(a.sourceAnimalFrame(p,null,false,999).actorId,f.actorId);assert.deepEqual(f.offset,[0,0]);
  assert.equal(a.sourceAnimalFrame(p,null,true,10).frameIndex,a.sourceAnimalFrame({...p,walk_frame:3},null,true,11).frameIndex);
 }
});

test('catching a fish uses the authored hand-to-pocket sequence and phone stays seated on a boat',async()=>{
 const a=await api();
 for(const progress of [0,.25,.5,.9]){
  const f=a.sourceActorFrame({gender:0},{action:'fish-catch',actionProgress:progress,boat:true});
  assert.equal(f.id,'male-fish-pocket');assert.deepEqual(f.offset,[0,0]);assert.equal(f.context,'seated');
  assert.equal(f.frameIndex,Math.floor(progress*8));
  const female=a.sourceActorFrame({gender:1},{action:'fish-catch',actionProgress:progress});
  assert.equal(female.id,'female-water');assert.equal(female.frameIndex,12+Math.floor(progress*4));
 }
 for(const gender of [0,1]){
  const f=a.sourceActorFrame({gender},{phoneOpen:true,boat:true,facing:'right'});
  assert.match(f.id,/-phone-seated-right$/);assert.equal(f.context,'seated');assert.deepEqual(f.offset,[0,0]);
 }
 for(const gender of [0,1])for(const progress of [0,.5,.75,.99])assert.ok(a.sourceActorFrame({gender},{action:'fishing',actionProgress:progress}).frameIndex<5,'a cast cannot show a fish before the successful catch');
 assert.equal(a.sourceActorFrame({gender:1},{boat:true,walking:true}).frameIndex,4);
 assert.equal(a.sourceActorFrame({gender:1},{boat:true}).frameIndex,6);
});

test('every supplied scenario and every animal action is addressable instead of silently becoming idle',async()=>{
 const a=await api(),d=await manifest();
 for(const scene of Object.values(d.scenarios)){
  const f=a.sourceActorFrame({gender:scene.actor==='female'?1:0},{animationId:scene.id,actionProgress:.5,facing:'right'});
  assert.ok(f?.sourceKey,scene.id);assert.equal(f.scenarioId,scene.id);assert.ok(f.rect.w>0&&f.rect.h>0);
 }
 for(const actor of Object.values(d.actors).filter(a=>a.kind!=='human'))for(const key of Object.keys(actor.actions)){
  const f=a.sourceAnimalFrame({kind:actor.kind,id:'explicit',breed:actor.id,animationId:key,actionProgress:.5},null,false,5);
  assert.equal(f.id,key,actor.id+' / '+key);
 }
 for(const kind of ['cat','dog']){
  const p={kind,id:'reaction',facing:'left'};
  const normal=a.sourceAnimalFrame(p,null,false,3),reaction=a.sourceAnimalFrame(p,{kind,started_at:2,duration:3},false,3);
  assert.notEqual(reaction.id,normal.id);assert.equal(a.sourceAnimalFrame(p,{kind,started_at:2,duration:3},false,6).id,normal.id);
 }
});

test('untrusted animation identifiers cannot select inherited object properties',async()=>{
 const a=await api();
 for(const id of ['constructor','toString','__proto__',null,{},17]){
  assert.doesNotThrow(()=>a.sourceActorFrame({}, {animationId:id}));
  assert.doesNotThrow(()=>a.sourceAnimalFrame({kind:'cat',id:'safe',animationId:id},null,false,0));
  assert.equal(await a.loadSourceSequence(id),null);
 }
});

test('source pages are compact PNG atlases with normalized transparent cell bounds',async()=>{
 const d=await manifest();let canvas;
 try{canvas=createRequire(import.meta.url)('@napi-rs/canvas');}catch{canvas=createRequire(process.execPath)('@napi-rs/canvas');}
 for(const id of ['human-male','human-female','cat-british-blue','dog-corgi-red-white']){
  const actor=d.actors[id],image=await canvas.loadImage(fileURLToPath(new URL('../'+actor.atlas,import.meta.url)));assert.equal(image.width,actor.size[0]);assert.equal(image.height,actor.size[1]);assert.ok(image.width<=512&&image.height<=2048);
  const c=canvas.createCanvas(image.width,image.height).getContext('2d');c.drawImage(image,0,0);const px=c.getImageData(0,0,image.width,image.height).data;assert.ok(px.some((v,n)=>n%4===3&&v===0));assert.ok(px.some((v,n)=>n%4===3&&v>0));
 }
});

test('canvas source rendering retains custom hair, skin, clothes and costume identity',async()=>{
 const a=await api();let canvas;
 try{canvas=createRequire(import.meta.url)('@napi-rs/canvas');}catch{canvas=createRequire(process.execPath)('@napi-rs/canvas');}
 const d=await manifest();for(const actor of ['human-male','human-female'])await a.loadSourceActor(actor,{createCanvas:canvas.createCanvas,loadImage:path=>canvas.loadImage(fileURLToPath(new URL('../'+path,import.meta.url)))});
 const {drawAvatarCanvas,defaultAvatar}=await import('../web/avatar.js');
 const render=(avatar,options={})=>{const c=canvas.createCanvas(80,80).getContext('2d');assert.equal(drawAvatarCanvas(c,avatar,5,5,{scale:1,...options}),true);return Buffer.from(c.getImageData(0,0,80,80).data).toString('base64');};
 const base=render(defaultAvatar);for(const key of ['skin','hairColor','hairStyle','shirtColor','shirtStyle','pantsColor','pantsStyle','shoesColor','headwear','outfit','accessory'])assert.notEqual(render({...defaultAvatar,[key]:defaultAvatar[key]===1?2:1}),base,key+' customization was lost');
 const fixed=render(defaultAvatar,{walking:true,walkFrame:2});assert.equal(fixed,render(defaultAvatar,{walking:true,walkFrame:3}));assert.notEqual(fixed,render(defaultAvatar,{walking:true,walkFrame:4}));
 assert.notEqual(render({...defaultAvatar,gender:1}),base);
});
