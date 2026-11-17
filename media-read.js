'use strict';
// Check decoded state as well as events: a seek to the current time may emit no seeked event.
function waitForVideoState(video,ready,{timeout=60000,cancel=()=>false,message='영상 준비 시간이 초과됐어요. 사진 앱에서 영상이 끝까지 재생되는지 확인한 뒤 다시 가져와 주세요.'}={}){
 return new Promise((resolve,reject)=>{
  let done=false,timer,poll;
  const events=['loadedmetadata','loadeddata','canplay','seeked','timeupdate','error'];
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);for(const event of events)video.removeEventListener(event,check);error?reject(error):resolve();};
  const check=()=>{if(cancel())return finish(Error('가져오기를 취소했어요.'));if(video.error)return finish(Error(`영상을 해석하지 못했어요 (코드 ${video.error.code}). MP4 파일로 다시 선택해 주세요.`));if(ready())finish();};
  for(const event of events)video.addEventListener(event,check);
  timer=setTimeout(()=>finish(Error(message)),timeout);poll=setInterval(check,100);check();
 });
}
async function seekDecodedFrame(video,time,cancel=()=>false){
 const end=Math.max(0,video.duration-.04),target=Math.max(0,Math.min(time,end));
 if(cancel())throw Error('가져오기를 취소했어요.');
 if(video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime-target)<.002)return;
 video.currentTime=target;
 await waitForVideoState(video,()=>video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime-target)<.05,{timeout:30000,cancel,message:'영상의 일부 구간을 읽지 못했어요. 사진 앱에서 영상을 내려받은 뒤 다시 시도해 주세요.'});
}
async function loadVideoFile(blob,cancel=()=>false){
 const url=URL.createObjectURL(blob),video=document.createElement('video');let disposed=false;
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';
 video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');
 video.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
 document.body.append(video);
 const dispose=()=>{if(disposed)return;disposed=true;video.pause();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);};
 try{
  video.src=url;video.load();
  // Muted inline playback starts decoding on Safari even when preload alone stalls.
  const playing=video.play();playing?.catch(()=>{});
  await waitForVideoState(video,()=>video.readyState>=2&&video.videoWidth>0&&Number.isFinite(video.duration)&&video.duration>0,{cancel});
  video.pause();await seekDecodedFrame(video,0,cancel);
  return {video,dispose};
 }catch(error){dispose();throw error;}
}
