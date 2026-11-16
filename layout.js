// Layout is derived from the clip ID, so export, preview and reload agree.
function layoutFor(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  // Favor two photos and reserve the middle for the main video and caption.
  const count=random()<.6?2:3;
  const templates=[[[0,145],[1,610],[1,260]],[[1,145],[0,610],[0,250]],[[0,210],[1,680],[1,130]],[[1,210],[0,680],[0,130]]];
  const base=templates[Math.floor(random()*templates.length)];
  const ratios=random()<.5?[1,4/3]:[4/3,1];
  ratios.push(random()<.5?1:4/3);
  return base.slice(0,count).map(([side,y],i)=>{
    const w=Math.round(100+random()*45),h=w/ratios[i];
    const inset=Math.round(28+random()*24);
    return [side?540-inset-w:inset,y+Math.round(random()*24-12),w,h];
  });
}
function clipLayout(clip) {
 const crops=clipCrops(clip),indices=photoIndicesFor(clip);
 // Older clips get the lighter layout without rewriting their source frames.
 const layout=clip.layoutVersion===2&&clip.layout?clip.layout:layoutFor(clip.id);
 return layout.map((r,i)=>[...r.slice(0,4),{...crops[i],bounds:clip.sourceBounds?.[indices[i]]}]);
}

// Three independent random instants in separated portions of the recording.
// A clip ID makes legacy clips stable; new clips persist their chosen indices.
function photoIndicesFor(clip){
 if(clip.photoIndices?.length===3)return clip.photoIndices;
 let state=2166136261;
 for(const c of String(clip.id)+'photos')state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const n=clip.frames.length;
 const bands=[[0,.25],[.375,.625],[.75,1]];
 return bands.map(([a,b])=>{const lo=Math.floor(a*n),hi=Math.min(n,Math.ceil(b*n));return Math.min(n-1,lo+Math.floor(random()*Math.max(1,hi-lo)));});
}
function collageFrames(clip,frames=clip.frames){return photoIndicesFor(clip).map(i=>frames[i]);}

// Keep one wider shot, one medium crop and one close-up, in random order.
function clipCrops(clip){
 if(clip.crops?.length===3)return clip.crops;
 let state=2166136261;
 for(const c of String(clip.id)+'crop-v1')state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const zooms=[1.05+random()*.2,1.4+random()*.25,1.9+random()*.4];
 for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[zooms[i],zooms[j]]=[zooms[j],zooms[i]];}
 const anchors=[[.15,.2],[.8,.45],[.45,.85]];
 for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[anchors[i],anchors[j]]=[anchors[j],anchors[i]];}
 return zooms.map((zoom,i)=>({zoom,x:Math.max(0,Math.min(1,anchors[i][0]+random()*.16-.08)),y:Math.max(0,Math.min(1,anchors[i][1]+random()*.16-.08))}));
}
function cropRect(sw,sh,w,h,crop={zoom:1,x:.5,y:.5}){
 const [bx,by,bw,bh]=crop.bounds||[0,0,sw,sh];
 const scale=Math.max(w/bw,h/bh)*crop.zoom,cw=w/scale,ch=h/scale;
 return [bx+(bw-cw)*crop.x,by+(bh-ch)*crop.y,cw,ch];
}

function visibleBounds([x,y,w,h],cw,ch){
 // Inset by two pixels to avoid JPEG edge ringing from the padded area.
 const left=Math.max(0,x),top=Math.max(0,y),right=Math.min(cw,x+w),bottom=Math.min(ch,y+h);
 return [left+(left>0?2:0),top+(top>0?2:0),right-left-(left>0?2:0)-(right<cw?2:0),bottom-top-(top>0?2:0)-(bottom<ch?2:0)];
}
