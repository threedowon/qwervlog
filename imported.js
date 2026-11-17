'use strict';
async function openImportedVideo(blob){
 const url=URL.createObjectURL(blob),video=document.createElement('video');
 video.muted=true;video.playsInline=true;video.preload='auto';
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);};
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>finish(Error('영상을 읽는 시간이 초과됐어요. 다시 추가해 주세요.')),15000);
   const finish=error=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;error?reject(error):resolve();};
   video.onloadeddata=()=>finish();video.onerror=()=>finish(Error('이 영상 형식을 읽지 못했어요. MP4 영상으로 다시 선택해 주세요.'));video.src=url;
  });
  if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth)throw Error('영상 길이를 확인할 수 없어요.');
  return {video,dispose};
 }catch(error){dispose();throw error;}
}
function importedClip(file,video,thumbnail){
 return {id:crypto.randomUUID(),mode:'imported',sourceBlob:file,filename:file.name,seconds:video.duration,
  width:video.videoWidth,height:video.videoHeight,frames:[thumbnail,thumbnail,thumbnail],
  caption:'',time:'',collage:false,timeSource:'baked',photoIndices:[0,1,2],layoutVersion:2};
}
async function importGalleryVideo(file){
 if(!file||busy||pendingClip)return;
 if(file.size>300*1024*1024){status('300MB 이하의 영상을 선택해 주세요.');$('galleryUpload').value='';return;}
 cancelled=false;lock(true);stopLive();status('편집된 영상을 추가하고 있어요…');let source;
 try{
  source=await openImportedVideo(file);if(cancelled)throw Error('영상 추가를 취소했어요.');
  const thumb=document.createElement('canvas');thumb.width=540;thumb.height=960;
  const v=source.video;cover(thumb.getContext('2d'),v,0,0,540,960,{zoom:1,x:.5,y:.5,bounds:[0,0,v.videoWidth,v.videoHeight]});
  clips.push(importedClip(file,v,thumb.toDataURL('image/jpeg',.9)));selected=clips.length-1;
  const saved=await persist();await select(selected);
  if(saved)status('영상을 추가했어요. 순서를 바꾸거나 이어서 볼 수 있어요.');
 }catch(error){status(error.message);}
 finally{source?.dispose();$('galleryUpload').value='';lock(false);}
}
async function prepareImportedClip(clip){
 const source=await openImportedVideo(clip.sourceBlob);
 return {photos:[],frame:async()=>source.video,start:()=>source.video.play(),dispose:source.dispose};
}
$('galleryUpload').onchange=e=>void importGalleryVideo(e.target.files[0]);
