'use strict';
let previewOpeningOnly=false;
const OPENING_TITLES={making:['things','I’m','making'],life:['day','in my','life']};
let opening={ids:[],seconds:.7,title:'making',ranges:[]};
function normalizeOpening(value){return {ranges:Array.isArray(value?.ranges)?value.ranges.filter(r=>typeof r?.clipId==='string'&&Number.isFinite(r.start)&&r.start>=0).map(r=>({clipId:r.clipId,start:r.start})):[],title:['making','life','none'].includes(value?.title)?value.title:'making',ids:Array.isArray(value?.ids)?[...new Set(value.ids.filter(id=>typeof id==='string'))]:[],seconds:Number.isFinite(Number(value?.seconds))?Math.max(.3,Math.min(1.5,Math.round(Number(value.seconds)*10)/10)):.7};}
function sequencePlan(clips,settings,onlyOpening=false){
 const ids=new Set(settings.ids),intro=clips.filter(c=>ids.has(c.id)).flatMap(clip=>{
  const ranges=(settings.ranges||[]).filter(r=>r.clipId===clip.id);
  return (ranges.length?ranges:[{start:0}]).map(r=>{const start=Math.max(0,Math.min(r.start,Math.max(0,clip.seconds-settings.seconds)));return {clip,start,seconds:Math.min(settings.seconds,clip.seconds-start),intro:true,title:settings.title||'making'};});
 });
 return onlyOpening?intro:[...intro,...clips.map(clip=>({clip,seconds:clip.seconds,intro:false}))];
}
function syncOpening(){
 const plan=sequencePlan(clips,opening,true),duration=plan.reduce((n,s)=>n+s.seconds,0);
 $('openingSeconds').value=opening.seconds;
 for(const button of document.querySelectorAll('[data-opening-title]')){button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.openingTitle===opening.title));}
 $('openingSummary').textContent=plan.length?`${plan.length}개 컷 · 총 ${Number(duration.toFixed(1))}초 · 목록 순서대로`:'아래 목록에서 오프닝에 넣을 컷을 체크해 주세요.';
 $('openingPreview').disabled=busy||!plan.length;$('openingClear').disabled=busy||!plan.length;$('openingSeconds').disabled=busy;$('openingRanges').disabled=busy||!clips.some(c=>c.sourceBlob||c.playbackBlob);
}
async function saveOpening(){
 $('downloadArea').hidden=true;await storageReady;
 if(clipStore)try{const value={ids:[...opening.ids],seconds:opening.seconds,title:opening.title,ranges:opening.ranges||[]};await clipStore.write(s=>s.put(value,'opening'));}catch(e){status('오프닝 설정은 현재 화면에만 반영됐어요.');}
}

function drawOpeningTitle(title){
 const lines=OPENING_TITLES[title];if(!lines)return;
 ctx.save();ctx.scale(canvas.width/540,canvas.height/960);
 ctx.fillStyle='#fff8cd';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
 ctx.font='italic 800 68px -apple-system, BlinkMacSystemFont, Arial, sans-serif';
 lines.forEach((line,i)=>ctx.fillText(line,270,408+i*72,440));ctx.restore();
}
function drawSequenceFrame(source,photos,segment,frameIndex=0){
 const clip=segment.clip,hasTitle=segment.intro&&Boolean(OPENING_TITLES[segment.title]);
 draw(source,photos,hasTitle?'':clip.caption,hasTitle?'':clip.time,clip.collage,clipLayout(clip),clip.sourceBlob?[0,0,clip.width,clip.height]:clip.sourceBounds?.[frameIndex]);
 if(hasTitle)drawOpeningTitle(segment.title);
}
