export const worldViewportHeight=(viewportHeight,top)=>Math.max(120,viewportHeight-Math.max(0,top));
/** Native public rooms keep source-coordinate padding in their canvas. Frame
 * the actual clipped walls/floor, while retaining a small edge around them. */
export function interiorCameraBounds(room,margin=24){
 if(room?.modular_source!==true)return null;
 const clips=(room.surfaces||[]).map(surface=>surface.clip).filter(clip=>clip&&['x','y','width','height'].every(k=>Number.isFinite(clip[k]))&&clip.width>0&&clip.height>0);
 if(!clips.length)return null;
 return {left:Math.max(0,Math.min(...clips.map(c=>c.x))-margin),right:Math.min(room.width,Math.max(...clips.map(c=>c.x+c.width))+margin),top:Math.max(0,Math.min(...clips.map(c=>c.y))-margin),bottom:Math.min(room.height,Math.max(...clips.map(c=>c.y+c.height))+margin)};
}
/** Reserve space below the physical feet for controls; align the world origin
 * to device pixels. This changes the view only, never saved coordinates. */
export function worldCamera({width,height,dpr=1,zoom=1,sceneWidth,sceneHeight,position,sceneBounds}){
 const rawScale=Math.min(height/650,width/350,1.45)*zoom,scale=Math.max(Math.ceil(width/sceneWidth*dpr)/dpr,Math.round(rawScale*dpr)/dpr),vw=width/scale,vh=height/scale;
 const bottom=height<360?72:114,desiredFoot=Math.max(80,Math.min(height*.56,height-bottom));
 const framed=sceneBounds&&['left','right','top','bottom'].every(k=>Number.isFinite(sceneBounds[k]))&&sceneBounds.right>sceneBounds.left&&sceneBounds.bottom>sceneBounds.top;
 const clampFrame=(value,low,high)=>high<low?(low+high)/2:Math.max(low,Math.min(high,value));
 const x=framed?clampFrame(position.x-vw/2,sceneBounds.left,sceneBounds.right-vw):Math.max(0,Math.min(Math.max(0,sceneWidth-vw),position.x-vw/2));
 const y=framed?clampFrame(position.y-desiredFoot/scale,sceneBounds.top,sceneBounds.bottom-vh+bottom/scale):Math.max(0,Math.min(Math.max(0,sceneHeight-vh+bottom/scale),position.y-desiredFoot/scale));
 return {scale,width:vw,height:vh,x:Math.round(x*scale*dpr)/(scale*dpr),y:Math.round(y*scale*dpr)/(scale*dpr)};
}
