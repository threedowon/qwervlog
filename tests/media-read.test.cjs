const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const c=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval});vm.runInContext(fs.readFileSync('media-read.js','utf8'),c);
class Video extends EventTarget{constructor(){super();this.duration=60;this.readyState=2;this.seeking=false;this.currentTime=0;this.error=null;}}
test('already decoded current frame needs no seeked event',async()=>{
 const v=new Video();await c.seekDecodedFrame(v,0);assert.equal(v.currentTime,0);
});
test('decoded state completes even if browser omits loadeddata event',async()=>{
 const v=new Video();v.readyState=1;const pending=c.waitForVideoState(v,()=>v.readyState>=2,{timeout:500});setTimeout(()=>{v.readyState=2;},10);await pending;
});
test('seeking waits for a decoded frame instead of trusting time assignment',async()=>{
 const v=new Video();v.seeking=true;v.readyState=1;
 const pending=c.seekDecodedFrame(v,30);assert.equal(v.currentTime,30);setTimeout(()=>{v.readyState=2;v.seeking=false;v.dispatchEvent(new Event('seeked'));},10);await pending;
});
test('cancel stops waiting for a stalled decoder',async()=>{
 const v=new Video();v.readyState=1;await assert.rejects(c.waitForVideoState(v,()=>false,{cancel:()=>true}),/취소/);
});
test('decode errors are distinguished from timeouts',async()=>{
 const v=new Video();v.error={code:3};await assert.rejects(c.waitForVideoState(v,()=>false),/코드 3/);
});
