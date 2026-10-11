import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {designCrop,resolveDesignAsset} from '../web/design-assets.js';
import {preloadSourceInteriorRoom,drawSourceInteriorSurfaces,sourceInteriorDetailLayout} from '../web/source-interiors.js';
const root=new URL('../',import.meta.url),map=JSON.parse(await readFile(new URL('web/interiors-map.json',root),'utf8'));
const original=JSON.parse(await readFile(new URL('docs/bugfix-v25/interiors-map-before.json',root),'utf8'));
// Native opaque upright runs, independent of the full perspective bbox.
const sideUprights={station:[256,250],casino:[350,333],clothing:[322,379],'bar-pivkovy-tuz':[279,259],'bzik-hub':[491,566]};

test('the visible floor and cutaway meet the actual unchanged navigation boundary in every public room',()=>{
 for(const room of map.rooms){
  const old=original.rooms.find(r=>r.id===room.id),b=room.bounds;
  for(const key of ['bounds','spawn','exit','door','solids','seats','props','action','staff'])assert.deepEqual(room[key],old[key],`${room.id}: a visual correction cannot move ${key}`);
  assert.deepEqual(room.surfaces.find(s=>s.id==='floor').clip,{x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top});
  assert.deepEqual(room.floor_material.regions,[[[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]]]);
  const rim=room.surfaces.filter(s=>s.id.startsWith('front-cutaway'));assert.ok(rim.length);for(const s of rim){assert.equal(s.clip.y,b.bottom);assert.ok(s.clip.height<=24);}
 }
});

test('side walls share the rear wall upright height rather than magnifying a single native panel to the room depth',()=>{
 for(const room of map.rooms){
  const back=room.surfaces.filter(s=>s.id.startsWith('back-wall'));
  for(const wall of back){assert.equal(wall.wall_body_height,176);assert.ok(wall.visual.height>=140&&wall.visual.height<=260,`${room.id}: ${wall.visual.height} tall rear sprite`);assert.equal(wall.clip.y+wall.clip.height,room.bounds.top+2);const crop=designCrop(resolveDesignAsset(wall.asset_id),wall.visual),body=(wall.source_join.wall_native_y-crop.y)*wall.visual.height/crop.height;assert.ok(Math.abs(body-176)<1e-6,'the measured native rear plane, rather than metadata, must have the human-scale height');}
  for(const side of ['left','right']){
   const walls=room.surfaces.filter(s=>s.id===`${side}-wall`||s.id.startsWith(`${side}-wall-`));assert.equal(walls.length,1,'a perspective section must not form stacked roof edges');
   for(const wall of walls){assert.ok(wall.wall_body_height>=140&&wall.wall_body_height<=220);assert.ok(wall.visual.height<=400,`${room.id}: single ${side} wall was enlarged to ${wall.visual.height}`);assert.ok(side==='left'?wall.clip.x+wall.clip.width<=room.bounds.left:wall.clip.x>=room.bounds.right);const family=sideUprights[room.source_family]?room.source_family:'station',upright=sideUprights[family][side==='left'?0:1],crop=designCrop(resolveDesignAsset(wall.asset_id),wall.visual);assert.ok(Math.abs(upright*wall.visual.height/crop.height-176)<1e-6,'the rendered native opaque wall body must match the rear wall');}
   const rim=room.wall_cutaway.regions[side==='left'?0:1];assert.equal(rim.y,room.bounds.top);assert.equal(rim.height,room.bounds.bottom-room.bounds.top+20);assert.equal(side==='left'?rim.x+rim.width:rim.x,side==='left'?room.bounds.left:room.bounds.right);
  }
  for(const wall of room.surfaces){const a=resolveDesignAsset(wall.asset_id),crop=designCrop(a,wall.visual);assert.ok(Math.abs(wall.visual.width/wall.visual.height-crop.width/crop.height)<1e-6,`${room.id}:${wall.id} stretched a native PNG`);}
 }
});

test('station signs and clock are centred on real supports and stay clear of each other',()=>{
 const room=map.rooms.find(r=>r.id==='railway'),details=sourceInteriorDetailLayout(room),cash=details.find(d=>d.id.endsWith(':cash-sign')),clock=details.find(d=>d.id.endsWith(':clock'));
 const booths=room.props.filter(p=>['service','ticket-window-2'].includes(p.id)),centre=booths.reduce((n,p)=>n+p.x+p.width/2,0)/booths.length;
 assert.ok(Math.abs(cash.anchor.x-centre)<1e-6);assert.ok(Math.abs(cash.bounds.y+cash.bounds.height/2-clock.bounds.y-clock.bounds.height/2)<1e-6,'a sign baseline is not the clock centre');
 for(const r of map.rooms){const mounted=sourceInteriorDetailLayout(r).filter(d=>d.layer==='background');for(let i=0;i<mounted.length;i++)for(const d of mounted.slice(i+1)){
  const a=mounted[i].bounds,b=d.bounds;assert.equal(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y,false,`${r.id}: ${mounted[i].id} overlaps ${d.id}`);
 }}
});

test('rendered human-sized walls cover the full physical perimeter without painted floor outside it',async()=>{
 const {createCanvas,loadImage}=createRequire(process.execPath)('@napi-rs/canvas');globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h);}};
 try{for(const room of map.rooms){
  await preloadSourceInteriorRoom(room,url=>loadImage(fileURLToPath(new URL(url.replace(/^\//,''),root))));
  const c=createCanvas(room.width,room.height).getContext('2d');drawSourceInteriorSurfaces(c,room);const b=room.bounds;
  const color=(x,y)=>[...c.getImageData(Math.round(x),Math.round(y),1,1).data];
  for(let y=b.top+20;y<b.bottom-20;y+=39){for(const x of [b.left+16,b.right-16])assert.notDeepEqual(color(x,y),[23,26,28,255],`${room.id}: physical floor missing at ${x},${y}`);for(const x of [b.left-8,b.right+8])assert.notDeepEqual(color(x,y),[23,26,28,255],`${room.id}: visible boundary missing at ${x},${y}`);}
  for(let x=b.left+20;x<b.right-20;x+=89)assert.notDeepEqual(color(x,b.bottom+8),[23,26,28,255],`${room.id}: visible front edge has a gap`);
 }}finally{delete globalThis.OffscreenCanvas;}
});
