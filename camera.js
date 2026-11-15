// Shared framing math keeps preview and captured frames identical.
function cameraRect(sw,sh,w,h,fit,zoom) {
  const scale=(fit==='contain'?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh))*zoom;
  const dw=sw*scale,dh=sh*scale;
  return [(w-dw)/2,(h-dh)/2,dw,dh];
}
let digitalZoom=1, hardwareZoom=false, cameraOpening=false, zoomChanging=false;
function paintCamera(c,source,w,h){
  const sw=source.videoWidth,sh=source.videoHeight;if(!sw||!sh)return;
  c.save();c.fillStyle='#141714';c.fillRect(0,0,w,h);
  const r=cameraRect(sw,sh,w,h,$('framing').value,digitalZoom);
  c.drawImage(source,...r);c.restore();
}
function resumeCamera(){if(stream?.active&&!busy){$('empty').hidden=true;stopLive();live=true;loop()}}
async function configureCamera(){
  const track=stream.getVideoTracks()[0],caps=track.getCapabilities?.()||{},slider=$('zoom');
  digitalZoom=1;hardwareZoom=false;slider.min=1;slider.max=3;slider.step=.1;slider.value=1;
  if(caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)&&caps.zoom.max>caps.zoom.min){
    try{await track.applyConstraints({advanced:[{zoom:caps.zoom.min}]});hardwareZoom=true;slider.min=caps.zoom.min;slider.max=Math.min(caps.zoom.max,Math.max(caps.zoom.min,6));slider.step=caps.zoom.step||.1;slider.value=track.getSettings().zoom??caps.zoom.min;}catch(e){/* Retain digital framing when hardware control is unavailable. */}
  }
  $('zoomValue').textContent=Number(slider.value).toFixed(1)+'×';
  $('zoomHelp').textContent=hardwareZoom?'카메라가 지원하는 최소 배율에서 시작해요.':'이 카메라는 화면 확대를 지원해요. 더 넓게 보려면 전체 보기나 다른 렌즈를 선택하세요.';
  try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'),select=$('lens');select.replaceChildren();devices.forEach((d,i)=>{let o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`카메라 ${i+1}`;select.append(o)});select.value=track.getSettings().deviceId||'';$('lensRow').hidden=devices.length<2;}catch(e){$('lensRow').hidden=true}
}
async function changeZoom(){if(busy||cameraOpening||zoomChanging)return;const value=Number($('zoom').value);if(hardwareZoom&&stream?.active){zoomChanging=true;$('zoom').disabled=true;$('record').disabled=true;try{const track=stream.getVideoTracks()[0];await track.applyConstraints({advanced:[{zoom:value}]});$('zoom').value=track.getSettings().zoom??value;}catch(e){status('이 배율은 적용되지 않았어요. 다른 배율이나 렌즈를 선택해 주세요.');$('zoom').value=stream.getVideoTracks()[0].getSettings().zoom||$('zoom').min;}finally{zoomChanging=false;$('zoom').disabled=false;$('record').disabled=false}}else digitalZoom=value;$('zoomValue').textContent=Number($('zoom').value).toFixed(1)+'×';resumeCamera()}
