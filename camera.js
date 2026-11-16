// Shared framing math keeps preview and captured frames identical.
function cameraRect(sw,sh,w,h,fit,zoom) {
  const scale=(fit==='contain'?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh))*zoom;
  const dw=sw*scale,dh=sh*scale;
  return [(w-dw)/2,(h-dh)/2,dw,dh];
}
let hardwareStep=.01, hardwareMin=1, requestedZoom=null;
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
  digitalZoom=1;hardwareZoom=false;hardwareBase=1;slider.min=1;slider.max=3;slider.step=.01;slider.value=1;
  if(caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)&&caps.zoom.max>caps.zoom.min){
    try{hardwareBase=Math.max(caps.zoom.min,Math.min(caps.zoom.max,1));await track.applyConstraints({advanced:[{zoom:hardwareBase}]});hardwareZoom=true;slider.min=caps.zoom.min/hardwareBase;slider.max=Math.min(caps.zoom.max/hardwareBase,6);hardwareStep=caps.zoom.step||.01;hardwareMin=caps.zoom.min;slider.step=.01;slider.value=(track.getSettings().zoom??hardwareBase)/hardwareBase;}catch(e){/* Retain digital framing when hardware control is unavailable. */}
  }
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
 const value=Number($('zoom').value);$('zoomValue').textContent=value.toFixed(1)+'×';syncZoomButtons();
 if(!hardwareZoom||!stream?.active){digitalZoom=value;if(!live)resumeCamera();return;}
 requestedZoom=value;
 if(zoomChanging)return;
 zoomChanging=true;$('record').disabled=true;$('flip').disabled=true;
 const track=stream.getVideoTracks()[0];
 try{
  while(requestedZoom!==null){
   const target=requestedZoom;requestedZoom=null;
   const raw=target*hardwareBase;
   const quantized=hardwareMin+Math.round((raw-hardwareMin)/hardwareStep)*hardwareStep;
   const actual=Math.max(Number($('zoom').min)*hardwareBase,Math.min(Number($('zoom').max)*hardwareBase,quantized));
   try{await track.applyConstraints({advanced:[{zoom:actual}]});}
   catch(e){if(requestedZoom===null){$('zoom').value=(track.getSettings().zoom||hardwareBase)/hardwareBase;$('zoomValue').textContent=Number($('zoom').value).toFixed(1)+'×';syncZoomButtons();status('이 배율은 카메라에서 적용되지 않았어요.');}}
  }
 }finally{zoomChanging=false;$('record').disabled=busy||cameraOpening;$('flip').disabled=busy;if(!live)resumeCamera();}
}
