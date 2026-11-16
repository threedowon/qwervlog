'use strict';
const $=id=>document.getElementById(id), canvas=$('preview'),ctx=canvas.getContext('2d');
let pendingClip=null;
let settingsOriginal=null;
let durationOriginal=null;
const clipLengths={normal:2,timelapse:6};
let suppressClipClickUntil=0;
let clips=[],selected=-1,stream=null,facing='environment',mode='normal',busy=false,cancelled=false,live=false,raf=0,db=null,resultURL=null,resultBlob=null;
$('time').value=localClock(new Date());
const status=t=>$('status').textContent=t;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const image=src=>new Promise((resolve,reject)=>{let i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
function cover(c,source,x,y,w,h,crop){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)return;const bounded=crop?{...crop,bounds:crop.bounds||detectPadding(source)}:undefined;c.drawImage(source,...cropRect(sw,sh,w,h,bounded),x,y,w,h)}
function draw(source,photos=[],caption=$('caption').value,time=$('time').value,collage=$('collage').checked,layout=layoutFor('preview'),backgroundBounds){ctx.fillStyle='#232b23';ctx.fillRect(0,0,540,960);if(source){if(source===$('camera'))paintCamera(ctx,source,540,960);else cover(ctx,source,0,0,540,960,{zoom:1,x:.5,y:.5,bounds:backgroundBounds||detectPadding(source)});}if(collage&&photos.length){layout.forEach((r,i)=>{if(photos[i])cover(ctx,photos[i],...r)})}ctx.save();ctx.fillStyle='white';ctx.shadowColor='#0008';ctx.shadowBlur=5;ctx.textAlign='center';ctx.font='400 25px -apple-system,Arial,sans-serif';ctx.fillText(time||'',270,441);drawCaption(ctx,caption,270,465);ctx.restore()}
function stopLive(){live=false;cancelAnimationFrame(raf)}
function loop(){if(!live)return;draw($('camera'),[],settingsOriginal?.caption??$('caption').value,liveClock());raf=requestAnimationFrame(loop)}
async function camera(deviceId){if(busy||cameraOpening)return;cameraOpening=true;$('record').disabled=true;status('카메라를 연결하고 있어요. 권한 요청이 나오면 허용해 주세요.');try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Safari에서 다시 열거나 영상을 가져오세요.');stopLive();stream?.getTracks().forEach(t=>t.stop());const video={resizeMode:{ideal:'none'}};if(typeof deviceId==='string'&&deviceId)video.deviceId={exact:deviceId};else video.facingMode={ideal:facing};stream=await navigator.mediaDevices.getUserMedia({video,audio:false});$('camera').srcObject=stream;await $('camera').play();await configureCamera();if($('shootScreen').hidden||busy||pendingClip){stream.getTracks().forEach(t=>t.stop());stream=null;return}selected=-1;$('empty').hidden=true;live=true;loop();status('구도를 맞춘 뒤 아래 녹화 버튼을 누르세요. 미리보기는 저장되지 않아요.')}catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;status(e.name==='NotAllowedError'?'카메라 권한을 허용한 뒤 가운데 카메라 아이콘을 눌러주세요.':'자동 미리보기를 시작하지 못했어요. 가운데 카메라 아이콘을 눌러주세요.')}finally{cameraOpening=false;$('record').disabled=busy;syncZoomButtons()}}

function lock(on){busy=on;document.body.classList.toggle('busy',on);for(const id of ['shootTab','galleryTab','textEdit','keep','retake','collageToggle','durationOpen'])$(id).disabled=on||(Boolean(pendingClip)&&!['keep','retake'].includes(id));for(const id of ['record','cameraStart','flip','normal','timelapse','duration','upload','play','export','caption','time','collage','zoom'])$(id).disabled=on||(['play','export'].includes(id)&&!clips.length);$('cancel').hidden=!on;syncZoomButtons();syncTimeControl();renderList()}
function setMode(m){mode=m;$('normal').classList.toggle('selected',m==='normal');$('timelapse').classList.toggle('selected',m==='timelapse');updateDurationLabels();}
function updateDurationLabels(){
 $('normal').textContent=`일반 ${clipLengths.normal}초`;$('timelapse').textContent=`타임랩스 ${clipLengths.timelapse}초`;
 $('record').setAttribute('aria-label',`${mode==='normal'?'일반':'타임랩스'} ${clipLengths[mode]}초 촬영`);
 $('durationSummary').textContent=mode==='normal'?`${clipLengths.normal}초 동안 촬영해요.`:`${Math.max(clipLengths.timelapse,Number($('duration').value)||30)}초를 ${clipLengths.timelapse}초로 압축해요.`;
}
function saveDurations(){
 const n=Number($('clipSeconds').value);if(!Number.isInteger(n)||n<1||n>30)return;
 clipLengths[mode]=n;$('duration').min=clipLengths.timelapse;
 if(Number($('duration').value)<clipLengths.timelapse)$('duration').value=clipLengths.timelapse;
 updateDurationLabels();
}
function openDuration(){if(busy||pendingClip)return;durationOriginal={capture:$('duration').value};$('clipSeconds').value=clipLengths[mode];$('captureDurationField').hidden=mode==='normal';updateDurationLabels();$('durationSheet').showModal();}

async function initDB(){try{db=await new Promise((res,rej)=>{let r=indexedDB.open('after-hours-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('story');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});let saved=await new Promise((res,rej)=>{let r=db.transaction('story').objectStore('story').get('clips');r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});clips=saved;renderList();$('empty').hidden=false}catch(e){status('브라우저 보관함을 사용할 수 없어요. 촬영 후 파일로 저장해 주세요.')}}
async function persist(){$('downloadArea').hidden=true;if(!db){status('현재 세션에만 보관 중이에요. 파일로 저장해 주세요.');return}try{await new Promise((res,rej)=>{let tx=db.transaction('story','readwrite');tx.objectStore('story').put(clips,'clips');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}catch(e){status('브라우저 저장 공간이 부족해요. 현재 영상을 파일로 저장해 주세요.')}}
function renderList(){
 const root=$('clips');root.replaceChildren();$('cutCount').textContent=clips.length;
 if(!clips.length){const p=document.createElement('p');p.className='hint';p.textContent='아직 담은 순간이 없어요.';root.append(p);}
 clips.forEach((clip,i)=>{
  const item=document.createElement('div');item.className='clip'+(i===selected?' selected':'');item.dataset.id=clip.id;
  const img=document.createElement('img');img.src=clip.frames[0];img.alt=`${i+1}번째 컷 미리보기`;img.draggable=false;
  const edit=document.createElement('button');edit.className='edit';edit.textContent=`${i+1}. ${clip.mode==='timelapse'?'타임랩스':clip.mode==='sample'?'샘플':'일반'} · ${clip.seconds}초`;edit.disabled=busy;
  const choose=()=>{if(!busy&&performance.now()>suppressClipClickUntil)select(i);};edit.onclick=choose;img.onclick=choose;
  const handle=document.createElement('button');handle.className='dragHandle';handle.textContent='⠿';handle.setAttribute('aria-label',`${i+1}번 컷 순서 변경`);handle.title='위아래로 드래그 · 키보드 방향키로 이동';handle.disabled=busy;
  handle.onkeydown=e=>{if(!busy&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(i,e.key==='ArrowUp'?-1:1);}};
  const del=document.createElement('button');del.className='deleteClip';del.textContent='×';del.disabled=busy;del.setAttribute('aria-label',`${i+1}번 컷 삭제`);del.onclick=()=>{if(performance.now()>suppressClipClickUntil)remove(i);};
  const modify=document.createElement('button');modify.className='modifyClip';modify.disabled=busy;modify.setAttribute('aria-label',`${i+1}번 컷 수정`);modify.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
  modify.onclick=()=>{if(busy||performance.now()<suppressClipClickUntil)return;selected=i;openSettings(true);void select(i);};
  item.append(img,edit,handle,modify,del);root.append(item);bindClipDrag(item);
 });
 $('total').textContent=`${clips.length} CUTS · ${clips.reduce((s,c)=>s+c.seconds,0)}초`;
 for(const id of ['play','export'])$(id).disabled=busy||!clips.length;
}

async function select(i){stopLive();selected=i;let clip=clips[i];if(!clip)return;$('empty').hidden=true;syncTimeControl();let imgs=await Promise.all(collageFrames(clip).map(image));draw(imgs[1],imgs,clip.caption,clip.time,clip.collage,clipLayout(clip),clip.sourceBounds?.[photoIndicesFor(clip)[1]]);renderList()}
async function move(i,delta){let j=i+delta;if(j<0||j>=clips.length)return;[clips[i],clips[j]]=[clips[j],clips[i]];await select(j);persist()}
async function remove(i){clips.splice(i,1);selected=Math.min(i,clips.length-1);renderList();persist();if(selected>=0)select(selected);else{$('empty').hidden=false;ctx.clearRect(0,0,540,960)}}

function snapshot(source,boundsList){let c=document.createElement('canvas');c.width=540;c.height=960;if(source===$('camera'))paintCamera(c.getContext('2d'),source,540,960);else cover(c.getContext('2d'),source,0,0,540,960);if(boundsList){const r=source===$('camera')?cameraRect(source.videoWidth,source.videoHeight,540,960,'cover',digitalZoom):[0,0,540,960];boundsList.push(visibleBounds(r,540,960));}return c.toDataURL('image/jpeg',.8)}

async function add(frames,m,seconds,timing=beginTiming(),sourceBounds=null){
 const id=crypto.randomUUID();pendingClip={id,layoutVersion:2,layout:layoutFor(id),frames,sourceBounds:sourceBounds||frames.map(()=>[0,0,540,960]),mode:m,seconds,caption:$('caption').value,...timing,collage:$('collage').checked};
 stopLive();$('empty').hidden=true;
 pendingClip.photoIndices=photoIndicesFor(pendingClip);pendingClip.crops=clipCrops(pendingClip);
 const photos=await Promise.all(collageFrames(pendingClip).map(image));
 draw(photos[1],photos,pendingClip.caption,pendingClip.time,pendingClip.collage,clipLayout(pendingClip),pendingClip.sourceBounds?.[photoIndicesFor(pendingClip)[1]]);
 $('captureDock').hidden=true;$('reviewDock').hidden=false;$('textEdit').hidden=true;status('미리보기를 확인하고 담기를 눌러주세요.');
}
async function record(){if(busy||cameraOpening||zoomChanging)return;if(!stream||!stream.active){await camera();return}cancelled=false;lock(true);try{stopLive();live=true;loop();$('counter').hidden=false;for(let n=3;n>0;n--){$('counter').textContent=n;await wait(1000);if(cancelled)throw Error('촬영을 취소했어요.')} $('counter').hidden=true;const timing=beginTiming();activeCaptureTime=timing.time;const seconds=clipLengths[mode],duration=mode==='normal'?seconds:Math.max(seconds,Number($('duration').value)||30),count=seconds*15,frames=[],bounds=[],start=performance.now();for(let n=0;n<count;n++){let target=start+n*duration*1000/count;await wait(Math.max(0,target-performance.now()));if(cancelled||document.hidden)throw Error('촬영이 중단됐어요. 화면을 켠 상태에서 다시 찍어주세요.');frames.push(snapshot($('camera'),bounds));status(`촬영 중 · ${Math.min(duration,(performance.now()-start)/1000).toFixed(1)} / ${duration}초`)}await wait(Math.max(0,start+duration*1000-performance.now()));if(cancelled)throw Error('촬영을 취소했어요.');await add(frames,mode,seconds,timing,bounds)}catch(e){status(e.message)}finally{activeCaptureTime=null;$('counter').hidden=true;stopLive();lock(false)}}
async function importVideo(file){if(!file)return;if(file.size>300*1024*1024){status('300MB 이하의 영상을 선택해 주세요.');return}cancelled=false;lock(true);stopLive();const timing=beginTiming();let url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';try{await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('영상을 읽지 못했어요. 다른 파일을 선택해주세요.'));v.src=url});let d=v.duration;if(!Number.isFinite(d)||d<=0)throw Error('이 영상의 길이를 확인할 수 없어요.');const seconds=clipLengths[mode],count=seconds*15,span=mode==='normal'?Math.min(seconds,d):d,frames=[];for(let i=0;i<count;i++){if(cancelled)throw Error('가져오기를 취소했어요.');await new Promise((res,rej)=>{let timer=setTimeout(()=>rej(Error('영상 읽기 시간이 초과됐어요.')),10000);v.onseeked=()=>{clearTimeout(timer);res()};v.currentTime=Math.min(Math.max(.001,i*span/count),Math.max(.001,d-.03))});frames.push(snapshot(v));status(`영상 준비 중 · ${Math.round((i+1)/count*100)}%`)}await add(frames,mode,seconds,timing)}catch(e){status(e.message)}finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(url);$('upload').value='';lock(false)}}
async function sequence(exporting){if(!clips.length||busy)return;cancelled=false;lock(true);stopLive();$('empty').hidden=true;let recorder=null,outputStream=null;try{status('컷을 준비하고 있어요…');let prepared=await Promise.all(clips.map(c=>Promise.all(c.frames.map(image))));let first=prepared[0],fc=clips[0];draw(first[0],collageFrames(fc,first),fc.caption,fc.time,fc.collage,clipLayout(fc),fc.sourceBounds?.[0]);let chunks=[];if(exporting){if(!window.MediaRecorder||!canvas.captureStream)throw Error('이 브라우저에서는 영상 저장을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어주세요.');let type=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('지원되는 영상 저장 형식을 찾지 못했어요.');outputStream=canvas.captureStream(30);recorder=new MediaRecorder(outputStream,{mimeType:type,videoBitsPerSecond:5000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start()}
for(let index=0;index<clips.length;index++){let clip=clips[index],images=prepared[index],photos=collageFrames(clip,images);let start=performance.now();await new Promise((resolve,reject)=>{function step(now){if(cancelled||document.hidden){reject(Error('재생 / 저장을 중단했어요. 화면을 켜두고 다시 시도해주세요.'));return}let elapsed=(now-start)/1000;if(elapsed>=clip.seconds){resolve();return}const frameIndex=Math.min(images.length-1,Math.floor(elapsed/clip.seconds*images.length));draw(images[frameIndex],photos,clip.caption,clip.time,clip.collage,clipLayout(clip),clip.sourceBounds?.[frameIndex]);status(`${exporting?'영상 만드는 중':'이어서 보는 중'} · ${index+1}/${clips.length} 컷`);requestAnimationFrame(step)}requestAnimationFrame(step)})}
if(recorder){await new Promise((res,rej)=>{recorder.onstop=res;recorder.onerror=()=>rej(Error('영상 저장 중 오류가 발생했어요.'));recorder.stop()});resultBlob=new Blob(chunks,{type:recorder.mimeType});if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(resultBlob);$('result').src=resultURL;$('download').href=resultURL;$('download').download=`after-hours-${new Date().toISOString().slice(0,10)}.${resultBlob.type.includes('mp4')?'mp4':'webm'}`;$('downloadArea').hidden=false;status(`완성했어요! ${clips.reduce((s,c)=>s+c.seconds,0)}초 · ${resultBlob.type.includes('mp4')?'MP4':'WebM'} · 아래에서 다운로드하거나 공유하세요.`)}else status('모든 컷을 재생했어요.')}catch(e){status(e.message);if(recorder?.state==='recording')recorder.stop()}finally{outputStream?.getTracks().forEach(t=>t.stop());lock(false)}}
$('cameraStart').onclick=()=>{selected=-1;camera()};$('zoom').oninput=changeZoom;$('flip').onclick=()=>{facing=facing==='environment'?'user':'environment';camera()};$('normal').onclick=()=>setMode('normal');$('timelapse').onclick=()=>setMode('timelapse');$('record').onclick=record;$('cancel').onclick=()=>{cancelled=true};$('upload').onchange=e=>importVideo(e.target.files[0]);$('play').onclick=()=>sequence(false);$('export').onclick=()=>sequence(true);$('share').onclick=async()=>{try{let file=new File([resultBlob],$('download').download,{type:resultBlob.type});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else $('download').click()}catch(e){if(e.name!=='AbortError')status('공유하지 못했어요. 다운로드 버튼으로 저장해주세요.')}};document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy)cancelled=true});window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));setMode('normal');syncTimeControl();initDB().finally(()=>{if(!$('shootScreen').hidden&&!busy&&!pendingClip&&!stream?.active)camera();});

function openSettings(textOnly=false){
 if(busy||pendingClip||$('settingsSheet').open)return;
 const clip=!$('galleryScreen').hidden&&selected>=0?clips[selected]:null;
 settingsOriginal={clipId:clip?.id??null,caption:clip?.caption??$('caption').value,time:clip?.time??$('time').value,collage:clip?.collage??$('collage').checked};
 $('editCaption').disabled=false;$('editCaption').readOnly=false;$('editCaption').value=settingsOriginal.caption;$('editTime').value=settingsOriginal.time;$('editCollage').checked=settingsOriginal.collage;
 syncTimeControl();$('editTime').disabled=$('time').disabled;
 $('settingsSheet').classList.toggle('captionOnly',textOnly&&$('galleryScreen').hidden);$('settingsSheet').showModal();if(textOnly){$('editCaption').focus({preventScroll:true});}
}
function showScreen(screen){if(busy||pendingClip)return;const gallery=screen==='gallery';stopLive();$('shootScreen').hidden=gallery;$('galleryScreen').hidden=!gallery;(gallery?$('galleryStage'):$('cameraStage')).prepend(document.querySelector('.viewer'));$('shootTab').setAttribute('aria-current',gallery?'false':'page');$('galleryTab').setAttribute('aria-current',gallery?'page':'false');if(gallery){if(clips.length)select(selected>=0?selected:clips.length-1);else $('empty').hidden=false;}else{selected=-1;if(stream?.active)resumeCamera();else{$('empty').hidden=false;camera();}}status(gallery?'컷을 선택해 문구를 바꾸거나 순서를 정리하세요.':'준비되면 촬영 버튼을 눌러주세요.');}
function startNext(){pendingClip=null;for(const id of ['shootTab','galleryTab','textEdit','collageToggle','durationOpen'])$(id).disabled=false;$('captureDock').hidden=false;$('reviewDock').hidden=true;$('textEdit').hidden=false;selected=-1;if(stream?.active)resumeCamera();else{$('empty').hidden=false;ctx.clearRect(0,0,540,960);}}
function discardSettings(){
 settingsOriginal=null;
 // The dialog edits separate draft fields; dismissing never touches saved state.
 $('editCaption').value='';$('editTime').value='';
}
$('textEdit').onclick=()=>openSettings(true);
$('settingsClose').onclick=async()=>{
 if(!settingsOriginal||!$('editCaption').reportValidity()||(!$('editTime').disabled&&!$('editTime').reportValidity()))return;
 const session=settingsOriginal,values={caption:$('editCaption').value.replace(/[\r\n]+/g,' '),time:$('editTime').value,collage:$('editCollage').checked};
 const index=session.clipId===null?-1:clips.findIndex(c=>c.id===session.clipId);
 if(session.clipId!==null&&index<0){discardSettings();$('settingsSheet').close();return;}
 if(index>=0){Object.assign(clips[index],values);}else{
  // Capture defaults belong to the camera, never to a selected gallery clip.
  $('caption').value=values.caption;$('collage').checked=values.collage;
 }
 settingsOriginal=null;syncCollageIcon();$('settingsSheet').close();
 if(index>=0){await select(index);await persist();}
};
$('settingsCancel').onclick=()=>{discardSettings();$('settingsSheet').close();};
$('settingsSheet').addEventListener('cancel',()=>discardSettings());
$('settingsSheet').addEventListener('close',()=>{if(!$('settingsSheet').open)discardSettings();});
$('settingsSheet').onclick=e=>{if(e.target===$('settingsSheet')){const r=e.target.getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right){discardSettings();e.target.close();}}};
$('shootTab').onclick=()=>showScreen('shoot');$('galleryTab').onclick=()=>showScreen('gallery');
$('keep').onclick=async()=>{if(!pendingClip||busy)return;clips.push(pendingClip);await persist();renderList();startNext();status('담았어요! 바로 다음 순간을 찍어보세요.');};$('retake').onclick=()=>{startNext();status('다시 찍을 준비가 됐어요.');};

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
 do{c.font=`${size}px Georgia,serif`;widths=glyphs.map(g=>c.measureText(g).width);total=widths.reduce((a,b)=>a+b,0)+Math.max(0,glyphs.length-1)*spacing;if(total<=490||size<=10)break;size--;}while(true);
 c.textAlign='left';let left=x-total/2;glyphs.forEach((g,i)=>{c.fillText(g,left,y);left+=widths[i]+spacing;});
}

function syncCollageIcon(){$('collageToggle').setAttribute('aria-pressed',String($('collage').checked));}
$('collageToggle').onclick=()=>{if(busy||pendingClip)return;$('collage').checked=!$('collage').checked;syncCollageIcon();status($('collage').checked?'콜라주 켜짐 · 촬영 후 작은 사진 2~3장을 추가해요.':'콜라주 꺼짐');};

function previewDuration(){
 const n=Number($('clipSeconds').value);
 if(!Number.isInteger(n)||n<1||n>30){$('durationSummary').textContent='1~30초 사이로 입력해 주세요.';return;}
 if(mode==='timelapse')$('duration').min=n;
 $('durationSummary').textContent=mode==='normal'?`${n}초 동안 촬영해요.`:`${Math.max(n,Number($('duration').value)||30)}초를 ${n}초로 압축해요.`;
}
function discardDuration(){
 if(!durationOriginal)return;
 $('duration').value=durationOriginal.capture;$('duration').min=clipLengths.timelapse;$('clipSeconds').value=clipLengths[mode];durationOriginal=null;updateDurationLabels();
}
$('durationOpen').onclick=openDuration;$('clipSeconds').oninput=previewDuration;
$('duration').oninput=previewDuration;
$('durationClose').onclick=()=>{if(!$('clipSeconds').reportValidity())return;if(mode==='timelapse'&&!$('duration').reportValidity())return;saveDurations();durationOriginal=null;$('durationSheet').close();};
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
