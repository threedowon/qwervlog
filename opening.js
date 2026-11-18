'use strict';
let previewOpeningOnly=false;
let opening={ids:[],seconds:.7};
function normalizeOpening(value){return {ids:Array.isArray(value?.ids)?[...new Set(value.ids.filter(id=>typeof id==='string'))]:[],seconds:Number.isFinite(Number(value?.seconds))?Math.max(.3,Math.min(1.5,Math.round(Number(value.seconds)*10)/10)):.7};}
function sequencePlan(clips,settings,onlyOpening=false){
 const ids=new Set(settings.ids),intro=clips.filter(c=>ids.has(c.id)).map(clip=>({clip,seconds:Math.min(settings.seconds,clip.seconds),intro:true}));
 return onlyOpening?intro:[...intro,...clips.map(clip=>({clip,seconds:clip.seconds,intro:false}))];
}
function syncOpening(){
 const plan=sequencePlan(clips,opening,true),duration=plan.reduce((n,s)=>n+s.seconds,0);
 $('openingSeconds').value=opening.seconds;
 $('openingSummary').textContent=plan.length?`${plan.length}개 컷 · 총 ${Number(duration.toFixed(1))}초 · 목록 순서대로`:'아래 목록에서 오프닝에 넣을 컷을 체크해 주세요.';
 $('openingPreview').disabled=busy||!plan.length;$('openingClear').disabled=busy||!plan.length;$('openingSeconds').disabled=busy;
}
async function saveOpening(){
 $('downloadArea').hidden=true;await storageReady;
 if(clipStore)try{const value={ids:[...opening.ids],seconds:opening.seconds};await clipStore.write(s=>s.put(value,'opening'));}catch(e){status('오프닝 설정은 현재 화면에만 반영됐어요.');}
}
