function localClock(date){return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');}
function captureTiming(date){const capturedTime=localClock(date);return {capturedAt:date.toISOString(),capturedTime,time:capturedTime};}
let activeCaptureTime=null;
function syncTimeControl(){const canEdit=!$('galleryScreen').hidden&&selected>=0;$('timeField').hidden=!canEdit;$('time').disabled=busy||!canEdit;}
function beginTiming(){const timing=captureTiming(new Date());$('time').value=timing.time;return timing;}
function liveClock(){const time=activeCaptureTime??localClock(new Date());$('time').value=time;return time;}
