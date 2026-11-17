const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const nodes={};const $=id=>nodes[id]??={value:1,setAttribute(){}};
let id='wide';const track={getSettings:()=>({deviceId:id}),getCapabilities:()=>({})};
const c={$,facing:'environment',busy:false,live:true,stream:{active:true,getVideoTracks:()=>[track]},document:{querySelectorAll:()=>[]},status(){},wait:async()=>{}};vm.createContext(c);vm.runInContext(fs.readFileSync('camera.js','utf8')+"\nrearWide={deviceId:'wide'};rearUltra={deviceId:'ultra'};globalThis.api={configureCamera,changeZoom,ultraRearCamera};",c);c.camera=async newId=>{id=newId;await c.api.configureCamera();};
(async()=>{await c.api.configureCamera();assert.equal(Number($('zoom').min),.5);assert.equal(Number($('zoom').value),1);
$('zoom').value=.5;await c.api.changeZoom();assert.equal(id,'ultra');assert.equal(vm.runInContext('digitalZoom',c),1);assert.equal(Number($('zoom').value),.5);
$('zoom').value=.75;await c.api.changeZoom();assert.equal(id,'ultra');assert.equal(vm.runInContext('digitalZoom',c),1.5);
$('zoom').value=1;await c.api.changeZoom();assert.equal(id,'wide');assert.equal(vm.runInContext('digitalZoom',c),1);
assert.equal(c.api.ultraRearCamera([{kind:'videoinput',label:'후면 초광각 카메라',deviceId:'u'}]).deviceId,'u');assert.equal(c.api.ultraRearCamera([{kind:'videoinput',label:'Front Ultra Wide Camera'}]),null);
console.log('PASS: 0.5 selects ultrawide without shrinking pixels; intermediate zoom; 1x restores wide; Korean labels');})();
