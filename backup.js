'use strict';
// Bounded, evenly thinned samples for recordings of unknown duration.
class TimelapseSamples {
 constructor(limit=360){this.limit=limit;this.interval=1000/30;this.next=0;this.samples=[];}
 due(ms){return ms>=this.next;}
 push(ms,frame){this.samples.push({ms,frame});if(this.samples.length>this.limit){this.samples=this.samples.filter((_,i)=>i%2===0);this.interval*=2;}this.next=ms+this.interval;}
 finish(count,elapsed){let i=0;return Array.from({length:count},(_,n)=>{const target=n*elapsed/count;while(i+1<this.samples.length&&Math.abs(this.samples[i+1].ms-target)<Math.abs(this.samples[i].ms-target))i++;return this.samples[i].frame;});}
}
const QWER_UUID=new TextEncoder().encode('qwervlog-time-v1');
const MP4_EPOCH=2082844800;
async function mp4Info(blob,stamp){
 const edits=[];let capturedAt=null,own=null;
 async function walk(start,end,depth=0){
  if(depth>4)return;
  for(let p=start;p+8<=end;){
   const h=new DataView(await blob.slice(p,p+32).arrayBuffer());let size=h.getUint32(0),head=8;
   const type=String.fromCharCode(...new Uint8Array(h.buffer,4,4));
   if(size===1){if(h.byteLength<16)break;size=Number(h.getBigUint64(8));head=16;}else if(size===0)size=end-p;
   if(size<head||p+size>end)break;
   if(['moov','trak','mdia'].includes(type))await walk(p+head,p+size,depth+1);
   if(['mvhd','tkhd','mdhd'].includes(type)&&size>=head+16){
    const data=new Uint8Array(await blob.slice(p+head,p+Math.min(size,head+24)).arrayBuffer()),v=new DataView(data.buffer),wide=data[0]===1;
    const value=wide?Number(v.getBigUint64(4)):v.getUint32(4);
    if(type==='mvhd'&&value>MP4_EPOCH){const date=new Date((value-MP4_EPOCH)*1000);if(date.getUTCFullYear()>=2000&&date.getTime()<=Date.now()+86400000)capturedAt=date.toISOString();}
    if(stamp){const sec=Math.floor(new Date(stamp).getTime()/1000)+MP4_EPOCH;if(wide){v.setBigUint64(4,BigInt(sec));v.setBigUint64(12,BigInt(sec));}else{v.setUint32(4,sec);v.setUint32(8,sec);}edits.push({at:p+head,data});}
   }
   if(type==='uuid'&&size<4096&&size>=head+16){const bytes=new Uint8Array(await blob.slice(p+head,p+size).arrayBuffer());if(QWER_UUID.every((v,i)=>bytes[i]===v)){try{own=JSON.parse(new TextDecoder().decode(bytes.slice(16)));}catch(e){}}}
   p+=size;
  }
 }
 await walk(0,blob.size);return {edits,capturedAt,own};
}
async function stampBackup(blob,clip){
 if(!blob.type.includes('mp4'))return blob;
 const {edits}=await mp4Info(blob,clip.capturedAt),parts=[];let pos=0;
 for(const e of edits.sort((a,b)=>a.at-b.at)){parts.push(blob.slice(pos,e.at),e.data);pos=e.at+e.data.length;}parts.push(blob.slice(pos));
 const json=new TextEncoder().encode(JSON.stringify({capturedAt:clip.capturedAt,seconds:clip.seconds,mode:clip.mode}));
 const box=new Uint8Array(24+json.length);new DataView(box.buffer).setUint32(0,box.length);box.set(new TextEncoder().encode('uuid'),4);box.set(QWER_UUID,8);box.set(json,24);parts.push(box);
 return new Blob(parts,{type:blob.type});
}
async function readBackupTiming(file){
 try{const info=await mp4Info(file);const stamp=info.own?.capturedAt||info.capturedAt;
 if(stamp&&Number.isFinite(Date.parse(stamp)))return {timing:captureTiming(new Date(stamp)),own:info.own};}catch(e){}
 const match=file.name.match(/qwervlog-(\d{13})-/);if(match)return {timing:captureTiming(new Date(Number(match[1]))),own:null};
 return null;
}
let pendingBackup=null,backupURL=null,keeping=false;
async function makeCleanBackup(clip){
 if(!window.MediaRecorder)throw Error('이 브라우저는 원본 영상 저장을 지원하지 않아요.');
 const type=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('원본 저장 형식을 지원하지 않아요.');
 const c=document.createElement('canvas');c.width=VIDEO_WIDTH;c.height=VIDEO_HEIGHT;const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
 const paint=async i=>{const img=await image(clip.frames[i]);cover(x,img,0,0,c.width,c.height,{zoom:1,x:.5,y:.5,bounds:clip.sourceBounds?.[i]});};
 await paint(0);const output=c.captureStream(VIDEO_FPS),rec=new MediaRecorder(output,{mimeType:type,videoBitsPerSecond:16000000}),chunks=[];
 const ended=new Promise((res,rej)=>{rec.onstop=res;rec.onerror=()=>rej(Error('원본 영상 준비에 실패했어요.'));});ended.catch(()=>{});
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 try{rec.start();const start=performance.now();for(let i=0;i<clip.frames.length;i++){
  if(cancelled||document.hidden)throw Error('원본 준비가 중단됐어요. 원본 저장을 다시 눌러주세요.');
  await paint(i);await wait(Math.max(0,start+(i+1)*clip.seconds*1000/clip.frames.length-performance.now()));
 }rec.stop();await ended;
 const blob=await stampBackup(new Blob(chunks,{type:type.includes('mp4')?'video/mp4':'video/webm'}),clip);
 return new File([blob],`qwervlog-${Date.parse(clip.capturedAt)}-${clip.mode}.${type.includes('mp4')?'mp4':'webm'}`,{type:blob.type,lastModified:Date.parse(clip.capturedAt)});
 }finally{if(rec.state!=='inactive')rec.stop();output.getTracks().forEach(t=>t.stop());}
}
function setBackupFile(file){pendingBackup=file;if(backupURL)URL.revokeObjectURL(backupURL);backupURL=file?URL.createObjectURL(file):null;$('backupAgain').hidden=!file;}
function shareCleanBackup(){
 if(!pendingBackup)return Promise.resolve(false);
 if(navigator.canShare?.({files:[pendingBackup]}))return navigator.share({files:[pendingBackup]}).then(()=>true);
 const a=document.createElement('a');a.href=backupURL;a.download=pendingBackup.name;a.click();return Promise.resolve(false);
}
async function prepareBackup(){
 if(!pendingClip||busy)return;cancelled=false;pausePendingClip();lock(true);status('꾸밈없는 원본 영상을 준비하고 있어요…');
 try{setBackupFile(await makeCleanBackup(pendingClip));status('원본 준비 완료. 담기 후 공유창에서 비디오 저장을 눌러주세요.');}catch(e){status(e.message);}finally{lock(false);}
}
async function keepAndBackup(){
 if(!pendingClip||busy||keeping)return;
 if(!pendingBackup){await prepareBackup();return;}
 keeping=true;pausePendingClip();const clip=pendingClip;
 // Open the native share sheet synchronously inside this tap, before DB awaits.
 let sharing;try{sharing=shareCleanBackup().catch(e=>{if(e.name==='AbortError')return false;return false;});}catch(e){sharing=Promise.resolve(false);}
 if(!clips.some(c=>c.id===clip.id))clips.push(clip);
 $('keep').disabled=true;$('retake').disabled=true;
 const saved=await persist();renderList();const shared=await sharing;
 startNext();keeping=false;
 status(!saved?'기기에 보관하지 못했어요. 원본 다시 저장으로 파일을 꼭 보관해 주세요.':shared?'담았어요. 사진 앱에 저장됐는지 확인해 주세요.':'담았어요. 원본 다시 저장으로 비디오 저장을 완료해 주세요.');
}
