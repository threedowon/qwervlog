'use strict';
let previewOpeningOnly=false;
function validOpeningColor(value){return /^#[0-9a-f]{6}$/i.test(value||'')?value:'#fff8cd';}
function openingColor(title,color){return title==='making'?'#C7DFFF':title==='custom'?validOpeningColor(color):'#fff8cd';}
const OPENING_TITLES={making:['things','I’m','making'],life:['day','in my','life']};
let opening={ids:[],seconds:.7,title:'making',customText:'',customColor:'#fff8cd'};
function normalizeOpening(value){return {customColor:validOpeningColor(value?.customColor),customText:typeof value?.customText==='string'?value.customText.slice(0,160):'',title:value?.title==='none'?'custom':['making','life','custom'].includes(value?.title)?value.title:'making',ids:Array.isArray(value?.ids)?[...new Set(value.ids.filter(id=>typeof id==='string'))]:[],seconds:Number.isFinite(Number(value?.seconds))?Math.max(.3,Math.min(1.5,Math.round(Number(value.seconds)*10)/10)):.7};}
function sequencePlan(clips,settings,onlyOpening=false){
 const ids=new Set(settings.ids),intro=clips.filter(c=>ids.has(c.id)&&!c.sourceBlob).map(clip=>({clip,start:0,seconds:Math.min(settings.seconds,clip.seconds),intro:true,title:settings.title||'making',customText:settings.customText||'',customColor:validOpeningColor(settings.customColor)}));
 return onlyOpening?intro:[...intro,...clips.map(clip=>({clip,seconds:clip.seconds,intro:false}))];
}
function syncOpening(){
 const plan=sequencePlan(clips,opening,true),duration=plan.reduce((n,s)=>n+s.seconds,0);
 $('openingSeconds').value=opening.seconds;
 $('openingCustomColor').value=validOpeningColor(opening.customColor);$('openingCustomColor').disabled=busy;
 const customButton=document.querySelector('[data-opening-title="custom"]');if(customButton)customButton.style.setProperty('--title-color',validOpeningColor(opening.customColor));
 $('openingCustomField').hidden=opening.title!=='custom';$('openingCustomText').disabled=busy;
 if(document.activeElement!==$('openingCustomText'))$('openingCustomText').value=opening.customText||'';
 for(const button of document.querySelectorAll('[data-opening-title]')){button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.openingTitle===opening.title));}
 $('openingSummary').textContent=plan.length?`${plan.length}개 컷 · 총 ${Number(duration.toFixed(1))}초 · 목록 순서대로`:'아래 목록에서 오프닝에 넣을 컷을 체크해 주세요.';
 $('openingPreview').disabled=busy||!plan.length;$('openingClear').disabled=busy||!plan.length;$('openingSeconds').disabled=busy;
}
async function saveOpening(){
 $('downloadArea').hidden=true;await storageReady;
 if(clipStore)try{const value={ids:[...opening.ids],seconds:opening.seconds,title:opening.title,customText:opening.customText||'',customColor:validOpeningColor(opening.customColor)};await clipStore.write(s=>s.put(value,'opening'));}catch(e){status('오프닝 설정은 현재 화면에만 반영됐어요.');}
}

function openingTitleLines(title,customText=''){
 if(title==='custom')return customText.trim()?customText.replace(/\r/g,'').trim().split('\n'):[];
 return OPENING_TITLES[title]||[];
}
function drawOpeningTitle(title,customText='',customColor){
 const lines=openingTitleLines(title,customText);if(!lines.length)return;
 ctx.save();ctx.scale(canvas.width/540,canvas.height/960);
 ctx.fillStyle=openingColor(title,customColor);ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
 const font=size=>`italic 800 ${size}px -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', Arial, sans-serif`;
 ctx.font=font(68);const widest=Math.max(1,...lines.map(line=>ctx.measureText?ctx.measureText(line).width:line.length*38));
 const scale=Math.min(1,440/widest,340/(lines.length*72)),size=68*scale,lineHeight=72*scale;
 ctx.font=font(size);
 lines.forEach((line,i)=>ctx.fillText(line,270,480+(i-(lines.length-1)/2)*lineHeight));ctx.restore();
}
function drawSequenceFrame(source,photos,segment,frameIndex=0){
 const clip=segment.clip,hasTitle=segment.intro&&openingTitleLines(segment.title,segment.customText).length>0;
 draw(source,photos,hasTitle?'':clip.caption,hasTitle?'':clip.time,clip.collage,clipLayout(clip),clip.sourceBlob?[0,0,clip.width,clip.height]:clip.sourceBounds?.[frameIndex]);
 if(hasTitle)drawOpeningTitle(segment.title,segment.customText,segment.customColor);
}
