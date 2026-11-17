const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const camera=fs.readFileSync('camera.js','utf8');
const nodes={};const $=id=>nodes[id]??={value:'1',textContent:'',setAttribute(){}};
const track={getCapabilities:()=>({zoom:{min:.5,max:4,step:.1}}),applyConstraints:async v=>{track.zoom=v.advanced[0].zoom;},getSettings:()=>({zoom:track.zoom})};
const c={$,facing:'environment',stream:{getVideoTracks:()=>[track]},document:{querySelectorAll:()=>[]}};vm.createContext(c);vm.runInContext(camera+'\nsyncZoomButtons=()=>{};globalThis.api={standardRearCamera,configureCamera};',c);
(async()=>{
const devices=['Back Triple Camera','Back Ultra Wide Camera','Back Camera','Front Camera'].map((label,i)=>({kind:'videoinput',label,deviceId:String(i)}));assert.equal(c.api.standardRearCamera(devices).label,'Back Camera');assert.equal(c.api.standardRearCamera(devices.slice(0,2)),null);
await c.api.configureCamera();assert.equal(track.zoom,.5);assert.equal(Number($('zoom').value),1);assert.equal(Number($('zoom').min),1);
const app=fs.readFileSync('app.js','utf8');const record=app.slice(app.indexOf('async function record(){'),app.indexOf('async function importVideo'));
let now=0,captured=null;const r={...c,console,performance:{now:()=>now},timelapseRecording:false,timelapseStop:false,busy:false,cameraOpening:false,zoomChanging:false,keeping:false,stream:{active:true},navigator:{},document:{hidden:false},enableCountdownSound:async()=>{},cancelled:false,lock(){},stopLive(){},loop(){},countdownBeep(){},wait:async ms=>{now+=ms;if(r.timelapseRecording&&now>4000)r.timelapseStop=true},beginTiming:()=>({time:'12:00'}),clipLengths:{timelapse:6},mode:'timelapse',VIDEO_FPS:30,snapshot:()=>now,status(){},add:async frames=>{captured=frames},updateDurationLabels(){},wakeLock:null,live:false,activeCaptureTime:null};vm.createContext(r);vm.runInContext(fs.readFileSync('backup.js','utf8').split('const QWER_UUID')[0]+record,r);await r.record();assert.equal(captured.length,180);assert.equal(r.timelapseRecording,false);
console.log('PASS: conservative wide lens selection, minimum zoom normalized to 1x, manual stop produces six seconds of frames');})();
