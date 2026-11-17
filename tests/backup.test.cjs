const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={Blob,File,TextEncoder,TextDecoder,DataView,Uint8Array,Date,console,captureTiming:date=>({capturedAt:date.toISOString(),time:date.toISOString().slice(11,16)})};vm.createContext(context);vm.runInContext(fs.readFileSync('backup.js','utf8')+'\nglobalThis.api={TimelapseSamples,mp4Info,stampBackup,readBackupTiming};',context);
const {TimelapseSamples,mp4Info,stampBackup,readBackupTiming}=context.api;
const samples=new TimelapseSamples();for(let t=0;t<=3600000;t+=33.34){if(samples.due(t))samples.push(t,t);assert(samples.samples.length<=360);}samples.push(3600000,3600000);const frames=samples.finish(180,3600000);assert.equal(frames.length,180);assert.equal(frames[0],0);assert(frames.at(-1)>3500000);assert(frames.every((v,i)=>i===0||v>=frames[i-1]));
function box(type,data){const b=new Uint8Array(8+data.length);new DataView(b.buffer).setUint32(0,b.length);b.set(new TextEncoder().encode(type),4);b.set(data,8);return b;}
(async()=>{for(const version of [0,1]){
 const header=new Uint8Array(100);header[0]=version;const raw=new Blob([box('ftyp',new Uint8Array(16)),box('moov',box('mvhd',header)),box('mdat',new Uint8Array([1,2,3,4]))],{type:'video/mp4'});
 const clip={capturedAt:'2026-11-17T12:34:56.000Z',seconds:6,mode:'timelapse'};const marked=await stampBackup(raw,clip);const info=await mp4Info(marked);assert.equal(info.capturedAt,clip.capturedAt);assert.equal(info.own.mode,'timelapse');assert.equal(info.own.seconds,6);
 const restored=await readBackupTiming(new File([marked],'IMG_1234.MP4',{type:'video/mp4'}));assert.equal(restored.timing.capturedAt,clip.capturedAt);
 const unchanged=await mp4Info(raw);assert.equal(unchanged.capturedAt,null);
 // Standard creation date survives even when the custom trailing UUID is stripped.
 const stripped=marked.slice(0,raw.size);const recovered=await readBackupTiming(new File([stripped],'IMG_1234.MP4'));assert.equal(recovered.timing.capturedAt,null);
 }console.log('PASS: one-hour bounded sampling, 180 chronological frames, MP4 v0/v1 timestamp, renamed-file restore, stripped-metadata is unverified, original unchanged');})();
