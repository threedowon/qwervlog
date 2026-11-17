'use strict';
const el=id=>document.getElementById(id);let stream=null,devices=[],opening=false;
const stop=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;el('view').srcObject=null;el('stop').hidden=true;};
async function openLens(deviceId){
 if(opening)return;opening=true;el('start').disabled=true;el('lens').disabled=true;stop();
 try{
  const video={width:{ideal:1080},height:{ideal:1920}};
  if(deviceId)video.deviceId={exact:deviceId};else video.facingMode={ideal:'environment'};
  stream=await navigator.mediaDevices.getUserMedia({video,audio:false});
  el('view').hidden=false;el('view').srcObject=stream;await el('view').play();
  devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  const track=stream.getVideoTracks()[0],settings=track.getSettings(),caps=track.getCapabilities?.()||{};
  el('lens').replaceChildren(...devices.map((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`카메라 ${i+1} (이름 없음)`;return o;}));
  el('lens').value=settings.deviceId||'';
  const zoom=caps.zoom?`${caps.zoom.min} ~ ${caps.zoom.max} (간격 ${caps.zoom.step??'미제공'})`:'배율 제어 정보 없음';
  // Device/group IDs never enter the displayed or copied report.
  el('report').value=['qwervlog 카메라 진단 v41',`브라우저: ${navigator.userAgent}`,`현재: ${track.label||'이름 없음'}`,`방향: ${settings.facingMode||'미제공'}`,`해상도: ${settings.width} × ${settings.height}`,`현재 배율: ${settings.zoom??'미제공'}`,`배율 범위: ${zoom}`,'','카메라 목록:',...devices.map((d,i)=>`${i+1}. ${d.label||'이름 없음'}`)].join('\n');
  el('copy').disabled=false;el('stop').hidden=false;el('status').textContent='결과 복사를 눌러 채팅에 붙여넣어 주세요. 목록에서 다른 렌즈도 확인할 수 있어요.';
 }catch(e){stop();el('status').textContent=`카메라 확인 실패: ${e.name} · ${e.message}`;el('report').value=el('status').textContent;el('copy').disabled=false;}
 finally{opening=false;el('start').disabled=false;el('lens').disabled=!stream;}
}
el('start').onclick=()=>openLens();el('lens').onchange=()=>openLens(el('lens').value);el('stop').onclick=stop;
el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('report').value);el('status').textContent='복사했어요. 채팅에 붙여넣어 주세요.';}catch(e){el('report').focus();el('report').select();el('status').textContent='선택된 내용을 복사하거나 화면을 캡처해 보내주세요.';}};
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
