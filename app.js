'use strict';
const $=id=>document.getElementById(id), canvas=$('preview'),ctx=canvas.getContext('2d');
let pendingClip=null;
let cameraEnabled=false,clipStore=null;
let settingsOriginal=null;
let settingsSaving=false,selectionRenderToken=0;
let durationOriginal=null;
let timelapseRecording=false,timelapseStop=false,wakeLock=null;
const VIDEO_WIDTH=1080,VIDEO_HEIGHT=1920,VIDEO_FPS=30;
const clipLengths={normal:2,timelapse:6};
let suppressClipClickUntil=0;
let clips=[],selected=-1,stream=null,facing='environment',mode='normal',busy=false,cancelled=false,live=false,raf=0,db=null,resultURL=null,resultBlob=null;
$('time').value=localClock(new Date());
const status=t=>$('status').textContent=t;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const image=src=>new Promise((resolve,reject)=>{let i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
function cover(c,source,x,y,w,h,crop){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)return;const bounded=crop?{...crop,bounds:crop.bounds||detectPadding(source)}:undefined;c.drawImage(source,...cropRect(sw,sh,w,h,bounded),x,y,w,h)}
function draw(source,photos=[],caption=$('caption').value,time=$('time').value,collage=$('collage').checked,layout=layoutFor('preview'),backgroundBounds){ctx.save();ctx.scale(canvas.width/540,canvas.height/960);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#232b23';ctx.fillRect(0,0,540,960);if(source){if(source===$('camera'))paintCamera(ctx,source,540,960);else cover(ctx,source,0,0,540,960,{zoom:1,x:.5,y:.5,bounds:backgroundBounds||detectPadding(source)});}if(collage&&photos.length){layout.forEach((r,i)=>{if(photos[i])cover(ctx,photos[i],...r)})}ctx.save();ctx.fillStyle='white';ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.miterLimit=2;ctx.shadowBlur=0;ctx.textAlign='center';ctx.textBaseline='middle';const clock=videoClock(time),hasCaption=Boolean(caption?.trim());ctx.font='500 22px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif';if(clock){const y=hasCaption?466:480;ctx.strokeText(clock,270,y);ctx.fillText(clock,270,y);}if(hasCaption)drawCaption(ctx,caption,270,clock?494:480);ctx.restore();ctx.restore()}
function stopLive(){live=false;cancelAnimationFrame(raf)}
function loop(){if(!live)return;draw($('camera'),[],settingsOriginal?.caption??$('caption').value,liveClock());raf=requestAnimationFrame(loop)}
async function camera(deviceId){if(!cameraEnabled||busy||cameraOpening)return;cameraOpening=true;$('record').disabled=true;status('카메라를 연결하고 있어요. 권한 요청이 나오면 허용해 주세요.');try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Safari에서 다시 열거나 영상을 가져오세요.');stopLive();stream?.getTracks().forEach(t=>t.stop());const video={width:{ideal:VIDEO_WIDTH},height:{ideal:VIDEO_HEIGHT},frameRate:{ideal:VIDEO_FPS},aspectRatio:{ideal:9/16},resizeMode:{ideal:'none'}};if(typeof deviceId==='string'&&deviceId)video.deviceId={exact:deviceId};else video.facingMode={ideal:facing};stream=await acquireCamera(video,typeof deviceId==='string'&&Boolean(deviceId));if(!cameraEnabled){releaseCamera();return;}$('camera').srcObject=stream;await $('camera').play();await configureCamera();if(!cameraEnabled||$('shootScreen').hidden||busy||pendingClip){stream.getTracks().forEach(t=>t.stop());stream=null;return}selected=-1;$('empty').hidden=true;live=true;loop();status('구도를 맞춘 뒤 아래 녹화 버튼을 누르세요. 미리보기는 저장되지 않아요.')}catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;status(e.name==='NotAllowedError'?'카메라 권한을 허용한 뒤 토글을 다시 켜주세요.':'카메라를 연결하지 못했어요. 토글을 다시 켜주세요.')}finally{cameraOpening=false;if(!stream?.active)cameraEnabled=false;syncCameraToggle();syncZoomButtons()}}

function syncCameraToggle(){
 $('cameraToggle').checked=cameraEnabled;$('cameraToggle').disabled=busy||Boolean(pendingClip);
 $('record').disabled=busy||cameraOpening||!cameraEnabled||!stream?.active;
 $('flip').disabled=busy||!cameraEnabled||!stream?.active;
}
function releaseCamera(){stopLive();stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;syncCameraToggle();}
async function toggleCamera(){
 cameraEnabled=$('cameraToggle').checked;
 if(cameraEnabled)await camera();else{releaseCamera();ctx.clearRect(0,0,canvas.width,canvas.height);$('empty').hidden=false;status('카메라가 꺼져 있어요. 토글을 켜면 촬영할 수 있어요.');}
 syncCameraToggle();
}

function lock(on){busy=on;document.body.classList.toggle('busy',on);for(const id of ['shootTab','galleryTab','textEdit','keep','retake','reviewEdit','reviewPlay','collageToggle','durationOpen'])$(id).disabled=on||(Boolean(pendingClip)&&!['keep','retake','reviewEdit','reviewPlay'].includes(id));for(const id of ['record','cameraStart','flip','normal','timelapse','duration','upload','galleryUpload','play','export','caption','time','collage','zoom'])$(id).disabled=on||(['play','export'].includes(id)&&!clips.length);$('cancel').hidden=!on;syncCameraToggle();syncZoomButtons();syncTimeControl();renderList();if(!on&&pendingClip&&reviewPlayback.id!==pendingClip.id)void playPendingClip();}
function setMode(m){mode=m;$('normal').classList.toggle('selected',m==='normal');$('timelapse').classList.toggle('selected',m==='timelapse');updateDurationLabels();}
function updateDurationLabels(){
 $('normal').textContent=`일반 ${clipLengths.normal}초`;$('timelapse').textContent=`타임랩스 ${clipLengths.timelapse}초`;
 $('record').setAttribute('aria-label',`${mode==='normal'?'일반':'타임랩스'} ${clipLengths[mode]}초 촬영`);
 $('durationSummary').textContent=mode==='normal'?`${clipLengths.normal}초 동안 촬영해요.`:`원하는 만큼 촬영한 뒤 정지하면 ${clipLengths.timelapse}초로 압축해요.`;
}
function saveDurations(){
 const n=Number($('clipSeconds').value);if(!Number.isInteger(n)||n<1||n>30)return;
 clipLengths[mode]=n;$('duration').min=clipLengths.timelapse;
 if(Number($('duration').value)<clipLengths.timelapse)$('duration').value=clipLengths.timelapse;
 updateDurationLabels();
}
function openDuration(){if(busy||pendingClip)return;durationOriginal={capture:$('duration').value};$('clipSeconds').value=clipLengths[mode];$('captureDurationField').hidden=true;updateDurationLabels();$('durationSheet').showModal();}

async function initDB(){try{db=await new Promise((res,rej)=>{let r=indexedDB.open('after-hours-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('story');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});clipStore=new ClipStore(db);clips=await clipStore.load();opening=normalizeOpening(await clipStore.read('opening'));await Promise.all(clips.map(async clip=>{const edit=await clipStore.read('edit:'+clip.id);if(edit)Object.assign(clip,edit);}));renderList();if(clipStore.recovered)status('중단되기 전에 촬영한 컷을 모아보기에 복구했어요.');}catch(e){status('브라우저 보관함을 사용할 수 없어요. 촬영 후 파일로 저장해 주세요.')}}
async function persist(){$('downloadArea').hidden=true;await storageReady;if(!clipStore){status('현재 세션에만 보관 중이에요. 파일로 저장해 주세요.');return false}try{await clipStore.save(clips);return true}catch(e){status(storageErrorMessage(e));return false}}
function storageErrorMessage(error){
 return error?.name==='QuotaExceededError'?'브라우저 저장 한도를 초과했어요. 새로고침 전에 영상을 파일로 저장해 주세요.':`기기 저장에 실패했어요 (${error?.name||'저장소 연결 오류'}). 새로고침 전에 영상을 파일로 저장해 주세요.`;
}
async function persistClipEdit(clip){
 $('downloadArea').hidden=true;
 if(!db)return false;
 const edit={caption:clip.caption,time:clip.time,collage:clip.collage};
 try{await new Promise((res,rej)=>{const tx=db.transaction('story','readwrite');tx.objectStore('story').put(edit,'edit:'+clip.id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});return true;}
 catch(e){return false;}
}
function renderList(){
 const root=$('clips');root.replaceChildren();$('cutCount').textContent=clips.length;
 if(!clips.length){const p=document.createElement('p');p.className='hint';p.textContent='아직 담은 순간이 없어요.';root.append(p);}
 clips.forEach((clip,i)=>{
  const item=document.createElement('div');item.className='clip'+(i===selected?' selected':'');item.dataset.id=clip.id;
  const img=document.createElement('img');img.src=clip.frames[0];img.alt=`${i+1}번째 컷 미리보기`;img.draggable=false;
  const edit=document.createElement('button');edit.className='edit';edit.textContent=`${i+1}. ${clip.mode==='timelapse'?'타임랩스':clip.mode==='sample'?'샘플':clip.mode==='imported'?'추가한 영상':'일반'} · ${Number(clip.seconds.toFixed(1))}초`;edit.disabled=busy;
  const choose=()=>{if(!busy&&performance.now()>suppressClipClickUntil)select(i);};edit.onclick=choose;img.onclick=choose;
  const handle=document.createElement('button');handle.className='dragHandle';handle.textContent='⠿';handle.setAttribute('aria-label',`${i+1}번 컷 순서 변경`);handle.title='위아래로 드래그 · 키보드 방향키로 이동';handle.disabled=busy;
  handle.onkeydown=e=>{if(!busy&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(i,e.key==='ArrowUp'?-1:1);}};
  const del=document.createElement('button');del.className='deleteClip';del.textContent='×';del.disabled=busy;del.setAttribute('aria-label',`${i+1}번 컷 삭제`);del.onclick=()=>{if(performance.now()>suppressClipClickUntil)remove(i);};
  const modify=document.createElement('button');modify.className='modifyClip';modify.disabled=busy;modify.hidden=Boolean(clip.sourceBlob);modify.setAttribute('aria-label',`${i+1}번 컷 수정`);modify.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
  modify.onclick=()=>{if(busy||performance.now()<suppressClipClickUntil)return;selected=i;openSettings(true);};
  const thumb=document.createElement('div');thumb.className='clipThumb';thumb.append(img);
  const check=document.createElement('input');check.type='checkbox';check.className='openingCheck';check.checked=opening.ids.includes(clip.id);check.disabled=busy||Boolean(clip.sourceBlob);check.hidden=Boolean(clip.sourceBlob);check.setAttribute('aria-label',`${i+1}번째 컷 오프닝에 포함`);
  check.onpointerdown=e=>e.stopPropagation();check.onclick=e=>e.stopPropagation();
  check.onchange=()=>{opening.ids=check.checked?[...opening.ids.filter(id=>id!==clip.id),clip.id]:opening.ids.filter(id=>id!==clip.id);syncOpening();void saveOpening();};thumb.append(check);
  item.append(thumb,edit,handle,modify,del);root.append(item);bindClipDrag(item);
 });
 $('total').textContent=`${clips.length} CUTS · ${Number(clips.reduce((s,c)=>s+c.seconds,0).toFixed(1))}초`;
 syncOpening();
 for(const id of ['play','export'])$(id).disabled=busy||!clips.length;
}

async function select(i){const token=++selectionRenderToken;stopLive();selected=i;let clip=clips[i];if(!clip)return;$('empty').hidden=true;syncTimeControl();let imgs=await Promise.all(collageFrames(clip).map(image));if(token!==selectionRenderToken||clips[selected]?.id!==clip.id||live||$('galleryScreen').hidden)return;draw(imgs[1],imgs,clip.caption,clip.time,clip.collage,clipLayout(clip),clip.sourceBounds?.[photoIndicesFor(clip)[1]]);renderList()}
async function move(i,delta){let j=i+delta;if(j<0||j>=clips.length)return;[clips[i],clips[j]]=[clips[j],clips[i]];await select(j);persist()}
async function remove(i){clips.splice(i,1);selected=Math.min(i,clips.length-1);renderList();persist();if(selected>=0)select(selected);else{$('empty').hidden=false;ctx.clearRect(0,0,canvas.width,canvas.height)}}

let snapshotCanvas=null;
function snapshot(source,boundsList){let c=snapshotCanvas||(snapshotCanvas=document.createElement('canvas'));c.width=VIDEO_WIDTH;c.height=VIDEO_HEIGHT;const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';if(source===$('camera'))paintCamera(x,source,c.width,c.height);else cover(x,source,0,0,c.width,c.height);if(boundsList)boundsList.push([0,0,c.width,c.height]);return c.toDataURL('image/jpeg',.94)}

const reviewPlayback={id:null,position:0,playing:false,token:0,raf:0,media:null};
function pausePendingClip(){
 reviewPlayback.playing=false;reviewPlayback.media?.pause?.();reviewPlayback.token++;cancelAnimationFrame(reviewPlayback.raf);
 $('reviewPlay').textContent=reviewPlayback.position>=Number(pendingClip?.seconds||0)?'↻ 다시 보기':'▶ 미리보기';
 $('reviewPlay').setAttribute('aria-pressed','false');
}
function resetPendingPlayback(){pausePendingClip();reviewPlayback.id=null;reviewPlayback.position=0;reviewPlayback.media?.dispose?.();reviewPlayback.media=null;}
async function playPendingClip(){
 const clip=pendingClip;if(!clip||busy||!$('settingsOverlay').hidden)return;
 if(reviewPlayback.playing){pausePendingClip();return;}
 if(reviewPlayback.id!==clip.id){resetPendingPlayback();reviewPlayback.id=clip.id;}
 if(reviewPlayback.position>=clip.seconds)reviewPlayback.position=0;
 const token=++reviewPlayback.token;reviewPlayback.playing=true;
 $('reviewPlay').textContent='Ⅱ 일시정지';$('reviewPlay').setAttribute('aria-pressed','true');
 try{
  const media=reviewPlayback.media||await prepareClip(clip);
  if(token!==reviewPlayback.token||pendingClip!==clip){media.dispose?.();return;}
  reviewPlayback.media=media;
  await media.start?.(reviewPlayback.position);
  if(token!==reviewPlayback.token){media.pause?.();return;}
  const start=performance.now()-reviewPlayback.position*1000;
  const step=async now=>{try{
   if(token!==reviewPlayback.token||pendingClip!==clip)return;
   if(document.hidden){pausePendingClip();return;}
   const elapsed=Math.min(clip.seconds,(now-start)/1000),i=Math.min(clip.frames.length-1,Math.floor(elapsed/clip.seconds*clip.frames.length));
   const source=await media.frame(i);
   if(token!==reviewPlayback.token||pendingClip!==clip)return;
   reviewPlayback.position=elapsed;
   draw(source,media.photos,clip.caption,clip.time,clip.collage,clipLayout(clip),clip.sourceBounds?.[i]);
   $('reviewProgress').textContent=`${elapsed.toFixed(1)} / ${Number(clip.seconds.toFixed(1))}초`;
   if(elapsed>=clip.seconds){pausePendingClip();return;}
   reviewPlayback.raf=requestAnimationFrame(step);
  }catch(e){if(token===reviewPlayback.token){pausePendingClip();status('미리보기를 다시 눌러주세요.');}}};
  reviewPlayback.raf=requestAnimationFrame(step);
 }catch(e){if(token===reviewPlayback.token){pausePendingClip();status('미리보기를 다시 눌러주세요.');}}
}
$('reviewPlay').onclick=()=>void playPendingClip();
document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePendingClip();});
async function renderPendingClip(){
 const clip=pendingClip;if(!clip)return;
 
 const photos=await Promise.all(collageFrames(clip).map(image));if(pendingClip!==clip)return;
 draw(photos[1],photos,clip.caption,clip.time,clip.collage,clipLayout(clip),clip.sourceBounds?.[photoIndicesFor(clip)[1]]);
}
async function add(frames,m,seconds,timing=beginTiming(),sourceBounds=null){
 const id=crypto.randomUUID();pendingClip={id,layoutVersion:2,layout:layoutFor(id),frames,width:VIDEO_WIDTH,height:VIDEO_HEIGHT,fps:VIDEO_FPS,sourceBounds:sourceBounds||frames.map(()=>[0,0,VIDEO_WIDTH,VIDEO_HEIGHT]),mode:m,seconds,caption:$('caption').value,...timing,collage:$('collage').checked};
 releaseCamera();$('empty').hidden=true;
 pendingClip.photoIndices=photoIndicesFor(pendingClip);pendingClip.crops=clipCrops(pendingClip);
 setBackupFile(null);
 await storageReady;try{await clipStore?.checkpoint(pendingClip);}catch(e){status(storageErrorMessage(e));}
 status('꾸밈없는 원본 영상을 준비하고 있어요…');
 try{const file=await makeCleanBackup(pendingClip);setBackupFile(file);compactRecording(pendingClip,file);try{await clipStore?.checkpoint(pendingClip);}catch(e){status(storageErrorMessage(e));}}catch(e){status(e.message);}
 await renderPendingClip();
 $('reviewProgress').textContent=`0.0 / ${Number(pendingClip.seconds.toFixed(1))}초`;$('captureDock').hidden=true;$('reviewDock').hidden=false;$('textEdit').hidden=true;status(pendingClip.timeSource==='unknown'?'촬영 시각을 찾지 못했어요. 문구 · 시간 수정에서 직접 입력해 주세요.':pendingBackup?'담기를 누른 뒤 공유창에서 비디오 저장을 선택해 주세요.':'원본 준비를 완료하지 못했어요. 담기를 눌러 다시 준비해 주세요.');
}
async function record(){
 if(timelapseRecording){timelapseStop=true;$('record').disabled=true;return;}
 if(busy||cameraOpening||zoomChanging||keeping)return;
 if(!cameraEnabled||!stream?.active){status('카메라 토글을 먼저 켜주세요.');return;}
 cancelled=false;timelapseStop=false;lock(true);let captureActive=true;
 try{
  // Capture starts without waiting for screen-wake permission.
  const timing=beginTiming();activeCaptureTime=timing.time;
  try{navigator.wakeLock?.request('screen').then(lock=>{if(captureActive)wakeLock=lock;else void lock.release().catch(()=>{});}).catch(()=>{});}catch(e){}
  stopLive();live=true;loop();
  const seconds=clipLengths[mode],count=seconds*VIDEO_FPS,start=performance.now();let frames=[],bounds=[];
  if(mode==='timelapse'){
   const samples=new TimelapseSamples();timelapseRecording=true;$('record').disabled=false;$('record').setAttribute('aria-label','타임랩스 촬영 정지');
   while(!timelapseStop){
    if(cancelled||document.hidden)throw Error('촬영이 중단됐어요. 화면을 켠 상태에서 다시 찍어주세요.');
    const elapsed=performance.now()-start;
    if(samples.due(elapsed))samples.push(elapsed,snapshot($('camera')));
    status(`타임랩스 ${Math.floor(elapsed/60000)}:${String(Math.floor(elapsed/1000)%60).padStart(2,'0')} · 정지하면 ${seconds}초로 완성돼요`);
    await wait(30);
   }
   timelapseRecording=false;
   const elapsed=performance.now()-start;
   samples.push(elapsed,snapshot($('camera')));
   frames=samples.finish(count,elapsed);
  }else{
   for(let n=0;n<count;n++){
    await wait(Math.max(0,start+n*1000/VIDEO_FPS-performance.now()));
    if(cancelled||document.hidden)throw Error('촬영이 중단됐어요. 화면을 켠 상태에서 다시 찍어주세요.');
    frames.push(snapshot($('camera'),bounds));status(`촬영 중 · ${((performance.now()-start)/1000).toFixed(1)} / ${seconds}초`);
   }
   await wait(Math.max(0,start+seconds*1000-performance.now()));
  }
  if(cancelled)throw Error('촬영을 취소했어요.');
  $('record').disabled=true;await add(frames,mode,seconds,timing,bounds.length?bounds:null);
 }catch(e){status(e.message);}
 finally{if(snapshotCanvas){snapshotCanvas.width=0;snapshotCanvas.height=0;snapshotCanvas=null;}captureActive=false;timelapseRecording=false;activeCaptureTime=null;stopLive();await wakeLock?.release().catch(()=>{});wakeLock=null;lock(false);updateDurationLabels();}
}
async function importVideo(file){
 if(!file||busy)return;
 if(file.size>300*1024*1024){status('300MB 이하의 영상을 선택해 주세요.');return;}
 cancelled=false;lock(true);stopLive();let source;
 try{
  status('영상의 첫 화면을 읽고 있어요…');
  const recovered=await readBackupTiming(file),timing=recovered?.timing||unknownCaptureTiming();
  source=await loadVideoFile(file,()=>cancelled);const v=source.video,d=v.duration;
  const own=recovered?.own,importMode=own?(own.mode==='timelapse'?'timelapse':'normal'):mode;
  const seconds=own?Math.max(1,Math.min(30,Number(own.seconds)||d)):mode==='normal'?Math.min(30,d):clipLengths[mode];
  const count=Math.max(1,Math.round(seconds*VIDEO_FPS)),span=own?d:mode==='normal'?Math.min(seconds,d):d,frames=[];
  for(let i=0;i<count;i++){
   await seekDecodedFrame(v,i*span/count,()=>cancelled);
   frames.push(snapshot(v));status(`영상 준비 중 · ${Math.round((i+1)/count*100)}%`);
  }
  if(cancelled)throw Error('가져오기를 취소했어요.');
  await add(frames,importMode,seconds,timing);
 }catch(e){status(e.message);}
 finally{if(snapshotCanvas){snapshotCanvas.width=0;snapshotCanvas.height=0;snapshotCanvas=null;}source?.dispose();$('upload').value='';lock(false);}
}
// Decode only a small moving window, not every full-HD frame in every clip.
async function prepareClip(clip){
 if(clip.playbackBlob)return prepareRecordedClip(clip);
 if(clip.sourceBlob)return prepareImportedClip(clip);
 const cache=new Map();
 const get=i=>{if(!cache.has(i))cache.set(i,image(clip.frames[i]));return cache.get(i);};
 const photos=await Promise.all(collageFrames(clip).map(image));
 await get(0);
 return {photos,dispose(){cache.clear();photos.forEach(img=>img.src='');photos.length=0;},async frame(i){
  for(const key of cache.keys())if(key<i||key>i+3)cache.delete(key);
  for(let j=i;j<Math.min(clip.frames.length,i+4);j++)get(j).catch(()=>{});
  return get(i);
 }};
}
async function sequence(exporting,onlyOpening=false){if(!clips.length||busy)return;const plan=sequencePlan(clips,opening,onlyOpening);if(!plan.length)return;if(!exporting){previewOpeningOnly=onlyOpening;openSequencePreview();}cancelled=false;lock(true);releaseCamera();if(exporting){if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;resultBlob=null;$('result').removeAttribute('src');$('result').load();$('downloadArea').hidden=true;}$('empty').hidden=true;let recorder=null,outputStream=null;const resources=new Set();let finished=false;const prepare=async clip=>{const media=await prepareClip(clip);if(finished){media.dispose?.();throw Error('미리보기가 종료됐어요.');}resources.add(media);return media;};try{status('컷을 준비하고 있어요…');const openingMedia=await prepareOpeningMedia(plan,exporting);for(const m of openingMedia.values())resources.add(m);let media=openingMedia.get(plan[0])||await prepare(plan[0].clip);drawSequenceFrame(await media.frame(0),media.photos,plan[0],0,media.bounds);let chunks=[];if(exporting){if(!window.MediaRecorder||!canvas.captureStream)throw Error('이 브라우저에서는 영상 저장을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어주세요.');let type=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('지원되는 영상 저장 형식을 찾지 못했어요.');outputStream=canvas.captureStream(30);recorder=new MediaRecorder(outputStream,{mimeType:type,videoBitsPerSecond:16000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}}
for(let index=0;index<plan.length;index++){
 const segment=plan[index],clip=segment.clip;
 // Safari must not warm up another video while this clip is being recorded.
 if(index>0){if(openingMedia.has(segment))media=openingMedia.get(segment);else media=await prepare(clip);}
 if(cancelled)throw Error("미리보기를 중단했어요.");
 const sourceStart=segment.start||0,playbackRate=segment.playbackRate||1;
 await media.start?.(sourceStart,playbackRate);
 const firstIndex=Math.min(clip.frames.length-1,Math.floor(sourceStart/clip.seconds*clip.frames.length));
 drawSequenceFrame(await media.frame(firstIndex),media.photos,segment,firstIndex,media.bounds);
 if(recorder?.state==='inactive')recorder.start(1000);else if(recorder?.state==='paused')recorder.resume();
 const start=performance.now();let lastMediaTime=media.position?.()??0,lastAdvance=start;

 await new Promise((resolve,reject)=>{async function step(now){try{
  if(cancelled||document.hidden)throw Error('재생 / 저장을 중단했어요. 화면을 켜두고 다시 시도해주세요.');
  const elapsed=(now-start)/1000;
  if(media.position){const position=media.position();if(position>lastMediaTime+.005){lastMediaTime=position;lastAdvance=now;}else if(now-lastAdvance>1000&&position<clip.seconds-.15)throw Error(`${index+1}번째 컷 재생이 멈춰 ${exporting?'저장':'미리보기'}를 중단했어요. 다시 시도해 주세요.`);}
  if(elapsed>=segment.seconds){resolve();return;}
  const frameIndex=Math.min(clip.frames.length-1,Math.floor((sourceStart+elapsed*playbackRate)/clip.seconds*clip.frames.length));
  const source=media.frameAt?await media.frameAt(sourceStart+elapsed*playbackRate):await media.frame(frameIndex);
  drawSequenceFrame(source,media.photos,segment,frameIndex,media.bounds);
  status(`${exporting?'1080p 영상 만드는 중':'이어서 보는 중'} · ${segment.intro?'오프닝':'본편'} ${index+1}/${plan.length} 컷`);if(!exporting)$('sequenceProgress').textContent=`${segment.intro?'오프닝':'본편'} · ${index+1} / ${plan.length} 컷`;requestAnimationFrame(step);
 }catch(e){reject(e)}}requestAnimationFrame(step)});
 if(index+1<plan.length&&!openingMedia.has(plan[index+1])&&recorder?.state==='recording')recorder.pause();
 media.dispose?.();resources.delete(media);openingMedia.delete(segment);
}
if(recorder){await new Promise((res,rej)=>{recorder.onstop=res;recorder.onerror=()=>rej(Error('영상 저장 중 오류가 발생했어요.'));recorder.stop()});resultBlob=new Blob(chunks,{type:recorder.mimeType});if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(resultBlob);$('result').src=resultURL;$('download').href=resultURL;$('download').download=`after-hours-${new Date().toISOString().slice(0,10)}.${resultBlob.type.includes('mp4')?'mp4':'webm'}`;$('downloadArea').hidden=false;status(`완성했어요! ${Number(plan.reduce((s,c)=>s+c.seconds,0).toFixed(1))}초 · 1080×1920 · ${resultBlob.type.includes('mp4')?'MP4':'WebM'} · 아래에서 다운로드하거나 공유하세요.`)}else{status('모든 컷을 재생했어요.');if($('sequencePreview').open)$('sequenceProgress').textContent='모든 컷을 재생했어요.';}}catch(e){status(!exporting&&!$('sequencePreview').open?'미리보기를 닫았어요.':e.message);if(!exporting&&$('sequencePreview').open)$('sequenceProgress').textContent=e.message;if(recorder&&recorder.state!=='inactive')recorder.stop()}finally{finished=true;for(const media of resources)media.dispose?.();outputStream?.getTracks().forEach(t=>t.stop());lock(false);if(!exporting)$('sequenceReplay').hidden=!$('sequencePreview').open;}}
$('cameraStart').disabled=true;$('cameraStart').setAttribute('aria-label','위의 카메라 토글을 켜주세요');$('cameraToggle').onchange=toggleCamera;$('zoom').oninput=changeZoom;$('flip').onclick=()=>{facing=facing==='environment'?'user':'environment';camera()};$('normal').onclick=()=>setMode('normal');$('timelapse').onclick=()=>setMode('timelapse');$('record').onclick=record;$('cancel').onclick=()=>{cancelled=true};$('upload').onchange=e=>importVideo(e.target.files[0]);$('play').onclick=()=>sequence(false);$('export').onclick=()=>sequence(true);$('share').onclick=async()=>{try{let file=new File([resultBlob],$('download').download,{type:resultBlob.type});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else $('download').click()}catch(e){if(e.name!=='AbortError')status('공유하지 못했어요. 다운로드 버튼으로 저장해주세요.')}};document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy)cancelled=true});window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));setMode('normal');syncTimeControl();syncCameraToggle();const storageReady=initDB();

// A regular overlay avoids native dialog focus changes during iOS keyboard composition.
function openCaptionSheet(){
 $('settingsOverlay').hidden=false;
 document.querySelector('main').inert=true;document.querySelector('nav').inert=true;
}
function closeCaptionSheet(){
 $('editCaption').blur();$('editTime').blur();$('settingsOverlay').hidden=true;
 document.querySelector('main').inert=false;document.querySelector('nav').inert=false;
}
function openSettings(textOnly=false){
 if(busy||keeping||settingsSaving||!$('settingsOverlay').hidden)return;
 if(pendingClip)pausePendingClip();
 const clip=pendingClip||(!$('galleryScreen').hidden&&selected>=0?clips[selected]:null);
 settingsOriginal={pending:Boolean(pendingClip),clipId:clip?.id??null,caption:clip?.caption??$('caption').value,time:clip?.time??$('time').value,collage:clip?.collage??$('collage').checked};
 $('editSaveStatus').textContent='';$('editCaption').disabled=false;$('editCaption').readOnly=false;$('editCaption').value=settingsOriginal.caption;$('editTime').value=settingsOriginal.time;$('editCollage').checked=settingsOriginal.collage;
 syncTimeControl();$('editTime').disabled=$('time').disabled;
 $('settingsSheet').classList.toggle('captionOnly',textOnly&&!pendingClip&&$('galleryScreen').hidden);openCaptionSheet();if(textOnly){$('editCaption').focus({preventScroll:true});}
}
function showScreen(screen){if(busy||pendingClip)return;const gallery=screen==='gallery';selectionRenderToken++;stopLive();$('shootScreen').hidden=gallery;$('galleryScreen').hidden=!gallery;(gallery?$('galleryStage'):$('cameraStage')).prepend(document.querySelector('.viewer'));$('shootTab').setAttribute('aria-current',gallery?'false':'page');$('galleryTab').setAttribute('aria-current',gallery?'page':'false');if(gallery){releaseCamera();if(clips.length)select(selected>=0?selected:clips.length-1);else $('empty').hidden=false;}else{selected=-1;if(stream?.active)resumeCamera();else{$('empty').hidden=false;if(cameraEnabled)camera();}}status(gallery?'컷을 선택해 문구를 바꾸거나 순서를 정리하세요.':'준비되면 촬영 버튼을 눌러주세요.');}
function startNext(){resetPendingPlayback();pendingClip=null;for(const id of ['shootTab','galleryTab','textEdit','collageToggle','durationOpen'])$(id).disabled=false;$('captureDock').hidden=false;$('reviewDock').hidden=true;$('textEdit').hidden=false;selected=-1;if(stream?.active)resumeCamera();else{$('empty').hidden=false;ctx.clearRect(0,0,canvas.width,canvas.height);if(cameraEnabled)camera();}syncCameraToggle();}
function discardSettings(){
 settingsOriginal=null;
 // The dialog edits separate draft fields; dismissing never touches saved state.
 $('editCaption').value='';$('editTime').value='';
}
$('textEdit').onclick=()=>openSettings(true);
$('reviewEdit').onclick=()=>openSettings(true);
function setSettingsSaving(on){
 settingsSaving=on;for(const id of ['settingsClose','settingsCancel','clearCaption'])$(id).disabled=on;
 $('settingsClose').textContent=on?'저장 중…':'완료';
 $('editCaption').readOnly=on;$('editCollage').disabled=on;
 $('editTime').disabled=on||$('time').disabled;
}
$('settingsClose').onclick=async()=>{
 if(!settingsOriginal||settingsSaving)return;
 const session=settingsOriginal;
 // Read the live draft before closing the keyboard can move the tapped button.
 if(!$('editCaption').reportValidity()||(!$('editTime').disabled&&!$('editTime').reportValidity())){settingsSaving=false;return;}
 const values={caption:$('editCaption').value.replace(/[\r\n]+/g,' '),time:$('editTime').value,collage:$('editCollage').checked};
 setSettingsSaving(true);$('editSaveStatus').textContent='문구를 반영하고 있어요…';
 try{
  if(session.pending){
   if(pendingClip?.id!==session.clipId)throw Error('수정할 컷을 다시 선택해 주세요.');
   pausePendingClip();const previous={caption:pendingClip.caption,time:pendingClip.time,collage:pendingClip.collage};Object.assign(pendingClip,values);
   try{await renderPendingClip();}catch(e){Object.assign(pendingClip,previous);throw e;}reviewPlayback.position=0;
   settingsOriginal=null;closeCaptionSheet();status('문구를 반영했어요. 담기를 누르면 보관돼요.');
  }else if(session.clipId!==null){
   const index=clips.findIndex(c=>c.id===session.clipId);if(index<0)throw Error('수정할 컷을 다시 선택해 주세요.');
   Object.assign(clips[index],values);
   // Editing text never serializes or rewrites video frames.
   const saved=await persistClipEdit(clips[index]);
   try{await select(index);}catch(e){status('문구는 저장됐어요. 컷을 다시 선택하면 확인할 수 있어요.');}
   settingsOriginal=null;closeCaptionSheet();status(saved?'문구를 저장했어요.':'문구는 현재 화면에 반영됐지만 기기에 저장하지 못했어요. 새로고침 전에 영상 저장을 눌러주세요.');
  }else{
   $('caption').value=values.caption;$('collage').checked=values.collage;
   settingsOriginal=null;syncCollageIcon();closeCaptionSheet();status('촬영 문구를 반영했어요.');
  }
 }catch(e){$('editSaveStatus').textContent=e.message||'저장하지 못했어요. 다시 시도해 주세요.';}
 finally{setSettingsSaving(false);}
 if(session.pending&&!settingsOriginal&&pendingClip?.id===session.clipId)void playPendingClip();
};
$('settingsCancel').onclick=()=>{if(settingsSaving)return;discardSettings();closeCaptionSheet();};
let backdropPress=false;
$('settingsOverlay').addEventListener('pointerdown',e=>{backdropPress=e.target===$('settingsOverlay');});
$('settingsOverlay').addEventListener('pointercancel',()=>{backdropPress=false;});
$('settingsOverlay').onclick=e=>{
 const dismiss=backdropPress&&e.target===$('settingsOverlay');backdropPress=false;
 if(!settingsSaving&&dismiss){discardSettings();closeCaptionSheet();}
};
$('settingsSheet').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!settingsSaving){discardSettings();closeCaptionSheet();}}});
$('shootTab').onclick=()=>showScreen('shoot');$('galleryTab').onclick=()=>showScreen('gallery');
$('keep').onclick=keepAndBackup;
$('backupAgain').onclick=()=>{if(busy||keeping)return;shareCleanBackup().then(()=>status('사진 앱 또는 파일 앱에 저장됐는지 확인해 주세요.')).catch(()=>status('저장을 취소했어요. 원본 다시 저장으로 다시 열 수 있어요.'));};
$('retake').onclick=async()=>{if(pendingClip&&clipStore)try{await clipStore.discard(pendingClip.id);}catch(e){status(storageErrorMessage(e));return;}startNext();status('다시 찍을 준비가 됐어요.');};

// Conservative recovery for older clips that did not store camera-content bounds.
const paddingCache=new WeakMap();
function detectPadding(source){
 if(paddingCache.has(source))return paddingCache.get(source);
 const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
 const full=[0,0,sw,sh];let result=full;
 try{
  const c=document.createElement('canvas');c.width=sw;c.height=sh;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0);const d=x.getImageData(0,0,sw,sh).data;
  const isPad=(px,py)=>{const i=(py*sw+px)*4;return Math.abs(d[i]-20)<=5&&Math.abs(d[i+1]-23)<=5&&Math.abs(d[i+2]-20)<=5;};
  const row=y=>{for(let x=2;x<sw-2;x+=5)if(!isPad(x,y))return false;return true;};
  const col=x=>{for(let y=2;y<sh-2;y+=5)if(!isPad(x,y))return false;return true;};
  let t=0,b=0,l=0,r=0;
  while(t<sh*.4&&row(t))t++;while(b<sh*.4&&row(sh-1-b))b++;
  while(l<sw*.4&&col(l))l++;while(r<sw*.4&&col(sw-1-r))r++;
  if(t>=3&&b>=3&&Math.abs(t-b)<=6&&t<sh*.4&&b<sh*.4)result=[0,t+3,sw,sh-t-b-6];
  else if(l>=3&&r>=3&&Math.abs(l-r)<=6&&l<sw*.4&&r<sw*.4)result=[l+3,0,sw-l-r-6,sh];
 }catch(e){/* Keep older footage intact when pixels are unavailable. */}
 paddingCache.set(source,result);return result;
}

// Space grapheme clusters, keeping emoji sequences and Korean syllables intact.
function captionGlyphs(text){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text);}
function drawCaption(c,text,x,y){
 const glyphs=captionGlyphs(text),spacing=.8;let size=21,widths,total;
 do{c.font=`400 ${size}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif`;widths=glyphs.map(g=>c.measureText(g).width);total=widths.reduce((a,b)=>a+b,0)+Math.max(0,glyphs.length-1)*spacing;if(total<=490||size<=10)break;size--;}while(true);
 c.textAlign='left';for(const method of ['strokeText','fillText']){let left=x-total/2;glyphs.forEach((g,i)=>{c[method](g,left,y);left+=widths[i]+spacing;});}
}

function syncCollageIcon(){$('collageToggle').setAttribute('aria-pressed',String($('collage').checked));}
$('collageToggle').onclick=()=>{if(busy||pendingClip)return;$('collage').checked=!$('collage').checked;syncCollageIcon();status($('collage').checked?'콜라주 켜짐 · 촬영 후 작은 사진 2~3장을 추가해요.':'콜라주 꺼짐');};

function previewDuration(){
 const n=Number($('clipSeconds').value);
 if(!Number.isInteger(n)||n<1||n>30){$('durationSummary').textContent='1~30초 사이로 입력해 주세요.';return;}
 if(mode==='timelapse')$('duration').min=n;
 $('durationSummary').textContent=mode==='normal'?`${n}초 동안 촬영해요.`:`원하는 만큼 촬영한 뒤 정지하면 ${n}초로 압축해요.`;
}
function discardDuration(){
 if(!durationOriginal)return;
 $('duration').value=durationOriginal.capture;$('duration').min=clipLengths.timelapse;$('clipSeconds').value=clipLengths[mode];durationOriginal=null;updateDurationLabels();
}
$('durationOpen').onclick=openDuration;$('clipSeconds').oninput=previewDuration;
$('duration').oninput=previewDuration;
$('durationClose').onclick=()=>{if(!$('clipSeconds').reportValidity())return;saveDurations();durationOriginal=null;$('durationSheet').close();};
$('durationCancel').onclick=()=>{discardDuration();$('durationSheet').close();};
$('durationSheet').addEventListener('cancel',discardDuration);
$('durationSheet').addEventListener('close',discardDuration);
$('durationSheet').onclick=e=>{if(e.target===$('durationSheet')){const r=e.target.getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right){discardDuration();e.target.close();}}};
for(const b of document.querySelectorAll('[data-zoom]'))b.onclick=()=>{if(b.disabled)return;$('zoom').value=b.dataset.zoom;changeZoom();};
syncZoomButtons();syncCollageIcon();

function reorderClipsByIds(items,ids){const map=new Map(items.map(c=>[c.id,c]));return ids.map(id=>map.get(id));}
function bindClipDrag(item){
 let drag=null;
 item.addEventListener('pointerdown',e=>{
  if(busy||e.button!==0||e.target.closest('.deleteClip,.modifyClip')||(!item.classList.contains('selected')&&!e.target.closest('.dragHandle')))return;
  if(clips.length<2)return;
  const r=item.getBoundingClientRect();drag={id:e.pointerId,startY:e.clientY,y:e.clientY,offset:e.clientY-r.top,rect:r,ghost:null,raf:0,active:false};
  item.setPointerCapture(e.pointerId);
 });
 const position=()=>{
  if(!drag?.active)return;
  const pane=$('galleryScreen'),bounds=pane.getBoundingClientRect();
  if(drag.y<bounds.top+55)pane.scrollTop-=9;else if(drag.y>bounds.bottom-55)pane.scrollTop+=9;
  drag.ghost.style.top=(drag.y-drag.offset)+'px';
  const others=[...$('clips').children].filter(n=>n!==item&&n.classList.contains('clip'));
  const next=others.find(n=>{const r=n.getBoundingClientRect();return drag.y<r.top+r.height/2;});
  for(const n of others)n.classList.remove('dropBefore','dropAfter');drag.beforeId=next?.dataset.id||null;if(next)next.classList.add('dropBefore');else others.at(-1)?.classList.add('dropAfter');
  drag.raf=requestAnimationFrame(position);
 };
 item.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;drag.y=e.clientY;
  if(!drag.active&&Math.abs(e.clientY-drag.startY)>6){
   drag.active=true;drag.ghost=item.cloneNode(true);drag.ghost.classList.add('dragGhost');drag.ghost.setAttribute('aria-hidden','true');drag.ghost.style.cssText=`position:fixed;left:${drag.rect.left}px;top:${drag.rect.top}px;width:${drag.rect.width}px;z-index:1000;pointer-events:none;`;
   document.body.append(drag.ghost);item.classList.add('dragOrigin');position();
  }
  if(drag.active)e.preventDefault();
 });
 const finish=(e,cancel=false)=>{
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;cancelAnimationFrame(d.raf);d.ghost?.remove();item.classList.remove('dragOrigin');for(const n of $('clips').children)n.classList.remove('dropBefore','dropAfter');
  if(d.active){
   suppressClipClickUntil=performance.now()+400;
   if(!cancel){const ids=clips.map(c=>c.id).filter(id=>id!==item.dataset.id);const at=d.beforeId?ids.indexOf(d.beforeId):ids.length;ids.splice(at<0?ids.length:at,0,item.dataset.id);clips=reorderClipsByIds(clips,ids);selected=clips.findIndex(c=>c.id===item.dataset.id);persist();select(selected);status('영상 순서를 바꿨어요.');}else renderList();
  }
  if(item.hasPointerCapture(e.pointerId))item.releasePointerCapture(e.pointerId);
 };
 item.addEventListener('pointerup',e=>finish(e));item.addEventListener('pointercancel',e=>finish(e,true));item.addEventListener('lostpointercapture',e=>{if(drag)finish(e,true);});
}

$('clearCaption').onclick=()=>{if(busy)return;$('editCaption').value='';$('editCaption').focus();};


$('openingPreview').onclick=()=>sequence(false,true);
$('openingClear').onclick=()=>{if(busy)return;opening.ids=[];renderList();void saveOpening();};
$('openingSeconds').onchange=()=>{if(busy)return;opening=normalizeOpening({...opening,seconds:$('openingSeconds').value});syncOpening();void saveOpening();};

for(const button of document.querySelectorAll('[data-opening-title]'))button.onclick=()=>{if(busy)return;opening.title=button.dataset.openingTitle;syncOpening();void saveOpening();};

let openingTextSaveTimer;
$('openingCustomText').addEventListener('input',()=>{opening.customText=$('openingCustomText').value;clearTimeout(openingTextSaveTimer);openingTextSaveTimer=setTimeout(()=>void saveOpening(),350);});
$('openingCustomText').addEventListener('blur',()=>{clearTimeout(openingTextSaveTimer);opening.customText=$('openingCustomText').value;void saveOpening();});

$('openingCustomColor').addEventListener('input',()=>{opening.customColor=validOpeningColor($('openingCustomColor').value);syncOpening();});
$('openingCustomColor').addEventListener('change',()=>{opening.customColor=validOpeningColor($('openingCustomColor').value);void saveOpening();});
