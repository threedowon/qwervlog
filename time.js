function localClock(date) {
  return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
}
function captureTiming(date,automatic,manualTime) {
  const capturedTime=localClock(date);
  return {capturedAt:date.toISOString(),capturedTime,time:automatic?capturedTime:manualTime};
}
let activeCaptureTime=null;
function syncTimeControl(){
  $('time').disabled=busy||$('autoTime').checked;
}
function beginTiming(){
  const timing=captureTiming(new Date(),$('autoTime').checked,$('time').value);
  $('time').value=timing.time;
  return timing;
}
function liveClock(){
  const time=activeCaptureTime??($('autoTime').checked?localClock(new Date()):$('time').value);
  if($('autoTime').checked)$('time').value=time;
  return time;
}
async function changeAutoTime(){
  syncTimeControl();
  if(!$('autoTime').checked)return;
  if(live||selected<0){$('time').value=localClock(new Date());return;}
  const clip=clips[selected];
  if(clip.capturedTime){clip.time=clip.capturedTime;await select(selected);await persist();}
  else status('기존 컷에는 촬영 시각 기록이 없어 표시 시간을 유지해요. 새 촬영부터 자동 반영돼요.');
}
