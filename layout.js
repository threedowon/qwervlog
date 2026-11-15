// Layout is derived from the clip ID, so export, preview and reload agree.
function layoutFor(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const templates = [
    [[48,150,176,132],[308,235,164,154],[290,636,166,125]],
    [[302,146,170,128],[60,226,165,158],[62,638,174,130]],
    [[48,174,174,130],[300,528,168,130],[66,684,170,128]],
    [[298,168,172,129],[58,528,168,132],[294,684,166,125]],
    [[62,146,166,140],[296,240,172,152],[175,655,174,130]],
    [[300,150,172,129],[56,242,170,150],[178,638,170,128]],
    [[166,162,178,134],[50,550,168,128],[300,684,166,125]],
    [[174,164,172,130],[300,540,170,128],[54,685,170,128]]
  ];
  const base = templates[Math.floor(random() * templates.length)];
  // Include both ratios in every collage, shuffled independently of position.
  const ratios=[1,4/3,random()<.5?1:4/3];
  for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[ratios[i],ratios[j]]=[ratios[j],ratios[i]];}
  return base.map(([x,y,w,h],i) => {
    const scale = .96 + random() * .08;
    w = Math.round(w * scale); h = w / ratios[i];
    x = Math.max(32, Math.min(508-w, x + Math.round(random()*24-12)));
    y += Math.round(random()*20-10);
    return [x,y,w,h];
  });
}
function clipLayout(clip) { const crops=clipCrops(clip); return (clip.layout || layoutFor(clip.id)).map((r,i)=>[...r.slice(0,4),crops[i]]); }

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
 const scale=Math.max(w/sw,h/sh)*crop.zoom,cw=w/scale,ch=h/scale;
 return [(sw-cw)*crop.x,(sh-ch)*crop.y,cw,ch];
}
