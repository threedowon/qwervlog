// Shared framing math keeps preview and captured frames identical.
function cameraRect(sw,sh,w,h,fit,zoom) {
  const scale=(fit==='contain'?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh))*zoom;
  const dw=sw*scale,dh=sh*scale;
  return [(w-dw)/2,(h-dh)/2,dw,dh];
}
let hardwareStep=.01, hardwareMin=1, hardwareMax=6, requestedZoom=null;
let rearWide=null,rearUltra=null,lensScale=1;
let hardwareBase=1, digitalZoom=1, hardwareZoom=false, cameraOpening=false, zoomChanging=false;
function paintCamera(c,source,w,h){
  const sw=source.videoWidth,sh=source.videoHeight;if(!sw||!sh)return;
  c.save();c.fillStyle='#141714';c.fillRect(0,0,w,h);
  const r=cameraRect(sw,sh,w,h,'cover',digitalZoom);
  c.drawImage(source,...r);c.restore();
}
function resumeCamera(){if(stream?.active&&!busy){$('empty').hidden=true;stopLive();live=true;loop()}}
async function configureCamera(){
  const track=stream.getVideoTracks()[0],caps=track.getCapabilities?.()||{},slider=$('zoom');
  // Some browsers expose lens names only once the preview has started.
  if(facing==='environment'){try{rememberRearCameras(await navigator.mediaDevices.enumerateDevices(),track);}catch(e){}}
  lensScale=facing==='environment'&&rearUltra&&rearUltra.deviceId===track.getSettings().deviceId?.toString()?0.5:1;
  digitalZoom=1;hardwareZoom=false;hardwareBase=1;slider.min=lensScale;slider.max=3;slider.step=.01;slider.value=lensScale;
  if(caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)&&caps.zoom.max>caps.zoom.min){
    try{hardwareBase=caps.zoom.min<1&&caps.zoom.max>=1?1:(caps.zoom.min>0?caps.zoom.min:1);await track.applyConstraints({advanced:[{zoom:hardwareBase}]});hardwareZoom=true;slider.min=caps.zoom.min/hardwareBase;slider.max=Math.min(caps.zoom.max/hardwareBase,6);hardwareStep=caps.zoom.step||.01;hardwareMin=caps.zoom.min;hardwareMax=caps.zoom.max;slider.step=.01;slider.value=(track.getSettings().zoom??hardwareBase)/hardwareBase;}catch(e){/* Retain digital framing when hardware control is unavailable. */}
  }
  slider.min=hardwareZoom?lensScale*hardwareMin/hardwareBase:lensScale;slider.value=lensScale;slider.max=Math.max(3,Number(slider.max)*lensScale);
  if(facing==='environment'&&rearWide&&rearUltra)slider.min=Math.min(.5,Number(slider.min));
  $('zoomValue').textContent=Number(slider.value).toFixed(1)+'×';syncZoomButtons();

}

function syncZoomButtons(){
 const slider=$('zoom'),value=Number(slider.value);
 for(const b of document.querySelectorAll('[data-zoom]')){
  const n=Number(b.dataset.zoom),supported=n>=Number(slider.min)-.001&&n<=Number(slider.max)+.001;
  b.disabled=busy||cameraOpening||!supported;
  b.title=supported?`${n.toFixed(1)}배`:'현재 카메라에서 지원하지 않는 배율이에요.';
  b.setAttribute('aria-pressed',String(Math.abs(value-n)<.025));
 }
}
async function changeZoom(){
 if(busy||cameraOpening)return;
 const value=Number($('zoom').value);
 const targetLens=facing==='environment'?(value<1?rearUltra:rearWide):null;
 if(targetLens&&stream?.active&&targetLens.deviceId!==stream.getVideoTracks()[0].getSettings().deviceId){
  if(zoomChanging){requestedZoom=null;while(zoomChanging)await wait(10);if(Number($('zoom').value)!==value)return;}
  await camera(targetLens.deviceId);if(!stream?.active)return;
  if(stream.getVideoTracks()[0].getSettings().deviceId!==targetLens.deviceId){status('이 렌즈를 열지 못했어요.');return;}
  $('zoom').value=value;return changeZoom();
 }
 $('zoomValue').textContent=value.toFixed(1)+'×';syncZoomButtons();
 if(!hardwareZoom||!stream?.active){digitalZoom=Math.max(1,value/lensScale);if(!live)resumeCamera();return;}
 requestedZoom=value;
 if(zoomChanging)return;
 zoomChanging=true;$('record').disabled=true;$('flip').disabled=true;
 const track=stream.getVideoTracks()[0];
 try{
  while(requestedZoom!==null){
   const target=requestedZoom;requestedZoom=null;
   const raw=target/lensScale*hardwareBase;
   const quantized=hardwareMin+Math.round((raw-hardwareMin)/hardwareStep)*hardwareStep;
   const actual=Math.max(hardwareMin,Math.min(hardwareMax,quantized));
   try{await track.applyConstraints({advanced:[{zoom:actual}]});digitalZoom=Math.max(1,raw/actual);}
   catch(e){if(requestedZoom===null){$('zoom').value=(track.getSettings().zoom||hardwareBase)/hardwareBase*lensScale;$('zoomValue').textContent=Number($('zoom').value).toFixed(1)+'×';syncZoomButtons();status('이 배율은 카메라에서 적용되지 않았어요.');}}
  }
 }finally{zoomChanging=false;$('record').disabled=busy||cameraOpening;$('flip').disabled=busy;if(!live)resumeCamera();}
}

// Prefer an explicitly named physical wide camera; never infer lens from device order.
function standardRearCamera(devices){
 const cameras=devices.filter(d=>d.kind==='videoinput');
 const rear=/back|rear|environment|후면|뒷면/i,other=/ultra|telephoto|tele\b|dual|triple|울트라|초광각|망원|듀얼|트리플/i;
 return cameras.find(d=>rear.test(d.label)&&!other.test(d.label)&&/wide|광각/i.test(d.label))
  ||cameras.find(d=>/^(back camera|rear camera|후면 카메라|후면 카메라\s*1)$/i.test(d.label.trim()))||null;
}
async function acquireCamera(video,explicitDevice){
 let acquired=await navigator.mediaDevices.getUserMedia({video,audio:false});
 if(facing!=='environment'){rearWide=null;rearUltra=null;return acquired;}
 try{
  const devices=await navigator.mediaDevices.enumerateDevices();
  rememberRearCameras(devices,acquired.getVideoTracks()[0]);
  if(explicitDevice)return acquired;
  const chosen=rearWide;
  if(chosen&&chosen.deviceId!==acquired.getVideoTracks()[0].getSettings().deviceId){
   acquired.getTracks().forEach(t=>t.stop());
   try{acquired=await navigator.mediaDevices.getUserMedia({video:{...video,facingMode:undefined,deviceId:{exact:chosen.deviceId}},audio:false});}
   catch(e){acquired=await navigator.mediaDevices.getUserMedia({video,audio:false});}
  }
 }catch(e){if(!acquired.active)throw e;}
 return acquired;
}

function ultraRearCamera(devices){return devices.find(d=>d.kind==='videoinput'&&/ultra[\s_‑–-]*wide|초\s*광각|울트라.*광각|(?:^|\s)0[.,]5\s*[x×배]/i.test(d.label)&&!/front|전면/i.test(d.label))||null;}

// Keep a usable return lens even when the browser calls it only "Back Camera 1".
function rememberRearCameras(devices,track){
 const cameras=devices.filter(d=>d.kind==='videoinput');
 const ultra=ultraRearCamera(cameras),wide=standardRearCamera(cameras);
 const current=cameras.find(d=>d.deviceId===track.getSettings().deviceId);
 rearUltra=ultra||cameras.find(d=>d.deviceId===rearUltra?.deviceId)||null;
 rearWide=wide||cameras.find(d=>d.deviceId===rearWide?.deviceId)||null;
 if(!rearWide&&current&&current.deviceId!==rearUltra?.deviceId&&!/front|전면|tele|망원|dual|triple|듀얼|트리플/i.test(current.label))rearWide=current;
}
