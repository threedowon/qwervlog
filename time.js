function localClock(date){return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');}
function captureTiming(date){const capturedTime=localClock(date);return {capturedAt:date.toISOString(),capturedTime,time:capturedTime};}
let activeCaptureTime=null;
function syncTimeControl(){const canEdit=Boolean(pendingClip)||(!$('galleryScreen').hidden&&selected>=0);$('timeField').hidden=!canEdit;$('time').disabled=busy||!canEdit;}
function beginTiming(){const timing=captureTiming(new Date());$('time').value=timing.time;return timing;}
function liveClock(){const time=activeCaptureTime??localClock(new Date());$('time').value=time;return time;}

// Keep stored/editor values in 24-hour format; format only the video overlay.
function videoClock(value){
 const match=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value||'');
 if(!match)return '';
 const hour=Number(match[1]),minute=Number(match[2]);
 if(hour>23||minute>59)return '';
 return `${hour<12?'am':'pm'} ${hour%12||12}:${match[2]}`;
}
