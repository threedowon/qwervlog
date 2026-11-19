'use strict';
function playbackDiagnostic(video){
 const n=value=>Number.isFinite(value)?value.toFixed(2):'?';
 return `위치 ${n(video.currentTime)} / 파일 ${n(video.duration)}초 · paused=${Boolean(video.paused)} · ended=${Boolean(video.ended)} · ready=${video.readyState} · error=${video.error?.code||0}`;
}

async function openImportedVideo(blob){return loadVideoFile(blob,()=>cancelled);}
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
 return {photos:[],diagnostic:()=>playbackDiagnostic(source.video),position:()=>source.video.currentTime,frame:async()=>source.video,start:async(position=0,rate=1)=>{source.video.playbackRate=rate;await seekDecodedFrame(source.video,position,()=>cancelled);await source.video.play();},dispose:source.dispose};
}
$('galleryUpload').onchange=e=>void importGalleryVideo(e.target.files[0]);

// New recordings retain a compressed clean video and only the three collage stills.
// Legacy JPEG-frame clips continue to use prepareClip without conversion.
function compactRecording(clip,file){
 const frames=collageFrames(clip),bounds=photoIndicesFor(clip).map(i=>clip.sourceBounds?.[i]||[0,0,clip.width,clip.height]);
 const old=clip.frames;clip.playbackBlob=file;clip.frames=frames;clip.sourceBounds=bounds;clip.photoIndices=[0,1,2];old.length=0;
}
async function prepareRecordedClip(clip){
 const source=await openImportedVideo(clip.playbackBlob);
 try{
  const photos=await Promise.all(collageFrames(clip).map(image));
  return {photos,diagnostic:()=>playbackDiagnostic(source.video),position:()=>source.video.currentTime,frame:async()=>source.video,
   start:async(position=0,rate=1)=>{source.video.playbackRate=rate;await seekDecodedFrame(source.video,position,()=>cancelled);await source.video.play();},
   pause:()=>source.video.pause(),dispose(){photos.forEach(img=>img.src='');source.dispose();}};
 }catch(e){source.dispose();throw e;}
}
