const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={Blob,File,TextEncoder,TextDecoder,DataView,Uint8Array,Date,captureTiming:date=>({capturedAt:date.toISOString(),time:date.toISOString().slice(11,16)})};vm.createContext(c);vm.runInContext(fs.readFileSync('backup.js','utf8')+'\nglobalThis.api={readBackupTiming,stampBackup};',c);
const enc=new TextEncoder();function box(t,d){const b=new Uint8Array(d.length+8),v=new DataView(b.buffer);v.setUint32(0,b.length);if(typeof t==='number')v.setUint32(4,t);else b.set(enc.encode(t),4);b.set(d,8);return b;}function concat(...a){return new Uint8Array(Buffer.concat(a.map(x=>Buffer.from(x))));}
(async()=>{
 const key=box('mdta',enc.encode('com.apple.quicktime.creationdate'));const header=new Uint8Array(8);new DataView(header.buffer).setUint32(4,1);
 const keys=box('keys',concat(header,key));const data=box('data',concat(new Uint8Array(8),enc.encode('2026-11-16T18:20:30+0900')));const ilst=box('ilst',box(1,data));const meta=box('meta',concat(new Uint8Array(4),keys,ilst));
 const mvhd=new Uint8Array(100);new DataView(mvhd.buffer).setUint32(4,Math.floor(Date.now()/1000)+2082844800);
 const file=new File([box('moov',concat(box('mvhd',mvhd),meta))],'IMG_1.MOV');const recovered=await c.api.readBackupTiming(file);assert.equal(recovered.timing.capturedAt,'2026-11-16T09:20:30.000Z');assert.equal(recovered.timing.timeSource,'camera-metadata');
 const missing=await c.api.readBackupTiming(new File(['no metadata'],'missing.webm'));assert.equal(missing.timing.time,'');assert.equal(missing.timing.capturedAt,null);
 const stamped=await c.api.stampBackup(new Blob([box('moov',box('mvhd',mvhd))],{type:'video/mp4'}),{capturedAt:null,seconds:6,mode:'timelapse'});
 const reimported=await c.api.readBackupTiming(new File([stamped],'unknown.mp4'));assert.equal(reimported.timing.time,'');assert.equal(reimported.own.seconds,6);
 console.log('PASS: Apple capture date beats export date; missing time stays blank, including backup round-trip');
})();
