const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const nodes={},buttons=[.5,1,1.5,2].map(n=>({dataset:{zoom:String(n)},setAttribute(){}}));
let applied=1;
const track={getSettings:()=>({deviceId:'wide',zoom:applied}),getCapabilities:()=>({zoom:{min:.5,max:4,step:.1}}),applyConstraints:async c=>{applied=c.advanced[0].zoom;}};
const context={$:id=>nodes[id]??={value:1},busy:false,live:true,facing:'environment',stream:{active:true,getVideoTracks:()=>[track]},document:{querySelectorAll:()=>buttons},navigator:{mediaDevices:{enumerateDevices:async()=>[]}},status(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync('camera.js','utf8'),context);
(async()=>{
 await context.configureCamera();assert.equal(applied,1);assert.equal(buttons[0].disabled,false);
 nodes.zoom.value=.5;await context.changeZoom();assert.equal(applied,.5);assert.equal(vm.runInContext('digitalZoom',context),1);
 const devices=[{kind:'videoinput',deviceId:'wide',label:'Back Camera 1'},{kind:'videoinput',deviceId:'ultra',label:'Back Ultra‑Wide Camera'}];
 context.rememberRearCameras(devices,track);assert.equal(vm.runInContext('rearWide.deviceId',context),'wide');assert.equal(vm.runInContext('rearUltra.deviceId',context),'ultra');
 context.navigator.mediaDevices.enumerateDevices=async()=>devices;track.getCapabilities=()=>({});
 await context.configureCamera();assert.equal(Number(nodes.zoom.min),.5);assert.equal(buttons[0].disabled,false);
 context.navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'wide',label:'Back Camera'}];await context.configureCamera();assert.equal(buttons[0].disabled,true);
 console.log('PASS: native 0.5 applied without digital shrink; delayed lens discovery; alternate names; unsupported camera disabled');
})();
