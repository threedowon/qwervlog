'use strict';
let rangeDraft=[],rangeMedia=null,rangeToken=0,rangeStop=null;
function boundedRangeStart(start,clip,seconds){return Math.round(Math.max(0,Math.min(Number(start)||0,Math.max(0,clip.seconds-seconds)))*100)/100;}
function openingWithRanges(settings,ranges){
 const previouslyRanged=new Set((settings.ranges||[]).map(r=>r.clipId));
 return {...settings,ids:[...new Set([...settings.ids.filter(id=>!previouslyRanged.has(id)),...ranges.map(r=>r.clipId)])],ranges:ranges.map(r=>({...r}))};
}
function releaseRangeMedia(){rangeToken++;rangeStop=null;rangeMedia?.dispose();rangeMedia=null;}
function closeRangePicker(){releaseRangeMedia();$('rangePicker').close();rangeDraft=[];}
function renderRanges(){
 const root=$('rangeList');root.replaceChildren();
 rangeDraft.forEach((range,i)=>{const clip=clips.find(c=>c.id===range.clipId);if(!clip)return;
  const row=document.createElement('div');row.className='rangeItem';
  const play=document.createElement('button');play.type='button';const start=boundedRangeStart(range.start,clip,opening.seconds);play.textContent=`${clips.indexOf(clip)+1}번 영상 · ${start.toFixed(1)}–${Math.min(clip.seconds,start+opening.seconds).toFixed(1)}초 ▷`;
  play.onclick=async()=>{try{if($('rangeSource').value!==clip.id||!rangeMedia){$('rangeSource').value=clip.id;await loadRangeSource();}if(!rangeMedia)return;const token=rangeToken,v=rangeMedia.video;await seekDecodedFrame(v,start,()=>token!==rangeToken);if(token!==rangeToken)return;rangeStop=Math.min(clip.seconds,start+opening.seconds);await v.play();}catch(e){$('rangeStatus').textContent=e.message;}};
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`${i+1}번째 구간 삭제`);remove.onclick=()=>{rangeDraft.splice(i,1);renderRanges();};row.append(play,remove);root.append(row);
 });
}
async function loadRangeSource(){
 releaseRangeMedia();const token=rangeToken,clip=clips.find(c=>c.id===$('rangeSource').value);
 $('rangeAdd').disabled=true;$('rangeSeek').disabled=true;$('rangeStatus').textContent='영상을 불러오고 있어요…';
 if(!clip)return;
 try{const media=await loadVideoFile(clip.sourceBlob||clip.playbackBlob,()=>token!==rangeToken);
  if(token!==rangeToken){media.dispose();return;}rangeMedia=media;
  const v=media.video;v.controls=true;v.removeAttribute('aria-hidden');$('rangeVideo').replaceChildren(v);
  const max=Math.max(0,clip.seconds-opening.seconds);$('rangeSeek').max=max;$('rangeSeek').value=0;
  const sync=()=>{if(token!==rangeToken)return;if(rangeStop!==null&&v.currentTime>=rangeStop){v.pause();rangeStop=null;}if(!$('rangeSeek').matches(':active'))$('rangeSeek').value=Math.min(v.currentTime,max);$('rangeTime').textContent=`${Math.min(v.currentTime,max).toFixed(1)}초 / ${clip.seconds.toFixed(1)}초`;};
  v.addEventListener('timeupdate',sync);v.addEventListener('seeked',sync);sync();
  $('rangeAdd').disabled=false;$('rangeSeek').disabled=false;$('rangeStatus').textContent=`원하는 장면에서 추가하세요. 구간당 최대 ${opening.seconds}초예요.`;
 }catch(e){if(token===rangeToken)$('rangeStatus').textContent=e.message;}
}
$('openingRanges').onclick=()=>{
 if(busy)return;releaseCamera();rangeDraft=(opening.ranges||[]).map(r=>({...r}));
 const select=$('rangeSource');select.replaceChildren();for(const [i,clip] of clips.entries()){if(!clip.sourceBlob&&!clip.playbackBlob)continue;const option=document.createElement('option');option.value=clip.id;option.textContent=`${i+1}번 영상 · ${clip.seconds.toFixed(1)}초`;select.append(option);}
 $('rangePicker').showModal();renderRanges();void loadRangeSource();
};
$('rangeSource').onchange=()=>void loadRangeSource();
$('rangeSeek').oninput=()=>{if(!rangeMedia)return;rangeStop=null;rangeMedia.video.pause();rangeMedia.video.currentTime=Number($('rangeSeek').value);$('rangeTime').textContent=`${Number($('rangeSeek').value).toFixed(1)}초`;};
$('rangeAdd').onclick=()=>{if(!rangeMedia)return;const clip=clips.find(c=>c.id===$('rangeSource').value);if(!clip)return;rangeMedia.video.pause();rangeStop=null;rangeDraft.push({clipId:clip.id,start:boundedRangeStart(rangeMedia.video.currentTime,clip,opening.seconds)});renderRanges();};
$('rangeDone').onclick=()=>{opening=openingWithRanges(opening,rangeDraft);closeRangePicker();renderList();void saveOpening();status('오프닝 구간을 반영했어요. 오프닝만 미리보기로 확인해 주세요.');};
$('rangeCancel').onclick=closeRangePicker;
$('rangePicker').addEventListener('cancel',e=>{e.preventDefault();closeRangePicker();});
$('rangePicker').addEventListener('close',()=>{releaseRangeMedia();rangeDraft=[];});
$('rangePicker').onclick=e=>{if(e.target!==$('rangePicker'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeRangePicker();};
