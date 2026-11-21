const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const app=fs.readFileSync('app.js','utf8');
const code=app.slice(app.indexOf('async function importVideo(file){'),app.indexOf('// Decode only a small moving window'));
async function run(duration,normal=2,own=null,mode='normal'){
 const seeks=[];let result,disposed=false;const timing={time:'13:30'};
 const c={busy:false,cancelled:false,mode,clipLengths:{normal,timelapse:6},VIDEO_FPS:30,snapshotCanvas:null,
 lock(){},stopLive(){},status(){},$:()=>({value:''}),readBackupTiming:async()=>({own,timing}),unknownCaptureTiming(){throw Error('timing lost');},
 loadVideoFile:async()=>({video:{duration},dispose(){disposed=true;}}),seekDecodedFrame:async(v,t)=>seeks.push(t),snapshot:()=>seeks.at(-1),
 add:async(frames,mode,seconds,time)=>{result={frames,mode,seconds,time};}};
 vm.createContext(c);vm.runInContext(code,c);await c.importVideo({size:100});assert.ok(disposed);assert.equal(result.time,timing);return {result,seeks};
}
test('normal import trims the first two seconds at natural speed',async()=>{const {result,seeks}=await run(10);assert.equal(result.seconds,2);assert.equal(result.frames.length,60);assert.equal(seeks[0],0);assert.ok(Math.abs(seeks[59]-59/30)<1e-8);});
test('normal import uses selected duration and does not stretch short videos',async()=>{assert.equal((await run(10,3)).result.seconds,3);assert.equal((await run(1.2)).result.seconds,1.2);});
test('normal import trims backups too without losing capture time',async()=>{const {result,seeks}=await run(8,2,{mode:'timelapse',seconds:8});assert.equal(result.mode,'normal');assert.equal(result.seconds,2);assert.ok(seeks.at(-1)<2);});
test('timelapse import still samples the full video into six seconds',async()=>{const {result,seeks}=await run(60,2,null,'timelapse');assert.equal(result.seconds,6);assert.equal(result.frames.length,180);assert.ok(seeks.at(-1)>59);});
